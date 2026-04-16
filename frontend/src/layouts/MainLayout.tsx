import type { ReactNode } from "react";
import Navbar from "../components/Navbar";

const MainLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="min-h-screen bg-[#1f1f1f] text-white">
      <Navbar />

      <div className="flex">
        {/* SIDEBAR */}
        <aside className="w-64 bg-[#2a2a2a] p-4">
          <h1 className="mb-6 text-lg font-bold text-green-400">EncomBox</h1>

          <nav className="flex flex-col gap-3">
            <button className="rounded bg-green-600 p-2 text-left">
              Dashboard
            </button>
            <button className="rounded p-2 text-left hover:bg-[#3a3a3a]">
              Encomiendas
            </button>
            <button className="rounded p-2 text-left hover:bg-[#3a3a3a]">
              Notificaciones
            </button>
          </nav>
        </aside>

        {/* CONTENIDO */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
};

export default MainLayout;
