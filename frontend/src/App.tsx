import { Link, Route, Routes } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Layout } from "./components/Layout";
import { EmptyState } from "./components/ui";
import { AppProvider } from "./hooks/AppContext";
import Alerts from "./pages/Alerts";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import Manager from "./pages/Manager";
import Model from "./pages/Model";
import WhatIf from "./pages/WhatIf";
import Zones from "./pages/Zones";

export default function App() {
  return (
    <AppProvider>
      <Layout>
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
                  <p className="text-center"><Link to="/" className="text-neon hover:underline">Back to Live Monitor</Link></p>
                </div>
              }
            />
          </Routes>
        </ErrorBoundary>
      </Layout>
    </AppProvider>
  );
}
