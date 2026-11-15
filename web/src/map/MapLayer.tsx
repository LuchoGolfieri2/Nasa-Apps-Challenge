import { useEffect, useRef } from "react";
import { initGlobe, setMapActive } from "./globe.js";
import { MAP_MARKUP } from "./markup";
import "./map.css";

/**
 * Pantalla 1 · Mapa: portada → globo → estado → condado.
 * Queda siempre montada (para no recargar el globo); cuando se ve otra pantalla se oculta.
 * El globo es JS puro (globe.js) y maneja sus propias rutas: #/, #/map, #/state/KS, #/map/20191.
 */
export function MapLayer({ active }: { active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && !ref.current.dataset.ready) {
      ref.current.innerHTML = MAP_MARKUP;
      ref.current.dataset.ready = "1";
      initGlobe();
    }
  }, []);

  useEffect(() => {
    setMapActive(active);
    if (active) window.dispatchEvent(new Event("resize"));
  }, [active]);

  return <div ref={ref} className="maplayer" hidden={!active} />;
}
