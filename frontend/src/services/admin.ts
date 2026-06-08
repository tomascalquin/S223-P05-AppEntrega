import type { Role } from "./auth";
import { getStoredAccessToken } from "./auth";

const AUTH_API_BASE = import.meta.env.VITE_AUTH_API_URL?.trim() || "http://localhost:3001/api/auth";
const ADMIN_API_URL = AUTH_API_BASE.replace("/api/auth", "/api/admin");

export type UserEstado = "activo" | "inactivo" | "bloqueado";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  username: string;
  role: Role;
  estado: UserEstado;
  created_at: string;
};

export type AuditLog = {
  id: string;
  admin_id: string | null;
  admin_nombre: string | null;
  accion: string;
  detalles: string | null;
  created_at: string;
};

export type LogsResponse = {
  logs: AuditLog[];
  total: number;
  limite: number;
  offset: number;
};

const authHeaders = () => {
  const token = getStoredAccessToken();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token ?? ""}`,
  };
};

const handleResponse = async <T>(response: Response): Promise<T> => {
  const data = (await response.json()) as { error?: string } & T;
  if (!response.ok) {
    throw new Error((data as { error?: string }).error ?? "Error en la solicitud");
  }
  return data;
};

export const fetchUsers = async (): Promise<AdminUser[]> => {
  const response = await fetch(`${ADMIN_API_URL}/users`, {
    headers: authHeaders(),
  });

  const data = await handleResponse<{ users: AdminUser[] }>(response);
  return data.users;
};

export const updateUserRole = async (userId: string, role: Role): Promise<void> => {
  const response = await fetch(`${ADMIN_API_URL}/users/${userId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ role }),
  });

  await handleResponse(response);
};

export const updateUserEstado = async (userId: string, estado: UserEstado): Promise<void> => {
  const response = await fetch(`${ADMIN_API_URL}/users/${userId}/estado`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ estado }),
  });

  await handleResponse(response);
};

export const deleteUser = async (userId: string): Promise<void> => {
  const response = await fetch(`${ADMIN_API_URL}/users/${userId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  await handleResponse(response);
};

export const fetchLogs = async (limite = 100, offset = 0): Promise<LogsResponse> => {
  const params = new URLSearchParams({ limite: String(limite), offset: String(offset) });
  const response = await fetch(`${ADMIN_API_URL}/logs?${params.toString()}`, {
    headers: authHeaders(),
  });

  return handleResponse<LogsResponse>(response);
};
