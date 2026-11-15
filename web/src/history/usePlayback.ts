import { useEffect, useRef, useState } from "react";

/**
 * El reloj de la historia: una sola posición (`pos`) que mueve el mapa, las barras, las cifras y la barra
 * de progreso. `pos` va de 0 a count − 1 en "años": 3 es el cuarto año exacto, 3.4 es un cuadro de la
 * transición entre el cuarto y el quinto.
 *
 * Regla de datos: solo las posiciones enteras son datos. Lo intermedio es animación, así que en reposo
 * `pos` siempre es entera: al pausar o soltar la barra se acomoda al año más cercano.
 */
export interface PlaybackState {
  /** Año exacto que muestran el año grande y el titular (en el play, el de partida hasta llegar al siguiente). */
  index: number;
  playing: boolean;
  /** true mientras `pos` no es un año exacto: lo que se ve es una transición, no un dato. */
  between: boolean;
}

type Listener = (pos: number) => void;

/** Parte de cada paso que dura la transición; el resto el año exacto queda quieto. */
const TRANSITION_SHARE = 0.8;
const SNAP_MS = 200;
const STEP_MS = 250;
const FADE_MS = 300;

export class Playback {
  pos = 0;
  /** Movimiento reducido: el mapa cambia de año con un fundido simple, sin lotes escalonados. */
  reduced = false;
  onState: (s: PlaybackState) => void = () => {};

  private count = 0;
  private transMs = 800;
  private holdMs = 200;
  private index = 0;
  private between = false;
  private playing = false;
  private mode: "idle" | "play" | "snap" = "idle";
  private hold = 0;
  private raf = 0;
  private last = 0;
  private snapFrom = 0;
  private snapTo = 0;
  private snapStart = 0;
  private snapMs = SNAP_MS;
  private listeners = new Set<Listener>();

  configure(count: number, stepMs: number, reduced: boolean) {
    this.count = count;
    this.reduced = reduced;
    if (reduced) {
      this.transMs = Math.min(FADE_MS, stepMs * TRANSITION_SHARE);
      this.holdMs = stepMs - this.transMs;
    } else {
      this.transMs = stepMs * TRANSITION_SHARE;
      this.holdMs = stepMs - this.transMs;
    }
  }

  /** Cada cuadro en que cambia la posición. Se llama una vez al suscribirse. */
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.pos);
    return () => {
      this.listeners.delete(fn);
    };
  }

  /** Arranca en un año exacto, sin animación (al cargar un condado). */
  reset(index: number) {
    this.halt();
    this.playing = false;
    this.pos = index;
    this.index = index;
    this.between = false;
    this.publish();
    this.emit();
  }

  play() {
    if (this.count < 2) return;
    if (this.pos >= this.count - 1) {
      // Desde el último año vuelve al primero y lo deja quieto un momento antes de arrancar.
      this.setPos(0, 0);
      this.hold = this.holdMs;
    } else {
      this.hold = 0;
    }
    this.playing = true;
    this.mode = "play";
    this.publish();
    this.run();
  }

  /** Pausa: termina en el año exacto más cercano. */
  pause() {
    if (!this.playing) return;
    this.playing = false;
    this.animateTo(Math.round(this.pos), SNAP_MS);
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  /** Arrastre de la barra: posición continua, sin animación. Mientras dura se ven cuadros intermedios. */
  seek(pos: number) {
    this.halt();
    this.playing = false;
    const p = Math.min(this.count - 1, Math.max(0, pos));
    const nearest = Math.round(p);
    this.setPos(Math.abs(p - nearest) < 0.002 ? nearest : p, nearest);
    this.publish();
  }

  /** Al soltar la barra: se acomoda al año más cercano. */
  release() {
    this.animateTo(Math.round(this.pos), SNAP_MS);
  }

  /** Va a un año exacto con una transición corta (flechas, clic en un año). */
  goTo(index: number) {
    this.playing = false;
    this.animateTo(Math.min(this.count - 1, Math.max(0, index)), this.reduced ? FADE_MS : STEP_MS);
  }

  /** Año anterior o siguiente al que se está mostrando. */
  step(delta: number) {
    const from = this.mode === "snap" ? this.snapTo : Math.round(this.pos);
    this.goTo(from + delta);
  }

  dispose() {
    this.halt();
    this.listeners.clear();
    this.onState = () => {};
  }

  private animateTo(target: number, ms: number) {
    this.halt();
    if (this.pos === target) {
      this.setPos(target, target);
      this.publish();
      return;
    }
    this.mode = "snap";
    this.snapFrom = this.pos;
    this.snapTo = target;
    this.snapMs = ms;
    this.snapStart = performance.now();
    // El año grande y el titular pasan ya al año de destino: es donde va a quedar.
    this.setPos(this.pos, target);
    this.publish();
    this.run();
  }

  private halt() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.mode = "idle";
  }

  private run() {
    if (this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number) => {
    this.raf = 0;
    const dt = Math.min(64, Math.max(0, now - this.last));
    this.last = now;
    if (this.mode === "play") {
      if (this.hold > 0) {
        this.hold -= dt;
      } else {
        const next = Math.floor(this.pos) + 1;
        const p = this.pos + dt / this.transMs;
        if (p >= next) {
          this.setPos(next, next);
          this.hold = this.holdMs;
          if (next >= this.count - 1) {
            this.mode = "idle";
            this.playing = false;
            this.publish();
            return;
          }
        } else {
          this.setPos(p);
        }
      }
    } else if (this.mode === "snap") {
      const u = Math.min(1, (now - this.snapStart) / this.snapMs);
      if (u >= 1) {
        this.mode = "idle";
        this.setPos(this.snapTo, this.snapTo);
        this.publish();
        return;
      }
      const eased = 1 - Math.pow(1 - u, 3);
      this.setPos(this.snapFrom + (this.snapTo - this.snapFrom) * eased, this.snapTo);
    }
    if (this.mode !== "idle") this.raf = requestAnimationFrame(this.frame);
  };

  private setPos(pos: number, index?: number) {
    this.pos = pos;
    const between = !Number.isInteger(pos);
    const idx = index ?? this.index;
    if (idx !== this.index || between !== this.between) {
      this.index = idx;
      this.between = between;
      this.publish();
    }
    this.emit();
  }

  private emit() {
    for (const fn of this.listeners) fn(this.pos);
  }

  private published = "";
  private publish() {
    const key = `${this.index}|${this.playing}|${this.between}`;
    if (key === this.published) return;
    this.published = key;
    this.onState({ index: this.index, playing: this.playing, between: this.between });
  }
}

/**
 * Un `Playback` por pantalla, con su estado para React. Lo que cambia en cada cuadro (mapa, barras,
 * barra de progreso) se suscribe con `pb.subscribe` y no pasa por React.
 */
export function usePlayback(count: number, stepMs: number): PlaybackState & { pb: Playback } {
  const ref = useRef<Playback | null>(null);
  if (!ref.current) ref.current = new Playback();
  const pb = ref.current;
  const [state, setState] = useState<PlaybackState>({ index: 0, playing: false, between: false });

  useEffect(() => {
    pb.onState = setState;
    return () => pb.dispose();
  }, [pb]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => pb.configure(count, stepMs, media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [pb, count, stepMs]);

  return { ...state, pb };
}
