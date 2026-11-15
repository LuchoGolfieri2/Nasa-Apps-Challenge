/**
 * Ilustraciones de cultivos hechas en código (sin fotos de terceros): un lote en perspectiva con su cultivo,
 * el cielo y, si se pide, la casa y el árbol del campo. Estilo de las referencias en docs/referencias-diseno/.
 */
import { useId, type ReactNode } from "react";
import type { FarmCrop } from "./farm";

const W = 320;
const H = 200;
const HORIZON = 92;
const VX = 168;

interface Palette {
  sky: [string, string];
  soil: string;
  row: string;
  hill: [string, string];
}

const PAL: Record<FarmCrop, Palette> = {
  corn: {
    sky: ["#cfe7f2", "#f6f1e4"],
    soil: "#6b4a2f",
    row: "#3d7a3a",
    hill: ["#9cc98a", "#7bb36b"],
  },
  soy: {
    sky: ["#d7ecf0", "#f3f4e6"],
    soil: "#5d4129",
    row: "#2f7d4f",
    hill: ["#a6cf8f", "#86bb72"],
  },
  wheat: {
    sky: ["#f6dcae", "#f8f0dc"],
    soil: "#8a6a3b",
    row: "#d9a640",
    hill: ["#d6c27a", "#c4ac5c"],
  },
  oats: {
    sky: ["#dde9ee", "#f6f1e4"],
    soil: "#7d6340",
    row: "#c9b46a",
    hill: ["#bccf88", "#a5bd73"],
  },
  alfalfa: {
    sky: ["#d8e6f4", "#f1f1ea"],
    soil: "#5a4630",
    row: "#4f9a4a",
    hill: ["#9fcf8c", "#82bb70"],
  },
  hay: {
    sky: ["#f2d9b8", "#f7efdf"],
    soil: "#9b7b45",
    row: "#c8a55a",
    hill: ["#cdbb7d", "#b8a463"],
  },
  other: {
    sky: ["#dbe9ea", "#f4f2e8"],
    soil: "#6b4a2f",
    row: "#5f8f55",
    hill: ["#a8c994", "#8db67b"],
  },
};

