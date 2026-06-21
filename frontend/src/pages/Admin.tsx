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
import { useI18n } from "../context/I18nContext";

const ALL_ROLES: Role[] = ["residente", "conserje", "administrador"];

const ROLE_COLORS: Record<Role, string> = {
  residente: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  conserje: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  administrador: "bg-purple-500/15 text-purple-300 border-purple-500/30",
};

const ESTADO_COLORS: Record<UserEstado, string> = {
  activo: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  inactivo: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  bloqueado: "bg-red-500/15 text-red-300 border-red-500/30",
};

type ModalBase = {
  userId: string;
  userName: string;
  mensaje: string;
};

// # La unión discriminada garantiza que cada confirmación lleve el valor correcto.
type ModalConfirm =
  | (ModalBase & { tipo: "rol"; valorNuevo: Role })
  | (ModalBase & { tipo: "estado"; valorNuevo: UserEstado })
  | (ModalBase & { tipo: "eliminar" });

const Admin = () => {
  const { user } = useAuth();
  const { t, formatDate } = useI18n();
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
      } catch {
        if (!cancelled) setError(t("admin.error.load"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [t]);

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
      mensaje: t("admin.confirmation.role", {
        name: userName,
        role: t(`common.roleLabel.${nuevoRol}`),
      }),
    });
  };

  const solicitarConfirmacionEstado = (userId: string, userName: string, nuevoEstado: UserEstado) => {
    setModal({
      tipo: "estado",
      userId,
      userName,
      valorNuevo: nuevoEstado,
      mensaje: t(`admin.confirmation.status.${nuevoEstado}`, { name: userName }),
    });
  };

  const solicitarConfirmacionEliminar = (userId: string, userName: string) => {
    setModal({
      tipo: "eliminar",
      userId,
      userName,
      mensaje: t("admin.confirmation.delete", { name: userName }),
    });
  };

  const ejecutarConfirmacion = async () => {
    if (!modal) return;

    setConfirmando(true);
    setError("");

    try {
      if (modal.tipo === "rol") {
        const role = modal.valorNuevo;
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
      } else if (modal.tipo === "estado") {
        const estado = modal.valorNuevo;
        await updateUserEstado(modal.userId, estado);
        setUsers((prev) =>
          prev.map((u) => (u.id === modal.userId ? { ...u, estado } : u))
        );
      } else if (modal.tipo === "eliminar") {
        await deleteUser(modal.userId);
        setUsers((prev) => prev.filter((u) => u.id !== modal.userId));
      }

      setModal(null);
    } catch {
      setError(t("admin.error.action"));
    } finally {
      setConfirmando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">
          {t("admin.title")}
        </h1>
        <p className="mt-2 text-sm text-gray-400">
          {t("admin.description")}
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
            {t("admin.section")}
          </h2>
          {!loading && (
            <p className="mt-0.5 text-xs text-gray-400">
              {t(users.length === 1 ? "admin.count.one" : "admin.count.many", {
                count: users.length,
              })}
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-3 px-5 py-8 text-sm text-gray-400">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-gray-300" />
            {t("admin.loading")}
          </div>
        ) : users.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400">
            {t("admin.empty")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-white/8 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <th className="px-5 py-3">{t("admin.table.name")}</th>
                  <th className="px-5 py-3">{t("admin.table.identity")}</th>
                  <th className="px-5 py-3">{t("admin.table.role")}</th>
                  <th className="px-5 py-3">{t("admin.table.changeRole")}</th>
                  <th className="px-5 py-3">{t("admin.table.status")}</th>
                  <th className="px-5 py-3">{t("admin.table.actions")}</th>
                  <th className="px-5 py-3">{t("admin.table.registered")}</th>
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
                          <p className="mt-0.5 text-xs text-yellow-400/80">{t("admin.self")}</p>
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
                          {t(`common.roleLabel.${currentRole}`)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {isSelf ? (
                          <span className="text-xs text-gray-500">{t("admin.unavailable")}</span>
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
                                  {t(`common.roleLabel.${r}`)}
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
                                    {t("admin.saving")}
                                  </span>
                                ) : (
                                  t("admin.save")
                                )}
                              </button>
                            )}

                            {justSaved && !isDirty && (
                              <span className="text-xs text-emerald-400">{t("admin.saved")}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${ESTADO_COLORS[u.estado ?? "activo"]}`}
                        >
                          {t(`admin.status.${u.estado ?? "activo"}`)}
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
                                {t("admin.action.block")}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  solicitarConfirmacionEstado(u.id, u.name, "activo")
                                }
                                className="rounded-xl border border-emerald-400/30 px-3 py-1 text-xs font-medium text-emerald-400 transition hover:bg-emerald-400/10"
                              >
                                {t("admin.action.activate")}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                solicitarConfirmacionEliminar(u.id, u.name)
                              }
                              className="rounded-xl border border-red-400/30 px-3 py-1 text-xs font-medium text-red-400 transition hover:bg-red-400/10"
                            >
                              {t("admin.action.delete")}
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-500">
                        {formatDate(u.created_at, {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
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
              {t(
                modal.tipo === "eliminar"
                  ? "admin.confirmation.title.delete"
                  : modal.tipo === "estado"
                    ? "admin.confirmation.title.status"
                    : "admin.confirmation.title.role"
              )}
            </h3>

            {modal.tipo === "eliminar" && (
              <div className="mt-3 rounded-xl border border-red-400/20 bg-red-400/8 px-3 py-2 text-xs text-red-300">
                {t("admin.confirmation.warning")}
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
                {t("common.cancel")}
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
                    {t("admin.confirmation.processing")}
                  </span>
                ) : (
                  t("admin.confirmation.confirm")
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
