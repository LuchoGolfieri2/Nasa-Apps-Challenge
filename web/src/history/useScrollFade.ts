import { useCallback, useRef } from "react";

/**
 * Ref para una columna con scroll propio. Hace dos cosas:
 *  1. Marca en `data-fade` (none | top | bottom | both) si hay más contenido arriba o abajo; el CSS difumina ese borde.
 *  2. Dibuja una barra de desplazamiento propia (riel + píldora), porque la barra nativa no se puede estilizar igual
 *     en todos los navegadores (Firefox solo deja elegir fina o normal). La nativa queda oculta en history.css.
 *     La píldora se arrastra, y un clic en el riel mueve de a una página.
 * La barra se pone en `offsetParent` (la columna tiene que estar dentro de algo con position distinto de static).
 */
export function useScrollFade() {
  const cleanup = useRef<() => void>();
  return useCallback((el: HTMLElement | null) => {
    cleanup.current?.();
    cleanup.current = undefined;
    if (!el) return;

    const host = (el.offsetParent as HTMLElement | null) ?? el.parentElement;
    const rail = document.createElement("div");
    rail.className = "sbar";
    rail.setAttribute("aria-hidden", "true");
    const thumb = document.createElement("div");
    thumb.className = "sbar__thumb";
    rail.appendChild(thumb);
    host?.appendChild(rail);

    const PAD = 8;
    const geometry = () => {
      const trackH = Math.max(0, el.clientHeight - PAD * 2);
      const max = el.scrollHeight - el.clientHeight;
      const thumbH = Math.min(trackH, Math.max(44, (el.clientHeight / el.scrollHeight) * trackH));
      const free = trackH - thumbH;
      return { trackH, max, thumbH, free };
    };

    const update = () => {
      const up = el.scrollTop > 2;
      const down = el.scrollHeight - el.clientHeight - el.scrollTop > 2;
      el.dataset.fade = up && down ? "both" : up ? "top" : down ? "bottom" : "none";

      const { trackH, max, thumbH, free } = geometry();
      const visible = max > 2 && trackH > 0;
      rail.style.display = visible ? "block" : "none";
      if (!visible) return;
      rail.style.top = `${el.offsetTop + PAD}px`;
      rail.style.left = `${el.offsetLeft + el.offsetWidth - 10}px`;
      rail.style.height = `${trackH}px`;
      thumb.style.height = `${thumbH}px`;
      thumb.style.transform = `translateY(${max > 0 ? (el.scrollTop / max) * free : 0}px)`;
    };

    // arrastrar la píldora
    let drag: { y: number; top: number } | null = null;
    const down = (e: PointerEvent) => {
      e.preventDefault();
      thumb.setPointerCapture(e.pointerId);
      drag = { y: e.clientY, top: el.scrollTop };
      rail.classList.add("sbar--drag");
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      const { max, free } = geometry();
      if (free > 0) el.scrollTop = drag.top + ((e.clientY - drag.y) / free) * max;
    };
    const up = () => {
      drag = null;
      rail.classList.remove("sbar--drag");
    };
    // clic en el riel: una página arriba o abajo
    const page = (e: MouseEvent) => {
      if (e.target !== rail) return;
      const r = thumb.getBoundingClientRect();
      el.scrollBy({ top: (e.clientY < r.top ? -1 : 1) * el.clientHeight * 0.85, behavior: "smooth" });
    };
    thumb.addEventListener("pointerdown", down);
    thumb.addEventListener("pointermove", move);
    thumb.addEventListener("pointerup", up);
    thumb.addEventListener("pointercancel", up);
    rail.addEventListener("click", page);

    update();
    el.addEventListener("scroll", update, { passive: true });
    // El contenido cambia de alto sin que cambie el alto de la columna (un bloque que se abre, una fuente que carga):
    // se observan la columna y cada uno de sus hijos, y los cambios de atributos (hidden, class, style).
    const ro = new ResizeObserver(update);
    const watchChildren = () => {
      ro.disconnect();
      ro.observe(el);
      for (const c of Array.from(el.children)) ro.observe(c);
    };
    watchChildren();
    const mo = new MutationObserver((records) => {
      if (records.some((r) => r.type === "childList" && r.target === el)) watchChildren();
      update();
    });
    mo.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "class", "style"] });
    window.addEventListener("resize", update);

    cleanup.current = () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      ro.disconnect();
      mo.disconnect();
      rail.remove();
    };
  }, []);
}
