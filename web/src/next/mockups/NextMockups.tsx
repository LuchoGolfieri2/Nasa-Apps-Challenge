/**
 * Mockups de "Next season" (15/11). Tres maneras de armar la pantalla con el lenguaje del globo (pantalla 1) y de
 * "See more" (la historia sobre el globo): vidrio oscuro sobre el globo en vivo, cajas con ícono y etiqueta,
 * barras como "Acres by crop", botones blancos y el dock de abajo como la línea de tiempo.
 * Datos reales de data/next/<fips>.json; el globo es el TwinGlobe (deck.gl + Blue Marble de GIBS).
 *
 *   #/county/19169/next?mock=a   A · Escenario: igual que la historia, columna de vidrio a la derecha
 *   #/county/19169/next?mock=b   B · Tarjetas del mapa: tres tarjetas blancas sobre el globo, como la del condado
 *   #/county/19169/next?mock=c   C · Bento: cajas blancas y el globo como una caja más, con vidrio encima
 *
 * Son mockups: no reemplazan a NextSeason.tsx hasta que el equipo elija uno.
 */
import React, {useMemo, useState} from 'react';
import {CountUp} from '../../ui/CountUp';
import {CROP_COLOR, CROP_LABEL} from '../../ui/crops';
import type {CropId} from '../../ui/crops';
import {Confidence, PrototypeStamp, SourceChip} from '../bits';
import {Icon, PRIORITY_ICON, similarIcon} from '../icons';
import {commonAxis, suggest} from '../suggest';
import {TwinGlobe} from '../TwinGlobe';
import type {Frame} from '../TwinGlobe';
import {PRIORITY_LABEL} from '../types';
import type {NextData, NextOption, PlanCrop, Priority, Reason, Twin} from '../types';
import ICON_CORN from '../../ui/icons/crops/corn.svg?raw';
import ICON_SOY from '../../ui/icons/crops/soy.svg?raw';
import ICON_WHEAT from '../../ui/icons/crops/wheat.svg?raw';
import ICON_YIELD from '../../ui/icons/crops/yield.svg?raw';
import './mockups.css';

export type MockId = 'a' | 'b' | 'c';
export const MOCKS: Record<MockId, string> = {a: 'Stage', b: 'Map cards', c: 'Bento'};

const PRIORITIES: Priority[] = ['risk', 'income', 'soil', 'water'];
const SHORT_PRIORITY: Record<Priority, string> = {risk: 'Lower risk', income: 'More income', soil: 'Soil health', water: 'Save water'};
const CROP_SVG: Partial<Record<CropId, string>> = {corn: ICON_CORN, soy: ICON_SOY, wheat: ICON_WHEAT};
const fmt = (v: number) => Math.round(v).toString();
const usd = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;
const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(Math.round(v))}`;

/* ------------------------------------------------------------------ estado compartido */

function useNext(data: NextData, initialCrop?: PlanCrop, initialPriorities: Priority[] = ['risk']) {
  const [crop, setCrop] = useState<PlanCrop>(initialCrop && data.crops[initialCrop] ? initialCrop : data.default_crop);
  const [priorities, setPriorities] = useState<Priority[]>(initialPriorities);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [twinSel, setTwinSel] = useState<string | null>(null);
  const options = data.crops[crop].options;
  const result = useMemo(() => suggest(options, priorities), [options, priorities]);
  const axis = useMemo(() => commonAxis(options), [options]);
  const winner = result.winner;
  const focus = options.find((o) => o.id === focusId) ?? winner ?? options[0];
  const usual = options.find((o) => o.is_current)?.yield_bu_ac?.median ?? null;
  const twinById = useMemo(() => Object.fromEntries(data.twins.map((t) => [t.fips, t])), [data.twins]);
  const focusTwins = focus.twins.map((f) => twinById[f]).filter(Boolean) as Twin[];
  return {
    crop,
    plan: data.crops[crop],
    options,
    priorities,
    result,
    axis,
    winner,
    focus,
    usual,
    focusTwins,
    twinSel,
    setTwinSel,
    pickCrop: (c: PlanCrop) => {
      setCrop(c);
      setFocusId(null);
      setTwinSel(null);
    },
    toggle: (p: Priority) => {
      setPriorities((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
      setFocusId(null);
    },
    open: (id: string) => {
      setFocusId(id);
      setTwinSel(null);
    },
  };
}
type Next = ReturnType<typeof useNext>;

const goYear = (fips: string, y: number) => (window.location.hash = `#/county/${fips}?year=${y}`);
const delta = (o: NextOption, usual: number | null) => (o.yield_bu_ac && usual != null && !o.is_current ? o.yield_bu_ac.median - usual : null);
/** El cultivo anterior de cada opción: arriba del bloque (como los años de la línea de tiempo) */
const prevCrop = (o: NextOption): CropId => (o.rotation === 'rotado' ? (o.crop === 'corn' ? 'soy' : 'corn') : o.crop === 'corn' ? 'corn' : 'soy');

