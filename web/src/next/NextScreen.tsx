import { useEffect, useState } from "react";
import { dataUrl } from "../data/load";
import { Missing } from "../ui/Missing";
import { Icon } from "./icons";
import { NextSeason } from "./NextSeason";
import type { NextData } from "./types";

const STATE_NAME: Record<string, string> = { KS: "Kansas", IA: "Iowa", IL: "Illinois", IN: "Indiana" };

/** Pantalla 3 · Next season (ruta #/county/<fips>/next). Lee data/next/<fips>.json. */
export function NextScreen({ fips }: { fips: string }) {
  const [data, setData] = useState<NextData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(dataUrl(`data/next/${fips}.json`))
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<NextData>;
      })
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [fips]);

  if (failed) {
    return (
      <main className="fr-next">
        <div className="fr-next-empty">
          <h1>Options for next season</h1>
          <Missing what={`the yield model doesn't cover county ${fips} yet (it covers Iowa, Illinois and Indiana; Kansas is not in the model yet)`} />
          <p>
            <a className="btn" href={`#/county/${fips}`}>
              ← Back to the county history
            </a>{" "}
            <a className="btn btn--primary" href="#/county/19169/next">
              See Story County, IA
            </a>
          </p>
        </div>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="fr-next" role="status">
        Loading the options…
      </main>
    );
  }

  return (
    <div className="fr-next-wrap">
      <nav className="ns-top" aria-label="County">
        <a
          className="ns-back solid-btn"
          href={`#/county/${data.fips}`}
          aria-label={`Back to the ${data.name} County history`}
          title={`Back to the ${data.name} County history`}
        >
          <Icon name="back" />
        </a>
        <span className="ns-top-where">
          <b>
            {data.name} County, {STATE_NAME[data.state] ?? data.state}
          </b>
          <span aria-hidden="true"> · </span>Next season
        </span>
      </nav>
      <NextSeason data={data} onYearClick={(y) => (window.location.hash = `#/county/${data.fips}?year=${y}`)} />
    </div>
  );
}
