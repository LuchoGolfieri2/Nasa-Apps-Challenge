import "./ui.css";

/** Etiqueta de fuente: producto en negrita, después resolución y período. */
export function SourceChip({ source }: { source: string }) {
  const [product, ...rest] = source.split(" · ");
  return (
    <span className="source-chip">
      <b>{product}</b>
      {rest.length ? <span> · {rest.join(" · ")}</span> : null}
    </span>
  );
}
