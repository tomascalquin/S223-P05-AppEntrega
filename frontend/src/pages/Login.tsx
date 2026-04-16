import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const { login } = useAuth();

  // hook de navegación
  const navigate = useNavigate();

  //  función que combina login + navegación
  const handleLogin = (role: "conserje" | "residente") => {
    login(role);

    // TODO: Integrar con autenticación real que aun no es implementada
    navigate(`/${role}`);
  };

  return (
    // Fondo general
    <div className="min-h-screen bg-[#cfd8c3] flex flex-col items-center justify-center px-4">
      
      {/* HEADER */}
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-green-700 p-3 rounded-xl text-white text-xl">
          📦
        </div>
        <div>
          <h1 className="text-xl font-bold text-green-900">EncomBox</h1>
          <p className="text-sm text-green-800">Gestión de encomiendas</p>
        </div>
      </div>

      {/* CARD PRINCIPAL */}
      <div className="bg-[#2b2b2b] text-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        
        {/* Título */}
        <h2 className="text-2xl font-semibold mb-2">Bienvenido</h2>

        {/* Descripción */}
        <p className="text-gray-300 mb-4">
          Selecciona tu rol para continuar con tu cuenta institucional.
        </p>

        {/* Badge */}
        <div className="bg-[#dce4d1] text-green-800 px-4 py-2 rounded-lg text-sm mb-6 text-center">
          🔒 Autenticación SSO segura
        </div>

        {/* Separador */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 h-px bg-gray-500" />
          <span className="text-green-400 text-sm">Ingresa como</span>
          <div className="flex-1 h-px bg-gray-500" />
        </div>

        {/* OPCIÓN CONSERJE */}
        <button
          onClick={() => login("conserje")}
          className="w-full flex items-center justify-between bg-[#333] hover:bg-[#3a3a3a] p-4 rounded-xl mb-3 transition"
        >
          <div className="flex items-center gap-3">
            <div className="bg-green-200 text-green-800 p-2 rounded-lg">
              ⬜
            </div>
            <div className="text-left">
              <p className="text-green-400 font-semibold">Conserje</p>
              <p className="text-sm text-gray-400">
                Gestiona y registra encomiendas
              </p>
            </div>
          </div>
          <span className="text-gray-400">→</span>
        </button>

        {/* OPCIÓN RESIDENTE */}
        <button
          onClick={() => login("residente")}
          className="w-full flex items-center justify-between bg-[#333] hover:bg-[#3a3a3a] p-4 rounded-xl transition"
        >
          <div className="flex items-center gap-3">
            <div className="bg-blue-200 text-blue-800 p-2 rounded-lg">
              🏠
            </div>
            <div className="text-left">
              <p className="text-blue-400 font-semibold">Residente</p>
              <p className="text-sm text-gray-400">
                Revisa y retira tus paquetes
              </p>
            </div>
          </div>
          <span className="text-gray-400">→</span>
        </button>
      </div>

      {/* FOOTER */}
      <div className="mt-6 flex gap-3">
        <button className="bg-green-700 text-white px-4 py-1 rounded-full text-sm">
          Español
        </button>
        <button className="border border-green-700 text-green-800 px-4 py-1 rounded-full text-sm">
          English
        </button>
      </div>

      <p className="mt-4 text-sm text-green-900">
        EncomBox · Edificios inteligentes
      </p>
    </div>
  );
};

export default Login;