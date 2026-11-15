/** Ícono de doble flecha "rewind" del equipo (el mismo trazo del prototipo del globo). */
export function RewindMark({ size = 30 }: { size?: number }) {
  const arrow = (dx: number, id: string, fill: string) => (
    <>
      <mask id={id} maskUnits="userSpaceOnUse" x="-10" y="0" width="160" height="100">
        <polygon
          points={`${8 + dx},50 ${58 + dx},10 ${58 + dx},90`}
          fill="#fff"
          stroke="#fff"
          strokeWidth="8"
          strokeLinejoin="round"
        />
        <polygon points={`${19 + dx},45.6 ${64 + dx},27.2 ${64 + dx},32.8`} />
        <polygon points={`${19 + dx},50 ${64 + dx},47.2 ${64 + dx},52.8`} />
        <polygon points={`${19 + dx},54.4 ${64 + dx},67.2 ${64 + dx},72.8`} />
      </mask>
      <rect x="-10" width="160" height="100" fill={fill} mask={`url(#${id})`} />
    </>
  );
  return (
    <svg viewBox="0 0 127 100" height={size} aria-hidden="true">
      {arrow(0, "rw0", "var(--sprout)")}
      {arrow(61, "rw1", "var(--wheat-gold)")}
    </svg>
  );
}

export function Logo() {
  return (
    <a className="logo" href="#/" aria-label="Field Rewind, home">
      <RewindMark />
      <span>
        <span className="logo__field">Field</span> Rewind
      </span>
    </a>
  );
}
