import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./context/AuthContext";
import { getHomePathForRole, type Role } from "./services/auth";

import Login from "./pages/Login";
import Conserje from "./pages/Conserje";
import Residente from "./pages/Residente";
import HistorialEncomiendas from "./pages/HistorialEncomiendas";
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

  // # Si la sesión existe pero el rol no coincide, enviamos al usuario
  // # a su dashboard real en vez de dejarlo atrapado en una ruta ajena.
  if (user.role !== allowedRole) {
    return <Navigate to={getHomePathForRole(user.role)} replace />;
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
        path="*"
        element={<Navigate to={defaultAuthenticatedRoute} replace />}
      />
    </Routes>
  );
};

export default App;
