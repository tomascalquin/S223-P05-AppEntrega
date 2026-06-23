import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import {
  PackageApiError,
  createPackage,
  verifyPackageQr,
  type PackageItem,
} from "../services/packages";
import { toastApiError, toastSuccess, toastWarning } from "../lib/toast";

// # Este tipo representa exactamente los nombres que hoy espera el backend.
// # Así evitamos tener que traducir campos antes del fetch.
type PackageFormData = {
  recipient_name: string;
  recipient_email: string;
  apartment_number: string;
  sender: string;
  delivery_date: string;
  urgency: "normal" | "urgent";
};

// # Este tipo guarda los mensajes de error por cada campo visible del formulario.
type PackageFormErrors = {
  recipient_name: string;
  recipient_email: string;
  apartment_number: string;
  sender: string;
  delivery_date: string;
};

// # Este objeto deja los inputs con sus valores iniciales.
// # "normal" queda marcado por defecto para que siempre haya una urgencia elegida.
const initialFormData: PackageFormData = {
  recipient_name: "",
  recipient_email: "",
  apartment_number: "",
  sender: "",
  delivery_date: "",
  urgency: "normal",
};

// # Este objeto deja todos los errores vacíos al inicio.
const initialErrors: PackageFormErrors = {
  recipient_name: "",
  recipient_email: "",
  apartment_number: "",
  sender: "",
  delivery_date: "",
};

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
  const { t } = useI18n();
  const { logout } = useAuth();
  // # Esta navegación nos permite llevar al usuario al historial tras registrar la encomienda.
  const navigate = useNavigate();

  // # Guardamos la fecha máxima permitida para que el usuario no pueda elegir días futuros.
  const maxDeliveryDate = getTodayDateValue();

  // # Estado principal del formulario.
  const [formData, setFormData] = useState<PackageFormData>(initialFormData);

  // # Estado para mensajes de error por campo.
  const [fieldErrors, setFieldErrors] =
    useState<PackageFormErrors>(initialErrors);

  // # Estado para bloquear el botón mientras se realiza el POST.
  const [isSubmitting, setIsSubmitting] = useState(false);
  // # Estado del lector QR: el conserje escanea el QR que recibió el residente por correo.
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [isVerifyingQr, setIsVerifyingQr] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const [verifiedPackage, setVerifiedPackage] = useState<PackageItem | null>(null);

  // # html5-qrcode administra la cámara fuera de React; guardamos la instancia para poder detenerla.
  const scannerRef = useRef<Html5Qrcode | null>(null);
  // # Evita validar dos veces si la cámara lee el mismo QR en frames consecutivos.
  const hasScannedQrRef = useRef(false);

  // # Esta función valida solo los campos que actualmente usa el backend.
  const validateForm = (values: PackageFormData) => {
    const nextErrors: PackageFormErrors = { ...initialErrors };

    if (!values.recipient_name.trim()) {
      nextErrors.recipient_name = t("conserje.validation.recipient.required");
    }

    if (!values.recipient_email.trim()) {
      nextErrors.recipient_email = t("conserje.validation.recipientEmail.required");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.recipient_email.trim())) {
      // # Sin un correo válido el backend no puede enviar el QR al residente.
      nextErrors.recipient_email = t("conserje.validation.recipientEmail.invalid");
    }

    if (!values.apartment_number.trim()) {
      nextErrors.apartment_number = t("conserje.validation.apartment.required");
    } else if (!/^[A-Za-z0-9-]{1,10}$/.test(values.apartment_number.trim())) {
      nextErrors.apartment_number = t("conserje.validation.apartment.invalid");
    }

    if (!values.sender.trim()) {
      nextErrors.sender = t("conserje.validation.sender.required");
    }

    if (!values.delivery_date.trim()) {
      nextErrors.delivery_date = t("conserje.validation.deliveryDate.required");
    } else if (isDateAfterToday(values.delivery_date, maxDeliveryDate)) {
      nextErrors.delivery_date = t("conserje.validation.deliveryDate.future");
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
  };

  // # Este handler controla la urgencia con dos botones.
  // # Se guarda en el estado para que la interfaz muestre la selección actual.
  const handleUrgencyChange = (urgency: "normal" | "urgent") => {
    setFormData((current) => ({
      ...current,
      urgency,
    }));
  };

  const submitQrVerification = async (retrievalCode: string) => {
    // # Este valor viene directamente del QR escaneado; el backend decide si sigue activo.
    setIsVerifyingQr(true);
    setScannerError("");
    setVerifiedPackage(null);

    try {
      const verification = await verifyPackageQr(retrievalCode);

      setVerifiedPackage(verification.package);
      toastSuccess(
        verification.message ??
          t("conserje.verify.success", {
            recipient: verification.package.recipient_name,
          })
      );
    } catch (error) {
      console.error(error);

      if (
        error instanceof PackageApiError &&
        error.code === "UNAUTHORIZED"
      ) {
        logout();
        navigate("/", { replace: true });
        return;
      }

      setScannerError(
        error instanceof Error ? error.message : t("conserje.verify.error")
      );
      toastApiError(error);
    } finally {
      setIsVerifyingQr(false);
    }
  };

  const stopQrScanner = async (shouldUpdateState = true) => {
    const scanner = scannerRef.current;

    if (!scanner) {
      if (shouldUpdateState) {
        setIsScannerActive(false);
      }
      return;
    }

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }

      scanner.clear();
    } catch (error) {
      console.error(error);
    } finally {
      scannerRef.current = null;
      hasScannedQrRef.current = false;

      if (shouldUpdateState) {
        setIsScannerActive(false);
      }
    }
  };

  const startQrScanner = async () => {
    setScannerError("");
    setVerifiedPackage(null);

    try {
      setIsScannerActive(true);

      const scanner = new Html5Qrcode("package-qr-reader");
      scannerRef.current = scanner;
      hasScannedQrRef.current = false;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 240, height: 240 },
        },
        (decodedText) => {
          if (hasScannedQrRef.current) {
            return;
          }

          const retrievalCode = decodedText.trim();

          if (!retrievalCode) {
            return;
          }

          // # Al primer QR válido detenemos la cámara y validamos el retiro una sola vez.
          hasScannedQrRef.current = true;
          void stopQrScanner();
          void submitQrVerification(retrievalCode);
        },
        () => {
          // # Este callback se dispara constantemente mientras busca un QR; lo dejamos silencioso.
        }
      );
    } catch (error) {
      console.error(error);
      scannerRef.current = null;
      setIsScannerActive(false);
      setScannerError(t("conserje.verify.scanner.error"));
    }
  };

  const handleToggleScanner = () => {
    if (isScannerActive) {
      void stopQrScanner();
      return;
    }

    void startQrScanner();
  };

  useEffect(() => {
    return () => {
      void stopQrScanner(false);
    };
  }, []);

  // # Este submit:
  // # 1. Valida campos
  // # 2. Arma un payload compatible con el backend
  // # 3. Envía el POST
  // # 4. Muestra éxito o error
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // # Normalizamos los datos antes de validarlos y enviarlos.
    const normalizedData: PackageFormData = {
      recipient_name: formData.recipient_name.trim(),
      recipient_email: formData.recipient_email.trim().toLowerCase(),
      apartment_number: formData.apartment_number.trim().toUpperCase(),
      sender: formData.sender.trim(),
      delivery_date: formData.delivery_date,
      urgency: formData.urgency,
    };

    const validationErrors = validateForm(normalizedData);
    setFieldErrors(validationErrors);

    if (hasValidationErrors(validationErrors)) {
      toastWarning(t("conserje.validation.general"));
      return;
    }

    setIsSubmitting(true);

    try {
      // # Este payload usa exactamente los nombres que espera el backend.
      // # La urgencia sigue siendo visual en frontend porque la tabla actual no guarda ese dato.
      const payload = {
        recipient_name: normalizedData.recipient_name,
        // # Este email es imprescindible porque el backend enviará ahí el QR de retiro.
        recipient_email: normalizedData.recipient_email,
        apartment_number: normalizedData.apartment_number,
        sender: normalizedData.sender,
        delivery_date: normalizedData.delivery_date,
      };

      // # `createPackage` ya se encarga de:
      // # 1. Hacer el POST
      // # 2. Validar que la respuesta tenga la forma correcta
      // # 3. Lanzar errores claros si algo falla
      const createdPackage = await createPackage(payload);

      // # Incluimos la urgencia en el mensaje visual para que el usuario vea qué eligió,
      // # aunque por ahora esa información no viaje al backend.
      toastSuccess(
        t("conserje.success", {
          urgency: t(
            normalizedData.urgency === "urgent"
              ? "conserje.success_urgency.urgent"
              : "conserje.success_urgency.normal"
          ),
        })
      );

      setFormData(initialFormData);
      setFieldErrors(initialErrors);

      // # Después del alta navegamos al historial y enviamos el id recién creado.
      // # Así la siguiente pantalla puede refrescar y destacar la encomienda agregada.
      navigate("/conserje/historial", {
        state: {
          recentlyCreatedId: createdPackage.id,
          recentlyCreatedRecipient: createdPackage.recipient_name,
        },
      });
    } catch (error) {
      console.error(error);

      // # Si el backend rechaza la sesión, sacamos al usuario del área protegida
      // # para que no siga operando con un token vencido o inexistente.
      if (
        error instanceof PackageApiError &&
        error.code === "UNAUTHORIZED"
      ) {
        logout();
        navigate("/", { replace: true });
        return;
      }

      toastApiError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* # Título principal de la vista */}
      <h1 className="text-2xl font-semibold text-white">
        {t("conserje.title")}
      </h1>

      {/* # El conserje escanea el QR enviado por correo al residente para confirmar el retiro. */}
      <section className="flex w-full max-w-xl flex-col gap-4 rounded-xl border border-emerald-500/20 bg-[#2a2a2a] p-4 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold text-white">
            {t("conserje.verify.title")}
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            {t("conserje.verify.description")}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleToggleScanner}
            disabled={isVerifyingQr}
            className="rounded border border-emerald-500/40 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isScannerActive
              ? t("conserje.verify.scanner.stop")
              : t("conserje.verify.scanner.start")}
          </button>
          <p className="text-xs text-gray-500">
            {t("conserje.verify.scanner.help")}
          </p>
          {scannerError && (
            <p className="text-sm text-red-400">{scannerError}</p>
          )}
        </div>

        <div
          id="package-qr-reader"
          // # html5-qrcode inserta aquí el video de la cámara mientras el lector está activo.
          className={`overflow-hidden rounded-lg border border-white/10 bg-[#1f1f1f] ${
            isScannerActive ? "block min-h-72" : "hidden"
          }`}
        />

        {verifiedPackage && (
          // # Confirmación visible para que el conserje vea qué paquete quedó entregado.
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
            <p className="font-semibold">
              {t("conserje.verify.resultTitle")}
            </p>
            <p>{t("conserje.verify.resultRecipient", { recipient: verifiedPackage.recipient_name })}</p>
            <p>{t("conserje.verify.resultApartment", { apartment: verifiedPackage.apartment_number })}</p>
            <p>{t("conserje.verify.resultSender", { sender: verifiedPackage.sender })}</p>
          </div>
        )}
      </section>

      {/* # Tarjeta principal del formulario */}
      <form
        onSubmit={handleSubmit}
        noValidate
        // # Formulario responsive: 1 columna en mobile, 2 columnas en tablet/desktops.
        className="grid w-full max-w-xl grid-cols-1 gap-4 rounded-xl bg-[#2a2a2a] p-4 sm:grid-cols-2 sm:p-6"
      >
        {/* # Campo compatible con recipient_name del backend */}
        <div>
          <label htmlFor="recipient_name" className="text-sm text-gray-300">
            {t("conserje.field.recipient")}
          </label>
          <input
            id="recipient_name"
            type="text"
            name="recipient_name"
            value={formData.recipient_name}
            onChange={handleChange}
            placeholder={t("conserje.placeholder.recipient")}
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

        {/* # Este correo recibe el QR que luego el residente mostrará al conserje. */}
        <div>
          <label htmlFor="recipient_email" className="text-sm text-gray-300">
            {t("conserje.field.recipientEmail")}
          </label>
          <input
            id="recipient_email"
            type="email"
            name="recipient_email"
            value={formData.recipient_email}
            onChange={handleChange}
            placeholder={t("conserje.placeholder.recipientEmail")}
            aria-invalid={fieldErrors.recipient_email !== ""}
            className={`mt-1 w-full rounded border bg-[#1f1f1f] p-2 text-white focus:outline-none ${
              fieldErrors.recipient_email
                ? "border-red-500 focus:border-red-400"
                : "border-gray-600 focus:border-green-500"
            }`}
          />
          {fieldErrors.recipient_email && (
            <p className="mt-1 text-sm text-red-400">
              {fieldErrors.recipient_email}
            </p>
          )}
        </div>

        {/* # Campo compatible con apartment_number del backend */}
        <div>
          <label htmlFor="apartment_number" className="text-sm text-gray-300">
            {t("conserje.field.apartment")}
          </label>
          <input
            id="apartment_number"
            type="text"
            name="apartment_number"
            value={formData.apartment_number}
            onChange={handleChange}
            placeholder={t("conserje.placeholder.apartment")}
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
            {t("conserje.field.sender")}
          </label>
          <input
            id="sender"
            type="text"
            name="sender"
            value={formData.sender}
            onChange={handleChange}
            placeholder={t("conserje.placeholder.sender")}
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
            {t("conserje.field.deliveryDate")}
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
            {t("conserje.maxDate", { date: maxDeliveryDate })}
          </p>
          {fieldErrors.delivery_date && (
            <p className="mt-1 text-sm text-red-400">
              {fieldErrors.delivery_date}
            </p>
          )}
        </div>

        {/* # Selector visual de urgencia.
            # En mobile ocupa toda la fila para evitar controles demasiado apretados. */}
        <div className="sm:col-span-2">
          <p className="text-sm text-gray-300">{t("conserje.field.urgency")}</p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => handleUrgencyChange("normal")}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                formData.urgency === "normal"
                  ? "border-gray-300 bg-gray-200 text-gray-900"
                  : "border-gray-600 bg-[#1f1f1f] text-gray-300 hover:bg-[#2f2f2f]"
              }`}
            >
              {t("conserje.urgency.normal")}
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
              {t("conserje.urgency.urgent")}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {formData.urgency === "urgent"
              ? t("conserje.urgency.urgentHelp")
              : t("conserje.urgency.normalHelp")}
          </p>
        </div>

        {/* # Botón de envío */}
        {/* # En mobile el botón ocupa todo el ancho, en tablet se alinea a la derecha. */}
        <div className="sm:col-span-2 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded bg-green-600 p-2 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isSubmitting ? t("conserje.submitting") : t("conserje.submit")}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Conserje;
