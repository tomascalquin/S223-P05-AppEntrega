import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";

// # Cada rol ve solo las rutas que hoy existen realmente en la aplicación.
const navigationByRole = {
  conserje: [
    { label: "Registrar encomienda", to: "/conserje" },
    { label: "Historial", to: "/conserje/historial" },
  ],
  residente: [
    { label: "Historial de encomiendas", to: "/residente" },
    { label: "Mis encomiendas", to: "/residente/mis-encomiendas" },
  ],
};

const MainLayout = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#1f1f1f] text-white">
      <Navbar />

      <div className="flex">
        {/* SIDEBAR */}
        <aside className="w-64 bg-[#2a2a2a] p-4">
          <h1 className="mb-6 text-lg font-bold text-green-400">EncomBox</h1>

          <nav className="flex flex-col gap-3">
            {/* # Este menú usa rutas reales para que la navegación lateral sí funcione. */}
            {user &&
              navigationByRole[user.role].map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `rounded p-2 text-left transition ${
                      isActive
                        ? "bg-green-600 text-white"
                        : "text-gray-200 hover:bg-[#3a3a3a]"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
          </nav>
        </aside>

        {/* CONTENIDO */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
};

export default MainLayout;
