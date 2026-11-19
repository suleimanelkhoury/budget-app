import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Spinner } from './components/Spinner';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

// ── Route-level code splitting ────────────────
// Each page loads as its own chunk on first visit, so the initial
// bundle stays small (Recharts alone is ~400 kB and only the Charts
// page needs it). Layout stays eager — it renders on every route.
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const BudgetDetailPage = lazy(() =>
  import('./pages/BudgetDetailPage').then((m) => ({
    default: m.BudgetDetailPage,
  })),
);
const ChartsPage = lazy(() =>
  import('./pages/ChartsPage').then((m) => ({ default: m.ChartsPage })),
);
const CalculatorPage = lazy(() =>
  import('./pages/CalculatorPage').then((m) => ({ default: m.CalculatorPage })),
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const LoginPage = lazy(() =>
  import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const RegisterPage = lazy(() =>
  import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage })),
);

/** Full-page fallback shown while a route chunk loads. */
function PageFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spinner />
    </div>
  );
}

/** Wrap a lazy page so navigation keeps the sidebar mounted while the
 * chunk loads (fallback only replaces the routed content). */
function page(element: ReactNode) {
  return <Suspense fallback={<PageFallback />}>{element}</Suspense>;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* ── Public routes ─────────────────── */}
              <Route path="/login" element={page(<LoginPage />)} />
              <Route path="/register" element={page(<RegisterPage />)} />

              {/* ── Protected routes ─────────────── */}
              <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>
                  <Route path="/" element={page(<DashboardPage />)} />
                  <Route
                    path="/budgets/:id"
                    element={page(<BudgetDetailPage />)}
                  />
                  <Route path="/charts" element={page(<ChartsPage />)} />
                  <Route
                    path="/calculator"
                    element={page(<CalculatorPage />)}
                  />
                  <Route path="/settings" element={page(<SettingsPage />)} />
                </Route>
              </Route>

              {/* ── Fallback ─────────────────────── */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
