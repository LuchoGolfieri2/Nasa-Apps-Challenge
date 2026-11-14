import { useEffect, useState } from "react";

/*
  Rutas por hash, para poder abrir cualquier pantalla (y cualquier toma del video) directo:
    #/                         globo
    #/state/KS                 mapa del estado
    #/county/20191?year=2021   historia del condado
    #/county/20191/next        próxima campaña
    #/sources                  fuentes y límites
*/
export type Route =
  | { name: "globe" }
  | { name: "state"; state: string }
  | { name: "county"; fips: string }
  | { name: "next"; fips: string }
  | { name: "sources" }
  | { name: "notfound" };

export interface Location {
  route: Route;
  query: URLSearchParams;
}

export function parseHash(hash: string): Location {
  const raw = hash.replace(/^#/, "") || "/";
  const [path, search = ""] = raw.split("?");
  const parts = path.split("/").filter(Boolean);
  const query = new URLSearchParams(search);
  let route: Route = { name: "notfound" };
  if (parts.length === 0) route = { name: "globe" };
  else if (parts[0] === "state" && parts[1] && parts.length === 2) route = { name: "state", state: parts[1].toUpperCase() };
  else if (parts[0] === "county" && /^\d{5}$/.test(parts[1] ?? "")) {
    if (parts.length === 2) route = { name: "county", fips: parts[1] };
    else if (parts[2] === "next" && parts.length === 3) route = { name: "next", fips: parts[1] };
  } else if (parts[0] === "sources" && parts.length === 1) route = { name: "sources" };
  return { route, query };
}

export function useLocation(): Location {
  const [loc, setLoc] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setLoc(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return loc;
}

/** Cambia un parámetro de la URL sin sumar una entrada al historial (para el año del deslizador). */
export function replaceQuery(key: string, value: string | null) {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [path, search = ""] = raw.split("?");
  const q = new URLSearchParams(search);
  if (value === null) q.delete(key);
  else q.set(key, value);
  const s = q.toString();
  window.history.replaceState(null, "", `#${path}${s ? `?${s}` : ""}`);
}