/* ------------------------------------------------------------------ piezas */

const CropIcon: React.FC<{crop: CropId; size?: number}> = ({crop, size = 22}) => (
  <span className="nm-cropico" style={{width: size, height: size}} aria-hidden="true" dangerouslySetInnerHTML={{__html: CROP_SVG[crop] ?? ICON_YIELD}} />
);

/** Ícono redondo con el color del cultivo, como el botón "Color by" del mapa */
const RoundIcon: React.FC<{color: string; children: React.ReactNode; size?: number}> = ({color, children, size = 38}) => (
  <span className="nm-round" style={{background: color, width: size, height: size}}>
    {children}
  </span>
);

/** Bloque de dos colores (cultivo anterior arriba, este abajo), como los años de la línea de tiempo */
const SeqBlock: React.FC<{o: NextOption; big?: boolean}> = ({o, big}) => (
  <span className={`nm-seq ${big ? 'nm-seq--big' : ''}`} aria-hidden="true">
    {/* la mezcla habitual no tiene un cultivo anterior fijo: mitad soja, mitad maíz */}
    <i style={{background: o.rotation === 'actual' ? `linear-gradient(90deg, ${CROP_COLOR.soy} 50%, ${CROP_COLOR.corn} 50%)` : CROP_COLOR[prevCrop(o)]}} />
    <i style={{background: CROP_COLOR[o.crop]}} />
  </span>
);

/** Caja con ícono, etiqueta arriba a la derecha, valor y rótulo: la misma de "See more" (YearTiles) */
const Tile: React.FC<{icon: React.ReactNode; tag?: {text: string; tone?: 'up' | 'down'}; value: React.ReactNode; label: string; className?: string}> = ({
  icon,
  tag,
  value,
  label,
  className = '',
}) => (
  <li className={`nm-tile ${className}`}>
    <span className="nm-tile-top">
      <span className="nm-tile-ico">{icon}</span>
      {tag ? <span className={`nm-tile-tag ${tag.tone ? `nm-tile-tag--${tag.tone}` : ''}`}>{tag.text}</span> : null}
    </span>
    <span className="nm-tile-value">{value}</span>
    <span className="nm-tile-label">{label}</span>
  </li>
);

const Missing: React.FC<{children: React.ReactNode}> = ({children}) => <span className="nm-missing">{children}</span>;

/** Las cuatro cifras de la opción abierta, en cajas */
const AnswerTiles: React.FC<{n: Next}> = ({n}) => {
  const o = n.focus;
  const y = o.yield_bu_ac;
  const d = delta(o, n.usual);
  return (
    <ul className="nm-tiles">
      <Tile
        icon={<CropIcon crop={o.crop} size={20} />}
        tag={d != null ? {text: d >= 0 ? 'Above usual' : 'Below usual', tone: d >= 0 ? 'up' : 'down'} : undefined}
        value={y ? <><b><CountUp value={y.median} /></b> <small>bu/acre</small></> : <Missing>Missing data</Missing>}
        label="Typical yield"
      />
      <Tile
        icon={<Icon name="arrow" size={20} />}
        value={o.is_current ? <b className="nm-word">Your usual mix</b> : d != null ? <><b><CountUp value={d} format={signed} /></b> <small>bu/acre</small></> : <Missing>Missing data</Missing>}
        label="Vs. your usual mix"
      />
      <Tile
        icon={<Icon name="dollar" size={20} />}
        value={o.income_usd_ac ? <><b><CountUp value={o.income_usd_ac.median} format={usd} /></b> <small>/acre</small></> : <Missing>Missing data</Missing>}
        label="Left after operating costs"
      />
      <Tile icon={<Icon name="shield" size={20} />} value={<Confidence level={o.confidence.level} />} label="How sure we are" className="nm-tile--conf" />
    </ul>
  );
};