/** Una planta en (x, y) con escala s (y es la base) */
function plant(
  crop: FarmCrop,
  x: number,
  y: number,
  s: number,
  k: string,
): ReactNode {
  switch (crop) {
    case "corn": {
      const h = 46 * s;
      return (
        <g key={k}>
          <path
            d={`M${x} ${y} L${x} ${y - h}`}
            stroke="#3f7d34"
            strokeWidth={2.2 * s}
            strokeLinecap="round"
          />
          <path
            d={`M${x} ${y - h * 0.45} q${-14 * s} ${-4 * s} ${-18 * s} ${8 * s}`}
            stroke="#4f9443"
            strokeWidth={2.4 * s}
            fill="none"
            strokeLinecap="round"
          />
          <path
            d={`M${x} ${y - h * 0.65} q${14 * s} ${-6 * s} ${19 * s} ${6 * s}`}
            stroke="#4f9443"
            strokeWidth={2.4 * s}
            fill="none"
            strokeLinecap="round"
          />
          <path
            d={`M${x} ${y - h * 0.25} q${12 * s} ${-2 * s} ${16 * s} ${9 * s}`}
            stroke="#5aa04c"
            strokeWidth={2.2 * s}
            fill="none"
            strokeLinecap="round"
          />
          <ellipse
            cx={x + 3.2 * s}
            cy={y - h * 0.55}
            rx={2.6 * s}
            ry={6.5 * s}
            fill="#f0c33c"
            stroke="#c99a1e"
            strokeWidth={0.6 * s}
          />
          <path
            d={`M${x} ${y - h} l${-3 * s} ${-6 * s} M${x} ${y - h} l${3 * s} ${-6 * s} M${x} ${y - h} l0 ${-7 * s}`}
            stroke="#d8b35a"
            strokeWidth={1.2 * s}
            strokeLinecap="round"
          />
        </g>
      );
    }
    case "soy": {
      const r = 7 * s;
      return (
        <g key={k}>
          <circle cx={x - r * 0.9} cy={y - r * 0.9} r={r} fill="#2f8a52" />
          <circle cx={x + r * 0.9} cy={y - r * 0.9} r={r} fill="#2a7d49" />
          <circle cx={x} cy={y - r * 1.7} r={r * 1.05} fill="#39995c" />
          <ellipse
            cx={x + r * 0.3}
            cy={y - r * 0.6}
            rx={r * 0.25}
            ry={r * 0.6}
            fill="#a8c46a"
            transform={`rotate(20 ${x + r * 0.3} ${y - r * 0.6})`}
          />
        </g>
      );
    }
    case "wheat":
    case "oats": {
      const h = 30 * s;
      const head = crop === "wheat" ? "#e2b04a" : "#d9cf8f";
      return (
        <g key={k}>
          {[-3, 0, 3].map((dx, i) => (
            <g key={i}>
              <path
                d={`M${x + dx * s} ${y} Q${x + dx * s * 1.4} ${y - h * 0.6} ${x + dx * s * 2} ${y - h}`}
                stroke={crop === "wheat" ? "#c99a3a" : "#b9b06c"}
                strokeWidth={1.2 * s}
                fill="none"
              />
              {crop === "wheat" ? (
                <ellipse
                  cx={x + dx * s * 2}
                  cy={y - h - 4 * s}
                  rx={2.2 * s}
                  ry={5.5 * s}
                  fill={head}
                />
              ) : (
                <path
                  d={`M${x + dx * s * 2} ${y - h} q${4 * s} ${2 * s} ${5 * s} ${7 * s} M${x + dx * s * 2} ${y - h} q${-4 * s} ${2 * s} ${-5 * s} ${7 * s}`}
                  stroke={head}
                  strokeWidth={2 * s}
                  fill="none"
                  strokeLinecap="round"
                />
              )}
            </g>
          ))}
        </g>
      );
    }
    case "alfalfa": {
      const r = 5 * s;
      return (
        <g key={k}>
          <circle cx={x - r} cy={y - r} r={r} fill="#4c9b48" />
          <circle cx={x + r} cy={y - r} r={r} fill="#45903f" />
          <circle cx={x} cy={y - r * 1.8} r={r} fill="#56a851" />
          <circle
            cx={x - r * 0.4}
            cy={y - r * 2.6}
            r={r * 0.5}
            fill="#8b6cc7"
          />
          <circle
            cx={x + r * 0.7}
            cy={y - r * 2.2}
            r={r * 0.45}
            fill="#a083d8"
          />
        </g>
      );
    }
    case "hay":
      return (
        <g key={k}>
          <path
            d={`M${x - 6 * s} ${y} l${2 * s} ${-6 * s} M${x} ${y} l0 ${-7 * s} M${x + 6 * s} ${y} l${-2 * s} ${-6 * s}`}
            stroke="#b89548"
            strokeWidth={1.1 * s}
          />
        </g>
      );
    default:
      return (
        <ellipse
          key={k}
          cx={x}
          cy={y - 5 * s}
          rx={9 * s}
          ry={6 * s}
          fill="#5f9a55"
        />
      );
  }
}

export interface CropArtProps {
  crop: FarmCrop;
  /** casa, árbol y sol: para la tarjeta principal */
  scene?: boolean;
  className?: string;
  label?: string;
}

