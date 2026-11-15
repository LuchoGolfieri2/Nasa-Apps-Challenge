import type { CSSProperties } from "react";
import ICON_CORN from "./icons/crops/corn.svg?raw";
import ICON_SOY from "./icons/crops/soy.svg?raw";
import ICON_WHEAT from "./icons/crops/wheat.svg?raw";
import ICON_OATS from "./icons/crops/oats.svg?raw";
import ICON_ALFALFA from "./icons/crops/alfalfa.svg?raw";
import { CROP_COLOR, type DisplayCrop } from "./crops";

const SVG: Partial<Record<DisplayCrop, string>> = {
  corn: ICON_CORN,
  soy: ICON_SOY,
  wheat: ICON_WHEAT,
  oats: ICON_OATS,
  alfalfa: ICON_ALFALFA,
};

/** El color del cultivo, oscurecido para que el trazo se lea sobre fondo claro (contraste AA con texto grande). */
export const CROP_INK: Record<DisplayCrop, string> = {
  corn: "#8a5a00",
  soy: "#0f7a56",
  wheat: "#a31d4b",
  sorghum: "#5a37c4",
  double_wheat_soy: "#1f6fb5",
  alfalfa: "#5d6e44",
  fallow: "#6b4a2f",
  other: "#5c5f55",
  oats: "#b8430a",
};

/**
 * Ícono de un cultivo (los SVG de ui/icons/crops). Los cultivos sin ícono (sorgo, barbecho, otros…) llevan el
 * punto de color de siempre. Es decorativo: el nombre del cultivo siempre va escrito al lado.
 * `onDark`: sobre fondo oscuro usa el color del cultivo; sobre claro, su versión oscura.
 */
export function CropIcon({ crop, size = 20, onDark = false, className }: { crop: DisplayCrop; size?: number; onDark?: boolean; className?: string }) {
  const svg = SVG[crop];
  const color = onDark ? CROP_COLOR[crop] : CROP_INK[crop];
  if (!svg) {
    return <i className={`ns-dot ${className ?? ""}`} style={{ background: CROP_COLOR[crop] }} aria-hidden="true" />;
  }
  const style: CSSProperties = { width: size, height: size, color };
  return (
    <span
      className={`crop-ico ${className ?? ""}`}
      style={style}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svg.replace("<svg ", '<svg width="100%" height="100%" ') }}
    />
  );
}
