/**
 * Pantalla 3 — "Next season" (F21, F22, F23, F24), con datos reales de ML y del CDL.
 *
 * La página se recorre con scroll, una idea por tramo:
 *   1. Qué vas a sembrar y qué te importa (arriba, al lado del título), con las secuencias más comunes del condado (CDL)
 *   2. Las tres opciones lado a lado, cada una con su rango (mal año / típico / buen año) sobre el mismo eje en bu/acre.
 *      La sugerida va en tarjeta clara. Al abrir una tarjeta, el panel de abajo muestra sus razones y sus riesgos.
 *   3. Lo que todavía no se sabe (faltantes, escritos)
 *   4. Condados parecidos de la opción abierta, sobre el globo, y cultivos nuevos para explorar
 *
 * Uso:  <NextSeason data={json} onYearClick={(y) => navigate(`#/county/${fips}?year=${y}`)} />
 */
import React, {useMemo, useState} from 'react';
import {Confidence, ModelRuleTag, PrototypeStamp, SourceChip} from './bits';
import {commonAxis, suggest} from './suggest';
import {TwinGlobe} from './TwinGlobe';
import {CROP_COLOR, CROP_LABEL} from '../ui/crops';
import {PRIORITY_LABEL} from './types';
import type {CropId, NextData, NextOption, PlanCrop, Priority, Reason, Twin} from './types';
import './next.css';

const PRIORITIES: Priority[] = ['risk', 'income', 'soil', 'water'];
const COUNT_WORD = ['No', 'One', 'Two', 'Three', 'Four', 'Five'];

const CropDot: React.FC<{crop: CropId}> = ({crop}) => <i className="ns-dot" style={{background: CROP_COLOR[crop]}} />;

