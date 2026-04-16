import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  return (
    <div className="flex w-full items-center justify-between border-b border-white/10 bg-[#252525] p-4 text-white">
      <h1 className="font-bold">EncomBox</h1>

      {user && (
        <div className="flex items-center gap-4">
          <span className="capitalize text-gray-300">{user.role}</span>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-500"
          >
            Volver al login
          </button>
        </div>
      )}
    </div>
  );
};

export default Navbar;
