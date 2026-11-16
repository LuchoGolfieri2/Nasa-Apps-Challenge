import type { MouseEvent } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Transición al cambiar de pantalla desde un botón: un círculo verde nace donde se tocó, cubre la pantalla con el
 * nombre del destino, se cambia de ruta debajo y el verde se desvanece sobre la pantalla nueva.
 * Se usa como `onClick` de un enlace `<a href="#/...">`. Con ctrl, cmd, clic medio o movimiento reducido, el enlace
 * funciona como siempre. Si el navegador pausa las animaciones (pestaña oculta), un temporizador cambia de ruta igual.
 */
export function wipeTo(e: MouseEvent<HTMLAnchorElement>, label: string) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  if (reduced()) return;
  const href = e.currentTarget.getAttribute("href");
  if (!href || !href.startsWith("#")) return;
  e.preventDefault();

  const x = e.clientX || window.innerWidth / 2;
  const y = e.clientY || window.innerHeight / 2;
  const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)) + 8;

  const ov = document.createElement("div");
  ov.className = "wipe";
  ov.setAttribute("aria-hidden", "true");
  const text = document.createElement("span");
  text.textContent = label;
  ov.appendChild(text);
  ov.style.clipPath = `circle(0px at ${x}px ${y}px)`;
  document.body.appendChild(ov);

  let navigated = false;
  const reveal = () => {
    const out = ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, easing: "ease-out", fill: "forwards" });
    const done = () => ov.remove();
    out.finished.then(done, done);
    window.setTimeout(done, 900);
  };
  const go = () => {
    if (navigated) return;
    navigated = true;
    window.location.hash = href.slice(1);
    window.setTimeout(reveal, 160); // deja montar la pantalla nueva debajo del verde
  };

  const cover = ov.animate(
    [{ clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${r}px at ${x}px ${y}px)` }],
    { duration: 520, easing: "cubic-bezier(.65,0,.35,1)", fill: "forwards" },
  );
  text.animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 360, delay: 200, easing: "ease-out", fill: "both" });
  cover.finished.then(go, go);
  window.setTimeout(go, 760);
}
