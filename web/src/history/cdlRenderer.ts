/**
 * Dibuja el mapa del CDL y la transición entre dos años.
 *
 * Los índices de clase de cada año van a la placa una sola vez (una textura por año). En cada cuadro solo
 * cambia un número (`f`, cuánto avanzó la transición): el sombreador decide píxel a píxel si muestra el año
 * de partida o el de llegada. No se arma nada en el DOM ni se recorre el ráster por cuadro.
 *
 * Orden del cambio: el ráster se divide en bloques de BLOCK × BLOCK píxeles ("lotes" de 240 m). Cada bloque
 * tiene un umbral al azar pero fijo (con semilla): cambia cuando `f` lo alcanza, con un fundido corto.
 * Con f = 0 se ve exactamente el año de partida y con f = 1 exactamente el de llegada.
 */

/** Lado del bloque que cambia junto, en píxeles del ráster (8 × 30 m = 240 m). */
export const BLOCK = 8;
/** Semilla del orden de cambio: siempre la misma, así el video es igual cada vez. */
const SEED = 20261114;

export interface Frame {
  year: number;
  classes: Uint8Array;
}

export interface DrawOptions {
  /** 0..1: avance de la transición de `a` hacia `b`. */
  f: number;
  /** "blocks": lotes escalonados. "fade": fundido parejo de toda la imagen (movimiento reducido). */
  mode: "blocks" | "fade";
  /** Parte de la transición que dura el fundido de cada lote (0..1). */
  fade: number;
  /** Corre el orden de cambio para que cada par de años cambie en otro orden (0..1). */
  shift: number;
}

