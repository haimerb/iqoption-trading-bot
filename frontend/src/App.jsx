import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store';
import { initSocket, disconnectSocket } from './services/socket';

// MUI Theme
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme/theme';

// Pages
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import StrategiesPage from './pages/StrategiesPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import LogsPage from './pages/LogsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import MLPage from './pages/MLPage.jsx';

// Layout
import MainLayout from './components/layout/MainLayout.jsx';

function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  return !isAuthenticated ? children : <Navigate to="/" replace />;
}

export default function App() {
  const { isAuthenticated, token } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && token) {
      initSocket(token);
    }
    return () => {
      if (!isAuthenticated) disconnectSocket();
    };
  }, [isAuthenticated, token]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Routes>
        <Route path="/login" element={
          <PublicRoute><LoginPage /></PublicRoute>
        } />

        <Route element={
          <PrivateRoute>
            <MainLayout />
          </PrivateRoute>
        }>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/ml" element={<MLPage />} />
          <Route path="/strategies" element={<StrategiesPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ThemeProvider>
  );
}
