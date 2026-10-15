import { useState } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Layout } from "./components/Layout";
import { EmptyState } from "./components/ui";
import { AppProvider } from "./hooks/AppContext";
import { setAuthToken } from "./services/api";

// Dashboard Pages from feature/dashboard
import Alerts from "./pages/Alerts";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import Manager from "./pages/Manager";
import Model from "./pages/Model";
import WhatIf from "./pages/WhatIf";
import Zones from "./pages/Zones";

// Auth Gateway Components from feature/auth-gateway
import SimulatedDataBanner from "./components/SimulatedDataBanner";
import HeroLanding from "./components/HeroLanding";
import VerticalRoleSelector from "./components/VerticalRoleSelector";
import RoleAuthGateway from "./components/RoleAuthGateway";
import RegisterCompanyModal from "./components/RegisterCompanyModal";
import ForgotPasswordModal from "./components/ForgotPasswordModal";

export default function App() {
  const [currentView, setCurrentView] = useState<"landing" | "auth" | "dashboard">(() => {
    const saved = localStorage.getItem("coldguard_session");
    return saved ? "dashboard" : "landing";
  });
  const [selectedRoleId, setSelectedRoleId] = useState("cold_storage_manager");
  const [authSession, setAuthSession] = useState<any>(() => {
    try {
      const saved = localStorage.getItem("coldguard_session");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.token) setAuthToken(parsed.token);
        return parsed;
      }
    } catch {
      // fallback
    }
    return null;
  });

  const [isRegisterCompanyOpen, setIsRegisterCompanyOpen] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  const handleHeroSelectRoleClick = () => {
    const rolesEl = document.getElementById("roles-section");
    if (rolesEl) {
      rolesEl.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleBackToHero = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleRoleCardClick = (roleId: string) => {
    setSelectedRoleId(roleId);
    setCurrentView("auth");
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const handleLoginSuccess = (sessionData: any) => {
    setAuthSession(sessionData);
    if (sessionData?.token) {
      setAuthToken(sessionData.token);
    }
    try {
      localStorage.setItem("coldguard_session", JSON.stringify(sessionData));
    } catch {
      // ignore
    }
    setCurrentView("dashboard");
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const handleLogout = () => {
    setAuthToken(null);
    setAuthSession(null);
    try {
      localStorage.removeItem("coldguard_session");
    } catch {
      // ignore
    }
    setCurrentView("landing");
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  // If user is authenticated, render the full ColdGuard AI Dashboard
  if (currentView === "dashboard" && authSession) {
    return (
      <AppProvider>
        <Layout user={authSession.user} onSignOut={handleLogout}>
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/manager" element={<Manager />} />
              <Route path="/zones" element={<Zones />} />
              <Route path="/history" element={<History />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/what-if" element={<WhatIf />} />
              <Route path="/model" element={<Model />} />
              <Route
                path="*"
                element={
                  <div>
                    <EmptyState title="Page not found" />
                    <p className="text-center">
                      <Link to="/" className="text-neon hover:underline">
                        Back to Live Monitor
                      </Link>
                    </p>
                  </div>
                }
              />
            </Routes>
          </ErrorBoundary>
        </Layout>
      </AppProvider>
    );
  }

  // Otherwise, render Home / Role Selection / Login Gateway
  return (
    <div className="min-h-screen bg-[#0B1220] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      <SimulatedDataBanner />

      {currentView === "landing" && (
        <div className="flex flex-col">
          <HeroLanding
            onSelectRoleClick={handleHeroSelectRoleClick}
            onOpenRegisterCompany={() => setIsRegisterCompanyOpen(true)}
          />
          <VerticalRoleSelector
            onSelectRole={handleRoleCardClick}
            onBack={handleBackToHero}
          />
        </div>
      )}

      {currentView === "auth" && (
        <RoleAuthGateway
          selectedRoleId={selectedRoleId}
          onBackToRoles={() => {
            setCurrentView("landing");
            setTimeout(() => {
              const rolesEl = document.getElementById("roles-section");
              if (rolesEl) rolesEl.scrollIntoView({ behavior: "instant" });
            }, 50);
          }}
          onLoginSuccess={handleLoginSuccess}
          onOpenForgotPassword={() => setIsForgotPasswordOpen(true)}
        />
      )}

      <RegisterCompanyModal
        isOpen={isRegisterCompanyOpen}
        onClose={() => setIsRegisterCompanyOpen(false)}
        onSuccess={() => {
          setIsRegisterCompanyOpen(false);
          const rolesEl = document.getElementById("roles-section");
          if (rolesEl) rolesEl.scrollIntoView({ behavior: "smooth" });
        }}
      />

      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
        initialEmail=""
      />
    </div>
  );
}
