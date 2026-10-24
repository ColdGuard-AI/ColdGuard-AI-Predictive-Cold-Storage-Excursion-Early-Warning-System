/* ─────────────────────────────────────────────────────────────────────────────
   ColdGuard AI — Root Application
   Role-based routing with AuthGateway and RoleLayout.
   Existing pages are preserved and routed to appropriate roles.
───────────────────────────────────────────────────────────────────────────── */
import { useState } from "react";
import { Route, Routes } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AppProvider } from "./hooks/AppContext";
import { setAuthToken } from "./services/api";
import type { AuthSession } from "./pages/AuthGateway";

// Auth gateway
import AuthGateway from "./pages/AuthGateway";

// Role-aware layout
import { RoleLayout } from "./components/RoleLayout";

// ── Existing pages (preserved, mapped to operator routes) ─────────────────────
import Dashboard from "./pages/Dashboard";          // operator: Live Monitor
import DigitalTwin from "./pages/DigitalTwin";      // operator: Digital Twin
import Alerts from "./pages/Alerts";               // shared
import AIExplanation from "./pages/AIExplanation";  // operator: AI/SOP
import ExcursionMonitor from "./pages/ExcursionMonitor";
import BlockchainAudit from "./pages/BlockchainAudit"; // auditor: Blockchain
import Reports from "./pages/Reports";              // auditor: Reports
import WhatIf from "./pages/WhatIf";

// ── Manager pages ─────────────────────────────────────────────────────────────
import ManagerOverview from "./pages/manager/ManagerOverview";
import UserApproval from "./pages/manager/UserApproval";
import InventoryRisk from "./pages/manager/InventoryRisk";
import ManagerAssistant from "./pages/manager/ManagerAssistant";

// ── Operator pages ────────────────────────────────────────────────────────────
import EquipmentHealth from "./pages/operator/EquipmentHealth";
import WorkOrders from "./pages/operator/WorkOrders";

// ── Auditor pages ─────────────────────────────────────────────────────────────
import AuditorCompliance from "./pages/auditor/AuditorCompliance";

// ── Buyer pages ───────────────────────────────────────────────────────────────
import BuyerOrders from "./pages/buyer/BuyerOrders";

// ── 404 ───────────────────────────────────────────────────────────────────────
function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-slate-500 gap-3">
      <div className="text-5xl font-bold text-slate-200">404</div>
      <p className="text-sm">Page not found.</p>
    </div>
  );
}

// ── Role route trees ──────────────────────────────────────────────────────────
function ManagerRoutes() {
  return (
    <Routes>
      <Route path="/" element={<ManagerOverview />} />
      <Route path="/alerts" element={<Alerts />} />
      <Route path="/inventory" element={<InventoryRisk />} />
      <Route path="/users" element={<UserApproval />} />
      <Route path="/assistant" element={<ManagerAssistant />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function OperatorRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/twin" element={<DigitalTwin />} />
      <Route path="/equipment" element={<EquipmentHealth />} />
      <Route path="/alerts" element={<WorkOrders />} />
      <Route path="/ai" element={<AIExplanation />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function AuditorRoutes() {
  return (
    <Routes>
      <Route path="/" element={<AuditorCompliance />} />
      <Route path="/blockchain" element={<BlockchainAudit />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function BuyerRoutes() {
  return (
    <Routes>
      <Route path="/" element={<BuyerOrders />} />
      <Route path="/inventory" element={<BuyerOrders />} />
      <Route path="/quality" element={<Alerts />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

// ── Authenticated dashboard shell ─────────────────────────────────────────────
function AuthenticatedApp({ session, onSignOut }: { session: AuthSession; onSignOut: () => void }) {
  const role = session.user.actual_role;
  return (
    <AppProvider>
      <RoleLayout session={session} onSignOut={onSignOut}>
        <ErrorBoundary>
          <Routes>
            {/* Manager routes */}
            <Route path="/manager/*" element={<ManagerRoutes />} />
            {/* Operator routes */}
            <Route path="/operator/*" element={<OperatorRoutes />} />
            {/* Auditor routes */}
            <Route path="/auditor/*" element={<AuditorRoutes />} />
            {/* Buyer routes */}
            <Route path="/buyer/*" element={<BuyerRoutes />} />

            {/* Default redirect by role */}
            <Route
              path="/"
              element={
                role === "cold_storage_manager" ? <ManagerOverview /> :
                role === "facility_operator" ? <Dashboard /> :
                role === "government_auditor" ? <AuditorCompliance /> :
                role === "buyer_retailer" ? <BuyerOrders /> :
                <Dashboard />
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </RoleLayout>
    </AppProvider>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState<AuthSession | null>(() => {
    try {
      const saved = localStorage.getItem("coldguard_session");
      if (saved) {
        const parsed = JSON.parse(saved) as AuthSession;
        if (parsed?.token) setAuthToken(parsed.token);
        // Reject sessions with must_change_password still flagged
        if (parsed?.must_change_password) return null;
        return parsed;
      }
    } catch { /* ignore */ }
    return null;
  });

  function handleLoginSuccess(sessionData: AuthSession) {
    setAuthToken(sessionData.token);
    if (!sessionData.must_change_password) {
      try { localStorage.setItem("coldguard_session", JSON.stringify(sessionData)); } catch { /* ignore */ }
    }
    setSession(sessionData);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function handleLogout() {
    setAuthToken(null);
    setSession(null);
    try { localStorage.removeItem("coldguard_session"); } catch { /* ignore */ }
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  if (session && !session.must_change_password) {
    return <AuthenticatedApp session={session} onSignOut={handleLogout} />;
  }

  return <AuthGateway onLoginSuccess={handleLoginSuccess} />;
}
