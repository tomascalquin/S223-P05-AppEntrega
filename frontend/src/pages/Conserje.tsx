import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useNavigate } from "react-router-dom";

// # Este tipo representa exactamente los nombres que hoy espera el backend.
// # Así evitamos tener que traducir campos antes del fetch.
type PackageFormData = {
  recipient_name: string;
  apartment_number: string;
  sender: string;
  delivery_date: string;
  urgency: "normal" | "urgent";
};

// # Este tipo guarda los mensajes de error por cada campo visible del formulario.
type PackageFormErrors = {
  recipient_name: string;
  apartment_number: string;
  sender: string;
  delivery_date: string;
};

// # Este objeto deja los inputs con sus valores iniciales.
// # "normal" queda marcado por defecto para que siempre haya una urgencia elegida.
const initialFormData: PackageFormData = {
  recipient_name: "",
  apartment_number: "",
  sender: "",
  delivery_date: "",
  urgency: "normal",
};

// # Este objeto deja todos los errores vacíos al inicio.
const initialErrors: PackageFormErrors = {
  recipient_name: "",
  apartment_number: "",
  sender: "",
  delivery_date: "",
};

// # URL base del backend actual.
const API_URL = "http://localhost:3001";

// # Esta función construye la fecha local de hoy en formato YYYY-MM-DD.
// # Evitamos toISOString para que la zona horaria no corra el día hacia adelante o atrás.
const getTodayDateValue = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

// # Esta función convierte una fecha YYYY-MM-DD a una fecha local a medianoche.
// # Así evitamos comparaciones incorrectas por formato o zona horaria.
const parseDateInput = (dateValue: string) => {
  const [year, month, day] = dateValue.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
};

// # Esta función compara fechas como objetos Date reales y no como texto.
const isDateAfterToday = (dateValue: string, todayValue: string) => {
  const selectedDate = parseDateInput(dateValue);
  const todayDate = parseDateInput(todayValue);

  if (!selectedDate || !todayDate) {
    return false;
  }

  return selectedDate.getTime() > todayDate.getTime();
};

