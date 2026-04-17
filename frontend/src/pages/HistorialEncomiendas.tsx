import { useEffect, useEffectEvent, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import {
  fetchPackages,
  updatePackage,
  type PackageItem,
  type PackageStatus,
} from "../services/packages";

// # Este estado opcional llega desde la pantalla de registro para destacar
// # la encomienda recién creada cuando aterrizamos en el historial.
type HistorialLocationState = {
  recentlyCreatedId?: number;
  recentlyCreatedRecipient?: string;
};

// # Este formulario replica los campos que el backend permite actualizar.
// # Lo usamos solo cuando un conserje entra al modo edición.
type EditPackageFormData = {
  recipient_name: string;
  apartment_number: string;
  sender: string;
  delivery_date: string;
  description: string;
  status: PackageStatus;
};

// # Guardamos errores por campo para mostrar feedback exacto al usuario.
type EditPackageFormErrors = {
  recipient_name: string;
  apartment_number: string;
  sender: string;
  delivery_date: string;
  description: string;
  status: string;
};

// # Este mapa define el estilo visual de cada estado.
const statusClasses: Record<PackageStatus, string> = {
  received: "border border-blue-500/30 bg-blue-500/15 text-blue-300",
  delivered: "border border-green-500/30 bg-green-500/15 text-green-300",
  pending: "border border-yellow-500/30 bg-yellow-500/15 text-yellow-300",
};

// # Este estado inicial nos permite reiniciar el formulario de edición
// # sin repetir strings vacíos en varios lugares.
const initialEditFormData: EditPackageFormData = {
  recipient_name: "",
  apartment_number: "",
  sender: "",
  delivery_date: "",
  description: "",
  status: "received",
};

const initialEditErrors: EditPackageFormErrors = {
  recipient_name: "",
  apartment_number: "",
  sender: "",
  delivery_date: "",
  description: "",
  status: "",
};

// # Convertimos fechas ISO del backend a `YYYY-MM-DD` para que el input type="date"
// # pueda mostrarlas correctamente en el formulario de edición.
const toDateInputValue = (value: string | null) => {
  if (!value) {
    return "";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

// # Reutilizamos la misma lógica del formulario de alta para no permitir fechas futuras.
const getTodayDateValue = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const parseDateInput = (dateValue: string) => {
  const [year, month, day] = dateValue.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
};

const isDateAfterToday = (dateValue: string, todayValue: string) => {
  const selectedDate = parseDateInput(dateValue);
  const todayDate = parseDateInput(todayValue);

  if (!selectedDate || !todayDate) {
    return false;
  }

  return selectedDate.getTime() > todayDate.getTime();
};

const HistorialEncomiendas = () => {
  const { t, localeTag } = useI18n();
  const { user } = useAuth();
  const location = useLocation();

  const navigationState = (location.state ?? {}) as HistorialLocationState;

  // # Si entra un residente, pedimos al backend solo las encomiendas cuyo
  // # `recipient_name` coincide con su nombre autenticado.
  const recipientFilter = user?.role === "residente" ? user.name : "";

  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [updatingPackageId, setUpdatingPackageId] = useState<number | null>(
    null
  );
  const [editingPackageId, setEditingPackageId] = useState<number | null>(null);
  const [editFormData, setEditFormData] =
    useState<EditPackageFormData>(initialEditFormData);
  const [editErrors, setEditErrors] =
    useState<EditPackageFormErrors>(initialEditErrors);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // # Esta fecha máxima alimenta el input y la validación del formulario de edición.
  const maxDeliveryDate = getTodayDateValue();

  const statusLabels: Record<PackageStatus, string> = {
    received: t("historial.status.received"),
    delivered: t("historial.status.delivered"),
    pending: t("historial.status.pending"),
  };

  // # Esta función formatea fechas que vienen del backend.
  // # Si el valor no existe o es inválido, devolvemos un texto claro en vez de romper la tabla.
  const formatDate = (value: string | null) => {
    if (!value) {
      return t("historial.date.none");
    }

    const parsedDate = new Date(value);

    if (Number.isNaN(parsedDate.getTime())) {
      return t("historial.date.invalid");
    }

    return parsedDate.toLocaleDateString(localeTag, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // # `useEffectEvent` nos deja reutilizar la carga en `useEffect` y en botones de recarga
  // # sin pelear con dependencias innecesarias del hook.
  const loadPackages = useEffectEvent(async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const nextPackages = await fetchPackages(
        recipientFilter ? { recipient_name: recipientFilter } : {}
      );

      setPackages(nextPackages);
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error ? error.message : t("historial.error.network")
      );
    } finally {
      setIsLoading(false);
    }
  });

  // # Cada vez que cambia el usuario filtrado recargamos el historial correcto.
  useEffect(() => {
    void loadPackages();
  }, [recipientFilter]);

  // # Esta función transforma un paquete del backend al formato del formulario editable.
  const buildEditFormData = (packageItem: PackageItem): EditPackageFormData => {
    return {
      recipient_name: packageItem.recipient_name,
      apartment_number: packageItem.apartment_number,
      sender: packageItem.sender,
      delivery_date: toDateInputValue(packageItem.delivery_date),
      description: packageItem.description ?? "",
      status: packageItem.status,
    };
  };

  // # Validamos antes de enviar para atrapar errores rápidos sin esperar la respuesta del backend.
  const validateEditForm = (values: EditPackageFormData) => {
    const nextErrors: EditPackageFormErrors = { ...initialEditErrors };

    if (!values.recipient_name.trim()) {
      nextErrors.recipient_name = t("historial.edit.validation.recipient.required");
    }

    if (!values.apartment_number.trim()) {
      nextErrors.apartment_number = t("historial.edit.validation.apartment.required");
    } else if (!/^[A-Za-z0-9/-]{1,10}$/.test(values.apartment_number.trim())) {
      // # Permitimos `/` porque algunos registros antiguos migrados quedaron con `N/A`
      // # y deben seguir pudiendo editarse sin obligar al usuario a corregirlos primero.
      nextErrors.apartment_number = t("historial.edit.validation.apartment.invalid");
    }

    if (!values.sender.trim()) {
      nextErrors.sender = t("historial.edit.validation.sender.required");
    }

    if (
      values.delivery_date.trim() &&
      isDateAfterToday(values.delivery_date, maxDeliveryDate)
    ) {
      nextErrors.delivery_date = t("historial.edit.validation.deliveryDate.future");
    }

    if (!values.status) {
      nextErrors.status = t("historial.edit.validation.status.required");
    }

    return nextErrors;
  };

  const hasEditErrors = (errors: EditPackageFormErrors) => {
    return Object.values(errors).some((error) => error !== "");
  };

  const handleStartEdit = (packageItem: PackageItem) => {
    // # Al abrir edición precargamos el formulario con los datos reales de la fila seleccionada.
    setEditingPackageId(packageItem.id);
    setEditFormData(buildEditFormData(packageItem));
    setEditErrors(initialEditErrors);
    setStatusMessage("");
  };

  const handleCancelEdit = () => {
    setEditingPackageId(null);
    setEditFormData(initialEditFormData);
    setEditErrors(initialEditErrors);
  };

  const handleEditInputChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;

    setEditFormData((current) => ({
      ...current,
      [name]: value,
    }));

    setEditErrors((current) => ({
      ...current,
      [name]: "",
    }));
  };

  const handleMarkAsDelivered = async (packageItem: PackageItem) => {
    setStatusMessage("");
    setUpdatingPackageId(packageItem.id);

    try {
      // # Solo enviamos el estado porque el backend ahora soporta actualizaciones parciales.
      const updatedPackage = await updatePackage(packageItem.id, {
        status: "delivered",
      });

      setPackages((currentPackages) =>
        currentPackages.map((currentPackage) =>
          currentPackage.id === updatedPackage.id ? updatedPackage : currentPackage
        )
      );

      setStatusMessage(
        t("historial.statusUpdate.success", {
          recipient: updatedPackage.recipient_name,
        })
      );
    } catch (error) {
      console.error(error);

      setStatusMessage(
        error instanceof Error
          ? error.message
          : t("historial.statusUpdate.error")
      );
    } finally {
      setUpdatingPackageId(null);
    }
  };

  const handleEditSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingPackageId) {
      return;
    }

    // # Normalizamos antes de validar y enviar para mantener consistencia con el alta.
    const normalizedValues: EditPackageFormData = {
      recipient_name: editFormData.recipient_name.trim(),
      apartment_number: editFormData.apartment_number.trim().toUpperCase(),
      sender: editFormData.sender.trim(),
      delivery_date: editFormData.delivery_date.trim(),
      description: editFormData.description.trim(),
      status: editFormData.status,
    };

    const validationErrors = validateEditForm(normalizedValues);
    setEditErrors(validationErrors);

    if (hasEditErrors(validationErrors)) {
      // # Dejamos un mensaje general arriba del formulario para que el usuario entienda
      // # por qué el botón no guardó aunque el error específico esté más abajo.
      setStatusMessage(t("historial.edit.validation.general"));
      return;
    }

    setIsSavingEdit(true);
    setStatusMessage("");

    try {
      // # Enviamos únicamente la forma esperada por el backend.
      // # `description` y `delivery_date` viajan como `null` cuando el usuario los deja vacíos.
      const updatedPackage = await updatePackage(editingPackageId, {
        recipient_name: normalizedValues.recipient_name,
        apartment_number: normalizedValues.apartment_number,
        sender: normalizedValues.sender,
        delivery_date: normalizedValues.delivery_date || null,
        description: normalizedValues.description || null,
        status: normalizedValues.status,
      });

      setPackages((currentPackages) =>
        currentPackages.map((currentPackage) =>
          currentPackage.id === updatedPackage.id ? updatedPackage : currentPackage
        )
      );

      setStatusMessage(
        t("historial.edit.success", {
          recipient: updatedPackage.recipient_name,
        })
      );

      handleCancelEdit();
    } catch (error) {
      console.error(error);

      setStatusMessage(
        error instanceof Error ? error.message : t("historial.edit.error")
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  const isResidentView = user?.role === "residente";
  const descriptionText = isResidentView
    ? t("historial.description.residente")
    : t("historial.description.conserje");

  return (
    <section className="flex flex-col gap-6">
      {/* # Encabezado y acciones generales de la pantalla. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-white">
            {t("historial.title")}
          </h1>
          <p className="text-sm text-gray-400">{descriptionText}</p>
          {isResidentView && recipientFilter && (
            <p className="text-xs text-gray-500">
              {t("historial.filter.mine", { recipient: recipientFilter })}
            </p>
          )}
        </div>

        <div>
          <button
            type="button"
            onClick={() => void loadPackages()}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
          >
            {t("common.refresh")}
          </button>
        </div>
      </div>

      {/* # Si venimos desde el formulario, confirmamos que el alta se reflejó en el historial. */}
      {navigationState.recentlyCreatedId && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-200">
          {t("historial.recentSuccess", {
            recipient:
              navigationState.recentlyCreatedRecipient ??
              t("historial.recentRecipientFallback"),
          })}
        </div>
      )}

      {/* # Este mensaje se usa para éxito o error de actualización de estado. */}
      {statusMessage && (
        <div className="rounded-xl border border-white/10 bg-[#2a2a2a] p-4 text-sm text-gray-200">
          {statusMessage}
        </div>
      )}

      {/* # Este panel aparece solo para conserjería cuando se elige una fila para editar.
          # Lo dejamos arriba de la tabla para que el contexto siga visible mientras se edita. */}
      {!isResidentView && editingPackageId && (
        <section className="rounded-xl border border-emerald-500/30 bg-[#2a2a2a] p-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {t("historial.edit.title")}
              </h2>
              <p className="text-sm text-gray-400">
                {t("historial.edit.description")}
              </p>
            </div>

            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={isSavingEdit}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t("common.cancel")}
            </button>
          </div>

          <form onSubmit={handleEditSubmit} noValidate className="grid gap-4 md:grid-cols-2">
            {/* # Campo nombre residente */}
            <div>
              <label htmlFor="edit_recipient_name" className="text-sm text-gray-300">
                {t("conserje.field.recipient")}
              </label>
              <input
                id="edit_recipient_name"
                type="text"
                name="recipient_name"
                value={editFormData.recipient_name}
                onChange={handleEditInputChange}
                aria-invalid={editErrors.recipient_name !== ""}
                className={`mt-1 w-full rounded border bg-[#1f1f1f] p-2 text-white focus:outline-none ${
                  editErrors.recipient_name
                    ? "border-red-500 focus:border-red-400"
                    : "border-gray-600 focus:border-emerald-500"
                }`}
              />
              {editErrors.recipient_name && (
                <p className="mt-1 text-sm text-red-400">
                  {editErrors.recipient_name}
                </p>
              )}
            </div>

            {/* # Campo departamento */}
            <div>
              <label htmlFor="edit_apartment_number" className="text-sm text-gray-300">
                {t("conserje.field.apartment")}
              </label>
              <input
                id="edit_apartment_number"
                type="text"
                name="apartment_number"
                value={editFormData.apartment_number}
                onChange={handleEditInputChange}
                aria-invalid={editErrors.apartment_number !== ""}
                className={`mt-1 w-full rounded border bg-[#1f1f1f] p-2 text-white focus:outline-none ${
                  editErrors.apartment_number
                    ? "border-red-500 focus:border-red-400"
                    : "border-gray-600 focus:border-emerald-500"
                }`}
              />
              {editErrors.apartment_number && (
                <p className="mt-1 text-sm text-red-400">
                  {editErrors.apartment_number}
                </p>
              )}
            </div>

            {/* # Campo remitente */}
            <div>
              <label htmlFor="edit_sender" className="text-sm text-gray-300">
                {t("conserje.field.sender")}
              </label>
              <input
                id="edit_sender"
                type="text"
                name="sender"
                value={editFormData.sender}
                onChange={handleEditInputChange}
                aria-invalid={editErrors.sender !== ""}
                className={`mt-1 w-full rounded border bg-[#1f1f1f] p-2 text-white focus:outline-none ${
                  editErrors.sender
                    ? "border-red-500 focus:border-red-400"
                    : "border-gray-600 focus:border-emerald-500"
                }`}
              />
              {editErrors.sender && (
                <p className="mt-1 text-sm text-red-400">{editErrors.sender}</p>
              )}
            </div>

            {/* # Campo fecha entrega.
                # En edición permitimos dejarlo vacío, pero si existe debe ser válida y no futura. */}
            <div>
              <label htmlFor="edit_delivery_date" className="text-sm text-gray-300">
                {t("conserje.field.deliveryDate")}
              </label>
              <input
                id="edit_delivery_date"
                type="date"
                name="delivery_date"
                value={editFormData.delivery_date}
                onChange={handleEditInputChange}
                max={maxDeliveryDate}
                aria-invalid={editErrors.delivery_date !== ""}
                className={`mt-1 w-full rounded border bg-[#1f1f1f] p-2 text-white focus:outline-none ${
                  editErrors.delivery_date
                    ? "border-red-500 focus:border-red-400"
                    : "border-gray-600 focus:border-emerald-500"
                }`}
              />
              <p className="mt-1 text-xs text-gray-500">
                {t("conserje.maxDate", { date: maxDeliveryDate })}
              </p>
              {editErrors.delivery_date && (
                <p className="mt-1 text-sm text-red-400">
                  {editErrors.delivery_date}
                </p>
              )}
            </div>

            {/* # Campo estado para que conserjería pueda corregir o actualizar la situación del paquete. */}
            <div>
              <label htmlFor="edit_status" className="text-sm text-gray-300">
                {t("historial.table.status")}
              </label>
              <select
                id="edit_status"
                name="status"
                value={editFormData.status}
                onChange={handleEditInputChange}
                aria-invalid={editErrors.status !== ""}
                className={`mt-1 w-full rounded border bg-[#1f1f1f] p-2 text-white focus:outline-none ${
                  editErrors.status
                    ? "border-red-500 focus:border-red-400"
                    : "border-gray-600 focus:border-emerald-500"
                }`}
              >
                <option value="received">{statusLabels.received}</option>
                <option value="pending">{statusLabels.pending}</option>
                <option value="delivered">{statusLabels.delivered}</option>
              </select>
              {editErrors.status && (
                <p className="mt-1 text-sm text-red-400">{editErrors.status}</p>
              )}
            </div>

            {/* # Campo observaciones opcional para aprovechar la columna `description` del backend. */}
            <div className="md:col-span-2">
              <label htmlFor="edit_description" className="text-sm text-gray-300">
                {t("historial.edit.field.description")}
              </label>
              <textarea
                id="edit_description"
                name="description"
                value={editFormData.description}
                onChange={handleEditInputChange}
                rows={4}
                className="mt-1 w-full rounded border border-gray-600 bg-[#1f1f1f] p-2 text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* # Botones de acción del formulario */}
            <div className="flex flex-col gap-3 md:col-span-2 sm:flex-row">
              <button
                type="submit"
                disabled={isSavingEdit}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingEdit ? t("historial.edit.saving") : t("common.save")}
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isSavingEdit}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t("common.cancel")}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* # Estado de carga inicial o recarga manual. */}
      {isLoading && (
        <div className="rounded-xl border border-white/10 bg-[#2a2a2a] p-5 text-sm text-gray-300">
          {t("historial.loading")}
        </div>
      )}

      {/* # Error general de lectura con botón de reintento. */}
      {!isLoading && errorMessage && (
        <div className="flex flex-col gap-4 rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">
          <p>{errorMessage}</p>
          <div>
            <button
              type="button"
              onClick={() => void loadPackages()}
              className="rounded-lg bg-red-500 px-4 py-2 font-medium text-white transition hover:bg-red-400"
            >
              {t("common.retry")}
            </button>
          </div>
        </div>
      )}

      {/* # Estado vacío según el rol actual. */}
      {!isLoading && !errorMessage && packages.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-[#2a2a2a] p-5 text-sm text-gray-300">
          {isResidentView ? t("historial.empty.residente") : t("historial.empty")}
        </div>
      )}

      {/* # Tabla principal con datos reales del backend. */}
      {!isLoading && !errorMessage && packages.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-[#2a2a2a]">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-white">
              <thead className="bg-white/5 text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-medium">
                    {t("historial.table.resident")}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t("historial.table.apartment")}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t("historial.table.sender")}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t("historial.table.deliveryDate")}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t("historial.table.createdAt")}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t("historial.table.status")}
                  </th>
                  {!isResidentView && (
                    <th className="px-4 py-3 font-medium">
                      {t("historial.table.actions")}
                    </th>
                  )}
                </tr>
              </thead>

              <tbody>
                {packages.map((item) => {
                  const isUpdatingCurrentRow = updatingPackageId === item.id;

                  return (
                    <tr
                      key={item.id}
                      className={`border-t border-white/10 ${
                        item.id === navigationState.recentlyCreatedId
                          ? "bg-green-500/10"
                          : ""
                      }`}
                    >
                      <td className="px-4 py-3">{item.recipient_name}</td>
                      <td className="px-4 py-3">{item.apartment_number}</td>
                      <td className="px-4 py-3">{item.sender}</td>
                      <td className="px-4 py-3">
                        {formatDate(item.delivery_date)}
                      </td>
                      <td className="px-4 py-3">{formatDate(item.created_at)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[item.status]}`}
                        >
                          {statusLabels[item.status]}
                        </span>
                      </td>

                      {!isResidentView && (
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-2">
                            {/* # Siempre permitimos editar la fila para corregir datos cargados previamente. */}
                            <button
                              type="button"
                              onClick={() => handleStartEdit(item)}
                              disabled={isSavingEdit}
                              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {editingPackageId === item.id
                                ? t("historial.action.editing")
                                : t("historial.action.edit")}
                            </button>

                            {/* # Esta acción rápida se mantiene porque sigue siendo útil para flujos de retiro. */}
                            {item.status === "delivered" ? (
                              <span className="text-xs text-gray-500">
                                {t("historial.action.alreadyDelivered")}
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={isUpdatingCurrentRow || isSavingEdit}
                                onClick={() => void handleMarkAsDelivered(item)}
                                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isUpdatingCurrentRow
                                  ? t("historial.action.updating")
                                  : t("historial.action.markDelivered")}
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};

export default HistorialEncomiendas;
