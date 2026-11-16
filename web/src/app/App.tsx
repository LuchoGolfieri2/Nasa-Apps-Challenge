import { Logo } from "../ui/Logo";
import { HistoryScreen } from "../history/HistoryScreen";
import { MapLayer } from "../map/MapLayer";
import { NextScreen } from "../next/NextScreen";
import { SourcesScreen } from "../sources/SourcesScreen";
import { FarmScreen } from "../farm/FarmScreen";
import { DeptScreen } from "../argentina/DeptScreen";
import { DeptGlass } from "../argentina/DeptGlass";

/** Departamentos con el "See more" nuevo (vidrio sobre el globo, como EE. UU.). Prueba con uno solo. */
const GLASS_DEPTS = new Set(["06623"]);
import { useLocation } from "./router";
import "./app.css";

/** Pantallas que todavía no están: dicen de quién es la tarea, no simulan contenido. */
function Pending({ title, task, children }: { title: string; task: string; children?: React.ReactNode }) {
  return (
    <main className="pending">
      <h1>{title}</h1>
      <p>This screen is being built ({task}).</p>
      {children}
      <p>
        <a className="btn btn--primary" href="#/county/19169">
          Rewind Story County, IA
        </a>
      </p>
    </main>
  );
}

export function App() {
  const { route, query } = useLocation();
  // Pantalla 1 (portada, globo, estado y condado en el mapa) la dibuja MapLayer, que queda siempre montada.
  const onMap = route.name === "home" || route.name === "map" || route.name === "state";

  return (
    <>
      <MapLayer active={onMap} />
      {onMap ? null : (
        <div className="app">
          <header className="topbar">
            <Logo />
            <nav className="topbar__nav" aria-label="Main">
              <a href="#/map">Map</a>
              <a href="#/sources" className="topbar__sources">
                Sources<span className="topbar__long"> &amp; limits</span>
              </a>
              <a href="#/farm" className="topbar__farm" aria-current={route.name === "farm" ? "page" : undefined}>
                My Farm
              </a>
            </nav>
          </header>

          {route.name === "county" ? (
            <HistoryScreen key={route.fips} fips={route.fips} query={query} />
          ) : route.name === "next" ? (
            <NextScreen key={route.fips} fips={route.fips} />
          ) : route.name === "sources" ? (
            <SourcesScreen />
          ) : route.name === "depto" ? (
            GLASS_DEPTS.has(route.id) ? (
              <DeptGlass key={route.id} id={route.id} />
            ) : (
              <DeptScreen key={route.id} id={route.id} />
            )
          ) : route.name === "farm" ? (
            <FarmScreen edit={route.edit} />
          ) : (
            <Pending title="Page not found" task="check the address" />
          )}
        </div>
      )}
    </>
  );
}
