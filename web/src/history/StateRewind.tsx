import { useEffect, useMemo, useState } from "react";
import D from "../map/globe-data.json";
import { dataUrl } from "../data/load";
import { STATE_NAME } from "../data/states";
import { Missing } from "../ui/Missing";
import { SourceChip } from "../ui/SourceChip";

/**
 * F34, opción 6: condados sin mapa del CDL. El estado entero se "rebobina" con la línea de tiempo,
 * cada condado pintado por su rinde de ese año (USDA NASS), con el condado elegido resaltado entre sus
 * vecinos. Escala fija del estado para los 11 años (p5–p95), así un año malo se ve como un año malo.
 * Datos: data/state/<ST>.json (scripts/build_state_yield.py). Sin rinde publicado → rayado "Missing data".
 */

type Crop = "corn" | "soy";
interface StateYield {
  state: string;
  years: number[];
  source: string;
  scale: Record<Crop, [number, number] | null>;
  median: Record<Crop, (number | null)[]>;
  counties: Record<string, Record<Crop, (number | null)[]>>;
}
interface Shape {
  id: string;
  name: string;
  d: string;
  cx: number;
  cy: number;
}

const CROPS: { id: Crop; label: string }[] = [
  { id: "corn", label: "Corn" },
  { id: "soy", label: "Soybeans" },
];
// Verde de claro a oscuro: más rinde, más oscuro. Se lee sobre el fondo claro de la historia.
const STOPS = ["#efe7cc", "#c4dfa6", "#7fbf7a", "#3f8f5a", "#1f5b3a"];
const W = 560;

const cache = new Map<string, Promise<StateYield>>();
function loadState(postal: string) {
  let p = cache.get(postal);
  if (!p) {
    p = fetch(dataUrl(`data/state/${postal}.json`)).then((r) => {
      if (!r.ok) throw new Error(`No state file for ${postal}`);
      return r.json() as Promise<StateYield>;
    });
    p.catch(() => cache.delete(postal));
    cache.set(postal, p);
  }
  return p;
}

function hex(c: string) {
  return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
}
function colorFor(v: number, [lo, hi]: [number, number]) {
  const t = Math.max(0, Math.min(1, (v - lo) / Math.max(1, hi - lo))) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(t));
  const a = hex(STOPS[i]);
  const b = hex(STOPS[i + 1]);
  const f = t - i;
  return `rgb(${a.map((x, k) => Math.round(x + (b[k] - x) * f)).join(",")})`;
}

type Geo = { type: string; coordinates: number[][][] | number[][][][] };
const COUNTIES = (D as unknown as { counties: { id: string; name: string; state: string; geometry: Geo }[] }).counties;

/** Polígonos del estado en una proyección plana (equirectangular corregida por la latitud media). */
function shapesFor(stateFips: string): { shapes: Shape[]; h: number } {
  const list = COUNTIES.filter((c) => c.state === stateFips);
  const rings = (g: Geo) => (g.type === "Polygon" ? (g.coordinates as number[][][]) : (g.coordinates as number[][][][]).flat());
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const c of list)
    for (const r of rings(c.geometry))
      for (const [lon, lat] of r) {
        x0 = Math.min(x0, lon); x1 = Math.max(x1, lon); y0 = Math.min(y0, lat); y1 = Math.max(y1, lat);
      }
  const k = Math.cos((((y0 + y1) / 2) * Math.PI) / 180);
  const s = (W - 4) / ((x1 - x0) * k);
  const h = Math.round((y1 - y0) * s + 4);
  const px = (lon: number) => 2 + (lon - x0) * k * s;
  const py = (lat: number) => 2 + (y1 - lat) * s;
  const shapes = list.map((c) => {
    let cx = 0, cy = 0, n = 0;
    const d = rings(c.geometry)
      .map((r) =>
        r.map(([lon, lat], i) => {
          const X = px(lon), Y = py(lat);
          cx += X; cy += Y; n++;
          return `${i ? "L" : "M"}${X.toFixed(1)} ${Y.toFixed(1)}`;
        }).join("") + "Z",
      )
      .join("");
    return { id: c.id, name: c.name, d, cx: cx / n, cy: cy / n };
  });
  return { shapes, h };
}

