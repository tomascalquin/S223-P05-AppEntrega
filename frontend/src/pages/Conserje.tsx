import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

// # Este tipo define la forma exacta de los datos que guarda el formulario.
type PackageFormData = {
  nombre: string;
  departamento: string;
  remitente: string;
  descripcion: string;
};

// # Este tipo guarda los mensajes de error de cada campo.
type PackageFormErrors = Record<keyof PackageFormData, string>;

// # Este objeto nos sirve para reiniciar el formulario cuando todo sale bien.
const initialFormData: PackageFormData = {
  nombre: "",
  departamento: "",
  remitente: "",
  descripcion: "",
};

// # Este objeto deja todos los errores vacíos al principio.
const initialErrors: PackageFormErrors = {
  nombre: "",
  departamento: "",
  remitente: "",
  descripcion: "",
};

// # Aquí dejamos la URL base del backend.
// # El backend de este proyecto corre en el puerto 3001.
const API_URL = "http://localhost:3001";

const Conserje = () => {
  // # Estado principal con los datos escritos por el usuario.
  const [formData, setFormData] = useState<PackageFormData>(initialFormData);

  // # Estado con errores específicos de cada input.
  const [fieldErrors, setFieldErrors] =
    useState<PackageFormErrors>(initialErrors);

  // # Estado para mostrar un error general del formulario o del backend.
  const [errorMessage, setErrorMessage] = useState("");

  // # Estado para mostrar confirmación cuando el registro sale bien.
  const [successMessage, setSuccessMessage] = useState("");

  // # Estado para desactivar el botón mientras se envían los datos.
  const [isSubmitting, setIsSubmitting] = useState(false);

  // # Esta función revisa cada campo y devuelve los errores encontrados.
  const validateForm = (values: PackageFormData) => {
    const nextErrors: PackageFormErrors = { ...initialErrors };

    // # trim() evita que espacios vacíos pasen como datos válidos.
    if (!values.nombre.trim()) {
      nextErrors.nombre = "El nombre del residente es obligatorio.";
    }

    if (!values.departamento.trim()) {
      nextErrors.departamento = "El departamento es obligatorio.";
    } else if (!/^[A-Za-z0-9-]{1,10}$/.test(values.departamento.trim())) {
      nextErrors.departamento =
        "Usa un formato válido, por ejemplo 101 o A-12.";
    }

    if (!values.remitente.trim()) {
      nextErrors.remitente = "El remitente es obligatorio.";
    }

    if (values.descripcion.trim().length > 200) {
      nextErrors.descripcion =
        "La descripción no puede superar los 200 caracteres.";
    }

    return nextErrors;
  };

  // # Esta variable nos ayuda a saber rápido si existe al menos un error.
  const hasValidationErrors = (errors: PackageFormErrors) => {
    return Object.values(errors).some((error) => error !== "");
  };

  // # Este handler actualiza el estado cuando cambias un input.
  // # También limpia el error del campo que se está corrigiendo.
  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));

    setFieldErrors((current) => ({
      ...current,
      [name]: "",
    }));

    // # Limpiamos mensajes generales para que la interfaz responda de inmediato.
    setErrorMessage("");
    setSuccessMessage("");
  };

  // # Este submit hace cuatro pasos:
  // # 1. Evita recargar la página
  // # 2. Valida
  // # 3. Envía al backend
  // # 4. Muestra feedback visual según el resultado
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    // # Normalizamos los datos antes de validarlos y enviarlos.
    const normalizedData: PackageFormData = {
      nombre: formData.nombre.trim(),
      departamento: formData.departamento.trim().toUpperCase(),
      remitente: formData.remitente.trim(),
      descripcion: formData.descripcion.trim(),
    };

    const validationErrors = validateForm(normalizedData);
    setFieldErrors(validationErrors);

    if (hasValidationErrors(validationErrors)) {
      setErrorMessage("Corrige los campos marcados antes de continuar.");
      return;
    }

    setIsSubmitting(true);

    try {
      // # El backend actual espera un payload con recipient_name, description y status.
      // # Como todavía no guarda departamento y remitente en columnas separadas,
      // # los incorporamos dentro de la descripción para no perder información.
      const payload = {
        recipient_name: normalizedData.nombre,
        description: [
          `Departamento: ${normalizedData.departamento}`,
          `Remitente: ${normalizedData.remitente}`,
          normalizedData.descripcion
            ? `Descripcion: ${normalizedData.descripcion}`
            : "",
        ]
          .filter(Boolean)
          .join(" | "),
        status: "received",
      };

      const response = await fetch(`${API_URL}/api/packages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      // # Intentamos leer la respuesta como JSON solo si el backend realmente lo envía.
      const contentType = response.headers.get("content-type") ?? "";
      const responseData = contentType.includes("application/json")
        ? await response.json()
        : null;

      if (!response.ok) {
        const backendMessage =
          responseData?.message ?? "Error al registrar la encomienda.";
        throw new Error(backendMessage);
      }

      // # Dejamos el log por si quieres inspeccionar la respuesta en desarrollo.
      console.log("Respuesta backend:", responseData);

      setSuccessMessage("Encomienda registrada correctamente.");
      setFormData(initialFormData);
      setFieldErrors(initialErrors);
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Error al conectar con el servidor."
      );
    } finally {
      // # Pase lo que pase, el botón vuelve a estar disponible al final.
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* # Título principal de la pantalla */}
      <h1 className="text-2xl font-semibold text-white">
        Registrar encomienda
      </h1>

      {/* # Tarjeta del formulario */}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex max-w-xl flex-col gap-4 rounded-xl bg-[#2a2a2a] p-6"
      >
        {/* # Campo: nombre del residente */}
        <div>
          <label htmlFor="nombre" className="text-sm text-gray-300">
            Nombre residente *
          </label>
          <input
            id="nombre"
            type="text"
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            placeholder="Ej: Camila Soto"
            aria-invalid={fieldErrors.nombre !== ""}
            className={`mt-1 w-full rounded border bg-[#1f1f1f] p-2 text-white focus:outline-none ${
              fieldErrors.nombre
                ? "border-red-500 focus:border-red-400"
                : "border-gray-600 focus:border-green-500"
            }`}
          />
          {fieldErrors.nombre && (
            <p className="mt-1 text-sm text-red-400">{fieldErrors.nombre}</p>
          )}
        </div>

        {/* # Campo: departamento */}
        <div>
          <label htmlFor="departamento" className="text-sm text-gray-300">
            Departamento *
          </label>
          <input
            id="departamento"
            type="text"
            name="departamento"
            value={formData.departamento}
            onChange={handleChange}
            placeholder="Ej: 101 o A-12"
            aria-invalid={fieldErrors.departamento !== ""}
            className={`mt-1 w-full rounded border bg-[#1f1f1f] p-2 text-white focus:outline-none ${
              fieldErrors.departamento
                ? "border-red-500 focus:border-red-400"
                : "border-gray-600 focus:border-green-500"
            }`}
          />
          {fieldErrors.departamento && (
            <p className="mt-1 text-sm text-red-400">
              {fieldErrors.departamento}
            </p>
          )}
        </div>

        {/* # Campo: remitente */}
        <div>
          <label htmlFor="remitente" className="text-sm text-gray-300">
            Remitente *
          </label>
          <input
            id="remitente"
            type="text"
            name="remitente"
            value={formData.remitente}
            onChange={handleChange}
            placeholder="Ej: Mercado Libre"
            aria-invalid={fieldErrors.remitente !== ""}
            className={`mt-1 w-full rounded border bg-[#1f1f1f] p-2 text-white focus:outline-none ${
              fieldErrors.remitente
                ? "border-red-500 focus:border-red-400"
                : "border-gray-600 focus:border-green-500"
            }`}
          />
          {fieldErrors.remitente && (
            <p className="mt-1 text-sm text-red-400">
              {fieldErrors.remitente}
            </p>
          )}
        </div>

        {/* # Campo: descripción */}
        <div>
          <label htmlFor="descripcion" className="text-sm text-gray-300">
            Descripción
          </label>
          <textarea
            id="descripcion"
            name="descripcion"
            value={formData.descripcion}
            onChange={handleChange}
            placeholder="Detalles del paquete, tamaño o instrucciones"
            maxLength={200}
            aria-invalid={fieldErrors.descripcion !== ""}
            className={`mt-1 w-full rounded border bg-[#1f1f1f] p-2 text-white focus:outline-none ${
              fieldErrors.descripcion
                ? "border-red-500 focus:border-red-400"
                : "border-gray-600 focus:border-green-500"
            }`}
          />
          <div className="mt-1 flex items-center justify-between">
            {fieldErrors.descripcion ? (
              <p className="text-sm text-red-400">{fieldErrors.descripcion}</p>
            ) : (
              <p className="text-sm text-gray-500">
                Campo opcional de hasta 200 caracteres.
              </p>
            )}
            <span className="text-xs text-gray-500">
              {formData.descripcion.length}/200
            </span>
          </div>
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

        {/* # Botón principal del formulario */}
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