const Conserje = () => {
  // # Esta navegación nos permite llevar al usuario al historial tras registrar la encomienda.
  const navigate = useNavigate();

  // # Guardamos la fecha máxima permitida para que el usuario no pueda elegir días futuros.
  const maxDeliveryDate = getTodayDateValue();

  // # Estado principal del formulario.
  const [formData, setFormData] = useState<PackageFormData>(initialFormData);

  // # Estado para mensajes de error por campo.
  const [fieldErrors, setFieldErrors] =
    useState<PackageFormErrors>(initialErrors);

  // # Estado para error general del envío.
  const [errorMessage, setErrorMessage] = useState("");

  // # Estado para mensaje de éxito cuando el backend responde bien.
  const [successMessage, setSuccessMessage] = useState("");

  // # Estado para bloquear el botón mientras se realiza el POST.
  const [isSubmitting, setIsSubmitting] = useState(false);

  // # Esta función valida solo los campos que actualmente usa el backend.
  const validateForm = (values: PackageFormData) => {
    const nextErrors: PackageFormErrors = { ...initialErrors };

    if (!values.recipient_name.trim()) {
      nextErrors.recipient_name = "El nombre del residente es obligatorio.";
    }

    if (!values.apartment_number.trim()) {
      nextErrors.apartment_number = "El departamento es obligatorio.";
    } else if (!/^[A-Za-z0-9-]{1,10}$/.test(values.apartment_number.trim())) {
      nextErrors.apartment_number =
        "Usa un formato válido, por ejemplo 101 o A-12.";
    }

    if (!values.sender.trim()) {
      nextErrors.sender = "El remitente es obligatorio.";
    }

    if (!values.delivery_date.trim()) {
      nextErrors.delivery_date = "La fecha es obligatoria.";
    } else if (isDateAfterToday(values.delivery_date, maxDeliveryDate)) {
      nextErrors.delivery_date =
        "La fecha no puede ser posterior al dia actual.";
    }

    return nextErrors;
  };

  // # Esto permite saber si hay al menos un error antes de enviar.
  const hasValidationErrors = (errors: PackageFormErrors) => {
    return Object.values(errors).some((error) => error !== "");
  };

  // # Este handler se usa para inputs de texto y fecha.
  // # Limpia el error solo del campo que el usuario está corrigiendo.
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));

    setFieldErrors((current) => ({
      ...current,
      [name]: "",
    }));

    setErrorMessage("");
    setSuccessMessage("");
  };

  // # Este handler controla la urgencia con dos botones.
  // # Se guarda en el estado para que la interfaz muestre la selección actual.
  const handleUrgencyChange = (urgency: "normal" | "urgent") => {
    setFormData((current) => ({
      ...current,
      urgency,
    }));

    setErrorMessage("");
    setSuccessMessage("");
  };

  // # Este submit:
  // # 1. Valida campos
  // # 2. Arma un payload compatible con el backend
  // # 3. Envía el POST
  // # 4. Muestra éxito o error
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    // # Normalizamos los datos antes de validarlos y enviarlos.
    const normalizedData: PackageFormData = {
      recipient_name: formData.recipient_name.trim(),
      apartment_number: formData.apartment_number.trim().toUpperCase(),
      sender: formData.sender.trim(),
      delivery_date: formData.delivery_date,
      urgency: formData.urgency,
    };

    const validationErrors = validateForm(normalizedData);
    setFieldErrors(validationErrors);

    if (hasValidationErrors(validationErrors)) {
      setErrorMessage("Corrige los campos marcados antes de continuar.");
      return;
    }

    setIsSubmitting(true);

    try {
      // # Este payload usa exactamente los nombres que hoy espera el backend.
      // # No enviamos urgencia todavía porque el backend actual aún no tiene esa columna.
      const payload = {
        recipient_name: normalizedData.recipient_name,
        apartment_number: normalizedData.apartment_number,
        sender: normalizedData.sender,
        delivery_date: normalizedData.delivery_date,
      };

      const response = await fetch(`${API_URL}/api/packages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      // # Si el backend devuelve JSON, lo leemos para mostrar mejor el resultado.
      const contentType = response.headers.get("content-type") ?? "";
      const responseData = contentType.includes("application/json")
        ? await response.json()
        : null;

      if (!response.ok) {
        const backendMessage =
          responseData?.message ?? "Error al registrar la encomienda.";
        throw new Error(backendMessage);
      }

      console.log("Respuesta backend:", responseData);

      // # Incluimos la urgencia en el mensaje visual para que el usuario vea qué eligió,
      // # aunque por ahora esa información no viaje al backend.
      setSuccessMessage(
        `Encomienda registrada correctamente como ${
          normalizedData.urgency === "urgent" ? "urgente" : "no urgente"
        }.`
      );

      setFormData(initialFormData);
      setFieldErrors(initialErrors);

      // # Después del alta navegamos al historial y enviamos el id recién creado.
      // # Así la siguiente pantalla puede refrescar y destacar la encomienda agregada.
      navigate("/conserje/historial", {
        state: {
          recentlyCreatedId: responseData?.id,
          recentlyCreatedRecipient: normalizedData.recipient_name,
        },
      });
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Error al conectar con el servidor."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* # Título principal de la vista */}
      <h1 className="text-2xl font-semibold text-white">
        Registrar encomienda
      </h1>

      {/* # Tarjeta principal del formulario */}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex max-w-xl flex-col gap-4 rounded-xl bg-[#2a2a2a] p-6"
      >
        {/* # Campo compatible con recipient_name del backend */}
        <div>
          <label htmlFor="recipient_name" className="text-sm text-gray-300">
            Nombre residente *
          </label>
          <input
            id="recipient_name"
            type="text"
            name="recipient_name"
            value={formData.recipient_name}
            onChange={handleChange}
            placeholder="Ej: Camila Soto"
            aria-invalid={fieldErrors.recipient_name !== ""}
            className={`mt-1 w-full rounded border bg-[#1f1f1f] p-2 text-white focus:outline-none ${
              fieldErrors.recipient_name
                ? "border-red-500 focus:border-red-400"
                : "border-gray-600 focus:border-green-500"
            }`}
          />
          {fieldErrors.recipient_name && (
            <p className="mt-1 text-sm text-red-400">
              {fieldErrors.recipient_name}
            </p>
          )}
        </div>

        {/* # Campo compatible con apartment_number del backend */}
        <div>
          <label htmlFor="apartment_number" className="text-sm text-gray-300">
            Departamento *
          </label>
          <input
            id="apartment_number"
            type="text"
            name="apartment_number"
            value={formData.apartment_number}
            onChange={handleChange}
            placeholder="Ej: 101 o A-12"
            aria-invalid={fieldErrors.apartment_number !== ""}
            className={`mt-1 w-full rounded border bg-[#1f1f1f] p-2 text-white focus:outline-none ${
              fieldErrors.apartment_number
                ? "border-red-500 focus:border-red-400"
                : "border-gray-600 focus:border-green-500"
            }`}
          />
          {fieldErrors.apartment_number && (
            <p className="mt-1 text-sm text-red-400">
              {fieldErrors.apartment_number}
            </p>
          )}
        </div>

        {/* # Campo compatible con sender del backend */}
        <div>
          <label htmlFor="sender" className="text-sm text-gray-300">
            Remitente *
          </label>
          <input
            id="sender"
            type="text"
            name="sender"
            value={formData.sender}
            onChange={handleChange}
            placeholder="Ej: Mercado Libre"
            aria-invalid={fieldErrors.sender !== ""}
            className={`mt-1 w-full rounded border bg-[#1f1f1f] p-2 text-white focus:outline-none ${
              fieldErrors.sender
                ? "border-red-500 focus:border-red-400"
                : "border-gray-600 focus:border-green-500"
            }`}
          />
          {fieldErrors.sender && (
            <p className="mt-1 text-sm text-red-400">{fieldErrors.sender}</p>
          )}
        </div>

        {/* # Campo compatible con delivery_date del backend */}
        <div>
          <label htmlFor="delivery_date" className="text-sm text-gray-300">
            Fecha de entrega *
          </label>
          <input
            id="delivery_date"
            type="date"
            name="delivery_date"
            value={formData.delivery_date}
            onChange={handleChange}
            max={maxDeliveryDate}
            aria-invalid={fieldErrors.delivery_date !== ""}
            className={`mt-1 w-full rounded border bg-[#1f1f1f] p-2 text-white focus:outline-none ${
              fieldErrors.delivery_date
                ? "border-red-500 focus:border-red-400"
                : "border-gray-600 focus:border-green-500"
            }`}
          />
          <p className="mt-1 text-xs text-gray-500">
            Fecha maxima permitida: {maxDeliveryDate}
          </p>
          {fieldErrors.delivery_date && (
            <p className="mt-1 text-sm text-red-400">
              {fieldErrors.delivery_date}
            </p>
          )}
        </div>

        {/* # Selector visual de urgencia.
            # Por ahora es un dato solo del frontend hasta que el backend soporte ese campo. */}
        <div>
          <p className="text-sm text-gray-300">Urgencia</p>
          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={() => handleUrgencyChange("normal")}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                formData.urgency === "normal"
                  ? "border-gray-300 bg-gray-200 text-gray-900"
                  : "border-gray-600 bg-[#1f1f1f] text-gray-300 hover:bg-[#2f2f2f]"
              }`}
            >
              No urgente
            </button>
            <button
              type="button"
              onClick={() => handleUrgencyChange("urgent")}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                formData.urgency === "urgent"
                  ? "border-red-400 bg-red-500 text-white"
                  : "border-gray-600 bg-[#1f1f1f] text-gray-300 hover:bg-[#2f2f2f]"
              }`}
            >
              Urgente
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {formData.urgency === "urgent"
              ? "Se marcara visualmente como urgente en esta pantalla."
              : "Se registrara como no urgente en esta pantalla."}
          </p>
        </div>

        {/* # Feedback general de error */}
        {errorMessage && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {errorMessage}
          </div>
        )}

        {/* # Feedback general de éxito */}
        {successMessage && (
          <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-300">
            {successMessage}
          </div>
        )}

        {/* # Botón de envío */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-green-600 p-2 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Registrando..." : "Registrar encomienda"}
        </button>
      </form>
    </div>
  );
};

export default Conserje;
