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

export type PendingOtpChallenge = {
  otpSessionId: string;
  otpExpiresAt: string;
  otpCode?: string;
};

export type LoginResult =
  | {
      status: "authenticated";
      user: AuthUser;
    }
  | {
      status: "otp_required";
      challenge: PendingOtpChallenge;
    };

type StoredUser = AuthUser & {
  password: string;
};

type LoginApiResponse = {
  message?: string;
  user?: Partial<AuthUser>;
  requiresOtp?: boolean;
  otpSessionId?: string;
  otpExpiresAt?: string;
  otpCode?: string;
};

type RegisterApiResponse = {
  message?: string;
  user?: Partial<AuthUser>;
};

type VerifyOtpApiResponse = {
  message?: string;
  user?: Partial<AuthUser>;
};

type AuthErrorCode =
  | "INVALID_CREDENTIALS"
  | "USER_ALREADY_EXISTS"
  | "INVALID_OTP"
  | "OTP_EXPIRED"
  | "NETWORK_ERROR"
  | "INVALID_RESPONSE"
  | "UNKNOWN";

type LocalOtpChallenge = PendingOtpChallenge & {
  otpCode: string;
  user: StoredUser;
};

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

const AUTH_API_URL =
  import.meta.env.VITE_AUTH_API_URL?.trim() || "http://localhost:3001/api/auth";
const REGISTERED_USERS_STORAGE_KEY = "encombox.auth.registered-users";
const OTP_LENGTH = 6;
const OTP_EXPIRATION_MINUTES = 5;
const localOtpChallenges = new Map<string, LocalOtpChallenge>();

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

const buildOtpChallenge = (
  response: Pick<LoginApiResponse, "otpSessionId" | "otpExpiresAt" | "otpCode">
): PendingOtpChallenge => {
  if (
    typeof response.otpSessionId !== "string" ||
    typeof response.otpExpiresAt !== "string"
  ) {
    throw new AuthError(
      "INVALID_RESPONSE",
      translateAuth("auth.errors.invalidResponse")
    );
  }

  return {
    otpSessionId: response.otpSessionId,
    otpExpiresAt: response.otpExpiresAt,
    otpCode: response.otpCode,
  };
};

const createLocalOtpCode = () => {
  const maxValue = 10 ** OTP_LENGTH;
  return Math.floor(Math.random() * maxValue)
    .toString()
    .padStart(OTP_LENGTH, "0");
};

const createLocalOtpChallenge = (user: StoredUser): PendingOtpChallenge => {
  const otpCode = createLocalOtpCode();
  const otpSessionId = crypto.randomUUID();
  const otpExpiresAt = new Date(
    Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000
  ).toISOString();

  // # Guardamos el OTP en memoria para poder simular el segundo factor cuando
  // # el proyecto corre solo con frontend.
  localOtpChallenges.set(otpSessionId, {
    otpSessionId,
    otpExpiresAt,
    otpCode,
    user,
  });

  return {
    otpSessionId,
    otpExpiresAt,
    otpCode,
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

const parseJsonResponse = async <T>(response: Response): Promise<T | null> => {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return null;
  }

  return (await response.json()) as T;
};

const authenticateWithApi = async (
  credentials: LoginCredentials
): Promise<LoginResult> => {
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

  const responseData = await parseJsonResponse<LoginApiResponse>(response);

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new AuthError(
        "INVALID_CREDENTIALS",
        responseData?.message ?? translateAuth("auth.errors.invalidCredentials")
      );
    }

    throw new AuthError(
      "NETWORK_ERROR",
      responseData?.message ?? translateAuth("auth.errors.networkLogin")
    );
  }

  if (responseData?.requiresOtp) {
    return {
      status: "otp_required",
      challenge: buildOtpChallenge(responseData),
    };
  }

  if (!responseData?.user) {
    throw new AuthError(
      "INVALID_RESPONSE",
      translateAuth("auth.errors.invalidResponse")
    );
  }

  return {
    status: "authenticated",
    user: buildUserFromApi(responseData.user),
  };
};