export function StateRewind({
  fips,
  name,
  postal,
  year,
}: {
  fips: string;
  name: string;
  postal: string;
  year: number;
}) {
  const [data, setData] = useState<StateYield | null>(null);
  const [failed, setFailed] = useState(false);
  const [crop, setCrop] = useState<Crop>("corn");
  const [hover, setHover] = useState<string | null>(null);
  const geo = useMemo(() => shapesFor(fips.slice(0, 2)), [fips]);

  useEffect(() => {
    let off = false;
    setFailed(false);
    loadState(postal)
      .then((d) => {
        if (off) return;
        setData(d);
        // Si el condado no tiene maíz publicado en ningún año, arranca en soja.
        const mine = d.counties[fips];
        if (mine && !mine.corn.some((v) => v !== null) && mine.soy.some((v) => v !== null)) setCrop("soy");
      })
      .catch(() => !off && setFailed(true));
    return () => {
      off = true;
    };
  }, [postal, fips]);

  const stateName = STATE_NAME[postal] ?? postal;
  if (failed) return <Missing what={`county yields for ${stateName}`} />;
  if (!data) return <div className="sr sr--loading" role="status">Loading {stateName}…</div>;

  const yi = data.years.indexOf(year);
  const scale = data.scale[crop];
  const val = (id: string) => (yi < 0 ? null : data.counties[id]?.[crop][yi] ?? null);
  const mine = val(fips);
  const median = yi < 0 ? null : data.median[crop][yi];
  const withData = Object.keys(data.counties).filter((id) => val(id) !== null);
  const rank = mine === null ? null : 1 + withData.filter((id) => (val(id) as number) > mine).length;
  const me = geo.shapes.find((s) => s.id === fips);
  const hv = hover ? geo.shapes.find((s) => s.id === hover) : null;
  const cropLabel = CROPS.find((c) => c.id === crop)!.label;

  return (
    <section className="sr" aria-labelledby="sr-title">
      <div className="sr__info">
      <header className="sr__head">
        <h2 id="sr-title" className="sr__title">
          {stateName} in {year}
        </h2>
        <div className="sr__toggle" role="group" aria-label="Crop">
          {CROPS.map((c) => (
            <button key={c.id} type="button" aria-pressed={crop === c.id} onClick={() => setCrop(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
      </header>
      <p className="sr__lede">
        {mine !== null && rank !== null ? (
          <>
            <b>{name}</b>: {cropLabel.toLowerCase()} {mine} bu/acre, {rank} of {withData.length} {stateName} counties
            {median !== null ? <> · state median {median}</> : null}.
          </>
        ) : (
          <>
            <b>{name}</b>: no published {cropLabel.toLowerCase()} yield in {year}
            {median !== null ? <> · state median {median} bu/acre</> : null}.
          </>
        )}
      </p>
      <div className="sr__legend" aria-hidden="true">
        {scale ? (
          <span className="sr__ramp">
            <span>≤{scale[0]}</span>
            <i style={{ background: `linear-gradient(90deg, ${STOPS.join(",")})` }} />
            <span>≥{scale[1]} bu/acre</span>
          </span>
        ) : null}
        <span><i className="sr__nodata" /> No published yield</span>
        <span><i className="sr__mine" /> {name} County</span>
      </div>
      <p className="sr__note">
        One color scale for all 11 years, so a bad year looks bad. Point at a county to see its yield.{" "}
        <SourceChip source={data.source} />
      </p>
      </div>
      <div className="sr__map">
        <svg
          viewBox={`0 0 ${W} ${geo.h}`}
          role="img"
          aria-label={`Map of ${stateName} counties colored by ${cropLabel.toLowerCase()} yield in ${year}, with ${name} County outlined.`}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <pattern id="sr-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="#eef0eb" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="#c9cec5" strokeWidth="2" />
            </pattern>
          </defs>
          {geo.shapes.map((s) => {
            const v = val(s.id);
            return (
              <path
                key={s.id}
                d={s.d}
                className="sr__county"
                style={{ fill: v !== null && scale ? colorFor(v, scale) : "url(#sr-hatch)" }}
                onMouseEnter={() => setHover(s.id)}
              />
            );
          })}
          {me ? <path d={me.d} className="sr__me-halo" /> : null}
          {me ? <path d={me.d} className="sr__me" /> : null}
          {hv && hv.id !== fips ? <path d={hv.d} className="sr__hover" /> : null}
        </svg>
        {hv ? (
          <p
            className="sr__tip"
            style={{ left: `${(100 * hv.cx) / W}%`, top: `${(100 * hv.cy) / geo.h}%` }}
            aria-hidden="true"
          >
            <b>{hv.name}</b> {val(hv.id) !== null ? `${val(hv.id)} bu/acre` : "Missing data"}
          </p>
        ) : null}
      </div>
    </section>
  );
}
