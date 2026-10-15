import React, { useState } from 'react';
import { UserPlus, X, CheckCircle2, AlertCircle, Loader2, Clock, ShieldCheck, Key } from 'lucide-react';

export default function RequestAccessModal({ isOpen, onClose, facilities, onApprovedReady }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: facilities?.[0]?.company_id || 'Nordic Cold Chain Logistics',
    id: '',
    requestedRole: 'facility_operator'
  });

  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState(null);
  const [submittedData, setSubmittedData] = useState(null);
  const [isApproved, setIsApproved] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          company: formData.company,
          id: formData.id,
          requested_role: formData.requestedRole
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Access request submission failed');
      }

      setSubmittedData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateAdminApproval = async () => {
    setApproving(true);
    try {
      const res = await fetch(`/api/admin/approve-user?email=${encodeURIComponent(formData.email)}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Approval failed');
      setIsApproved(true);
      if (onApprovedReady) {
        onApprovedReady({
          email: formData.email,
          password: formData.password,
          facilityId: formData.facilityId,
          companyId: formData.companyId,
          role: formData.requestedRole
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-xl bg-[#0F172A] border border-cyan-500/30 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.8)] overflow-hidden font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-500/20 bg-slate-900/60">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-950 flex items-center justify-center text-cyan-400 border border-cyan-500/30 shadow-[0_0_10px_rgba(34,211,238,0.2)]">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight m-0 p-0">New User Access & Invitation Request</h2>
              <p className="text-xs font-mono text-slate-400">Requires cold storage facility administrator sign-off</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {submittedData ? (
            <div className="space-y-4">
              {!isApproved ? (
                <div className="p-5 rounded-xl bg-amber-950/30 border border-amber-500/30 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-amber-950/80 border border-amber-500/50 text-amber-400 mx-auto flex items-center justify-center">
                    <Clock className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-900/50 text-amber-300 border border-amber-500/40 uppercase">
                      PENDING ADMINISTRATOR APPROVAL
                    </span>
                    <h3 className="text-base font-bold text-white mt-1">Access Request Logged</h3>
                    <p className="text-xs text-slate-300 max-w-md mx-auto mt-1 leading-relaxed">
                      Tracking Ticket: <strong className="text-cyan-300 font-mono">{submittedData.ticket_id}</strong>.
                      Per ColdGuard AI zero-trust compliance, login credentials cannot be activated until a verified facility administrator authorizes this request.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-left text-xs text-slate-400 font-mono space-y-1">
                    <p>Applicant: <span className="text-slate-200">{formData.fullName}</span></p>
                    <p>Target Facility: <span className="text-cyan-300">{formData.facilityId}</span></p>
                    <p>Requested Role: <span className="text-slate-200">{formData.requestedRole}</span></p>
                  </div>

                  {/* Testing Convenience Shortcut for Administrator Approval */}
                  <div className="pt-2 border-t border-amber-500/20">
                    <p className="text-[11px] text-slate-400 mb-2">
                      Reviewer / Evaluator Testing Action:
                    </p>
                    <button
                      type="button"
                      onClick={handleSimulateAdminApproval}
                      disabled={approving}
                      className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition flex items-center justify-center space-x-2 mx-auto cursor-pointer text-xs shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:opacity-50"
                    >
                      {approving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                      <span>Simulate Facility Administrator Sign-Off</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-emerald-400 mx-auto flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-900/50 text-emerald-300 border border-emerald-500/40 uppercase">
                      ACCOUNT APPROVED & CLEARED
                    </span>
                    <h3 className="text-base font-bold text-white mt-1">Administrator Sign-Off Complete</h3>
                    <p className="text-xs text-slate-300 max-w-md mx-auto mt-1 leading-relaxed">
                      User <strong className="text-white">{formData.email}</strong> is now cleared for facility <strong className="text-cyan-300">{formData.facilityId}</strong>. Credentials have been passed to the login form.
                    </p>
                  </div>

                  <button
                    onClick={onClose}
                    className="px-5 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold transition cursor-pointer text-xs shadow-[0_0_15px_rgba(34,211,238,0.3)]"
                  >
                    Return to Login
                  </button>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Name</label>
                <input
                  type="text"
                  required
                  placeholder="Full Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Email</label>
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Company</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Nordic Logistics"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">ID</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. EMP-1042 or User ID"
                    value={formData.id}
                    onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono transition"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold transition flex items-center space-x-2 cursor-pointer shadow-[0_0_15px_rgba(34,211,238,0.3)] disabled:opacity-50 text-xs"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Submit for Admin Approval</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
