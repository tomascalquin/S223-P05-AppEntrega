import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

import Login from "./pages/Login";
import Conserje from "./pages/Conserje";
import Residente from "./pages/Residente";
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

      <Route
        path="/residente"
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
