import { Eye, LayoutDashboard, Lock, ShieldCheck, UserCog, Wrench } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button, SimulatedBadge } from "../components/ui";
import { homePathFor, useAuth } from "../hooks/AuthContext";

const DEMO_ACCOUNTS = [
  {
    username: "manager",
    password: "manager123",
    title: "Storage Manager",
    icon: LayoutDashboard,
    can: "Facility overview, live monitoring, What-If planning, alerts",
  },
  {
    username: "operator",
    password: "operator123",
    title: "Operator",
    icon: Wrench,
    can: "Live monitoring, sensor history, acknowledge alerts",
  },
  {
    username: "admin",
    password: "admin123",
    title: "Administrator",
    icon: UserCog,
    can: "Everything, plus simulator controls and user roles",
  },
];

export default function Login() {
  const { login, sessionExpired } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const submit = async (u: string, p: string) => {
    setBusy(true);
    setError(null);
    try {
      const user = await login(u, p);
      navigate(homePathFor(user), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Enter a username and password.");
      return;
    }
    void submit(username, password);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4 py-10">
      <div className="w-full max-w-4xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl border border-neon/30 bg-neon/10 shadow-glow">
            <ShieldCheck size={28} className="text-neon" />
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-fg">
            ColdGuard <span className="text-neon">AI</span>
          </h1>
          <p className="mt-1 text-fg-muted">Predict Before It Spoils.</p>
          <div className="mt-3"><SimulatedBadge text="Prototype · Simulated sensor data" /></div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-5">
          <form onSubmit={onSubmit} className="rounded-xl border border-neon/15 bg-ink-800/90 p-6 md:col-span-2" aria-labelledby="signin-title">
            <h2 id="signin-title" className="flex items-center gap-2 text-lg font-semibold text-fg"><Lock size={17} className="text-neon" /> Sign in</h2>
            {sessionExpired && <p className="mt-3 rounded-lg border border-warn/30 bg-warn/5 px-3 py-2 text-xs text-warn">Your session expired. Please sign in again.</p>}
            <label className="mt-5 block text-sm text-fg-muted" htmlFor="username">Username</label>
            <input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-fg focus:border-neon/50 focus:outline-none"
            />
            <label className="mt-4 block text-sm text-fg-muted" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-fg focus:border-neon/50 focus:outline-none"
            />
            {error && <p role="alert" className="mt-3 text-sm text-crit">{error}</p>}
            <Button type="submit" variant="primary" className="mt-5 w-full" loading={busy}>Sign in</Button>
          </form>

          <section className="rounded-xl border border-white/[0.07] bg-ink-800/60 p-6 md:col-span-3" aria-labelledby="demo-title">
            <h2 id="demo-title" className="flex items-center gap-2 text-lg font-semibold text-fg"><Eye size={17} className="text-neon" /> Demo accounts</h2>
            <p className="mt-1 text-xs text-fg-muted">Each role sees different pages and actions. Click to sign in.</p>
            <div className="mt-4 space-y-2.5">
              {DEMO_ACCOUNTS.map(({ username: u, password: p, title, icon: Icon, can }) => (
                <button
                  key={u}
                  type="button"
                  disabled={busy}
                  onClick={() => void submit(u, p)}
                  className="flex w-full items-start gap-3 rounded-lg border border-white/[0.08] bg-ink-900/70 p-3 text-left transition-colors hover:border-neon/35 disabled:opacity-60"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-neon/10 text-neon"><Icon size={17} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium text-fg">{title}</span>
                      <span className="font-mono text-[11px] text-fg-faint">{u} / {p}</span>
                    </span>
                    <span className="block text-xs text-fg-muted">{can}</span>
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-4 text-[11px] text-fg-faint">Demo-grade authentication for the prototype — not production security.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
