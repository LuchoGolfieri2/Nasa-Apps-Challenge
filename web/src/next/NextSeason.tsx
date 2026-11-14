/**
 * Pantalla 3 — "Next season" (F21, F22, F23, F24).
 *
 * Cada bloque tiene su color para que se distinga de un vistazo:
 *   controles = verde oscuro · sugerencia = tarjeta clara · gemelos = azul (como el mapa) ·
 *   beneficios = verde · riesgos = rojo · faltantes = gris rayado.
 *
 * Jerarquía fija (de arriba hacia abajo):
 *   1. Rotación actual (chips) + prioridades (multi-selección)
 *   2. Frase sugerida con 2 razones y confianza
 *   3. Tres opciones en filas, con barras p10–p90 en un eje común (% de un año habitual; bu/acre como dato secundario)
 *   4. Beneficios / riesgos (Model · Rule) y lo que falta
 * A la derecha: mapa chico con arcos a los condados gemelos.
 *
 * Uso:  <NextSeason data={json} onYearClick={(y) => navigate(`#/county/${fips}?year=${y}`)} />
 */
import React, {useMemo, useState} from 'react';
import {Confidence, Missing, ModelRuleTag, PrototypeStamp, SourceChip} from './bits';
import {asPercentOfUsual, commonAxis, suggest} from './suggest';
import {TwinArcs} from './TwinArcs';
import {CROP_COLOR, CROP_LABEL} from '../ui/crops';
import {PRIORITY_LABEL} from './types';
import type {CropId, NextData, NextOption, Priority} from './types';
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

export interface NextSeasonProps {
  data: NextData;
  initialPriorities?: Priority[];
  /** F23: clic en un año de una razón → Historia del condado en ese año */
  onYearClick?: (year: number) => void;
}

