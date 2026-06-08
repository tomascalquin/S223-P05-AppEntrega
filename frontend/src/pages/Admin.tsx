import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  fetchUsers,
  updateUserRole,
  updateUserEstado,
  deleteUser,
  type AdminUser,
  type UserEstado,
} from "../services/admin";
import type { Role } from "../services/auth";

const ALL_ROLES: Role[] = ["residente", "conserje", "administrador"];

const ROLE_LABELS: Record<Role, string> = {
  residente: "Residente",
  conserje: "Conserje",
  administrador: "Administrador",
};

const ROLE_COLORS: Record<Role, string> = {
  residente: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  conserje: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  administrador: "bg-purple-500/15 text-purple-300 border-purple-500/30",
};

const ESTADO_LABELS: Record<UserEstado, string> = {
  activo: "Activo",
  inactivo: "Inactivo",
  bloqueado: "Bloqueado",
};

const ESTADO_COLORS: Record<UserEstado, string> = {
  activo: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  inactivo: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  bloqueado: "bg-red-500/15 text-red-300 border-red-500/30",
};

type ModalConfirm = {
  tipo: "rol" | "estado" | "eliminar";
  userId: string;
  userName: string;
  valorNuevo?: string;
  mensaje: string;
};

const Admin = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [pendingRole, setPendingRole] = useState<Record<string, Role>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [savedFeedback, setSavedFeedback] = useState<Record<string, boolean>>({});

  const [modal, setModal] = useState<ModalConfirm | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await fetchUsers();
        if (!cancelled) setUsers(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error al cargar usuarios");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, []);

  const handleRoleChange = (userId: string, role: Role) => {
    setPendingRole((prev) => ({ ...prev, [userId]: role }));
    setSavedFeedback((prev) => ({ ...prev, [userId]: false }));
  };

  const solicitarConfirmacionRol = (userId: string, userName: string, nuevoRol: Role) => {
    setModal({
      tipo: "rol",
      userId,
      userName,
      valorNuevo: nuevoRol,
      mensaje: `¿Confirmas cambiar el rol de "${userName}" a "${ROLE_LABELS[nuevoRol]}"?`,
    });
  };

  const solicitarConfirmacionEstado = (userId: string, userName: string, nuevoEstado: UserEstado) => {
    const accion = nuevoEstado === "bloqueado"
      ? `bloquear la cuenta de "${userName}". No podrá iniciar sesión.`
      : nuevoEstado === "inactivo"
      ? `desactivar la cuenta de "${userName}".`
      : `reactivar la cuenta de "${userName}".`;

    setModal({
      tipo: "estado",
      userId,
      userName,
      valorNuevo: nuevoEstado,
      mensaje: `¿Confirmas ${accion}`,
    });
  };

  const solicitarConfirmacionEliminar = (userId: string, userName: string) => {
    setModal({
      tipo: "eliminar",
      userId,
      userName,
      mensaje: `¿Estás seguro de que deseas eliminar permanentemente la cuenta de "${userName}"? Esta acción no se puede deshacer.`,
    });
  };

  const ejecutarConfirmacion = async () => {
    if (!modal) return;

    setConfirmando(true);
    setError("");

    try {
      if (modal.tipo === "rol" && modal.valorNuevo) {
        const role = modal.valorNuevo as Role;
        setSaving((prev) => ({ ...prev, [modal.userId]: true }));
        await updateUserRole(modal.userId, role);
        setUsers((prev) =>
          prev.map((u) => (u.id === modal.userId ? { ...u, role } : u))
        );
        setPendingRole((prev) => {
          const next = { ...prev };
          delete next[modal.userId];
          return next;
        });
        setSavedFeedback((prev) => ({ ...prev, [modal.userId]: true }));
        setTimeout(() => {
          setSavedFeedback((prev) => ({ ...prev, [modal.userId]: false }));
        }, 2000);
        setSaving((prev) => ({ ...prev, [modal.userId]: false }));
      } else if (modal.tipo === "estado" && modal.valorNuevo) {
        const estado = modal.valorNuevo as UserEstado;
        await updateUserEstado(modal.userId, estado);
        setUsers((prev) =>
          prev.map((u) => (u.id === modal.userId ? { ...u, estado } : u))
        );
      } else if (modal.tipo === "eliminar") {
        await deleteUser(modal.userId);
        setUsers((prev) => prev.filter((u) => u.id !== modal.userId));
      }

      setModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al realizar la acción");
    } finally {
      setConfirmando(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("es-CL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">
          Panel de Administración
        </h1>
        <p className="mt-2 text-sm text-gray-400">
          Gestiona usuarios, roles y estados de acceso del sistema.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-[#2a2a2a]">
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="text-base font-semibold text-white">
            Usuarios del sistema
          </h2>
          {!loading && (
            <p className="mt-0.5 text-xs text-gray-400">
              {users.length} {users.length === 1 ? "usuario registrado" : "usuarios registrados"}
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-3 px-5 py-8 text-sm text-gray-400">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-gray-300" />
            Cargando usuarios...
          </div>
        ) : users.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400">
            No hay usuarios registrados.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-white/8 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <th className="px-5 py-3">Nombre</th>
                  <th className="px-5 py-3">Email / Usuario</th>
                  <th className="px-5 py-3">Rol</th>
                  <th className="px-5 py-3">Cambiar rol</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3">Acciones</th>
                  <th className="px-5 py-3">Registrado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map((u) => {
                  const isSelf = u.id === user?.id;
                  const currentRole = u.role;
                  const selected = pendingRole[u.id] ?? currentRole;
                  const isDirty = pendingRole[u.id] !== undefined && pendingRole[u.id] !== currentRole;
                  const isSaving = saving[u.id] ?? false;
                  const justSaved = savedFeedback[u.id] ?? false;

                  return (
                    <tr
                      key={u.id}
                      className={`transition hover:bg-white/3 ${isSelf ? "opacity-60" : ""}`}
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-white">{u.name}</p>
                        {isSelf && (
                          <p className="mt-0.5 text-xs text-yellow-400/80">Tu cuenta</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-gray-300">
                        <p>{u.email}</p>
                        <p className="mt-0.5 text-xs text-gray-500">@{u.username}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[currentRole]}`}
                        >
                          {ROLE_LABELS[currentRole]}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {isSelf ? (
                          <span className="text-xs text-gray-500">No disponible</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <select
                              value={selected}
                              onChange={(e) =>
                                handleRoleChange(u.id, e.target.value as Role)
                              }
                              disabled={isSaving}
                              className="rounded-xl border border-white/10 bg-[#1f1f1f] px-3 py-1.5 text-sm text-white outline-none transition focus:border-emerald-400 disabled:opacity-50"
                            >
                              {ALL_ROLES.map((r) => (
                                <option key={r} value={r}>
                                  {ROLE_LABELS[r]}
                                </option>
                              ))}
                            </select>

                            {isDirty && (
                              <button
                                type="button"
                                onClick={() =>
                                  solicitarConfirmacionRol(u.id, u.name, selected as Role)
                                }
                                disabled={isSaving}
                                className="rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isSaving ? (
                                  <span className="flex items-center gap-1.5">
                                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-950/20 border-t-slate-950" />
                                    Guardando
                                  </span>
                                ) : (
                                  "Guardar"
                                )}
                              </button>
                            )}

                            {justSaved && !isDirty && (
                              <span className="text-xs text-emerald-400">Guardado</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${ESTADO_COLORS[u.estado ?? "activo"]}`}
                        >
                          {ESTADO_LABELS[u.estado ?? "activo"]}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {isSelf ? (
                          <span className="text-xs text-gray-500">—</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            {u.estado !== "bloqueado" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  solicitarConfirmacionEstado(u.id, u.name, "bloqueado")
                                }
                                className="rounded-xl border border-orange-400/30 px-3 py-1 text-xs font-medium text-orange-400 transition hover:bg-orange-400/10"
                              >
                                Bloquear
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  solicitarConfirmacionEstado(u.id, u.name, "activo")
                                }
                                className="rounded-xl border border-emerald-400/30 px-3 py-1 text-xs font-medium text-emerald-400 transition hover:bg-emerald-400/10"
                              >
                                Activar
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                solicitarConfirmacionEliminar(u.id, u.name)
                              }
                              className="rounded-xl border border-red-400/30 px-3 py-1 text-xs font-medium text-red-400 transition hover:bg-red-400/10"
                            >
                              Eliminar
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-500">
                        {formatDate(u.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de confirmación */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#2a2a2a] p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-white">
              {modal.tipo === "eliminar"
                ? "Confirmar eliminación"
                : modal.tipo === "estado"
                ? "Confirmar cambio de estado"
                : "Confirmar cambio de rol"}
            </h3>

            {modal.tipo === "eliminar" && (
              <div className="mt-3 rounded-xl border border-red-400/20 bg-red-400/8 px-3 py-2 text-xs text-red-300">
                Advertencia: esta acción eliminará permanentemente al usuario y no puede revertirse.
              </div>
            )}

            <p className="mt-3 text-sm text-gray-300">{modal.mensaje}</p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModal(null)}
                disabled={confirmando}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-300 transition hover:bg-white/5 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void ejecutarConfirmacion()}
                disabled={confirmando}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  modal.tipo === "eliminar"
                    ? "bg-red-500 text-white hover:bg-red-400"
                    : "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                }`}
              >
                {confirmando ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/20 border-t-current" />
                    Procesando...
                  </span>
                ) : (
                  "Confirmar"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
