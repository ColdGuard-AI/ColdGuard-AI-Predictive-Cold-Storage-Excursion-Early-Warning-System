import React, { useState } from 'react';
import { KeyRound, X, CheckCircle2, AlertCircle, Loader2, ShieldCheck, Mail } from 'lucide-react';

export default function ForgotPasswordModal({ isOpen, onClose, initialEmail }) {
  const [email, setEmail] = useState(initialEmail || '');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-[#0F172A] border border-cyan-500/30 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.8)] overflow-hidden font-sans">
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-500/20 bg-slate-900/60">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-950 flex items-center justify-center text-cyan-400 border border-cyan-500/30">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight m-0 p-0">Password Recovery Protocol</h2>
              <p className="text-xs font-mono text-slate-400">Cryo-Storage Zero-Trust Verification</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {success ? (
            <div className="text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-950 border border-emerald-500 text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Reset Token Dispatched</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                If <strong className="text-white">{email}</strong> exists in the ColdGuard security registry, an authorized facility cryptographic challenge link has been sent to your registered address.
              </p>
              <div className="p-2.5 rounded bg-slate-900 text-[11px] font-mono text-cyan-300 border border-slate-800">
                Security Token: CG-RST-{Math.floor(100000 + Math.random() * 900000)} (Expires in 15m)
              </div>
              <button
                onClick={onClose}
                className="mt-3 px-5 py-2 rounded-lg bg-cyan-400 text-slate-950 font-bold hover:bg-cyan-300 transition text-xs cursor-pointer"
              >
                Return to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <p className="text-slate-300 leading-relaxed">
                Enter your registered corporate email. ColdGuard will verify facility membership before transmitting an encrypted one-time security recovery token.
              </p>
              <div>
                <label className="block text-slate-300 font-medium mb-1">Registered Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    placeholder="name@coldguard.ai"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
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
                  className="px-5 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold transition flex items-center space-x-1.5 cursor-pointer text-xs"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Send Recovery Token</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
