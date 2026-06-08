import { useEffect, useState } from "react";
import { fetchLogs, type AuditLog } from "../services/admin";

const ACCION_LABELS: Record<string, string> = {
  cambio_rol: "Cambio de rol",
  cambio_estado_usuario: "Cambio de estado",
  eliminar_usuario: "Eliminar usuario",
  agregar_email_autorizado: "Agregar correo autorizado",
  eliminar_email_autorizado: "Eliminar correo autorizado",
  cambio_rol_email_autorizado: "Cambio de rol (correo autorizado)",
  acceso_no_autorizado: "Acceso no autorizado",
  intento_acceso_bloqueado: "Intento de acceso (cuenta bloqueada)",
};

const ACCION_COLORS: Record<string, string> = {
  cambio_rol: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  cambio_estado_usuario: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  eliminar_usuario: "bg-red-500/15 text-red-300 border-red-500/30",
  agregar_email_autorizado: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  eliminar_email_autorizado: "bg-red-500/15 text-red-300 border-red-500/30",
  cambio_rol_email_autorizado: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  acceso_no_autorizado: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  intento_acceso_bloqueado: "bg-red-500/15 text-red-300 border-red-500/30",
};

const LIMITE_PAGINA = 50;

const AdminLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const cargarLogs = async (nuevoOffset: number) => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchLogs(LIMITE_PAGINA, nuevoOffset);
      setLogs(data.logs);
      setTotal(data.total);
      setOffset(nuevoOffset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargarLogs(0);
  }, []);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("es-CL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const totalPaginas = Math.ceil(total / LIMITE_PAGINA);
  const paginaActual = Math.floor(offset / LIMITE_PAGINA) + 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">
          Registro de auditoría
        </h1>
        <p className="mt-2 text-sm text-gray-400">
          Historial de acciones realizadas por administradores y eventos de seguridad.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-[#2a2a2a]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-white">Eventos registrados</h2>
            {!loading && (
              <p className="mt-0.5 text-xs text-gray-400">
                {total} {total === 1 ? "evento en total" : "eventos en total"}
                {totalPaginas > 1 && ` · Página ${paginaActual} de ${totalPaginas}`}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void cargarLogs(offset)}
            disabled={loading}
            className="rounded-xl border border-white/10 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:bg-white/5 disabled:opacity-50"
          >
            Actualizar
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 px-5 py-8 text-sm text-gray-400">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-gray-300" />
            Cargando logs...
          </div>
        ) : logs.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400">
            No hay eventos registrados aún.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-white/8 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <th className="px-5 py-3">Fecha y hora</th>
                  <th className="px-5 py-3">Acción</th>
                  <th className="px-5 py-3">Realizó</th>
                  <th className="px-5 py-3">Detalles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.map((log) => {
                  const etiqueta = ACCION_LABELS[log.accion] ?? log.accion;
                  const color = ACCION_COLORS[log.accion] ?? "bg-gray-500/15 text-gray-300 border-gray-500/30";

                  return (
                    <tr key={log.id} className="transition hover:bg-white/3">
                      <td className="px-5 py-3.5 text-xs text-gray-400 whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${color}`}
                        >
                          {etiqueta}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-300">
                        {log.admin_nombre ? (
                          <span className="font-medium">{log.admin_nombre}</span>
                        ) : (
                          <span className="text-xs text-gray-500">Sistema / Anónimo</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-400 max-w-xs">
                        {log.detalles ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPaginas > 1 && !loading && (
          <div className="flex items-center justify-between border-t border-white/10 px-5 py-4">
            <button
              type="button"
              onClick={() => void cargarLogs(Math.max(0, offset - LIMITE_PAGINA))}
              disabled={offset === 0 || loading}
              className="rounded-xl border border-white/10 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:bg-white/5 disabled:opacity-30"
            >
              Anterior
            </button>
            <span className="text-xs text-gray-500">
              Página {paginaActual} de {totalPaginas}
            </span>
            <button
              type="button"
              onClick={() => void cargarLogs(offset + LIMITE_PAGINA)}
              disabled={offset + LIMITE_PAGINA >= total || loading}
              className="rounded-xl border border-white/10 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:bg-white/5 disabled:opacity-30"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminLogs;
