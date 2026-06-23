import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./context/AuthContext";
import { getHomePathForRole, type Role } from "./services/auth";

import Login from "./pages/Login";
import Conserje from "./pages/Conserje";
import DashboardConserje from "./components/DashboardConserje";
import Residente from "./pages/Residente";
import HistorialEncomiendas from "./pages/HistorialEncomiendas";
import Claims from "./pages/Claims";
import Admin from "./pages/Admin";
import AdminEmails from "./pages/AdminEmails";
import AdminLogs from "./pages/AdminLogs";
import MainLayout from "./layouts/MainLayout";

type ProtectedRouteProps = {
  allowedRole: Role;
  children: ReactNode;
};

const ProtectedRoute = ({ allowedRole, children }: ProtectedRouteProps) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (user.role !== allowedRole) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1f1f1f] px-6 text-center text-white">
        <div className="max-w-md rounded-xl border border-red-500/30 bg-red-500/10 p-6">
          <p className="text-sm font-semibold uppercase text-red-200">403</p>
          <h1 className="mt-2 text-xl font-semibold">Acceso denegado</h1>
          <p className="mt-2 text-sm text-red-100">
            Esta vista requiere rol {allowedRole}. Tu sesión actual es {user.role}.
          </p>
        </div>
      </div>
    );
  }

  return <MainLayout>{children}</MainLayout>;
};

const App = () => {
  const { user, isCheckingSession } = useAuth();
  const defaultAuthenticatedRoute = user ? getHomePathForRole(user.role) : "/";

  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1f1f1f] px-6 text-center text-white">
        <p className="text-sm text-gray-300">
          Validando sesion activa...
        </p>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          user ? (
            <Navigate to={defaultAuthenticatedRoute} replace />
          ) : (
            <Login />
          )
        }
      />

      <Route
        path="/conserje"
        element={
          <ProtectedRoute allowedRole="conserje">
            <DashboardConserje />
          </ProtectedRoute>
        }
      />

      <Route
        path="/conserje/registrar"
        element={
          <ProtectedRoute allowedRole="conserje">
            <Conserje />
          </ProtectedRoute>
        }
      />

      <Route
        path="/conserje/historial"
        element={
          <ProtectedRoute allowedRole="conserje">
            <HistorialEncomiendas />
          </ProtectedRoute>
        }
      />

      <Route
        path="/conserje/reclamos"
        element={
          <ProtectedRoute allowedRole="conserje">
            <Claims />
          </ProtectedRoute>
        }
      />

      <Route
        path="/residente"
        element={
          <ProtectedRoute allowedRole="residente">
            <HistorialEncomiendas />
          </ProtectedRoute>
        }
      />

      <Route
        path="/residente/mis-encomiendas"
        element={
          <ProtectedRoute allowedRole="residente">
            <Residente />
          </ProtectedRoute>
        }
      />

      <Route
        path="/residente/reclamos"
        element={
          <ProtectedRoute allowedRole="residente">
            <Claims />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRole="administrador">
            <Admin />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/correos"
        element={
          <ProtectedRoute allowedRole="administrador">
            <AdminEmails />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/logs"
        element={
          <ProtectedRoute allowedRole="administrador">
            <AdminLogs />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/reclamos"
        element={
          <ProtectedRoute allowedRole="administrador">
            <Claims />
          </ProtectedRoute>
        }
      />

      <Route
        path="*"
        element={<Navigate to={defaultAuthenticatedRoute} replace />}
      />
    </Routes>
  );
};

export default App;
