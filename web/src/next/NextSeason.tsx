/**
 * Pantalla 3 — "Next season" (F21, F22, F23, F24), con datos reales de ML y del CDL.
 *
 * Cada bloque tiene su color para que se distinga de un vistazo:
 *   controles = verde oscuro · sugerencia = tarjeta clara · gemelos = azul (como el mapa) ·
 *   beneficios = verde · riesgos = rojo · faltantes = gris rayado.
 *
 * Jerarquía fija (de arriba hacia abajo):
 *   1. Qué vas a sembrar (maíz o soja), con la mezcla de rotaciones del condado (CDL)
 *   2. Prioridades (multi-selección)
 *   3. Frase sugerida con 2 razones y confianza
 *   4. Tres opciones (habitual, rotar, repetir) con barras p10–p90 en un eje común en bu/acre
 *   5. Beneficios / riesgos (Model · Rule) y lo que falta
 * A la derecha: condados gemelos de la opción elegida, en un mapa con arcos, y cultivos nuevos para explorar.
 *
 * Uso:  <NextSeason data={json} onYearClick={(y) => navigate(`#/county/${fips}?year=${y}`)} />
 */
import React, {useMemo, useState} from 'react';
import {Confidence, Missing, ModelRuleTag, PrototypeStamp, SourceChip} from './bits';
import {commonAxis, suggest} from './suggest';
import {TwinGlobe} from './TwinGlobe';
import {CROP_COLOR, CROP_LABEL} from '../ui/crops';
import {PRIORITY_LABEL} from './types';
import type {CropId, NextData, NextOption, PlanCrop, Priority} from './types';
import './next.css';

const PRIORITIES: Priority[] = ['risk', 'income', 'soil', 'water'];

const Step: React.FC<{n: number}> = ({n}) => (
  <span className="fr-step" aria-hidden="true">
    {n}
  </span>
);

const CropDot: React.FC<{crop: CropId}> = ({crop}) => <i className="fr-cropdot" style={{background: CROP_COLOR[crop]}} />;

/** Colores de cultivo más oscuros, para texto grande sobre la tarjeta clara de la sugerencia (contraste AA) */
const CROP_INK: Partial<Record<CropId, string>> = {corn: '#8a5a00', soy: '#0f7a55', wheat: '#b01f52', sorghum: '#5b35d5'};

