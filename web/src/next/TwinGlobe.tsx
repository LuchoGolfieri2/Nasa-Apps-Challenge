/**
 * F24 — "Counties like yours" sobre el globo: el condado, sus condados parecidos y un arco hacia cada uno.
 * Envuelve twinGlobe.js (deck.gl). Sin WebGL cae al mapa plano con arcos (TwinArcs), que muestra lo mismo.
 */
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {TwinArcs} from './TwinArcs';
import {createTwinGlobe, hasWebGL} from './twinGlobe.js';
import type {TwinGlobeHandle} from './twinGlobe.js';
import type {Twin} from './types';

export interface TwinGlobeProps {
  origin: {fips: string; name: string; centroid: [number, number]};
  /** todos los condados parecidos del condado (el mapa plano atenúa los que no son de la opción) */
  allTwins: Twin[];
  /** los de la opción elegida: son los que se dibujan en el globo */
  twins: Twin[];
  /** al cambiar (otra opción), el globo vuelve a encuadrar */
  viewKey: string;
  selected: string | null;
  onSelect: (fips: string | null) => void;
}

export const TwinGlobe: React.FC<TwinGlobeProps> = ({origin, allTwins, twins, viewKey, selected, onSelect}) => {
  const gl = useMemo(hasWebGL, []);
  const box = useRef<HTMLDivElement>(null);
  const globe = useRef<TwinGlobeHandle | null>(null);
  const labels = useRef<HTMLDivElement>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  // Nombres sobre el globo: el condado y sus parecidos. Se reubican en cada cuadro, sin pasar por React.
  // Los parecidos suelen estar juntos: cada nombre se abre hacia afuera del grupo (oeste/este, norte/sur) para no pisarse.
  const points = useMemo(() => {
    const lon = twins.reduce((a, t) => a + t.centroid[0], 0) / (twins.length || 1);
    const lat = twins.reduce((a, t) => a + t.centroid[1], 0) / (twins.length || 1);
    return [
      {fips: origin.fips, name: `${origin.name} County`, centroid: origin.centroid, side: 'me'},
      ...twins.map((t) => ({fips: t.fips, name: t.name, centroid: t.centroid, side: `${t.centroid[0] < lon ? 'w' : 'e'} ${t.centroid[1] < lat ? 's' : 'n'}`})),
    ];
  }, [origin, twins]);
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!gl || !box.current) return;
    const g = createTwinGlobe(box.current, {
      onSelect: (f) => select.current(f),
      onFrame: (project) => {
        const host = labels.current;
        if (!host) return;
        pointsRef.current.forEach((p, i) => {
          const el = host.children[i] as HTMLElement | undefined;
          if (!el) return;
          const xy = project(p.centroid);
          el.style.display = xy ? '' : 'none';
          if (xy) el.style.transform = `translate(${xy[0].toFixed(1)}px, ${xy[1].toFixed(1)}px)`;
        });
        setReady(true);
      },
    });
    globe.current = g;
    return () => {
      globe.current = null;
      g.destroy();
    };
  }, [gl]);

  useEffect(() => {
    globe.current?.update({origin: {fips: origin.fips, centroid: origin.centroid}, twins: twins.map((t) => ({fips: t.fips, centroid: t.centroid}))}, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey, origin.fips, gl]);

  useEffect(() => {
    globe.current?.update({selected});
  }, [selected]);

  if (!gl) {
    return (
      <div className="ns-stage ns-stage--flat">
        <TwinArcs origin={origin} twins={allTwins} highlight={twins.map((t) => t.fips)} animateKey={viewKey} delayMs={0} selected={selected} onSelect={onSelect} />
      </div>
    );
  }

  return (
    <div className="ns-stage">
      <div ref={box} className="ns-globe" role="img" aria-label={`Globe showing ${origin.name} County and the counties like it: ${twins.map((t) => `${t.name}, ${t.state}`).join('; ')}`} />
      <div ref={labels} className="ns-globe-labels" aria-hidden="true" style={{opacity: ready ? 1 : 0}}>
        {points.map((p) => (
          <span key={p.fips} className={`${p.side} ${p.fips === selected ? 'sel' : ''}`}>
            <em>{p.name}</em>
          </span>
        ))}
      </div>
      <div className="ns-zoom">
        <button type="button" onClick={() => globe.current?.zoom(0.6)} aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={() => globe.current?.zoom(-0.6)} aria-label="Zoom out">
          −
        </button>
      </div>
      <p className="ns-hint">Drag to move the globe. Tap a highlighted county to see what it grows.</p>
    </div>
  );
};
