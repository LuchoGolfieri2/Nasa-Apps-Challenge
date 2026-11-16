/**
 * My Farm (F29) · rutas #/farm (tablero, o el formulario si todavía no hay campo) y #/farm/edit.
 *
 * El tablero es el CRM de F40 (FarmCrm.tsx): ingreso con el consejo frente a seguir igual por año de clima,
 * quién ya lo hace en el condado, condados gemelos, datos faltantes, rinde del condado y el informe en PDF.
 */
import { useEffect, useState } from "react";
import { FarmCrm } from "./FarmCrm";
import { loadFarm, type Farm } from "./farm";
import { FarmForm } from "./FarmForm";
import "./farm.css";

function useFarm(): Farm | null {
  const [farm, setFarm] = useState(loadFarm);
  useEffect(() => {
    const on = () => setFarm(loadFarm());
    window.addEventListener("fieldrewind:farm", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("fieldrewind:farm", on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return farm;
}

export function FarmScreen({ edit }: { edit: boolean }) {
  const farm = useFarm();
  // con llaves: en Chrome nuevo scrollTo devuelve una Promise, y React la tomaría como función de limpieza
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [edit]);
  if (edit || !farm) {
    return (
      <main className="fm">
        <FarmForm
          initial={farm}
          onSaved={() => (window.location.hash = "#/farm")}
        />
      </main>
    );
  }
  return (
    <main className="fm">
      <FarmCrm farm={farm} />
    </main>
  );
}
