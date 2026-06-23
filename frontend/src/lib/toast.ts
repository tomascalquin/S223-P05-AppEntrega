import { toast } from "sonner";

const DEFAULT_MESSAGES = {
  success: "Operación realizada correctamente.",
  error: "Ha ocurrido un error.",
  warning: "Revisa la información ingresada.",
  info: "Información actualizada.",
  unexpected: "Ha ocurrido un error inesperado.",
} as const;

export const toastSuccess = (message: string = DEFAULT_MESSAGES.success) => {
  toast.success(message);
};

export const toastError = (message: string = DEFAULT_MESSAGES.error) => {
  toast.error(message);
};

export const toastWarning = (message: string = DEFAULT_MESSAGES.warning) => {
  toast.warning(message);
};

export const toastInfo = (message: string = DEFAULT_MESSAGES.info) => {
  toast.info(message);
};

// # Punto único para mostrar errores de fetch/axios: usa el mensaje que
// # devolvió el backend (las clases de error de los servicios lo exponen en
// # `.message`) y cae al texto genérico solo cuando no hay nada más específico.
export const toastApiError = (error: unknown) => {
  const message =
    error instanceof Error && error.message.trim()
      ? error.message
      : DEFAULT_MESSAGES.unexpected;

  toast.error(message);
};
