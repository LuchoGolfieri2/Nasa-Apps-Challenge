/**
 * Pantalla 3 — "Next season" (F21, F22, F24), con datos reales de ML y del CDL.
 *
 * Desde el 15/11 la pantalla no tiene elecciones: muestra la predicción del modelo para la próxima campaña, una sola
 * opción. Para cada clima pasado (2009–2023) el modelo predice maíz y soja en tres rotaciones; gana la que más deja por
 * acre ese año, y la probabilidad es la parte de esos años en que ganó (scripts/build_next_json.py, `prediction`).
 * El cultivo y las prioridades del productor quedan en My Farm.
 *
 * La página se recorre con scroll:
 *   1. Escenario (como "See more" de la historia): el globo con los condados parecidos y, encima en vidrio,
 *      - la mezcla esperada de cultivos (`mix`): qué parte del terreno de maíz y soja va a cada cambio de cultivo,
 *        con su rango (capas 1 y 2: costumbre del condado en el CDL y desvíos de los condados parecidos)
 *      - lo que paga más por acre (`prediction`), con su probabilidad y los 15 climas pasados (cada uno lleva a la
 *        historia en ese año). No es lo que va a sembrar todo el condado.
 *   2. De dónde sale cada parte (mapas del CDL, clima, modelo, precios y costos, gemelos)
 *   3. Las cifras de lo que paga más: rinde típico, diferencia con lo habitual, ingreso y confianza
 *   4. Por qué y qué puede salir mal
 *   5. El detalle de los condados parecidos
 *   6. Lo que todavía no se sabe
 *
 * Uso:  <NextSeason data={json} onYearClick={(y) => navigate(`#/county/${fips}?year=${y}`)} />
 */
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {CropIcon} from '../ui/CropIcon';
import {CountUp} from '../ui/CountUp';
import {Confidence, ModelRuleTag, PrototypeStamp, SourceChip} from './bits';
import {Icon, PRIORITY_ICON, similarIcon} from './icons';
import type {IconName} from './icons';
import {TwinGlobe} from './TwinGlobe';
import type {Frame} from './TwinGlobe';
import {CROP_COLOR, CROP_LABEL, type DisplayCrop} from '../ui/crops';
import type {CropId, CropMix, MixValue, NextData, NextOption, Prediction, Reason, Twin} from './types';
import './next.css';

const CropDot: React.FC<{crop: DisplayCrop; size?: number}> = ({crop, size = 20}) => <CropIcon crop={crop} size={size} />;

/** El globo deja libre la columna de vidrio de la derecha y la fila de gemelos de abajo */
const STAGE_FRAME: Frame = {left: 0.08, right: 0.44, top: 0.2, bottom: 0.2};
/** En pantalla completa el globo usa casi todo el lugar (solo los botones de arriba y los gemelos de abajo) */
const FULL_FRAME: Frame = {left: 0.08, right: 0.08, top: 0.16, bottom: 0.18};

type StagePhase = 'in' | 'opening' | 'open' | 'closing';
type Box = {top: number; left: number; width: number; height: number};
const FULL_MS = 480;
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const boxOf = (el: Element): Box => {
  const r = el.getBoundingClientRect();
  return {top: r.top, left: r.left, width: r.width, height: r.height};
};

/**
 * Globo a pantalla completa con animación (FLIP): el escenario pasa a `position: fixed` en el mismo lugar donde
 * estaba, y en el cuadro siguiente viaja a ocupar toda la ventana. Al cerrar hace el camino inverso hasta el hueco
 * que dejó en la página. Escape cierra, la página no se desplaza mientras está abierto y el foco va y vuelve.
 */
