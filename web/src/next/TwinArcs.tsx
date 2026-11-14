/**
 * F24 — Mapa chico con arcos del condado hacia sus condados gemelos.
 * Componente aislado: recibe el condado, los gemelos y cuáles resaltar.
 * Los arcos se dibujan `delayMs` después de montarse o de cambiar `animateKey`
 * (por defecto 1 s después de la frase sugerida).
 */
import React from 'react';
import {STATE_PATHS, projectTwinMap} from './twinMapShapes';
import type {Twin} from './types';

export interface TwinArcsProps {
  origin: {name: string; centroid: [number, number]};
  twins: Twin[];
  /** fips de los gemelos que respaldan la opción activa; el resto queda atenuado */
  highlight: string[];
  /** al cambiar, los arcos se vuelven a dibujar */
  animateKey: string;
  delayMs?: number;
  selected?: string | null;
  onSelect?: (fips: string | null) => void;
}

export const TwinArcs: React.FC<TwinArcsProps> = ({origin, twins, highlight, animateKey, delayMs = 1000, selected, onSelect}) => {
  const [ox, oy] = projectTwinMap(origin.centroid[0], origin.centroid[1]);
  return (
    <svg className="fr-twinmap" viewBox="0 0 420 250" role="img" aria-label={`Map of counties similar to ${origin.name}`}>
      {Object.entries(STATE_PATHS).map(([name, d]) => (
        <path key={name} d={d} className="fr-twinmap-state" />
      ))}
      <g key={animateKey}>
        {twins.map((tw, i) => {
          const on = highlight.includes(tw.fips);
          const [x, y] = projectTwinMap(tw.centroid[0], tw.centroid[1]);
          const dist = Math.hypot(x - ox, y - oy);
          // arco levantado: punto de control por encima de la línea recta
          const cx = (ox + x) / 2;
          const cy = (oy + y) / 2 - Math.max(18, dist * 0.32);
          const isSel = selected === tw.fips;
          return (
            <g key={tw.fips} className={`fr-twin ${on ? 'on' : 'off'} ${isSel ? 'sel' : ''}`}>
              <path
                className="fr-twin-arc"
                d={`M${ox.toFixed(1)},${oy.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)}`}
                pathLength={1}
                style={{animationDelay: `${delayMs + i * 120}ms`}}
              />
              <circle
                className="fr-twin-dot"
                cx={x}
                cy={y}
                r={isSel ? 7 : 5}
                style={{animationDelay: `${delayMs + 350 + i * 120}ms`}}
                tabIndex={0}
                role="button"
                aria-label={`${tw.name} County, ${tw.state}`}
                onClick={() => onSelect?.(isSel ? null : tw.fips)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect?.(isSel ? null : tw.fips)}
              />
              <text className="fr-twin-label" x={x + (x > 330 || x < ox ? -9 : 9)} y={y + 4} textAnchor={x > 330 || x < ox ? 'end' : 'start'} style={{animationDelay: `${delayMs + 350 + i * 120}ms`}}>
                {tw.name}
              </text>
            </g>
          );
        })}
      </g>
      <circle className="fr-twin-origin-ring" cx={ox} cy={oy} r={11} />
      <circle className="fr-twin-origin" cx={ox} cy={oy} r={6} />
      <text className="fr-twin-origin-label" x={ox + 14} y={oy + 5} textAnchor="start">
        {origin.name}
      </text>
    </svg>
  );
};
