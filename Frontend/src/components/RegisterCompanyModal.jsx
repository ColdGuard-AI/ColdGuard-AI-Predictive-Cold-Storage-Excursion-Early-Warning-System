import React, { useState } from 'react';
import { Building2, X, CheckCircle2, AlertCircle, Loader2, Thermometer, ShieldCheck } from 'lucide-react';

export default function RegisterCompanyModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    companyName: '',
    companyId: '',
    businessType: 'Commercial Cold Storage & 3PL Logistics',
    facilityId: '',
    facilityName: '',
    targetTempC: -22.0,
    adminName: '',
    adminEmail: '',
    adminPassword: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successData, setSuccessData] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/register-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: formData.companyName,
          company_id: formData.companyId,
          business_type: formData.businessType,
          facility_id: formData.facilityId,
          facility_name: formData.facilityName,
          target_temp_c: Number(formData.targetTempC),
          admin_name: formData.adminName,
          admin_email: formData.adminEmail,
          admin_password: formData.adminPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Registration failed');
      }

      setSuccessData(data);
      if (onSuccess) {
        onSuccess({
          email: formData.adminEmail,
          password: formData.adminPassword,
          facilityId: formData.facilityId,
          companyId: formData.companyId,
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-2xl bg-[#0F172A] border border-cyan-500/30 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.8)] overflow-hidden font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-500/20 bg-slate-900/60">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-950 flex items-center justify-center text-cyan-400 border border-cyan-500/30 shadow-[0_0_10px_rgba(34,211,238,0.2)]">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight m-0 p-0">Register New Cold Storage Company</h2>
              <p className="text-xs font-mono text-slate-400">Initialize tenant environment & primary cold facility</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successData ? (
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-emerald-400 mx-auto flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white">Company & Facility Initialized</h3>
              <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                Tenant <strong className="text-cyan-300">{successData.company_id}</strong> and Facility{' '}
                <strong className="text-cyan-300">{successData.facility_id}</strong> are configured. Your administrator credentials have been pre-filled for instant sign-in.
              </p>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-xs text-slate-400 max-w-sm mx-auto">
                <p>Admin Login: <span className="text-slate-200">{successData.admin_email}</span></p>
                <p className="text-emerald-400 mt-1">Status: APPROVED • LEVEL 3 CLEARANCE</p>
              </div>
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 text-slate-950 font-bold hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] transition cursor-pointer text-sm"
              >
                Proceed to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Company Legal Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Cold Logistics Ltd"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Company / Tenant ID</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. COMP-APEX-99"
                    value={formData.companyId}
                    onChange={(e) => setFormData({ ...formData, companyId: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Cold Chain Sector</label>
                <select
                  value={formData.businessType}
                  onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-cyan-400 transition"
                >
                  <option>Commercial Cold Storage & 3PL Logistics</option>
                  <option>BioPharma & Cryogenic Vaccines (-70°C to -20°C)</option>
                  <option>Fresh Seafood & Marine Processing (0°C to 4°C)</option>
                  <option>Agricultural Produce & Floral Controlled Atmosphere</option>
                </select>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2 flex items-center">
                  <Thermometer className="w-3.5 h-3.5 mr-1" /> Primary Facility Configuration
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Facility ID</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. FAC-APEX-01"
                      value={formData.facilityId}
                      onChange={(e) => setFormData({ ...formData, facilityId: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono transition"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Facility Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Apex Central Cryo Vault"
                      value={formData.facilityName}
                      onChange={(e) => setFormData({ ...formData, facilityName: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Target Temp (°C)</label>
                    <input
                      type="number"
                      step="0.5"
                      required
                      placeholder="-22.0"
                      value={formData.targetTempC}
                      onChange={(e) => setFormData({ ...formData, targetTempC: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono transition"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Initial Administrator Credentials
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Admin Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Full Name"
                      value={formData.adminName}
                      onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Admin Email</label>
                    <input
                      type="email"
                      required
                      placeholder="admin@company.com"
                      value={formData.adminEmail}
                      onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Admin Password</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••••••"
                      value={formData.adminPassword}
                      onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end space-x-3">
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
                  <span>Register Company & Facility</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