const fmt = (v: number) => Math.round(v).toString();
const usd = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;
const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(Math.round(v))}`;
/** El JSON trae "→" en las secuencias; en pantalla se lee mejor con palabras. */
const sequence = (label: string) => label.replace(/\s*→\s*/g, ', then ').replace(/, then ([A-Z])/g, (_, c: string) => `, then ${c.toLowerCase()}`);

export interface NextSeasonProps {
  data: NextData;
  initialPriorities?: Priority[];
  /** F23: clic en un año de una razón → Historia del condado en ese año */
  onYearClick?: (year: number) => void;
}

export const NextSeason: React.FC<NextSeasonProps> = ({data, initialPriorities = ['risk'], onYearClick}) => {
  const [crop, setCrop] = useState<PlanCrop>(data.default_crop);
  const [priorities, setPriorities] = useState<Priority[]>(initialPriorities);
  const [focusId, setFocusId] = useState<string | null>(null); // tarjeta que el usuario abrió
  const [twinSel, setTwinSel] = useState<string | null>(null);

  const plan = data.crops[crop];
  const options = plan.options;
  const result = useMemo(() => suggest(options, priorities), [options, priorities]);
  const axis = useMemo(() => commonAxis(options), [options]);
  const winner = result.winner;
  const focus = options.find((o) => o.id === focusId) ?? winner ?? options[0];
  const focusIndex = options.indexOf(focus);
  const usual = options.find((o) => o.is_current)?.yield_bu_ac?.median ?? null;
  const twinById = useMemo(() => Object.fromEntries(data.twins.map((t) => [t.fips, t])), [data.twins]);
  const focusTwins = useMemo(() => focus.twins.map((f) => twinById[f]).filter(Boolean) as Twin[], [focus, twinById]);
  const twin = twinSel ? focusTwins.find((t) => t.fips === twinSel) ?? null : null;
  const ctx = data.rotation_context;

  const toggle = (p: Priority) => {
    setPriorities((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
    setFocusId(null);
  };
  const pickCrop = (c: PlanCrop) => {
    setCrop(c);
    setFocusId(null);
    setTwinSel(null);
  };
  const open = (id: string, reveal = false) => {
    setFocusId(id);
    setTwinSel(null);
    // en pantallas angostas las tarjetas van apiladas y el detalle queda lejos: se lo trae a la vista
    if (reveal && window.matchMedia('(max-width: 860px)').matches) {
      requestAnimationFrame(() => document.getElementById('ns-detail')?.scrollIntoView({behavior: 'smooth', block: 'start'}));
    }
  };
  const goYear = (year: number) => (onYearClick ? onYearClick(year) : (window.location.hash = `#/county/${data.fips}?year=${year}`));
  const anyPrototype = data.prototype || options.some((o) => o.prototype);

  /** La razón que ya se lee en la tarjeta: la primera a favor de la sugerida, o la primera de la opción. */
  const lead = (o: NextOption): Reason | undefined => (o.id === winner?.id ? result.reasons[0] : o.reasons[0]);
  const focusLead = lead(focus);
  const pros = focus.reasons.filter((r) => r.pro && r !== focusLead);
  const cons = focus.reasons.filter((r) => !r.pro && r !== focusLead);

  return (
    <div className="ns">
      <header className="ns-head">
        <div>
          <p className="ns-where">
            {data.name} County, {data.state} {anyPrototype ? <PrototypeStamp /> : null}
          </p>
          <h1>
            {COUNT_WORD[options.length] ?? options.length} ways to plant {plan.label.toLowerCase()} next season
          </h1>
        </div>
        <div className="ns-picks">
          <span id="ns-pick-crop">Planting</span>
          <div className="ns-chips" role="radiogroup" aria-labelledby="ns-pick-crop">
            {(Object.keys(data.crops) as PlanCrop[]).map((c) => (
              <button key={c} type="button" role="radio" aria-checked={c === crop} className={`ns-chip ${c === crop ? 'on' : ''}`} onClick={() => pickCrop(c)}>
                <CropDot crop={c} />
                {data.crops[c].label}
              </button>
            ))}
          </div>
          <span id="ns-pick-prio">What matters most</span>
          <div className="ns-chips" role="group" aria-labelledby="ns-pick-prio">
            {PRIORITIES.map((p) => (
              <button key={p} type="button" aria-pressed={priorities.includes(p)} className={`ns-chip ${priorities.includes(p) ? 'on' : ''}`} onClick={() => toggle(p)}>
                {PRIORITY_LABEL[p]}
              </button>
            ))}
          </div>
        </div>
      </header>

      {result.unscored.length ? (
        <p className="ns-unscored">
          {result.unscored.map((p) => (
            <span key={p}>
              <b className="ns-missing">Missing data:</b> {PRIORITY_LABEL[p].toLowerCase()} ({p === 'income' ? 'no yield range to turn into income' : 'no data separates these options'}). Not used in the suggestion.{' '}
            </span>
          ))}
        </p>
      ) : null}

      {ctx.items.length ? (
        <p className="ns-seq">
          <span>Most common here</span>
          {ctx.items.slice(0, 3).map((it) => (
            <b key={it.label}>
              {sequence(it.label)} {fmt(it.pct)}%
            </b>
          ))}
          <SourceChip source={ctx.source} />
        </p>
      ) : ctx.text?.[crop] ? (
        <p className="ns-seq">
          <b>{ctx.text[crop]}</b> <SourceChip source={ctx.source} />
        </p>
      ) : null}

      {!winner ? (
        <p className="ns-nowinner" aria-live="polite">
          <b>Pick a priority to get a suggestion.</b>{' '}
          {priorities.length ? 'The priorities you picked cannot be scored yet. The options below stay comparable.' : 'The options below stay comparable, each with its range.'}
        </p>
      ) : null}

      {/* TRES OPCIONES, EJE COMÚN EN BU/ACRE */}
      <section className="ns-cards" aria-label="Options for next season" style={{['--n' as string]: options.length}}>
        {options.map((o) => (
          <OptionCard key={o.id} option={o} axis={axis} usual={usual} suggested={winner?.id === o.id} open={focus.id === o.id} note={lead(o)?.text ?? null} onOpen={() => open(o.id, true)} />
        ))}
      </section>

      <section id="ns-detail" className="ns-detail ns-paper" aria-live="polite" style={{['--at' as string]: focusIndex, ['--n' as string]: options.length}}>
        <div>
          <h2>Why {focus.is_current ? 'keep your usual mix' : focus.label.toLowerCase()}</h2>
          <ul>
            {pros.length ? pros.map((r, i) => <ReasonItem key={i} reason={r} onYear={goYear} />) : <li className="ns-reason ns-reason--none">Nothing else stands out in favor of this option in the data.</li>}
          </ul>
        </div>
        <div>
          <h2>What could go wrong</h2>
          <ul>
            {cons.length ? cons.map((r, i) => <ReasonItem key={i} reason={r} onYear={goYear} />) : <li className="ns-reason ns-reason--none">No risk specific to this option shows up in the data.</li>}
          </ul>
          {focus.range_driver ? (
            <p className="ns-driver">
              {focus.range_driver.text} <SourceChip source={focus.range_driver.source_label ?? 'NASA POWER'} />
            </p>
          ) : null}
        </div>
      </section>
      <p className="ns-unit">
        {plan.label} yield in bushels per acre, for the whole county: bad year (low 10%), typical year, good year (top 10%), with this county&apos;s weather since 2009. Tap a year to see it in the county history.{' '}
        <SourceChip source={focus.source || 'Field Rewind model · 2009–2023'} />
      </p>

      {/* FALTANTES */}
      {data.missing.length ? (
        <section className="ns-sec">
          <h2>What we don&apos;t know yet</h2>
          <ul className="ns-two">
            {data.missing.map((m, i) => (
              <li key={i} className="ns-box ns-box--missing">
                <b className="ns-missing">Missing data:</b> {m.what.charAt(0).toLowerCase() + m.what.slice(1)}. {m.why}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* GEMELOS */}
      <section className="ns-sec">
        <h2>Counties like yours</h2>
        <p className="ns-lead">
          Counties with similar soil and weather. The lines go from {data.name} County to the ones that back the option you pick.
        </p>
        <div className="ns-tabs">
          <span id="ns-twins-for">Show counties for</span>
          <div className="ns-chips" role="radiogroup" aria-labelledby="ns-twins-for">
            {options.map((o) => (
              <button key={o.id} type="button" role="radio" aria-checked={o.id === focus.id} className={`ns-chip ns-chip--sm ${o.id === focus.id ? 'on' : ''}`} onClick={() => open(o.id)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="ns-world">
          <div className="ns-world-map">
            {data.twins.some((t) => t.prototype) ? <PrototypeStamp /> : null}
            {data.centroid ? (
              <TwinGlobe origin={{fips: data.fips, name: data.name, centroid: data.centroid}} twins={data.twins} highlight={focus.twins} animateKey={focus.id} selected={twinSel} onSelect={setTwinSel} />
            ) : (
              <p className="ns-box ns-box--missing">
                <b className="ns-missing">Missing data:</b> county location.
              </p>
            )}
            {twin ? (
              <div className="ns-pop ns-paper" role="status">
                <b>
                  {twin.name}, {twin.state}
                </b>
                <small>Similar on {twin.similar_on.join(' and ')}</small>
                <CropSplit twin={twin} />
                <SourceChip source={twin.source} />
              </div>
            ) : null}
            <a className="ns-open" href={`#/map/${data.fips}`}>
              Open in the map
            </a>
          </div>
          <div className="ns-side">
            <h3>
              {focusTwins.length} {focusTwins.length === 1 ? 'county' : 'counties'} for {focus.is_current ? 'your usual mix' : focus.label.toLowerCase()}
            </h3>
            {focus.twins_note ? (
              <p className="ns-side-note">
                {focus.twins_note.text.replace(/^Counties like yours[^:]*:\s*\d+\.\s*/, '')} <Confidence level={focus.twins_note.confidence.level} />
              </p>
            ) : null}
            <ul>
              {focusTwins.map((t) => (
                <li key={t.fips}>
                  <button type="button" className={`ns-twin ${twinSel === t.fips ? 'on' : ''}`} aria-pressed={twinSel === t.fips} onClick={() => setTwinSel(twinSel === t.fips ? null : t.fips)}>
                    <b>
                      {t.name}, {t.state}
                    </b>
                    <small>Similar on {t.similar_on.join(' and ')}</small>
                    <CropSplit twin={t} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {data.explore.map((x) => (
          <div key={x.id} className="ns-new">
            <div>
              <h3>
                <CropDot crop={x.crop} /> Something new nearby: {x.label.toLowerCase()}
              </h3>
              <p>
                {x.twins.length} counties like yours grow it. From those counties, not from the model: similar soil and weather doesn&apos;t guarantee the same result.
              </p>
            </div>
            <p className="ns-new-range">
              {fmt(x.range.p10)}–{fmt(x.range.p90)}
              <small>bu/ac, typical {fmt(x.range.median)}</small>
              {x.income_usd_ac ? <small className="ns-new-income">About {usd(x.income_usd_ac.median)}/acre after operating costs</small> : null}
            </p>
            <Confidence level={x.confidence.level} />
          </div>
        ))}
      </section>

      <p className="ns-foot">Decision support for the whole county, not a single field. It does not replace your agronomist.</p>
    </div>
  );
};

const ReasonItem: React.FC<{reason: Reason; onYear: (y: number) => void}> = ({reason: r, onYear}) => (
  <li className="ns-reason">
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
      <small>{parts.map(([c, v]) => `${CROP_LABEL[c] ?? c} ${fmt(v)}%`).join(', ')}</small>
    </>
  );
};

const GAUGE_H = 280; // alto del eje en px
const GAP = 36; // separación mínima entre las tres cifras

const OptionCard: React.FC<{
  option: NextOption;
  axis: {min: number; max: number; ticks: number[]};
  usual: number | null;
  suggested: boolean;
  open: boolean;
  note: string | null;
  onOpen: () => void;
}> = ({option: o, axis, usual, suggested, open, note, onOpen}) => {
  const y = o.yield_bu_ac;
  const px = (v: number) => ((axis.max - v) / (axis.max - axis.min)) * GAUGE_H;
  // las cifras se corren si el rango es angosto, para que no se pisen; la barra queda en su lugar
  const mid = y ? px(y.median) : 0;
  const hi = y ? Math.min(px(y.p90), mid - GAP) : 0;
  const lo = y ? Math.max(px(y.p10), mid + GAP) : 0;
  const ticks = axis.ticks.length > 6 ? axis.ticks.filter((_, i) => i % 2 === 0) : axis.ticks;
  const delta = y && usual != null && !o.is_current ? y.median - usual : null;
  return (
    <article className={`ns-card ${suggested ? 'ns-card--sug ns-paper' : ''} ${open ? 'open' : ''}`} onClick={onOpen}>
      <p className="ns-card-tag">{suggested ? <span>Suggested for your priorities</span> : null}</p>
      <h2>{o.label}</h2>
      <p className="ns-card-sub">{o.sublabel}</p>
      <p className={`ns-card-delta ${delta != null && delta < 0 ? 'neg' : ''}`}>{delta != null ? `${signed(delta)} bu/ac vs. your usual mix` : ' '}</p>
      {y ? (
        <div className="ns-gauge" style={{height: GAUGE_H}} role="img" aria-label={`${o.label}: ${fmt(y.p10)} bushels per acre in a bad year, ${fmt(y.median)} in a typical year, ${fmt(y.p90)} in a good year`}>
          {ticks.map((t) => (
            <i key={t} className="ns-gauge-line" style={{top: px(t)}}>
              <em>{t}</em>
            </i>
          ))}
          <i className="ns-gauge-bar" style={{top: px(y.p90), height: Math.max(6, px(y.p10) - px(y.p90)), background: CROP_COLOR[o.crop]}} />
          <span className="ns-gauge-n" style={{top: hi}}>
            {fmt(y.p90)}
            <small>good year</small>
          </span>
          <span className="ns-gauge-n ns-gauge-n--mid" style={{top: mid}}>
            {fmt(y.median)}
            <small>typical</small>
          </span>
          <span className="ns-gauge-n" style={{top: lo}}>
            {fmt(y.p10)}
            <small>bad year</small>
          </span>
        </div>
      ) : (
        <p className="ns-box ns-box--missing">
          <b className="ns-missing">Missing data:</b> no yield range for this option.
        </p>
      )}
      {o.income_usd_ac ? (
        <p className="ns-card-income">
          <b>{usd(o.income_usd_ac.median)}</b>/acre after operating costs, typical year
          <small>
            Bad year {usd(o.income_usd_ac.p10)} · good year {usd(o.income_usd_ac.p90)} · USDA NASS prices, ERS costs
          </small>
        </p>
      ) : null}
      <div className="ns-card-conf">
        <Confidence level={o.confidence.level} />
        <small>{o.confidence.reason.replace(/^Low confidence:\s*/i, '')}</small>
      </div>
      {note ? <p className="ns-card-note">{note}</p> : null}
      <button
        type="button"
        className="ns-card-more"
        aria-expanded={open}
        aria-controls="ns-detail"
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
      >
        {open ? 'Details open below' : 'See the details'}
      </button>
    </article>
  );
};
