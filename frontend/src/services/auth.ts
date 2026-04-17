export type Role = "conserje" | "residente";

import { getStoredLocale, translateText } from "../i18n/translations";

export type AuthUser = {
  id: string;
  role: Role;
  name: string;
  email: string;
  username: string;
};

export type LoginCredentials = {
  role: Role;
  identifier: string;
  password: string;
};

export type RegisterData = {
  role: Role;
  name: string;
  email: string;
  username: string;
  password: string;
};

type StoredUser = AuthUser & {
  password: string;
};

type LoginApiResponse = {
  message?: string;
  user?: Partial<AuthUser>;
};

type RegisterApiResponse = {
  message?: string;
  user?: Partial<AuthUser>;
};

type AuthErrorCode =
  | "INVALID_CREDENTIALS"
  | "USER_ALREADY_EXISTS"
  | "NETWORK_ERROR"
  | "INVALID_RESPONSE"
  | "UNKNOWN";

const translateAuth = (key: string) => {
  return translateText(getStoredLocale(), key);
};

// # Estos usuarios semilla permiten probar la interfaz mientras no exista un backend real.
const DEMO_USERS: StoredUser[] = [
  {
    id: "con-001",
    role: "conserje",
    name: "Camila Torres",
    email: "conserje@encombox.cl",
    username: "conserje",
    password: "Conserje2026!",
  },
  {
    id: "res-001",
    role: "residente",
    name: "Matias Rojas",
    email: "residente@encombox.cl",
    username: "residente",
    password: "Residente2026!",
  },
];

const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL?.trim();
const REGISTERED_USERS_STORAGE_KEY = "encombox.auth.registered-users";

const wait = (milliseconds: number) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

const normalizeIdentifier = (value: string) => value.trim().toLowerCase();

const isRole = (value: unknown): value is Role => {
  return value === "conserje" || value === "residente";
};

const isStoredUser = (value: unknown): value is StoredUser => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const user = value as Record<string, unknown>;

  return (
    typeof user.id === "string" &&
    typeof user.name === "string" &&
    typeof user.email === "string" &&
    typeof user.username === "string" &&
    typeof user.password === "string" &&
    isRole(user.role)
  );
};

const getRegisteredUsers = (): StoredUser[] => {
  const storedUsers = window.localStorage.getItem(REGISTERED_USERS_STORAGE_KEY);

  if (!storedUsers) {
    return [];
  }

  try {
    const parsedUsers: unknown = JSON.parse(storedUsers);

    return Array.isArray(parsedUsers)
      ? parsedUsers.filter((user) => isStoredUser(user))
      : [];
  } catch {
    return [];
  }
};

const saveRegisteredUsers = (users: StoredUser[]) => {
  window.localStorage.setItem(
    REGISTERED_USERS_STORAGE_KEY,
    JSON.stringify(users)
  );
};

const getAllUsers = () => {
  // # Mezclamos usuarios demo y usuarios creados en el navegador para que ambos puedan iniciar sesión.
  return [...DEMO_USERS, ...getRegisteredUsers()];
};

const sanitizeStoredUser = (user: StoredUser): AuthUser => {
  const { password: _password, ...safeUser } = user;
  return safeUser;
};

const buildUserFromApi = (responseUser: Partial<AuthUser>): AuthUser => {
  if (
    typeof responseUser.id !== "string" ||
    typeof responseUser.name !== "string" ||
    typeof responseUser.email !== "string" ||
    typeof responseUser.username !== "string" ||
    !isRole(responseUser.role)
  ) {
    throw new AuthError(
      "INVALID_RESPONSE",
      translateAuth("auth.errors.invalidResponse")
    );
  }

  return {
    id: responseUser.id,
    name: responseUser.name,
    email: responseUser.email,
    username: responseUser.username,
    role: responseUser.role,
  };
};