const authenticateWithLocalUsers = async (
  credentials: LoginCredentials
): Promise<LoginResult> => {
  // # Este fallback mantiene el flujo usable incluso si el backend aún no está levantado.
  await wait(900);

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

  return {
    status: "otp_required",
    challenge: createLocalOtpChallenge(matchedUser),
  };
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

  const responseData = await parseJsonResponse<RegisterApiResponse>(response);

  if (!response.ok) {
    if (response.status === 409) {
      throw new AuthError(
        "USER_ALREADY_EXISTS",
        responseData?.message ?? translateAuth("auth.errors.userAlreadyExists")
      );
    }

    throw new AuthError(
      "NETWORK_ERROR",
      responseData?.message ?? translateAuth("auth.errors.networkRegister")
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

const verifyOtpWithApi = async (
  challenge: PendingOtpChallenge,
  otpCode: string
): Promise<AuthUser> => {
  let response: Response;

  try {
    response = await fetch(`${AUTH_API_URL}/verify-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        otpSessionId: challenge.otpSessionId,
        otpCode,
      }),
    });
  } catch {
    throw new AuthError(
      "NETWORK_ERROR",
      translateAuth("auth.errors.networkOtp")
    );
  }

  const responseData = await parseJsonResponse<VerifyOtpApiResponse>(response);

  if (!response.ok) {
    const translatedMessage =
      response.status === 401 &&
      new Date(challenge.otpExpiresAt).getTime() < Date.now()
        ? translateAuth("auth.errors.otpExpired")
        : translateAuth("auth.errors.invalidOtp");

    throw new AuthError(
      response.status === 401 ? "INVALID_OTP" : "NETWORK_ERROR",
      responseData?.message ?? translatedMessage
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

const verifyOtpWithLocalUsers = async (
  challenge: PendingOtpChallenge,
  otpCode: string
): Promise<AuthUser> => {
  await wait(700);

  const storedChallenge = localOtpChallenges.get(challenge.otpSessionId);

  if (!storedChallenge) {
    throw new AuthError("OTP_EXPIRED", translateAuth("auth.errors.otpExpired"));
  }

  const expiresAtTime = new Date(storedChallenge.otpExpiresAt).getTime();

  if (Number.isNaN(expiresAtTime) || expiresAtTime < Date.now()) {
    localOtpChallenges.delete(challenge.otpSessionId);
    throw new AuthError("OTP_EXPIRED", translateAuth("auth.errors.otpExpired"));
  }

  if (storedChallenge.otpCode !== otpCode) {
    throw new AuthError("INVALID_OTP", translateAuth("auth.errors.invalidOtp"));
  }

  localOtpChallenges.delete(challenge.otpSessionId);
  return sanitizeStoredUser(storedChallenge.user);
};

export const authenticateUser = async (
  credentials: LoginCredentials
): Promise<LoginResult> => {
  try {
    return await authenticateWithApi(credentials);
  } catch (error) {
    if (
      error instanceof AuthError &&
      error.code !== "NETWORK_ERROR"
    ) {
      throw error;
    }
  }

  return authenticateWithLocalUsers(credentials);
};

export const verifyOtp = async (
  challenge: PendingOtpChallenge,
  otpCode: string
): Promise<AuthUser> => {
  const normalizedOtp = otpCode.trim();

  try {
    return await verifyOtpWithApi(challenge, normalizedOtp);
  } catch (error) {
    if (
      error instanceof AuthError &&
      error.code !== "NETWORK_ERROR"
    ) {
      throw error;
    }
  }

  return verifyOtpWithLocalUsers(challenge, normalizedOtp);
};

export const registerUser = async (data: RegisterData): Promise<AuthUser> => {
  try {
    return await registerWithApi(data);
  } catch (error) {
    if (
      error instanceof AuthError &&
      error.code !== "NETWORK_ERROR"
    ) {
      throw error;
    }
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
