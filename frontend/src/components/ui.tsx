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
  const ring = tone === "crit" ? "border-red-300 ring-2 ring-red-100" : tone === "warn" ? "border-amber-300 ring-2 ring-amber-100" : "border-[#DCE8F6] hover:border-[#BAE6FD]";
  return (
    <section className={`rounded-2xl border bg-white shadow-arctic-card hover:shadow-arctic-hover transition-all flex flex-col min-w-0 ${ring} ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 px-5 py-3.5 flex-wrap border-b border-[#DCE8F6] bg-slate-50/50">
          <h2 className="flex items-center gap-2.5 text-sm font-bold uppercase tracking-wider text-[#0F172A]">
            {icon && <span className="text-[#2563EB]">{icon}</span>}
            {title}
            {tip && <InfoTip text={tip} />}
          </h2>
          {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
        </header>
      )}
      <div className={`p-5 flex-1 min-w-0 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export function Badge({ tone = "neutral", children, dot = false, className = "" }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold whitespace-nowrap shadow-sm ${TONE_BADGE[tone]} ${className}`}>
      {dot && <span className={`h-2 w-2 rounded-full ${TONE_DOT[tone]}`} aria-hidden />}
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
        className="text-slate-400 hover:text-[#2563EB] focus-visible:text-[#2563EB] rounded-full transition-colors"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
      >
        <Info size={14} />
      </button>
      {open && (
        <span
          role="tooltip"
          id={id}
          className="absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 rounded-xl border border-[#DCE8F6] bg-white px-3.5 py-2.5 text-xs font-medium leading-relaxed text-[#0F172A] shadow-xl"
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
    primary: "bg-[#2563EB] text-white font-bold hover:bg-[#1D4ED8] active:bg-[#1E40AF] border-transparent shadow-sm hover:shadow",
    secondary: "bg-white text-[#0F172A] font-semibold border border-[#DCE8F6] hover:bg-[#EFF6FF] hover:border-[#BAE6FD] hover:text-[#2563EB] shadow-sm",
    ghost: "bg-transparent text-[#475569] font-medium border-transparent hover:bg-[#EFF6FF] hover:text-[#2563EB]",
    danger: "bg-red-50 text-red-700 font-semibold border border-red-200 hover:bg-red-100",
  }[variant];
  const sizes = size === "sm" ? "px-3 py-1.5 text-xs rounded-lg" : "px-4 py-2 text-sm rounded-xl";
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`inline-flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${styles} ${sizes} ${className}`}
    >
      {loading && <Loader2 size={15} className="animate-spin" />}
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
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl border border-[#DCE8F6] bg-[#F1F7FF] p-1 shadow-sm">
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
            o.value === value ? "bg-[#2563EB] text-white font-bold shadow-sm" : "text-[#475569] hover:text-[#0F172A] hover:bg-white/60"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function LoadingState({ label = "Loading live telemetry…", className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-2.5 py-12 text-sm font-medium text-[#475569] ${className}`} role="status">
      <Loader2 size={18} className="animate-spin text-[#2563EB]" /> {label}
    </div>
  );
}

export function EmptyState({ title, hint, className = "" }: { title: string; hint?: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 py-12 text-center ${className}`}>
      <div className="h-12 w-12 rounded-2xl bg-[#EFF6FF] border border-[#DCE8F6] flex items-center justify-center text-[#2563EB] shadow-sm">
        <Inbox size={22} />
      </div>
      <p className="text-sm font-bold text-[#0F172A]">{title}</p>
      {hint && <p className="text-xs text-[#475569] max-w-sm">{hint}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry, className = "" }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={`flex flex-col items-center justify-center gap-2.5 py-10 text-center ${className}`}>
      <div className="h-12 w-12 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 shadow-sm">
        <AlertTriangle size={22} />
      </div>
      <p className="text-sm font-semibold text-[#0F172A] max-w-md">{message}</p>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          <RefreshCw size={14} /> Retry
        </Button>
      )}
    </div>
  );
}

/** Small inline banner shown when polling fails but stale data is still displayed. */
export function StaleBanner({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div role="status" className="mb-3 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800 shadow-sm">
      <AlertTriangle size={15} className="text-amber-600 shrink-0" /> Live update failed — showing last cached telemetry. ({error})
    </div>
  );
}

export function SimulatedBadge({ text = "Simulated telemetry" }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#DCE8F6] bg-[#EFF6FF] px-2.5 py-0.5 text-xs font-bold text-[#2563EB] whitespace-nowrap shadow-sm">
      <FlaskConical size={12} /> {text}
    </span>
  );
}

export function StatusDot({ tone, pulse = false }: { tone: Tone; pulse?: boolean }) {
  return (
    <span className="relative inline-flex h-2.5 w-2.5" aria-hidden>
      {pulse && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${TONE_DOT[tone]}`} />}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${TONE_DOT[tone]}`} />
    </span>
  );
}

export function Stat({ label, value, sub, tip }: { label: string; value: ReactNode; sub?: ReactNode; tip?: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[#475569]">
        {label}
        {tip && <InfoTip text={tip} />}
      </div>
      <div className="mt-1 font-mono text-lg font-bold text-[#0F172A] truncate">{value}</div>
      {sub && <div className="text-xs font-medium text-[#475569] mt-0.5">{sub}</div>}
    </div>
  );
}
