import { ICON, type IconName } from "./icons";
import "./ui.css";

/**
 * Ícono de Phosphor (o de cultivo) con currentColor.
 * Sin `label` es decorativo (aria-hidden): el texto de al lado ya lo nombra.
 * Con `label` se anuncia como imagen con ese nombre (para botones que solo tienen el ícono).
 */
export function Icon({ name, size = 18, label, className }: { name: IconName; size?: number; label?: string; className?: string }) {
  return (
    <span
      className={className ? `ico ${className}` : "ico"}
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      dangerouslySetInnerHTML={{ __html: ICON[name] }}
    />
  );
}