function useFullStage() {
  const stageRef = useRef<HTMLElement>(null);
  const holeRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [phase, setPhase] = useState<StagePhase>('in');
  const [box, setBox] = useState<Box | null>(null);
  const [holeH, setHoleH] = useState(0);
  const [recenter, setRecenter] = useState(0);
  const backFromFull = useRef(false);

  const open = () => {
    const el = stageRef.current;
    if (!el || phase !== 'in') return;
    const b = boxOf(el);
    setHoleH(b.height);
    setBox(b);
    setPhase('opening');
  };
  const close = () => {
    if (phase !== 'open' && phase !== 'opening') return;
    const hole = holeRef.current;
    if (hole) setBox(boxOf(hole));
    setPhase('closing');
  };

  useEffect(() => {
    if (phase === 'opening') {
      // dos cuadros: primero se pinta fijo en su lugar; después viaja a pantalla completa
      let r2 = 0;
      const r1 = requestAnimationFrame(() => {
        r2 = requestAnimationFrame(() => {
          setBox(null);
          setPhase('open');
        });
      });
      return () => {
        cancelAnimationFrame(r1);
        cancelAnimationFrame(r2);
      };
    }
    if (phase === 'open') {
      closeRef.current?.focus({preventScroll: true});
    }
    // el foco vuelve al botón que abrió, ya visible otra vez
    if (phase === 'in' && backFromFull.current) {
      backFromFull.current = false;
      openerRef.current?.focus({preventScroll: true});
    }
    if (phase === 'closing') {
      const t = window.setTimeout(() => {
        setBox(null);
        setPhase('in');
        backFromFull.current = true;
      }, reduceMotion() ? 0 : FULL_MS);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [phase]);

  const active = phase !== 'in';
  useEffect(() => {
    if (!active) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prev;
    };
  }, [active]);

  useEffect(() => {
    if (phase !== 'open') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  return {phase, active, box, holeH, recenter, stageRef, holeRef, openerRef, closeRef, open, close, recenterNow: () => setRecenter((n) => n + 1)};
}


const fmt = (v: number) => Math.round(v).toString();
const usd = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;
const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(Math.round(v))}`;

export interface NextSeasonProps {
  data: NextData;
  /** F23: clic en un año → Historia del condado en ese año */
  onYearClick?: (year: number) => void;
}

/** Busca una opción por id en los dos cultivos */
function findOption(data: NextData, id: string): NextOption | undefined {
  for (const plan of Object.values(data.crops)) {
    const o = plan.options.find((x) => x.id === id);
    if (o) return o;
  }
  return undefined;
}

export const NextSeason: React.FC<NextSeasonProps> = ({data, onYearClick}) => {
  const [twinSel, setTwinSel] = useState<string | null>(null);
  const full = useFullStage();
  const pred = data.prediction ?? null;
  const option = pred ? findOption(data, pred.option_id) : undefined;
  const twinById = useMemo(() => Object.fromEntries(data.twins.map((t) => [t.fips, t])), [data.twins]);
  const goYear = (year: number) => (onYearClick ? onYearClick(year) : (window.location.hash = `#/county/${data.fips}?year=${year}`));

  if (!pred || !option) {
    return (
      <div className="ns">
        <header className="ns-head ns-head--pred">
          <div>
            <p className="ns-kicker">Model prediction for next season</p>
            <h1>Next season</h1>
          </div>
        </header>
        <p className="ns-box ns-box--missing ns-pred-missing">
          <b className="ns-missing">Missing data:</b> no prediction for this county. The model needs a USDA price and cost for corn and
          soybeans in {data.state} to compare them.
        </p>
      </div>
    );
  }

  const plan = data.crops[option.crop];
  const usual = plan.options.find((o) => o.is_current)?.yield_bu_ac?.median ?? null;
  const twins = option.twins.map((f) => twinById[f]).filter(Boolean) as Twin[];
  const pros = option.reasons.filter((r) => r.pro);
  const cons = option.reasons.filter((r) => !r.pro);
  const title = option.is_current ? `${plan.label}, the usual mix` : option.label;
  const anyPrototype = data.prototype || option.prototype || pred.prototype;

  const optName = option.is_current ? 'the usual mix' : option.label.toLowerCase();
  const pickTwin = (f: string | null, scroll = false) => {
    setTwinSel(f);
    if (scroll && f) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      document.getElementById('ns-stage')?.scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block: 'start'});
    }
  };

  return (
    <div className="ns">
      {/* LA RESPUESTA EN CIFRAS, arriba de todo (mismo bloque de antes, solo cambió de lugar) */}
      <h2 className="ns-sec-h ns-best-h">
        <span className="ns-shead-ico">
          <CropDot crop={option.crop} size={24} />
        </span>
        {title}: what pays best, in numbers
      </h2>
      <Answer option={option} usual={usual} />

      {/* ESCENARIO: el globo con los condados parecidos y, encima en vidrio, la predicción y de dónde sale */}
      {/* el hueco que deja el escenario mientras está a pantalla completa, para que la página no salte */}
      {full.active ? <div ref={full.holeRef} className="ns-stage-hole" style={{height: full.holeH}} aria-hidden="true" /> : null}
      <section
        id="ns-stage"
        ref={full.stageRef}
        className={`ns-stage${full.active ? ' is-fixed' : ''}${full.phase === 'open' ? ' is-full' : ''}`}
        style={full.box ?? undefined}
        aria-label={full.phase === 'open' ? `${data.name} County and similar counties on the globe` : 'Next season prediction over the globe'}
        role={full.active ? 'dialog' : undefined}
        aria-modal={full.active ? true : undefined}
      >
        {data.centroid ? (
          <TwinGlobe
            origin={{fips: data.fips, name: data.name, centroid: data.centroid}}
            twins={data.twins}
            highlight={option.twins}
            animateKey={option.id}
            selected={twinSel}
            onSelect={setTwinSel}
            frame={full.phase === 'opening' || full.phase === 'open' ? FULL_FRAME : STAGE_FRAME}
            interactive={full.phase === 'open'}
            recenterKey={full.recenter}
          />
        ) : (
          <p className="ns-glass ns-nogeo">
            <b>Missing data:</b> county location.
          </p>
        )}

        <div className="ns-stage-left">
          <p className="ns-glass ns-pill">
            <Icon name="pin" size={16} />
            {twins.length} similar {twins.length === 1 ? 'county' : 'counties'} grew {optName}
          </p>
          {anyPrototype ? <PrototypeStamp /> : null}
        </div>

        <aside className="ns-scol">
          <MixCard mix={data.mix} />
          <section className="ns-glass ns-best" aria-labelledby="ns-best-h">
            <p className="ns-kicker">
              <Icon name="star" size={16} />
              What pays best per acre
            </p>
            <h2 id="ns-best-h">
              <span className="ns-shead-ico">
                <CropDot crop={option.crop} size={24} />
              </span>
              {title}
            </h2>
            <Odds pred={pred} />
            <Seasons data={data} pred={pred} onYear={goYear} />
          </section>
        </aside>

        {full.active ? (
          <div className="ns-full-bar">
            <p className="ns-glass ns-full-hint">Drag to turn the globe · scroll or pinch to zoom</p>
            <button type="button" className="ns-glass ns-full-btn" onClick={full.recenterNow}>
              <Icon name="recenter" size={18} />
              Recenter
            </button>
            <button type="button" ref={full.closeRef} className="ns-full-close solid-btn" onClick={full.close}>
              <Icon name="close" size={18} />
              Close
            </button>
          </div>
        ) : null}

        <div className="ns-stage-foot">
          {twins.length ? (
            <ul className="ns-stage-twins" aria-label="Similar counties">
              {twins.map((t) => (
                <li key={t.fips}>
                  <button type="button" className={`ns-glass ns-stwin ${twinSel === t.fips ? 'on' : ''}`} aria-pressed={twinSel === t.fips} onClick={() => pickTwin(twinSel === t.fips ? null : t.fips)}>
                    <b>{t.name}</b>
                    <small>{t.state}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ns-glass ns-pill">
              <b>Missing data:</b> no similar county backs this option yet.
            </p>
          )}
          <button type="button" ref={full.openerRef} className="ns-open solid-btn" onClick={full.open} aria-expanded={full.active}>
            Open in the map
            <Icon name="expand" size={18} />
          </button>
        </div>
      </section>

      {/* GEMELOS de la opción predicha: el detalle de los que se ven en el globo, justo debajo de él */}
      {twins.length ? (
        <section className="ns-sec ns-twins ns-twins--list" aria-labelledby="ns-twins-title">
          <h2 id="ns-twins-title" className="ns-sec-h">
            <Icon name="pin" size={30} />
            Similar counties
          </h2>
          <p className="ns-lead">
            Counties with the same kind of soil and weather as {data.name} County that grew {optName}. Tap one to find it on the globe.
            {option.twins_note ? (
              <>
                {' '}
                <Confidence level={option.twins_note.confidence.level} />
              </>
            ) : null}
          </p>
          <ol className="ns-twin-grid">
            {twins.map((t) => (
              <li key={t.fips}>
                <button type="button" className={`ns-twin ${twinSel === t.fips ? 'on' : ''}`} aria-pressed={twinSel === t.fips} onClick={() => pickTwin(t.fips, true)}>
                  <span className="ns-twin-name">
                    <b>{t.name}</b>, {t.state}
                  </span>
                  <span className="ns-twin-why">
                    <span className="ns-twin-label">Why it&apos;s similar</span>
                    <span className="ns-twin-reasons">
                      {t.similar_on.length ? (
                        t.similar_on.map((s) => (
                          <span key={s} className="ns-why">
                            <Icon name={similarIcon(s)} size={16} />
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </span>
                        ))
                      ) : (
                        <small className="ns-missing">Missing data: what makes it similar</small>
                      )}
                    </span>
                  </span>
                  <span className="ns-twin-why">
                    <span className="ns-twin-label">What they plant</span>
                    <CropSplit twin={t} />
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <p className="ns-side-src">
            {[...new Set(twins.map((t) => t.source))].map((src) => (
              <SourceChip key={src} source={src} />
            ))}
          </p>
        </section>
      ) : null}

      <Sources data={data} pred={pred} option={option} twins={twins} />

      <section id="ns-detail" className="ns-detail ns-paper ns-detail--single" aria-label="Why and what could go wrong">
        <div>
          <h2 className="ns-detail-h ns-detail-h--pro">
            <Icon name="check" size={24} />
            Why the model picks it
          </h2>
          <ul>
            {pros.length ? pros.map((r, i) => <ReasonItem key={i} reason={r} onYear={goYear} />) : <li className="ns-reason ns-reason--none">Nothing else stands out in favor of this option in the data.</li>}
          </ul>
        </div>
        <div>
          <h2 className="ns-detail-h ns-detail-h--con">
            <Icon name="alert" size={24} />
            What could go wrong
          </h2>
          <ul>
            {cons.length ? cons.map((r, i) => <ReasonItem key={i} reason={r} onYear={goYear} />) : <li className="ns-reason ns-reason--none">No risk specific to this option shows up in the data.</li>}
          </ul>
          {option.range_driver ? (
            <p className="ns-driver">
              {option.range_driver.text} <SourceChip source={option.range_driver.source_label ?? 'NASA POWER'} />
            </p>
          ) : null}
        </div>
      </section>
      <p className="ns-unit">
        {plan.label} yield in bushels per acre, for the whole county: the model&apos;s average across this county&apos;s weather since 2009 (low 10%, typical, top 10%). Real single years swing about twice as much. Tap a year to see it in the county history.{' '}
        <SourceChip source={option.source || 'Field Rewind model · 2009–2023'} />
      </p>

      {/* FALTANTES */}
      {data.missing.length ? (
        <section className="ns-sec">
          <h2 className="ns-sec-h">
            <Icon name="question" size={30} />
            What we don&apos;t know yet
          </h2>
          <ul className="ns-two">
            {data.missing.map((m, i) => (
              <li key={i} className="ns-box ns-box--missing">
                <b className="ns-missing">Missing data:</b> {m.what.charAt(0).toLowerCase() + m.what.slice(1)}. {m.why}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="ns-foot">
        A prediction for the whole county, not a single field. To compare options for one farm, with its crop and priorities, use My Farm. It does not replace an agronomist.
      </p>
    </div>
  );
};

/** La mezcla esperada: qué parte del terreno de maíz y soja va a cada cambio de cultivo (capas 1 y 2) */
const MixCard: React.FC<{mix: CropMix | null | undefined}> = ({mix}) => {
  if (!mix) {
    return (
      <section className="ns-glass ns-mix" aria-labelledby="ns-mix-h">
        <p className="ns-kicker">
          <Icon name="layers" size={16} />
          Expected crop mix next season
        </p>
        <h1 id="ns-mix-h" className="visually-hidden">
          Expected crop mix next season
        </h1>
        <p className="ns-mix-missing">
          <b>Missing data:</b> no recent USDA crop maps for this county or its similar counties.
        </p>
      </section>
    );
  }
  const corn = mix.corn_pct;
  const soy = 100 - corn.pct;
  const top = Math.max(50, ...mix.items.map((i) => i.high ?? i.pct));
  const at = (v: number) => `${(v / top) * 100}%`;
  const r = (v: number) => Math.round(v);
  const span = (v: MixValue) => (v.low != null && v.high != null ? `${r(v.low)}–${r(v.high)}%` : null);
  return (
    <section className="ns-glass ns-mix" aria-labelledby="ns-mix-h">
      {mix.prototype ? <PrototypeStamp /> : null}
      <p className="ns-kicker">
        <Icon name="layers" size={16} />
        Expected crop mix next season
      </p>
      <h1 id="ns-mix-h">
        About {r(corn.pct)}% corn, {r(soy)}% soybeans
      </h1>
      <div className="ns-mix-split" aria-hidden="true">
        <i style={{flexGrow: corn.pct, background: CROP_COLOR.corn}} />
        <i style={{flexGrow: soy, background: CROP_COLOR.soy}} />
      </div>
      <p className="ns-mix-sub">
        Of the county&apos;s corn and soybean ground.{span(corn) ? ` Corn lands between ${span(corn)} in most years.` : ''}
      </p>
      <ol className="ns-mix-rows" aria-label="Crop changes from last season">
        {mix.items.map((it) => (
          <li key={`${it.from}-${it.to}`}>
            <span className="ns-mix-seq" aria-hidden="true">
              <i style={{background: CROP_COLOR[it.from]}} />
              <i style={{background: CROP_COLOR[it.to]}} />
            </span>
            <span className="ns-mix-label">
              {CROP_LABEL[it.to]} after {CROP_LABEL[it.from].toLowerCase()}
            </span>
            <span className="ns-mix-bar" aria-hidden="true">
              {it.low != null && it.high != null ? <i className="rng" style={{left: at(it.low), width: `calc(${at(it.high - it.low)} + 2px)`, background: CROP_COLOR[it.to]}} /> : null}
              <i className="mid" style={{left: at(it.pct)}} />
            </span>
            <b className="ns-mix-n">{r(it.pct)}%</b>
            <small className="ns-mix-r">{span(it) ?? 'Missing data'}</small>
          </li>
        ))}
      </ol>
      <p className="ns-mix-foot">
        <Confidence level={mix.confidence.level} />
        <SourceChip source={mix.source} />
      </p>
    </section>
  );
};

/** De dónde sale la predicción: los cuatro insumos, cada uno con su fuente */
const Sources: React.FC<{data: NextData; pred: Prediction; option: NextOption; twins: Twin[]}> = ({data, pred, option, twins}) => {
  const first = pred.years[0];
  const last = pred.years[pred.years.length - 1];
  const twinSrc = [...new Set(twins.map((t) => t.source))].join(' · ');
  const mix = data.mix;
  const rows: Array<{icon: IconName; title: string; text: string; src: string}> = [
    {
      icon: 'layers',
      title: 'Crop changes',
      text: mix
        ? `The expected mix: this county's last ${mix.years.length} USDA crop maps (${mix.years[0]}–${mix.years[mix.years.length - 1]}). The range: how much it and its 5 most similar counties moved in past years. Prices don't move it yet.`
        : 'No recent USDA crop maps for this county.',
      src: mix?.source ?? '',
    },
    {icon: 'thermo', title: `${pred.seasons} past seasons of weather`, text: `${data.name} County, ${first} to ${last}.`, src: 'NASA POWER'},
    {icon: 'bars', title: 'Yield in each of those seasons', text: 'Corn and soybeans in three rotations, with that weather.', src: option.source || 'Field Rewind model · USDA NASS · NASA POWER'},
    {icon: 'dollar', title: 'Money left per acre', text: 'Yield times the state price, minus the operating cost.', src: 'USDA NASS prices · USDA ERS costs'},
    {icon: 'pin', title: `${twins.length} similar ${twins.length === 1 ? 'county' : 'counties'}`, text: 'Same soil and weather, and they grew what pays best: the lines on the globe.', src: twinSrc},
  ];
  return (
    <section className="ns-sources" aria-labelledby="ns-sources-h">
      <h2 id="ns-sources-h" className="ns-sources-title">Where this comes from</h2>
      <ol>
        {rows.map((r) => (
          <li key={r.title}>
            <span className="ns-sources-ico">
              <Icon name={r.icon} size={18} />
            </span>
            <div>
              <b>{r.title}</b>
              <p>
                {r.text} {r.src ? <SourceChip source={r.src} /> : <small className="ns-missing">Missing data: source</small>}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
};

/** La probabilidad, grande, con lo que significa escrito al lado */
const Odds: React.FC<{pred: Prediction}> = ({pred}) => (
  <div className="ns-odds">
    <p className="ns-odds-n">
      <CountUp value={pred.probability * 100} format={(v) => `${Math.round(v)}%`} />
    </p>
    <p className="ns-odds-txt">
      <b>
        Best option in {pred.wins} of {pred.seasons} past seasons
      </b>
      With each season&apos;s weather from {pred.years[0]} to {pred.years[pred.years.length - 1]}, out of corn or soybeans in three rotations. It is what pays best, not what every farm will plant.
    </p>
  </div>
);

/** Los climas pasados, uno por caja: lleno = ganó la predicha; con borde = ganó otra (su color) */
const Seasons: React.FC<{data: NextData; pred: Prediction; onYear: (y: number) => void}> = ({data, pred, onYear}) => {
  const winnerOf = new Map<number, string>();
  for (const y of pred.best_years) winnerOf.set(y, pred.option_id);
  for (const o of pred.others) for (const y of o.best_years) winnerOf.set(y, o.option_id);
  const label = (id: string) => {
    const o = findOption(data, id);
    return o ? (o.is_current ? `${data.crops[o.crop].label}, usual mix` : o.label) : id;
  };
  return (
    <section className="ns-seasons" aria-label="Which option was best with each past season's weather">
      <ol>
        {pred.years.map((y) => {
          const id = winnerOf.get(y);
          const o = id ? findOption(data, id) : undefined;
          const won = id === pred.option_id;
          return (
            <li key={y}>
              <button
                type="button"
                className={`ns-season ${won ? 'won' : id ? 'lost' : 'none'}`}
                style={o ? {['--c' as string]: CROP_COLOR[o.crop]} : undefined}
                onClick={() => onYear(y)}
                title={`${y}: ${id ? label(id) : 'Missing data'} was best. See ${y} in the county history`}
              >
                <i aria-hidden="true" />
                <span aria-hidden="true">&rsquo;{String(y).slice(2)}</span>
                <span className="visually-hidden">{y}</span>
                <span className="visually-hidden">: {id ? label(id) : 'Missing data'} was best</span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="ns-seasons-key">
        <span>
          <i className="won" style={{['--c' as string]: CROP_COLOR[pred.crop]}} />
          {label(pred.option_id)} best ({pred.wins})
        </span>
        {pred.others.map((o) => {
          const x = findOption(data, o.option_id);
          return (
            <span key={o.option_id}>
              <i className="lost" style={x ? {['--c' as string]: CROP_COLOR[x.crop]} : undefined} />
              {label(o.option_id)} best ({o.wins})
            </span>
          );
        })}
      </p>
    </section>
  );
};

/** La predicha en cuatro cifras: rinde típico, diferencia con lo habitual, ingreso y confianza. */
const Answer: React.FC<{option: NextOption; usual: number | null}> = ({option: o, usual}) => {
  const y = o.yield_bu_ac;
  const delta = y && usual != null && !o.is_current ? y.median - usual : null;
  return (
    <section className="ns-answer ns-answer--plain" aria-label="The prediction in numbers">
      <ul className="ns-answer-tiles">
        <li className="ns-tile">
          <Icon name="bars" />
          <span className="ns-tile-label">Typical yield</span>
          <span className="ns-tile-value">{y ? <><CountUp value={y.median} /> bu/ac</> : <span className="ns-missing">Missing data</span>}</span>
          {y ? <small>Bad year {fmt(y.p10)} · good year {fmt(y.p90)}</small> : null}
        </li>
        <li className="ns-tile">
          <Icon name="arrow" />
          <span className="ns-tile-label">Vs. the usual mix</span>
          <span className={`ns-tile-value ${delta != null && delta < 0 ? 'neg' : ''}`}>
            {o.is_current ? 'This is the usual mix' : delta != null ? <><CountUp value={delta} format={signed} /> bu/ac</> : <span className="ns-missing">Missing data</span>}
          </span>
          {delta != null ? <small>In a typical year</small> : null}
        </li>
        <li className="ns-tile">
          <Icon name="dollar" />
          <span className="ns-tile-label">Left per acre</span>
          <span className="ns-tile-value">{o.income_usd_ac ? <><CountUp value={o.income_usd_ac.median} format={usd} />/ac</> : <span className="ns-missing">Missing data</span>}</span>
          {o.income_usd_ac ? <small>After operating costs, typical year</small> : null}
        </li>
        <li className="ns-tile">
          <Icon name="shield" />
          <span className="ns-tile-label">How sure we are</span>
          <span className="ns-tile-value ns-tile-value--conf">
            <Confidence level={o.confidence.level} />
          </span>
        </li>
      </ul>
    </section>
  );
};

const ReasonItem: React.FC<{reason: Reason; onYear: (y: number) => void}> = ({reason: r, onYear}) => (
  <li className={`ns-reason ${r.pro ? 'ns-reason--pro' : 'ns-reason--con'}`}>
    <span className="ns-reason-icon">
      <Icon name={r.priority === 'yield' ? 'bars' : PRIORITY_ICON[r.priority]} size={18} />
    </span>
    <p>{r.text}</p>
    <div className="ns-meta">
      <ModelRuleTag kind={r.kind} />
      <SourceChip source={r.source} />
      {r.years.map((y) => (
        <button key={y} type="button" className="ns-year" onClick={() => onYear(y)} title={`See ${y} in the county history`}>
          {y}
        </button>
      ))}
    </div>
  </li>
);

/** Qué cultiva un condado parecido: barra partida y la misma cifra escrita. */
const CropSplit: React.FC<{twin: Twin}> = ({twin}) => {
  const parts = (Object.entries(twin.grew_crop_pct) as Array<[CropId, number]>).filter(([, v]) => v >= 1).sort((a, b) => b[1] - a[1]);
  if (!parts.length) return <small className="ns-missing">Missing data: crop areas</small>;
  return (
    <>
      <span className="ns-split" aria-hidden="true">
        {parts.map(([c, v]) => (
          <i key={c} style={{flexGrow: v, background: CROP_COLOR[c]}} />
        ))}
      </span>
      <small className="ns-split-text">
        {parts.map(([c, v], i) => (
          <span key={c} className="ns-split-item">
            {i ? ', ' : ''}
            <CropIcon crop={c} size={16} />
            {CROP_LABEL[c] ?? c} {fmt(v)}%
          </span>
        ))}
      </small>
    </>
  );
};
