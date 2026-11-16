import { useEffect, useState } from "react";

/*
  Rutas por hash, para poder abrir cualquier pantalla (y cualquier toma del video) directo:
    #/                         portada (logo + Start)
    #/map                      globo
    #/state/KS                 mapa del estado
    #/map/20191                condado elegido en el mapa (panel)
    #/county/20191?year=2021   historia del condado
    #/county/20191/next        próxima campaña
    #/sources                  fuentes y límites
    #/farm                     My Farm (tablero, o el formulario si no hay campo guardado)
    #/farm/edit                My Farm, editar
    #/depto/06007              departamento de Argentina (id_depto INDEC): la "historia" de los departamentos
*/
export type Route =
  | { name: "home" }
  | { name: "map"; fips: string | null }
  | { name: "state"; state: string }
  | { name: "county"; fips: string }
  | { name: "next"; fips: string }
  | { name: "sources" }
  | { name: "farm"; edit: boolean }
  | { name: "depto"; id: string }
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
  if (parts.length === 0) route = { name: "home" };
  else if (parts[0] === "map" && parts.length === 1) route = { name: "map", fips: null };
  else if (parts[0] === "map" && /^\d{5}$/.test(parts[1] ?? "") && parts.length === 2) route = { name: "map", fips: parts[1] };
  else if (parts[0] === "state" && parts[1] && parts.length === 2) route = { name: "state", state: parts[1].toUpperCase() };
  else if (parts[0] === "county" && /^\d{5}$/.test(parts[1] ?? "")) {
    if (parts.length === 2) route = { name: "county", fips: parts[1] };
    else if (parts[2] === "next" && parts.length === 3) route = { name: "next", fips: parts[1] };
  } else if (parts[0] === "sources" && parts.length === 1) route = { name: "sources" };
  else if (parts[0] === "farm" && parts.length === 1) route = { name: "farm", edit: false };
  else if (parts[0] === "farm" && parts[1] === "edit" && parts.length === 2) route = { name: "farm", edit: true };
  else if (parts[0] === "depto" && /^\d{5}$/.test(parts[1] ?? "") && parts.length === 2) route = { name: "depto", id: parts[1] };
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
