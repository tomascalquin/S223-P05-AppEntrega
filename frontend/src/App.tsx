import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

import Login from "./pages/Login";
import Conserje from "./pages/Conserje";
import Residente from "./pages/Residente";
import HistorialEncomiendas from "./pages/HistorialEncomiendas";
import MainLayout from "./layouts/MainLayout";

const App = () => {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Ruta pública */}
      <Route
        path="/"
        element={
          user?.role === "conserje" ? (
            <Navigate to="/conserje" replace />
          ) : user?.role === "residente" ? (
            <Navigate to="/residente" replace />
          ) : (
            <Login />
          )
        }
      />

      {/* Ruta protegida con layout */}
      <Route
        path="/conserje"
        element={
          user?.role === "conserje" ? (
            <MainLayout>
              <Conserje />
            </MainLayout>
          ) : (
            <Navigate to="/" />
          )
        }
      />

      {/* Ruta protegida para que el conserje vea el historial real desde el backend. */}
      <Route
        path="/conserje/historial"
        element={
          user?.role === "conserje" ? (
            <MainLayout>
              <HistorialEncomiendas />
            </MainLayout>
          ) : (
            <Navigate to="/" />
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
            <Navigate to="/" />
          )
        }
      />

      {/* Ruta adicional para que el residente tenga su acceso separado a "Mis encomiendas". */}
      <Route
        path="/residente/mis-encomiendas"
        element={
          user?.role === "residente" ? (
            <MainLayout>
              <Residente />
            </MainLayout>
          ) : (
            <Navigate to="/" />
          )
        }
      />
    </Routes>
  );
};

export default App;