export class AuthError extends Error {
  code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

const authenticateWithApi = async (
  credentials: LoginCredentials
): Promise<AuthUser> => {
  let response: Response;

  try {
    response = await fetch(`${AUTH_API_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role: credentials.role,
        identifier: credentials.identifier.trim(),
        password: credentials.password,
      }),
    });
  } catch {
    throw new AuthError(
      "NETWORK_ERROR",
      translateAuth("auth.errors.networkLogin")
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  const responseData: LoginApiResponse | null = contentType.includes(
    "application/json"
  )
    ? await response.json()
    : null;

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new AuthError(
        "INVALID_CREDENTIALS",
        responseData?.message ?? translateAuth("auth.errors.invalidCredentials")
      );
    }

    throw new AuthError(
      "NETWORK_ERROR",
      responseData?.message ??
        translateAuth("auth.errors.networkLogin")
    );
  }

  if (!responseData?.user) {
    throw new AuthError(
      "INVALID_RESPONSE",
      translateAuth("auth.errors.invalidResponse")
    );
  }

  return buildUserFromApi(responseData.user);
};

const authenticateWithLocalUsers = async (
  credentials: LoginCredentials
): Promise<AuthUser> => {
  // # Este fallback mantiene el flujo usable en frontend incluso sin API de autenticación disponible.
  await wait(1100);

  const normalizedIdentifier = normalizeIdentifier(credentials.identifier);
  const matchedUser = getAllUsers().find(
    (user) =>
      user.role === credentials.role &&
      (user.email === normalizedIdentifier ||
        user.username === normalizedIdentifier)
  );

  if (!matchedUser || matchedUser.password !== credentials.password) {
    throw new AuthError(
      "INVALID_CREDENTIALS",
      translateAuth("auth.errors.invalidCredentials")
    );
  }

  return sanitizeStoredUser(matchedUser);
};

const registerWithApi = async (data: RegisterData): Promise<AuthUser> => {
  let response: Response;

  try {
    response = await fetch(`${AUTH_API_URL}/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role: data.role,
        name: data.name.trim(),
        email: data.email.trim(),
        username: data.username.trim(),
        password: data.password,
      }),
    });
  } catch {
    throw new AuthError(
      "NETWORK_ERROR",
      translateAuth("auth.errors.networkRegister")
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  const responseData: RegisterApiResponse | null = contentType.includes(
    "application/json"
  )
    ? await response.json()
    : null;

  if (!response.ok) {
    if (response.status === 409) {
      throw new AuthError(
        "USER_ALREADY_EXISTS",
        responseData?.message ??
          translateAuth("auth.errors.userAlreadyExists")
      );
    }

    throw new AuthError(
      "NETWORK_ERROR",
      responseData?.message ??
        translateAuth("auth.errors.networkRegister")
    );
  }

  if (!responseData?.user) {
    throw new AuthError(
      "INVALID_RESPONSE",
      translateAuth("auth.errors.invalidResponse")
    );
  }

  return buildUserFromApi(responseData.user);
};

const registerWithLocalUsers = async (data: RegisterData): Promise<AuthUser> => {
  // # El registro local guarda cuentas nuevas en localStorage para reutilizarlas después en el login.
  await wait(1200);

  const normalizedEmail = normalizeIdentifier(data.email);
  const normalizedUsername = normalizeIdentifier(data.username);
  const users = getAllUsers();

  const alreadyExists = users.some(
    (user) =>
      user.email === normalizedEmail || user.username === normalizedUsername
  );

  if (alreadyExists) {
    throw new AuthError(
      "USER_ALREADY_EXISTS",
      translateAuth("auth.errors.userAlreadyExists")
    );
  }

  const newUser: StoredUser = {
    id: `usr-${crypto.randomUUID()}`,
    role: data.role,
    name: data.name.trim(),
    email: normalizedEmail,
    username: normalizedUsername,
    password: data.password,
  };

  const registeredUsers = getRegisteredUsers();
  saveRegisteredUsers([...registeredUsers, newUser]);

  return sanitizeStoredUser(newUser);
};

export const authenticateUser = async (
  credentials: LoginCredentials
): Promise<AuthUser> => {
  if (AUTH_API_URL) {
    return authenticateWithApi(credentials);
  }

  return authenticateWithLocalUsers(credentials);
};

export const registerUser = async (data: RegisterData): Promise<AuthUser> => {
  if (AUTH_API_URL) {
    return registerWithApi(data);
  }

  return registerWithLocalUsers(data);
};

export const getHomePathForRole = (role: Role) => {
  return role === "conserje" ? "/conserje" : "/residente";
};

export const getAuthErrorMessage = (error: unknown) => {
  if (error instanceof AuthError) {
    return error.message;
  }

  return translateAuth("auth.errors.generic");
};
