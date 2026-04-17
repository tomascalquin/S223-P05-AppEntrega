import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { getHomePathForRole } from "./services/auth";

import Login from "./pages/Login";
import Conserje from "./pages/Conserje";
import Residente from "./pages/Residente";
import HistorialEncomiendas from "./pages/HistorialEncomiendas";
import MainLayout from "./layouts/MainLayout";

const App = () => {
  const { user } = useAuth();
  const defaultAuthenticatedRoute = user ? getHomePathForRole(user.role) : "/";

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
          user?.role === "conserje" ? (
            <MainLayout>
              <Conserje />
            </MainLayout>
          ) : (
            <Navigate to={defaultAuthenticatedRoute} replace />
          )
        }
      />

      <Route
        path="/conserje/historial"
        element={
          user?.role === "conserje" ? (
            <MainLayout>
              <HistorialEncomiendas />
            </MainLayout>
          ) : (
            <Navigate to={defaultAuthenticatedRoute} replace />
          )
        }
      />

      <Route
        path="/residente"
        element={
          user?.role === "residente" ? (
            <MainLayout>
              <HistorialEncomiendas />
            </MainLayout>
          ) : (
            <Navigate to={defaultAuthenticatedRoute} replace />
          )
        }
      />

      <Route
        path="/residente/mis-encomiendas"
        element={
          user?.role === "residente" ? (
            <MainLayout>
              <Residente />
            </MainLayout>
          ) : (
            <Navigate to={defaultAuthenticatedRoute} replace />
          )
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