const fmt = (v: number) => Math.round(v).toString();
const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(Math.round(v))}`;

export interface NextSeasonProps {
  data: NextData;
  initialPriorities?: Priority[];
  /** F23: clic en un año de una razón → Historia del condado en ese año */
  onYearClick?: (year: number) => void;
}

export const NextSeason: React.FC<NextSeasonProps> = ({data, initialPriorities = ['risk'], onYearClick}) => {
  const [crop, setCrop] = useState<PlanCrop>(data.default_crop);
  const [priorities, setPriorities] = useState<Priority[]>(initialPriorities);
  const [focusId, setFocusId] = useState<string | null>(null); // fila que el usuario abrió
  const [twinSel, setTwinSel] = useState<string | null>(null);

  const plan = data.crops[crop];
  const options = plan.options;
  const result = useMemo(() => suggest(options, priorities), [options, priorities]);
  const axis = useMemo(() => commonAxis(options), [options]);
  const winner = result.winner;
  const focus = options.find((o) => o.id === focusId) ?? winner ?? options[0];
  const usual = options.find((o) => o.is_current)?.yield_bu_ac?.median ?? null;
  const twinById = useMemo(() => Object.fromEntries(data.twins.map((t) => [t.fips, t])), [data.twins]);
  const focusTwins = focus.twins.map((f) => twinById[f]).filter(Boolean);
  const twin = twinSel ? twinById[twinSel] ?? null : null;
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
  const goYear = (year: number) => (onYearClick ? onYearClick(year) : (window.location.hash = `#/county/${data.fips}?year=${year}`));
  const anyPrototype = data.prototype || options.some((o) => o.prototype);

  return (
    <div className="fr-next">
      <header className="fr-next-head">
        <div>
          <div className="fr-eyebrow">Next season</div>
          <h1>
            {data.name} County, {data.state}
          </h1>
        </div>
        {anyPrototype ? <PrototypeStamp /> : <SourceChip source="Field Rewind model · 2009–2023" />}
      </header>

      <div className="fr-next-grid">
        <main className="fr-next-main">
          {/* 1 · CULTIVO Y 2 · PRIORIDADES */}
          <section className="fr-controls">
            <div className="fr-control">
              <h2>
                <Step n={1} /> What will you plant next season?
              </h2>
              <div className="fr-chips" role="radiogroup" aria-label="Crop for next season">
                {(Object.keys(data.crops) as PlanCrop[]).map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={c === crop} className={`fr-chip ${c === crop ? 'on' : ''}`} onClick={() => pickCrop(c)}>
                    <CropDot crop={c} />
                    {data.crops[c].label}
                  </button>
                ))}
              </div>
              {ctx.items.length ? (
                <p className="fr-control-note">
                  Most common sequences here:{' '}
                  {ctx.items.slice(0, 3).map((it, i) => (
                    <span key={it.label}>
                      {i ? ' · ' : ''}
                      <b>{it.label}</b> {fmt(it.pct)}%
                    </span>
                  ))}{' '}
                  <SourceChip source={ctx.source} />
                </p>
              ) : ctx.text?.[crop] ? (
                <p className="fr-control-note">
                  {ctx.text[crop]} <SourceChip source={ctx.source} />
                </p>
              ) : null}
            </div>
            <div className="fr-control">
              <h2>
                <Step n={2} /> What matters most to you?
              </h2>
              <div className="fr-chips">
                {PRIORITIES.map((p) => (
                  <button key={p} type="button" aria-pressed={priorities.includes(p)} className={`fr-chip ${priorities.includes(p) ? 'on' : ''}`} onClick={() => toggle(p)}>
                    <span className="fr-check" aria-hidden="true">
                      {priorities.includes(p) ? '✓' : '+'}
                    </span>
                    {PRIORITY_LABEL[p]}
                  </button>
                ))}
              </div>
              {result.unscored.map((p) => (
                <p key={p} className="fr-control-note">
                  <b>{PRIORITY_LABEL[p]}:</b> <Missing>{p === 'income' ? 'costs not loaded yet' : 'no data separates these options'}</Missing>. Not used in the suggestion.
                </p>
              ))}
            </div>
          </section>

          {/* 3 · FRASE SUGERIDA */}
          <section className="fr-suggestion" aria-live="polite">
            {winner ? (
              <div key={winner.id + priorities.join()} className="fr-suggestion-in">
                <div className="fr-suggestion-top">
                  <span className="fr-badge">
                    <Step n={3} /> Suggested for your priorities
                  </span>
                  <Confidence level={winner.confidence.level} reason={winner.confidence.reason} />
                </div>
                <p className="fr-sentence">
                  {winner.is_current ? (
                    <>
                      Keep your usual{' '}
                      <span className="fr-mark" style={{color: CROP_INK[crop] ?? CROP_COLOR[crop], ['--mark' as string]: CROP_COLOR[crop]}}>
                        {plan.label.toLowerCase()}
                      </span>{' '}
                      mix.
                    </>
                  ) : (
                    <>
                      Plant{' '}
                      <span className="fr-mark" style={{color: CROP_INK[crop] ?? CROP_COLOR[crop], ['--mark' as string]: CROP_COLOR[crop]}}>
                        {winner.label.toLowerCase()}
                      </span>
                      .
                    </>
                  )}
                </p>
                <ol className="fr-reasons">
                  {result.reasons.map((r, i) => (
                    <li key={i}>
                      <span className="fr-reason-text">{r.text}</span>
                      <span className="fr-reason-meta">
                        <ModelRuleTag kind={r.kind} />
                        <SourceChip source={r.source} />
                        {r.years.map((y) => (
                          <button key={y} type="button" className="fr-year" onClick={() => goYear(y)} title={`See ${y} in the county history`}>
                            {y}
                          </button>
                        ))}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <div className="fr-suggestion-empty">
                <p className="fr-sentence">Pick a priority to get a suggestion.</p>
                <p>{priorities.length ? 'The priorities you picked cannot be scored yet. The three options stay visible below.' : 'The three options stay visible below, with their ranges.'}</p>
              </div>
            )}
          </section>

          {/* 4 · TRES OPCIONES, EJE COMÚN EN BU/ACRE */}
          <section className="fr-options">
            <div className="fr-options-head">
              <h2>
                <Step n={4} /> Compare the options{' '}
                <small>
                  {plan.label} yield in bushels per acre · bad year (low 10%) / typical / good year (top 10%), with this county's weather since 2009
                </small>
              </h2>
              <div className="fr-axis" aria-hidden="true">
                {axis.ticks.map((t) => (
                  <span key={t} style={{left: `${((t - axis.min) / (axis.max - axis.min)) * 100}%`}}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
            {options.map((o) => (
              <OptionRow key={o.id} option={o} axis={axis} usual={usual} suggested={winner?.id === o.id} open={focus.id === o.id} onOpen={() => setFocusId(o.id)} />
            ))}
            {focus.range_driver ? (
              <p className="fr-options-note">
                {focus.range_driver.text} <SourceChip source={focus.range_driver.source_label ?? 'NASA POWER'} />
              </p>
            ) : null}
          </section>

          {/* 5 · BENEFICIOS / RIESGOS Y FALTANTES */}
          <section className="fr-detail">
            <div className="fr-detail-col fr-detail-col--good">
              <h3>
                <CropDot crop={crop} /> {focus.label}: in favor
              </h3>
              <ul>
                {focus.reasons.filter((r) => r.pro).length ? (
                  focus.reasons
                    .filter((r) => r.pro)
                    .map((n, i) => (
                      <li key={i}>
                        <span>{n.text}</span> <ModelRuleTag kind={n.kind} /> <SourceChip source={n.source} />
                      </li>
                    ))
                ) : (
                  <li>Nothing stands out in favor of this option in the data.</li>
                )}
              </ul>
            </div>
            <div className="fr-detail-col fr-detail-col--risk">
              <h3>Risks</h3>
              <ul>
                {focus.reasons
                  .filter((r) => !r.pro)
                  .map((n, i) => (
                    <li key={i}>
                      <span>{n.text}</span> <ModelRuleTag kind={n.kind} /> <SourceChip source={n.source} />
                      {n.years.length ? (
                        <span className="fr-years">
                          {n.years.map((y) => (
                            <button key={y} type="button" className="fr-year" onClick={() => goYear(y)} title={`See ${y} in the county history`}>
                              {y}
                            </button>
                          ))}
                        </span>
                      ) : null}
                    </li>
                  ))}
              </ul>
            </div>
            <div className="fr-detail-col fr-detail-col--missing">
              <h3>Missing</h3>
              <ul>
                {data.missing.map((m, i) => (
                  <li key={i}>
                    <b>{m.what}.</b> {m.why}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </main>

        {/* GEMELOS */}
        <aside className="fr-twins">
          <h2>
            <Step n={5} /> Counties like yours
          </h2>
          <p className="fr-twins-sub">
            Similar soil and weather. Lines show the ones for <b>{focus.label.toLowerCase()}</b>.
          </p>
          <div className="fr-twins-map">
            {data.twins.some((t) => t.prototype) ? <PrototypeStamp /> : null}
            {data.centroid ? (
              <TwinGlobe origin={{fips: data.fips, name: data.name, centroid: data.centroid}} twins={data.twins} highlight={focus.twins} animateKey={focus.id} selected={twinSel} onSelect={setTwinSel} />
            ) : (
              <Missing>county location</Missing>
            )}
          </div>
          {focus.twins_note ? (
            <p className={`fr-twins-note ${focus.twins_note.range ? '' : 'fr-twins-note--weak'}`}>
              {focus.twins_note.text} <Confidence level={focus.twins_note.confidence.level} />
            </p>
          ) : null}
          <ul className="fr-twins-list">
            {focusTwins.map((t) => (
              <li key={t.fips}>
                <button type="button" className={twin?.fips === t.fips ? 'on' : ''} onClick={() => setTwinSel(twin?.fips === t.fips ? null : t.fips)}>
                  <b>
                    {t.name}, {t.state}
                  </b>
                  <span>Similar on {t.similar_on.join(' and ')}</span>
                  {twin?.fips === t.fips ? (
                    <span className="fr-twins-crops">
                      {(Object.entries(t.grew_crop_pct) as Array<[CropId, number]>)
                        .filter(([, v]) => v >= 1)
                        .map(([c, v]) => (
                          <em key={c}>
                            <CropDot crop={c} />
                            {CROP_LABEL[c] ?? c} {fmt(v)}%
                          </em>
                        ))}
                      <SourceChip source={t.source} />
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
          {data.explore.length ? (
            <div className="fr-explore">
              <h3>Something new nearby</h3>
              {data.explore.map((x) => (
                <p key={x.id}>
                  <CropDot crop={x.crop} /> <b>{x.label}:</b> counties like yours that grow it get {fmt(x.range.p10)}–{fmt(x.range.p90)} bu/ac (typical {fmt(x.range.median)}).{' '}
                  <Confidence level={x.confidence.level} />
                </p>
              ))}
              <p className="fr-explore-note">From counties like yours, not from the model. Similar soil and weather doesn&apos;t guarantee the same result.</p>
            </div>
          ) : null}
          <p className="fr-disclaimer">Decision support for the whole county, not a single field. It does not replace your agronomist.</p>
        </aside>
      </div>
    </div>
  );
};

const OptionRow: React.FC<{option: NextOption; axis: {min: number; max: number; ticks: number[]}; usual: number | null; suggested: boolean; open: boolean; onOpen: () => void}> = ({
  option: o,
  axis,
  usual,
  suggested,
  open,
  onOpen,
}) => {
  const y = o.yield_bu_ac;
  const pct = (v: number) => `${((v - axis.min) / (axis.max - axis.min)) * 100}%`;
  return (
    <button type="button" className={`fr-row ${suggested ? 'suggested' : ''} ${open ? 'open' : ''}`} onClick={onOpen} aria-pressed={open}>
      <span className="fr-row-name">
        <CropDot crop={o.crop} />
        <b>{o.label}</b>
        <small>
          {o.sublabel}
          {suggested ? ' · Suggested' : ''}
        </small>
        {y && usual != null && !o.is_current ? <small className="fr-row-abs">{signed(y.median - usual)} bu/ac vs. your usual mix</small> : null}
      </span>
      <span className="fr-row-bar">
        {axis.ticks.map((t) => (
          <i key={t} className="fr-row-grid" style={{left: pct(t)}} />
        ))}
        {usual != null ? <i className="fr-row-grid usual" style={{left: pct(usual)}} title={`Your usual mix: ${fmt(usual)} bu/ac`} /> : null}
        {y ? (
          <>
            <span className="fr-range" style={{left: pct(y.p10), width: `calc(${pct(y.p90)} - ${pct(y.p10)})`, background: CROP_COLOR[o.crop]}} />
            <span className="fr-range-num fr-range-num--lo" style={{left: pct(y.p10)}}>
              {fmt(y.p10)}
            </span>
            <span className="fr-range-num fr-range-num--hi" style={{left: pct(y.p90)}}>
              {fmt(y.p90)}
            </span>
            <span className="fr-median" style={{left: pct(y.median)}}>
              <em>{fmt(y.median)}</em>
            </span>
          </>
        ) : (
          <Missing>no yield range for this option</Missing>
        )}
      </span>
      <span className="fr-row-conf">
        <Confidence level={o.confidence.level} />
        <small className="fr-row-conf-why">{o.confidence.reason}</small>
      </span>
    </button>
  );
};
