/**
 * EPSG:5070 (NAD83 / Conus Albers, el CRS del CDL) → longitud y latitud. Fórmulas de Snyder (1987, "Map
 * Projections: A Working Manual", p. 101-102) sobre el elipsoide GRS80. Sirve para ubicar el ráster del CDL sobre
 * el globo: con la esquina del ráster y el tamaño del píxel (30 m) salen sus cuatro esquinas en grados.
 */
const A = 6378137;
const F = 1 / 298.257222101;
const E2 = 2 * F - F * F;
const E = Math.sqrt(E2);
const RAD = Math.PI / 180;
const LAT0 = 23 * RAD;
const LAT1 = 29.5 * RAD;
const LAT2 = 45.5 * RAD;
const LON0 = -96 * RAD;

const m = (phi: number) => Math.cos(phi) / Math.sqrt(1 - E2 * Math.sin(phi) ** 2);
const q = (phi: number) => {
  const s = Math.sin(phi);
  return (1 - E2) * (s / (1 - E2 * s * s) - (1 / (2 * E)) * Math.log((1 - E * s) / (1 + E * s)));
};
const N = (m(LAT1) ** 2 - m(LAT2) ** 2) / (q(LAT2) - q(LAT1));
const C = m(LAT1) ** 2 + N * q(LAT1);
const RHO0 = (A * Math.sqrt(C - N * q(LAT0))) / N;

/** [x, y] en metros (EPSG:5070) → [lon, lat] en grados. */
export function albersToLonLat(x: number, y: number): [number, number] {
  const rho = Math.hypot(x, RHO0 - y);
  const theta = Math.atan2(x, RHO0 - y);
  const qq = (C - (rho * rho * N * N) / (A * A)) / N;
  let phi = Math.asin(qq / 2);
  for (let i = 0; i < 8; i++) {
    const s = Math.sin(phi);
    const d = 1 - E2 * s * s;
    const step =
      ((d * d) / (2 * Math.cos(phi))) *
      (qq / (1 - E2) - s / d + (1 / (2 * E)) * Math.log((1 - E * s) / (1 + E * s)));
    phi += step;
    if (Math.abs(step) < 1e-12) break;
  }
  return [(LON0 + theta / N) / RAD, phi / RAD];
}
