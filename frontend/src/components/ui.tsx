import { AlertTriangle, FlaskConical, Info, Inbox, Loader2, RefreshCw } from "lucide-react";
import { useId, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { TONE_BADGE, TONE_DOT } from "../lib/format";

type Tone = keyof typeof TONE_BADGE;

export function Card({
  title,
  icon,
  actions,
  children,
  className = "",
  tip,
  bodyClassName = "",
  tone,
}: {
  title?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  tip?: string;
  bodyClassName?: string;
  tone?: "crit" | "warn";
}) {
  const ring = tone === "crit" ? "border-crit/50 shadow-glow-crit" : tone === "warn" ? "border-warn/40" : "border-cyan-500/20 hover:border-cyan-500/35";
  return (
    <section className={`rounded-xl border bg-slate-900/80 backdrop-blur-md shadow-xl ${ring} flex flex-col min-w-0 transition-all ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2 flex-wrap border-b border-cyan-500/10">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-cyan-300">
            {icon && <span className="text-cyan-400">{icon}</span>}
            {title}
            {tip && <InfoTip text={tip} />}
          </h2>
          {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
        </header>
      )}
      <div className={`px-4 pb-4 flex-1 min-w-0 ${title || actions ? "pt-3.5" : "pt-4"} ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export function Badge({ tone = "neutral", children, dot = false, className = "" }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${TONE_BADGE[tone]} ${className}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[tone]}`} aria-hidden />}
      {children}
    </span>
  );
}

/** Accessible tooltip for technical terms: opens on hover and on keyboard focus. */
export function InfoTip({ text, label = "More information" }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-flex normal-case tracking-normal">
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        className="text-fg-faint hover:text-cyan-400 focus-visible:text-cyan-400 rounded-full transition-colors"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
      >
        <Info size={13} />
      </button>
      {open && (
        <span
          role="tooltip"
          id={id}
          className="absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 rounded-lg border border-cyan-500/30 bg-slate-950/95 px-3 py-2 text-xs font-normal leading-relaxed text-fg shadow-2xl backdrop-blur-md"
        >
          {text}
        </span>
      )}
    </span>
  );
}

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md"; loading?: boolean }) {
  const styles = {
    primary: "bg-cyan-400 text-slate-950 font-bold hover:bg-cyan-300 border-cyan-400 shadow-glow",
    secondary: "bg-slate-900/80 text-slate-200 border-cyan-500/30 hover:border-cyan-400 hover:text-white shadow-sm",
    ghost: "bg-transparent text-slate-400 border-transparent hover:text-white hover:bg-white/5",
    danger: "bg-rose-950/50 text-rose-300 border-rose-500/40 hover:bg-rose-900/50",
  }[variant];
  const sizes = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm";
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${styles} ${sizes} ${className}`}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl border border-cyan-500/25 bg-slate-950/90 p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-3 py-1.5 text-xs font-mono font-bold transition-all cursor-pointer ${
            o.value === value ? "bg-cyan-400 text-slate-950 shadow-sm" : "text-slate-400 hover:text-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function LoadingState({ label = "Loading…", className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-2 py-10 text-sm text-fg-muted ${className}`} role="status">
      <Loader2 size={16} className="animate-spin text-neon" /> {label}
    </div>
  );
}

export function EmptyState({ title, hint, className = "" }: { title: string; hint?: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-1.5 py-10 text-center ${className}`}>
      <Inbox size={22} className="text-fg-faint" />
      <p className="text-sm text-fg-muted">{title}</p>
      {hint && <p className="text-xs text-fg-faint max-w-sm">{hint}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry, className = "" }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={`flex flex-col items-center justify-center gap-2 py-8 text-center ${className}`}>
      <AlertTriangle size={20} className="text-crit" />
      <p className="text-sm text-fg max-w-md">{message}</p>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          <RefreshCw size={13} /> Retry
        </Button>
      )}
    </div>
  );
}

/** Small inline banner shown when polling fails but stale data is still displayed. */
export function StaleBanner({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div role="status" className="mb-3 flex items-center gap-2 rounded-lg border border-warn/30 bg-warn/5 px-3 py-2 text-xs text-warn">
      <AlertTriangle size={14} /> Live update failed — showing last received data. ({error})
    </div>
  );
}

export function SimulatedBadge({ text = "Simulated data" }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-sky/30 bg-sky/10 px-2 py-0.5 text-[11px] font-medium text-sky whitespace-nowrap">
      <FlaskConical size={11} /> {text}
    </span>
  );
}

export function StatusDot({ tone, pulse = false }: { tone: Tone; pulse?: boolean }) {
  return (
    <span className="relative inline-flex h-2.5 w-2.5" aria-hidden>
      {pulse && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-50 ${TONE_DOT[tone]}`} />}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${TONE_DOT[tone]}`} />
    </span>
  );
}

export function Stat({ label, value, sub, tip }: { label: string; value: ReactNode; sub?: ReactNode; tip?: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-fg-faint">
        {label}
        {tip && <InfoTip text={tip} />}
      </div>
      <div className="mt-0.5 font-mono text-base text-fg truncate">{value}</div>
      {sub && <div className="text-xs text-fg-muted">{sub}</div>}
    </div>
  );
}