export interface CdlRenderer {
  readonly kind: "webgl" | "2d";
  /** Tabla clase → color en ABGR, como la espera ImageData. */
  setLut(lut: Uint32Array): void;
  /** `a` y `b` iguales (o f = 0) dibujan un año exacto. null = sin ráster: queda vacío. */
  draw(a: Frame | null, b: Frame | null, opts: DrawOptions): void;
  /** Píxeles dibujados (RGBA, fila de arriba primero), para comprobar que un año exacto coincide con el CDL. */
  read(): Uint8Array;
  dispose(): void;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uA;
uniform sampler2D uB;
uniform sampler2D uThr;
uniform sampler2D uLut;
uniform vec2 uThrScale;
uniform float uF;
uniform float uFade;
uniform float uShift;
uniform float uUniform;
varying vec2 vUv;
vec4 colorOf(float cls) {
  return texture2D(uLut, vec2((cls * 255.0 + 0.5) / 256.0, 0.5));
}
void main() {
  vec4 ca = colorOf(texture2D(uA, vUv).r);
  vec4 cb = colorOf(texture2D(uB, vUv).r);
  float thr = fract(texture2D(uThr, vUv * uThrScale).r + uShift) * (1.0 - uFade);
  float m = mix(clamp((uF - thr) / uFade, 0.0, 1.0), uF, uUniform);
  gl_FragColor = mix(ca, cb, m);
}`;

class WebglRenderer implements CdlRenderer {
  readonly kind = "webgl" as const;
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private textures = new Map<number, WebGLTexture>();
  private lutTex: WebGLTexture;
  private thrTex: WebGLTexture;
  private buffer: WebGLBuffer;

  constructor(
    gl: WebGLRenderingContext,
    private width: number,
    private height: number,
  ) {
    this.gl = gl;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
      return s;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "program");
    this.program = program;
    gl.useProgram(program);
    for (const name of ["uA", "uB", "uThr", "uLut", "uThrScale", "uF", "uFade", "uShift", "uUniform"]) {
      this.uniforms[name] = gl.getUniformLocation(program, name);
    }

    this.buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); // los anchos no son múltiplos de 4
    gl.viewport(0, 0, width, height);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);

    // Umbral de cada bloque: al azar con semilla fija.
    const bw = Math.ceil(width / BLOCK);
    const bh = Math.ceil(height / BLOCK);
    const rnd = mulberry32(SEED);
    const thr = new Uint8Array(bw * bh);
    for (let i = 0; i < thr.length; i++) thr[i] = Math.floor(rnd() * 256);
    this.thrTex = this.texture(gl.LUMINANCE, bw, bh, thr);
    gl.uniform2f(this.uniforms.uThrScale, width / (bw * BLOCK), height / (bh * BLOCK));

    this.lutTex = this.texture(gl.RGBA, 256, 1, new Uint8Array(256 * 4));
    gl.uniform1i(this.uniforms.uA, 0);
    gl.uniform1i(this.uniforms.uB, 1);
    gl.uniform1i(this.uniforms.uThr, 2);
    gl.uniform1i(this.uniforms.uLut, 3);
  }

  private texture(format: number, w: number, h: number, data: Uint8Array): WebGLTexture {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, format, w, h, 0, format, gl.UNSIGNED_BYTE, data);
    return tex;
  }

  private classes(frame: Frame): WebGLTexture {
    let tex = this.textures.get(frame.year);
    if (!tex) {
      tex = this.texture(this.gl.LUMINANCE, this.width, this.height, frame.classes);
      this.textures.set(frame.year, tex);
    }
    return tex;
  }

  setLut(lut: Uint32Array) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.lutTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(lut.buffer, lut.byteOffset, 1024));
  }

  draw(a: Frame | null, b: Frame | null, opts: DrawOptions) {
    const gl = this.gl;
    if (gl.isContextLost()) return;
    const from = a ?? b;
    const to = b ?? a;
    if (!from || !to) {
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.classes(from));
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.classes(to));
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.thrTex);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.lutTex);
    gl.uniform1f(this.uniforms.uF, from === to ? 0 : Math.min(1, Math.max(0, opts.f)));
    gl.uniform1f(this.uniforms.uFade, Math.min(1, Math.max(0.001, opts.fade)));
    gl.uniform1f(this.uniforms.uShift, opts.shift);
    gl.uniform1f(this.uniforms.uUniform, opts.mode === "fade" ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  read(): Uint8Array {
    const gl = this.gl;
    const w = this.width;
    const h = this.height;
    const raw = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, raw);
    // readPixels devuelve la fila de abajo primero
    const out = new Uint8Array(raw.length);
    for (let y = 0; y < h; y++) out.set(raw.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
    return out;
  }

  dispose() {
    const gl = this.gl;
    for (const tex of this.textures.values()) gl.deleteTexture(tex);
    this.textures.clear();
    gl.deleteTexture(this.lutTex);
    gl.deleteTexture(this.thrTex);
    gl.deleteBuffer(this.buffer);
    gl.deleteProgram(this.program);
  }
}

/** Sin WebGL: el año exacto se pinta igual, y la transición es un fundido parejo entre los dos años. */
class Canvas2dRenderer implements CdlRenderer {
  readonly kind = "2d" as const;
  private ctx: CanvasRenderingContext2D;
  private lut = new Uint32Array(256);
  private layers = new Map<number, HTMLCanvasElement>();

  constructor(
    canvas: HTMLCanvasElement,
    private width: number,
    private height: number,
  ) {
    this.ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  }

  setLut(lut: Uint32Array) {
    this.lut = lut;
    this.layers.clear();
  }

  private layer(frame: Frame): HTMLCanvasElement {
    let layer = this.layers.get(frame.year);
    if (!layer) {
      // Se guardan solo dos años: cada capa pesa ancho × alto × 4 bytes.
      if (this.layers.size >= 2) this.layers.delete(this.layers.keys().next().value!);
      layer = document.createElement("canvas");
      layer.width = this.width;
      layer.height = this.height;
      const ctx = layer.getContext("2d")!;
      const img = ctx.createImageData(this.width, this.height);
      const px = new Uint32Array(img.data.buffer);
      const lut = this.lut;
      const cls = frame.classes;
      for (let i = 0; i < cls.length; i++) px[i] = lut[cls[i]];
      ctx.putImageData(img, 0, 0);
      this.layers.set(frame.year, layer);
    }
    return layer;
  }

  draw(a: Frame | null, b: Frame | null, opts: DrawOptions) {
    const ctx = this.ctx;
    const from = a ?? b;
    const to = b ?? a;
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, this.width, this.height);
    if (!from || !to) return;
    const f = from === to ? 0 : Math.min(1, Math.max(0, opts.f));
    ctx.drawImage(this.layer(f >= 1 ? to : from), 0, 0);
    if (f > 0 && f < 1) {
      ctx.globalAlpha = f;
      ctx.drawImage(this.layer(to), 0, 0);
      ctx.globalAlpha = 1;
    }
  }

  read(): Uint8Array {
    return new Uint8Array(this.ctx.getImageData(0, 0, this.width, this.height).data.buffer);
  }

  dispose() {
    this.layers.clear();
  }
}

/** WebGL si está disponible y el ráster entra en una textura; si no, canvas 2D. */
export function createRenderer(canvas: HTMLCanvasElement, width: number, height: number): CdlRenderer {
  try {
    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
    });
    if (gl && Math.max(width, height) <= (gl.getParameter(gl.MAX_TEXTURE_SIZE) as number)) {
      return new WebglRenderer(gl, width, height);
    }
  } catch {
    // sigue al canvas 2D
  }
  return new Canvas2dRenderer(canvas, width, height);
}
