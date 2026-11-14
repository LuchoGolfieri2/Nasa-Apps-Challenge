import { Logo } from "../ui/Logo";
import { HistoryScreen } from "../history/HistoryScreen";
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

  return (
    <div className="app">
      <header className="topbar">
        <Logo />
        <nav className="topbar__nav" aria-label="Main">
          <a href="#/">Map</a>
          <a href="#/sources">Sources &amp; limits</a>
        </nav>
      </header>

      {route.name === "county" ? (
        <HistoryScreen key={route.fips} fips={route.fips} query={query} />
      ) : route.name === "globe" ? (
        <Pending title="Pick your county" task="map screen, tasks F11–F14" />
      ) : route.name === "state" ? (
        <Pending title={`Counties in ${route.state}`} task="map screen, tasks F11–F14" />
      ) : route.name === "next" ? (
        <Pending title="Options for next season" task="next season screen, tasks F21–F24">
          <p>
            <a href={`#/county/${route.fips}`}>← Back to the county history</a>
          </p>
        </Pending>
      ) : route.name === "sources" ? (
        <Pending title="Sources & limits" task="task F25" />
      ) : (
        <Pending title="Page not found" task="check the address" />
      )}
    </div>
  );
}