/** Rango de las tres opciones sobre un mismo eje, en filas como "Acres by crop" */
const RangeRows: React.FC<{n: Next; light?: boolean}> = ({n, light}) => {
  const {axis, options, usual, focus, winner} = n;
  const pct = (v: number) => ((v - axis.min) / (axis.max - axis.min)) * 100;
  return (
    <ul className={`nm-rows ${light ? 'nm-rows--light' : ''}`} role="radiogroup" aria-label="Options">
      {options.map((o) => {
        const y = o.yield_bu_ac;
        return (
          <li key={o.id}>
            <button type="button" role="radio" aria-checked={o.id === focus.id} className={`nm-row ${o.id === focus.id ? 'on' : ''}`} onClick={() => n.open(o.id)}>
              <span className="nm-row-head">
                <SeqBlock o={o} />
                <b>{o.label}</b>
                {winner?.id === o.id ? (
                  <span className="nm-pick">
                    <Icon name="star" size={12} /> Top pick
                  </span>
                ) : null}
                <span className="nm-row-n">
                  {y ? (
                    <>
                      <b>{fmt(y.median)}</b> <small>bu/ac</small>
                    </>
                  ) : (
                    <Missing>Missing data</Missing>
                  )}
                </span>
              </span>
              {y ? (
                <span className="nm-range" aria-label={`Bad year ${fmt(y.p10)}, typical ${fmt(y.median)}, good year ${fmt(y.p90)} bushels per acre`}>
                  <i className="nm-range-bar" style={{left: `${pct(y.p10)}%`, width: `${Math.max(1.5, pct(y.p90) - pct(y.p10))}%`, background: CROP_COLOR[o.crop]}} />
                  <i className="nm-range-mid" style={{left: `${pct(y.median)}%`}} />
                  {usual != null ? <i className="nm-range-usual" style={{left: `${pct(usual)}%`}} /> : null}
                  <em style={{left: `${pct(y.p10)}%`}}>{fmt(y.p10)}</em>
                  <em className="r" style={{left: `${pct(y.p90)}%`}}>{fmt(y.p90)}</em>
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
};

const ReasonList: React.FC<{reasons: Reason[]; fips: string; empty: string}> = ({reasons, fips, empty}) => (
  <ul className="nm-reasons">
    {reasons.length ? (
      reasons.map((r, i) => (
        <li key={i} className={r.pro ? 'pro' : 'con'}>
          <span className="nm-reason-ico">
            <Icon name={r.priority === 'yield' ? 'bars' : PRIORITY_ICON[r.priority]} size={16} />
          </span>
          <p>{r.text}</p>
          <span className="nm-reason-meta">
            <SourceChip source={r.source} />
            {r.years.map((y) => (
              <button key={y} type="button" className="nm-year" onClick={() => goYear(fips, y)} title={`See ${y} in the county history`}>
                {y}
              </button>
            ))}
          </span>
        </li>
      ))
    ) : (
      <li className="none">{empty}</li>
    )}
  </ul>
);

/** Qué cultiva un condado parecido: barra partida y la cifra escrita */
const CropSplit: React.FC<{twin: Twin}> = ({twin}) => {
  const parts = (Object.entries(twin.grew_crop_pct) as Array<[CropId, number]>).filter(([, v]) => v >= 1).sort((a, b) => b[1] - a[1]);
  if (!parts.length) return <Missing>Missing data: crop areas</Missing>;
  return (
    <span className="nm-split-wrap">
      <span className="nm-split" aria-hidden="true">
        {parts.map(([c, v]) => (
          <i key={c} style={{flexGrow: v, background: CROP_COLOR[c]}} />
        ))}
      </span>
      <small>{parts.map(([c, v]) => `${CROP_LABEL[c] ?? c} ${fmt(v)}%`).join(' · ')}</small>
    </span>
  );
};

const TwinItem: React.FC<{t: Twin; n: Next; compact?: boolean}> = ({t, n, compact}) => (
  <li>
    <button type="button" className={`nm-twin ${n.twinSel === t.fips ? 'on' : ''}`} aria-pressed={n.twinSel === t.fips} onClick={() => n.setTwinSel(n.twinSel === t.fips ? null : t.fips)}>
      <span className="nm-twin-name">
        <b>{t.name}</b> <small>{t.state}</small>
      </span>
      {!compact ? (
        <span className="nm-twin-why">
          {t.similar_on.slice(0, 2).map((s) => (
            <span key={s}>
              <Icon name={similarIcon(s)} size={14} />
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
          ))}
        </span>
      ) : null}
      <CropSplit twin={t} />
    </button>
  </li>
);

const PriorityChips: React.FC<{n: Next; variant: 'glass' | 'light'}> = ({n, variant}) => (
  <div className={`nm-chips nm-chips--${variant}`} role="group" aria-label="What matters most">
    {PRIORITIES.map((p) => (
      <button key={p} type="button" aria-pressed={n.priorities.includes(p)} className={`nm-chip ${n.priorities.includes(p) ? 'on' : ''}`} onClick={() => n.toggle(p)} title={PRIORITY_LABEL[p]}>
        <Icon name={PRIORITY_ICON[p]} size={16} />
        {SHORT_PRIORITY[p]}
      </button>
    ))}
  </div>
);

const CropSwitch: React.FC<{n: Next; data: NextData; variant: 'glass' | 'light'}> = ({n, data, variant}) => (
  <div className={`nm-chips nm-chips--${variant}`} role="radiogroup" aria-label="Planting">
    {(Object.keys(data.crops) as PlanCrop[]).map((c) => (
      <button key={c} type="button" role="radio" aria-checked={c === n.crop} className={`nm-chip ${c === n.crop ? 'on' : ''}`} onClick={() => n.pickCrop(c)}>
        <CropIcon crop={c} size={16} />
        {data.crops[c].label}
      </button>
    ))}
  </div>
);

const Globe: React.FC<{data: NextData; n: Next; frame: Frame}> = ({data, n, frame}) =>
  data.centroid ? (
    <TwinGlobe origin={{fips: data.fips, name: data.name, centroid: data.centroid}} twins={data.twins} highlight={n.focus.twins} animateKey={n.focus.id} selected={n.twinSel} onSelect={n.setTwinSel} frame={frame} />
  ) : (
    <p className="nm-glass nm-nogeo">
      <Missing>Missing data: county location</Missing>
    </p>
  );

const NoWinner: React.FC = () => (
  <p className="nm-nowinner">
    <b>Pick a priority to get a suggestion.</b> The three options stay comparable, each with its range.
  </p>
);

/* ------------------------------------------------------------------ A · Escenario (como "See more") */

const MockStage: React.FC<{data: NextData; n: Next}> = ({data, n}) => {
  const o = n.focus;
  const sug = n.winner?.id === o.id;
  const lead = sug ? n.result.reasons[0] : o.reasons.find((r) => r.pro) ?? o.reasons[0];
  const cons = o.reasons.filter((r) => !r.pro);
  return (
    <div className="nm nm-a">
      <section className="nm-stage" aria-label="Next season over the globe">
        <Globe data={data} n={n} frame={{left: 0.08, right: 0.44, top: 0.3, bottom: 0.1}} />
        {data.prototype ? (
          <span className="nm-a-stamp">
            <PrototypeStamp />
          </span>
        ) : null}
        <div className="nm-a-left">
          <p className="nm-glass nm-pill">
            <Icon name="pin" size={16} />
            {n.focusTwins.length} counties like yours grew {o.is_current ? 'your usual mix' : o.label.toLowerCase()}
          </p>
          <div className="nm-glass nm-a-prio">
            <span className="nm-eyebrow">What matters most</span>
            <PriorityChips n={n} variant="glass" />
          </div>
        </div>

        <aside className="nm-col">
          <header className="nm-glass nm-headline">
            <p className="nm-kicker">
              {sug ? (
                <>
                  <Icon name="star" size={14} /> Suggested for your priorities
                </>
              ) : (
                'Option you opened'
              )}
            </p>
            <h1>{o.is_current ? 'Your usual mix' : o.label}</h1>
            {lead ? <p className="nm-headline-why">{lead.text}</p> : null}
          </header>

          <section className="nm-glass nm-card-g">
            <h2>
              {n.plan.label} yield, bu/acre <SourceChip source="Field Rewind model · 2009–2023" />
            </h2>
            <RangeRows n={n} />
            <p className="nm-note">Bar: bad year (low 10%) to good year (top 10%). Line: typical year. Dashed: your usual mix.</p>
          </section>

          <AnswerTiles n={n} />

          <section className="nm-glass nm-card-g">
            <h2>
              <Icon name="alert" size={18} /> What could go wrong
            </h2>
            <ReasonList reasons={cons} fips={data.fips} empty="No risk specific to this option shows up in the data." />
          </section>
        </aside>
      </section>

      {/* dock de abajo, como la línea de tiempo de la historia */}
      <nav className="nm-dock" aria-label="Choose an option">
        <CropSwitch n={n} data={data} variant="light" />
        <div className="nm-dock-opts" role="radiogroup" aria-label="Options">
          {n.options.map((x) => (
            <button key={x.id} type="button" role="radio" aria-checked={x.id === o.id} className={`nm-dock-opt ${x.id === o.id ? 'on' : ''}`} onClick={() => n.open(x.id)}>
              <SeqBlock o={x} big={x.id === o.id} />
              <span>{x.is_current ? 'Usual mix' : x.label}</span>
              {n.winner?.id === x.id ? <i className="nm-dock-star" aria-label="Top pick"><Icon name="star" size={12} /></i> : null}
            </button>
          ))}
        </div>
        <a className="nm-cta" href={`#/map/${data.fips}`}>
          Open in the map <Icon name="open" size={18} />
        </a>
      </nav>
      {!n.winner ? <NoWinner /> : null}
    </div>
  );
};

/* ------------------------------------------------------------------ B · Tarjetas del mapa */

const MockMapCards: React.FC<{data: NextData; n: Next}> = ({data, n}) => {
  const pr = n.priorities[0];
  return (
    <div className="nm nm-b">
      <section className="nm-stage nm-stage--tall" aria-label="Next season over the globe">
        <Globe data={data} n={n} frame={{left: 0.06, right: 0.32, top: 0.34, bottom: 0.44}} />

        {/* arriba a la izquierda: los dos controles como "Color by" del mapa */}
        <div className="nm-b-dock">
          <div className="nm-layer">
            <RoundIcon color={CROP_COLOR[n.crop]}>
              <CropIcon crop={n.crop} size={22} />
            </RoundIcon>
            <span className="nm-layer-txt">
              <small>Planting</small>
              <CropSwitch n={n} data={data} variant="light" />
            </span>
          </div>
          <div className="nm-layer">
            <RoundIcon color="var(--sprout)">
              <Icon name={pr ? PRIORITY_ICON[pr] : 'question'} size={22} />
            </RoundIcon>
            <span className="nm-layer-txt">
              <small>What matters most</small>
              <PriorityChips n={n} variant="light" />
            </span>
          </div>
        </div>

        {/* a la derecha: los condados parecidos, cuadro blanco como la leyenda */}
        <aside className="nm-b-twins">
          <h2>
            <Icon name="pin" size={18} /> Counties like yours
          </h2>
          <p className="nm-sub">
            Same kind of soil and weather. These {n.focusTwins.length} grew {n.focus.is_current ? 'your usual mix' : n.focus.label.toLowerCase()}.
          </p>
          {n.focusTwins.length ? (
            <ol className="nm-twins">
              {n.focusTwins.map((t) => (
                <TwinItem key={t.fips} t={t} n={n} />
              ))}
            </ol>
          ) : (
            <Missing>Missing data: no county like yours backs this option yet.</Missing>
          )}
          {n.focus.twins_note ? (
            <p className="nm-b-twins-conf">
              <Confidence level={n.focus.twins_note.confidence.level} />
            </p>
          ) : null}
        </aside>

        {/* abajo: tres tarjetas blancas, como la tarjeta del condado */}
        <div className="nm-b-cards" role="radiogroup" aria-label="Options for next season">
          {n.options.map((o) => {
            const y = o.yield_bu_ac;
            const d = delta(o, n.usual);
            const sug = n.winner?.id === o.id;
            const on = n.focus.id === o.id;
            return (
              <article key={o.id} className={`nm-mcard ${on ? 'on' : ''} ${sug ? 'sug' : ''}`}>
                <button type="button" role="radio" aria-checked={on} className="nm-mcard-hit" onClick={() => n.open(o.id)} aria-label={o.label} />
                <div className="nm-mcard-head">
                  <SeqBlock o={o} />
                  <div>
                    <h3>{o.label}</h3>
                    <p className="nm-sub">{o.sublabel}</p>
                  </div>
                </div>
                <p className={`nm-status ${sug ? 'ok' : ''}`}>
                  {sug ? (
                    <>
                      <Icon name="star" size={14} /> Top pick for {n.result.reasons[0] ? PRIORITY_LABEL[n.priorities[0] ?? 'risk'].toLowerCase() : 'your priorities'}
                    </>
                  ) : o.is_current ? (
                    'What this county does most'
                  ) : d != null ? (
                    `${signed(d)} bu/acre vs. your usual mix`
                  ) : (
                    ' '
                  )}
                </p>
                <p className="nm-mcard-v">
                  {y ? (
                    <>
                      <b><CountUp value={y.median} /></b> bu/acre
                    </>
                  ) : (
                    <Missing>Missing data</Missing>
                  )}
                </p>
                <p className="nm-sub">Typical year · bad {y ? fmt(y.p10) : '–'} · good {y ? fmt(y.p90) : '–'}</p>
                {o.income_usd_ac ? (
                  <p className="nm-mcard-usd">
                    <Icon name="dollar" size={16} />
                    <b>{usd(o.income_usd_ac.median)}</b>/acre after operating costs
                  </p>
                ) : null}
                <div className="nm-mcard-foot">
                  <Confidence level={o.confidence.level} />
                </div>
              </article>
            );
          })}
        </div>
        <p className="nm-b-src">
          Model · USDA NASS · NASA POWER · Imagery: NASA Blue Marble (GIBS)
        </p>
      </section>

      {/* debajo del escenario: por qué y qué puede salir mal, en dos cuadros blancos */}
      <section className="nm-b-why">
        <div className="nm-white">
          <h2 className="nm-h-pro">
            <Icon name="check" size={20} /> Why {n.focus.is_current ? 'keep your usual mix' : n.focus.label.toLowerCase()}
          </h2>
          <ReasonList reasons={n.focus.reasons.filter((r) => r.pro)} fips={data.fips} empty="Nothing else stands out in favor of this option in the data." />
        </div>
        <div className="nm-white">
          <h2 className="nm-h-con">
            <Icon name="alert" size={20} /> What could go wrong
          </h2>
          <ReasonList reasons={n.focus.reasons.filter((r) => !r.pro)} fips={data.fips} empty="No risk specific to this option shows up in the data." />
        </div>
      </section>
      {!n.winner ? <NoWinner /> : null}
    </div>
  );
};

/* ------------------------------------------------------------------ C · Bento */

const MockBento: React.FC<{data: NextData; n: Next}> = ({data, n}) => {
  const o = n.focus;
  const sug = n.winner?.id === o.id;
  const x = data.explore[0];
  return (
    <div className="nm nm-c">
      <header className="nm-c-head">
        <div>
          {data.prototype ? <PrototypeStamp /> : null}
          <h1>What to plant next season</h1>
        </div>
        <div className="nm-c-picks">
          <CropSwitch n={n} data={data} variant="light" />
          <PriorityChips n={n} variant="light" />
        </div>
      </header>

      <div className="nm-bento">
        {/* el globo como una caja más, con vidrio encima */}
        <section className="nm-stage nm-c-globe" aria-label="Counties like yours on the globe">
          <Globe data={data} n={n} frame={{left: 0.08, right: 0.08, top: 0.26, bottom: 0.26}} />
          <div className="nm-glass nm-c-sug">
            <p className="nm-kicker">
              {sug ? (
                <>
                  <Icon name="star" size={14} /> Suggested for your priorities
                </>
              ) : (
                'Option you opened'
              )}
            </p>
            <h2>
              <SeqBlock o={o} /> {o.is_current ? 'Your usual mix' : o.label}
            </h2>
          </div>
          <ul className="nm-c-twins">
            {n.focusTwins.slice(0, 5).map((t) => (
              <li key={t.fips}>
                <button type="button" className={`nm-glass nm-c-twin ${n.twinSel === t.fips ? 'on' : ''}`} aria-pressed={n.twinSel === t.fips} onClick={() => n.setTwinSel(n.twinSel === t.fips ? null : t.fips)}>
                  <b>{t.name}</b>
                  <small>{t.state} · {t.similar_on[0] ?? 'similar soil'}</small>
                  <CropSplit twin={t} />
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* la cifra grande */}
        <section className="nm-white nm-c-big">
          <span className="nm-c-big-ico">
            <RoundIcon color={CROP_COLOR[o.crop]} size={44}>
              <CropIcon crop={o.crop} size={24} />
            </RoundIcon>
          </span>
          <p className="nm-eyebrow">Typical yield</p>
          <p className="nm-c-big-n">{o.yield_bu_ac ? <CountUp value={o.yield_bu_ac.median} /> : <Missing>Missing data</Missing>}</p>
          <p className="nm-sub">bushels per acre, whole county</p>
          {o.yield_bu_ac ? (
            <p className="nm-c-big-range">
              Bad year <b>{fmt(o.yield_bu_ac.p10)}</b> · good year <b>{fmt(o.yield_bu_ac.p90)}</b>
            </p>
          ) : null}
        </section>

        <section className="nm-white nm-c-conf">
          <p className="nm-eyebrow">How sure we are</p>
          <Confidence level={o.confidence.level} />
          <p className="nm-sub">{o.confidence.reason.replace(/^Low confidence:\s*/i, '')}</p>
        </section>

        <section className="nm-white nm-c-usd">
          <p className="nm-eyebrow">Left per acre</p>
          <p className="nm-c-mid-n">{o.income_usd_ac ? <CountUp value={o.income_usd_ac.median} format={usd} /> : <Missing>Missing data</Missing>}</p>
          <p className="nm-sub">After operating costs · USDA NASS prices, ERS costs</p>
        </section>

        <section className="nm-white nm-c-cmp">
          <h2>Three ways to plant {n.plan.label.toLowerCase()}</h2>
          <RangeRows n={n} light />
          <p className="nm-note">Bar: bad year to good year. Line: typical year. Dashed: your usual mix.</p>
        </section>

        <section className="nm-white nm-c-why">
          <h2 className="nm-h-pro">
            <Icon name="check" size={20} /> Why
          </h2>
          <ReasonList reasons={o.reasons.filter((r) => r.pro).slice(0, 2)} fips={data.fips} empty="Nothing else stands out in favor of this option." />
          <h2 className="nm-h-con">
            <Icon name="alert" size={20} /> Watch out
          </h2>
          <ReasonList reasons={o.reasons.filter((r) => !r.pro).slice(0, 2)} fips={data.fips} empty="No risk specific to this option shows up in the data." />
        </section>

        {x ? (
          <section className="nm-white nm-c-new">
            <RoundIcon color={CROP_COLOR[x.crop]} size={40}>
              <CropIcon crop={x.crop} size={22} />
            </RoundIcon>
            <div>
              <p className="nm-eyebrow">Something new nearby</p>
              <h3>{x.label}</h3>
              <p className="nm-sub">{x.twins.length} counties like yours grow it. From those counties, not from the model.</p>
            </div>
            <p className="nm-c-mid-n">
              {fmt(x.range.p10)}–{fmt(x.range.p90)} <small>bu/ac</small>
            </p>
          </section>
        ) : null}

        {data.missing.length ? (
          <section className="nm-c-missing">
            {data.missing.map((m, i) => (
              <p key={i}>
                <b>Missing data:</b> {m.what.charAt(0).toLowerCase() + m.what.slice(1)}. {m.why}
              </p>
            ))}
          </section>
        ) : null}
      </div>
      {!n.winner ? <NoWinner /> : null}
    </div>
  );
};

/* ------------------------------------------------------------------ selector y salida */

export const NextMockups: React.FC<{data: NextData; mock: MockId; initialCrop?: PlanCrop; initialPriorities?: Priority[]}> = ({data, mock, initialCrop, initialPriorities}) => {
  const n = useNext(data, initialCrop, initialPriorities);
  return (
    <>
      <nav className="nm-switch" aria-label="Mockups">
        <span>Mockup</span>
        {(Object.keys(MOCKS) as MockId[]).map((id) => (
          <a key={id} href={`#/county/${data.fips}/next?mock=${id}`} aria-current={id === mock ? 'page' : undefined}>
            {id.toUpperCase()} · {MOCKS[id]}
          </a>
        ))}
        <a href={`#/county/${data.fips}/next`}>Current</a>
      </nav>
      {mock === 'a' ? <MockStage data={data} n={n} /> : mock === 'b' ? <MockMapCards data={data} n={n} /> : <MockBento data={data} n={n} />}
    </>
  );
};
