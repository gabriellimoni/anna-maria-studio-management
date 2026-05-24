import { Component, ReactNode } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, Typography } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { useAuth } from './auth/useAuth';
import { AppLayout } from './components/AppLayout';
import { ToastProvider } from './components/ToastProvider';
import { theme } from './theme';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { StudentsListPage } from './features/students/pages/StudentsListPage';
import { StudentFormPage } from './features/students/pages/StudentFormPage';
import { StudentDetailPage } from './features/students/pages/StudentDetailPage';
import { PlanCatalogListPage } from './features/plan-catalog/pages/PlanCatalogListPage';
import { PlanCatalogFormPage } from './features/plan-catalog/pages/PlanCatalogFormPage';
import { PlansListPage } from './features/plans/pages/PlansListPage';
import { PlanCreateWizardPage } from './features/plans/pages/PlanCreateWizardPage';
import { PlanDetailPage } from './features/plans/pages/PlanDetailPage';
import { PlanChangeSchedulePage } from './features/plans/pages/PlanChangeSchedulePage';
import { posthog } from './lib/posthog';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    posthog.captureException(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <Typography>Algo deu errado. Recarregue a página.</Typography>
        </div>
      );
    }
    return this.props.children;
  }
}

function AuthGate() {
  const { firebaseUser, loading } = useAuth();
  if (loading) return null;
  if (!firebaseUser) return <Navigate to="/login" replace />;
  return <AppLayout />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

export function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ToastProvider>
              <BrowserRouter>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />

                  <Route element={<AuthGate />}>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/students" element={<StudentsListPage />} />
                    <Route path="/students/new" element={<StudentFormPage />} />
                    <Route path="/students/:id" element={<StudentDetailPage />} />
                    <Route path="/students/:id/edit" element={<StudentFormPage />} />
                    <Route path="/plan-catalog" element={<PlanCatalogListPage />} />
                    <Route path="/plan-catalog/new" element={<PlanCatalogFormPage />} />
                    <Route path="/plan-catalog/:id/edit" element={<PlanCatalogFormPage />} />
                    <Route path="/plans" element={<PlansListPage />} />
                    <Route path="/plans/new" element={<PlanCreateWizardPage />} />
                    <Route path="/plans/:id" element={<PlanDetailPage />} />
                    <Route path="/plans/:id/change-schedule" element={<PlanChangeSchedulePage />} />
                  </Route>
                </Routes>
              </BrowserRouter>
            </ToastProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
