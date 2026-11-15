import { useEffect, useState } from "react";
import { dataUrl } from "../data/load";
import { Missing } from "../ui/Missing";
import { NextSeason } from "./NextSeason";
import type { NextData } from "./types";
import { Icon } from "../ui/Icon";

const STATE_NAME: Record<string, string> = { KS: "Kansas", IA: "Iowa", IL: "Illinois" };

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
          <Missing what={`next-season options are not loaded for county ${fips} yet`} />
          <p>
            <a className="btn" href={`#/county/${fips}`}>
              <Icon name="arrowLeft" size={18} />
              Back to the county history
            </a>{" "}
            <a className="btn btn--primary" href="#/county/20191/next">
              See Sumner County, KS
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
      <nav className="fr-next fr-next--crumbs" aria-label="Breadcrumb" style={{ paddingBottom: 0, minHeight: 0 }}>
        <p className="fr-crumbs">
          <a href={`#/map/${data.fips}`}>
            <Icon name="arrowLeft" size={16} />
            Map
          </a>{" "}
          · <a href={`#/state/${data.state}`}>{STATE_NAME[data.state] ?? data.state}</a>
          <Icon name="caretRight" size={14} className="fr-sep" />
          <a href={`#/county/${data.fips}`}>{data.name} County history</a>
          <Icon name="caretRight" size={14} className="fr-sep" />
          <b>Next season</b>
        </p>
      </nav>
      <NextSeason data={data} onYearClick={(y) => (window.location.hash = `#/county/${data.fips}?year=${y}`)} />
    </div>
  );
}
