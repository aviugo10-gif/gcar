import { ICONS, LOGO_PATHS, type IconName } from "./icons-data";

export function Icon({ name, size, className = "", label }: { name: IconName; size?: "sm" | "lg"; className?: string; label?: string }) {
  return (
    <svg
      className={`gc-ic${size ? ` gc-ic--${size}` : ""} ${className}`}
      viewBox="0 0 24 24"
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      focusable="false"
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  );
}

export function Logo({ className = "", label = "gcar" }: { className?: string; label?: string }) {
  return (
    <svg className={className} viewBox="0 0 752.98 428.8" role="img" aria-label={label} fill="currentColor">
      {LOGO_PATHS.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
export type { IconName };
