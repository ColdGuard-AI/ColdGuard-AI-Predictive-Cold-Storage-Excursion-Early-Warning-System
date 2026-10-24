/* ─────────────────────────────────────────────────────────────────────────────
   Manager — User Approval Requests
   Premium Arctic Blue Design System
   Pulls from /api/admin/all-users and /api/admin/review-user
───────────────────────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import {
  CheckCircle2, RefreshCw, Search, UserCheck, UserMinus, UserX, Users, XCircle,
} from "lucide-react";
import { auth } from "../../services/api";

const STATUS_CONFIG: Record<string, { label: string; bg: string; border: string; text: string }> = {
  APPROVED: { label: "Approved", bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-800" },
  ACTIVE: { label: "Active", bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-800" },
  PENDING_APPROVAL: { label: "Pending", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800" },
  REJECTED: { label: "Rejected", bg: "bg-red-50", border: "border-red-200", text: "text-red-800" },
  SUSPENDED: { label: "Suspended", bg: "bg-slate-100", border: "border-slate-200", text: "text-slate-700" },
};

const ROLE_DISPLAY: Record<string, string> = {
  cold_storage_manager: "Cold Storage Manager",
  facility_operator: "Facility Operator",
  government_auditor: "Quality Auditor",
  buyer_retailer: "Buyer / Retailer",
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, bg: "bg-slate-100", border: "border-slate-200", text: "text-slate-700" };
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold shadow-sm ${cfg.bg} ${cfg.border} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

function ConfirmDialog({ title, message, onConfirm, onCancel, confirmLabel = "Confirm", danger = false }: any) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#DCE8F6] bg-white p-7 shadow-2xl">
        <h3 className="font-extrabold text-xl text-[#0F172A] mb-2">{title}</h3>
        <p className="text-base text-[#475569] mb-4 leading-relaxed">{message}</p>
        {danger && (
          <textarea
            className="w-full rounded-xl border border-[#DCE8F6] text-base px-3.5 py-2.5 mb-4 text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25 focus:border-[#2563EB] resize-none font-medium"
            rows={3}
            placeholder="Reason for rejection / suspension (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        )}
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="rounded-xl border border-[#DCE8F6] px-5 py-2.5 text-base font-semibold text-[#475569] hover:bg-slate-50 transition cursor-pointer">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            className={`rounded-xl px-5 py-2.5 text-base font-bold text-white transition shadow-sm cursor-pointer ${
              danger ? "bg-red-600 hover:bg-red-700" : "bg-[#2563EB] hover:bg-[#1D4ED8]"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UserApproval() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionState, setActionState] = useState<{ user: any; action: string } | null>(null);
  const [toast, setToast] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const data = await auth.getAllUsers();
      setUsers(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  }

  async function handleAction(user: any, action: string, reason = "") {
    try {
      await auth.reviewUser({ user_id: user.id, action: action as "approve" | "reject" | "suspend" | "activate", reason });
      showToast(`User ${user.name} ${action}d successfully.`);
      setActionState(null);
      load();
    } catch (e: any) {
      showToast(`Error: ${e?.message}`);
      setActionState(null);
    }
  }

  const filtered = users.filter(u => {
    const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || u.approval_status === statusFilter;
    return matchSearch && matchStatus;
  });

  const pendingCount = users.filter(u => u.approval_status === "PENDING_APPROVAL").length;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] flex items-center gap-3">
            <Users size={28} className="text-[#2563EB]" /> User Access Approval Requests
          </h1>
          <p className="text-base text-[#475569] mt-1 font-medium">Verify credentials, approve registered personnel, and manage role-based permissions.</p>
        </div>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <span className="rounded-full bg-amber-50 border border-amber-200 px-4 py-1.5 text-sm font-extrabold text-amber-800 shadow-sm animate-pulse">
              {pendingCount} Pending Approval
            </span>
          )}
          <button onClick={load} disabled={loading} className="flex items-center gap-2 rounded-xl border border-[#DCE8F6] bg-white px-4 py-2.5 text-sm font-bold text-[#0F172A] hover:bg-[#EFF6FF] hover:border-[#BAE6FD] hover:text-[#2563EB] transition shadow-sm cursor-pointer">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by full name or email address…"
            className="w-full rounded-xl border border-[#DCE8F6] bg-white pl-10 pr-4 py-2.5 text-base font-medium text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25 focus:border-[#2563EB] shadow-sm"
          />
        </div>
        <select
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="rounded-xl border border-[#DCE8F6] bg-white px-4 py-2.5 text-base font-bold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25 focus:border-[#2563EB] shadow-sm cursor-pointer"
        >
          <option value="all">All Approval Statuses</option>
          <option value="PENDING_APPROVAL">Pending Review</option>
          <option value="APPROVED">Approved / Active</option>
          <option value="REJECTED">Rejected</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-[#DCE8F6] bg-white shadow-arctic-card overflow-hidden">
        {error && <div className="px-6 py-4 bg-red-50 border-b border-red-200 text-base font-semibold text-red-800 flex items-center gap-2.5"><XCircle size={18} />{error}</div>}
        {loading ? (
          <div className="py-14 text-center text-base font-medium text-[#475569]">Loading user registry…</div>
        ) : !filtered.length ? (
          <div className="py-14 text-center text-base font-medium text-[#475569]">
            {search || statusFilter !== "all" ? "No users match your search criteria." : "No registered users in the database."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#EFF6FF] border-b border-[#DCE8F6] text-xs sm:text-sm font-bold text-[#475569] uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-5">Personnel</th>
                  <th className="py-3.5 px-5">Requested Role</th>
                  <th className="py-3.5 px-5">Contact Phone</th>
                  <th className="py-3.5 px-5">Registration Date</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5">Audit Details</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id} className="border-b border-[#DCE8F6] hover:bg-slate-50/70 transition">
                    <td className="py-4 px-5">
                      <div className="font-bold text-[#0F172A] text-base">{u.name}</div>
                      <div className="text-sm font-medium text-[#475569]">{u.email}</div>
                    </td>
                    <td className="py-4 px-5 text-base font-semibold text-[#0F172A]">{ROLE_DISPLAY[u.actual_role] ?? u.role_display}</td>
                    <td className="py-4 px-5 text-sm font-mono text-[#0F172A]">{u.phone || <span className="text-slate-400 font-sans">—</span>}</td>
                    <td className="py-4 px-5 text-sm font-medium text-[#475569]">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-4 px-5"><StatusBadge status={u.approval_status} /></td>
                    <td className="py-4 px-5 text-sm text-[#475569]">
                      {u.approved_by ? (
                        <div>
                          <div className="font-semibold text-[#0F172A]">By {u.approved_by}</div>
                          {u.approved_at && <div className="text-xs text-slate-400">{new Date(u.approved_at).toLocaleDateString()}</div>}
                        </div>
                      ) : "—"}
                      {u.rejected_reason && <div className="text-xs text-red-600 font-medium mt-1 truncate max-w-[150px]" title={u.rejected_reason}>↳ {u.rejected_reason}</div>}
                    </td>
                    <td className="py-4 px-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {u.approval_status === "PENDING_APPROVAL" && (
                          <>
                            <button
                              onClick={() => setActionState({ user: u, action: "approve" })}
                              title="Approve Applicant"
                              className="h-9 w-9 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 hover:scale-105 transition shadow-sm cursor-pointer"
                            >
                              <UserCheck size={18} />
                            </button>
                            <button
                              onClick={() => setActionState({ user: u, action: "reject" })}
                              title="Reject Applicant"
                              className="h-9 w-9 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 flex items-center justify-center text-red-700 hover:scale-105 transition shadow-sm cursor-pointer"
                            >
                              <UserX size={18} />
                            </button>
                          </>
                        )}
                        {u.approval_status === "APPROVED" && (
                          <button
                            onClick={() => setActionState({ user: u, action: "suspend" })}
                            title="Suspend User Access"
                            className="h-9 w-9 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center text-[#475569] hover:scale-105 transition shadow-sm cursor-pointer"
                          >
                            <UserMinus size={18} />
                          </button>
                        )}
                        {(u.approval_status === "REJECTED" || u.approval_status === "SUSPENDED") && (
                          <button
                            onClick={() => setActionState({ user: u, action: "activate" })}
                            title="Reactivate Account"
                            className="h-9 w-9 rounded-xl bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-[#BAE6FD] flex items-center justify-center text-[#2563EB] hover:scale-105 transition shadow-sm cursor-pointer"
                          >
                            <CheckCircle2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation dialog */}
      {actionState && (
        <ConfirmDialog
          title={
            actionState.action === "approve" ? `Approve Access for ${actionState.user.name}?` :
            actionState.action === "reject" ? `Reject Application for ${actionState.user.name}?` :
            actionState.action === "suspend" ? `Suspend Access for ${actionState.user.name}?` :
            `Reactivate Account for ${actionState.user.name}?`
          }
          message={
            actionState.action === "approve" ? `This will authorize ${actionState.user.email} to sign in with ${ROLE_DISPLAY[actionState.user.actual_role]} permissions.` :
            actionState.action === "reject" ? `${actionState.user.email} will be blocked from signing in. You may enter an explanation.` :
            actionState.action === "suspend" ? `${actionState.user.email}'s active session and login permissions will be revoked.` :
            `${actionState.user.email}'s access credentials will be restored to active status.`
          }
          confirmLabel={
            actionState.action === "approve" ? "Approve User" :
            actionState.action === "reject" ? "Reject Application" :
            actionState.action === "suspend" ? "Suspend Access" : "Reactivate Account"
          }
          danger={actionState.action === "reject" || actionState.action === "suspend"}
          onConfirm={(reason: string) => handleAction(actionState.user, actionState.action, reason)}
          onCancel={() => setActionState(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl border border-emerald-200 bg-white px-5 py-3 text-base font-bold text-[#0F172A] shadow-2xl flex items-center gap-3">
          <CheckCircle2 size={20} className="text-emerald-600" /> {toast}
        </div>
      )}
    </div>
  );
}
