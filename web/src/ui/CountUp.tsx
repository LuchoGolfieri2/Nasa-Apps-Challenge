import { useEffect, useRef, useState } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Número que cuenta hasta su valor. La primera vez parte de 0; si el valor cambia (otro año, otra opción),
 * cuenta desde el que se veía. Con movimiento reducido muestra el valor final directo.
 * El texto final siempre es el valor exacto (`format`), nunca un valor intermedio redondeado distinto.
 */
export function CountUp({
  value,
  format = (v: number) => Math.round(v).toString(),
  ms = 650,
}: {
  value: number;
  format?: (v: number) => string;
  ms?: number;
}) {
  const [shown, setShown] = useState(reduced() ? value : 0);
  const from = useRef(reduced() ? value : 0);
  useEffect(() => {
    if (reduced()) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const v = a + (value - a) * e;
      from.current = v;
      setShown(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return <>{format(shown)}</>;
}
