import { getStoredAccessToken } from "./auth";

export type ClaimStatus = "open" | "in_review" | "closed";

export type ClaimItem = {
  id: number;
  package_id: number;
  resident_id: number;
  description: string;
  status: ClaimStatus;
  created_at: string;
  package_recipient_name: string;
  package_recipient_email: string;
  package_apartment_number: string;
  package_sender: string;
  resident_name: string;
  resident_email: string;
};

export type CreateClaimPayload = {
  package_id: number;
  description: string;
};

type ClaimCollectionResponse = {
  claims: ClaimItem[];
};

type ClaimMutationResponse = {
  id: number;
  claim: ClaimItem;
  message?: string;
  notification_warning?: string | null;
};

type ApiResponseData = Record<string, unknown>;

type ClaimErrorCode =
  | "NETWORK_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INVALID_RESPONSE"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "NOT_FOUND"
  | "UNKNOWN";

// # Mantiene el mismo origen configurable que el servicio de encomiendas.
const API_URL = import.meta.env.VITE_API_URL?.trim() || "http://localhost:3001";

export class ClaimApiError extends Error {
  code: ClaimErrorCode;
  status?: number;

  constructor(code: ClaimErrorCode, message: string, status?: number) {
    super(message);
    this.name = "ClaimApiError";
    this.code = code;
    this.status = status;
  }
}

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const isClaimStatus = (value: unknown): value is ClaimStatus => {
  // # El frontend replica la lista del backend para rechazar respuestas inconsistentes antes de renderizar.
  return value === "open" || value === "in_review" || value === "closed";
};

const isClaimItem = (value: unknown): value is ClaimItem => {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.id === "number" &&
    typeof value.package_id === "number" &&
    typeof value.resident_id === "number" &&
    typeof value.description === "string" &&
    isClaimStatus(value.status) &&
    typeof value.created_at === "string" &&
    typeof value.package_recipient_name === "string" &&
    typeof value.package_recipient_email === "string" &&
    typeof value.package_apartment_number === "string" &&
    typeof value.package_sender === "string" &&
    typeof value.resident_name === "string" &&
    typeof value.resident_email === "string"
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
    throw new ClaimApiError(
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
    throw new ClaimApiError(
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

const request = async (
  path: string,
  init: RequestInit,
  fallbackMessage: string
) => {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, buildAuthorizedRequest(init));
  } catch (error) {
    if (error instanceof ClaimApiError) {
      throw error;
    }

    throw new ClaimApiError(
      "NETWORK_ERROR",
      "No se pudo conectar con el servidor."
    );
  }

  const data = await readJsonResponse(response);

  if (!response.ok) {
    const code: ClaimErrorCode =
      response.status === 401
        ? "UNAUTHORIZED"
        : response.status === 403
          ? "FORBIDDEN"
          : response.status === 400
            ? "VALIDATION_ERROR"
            : response.status === 404
              ? "NOT_FOUND"
              : response.status === 409
                ? "CONFLICT"
                : "UNKNOWN";

    throw new ClaimApiError(
      code,
      extractErrorMessage(data, fallbackMessage),
      response.status
    );
  }

  return data;
};

const buildClaimFromUnknown = (value: unknown) => {
  if (!isClaimItem(value)) {
    throw new ClaimApiError(
      "INVALID_RESPONSE",
      "El servidor respondio con un formato de reclamo invalido."
    );
  }

  return value;
};

const buildCollectionResponse = (data: ApiResponseData | null) => {
  if (!Array.isArray(data?.claims)) {
    throw new ClaimApiError(
      "INVALID_RESPONSE",
      "El servidor no devolvio una lista de reclamos valida."
    );
  }

  return {
    claims: data.claims.map((item) => buildClaimFromUnknown(item)),
  } satisfies ClaimCollectionResponse;
};

const buildMutationResponse = (data: ApiResponseData | null) => {
  if (typeof data?.id !== "number") {
    throw new ClaimApiError(
      "INVALID_RESPONSE",
      "El servidor no devolvio el id del reclamo."
    );
  }

  return {
    id: data.id,
    claim: buildClaimFromUnknown(data.claim),
    message: typeof data.message === "string" ? data.message : undefined,
    notification_warning:
      typeof data.notification_warning === "string"
        ? data.notification_warning
        : null,
  } satisfies ClaimMutationResponse;
};

export const fetchClaims = async () => {
  const responseData = await request(
    "/api/claims",
    { method: "GET" },
    "No se pudieron cargar los reclamos."
  );

  return buildCollectionResponse(responseData).claims;
};

export const createClaim = async (payload: CreateClaimPayload) => {
  const responseData = await request(
    "/api/claims",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "No se pudo crear el reclamo."
  );

  return buildMutationResponse(responseData).claim;
};

export const updateClaimStatus = async (id: number, status: ClaimStatus) => {
  const responseData = await request(
    `/api/claims/${id}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    },
    "No se pudo actualizar el estado del reclamo."
  );

  return buildMutationResponse(responseData);
};
