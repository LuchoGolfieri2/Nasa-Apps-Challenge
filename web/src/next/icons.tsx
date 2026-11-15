/**
 * Íconos de línea de la pantalla 3 (24 × 24, trazo del color del texto, mismo grosor que los de la historia).
 * Un solo SVG por ícono: el color sale del CSS (currentColor).
 */
import type {ReactNode} from 'react';
import type {Priority} from './types';

export type IconName =
  | 'back'
  | 'shield'
  | 'dollar'
  | 'sprout'
  | 'leaf'
  | 'drop'
  | 'rain'
  | 'thermo'
  | 'layers'
  | 'slope'
  | 'check'
  | 'alert'
  | 'question'
  | 'star'
  | 'pin'
  | 'bars'
  | 'arrow'
  | 'open'
  | 'expand'
  | 'close'
  | 'recenter';

const PATHS: Record<IconName, ReactNode> = {
  back: <path d="M15 5l-7 7 7 7" />,
  // cuatro esquinas hacia afuera: pantalla completa
  expand: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  // mira: volver al encuadre
  recenter: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
    </>
  ),
  // Escudo con tilde: menos riesgo
  shield: (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  dollar: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.8 9c-.5-.8-1.5-1.4-2.8-1.4-1.6 0-2.8.8-2.8 2 0 2.9 5.6 1.6 5.6 4.5 0 1.2-1.2 2.1-2.8 2.1-1.3 0-2.4-.6-3-1.5M12 6v1.6M12 16.4V18" />
    </>
  ),
  // Brote: suelo sano, productividad
  sprout: (
    <>
      <path d="M12 20v-8" />
      <path d="M12 12C12 8.2 9.3 5.6 5.5 5.6c0 3.8 2.7 6.4 6.5 6.4z" />
      <path d="M12 14.5c0-3.4 2.4-5.8 6-5.8 0 3.4-2.4 5.8-6 5.8z" />
      <path d="M6.5 20h11" />
    </>
  ),
  leaf: (
    <>
      <path d="M5 19C5.5 11 11 5 19 5c-.5 8-6 14-14 14z" />
      <path d="M5 19l8-8" />
    </>
  ),
  drop: (
    <>
      <path d="M12 3.5c3 4 6 7.3 6 10.5a6 6 0 0 1-12 0c0-3.2 3-6.5 6-10.5z" />
      <path d="M9.5 14.5a2.6 2.6 0 0 0 2.5 2.5" />
    </>
  ),
  rain: (
    <>
      <path d="M7.5 14.5a3.8 3.8 0 0 1-.4-7.6 5.3 5.3 0 0 1 10.2 1 3.3 3.3 0 0 1-.3 6.6z" />
      <path d="M9 18l-1 2.5M13 18l-1 2.5M17 18l-1 2.5" />
    </>
  ),
  thermo: (
    <>
      <path d="M14 14.6V5a2 2 0 0 0-4 0v9.6a4 4 0 1 0 4 0z" />
      <path d="M12 9.5v7" />
    </>
  ),
  // Capas de suelo: drenaje
  layers: (
    <>
      <path d="M3 8l9-4 9 4-9 4z" />
      <path d="M3 12l9 4 9-4" />
      <path d="M3 16l9 4 9-4" />
    </>
  ),
  slope: (
    <>
      <path d="M3 19L21 7v12z" />
      <path d="M7 19v-2.5" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.7 2.7L16 9.6" />
    </>
  ),
  alert: (
    <>
      <path d="M10.3 4.2L2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z" />
      <path d="M12 9.5v4" />
      <path d="M12 17h.01" />
    </>
  ),
  question: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.8" />
      <path d="M12 17h.01" />
    </>
  ),
  star: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" />,
  pin: (
    <>
      <path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z" />
      <circle cx="12" cy="10" r="2.2" />
    </>
  ),
  bars: (
    <>
      <path d="M4 20h16" />
      <path d="M7 16v-5M12 16V6.5M17 16V9" />
    </>
  ),
  // Flecha hacia arriba: diferencia contra lo habitual
  arrow: (
    <>
      <path d="M4 17l5.5-5.5 3.5 3.5L20 8" />
      <path d="M15 8h5v5" />
    </>
  ),
  open: (
    <>
      <path d="M7 17L17 7" />
      <path d="M9 7h8v8" />
    </>
  ),
};

export function Icon({name, size = 20, className}: {name: IconName; size?: number; className?: string}) {
  return (
    <svg
      className={`ns-icon${className ? ` ${className}` : ''}`}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

export const PRIORITY_ICON: Record<Priority, IconName> = {risk: 'shield', income: 'dollar', soil: 'sprout', water: 'drop'};

/** Ícono de cada motivo por el que un condado se parece al tuyo (los "similar_on" del JSON). */
export function similarIcon(what: string): IconName {
  const w = what.toLowerCase();
  if (w.includes('drainage')) return 'layers';
  if (w.includes('heat')) return 'thermo';
  if (w.includes('rain')) return 'rain';
  if (w.includes('water')) return 'drop';
  if (w.includes('slope')) return 'slope';
  if (w.includes('carbon')) return 'leaf';
  if (w.includes('productivity')) return 'sprout';
  return 'pin';
}