export function CropArt({
  crop,
  scene = false,
  className,
  label,
}: CropArtProps) {
  const id = useId().replace(/:/g, "");
  const p = PAL[crop];
  const rows = crop === "hay" ? 7 : 9;
  const depth = crop === "hay" ? 7 : crop === "corn" ? 9 : 11;
  const plants: ReactNode[] = [];
  for (let k = 0; k <= depth; k++) {
    const t = k / depth;
    const y = HORIZON + 6 + (H - HORIZON + 30) * Math.pow(t, 1.7);
    if (y > H + 40) continue;
    const s = 0.18 + (y - HORIZON) / 70;
    for (let i = -rows; i <= rows; i++) {
      const x = VX + i * 34 * ((y - HORIZON) / 108) * 1.2;
      if (x < -30 || x > W + 30) continue;
      plants.push(plant(crop, x, y, s, `${k}-${i}`));
    }
  }
  // fardos redondos sobre el rastrojo
  const bales =
    crop === "hay"
      ? [
          [90, 150, 1.4],
          [210, 128, 1.0],
          [262, 172, 1.7],
          [150, 112, 0.7],
        ]
      : [];

  return (
    <svg
      className={className}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <linearGradient id={`sky${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.sky[0]} />
          <stop offset="1" stopColor={p.sky[1]} />
        </linearGradient>
        <linearGradient id={`soil${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.row} stopOpacity="0.75" />
          <stop offset="1" stopColor={p.soil} />
        </linearGradient>
        <linearGradient id={`shade${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.55" stopColor="#0f2a1d" stopOpacity="0" />
          <stop offset="1" stopColor="#0f2a1d" stopOpacity="0.28" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#sky${id})`} />
      {scene ? (
        <circle cx="262" cy="38" r="17" fill="#f7d77a" opacity="0.9" />
      ) : null}
      <path
        d={`M0 ${HORIZON - 14} C 70 ${HORIZON - 34}, 130 ${HORIZON - 6}, 190 ${HORIZON - 20} S 290 ${HORIZON - 30}, ${W} ${HORIZON - 16} L${W} ${HORIZON + 4} L0 ${HORIZON + 4}Z`}
        fill={p.hill[0]}
      />
      <path
        d={`M0 ${HORIZON - 2} C 90 ${HORIZON - 16}, 170 ${HORIZON + 2}, ${W} ${HORIZON - 8} L${W} ${HORIZON + 8} L0 ${HORIZON + 8}Z`}
        fill={p.hill[1]}
      />
      {scene ? (
        <g transform={`translate(52 ${HORIZON - 30})`}>
          <rect x="0" y="10" width="26" height="18" fill="#f6f1e4" />
          <path d="M-3 11 L13 0 L29 11Z" fill="#9b3d2a" />
          <rect x="10" y="17" width="6" height="11" fill="#6b4a2f" />
          <circle cx="42" cy="12" r="11" fill="#3f7d34" />
          <rect x="40.5" y="20" width="3" height="9" fill="#6b4a2f" />
        </g>
      ) : null}
      <rect
        x="0"
        y={HORIZON + 4}
        width={W}
        height={H - HORIZON}
        fill={`url(#soil${id})`}
      />
      {/* surcos que convergen en el horizonte */}
      {Array.from({ length: rows * 2 + 1 }, (_, n) => n - rows).map((i) => (
        <path
          key={i}
          d={`M${VX + i * 3} ${HORIZON + 6} L${VX + i * 34 * 1.85} ${H + 40}`}
          stroke={p.soil}
          strokeOpacity="0.35"
          strokeWidth="1"
        />
      ))}
      {plants}
      {bales.map(([x, y, s], n) => (
        <g key={n}>
          <ellipse
            cx={x}
            cy={y}
            rx={14 * s}
            ry={13 * s}
            fill="#d8b866"
            stroke="#a88635"
            strokeWidth={1.2}
          />
          <ellipse
            cx={x - 4 * s}
            cy={y}
            rx={8 * s}
            ry={11 * s}
            fill="none"
            stroke="#b9963f"
            strokeWidth={1}
          />
          <ellipse
            cx={x - 4 * s}
            cy={y}
            rx={4 * s}
            ry={6 * s}
            fill="none"
            stroke="#b9963f"
            strokeWidth={1}
          />
        </g>
      ))}
      <rect width={W} height={H} fill={`url(#shade${id})`} />
    </svg>
  );
}
