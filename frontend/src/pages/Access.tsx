import { Check, KeyRound, Minus, Users } from "lucide-react";
import { useState } from "react";
import { Card, ErrorState, LoadingState } from "../components/ui";
import { useApp } from "../hooks/AppContext";
import { useAuth } from "../hooks/AuthContext";
import { usePolling } from "../hooks/usePolling";
import { api } from "../services/api";
import type { Role } from "../types/api";

export default function Access() {
  const { user } = useAuth();
  const { notify } = useApp();
  const users = usePolling(api.users, 0);
  const matrix = usePolling(api.roles, 0);
  const [saving, setSaving] = useState<string | null>(null);

  const changeRole = async (username: string, role: Role) => {
    setSaving(username);
    try {
      const updated = await api.setRole(username, role);
      notify("success", `${updated.full_name} is now ${updated.role_label}. The change applies immediately.`);
      await users.refresh();
    } catch (err) {
      notify("error", err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-fg"><KeyRound size={20} className="text-neon" /> Access Control</h1>
        <p className="text-sm text-fg-muted">Who can see and do what. Permissions are enforced by the backend API, not only hidden in the UI.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Users" icon={<Users size={15} />}>
          {users.loading ? <LoadingState /> : users.error ? <ErrorState message={users.error} onRetry={users.refresh} /> : (
            <ul className="divide-y divide-white/[0.06]">
              {users.data?.map((u) => (
                <li key={u.username} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <div className="text-sm font-medium text-fg">{u.full_name} {u.username === user?.username && <span className="text-xs text-fg-faint">(you)</span>}</div>
                    <div className="font-mono text-xs text-fg-faint">{u.username}</div>
                  </div>
                  <select
                    aria-label={`Role for ${u.full_name}`}
                    value={u.role}
                    disabled={saving === u.username || u.username === user?.username}
                    onChange={(e) => void changeRole(u.username, e.target.value as Role)}
                    className="rounded-lg border border-white/10 bg-ink-900 px-2 py-1.5 text-sm text-fg focus:border-neon/40 focus:outline-none disabled:opacity-50"
                  >
                    {matrix.data?.roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-fg-faint">You cannot change your own role. Demo-grade authentication; passwords are hashed (PBKDF2).</p>
        </Card>

        <Card title="Permissions by role" icon={<KeyRound size={15} />}>
          {matrix.loading ? <LoadingState /> : matrix.error ? <ErrorState message={matrix.error} /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-fg-faint">
                    <th className="pb-2 pr-2 font-medium">Permission</th>
                    {matrix.data?.roles.map((r) => <th key={r.id} className="pb-2 text-center font-medium">{r.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {matrix.data?.permissions.map((p) => (
                    <tr key={p.id} className="border-t border-white/[0.05]">
                      <td className="py-2 pr-2 text-fg">{p.label}</td>
                      {matrix.data?.roles.map((r) => (
                        <td key={r.id} className="text-center">
                          {p.roles.includes(r.id)
                            ? <Check size={15} className="inline text-neon" aria-label="allowed" />
                            : <Minus size={15} className="inline text-fg-faint" aria-label="not allowed" />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