export const NextSeason: React.FC<NextSeasonProps> = ({data, initialPriorities = ['risk'], onYearClick}) => {
  const [rotationId, setRotationId] = useState(data.default_rotation);
  const [priorities, setPriorities] = useState<Priority[]>(initialPriorities);
  const [focusId, setFocusId] = useState<string | null>(null); // fila que el usuario abrió
  const [twinSel, setTwinSel] = useState<string | null>(null);

  const rotation = data.rotations.find((r) => r.id === rotationId) ?? data.rotations[0];
  const options = rotation.options;
  const result = useMemo(() => suggest(options, priorities), [options, priorities]);
  const axis = useMemo(() => commonAxis(options), [options]);
  const winner = result.winner;
  const focus = options.find((o) => o.id === focusId) ?? winner ?? options[0];
  const twin = data.twins.find((t) => t.fips === twinSel) ?? null;

  const toggle = (p: Priority) => {
    setPriorities((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
    setFocusId(null);
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
        {anyPrototype ? <PrototypeStamp /> : null}
      </header>

      <div className="fr-next-grid">
        <main className="fr-next-main">
          {/* 1 · ROTACIÓN Y PRIORIDADES */}
          <section className="fr-controls">
            <div className="fr-control">
              <h2>
                <Step n={1} /> Your rotation <SourceChip source={rotation.source} />
              </h2>
              <div className="fr-chips" role="radiogroup" aria-label="Your current rotation">
                {data.rotations.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={r.id === rotation.id}
                    className={`fr-chip ${r.id === rotation.id ? 'on' : ''}`}
                    onClick={() => {
                      setRotationId(r.id);
                      setFocusId(null);
                    }}
                  >
                    {r.sequence.map((c, i) => (
                      <React.Fragment key={i}>
                        {i > 0 ? <span className="fr-arrow">→</span> : null}
                        <CropDot crop={c} />
                        {CROP_LABEL[c]}
                      </React.Fragment>
                    ))}
                    <small>{r.share_pct}% of fields</small>
                  </button>
                ))}
              </div>
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
                  <b>{PRIORITY_LABEL[p]}:</b> <Missing>{p === 'income' ? 'costs not loaded yet' : 'not available'}</Missing>. It is not used in the suggestion.
                </p>
              ))}
            </div>
          </section>

          {/* 2 · FRASE SUGERIDA */}
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
                  {winner.is_current ? 'Stay with ' : 'Plant '}
                  <span className="fr-mark" style={{color: CROP_INK[winner.crop] ?? CROP_COLOR[winner.crop], ['--mark' as string]: CROP_COLOR[winner.crop]}}>
                    {winner.label.toLowerCase()}
                  </span>{' '}
                  next season.
                </p>
                <ol className="fr-reasons">
                  {result.reasons.map((r, i) => (
                    <li key={i}>
                      <span className="fr-reason-text">{r.text}</span>
                      <span className="fr-reason-meta">
                        <ModelRuleTag kind={r.kind} />
                        <SourceChip source={r.source} />
                        {r.years.map((y) => (
                          <button key={y} type="button" className="fr-year" onClick={() => goYear(y)} title={`See ${y} in county history`}>
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
                <p>{priorities.length ? 'The priorities you picked cannot be scored yet. All three options stay visible below.' : 'All three options stay visible below, with their ranges.'}</p>
              </div>
            )}
          </section>

          {/* 3 · TRES OPCIONES, EJE COMÚN */}
          <section className="fr-options">
            <div className="fr-options-head">
              <h2>
                <Step n={4} /> Compare the options <small>% of a usual year in this county · low year / typical / high year</small>
              </h2>
              <div className="fr-axis" aria-hidden="true">
                {axis.ticks.map((t) => (
                  <span key={t} className={t === 100 ? 'usual' : ''} style={{left: `${(t / axis.max) * 100}%`}}>
                    {t === 100 ? 'usual year' : `${t}%`}
                  </span>
                ))}
              </div>
            </div>
            {options.map((o) => (
              <OptionRow key={o.id} option={o} max={axis.max} ticks={axis.ticks} suggested={winner?.id === o.id} open={focus.id === o.id} onOpen={() => setFocusId(o.id)} />
            ))}
          </section>

          {/* 4 · BENEFICIOS / RIESGOS Y FALTANTES */}
          <section className="fr-detail">
            <div className="fr-detail-col fr-detail-col--good">
              <h3>
                <CropDot crop={focus.crop} /> {focus.label}: benefits
              </h3>
              <ul>
                {focus.benefits.map((n, i) => (
                  <li key={i}>
                    <span>{n.text}</span> <ModelRuleTag kind={n.kind} /> <SourceChip source={n.source} />
                  </li>
                ))}
              </ul>
            </div>
            <div className="fr-detail-col fr-detail-col--risk">
              <h3>Risks</h3>
              <ul>
                {focus.risks.map((n, i) => (
                  <li key={i}>
                    <span>{n.text}</span> <ModelRuleTag kind={n.kind} /> <SourceChip source={n.source} />
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
            Similar soil and climate. Lines show the ones that back <b>{focus.label.toLowerCase()}</b>.
          </p>
          <div className="fr-twins-map">
            {data.twins.some((t) => t.prototype) ? <PrototypeStamp /> : null}
            <TwinArcs origin={{name: data.name, centroid: data.centroid}} twins={data.twins} highlight={focus.twins} animateKey={focus.id} selected={twinSel} onSelect={setTwinSel} />
          </div>
          <ul className="fr-twins-list">
            {data.twins
              .filter((t) => focus.twins.includes(t.fips))
              .map((t) => (
                <li key={t.fips}>
                  <button type="button" className={twin?.fips === t.fips ? 'on' : ''} onClick={() => setTwinSel(twin?.fips === t.fips ? null : t.fips)}>
                    <b>
                      {t.name}, {t.state}
                    </b>
                    <span>Similar on {t.similar_on.join(' and ')}</span>
                    <span>{t.grew_crop_pct[focus.crop] != null ? `${focus.label} on ${t.grew_crop_pct[focus.crop]}% of fields` : <Missing />}</span>
                    {twin?.fips === t.fips ? (
                      <span className="fr-twins-crops">
                        {(Object.entries(t.grew_crop_pct) as Array<[CropId, number]>).map(([c, v]) => (
                          <em key={c}>
                            <CropDot crop={c} />
                            {CROP_LABEL[c]} {v}%
                          </em>
                        ))}
                        <SourceChip source={t.source} />
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
          </ul>
          {focus.extrapolated ? <p className="fr-twins-warn">This option is seen mostly in distant counties, so confidence is low.</p> : null}
          <p className="fr-disclaimer">Decision support. It does not replace your agronomist.</p>
        </aside>
      </div>
    </div>
  );
};

const OptionRow: React.FC<{option: NextOption; max: number; ticks: number[]; suggested: boolean; open: boolean; onOpen: () => void}> = ({option: o, max, ticks, suggested, open, onOpen}) => {
  const y = asPercentOfUsual(o);
  const pct = (v: number) => `${(v / max) * 100}%`;
  return (
    <button type="button" className={`fr-row ${suggested ? 'suggested' : ''} ${open ? 'open' : ''}`} onClick={onOpen} aria-pressed={open}>
      <span className="fr-row-name">
        <CropDot crop={o.crop} />
        <b>{o.label}</b>
        <small>
          {o.is_current ? 'Your current plan' : 'Alternative'}
          {suggested ? ' · Suggested' : ''}
        </small>
        {o.yield_bu_ac ? (
          <small className="fr-row-abs">
            {o.yield_bu_ac.p10}–{o.yield_bu_ac.p90} bu/acre
          </small>
        ) : null}
      </span>
      <span className="fr-row-bar">
        {ticks.map((t) => (
          <i key={t} className={`fr-row-grid ${t === 100 ? 'usual' : ''}`} style={{left: pct(t)}} />
        ))}
        {y ? (
          <>
            <span className="fr-range" style={{left: pct(y.p10), width: pct(y.p90 - y.p10), background: CROP_COLOR[o.crop]}} />
            <span className="fr-range-num fr-range-num--lo" style={{left: pct(y.p10)}}>
              {y.p10}%
            </span>
            <span className="fr-range-num fr-range-num--hi" style={{left: pct(y.p90)}}>
              {y.p90}%
            </span>
            <span className="fr-median" style={{left: pct(y.median)}}>
              <em>{y.median}%</em>
            </span>
          </>
        ) : (
          <Missing>no usual yield for this county</Missing>
        )}
      </span>
      <span className="fr-row-conf">
        <Confidence level={o.confidence.level} />
        {o.extrapolated ? <small>{o.confidence.reason}</small> : null}
      </span>
    </button>
  );
};
