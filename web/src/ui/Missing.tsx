import "./ui.css";

/** Dato faltante: siempre escrito, nunca un hueco, un cero ni un guion. */
export function Missing({ what, inline = false }: { what: string; inline?: boolean }) {
  return (
    <span className={inline ? "missing missing--inline" : "missing"}>
      <b>Missing data</b>
      {what ? <span>: {what}</span> : null}
    </span>
  );
}

/** Sello para bloques con datos de prueba. */
export function PrototypeStamp() {
  return <span className="stamp">Prototype data</span>;
}
