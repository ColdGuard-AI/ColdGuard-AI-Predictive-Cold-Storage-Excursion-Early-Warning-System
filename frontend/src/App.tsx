import type { ReactNode } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Layout } from "./components/Layout";
import { EmptyState, LoadingState } from "./components/ui";
import { AppProvider } from "./hooks/AppContext";
import { AuthProvider, homePathFor, useAuth } from "./hooks/AuthContext";
import Access from "./pages/Access";
import Alerts from "./pages/Alerts";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import Login from "./pages/Login";
import Manager from "./pages/Manager";
import Model from "./pages/Model";
import WhatIf from "./pages/WhatIf";
import Zones from "./pages/Zones";
import type { Permission } from "./types/api";

/** Renders the page only if the signed-in user holds the permission. */
function Guard({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { can, user } = useAuth();
  if (can(permission)) return <>{children}</>;
  return (
    <div className="py-10">
      <EmptyState
        title="You don't have access to this page"
        hint={`Signed in as ${user?.full_name} (${user?.role_label}). Ask an administrator if you need access.`}
      />
      <p className="text-center"><Link to={homePathFor(user)} className="text-neon hover:underline">Go to your home page</Link></p>
    </div>
  );
}

function AuthedApp() {
  const { user, checking } = useAuth();
  if (checking) return <div className="min-h-screen bg-ink"><LoadingState label="Restoring session…" /></div>;
  if (!user) return <Login />;
  return (
    <AppProvider>
      <Layout>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Guard permission="view"><Dashboard /></Guard>} />
            <Route path="/manager" element={<Guard permission="manager_overview"><Manager /></Guard>} />
            <Route path="/zones" element={<Guard permission="view"><Zones /></Guard>} />
            <Route path="/history" element={<Guard permission="view"><History /></Guard>} />
            <Route path="/alerts" element={<Guard permission="view"><Alerts /></Guard>} />
            <Route path="/what-if" element={<Guard permission="what_if"><WhatIf /></Guard>} />
            <Route path="/model" element={<Guard permission="model"><Model /></Guard>} />
            <Route path="/access" element={<Guard permission="manage_users"><Access /></Guard>} />
            <Route path="/login" element={<Navigate to={homePathFor(user)} replace />} />
            <Route
              path="*"
              element={
                <div>
                  <EmptyState title="Page not found" />
                  <p className="text-center"><Link to={homePathFor(user)} className="text-neon hover:underline">Back to home</Link></p>
                </div>
              }
            />
          </Routes>
        </ErrorBoundary>
      </Layout>
    </AppProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthedApp />
    </AuthProvider>
  );
}
