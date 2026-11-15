/*
  Íconos del front: una sola librería (Phosphor, peso Regular) más tres cultivos dibujados
  por nosotros con el mismo trazo (16 en una grilla de 256, puntas redondas).
  Todos usan currentColor: el estado (hover, apagado) sale del color y la opacidad del texto.
  Son texto SVG para que sirvan igual en React (Icon.tsx) y en el mapa (globe.js, sin React).
*/
import arrowLeft from "@phosphor-icons/core/assets/regular/arrow-left.svg?raw";
import arrowRight from "@phosphor-icons/core/assets/regular/arrow-right.svg?raw";
import caretRight from "@phosphor-icons/core/assets/regular/caret-right.svg?raw";
import play from "@phosphor-icons/core/assets/regular/play.svg?raw";
import pause from "@phosphor-icons/core/assets/regular/pause.svg?raw";
import rewind from "@phosphor-icons/core/assets/regular/rewind.svg?raw";
import x from "@phosphor-icons/core/assets/regular/x.svg?raw";
import plus from "@phosphor-icons/core/assets/regular/plus.svg?raw";
import minus from "@phosphor-icons/core/assets/regular/minus.svg?raw";
import check from "@phosphor-icons/core/assets/regular/check.svg?raw";
import usersThree from "@phosphor-icons/core/assets/regular/users-three.svg?raw";
import cloudRain from "@phosphor-icons/core/assets/regular/cloud-rain.svg?raw";
import thermometer from "@phosphor-icons/core/assets/regular/thermometer-simple.svg?raw";
import drop from "@phosphor-icons/core/assets/regular/drop.svg?raw";
import leaf from "@phosphor-icons/core/assets/regular/leaf.svg?raw";
import plant from "@phosphor-icons/core/assets/regular/plant.svg?raw";
import chartBar from "@phosphor-icons/core/assets/regular/chart-bar.svg?raw";
import squaresFour from "@phosphor-icons/core/assets/regular/squares-four.svg?raw";
import mapTrifold from "@phosphor-icons/core/assets/regular/map-trifold.svg?raw";
import checkCircle from "@phosphor-icons/core/assets/regular/check-circle.svg?raw";

const own = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="16" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

/** Maíz: la mazorca con sus hileras y dos chalas abiertas abajo. */
const corn = own(
  '<path d="M128 32c-26 0-40 44-40 88s14 72 40 72 40-28 40-72-14-88-40-88Z"/>' +
    '<path d="M128 40v144M96 88h64M90 128h76M96 168h64"/>' +
    '<path d="M100 176c-8 26-28 42-60 48 10-34 30-56 60-64M156 176c8 26 28 42 60 48-10-34-30-56-60-64"/>',
);
/** Soja: la vaina en diagonal con tres granos. */
const soy = own(
  '<rect x="28" y="92" width="200" height="72" rx="36" transform="rotate(-45 128 128)"/>' +
    '<circle cx="86" cy="170" r="16"/><circle cx="128" cy="128" r="16"/><circle cx="170" cy="86" r="16"/>',
);
/** Trigo: la caña con la espiga, granos de a pares. */
const wheat = own(
  '<path d="M128 232V64"/>' +
    '<path d="M128 64c-14-10-14-34 0-44 14 10 14 34 0 44Z"/>' +
    '<path d="M128 112c-30 0-44-16-44-42 30 0 44 16 44 42ZM128 112c30 0 44-16 44-42-30 0-44 16-44 42Z"/>' +
    '<path d="M128 160c-30 0-44-16-44-42 30 0 44 16 44 42ZM128 160c30 0 44-16 44-42-30 0-44 16-44 42Z"/>',
);

export const ICON = {
  arrowLeft, arrowRight, caretRight, play, pause, rewind, x, plus, minus, check,
  twins: usersThree, rain: cloudRain, temperature: thermometer, water: drop, greenness: leaf,
  crop: plant, yield: chartBar, pixels: squaresFour, county: mapTrifold, accuracy: checkCircle,
  corn, soy, wheat,
} as const;
export type IconName = keyof typeof ICON;

/** Ícono propio de cada cultivo; los demás no tienen (queda el color y el nombre). */
export const CROP_ICON: Partial<Record<string, IconName>> = { corn: "corn", soy: "soy", wheat: "wheat" };

/** Para el mapa (HTML sin React): el SVG listo, siempre decorativo. */
export const iconHTML = (name: IconName, size = 18) =>
  `<span class="ico" aria-hidden="true" style="width:${size}px;height:${size}px">${ICON[name]}</span>`;
