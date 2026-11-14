import { Logo } from "../ui/Logo";
import { HistoryScreen } from "../history/HistoryScreen";
import { MapLayer } from "../map/MapLayer";
import { NextScreen } from "../next/NextScreen";
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
        <a className="btn btn--primary" href="#/county/20191">
          Rewind Sumner County, KS
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
              <a href="#/sources">Sources &amp; limits</a>
            </nav>
          </header>

          {route.name === "county" ? (
            <HistoryScreen key={route.fips} fips={route.fips} query={query} />
          ) : route.name === "next" ? (
            <NextScreen key={route.fips} fips={route.fips} />
          ) : route.name === "sources" ? (
            <Pending title="Sources & limits" task="task F25" />
          ) : (
            <Pending title="Page not found" task="check the address" />
          )}
        </div>
      )}
    </>
  );
}
