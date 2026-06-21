import { getStoredLocale, type TranslationKey } from "./i18n";
import { translate } from "./translationLoader";

export type Role = "conserje" | "residente" | "administrador";

export type AuthUser = {
  id: string;
  role: Role;
  name: string;
  email: string;
  username: string;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
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
      session: AuthSession;
    }
  | {
      status: "otp_required";
      challenge: PendingOtpChallenge;
    };

type LoginApiResponse = {
  message?: string;
  token?: string;
  user?: Partial<AuthUser>;
  requiresOtp?: boolean;
  otpSessionId?: string;
  otpExpiresAt?: string;
  otpCode?: string;
};

type RegisterApiResponse = {
  message?: string;
  token?: string;
  user?: Partial<AuthUser>;
};

type VerifyOtpApiResponse = {
  message?: string;
  token?: string;
  user?: Partial<AuthUser>;
};

type GoogleAuthApiResponse = {
  message?: string;
  error?: string;
  token?: string;
  user?: Partial<AuthUser>;
};

type ProfileApiResponse = {
  message?: string;
  error?: string;
  user?: Partial<AuthUser>;
};

type AuthErrorCode =
  | "INVALID_CREDENTIALS"
  | "USER_ALREADY_EXISTS"
  | "INVALID_OTP"
  | "OTP_EXPIRED"
  | "UNAUTHORIZED"
  | "NETWORK_ERROR"
  | "INVALID_RESPONSE"
  | "UNKNOWN";

const AUTH_API_URL =
  import.meta.env.VITE_AUTH_API_URL?.trim() || "http://localhost:3001/api/auth";

export const AUTH_STORAGE_KEY = "encombox.auth.session";

// # Los servicios sin acceso al contexto React reutilizan el mismo catálogo tipado.
const translateAuth = (key: TranslationKey) => {
  return translate(getStoredLocale(), key);
};

const isRole = (value: unknown): value is Role => {
  return value === "conserje" || value === "residente" || value === "administrador";
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

const buildSessionFromApi = (
  response: Pick<LoginApiResponse, "token" | "user">
): AuthSession => {
  if (typeof response.token !== "string" || !response.token.trim()) {
    throw new AuthError(
      "INVALID_RESPONSE",
      translateAuth("auth.errors.invalidResponse")
    );
  }

  if (!response.user) {
    throw new AuthError(
      "INVALID_RESPONSE",
      translateAuth("auth.errors.invalidResponse")
    );
  }

  return {
    token: response.token,
    user: buildUserFromApi(response.user),
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

  return {
    status: "authenticated",
    session: buildSessionFromApi(responseData ?? {}),
  };
};

const registerWithApi = async (data: RegisterData): Promise<AuthSession> => {
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

  return buildSessionFromApi(responseData ?? {});
};

const verifyOtpWithApi = async (
  challenge: PendingOtpChallenge,
  otpCode: string
): Promise<AuthSession> => {
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

  return buildSessionFromApi(responseData ?? {});
};

const authenticateWithGoogleApi = async (
  googleCredential: string,
  role: Role
): Promise<AuthSession> => {
  let response: Response;

  try {
    response = await fetch(`${AUTH_API_URL}/google`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: googleCredential,
        role,
      }),
    });
  } catch {
    throw new AuthError(
      "NETWORK_ERROR",
      translateAuth("auth.errors.networkLogin")
    );
  }

  const responseData = await parseJsonResponse<GoogleAuthApiResponse>(response);

  if (!response.ok) {
    throw new AuthError(
      response.status === 401 ? "INVALID_CREDENTIALS" : "NETWORK_ERROR",
      responseData?.error ??
        responseData?.message ??
        translateAuth("auth.errors.googleLogin")
    );
  }

  return buildSessionFromApi(responseData ?? {});
};

const isStoredSession = (value: unknown): value is AuthSession => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const session = value as Record<string, unknown>;
  const user =
    typeof session.user === "object" && session.user !== null
      ? (session.user as Record<string, unknown>)
      : null;

  return (
    typeof session.token === "string" &&
    !!session.token.trim() &&
    !!user &&
    typeof user.id === "string" &&
    typeof user.name === "string" &&
    typeof user.email === "string" &&
    typeof user.username === "string" &&
    isRole(user.role)
  );
};

export const getStoredSession = (): AuthSession | null => {
  const storedSession = window.localStorage.getItem(AUTH_STORAGE_KEY);

  if (!storedSession) {
    return null;
  }

  try {
    const parsedSession: unknown = JSON.parse(storedSession);
    return isStoredSession(parsedSession) ? parsedSession : null;
  } catch {
    return null;
  }
};

export const saveStoredSession = (session: AuthSession) => {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
};

export const clearStoredSession = () => {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
};

export const getStoredAccessToken = () => {
  return getStoredSession()?.token ?? null;
};

export const authenticateUser = async (
  credentials: LoginCredentials
): Promise<LoginResult> => {
  return authenticateWithApi(credentials);
};

export const verifyOtp = async (
  challenge: PendingOtpChallenge,
  otpCode: string
): Promise<AuthSession> => {
  return verifyOtpWithApi(challenge, otpCode.trim());
};

export const registerUser = async (data: RegisterData): Promise<AuthSession> => {
  return registerWithApi(data);
};

export const authenticateWithGoogle = async (
  googleCredential: string,
  role: Role
): Promise<AuthSession> => {
  return authenticateWithGoogleApi(googleCredential, role);
};

export const validateStoredSession = async (token: string): Promise<AuthUser> => {
  let response: Response;

  try {
    response = await fetch(`${AUTH_API_URL}/profile`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new AuthError(
      "NETWORK_ERROR",
      translateAuth("auth.errors.networkLogin")
    );
  }

  const responseData = await parseJsonResponse<ProfileApiResponse>(response);

  if (response.status === 401) {
    throw new AuthError(
      "UNAUTHORIZED",
      responseData?.error ?? translateAuth("auth.errors.invalidCredentials")
    );
  }

  if (!response.ok || !responseData?.user) {
    throw new AuthError(
      "INVALID_RESPONSE",
      translateAuth("auth.errors.invalidResponse")
    );
  }

  return buildUserFromApi(responseData.user);
};

export const getHomePathForRole = (role: Role) => {
  if (role === "administrador") return "/admin";
  return role === "conserje" ? "/conserje" : "/residente";
};

export const getAuthErrorMessage = (error: unknown) => {
  if (error instanceof AuthError) {
    return error.message;
  }

  return translateAuth("auth.errors.generic");
};
