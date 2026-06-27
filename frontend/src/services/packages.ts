import { getStoredAccessToken } from "./auth";

export type PackageStatus = "received" | "delivered" | "pending" | "atraso";

export type PackageItem = {
  id: number;
  recipient_name: string;
  apartment_number: string;
  description: string | null;
  sender: string;
  delivery_date: string | null;
  status: PackageStatus;
  created_at: string;
};

export type CreatePackagePayload = {
  recipient_name: string;
  apartment_number: string;
  sender: string;
  delivery_date: string;
  description?: string | null;
  status?: PackageStatus;
};

export type UpdatePackagePayload = {
  recipient_name?: string;
  apartment_number?: string;
  sender?: string;
  delivery_date?: string | null;
  description?: string | null;
  status?: PackageStatus;
};

export type PackageFilters = {
  recipient_name?: string;
  apartment_number?: string;
  status?: PackageStatus;
};

type ApiResponseData = Record<string, unknown>;

type PackageCollectionResponse = {
  packages: PackageItem[];
};

type PackageMutationResponse = {
  id: number;
  package: PackageItem;
  message?: string;
};

type PackageErrorCode =
  | "NETWORK_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INVALID_RESPONSE"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "UNKNOWN";

// # Dejamos la URL configurable por variable de entorno,
// # pero mantenemos un fallback para que el proyecto siga funcionando en local.
const API_URL = import.meta.env.VITE_API_URL?.trim() || "http://localhost:3001";

// # Esta clase agrega contexto técnico al error para que la UI pueda distinguir
// # entre un problema de sesión, permisos, validación o una respuesta mal formada.
export class PackageApiError extends Error {
  code: PackageErrorCode;
  status?: number;

  constructor(code: PackageErrorCode, message: string, status?: number) {
    super(message);
    this.name = "PackageApiError";
    this.code = code;
    this.status = status;
  }
}

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const isPackageStatus = (value: unknown): value is PackageStatus => {
  return (
    value === "received" ||
    value === "delivered" ||
    value === "pending" ||
    value === "atraso"
  );
};

// # Validamos cada paquete recibido antes de usarlo en React.
// # Así evitamos que una respuesta mal formada rompa la UI en tiempo de render.
const isPackageItem = (value: unknown): value is PackageItem => {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.id === "number" &&
    typeof value.recipient_name === "string" &&
    typeof value.apartment_number === "string" &&
    (typeof value.description === "string" || value.description === null) &&
    typeof value.sender === "string" &&
    (typeof value.delivery_date === "string" || value.delivery_date === null) &&
    typeof value.created_at === "string" &&
    isPackageStatus(value.status)
  );
};

const readJsonResponse = async (response: Response) => {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return null;
  }

  try {
    const data: unknown = await response.json();
    return isObject(data) ? data : null;
  } catch {
    throw new PackageApiError(
      "INVALID_RESPONSE",
      "El servidor respondio con un JSON invalido.",
      response.status
    );
  }
};

const extractErrorMessage = (
  data: ApiResponseData | null,
  fallbackMessage: string
) => {
  if (typeof data?.message === "string" && data.message.trim()) {
    return data.message;
  }

  if (typeof data?.error === "string" && data.error.trim()) {
    return data.error;
  }

  return fallbackMessage;
};

const buildAuthorizedRequest = (init: RequestInit) => {
  const token = getStoredAccessToken();

  if (!token) {
    throw new PackageApiError(
      "UNAUTHORIZED",
      "Tu sesion ya no es valida. Inicia sesion nuevamente."
    );
  }

  return {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  } satisfies RequestInit;
};

// # Esta función concentra toda la comunicación con `fetch`.
// # Las pantallas solo trabajan con datos ya validados o con errores claros.
const request = async (
  path: string,
  init: RequestInit,
  fallbackMessage: string
) => {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, buildAuthorizedRequest(init));
  } catch (error) {
    if (error instanceof PackageApiError) {
      throw error;
    }

    throw new PackageApiError(
      "NETWORK_ERROR",
      "No se pudo conectar con el servidor."
    );
  }

  const data = await readJsonResponse(response);

  if (!response.ok) {
    const code: PackageErrorCode =
      response.status === 401
        ? "UNAUTHORIZED"
        : response.status === 403
          ? "FORBIDDEN"
          : response.status === 400
            ? "VALIDATION_ERROR"
            : response.status === 404
              ? "NOT_FOUND"
              : "UNKNOWN";

    throw new PackageApiError(
      code,
      extractErrorMessage(data, fallbackMessage),
      response.status
    );
  }

  return data;
};

const buildPackageFromUnknown = (value: unknown) => {
  if (!isPackageItem(value)) {
    throw new PackageApiError(
      "INVALID_RESPONSE",
      "El servidor respondio con un formato de paquete invalido."
    );
  }

  return value;
};

const buildCollectionResponse = (data: ApiResponseData | null) => {
  if (!Array.isArray(data?.packages)) {
    throw new PackageApiError(
      "INVALID_RESPONSE",
      "El servidor no devolvio una lista de encomiendas valida."
    );
  }

  return {
    packages: data.packages.map((item) => buildPackageFromUnknown(item)),
  } satisfies PackageCollectionResponse;
};

const buildMutationResponse = (data: ApiResponseData | null) => {
  if (typeof data?.id !== "number") {
    throw new PackageApiError(
      "INVALID_RESPONSE",
      "El servidor no devolvio el id del registro."
    );
  }

  return {
    id: data.id,
    package: buildPackageFromUnknown(data.package),
    message: typeof data.message === "string" ? data.message : undefined,
  } satisfies PackageMutationResponse;
};

export const fetchPackages = async (filters: PackageFilters = {}) => {
  const searchParams = new URLSearchParams();

  // # Solo agregamos los filtros que realmente vienen con contenido,
  // # para no ensuciar la URL con parámetros vacíos.
  if (filters.recipient_name?.trim()) {
    searchParams.set("recipient_name", filters.recipient_name.trim());
  }

  if (filters.apartment_number?.trim()) {
    searchParams.set("apartment_number", filters.apartment_number.trim());
  }

  if (filters.status) {
    searchParams.set("status", filters.status);
  }

  const queryString = searchParams.toString();
  const responseData = await request(
    `/api/packages${queryString ? `?${queryString}` : ""}`,
    { method: "GET" },
    "No se pudieron cargar las encomiendas."
  );

  return buildCollectionResponse(responseData).packages;
};

export const createPackage = async (payload: CreatePackagePayload) => {
  const responseData = await request(
    "/api/packages",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "No se pudo registrar la encomienda."
  );

  return buildMutationResponse(responseData).package;
};

export const updatePackage = async (
  id: number,
  payload: UpdatePackagePayload
) => {
  const responseData = await request(
    `/api/packages/${id}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "No se pudo actualizar la encomienda."
  );

  return buildMutationResponse(responseData).package;
};

/**
 * Actualiza el estado de un paquete
 * Solo disponible para conserjes
 * Estados válidos: received, pending, delivered, atraso
 */
export const updatePackageStatus = async (
  packageId: number,
  status: PackageStatus
) => {
  const responseData = await request(
    `/api/role-based/admin/packages/${packageId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    },
    "No se pudo actualizar el estado de la encomienda."
  );

  return buildPackageFromUnknown(responseData?.package ?? responseData);
};
