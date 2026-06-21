import { useEffect, useRef, useState } from "react";
import {
  fetchAuthorizedEmails,
  addAuthorizedEmail,
  updateAuthorizedEmailRole,
  deleteAuthorizedEmail,
  type AuthorizedEmail,
} from "../services/adminEmails";
import type { Role } from "../services/auth";
import { useI18n } from "../context/I18nContext";

const ALL_ROLES: Role[] = ["residente", "conserje", "administrador"];

const ROLE_COLORS: Record<Role, string> = {
  residente: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  conserje: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  administrador: "bg-purple-500/15 text-purple-300 border-purple-500/30",
};

const AdminEmails = () => {
  const { t, formatDate } = useI18n();
  const [emails, setEmails] = useState<AuthorizedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<Role>("conserje");
  const [adding, setAdding] = useState(false);

  const [pendingRole, setPendingRole] = useState<Record<string, Role>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [savedFeedback, setSavedFeedback] = useState<Record<string, boolean>>({});

  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await fetchAuthorizedEmails();
        if (!cancelled) setEmails(data);
      } catch {
        if (!cancelled) setError(t("adminEmails.error.load"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [t]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newEmail.trim();
    if (!trimmed) return;

    setAdding(true);
    setError("");
    try {
      const created = await addAuthorizedEmail(trimmed, newRole);
      setEmails((prev) => [created, ...prev]);
      setNewEmail("");
      emailInputRef.current?.focus();
    } catch {
      setError(t("adminEmails.error.add"));
    } finally {
      setAdding(false);
    }
  };

  const handleRoleChange = (id: string, role: Role) => {
    setPendingRole((prev) => ({ ...prev, [id]: role }));
    setSavedFeedback((prev) => ({ ...prev, [id]: false }));
  };

  const handleSaveRole = async (id: string) => {
    const role = pendingRole[id];
    if (!role) return;

    setSaving((prev) => ({ ...prev, [id]: true }));
    setError("");
    try {
      await updateAuthorizedEmailRole(id, role);
      setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, role } : e)));
      setPendingRole((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setSavedFeedback((prev) => ({ ...prev, [id]: true }));
      setTimeout(() => {
        setSavedFeedback((prev) => ({ ...prev, [id]: false }));
      }, 2000);
    } catch {
      setError(t("adminEmails.error.updateRole"));
    } finally {
      setSaving((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting((prev) => ({ ...prev, [id]: true }));
    setError("");
    try {
      await deleteAuthorizedEmail(id);
      setEmails((prev) => prev.filter((e) => e.id !== id));
    } catch {
      setError(t("adminEmails.error.delete"));
    } finally {
      setDeleting((prev) => ({ ...prev, [id]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">
          {t("adminEmails.title")}
        </h1>
        <p className="mt-2 text-sm text-gray-400">
          {t("adminEmails.description")}
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-[#2a2a2a]">
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="text-base font-semibold text-white">{t("adminEmails.addSection")}</h2>
        </div>
        <form onSubmit={(e) => void handleAdd(e)} className="flex flex-wrap items-end gap-3 px-5 py-4">
          <div className="flex-1 min-w-[200px]">
            <label className="mb-1.5 block text-xs font-medium text-gray-400">
              {t("adminEmails.field.email")}
            </label>
            <input
              ref={emailInputRef}
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder={t("adminEmails.placeholder")}
              required
              disabled={adding}
              className="w-full rounded-xl border border-white/10 bg-[#1f1f1f] px-3 py-2 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-emerald-400 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-400">{t("adminEmails.field.role")}</label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as Role)}
              disabled={adding}
              className="rounded-xl border border-white/10 bg-[#1f1f1f] px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-400 disabled:opacity-50"
            >
              {ALL_ROLES.map((r) => (
                <option key={r} value={r}>{t(`common.roleLabel.${r}`)}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={adding || !newEmail.trim()}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {adding ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-950/20 border-t-slate-950" />
                {t("adminEmails.adding")}
              </span>
            ) : (
              t("adminEmails.add")
            )}
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#2a2a2a]">
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="text-base font-semibold text-white">{t("adminEmails.listSection")}</h2>
          {!loading && (
            <p className="mt-0.5 text-xs text-gray-400">
              {t(emails.length === 1 ? "adminEmails.count.one" : "adminEmails.count.many", {
                count: emails.length,
              })}
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-3 px-5 py-8 text-sm text-gray-400">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-gray-300" />
            {t("adminEmails.loading")}
          </div>
        ) : emails.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400">
            {t("adminEmails.empty")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-white/8 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <th className="px-5 py-3">{t("adminEmails.table.email")}</th>
                  <th className="px-5 py-3">{t("adminEmails.table.currentRole")}</th>
                  <th className="px-5 py-3">{t("adminEmails.table.changeRole")}</th>
                  <th className="px-5 py-3">{t("adminEmails.table.registered")}</th>
                  <th className="px-5 py-3">{t("adminEmails.table.delete")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {emails.map((entry) => {
                  const currentRole = entry.role;
                  const selected = pendingRole[entry.id] ?? currentRole;
                  const isDirty = pendingRole[entry.id] !== undefined && pendingRole[entry.id] !== currentRole;
                  const isSaving = saving[entry.id] ?? false;
                  const isDeleting = deleting[entry.id] ?? false;
                  const justSaved = savedFeedback[entry.id] ?? false;

                  return (
                    <tr key={entry.id} className="transition hover:bg-white/3">
                      <td className="px-5 py-3.5 font-medium text-white">
                        {entry.email}
                        {entry.created_by_name && (
                          <p className="mt-0.5 text-xs text-gray-500">
                            {t("adminEmails.createdBy", { name: entry.created_by_name })}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[currentRole]}`}
                        >
                          {t(`common.roleLabel.${currentRole}`)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <select
                            value={selected}
                            onChange={(e) => handleRoleChange(entry.id, e.target.value as Role)}
                            disabled={isSaving || isDeleting}
                            className="rounded-xl border border-white/10 bg-[#1f1f1f] px-3 py-1.5 text-sm text-white outline-none transition focus:border-emerald-400 disabled:opacity-50"
                          >
                            {ALL_ROLES.map((r) => (
                              <option key={r} value={r}>{t(`common.roleLabel.${r}`)}</option>
                            ))}
                          </select>

                          {isDirty && (
                            <button
                              type="button"
                              onClick={() => void handleSaveRole(entry.id)}
                              disabled={isSaving}
                              className="rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isSaving ? (
                                <span className="flex items-center gap-1.5">
                                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-950/20 border-t-slate-950" />
                                  {t("adminEmails.saving")}
                                </span>
                              ) : (
                                t("adminEmails.save")
                              )}
                            </button>
                          )}

                          {justSaved && !isDirty && (
                            <span className="text-xs text-emerald-400">{t("adminEmails.saved")}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-500">
                        {formatDate(entry.created_at, {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-5 py-3.5">
                        <button
                          type="button"
                          onClick={() => void handleDelete(entry.id)}
                          disabled={isDeleting || isSaving}
                          className="rounded-xl border border-red-400/30 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isDeleting ? (
                            <span className="flex items-center gap-1.5">
                              <span className="h-3 w-3 animate-spin rounded-full border-2 border-red-400/20 border-t-red-400" />
                              {t("adminEmails.deleting")}
                            </span>
                          ) : (
                            t("adminEmails.delete")
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminEmails;
