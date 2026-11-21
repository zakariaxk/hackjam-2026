import { motion } from "framer-motion";
import type { ReactNode } from "react";

export const spring = { type: "spring" as const, stiffness: 300, damping: 34, mass: 1 };
export const enter = { duration: 0.45, ease: [0.25, 0.1, 0.3, 1] as [number, number, number, number] };

type Variant = "primary" | "secondary" | "quiet" | "danger";

export function Button({
  children,
  onClick,
  variant = "secondary",
  disabled,
  busy,
  icon,
  className = "",
  full,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: Variant;
  disabled?: boolean;
  busy?: boolean;
  icon?: ReactNode;
  className?: string;
  full?: boolean;
}) {
  const styles: Record<Variant, string> = {
    primary: "bg-accent text-white hover:bg-accent-hover",
    secondary: "bg-fill text-ink hover:bg-fill-strong",
    quiet: "bg-transparent text-link hover:bg-fill",
    danger: "bg-fill text-alert hover:bg-fill-strong",
  };
  return (
    <motion.button
      type="button"
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.15 }}
      onClick={disabled || busy ? undefined : onClick}
      disabled={disabled}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-pill px-5 text-[15px] font-medium tracking-[-0.016em] transition-colors duration-200 ease-apple disabled:cursor-default disabled:opacity-40 ${
        styles[variant]
      } ${full ? "w-full" : ""} ${className}`}
    >
      {busy ? <Spinner /> : icon}
      <span>{children}</span>
    </motion.button>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg className="spinner" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 items-center gap-2.5 text-[13px] text-mute"
    >
      <span className="hidden sm:inline">{label}</span>
      <span
        className={`relative h-[22px] w-[38px] rounded-pill transition-colors duration-300 ease-apple ${
          checked ? "bg-ok" : "bg-fill-strong"
        }`}
      >
        <motion.span
          layout
          transition={spring}
          className="absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.3)]"
          style={{ left: checked ? 18 : 2 }}
        />
      </span>
    </button>
  );
}

export function Dot({ color, pulse }: { color: string; pulse?: boolean }) {
  return (
    <span className="relative inline-flex h-2 w-2">
      {pulse && <span className="pulse-ring" style={{ background: color }} />}
      <span className="relative h-2 w-2 rounded-full" style={{ background: color }} />
    </span>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`glass rounded-panel ${className}`}>{children}</div>;
}
