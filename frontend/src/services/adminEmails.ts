import type { Role } from "./auth";
import { getStoredAccessToken } from "./auth";

export type AuthorizedEmail = {
  id: string;
  email: string;
  role: Role;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
};

const BASE_URL = (import.meta.env.VITE_AUTH_API_URL as string | undefined)
  ?.replace("/api/auth", "/api/admin") ?? "/api/admin";

// Reutilizamos el lector validado de sesión y devolvemos un HeadersInit homogéneo.
const getAuthHeader = (): Record<string, string> => {
  const token = getStoredAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const fetchAuthorizedEmails = async (): Promise<AuthorizedEmail[]> => {
  const res = await fetch(`${BASE_URL}/authorized-emails`, {
    headers: getAuthHeader(),
  });
  if (!res.ok) throw new Error("Error al cargar correos autorizados");
  const data = (await res.json()) as { emails: AuthorizedEmail[] };
  return data.emails;
};

export const addAuthorizedEmail = async (email: string, role: Role): Promise<AuthorizedEmail> => {
  const res = await fetch(`${BASE_URL}/authorized-emails`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeader() },
    body: JSON.stringify({ email, role }),
  });
  const data = (await res.json()) as { error?: string; id: string; email: string; role: Role };
  if (!res.ok) throw new Error(data.error ?? "Error al agregar correo autorizado");
  return { id: data.id, email: data.email, role: data.role, created_by: null, created_by_name: null, created_at: new Date().toISOString() };
};

export const updateAuthorizedEmailRole = async (id: string, role: Role): Promise<void> => {
  const res = await fetch(`${BASE_URL}/authorized-emails/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeader() },
    body: JSON.stringify({ role }),
  });
  const data = (await res.json()) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Error al actualizar rol");
};

export const deleteAuthorizedEmail = async (id: string): Promise<void> => {
  const res = await fetch(`${BASE_URL}/authorized-emails/${id}`, {
    method: "DELETE",
    headers: getAuthHeader(),
  });
  const data = (await res.json()) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Error al eliminar correo autorizado");
};
