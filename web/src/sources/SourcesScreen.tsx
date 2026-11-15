import { MODEL_STATES_TEXT } from "../data/states";
import { DATASETS, NASA_USDA_COUNT, NOT_YET } from "./datasets";
import "./sources.css";

/** Pantalla 4 · Fuentes y límites (F25). */
export function SourcesScreen() {
  return (
    <main className="sources">
      <header className="sources__head">
        <p className="sources__eyebrow">Sources &amp; limits</p>
        <h1>Where every number comes from</h1>
        <p className="sources__lead">
          Field Rewind uses <b>{NASA_USDA_COUNT} NASA and USDA datasets</b>. Every number on screen carries a chip with its source.
        </p>
      </header>

      <section className="sources__block" aria-labelledby="ds-title">
        <h2 id="ds-title">Datasets in use</h2>
        <ul className="sources__grid">
          {DATASETS.map((d) => (
            <li key={d.name} className={`ds ds--${d.agency.toLowerCase()}`}>
              <span className="ds__agency">{d.agency === "Other" ? "Reference" : d.agency}</span>
              <h3>{d.name}</h3>
              <p className="ds__gives">{d.gives}</p>
              <dl>
                <div>
                  <dt>Used in</dt>
                  <dd>{d.where}</dd>
                </div>
                <div>
                  <dt>Detail</dt>
                  <dd>{d.detail}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </section>

      <section className="sources__block" aria-labelledby="ny-title">
        <h2 id="ny-title">Not loaded yet</h2>
        <ul className="sources__missing">
          {NOT_YET.map((n) => (
            <li key={n.name}>
              <b>{n.name}.</b> {n.why}
            </li>
          ))}
        </ul>
      </section>

      <section className="sources__block" aria-labelledby="lim-title">
        <h2 id="lim-title">Limits</h2>
        <ul className="sources__limits">
          <li>
            <b>County, not field.</b> All numbers are for the whole county. The crop map is drawn square by square, but it
            doesn't give results for a single field.
          </li>
          <li>
            <b>Associations, not causes.</b> The model learns from county data from 2009 to 2023. Texts say what "tends to"
            happen; they don't prove why.
          </li>
          <li>
            <b>Ranges, not promises.</b> Each option shows a bad year, a typical year and a good year. There is no "chance of
            success".
          </li>
          <li>
            <b>Coverage.</b> The yield model and "Counties like yours" cover {MODEL_STATES_TEXT}. Where corn and soybeans
            are not the main crops (for example Sumner County, KS), only the usual mix has a range.
          </li>
          <li>
            <b>Crop map accuracy.</b> The USDA crop map is right about 9 times out of 10 for corn and soybeans, and less often
            for minor crops.
          </li>
          <li>
            <b>Prototype data.</b> Anything that is a stand-in and not a measurement carries the "Prototype data" mark.
            Real and prototype data are never mixed without it.
          </li>
        </ul>
      </section>

      <section className="sources__note">
        <p>
          Decision support. It does not replace your agronomist. Field Rewind is a NASA Space Apps Challenge 2026 project by
          Team Pepers; it is not an official NASA or USDA product.
        </p>
        <p>
          <a className="btn btn--primary" href="#/county/19169">
            Rewind Story County, IA
          </a>{" "}
          <a className="btn" href="#/map">
            Back to the map
          </a>
        </p>
      </section>
    </main>
  );
}
