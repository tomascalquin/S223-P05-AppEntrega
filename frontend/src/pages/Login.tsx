import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import LanguageSwitcher from "../components/LanguageSwitcher";
import LoadingSpinner from "../components/LoadingSpinner";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import {
  getAuthErrorMessage,
  getHomePathForRole,
  type PendingOtpChallenge,
  type Role,
} from "../services/auth";
import { toastError, toastInfo, toastSuccess } from "../lib/toast";

type AuthMode = "login" | "register";
type AuthStep = "credentials" | "otp";
type RoleTranslationKey = "resident" | "concierge" | "administrator";

type AuthFormState = {
  role: Role;
  name: string;
  email: string;
  username: string;
  identifier: string;
  password: string;
  confirmPassword: string;
  otpCode: string;
};

type AuthFieldErrors = {
  name: string;
  email: string;
  username: string;
  identifier: string;
  password: string;
  confirmPassword: string;
  otpCode: string;
};

const initialFormState: AuthFormState = {
  role: "residente",
  name: "",
  email: "",
  username: "",
  identifier: "",
  password: "",
  confirmPassword: "",
  otpCode: "",
};

const initialFieldErrors: AuthFieldErrors = {
  name: "",
  email: "",
  username: "",
  identifier: "",
  password: "",
  confirmPassword: "",
  otpCode: "",
};

const normalizeRoleTranslationKey = (role: string): RoleTranslationKey => {
  const roleAliases: Record<string, RoleTranslationKey> = {
    resident: "resident",
    residente: "resident",
    concierge: "concierge",
    conserje: "concierge",
    administrador: "administrator",
    admin: "administrator",
    administrator: "administrator",
  };

  return roleAliases[role] ?? "resident";
};

const Login = () => {
  const navigate = useNavigate();
  const redirectTimeoutRef = useRef<number | null>(null);
  const googleButtonContainerRef = useRef<HTMLDivElement | null>(null);

  const {
    login,
    loginWithGoogle,
    verifyOtp,
    register,
    authError,
    isAuthenticating,
    clearAuthError,
  } = useAuth();
  const { t } = useI18n();

  const [mode, setMode] = useState<AuthMode>("login");
  const [authStep, setAuthStep] = useState<AuthStep>("credentials");
  const [formData, setFormData] = useState<AuthFormState>(initialFormState);
  const [fieldErrors, setFieldErrors] =
    useState<AuthFieldErrors>(initialFieldErrors);
  const [isGoogleReady, setIsGoogleReady] = useState(false);
  const [pendingOtpChallenge, setPendingOtpChallenge] =
    useState<PendingOtpChallenge | null>(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? "";

  // # Las tarjetas de rol se reconstruyen con `t(...)` para actualizarse al cambiar idioma sin duplicar JSX.
  const roleOptions = useMemo(
    () =>
      (["residente", "conserje", "administrador"] as const).map((value) => {
        const translationKey = normalizeRoleTranslationKey(value);

        return {
          value,
          label: t(`common.roleLabel.${translationKey}`),
          description: t(`auth.roleDescription.${translationKey}`),
        };
      }),
    [t]
  );

  const validateLoginForm = (values: AuthFormState) => {
    const nextErrors: AuthFieldErrors = { ...initialFieldErrors };
    const normalizedIdentifier = values.identifier.trim();

    if (!normalizedIdentifier) {
      nextErrors.identifier = t("auth.validation.identifier.required");
    } else if (
      normalizedIdentifier.includes("@") &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedIdentifier)
    ) {
      nextErrors.identifier = t("auth.validation.identifier.invalidEmail");
    }

    if (!values.password) {
      nextErrors.password = t("auth.validation.password.required");
    } else if (values.password.length < 8) {
      nextErrors.password = t("auth.validation.password.min");
    }

    return nextErrors;
  };

  const validateRegisterForm = (values: AuthFormState) => {
    const nextErrors: AuthFieldErrors = { ...initialFieldErrors };
    const normalizedName = values.name.trim();
    const normalizedEmail = values.email.trim();
    const normalizedUsername = values.username.trim();

    if (!normalizedName) {
      nextErrors.name = t("auth.validation.name.required");
    } else if (normalizedName.length < 3) {
      nextErrors.name = t("auth.validation.name.min");
    }

    if (!normalizedEmail) {
      nextErrors.email = t("auth.validation.email.required");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      nextErrors.email = t("auth.validation.email.invalid");
    }

    if (!normalizedUsername) {
      nextErrors.username = t("auth.validation.username.required");
    } else if (!/^[a-zA-Z0-9._-]{4,20}$/.test(normalizedUsername)) {
      nextErrors.username = t("auth.validation.username.invalid");
    }

    if (!values.password) {
      nextErrors.password = t("auth.validation.password.create");
    } else if (values.password.length < 8) {
      nextErrors.password = t("auth.validation.password.min");
    }

    if (!values.confirmPassword) {
      nextErrors.confirmPassword = t("auth.validation.confirmPassword.required");
    } else if (values.confirmPassword !== values.password) {
      nextErrors.confirmPassword = t("auth.validation.confirmPassword.match");
    }

    return nextErrors;
  };

  const validateOtpForm = (values: AuthFormState) => {
    const nextErrors: AuthFieldErrors = { ...initialFieldErrors };

    if (!/^\d{6}$/.test(values.otpCode.trim())) {
      nextErrors.otpCode = t("auth.validation.otpCode.invalid");
    }

    return nextErrors;
  };

  const hasValidationErrors = (errors: AuthFieldErrors) => {
    return Object.values(errors).some((error) => error !== "");
  };

  // Declaramos estos helpers antes del Effect Event para que React Compiler pueda seguir sus capturas.
  const resetFeedback = () => {
    if (authError) {
      clearAuthError();
    }
  };

  const handleSuccessfulAuth = (role: Role, message: string) => {
    toastSuccess(message);
    redirectTimeoutRef.current = window.setTimeout(() => {
      navigate(getHomePathForRole(role), { replace: true });
    }, 800);
  };

  const handleGoogleCredential = useEffectEvent(async (credential: string) => {
    resetFeedback();

    try {
      const authenticatedUser = await loginWithGoogle(
        credential,
        formData.role
      );
      handleSuccessfulAuth(
        authenticatedUser.role,
        t("auth.success.google", {
          destination: t(`auth.destination.${authenticatedUser.role}`),
        })
      );
    } catch (error) {
      toastError(getAuthErrorMessage(error));
    }
  });

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current !== null) {
        window.clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  // # useLayoutEffect + espera explícita al evento `load` del script evita la condición de carrera
  // # en la que el tag <script> ya existe (Strict Mode, SPA) pero `window.google` aún no está
  // # disponible: el intento fallaba una vez y nunca se reintentaba, dejando "Cargando..." fijo.
  useLayoutEffect(() => {
    if (!googleClientId || authStep === "otp") {
      return;
    }
    if (!googleButtonContainerRef.current) {
      return;
    }

    let isCancelled = false;
    const scriptId = "google-identity-services";

    const renderGoogleButton = () => {
      if (isCancelled) {
        return;
      }
      const container = googleButtonContainerRef.current;
      if (!container || !window.google?.accounts.id) {
        return;
      }

      // # Limpiamos el contenedor antes de renderizar para evitar botones duplicados
      // # cuando React reejecuta efectos en desarrollo o cambia el modo del formulario.
      container.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: ({ credential }) => {
          if (!credential) {
            return;
          }

          void handleGoogleCredential(credential);
        },
        cancel_on_tap_outside: true,
      });

      window.google.accounts.id.renderButton(container, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "pill",
        width: 320,
        logo_alignment: "left",
      });
      setIsGoogleReady(true);
    };

    const onScriptLoad = () => {
      if (isCancelled) {
        return;
      }
      renderGoogleButton();
    };

    const ensureGsi = () => {
      if (isCancelled) {
        return;
      }
      if (window.google?.accounts?.id) {
        onScriptLoad();
        return;
      }

      const existing = document.getElementById(
        scriptId
      ) as HTMLScriptElement | null;

      if (existing) {
        existing.addEventListener("load", onScriptLoad, { once: true });
        // # Si el script ya terminó (caché) o `window.google` aparece en el mismo tick.
        void queueMicrotask(() => {
          if (isCancelled) {
            return;
          }
          if (window.google?.accounts?.id) {
            onScriptLoad();
          }
        });
        return;
      }

      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.addEventListener("load", onScriptLoad, { once: true });
      document.head.appendChild(script);
      void queueMicrotask(() => {
        if (isCancelled) {
          return;
        }
        if (window.google?.accounts?.id) {
          onScriptLoad();
        }
      });
    };

    ensureGsi();

    return () => {
      isCancelled = true;
      const scriptNode = document.getElementById(scriptId);
      scriptNode?.removeEventListener("load", onScriptLoad);
    };
  }, [authStep, googleClientId, mode, formData.role]);

  const handleModeChange = (nextMode: AuthMode) => {
    // # Al cambiar entre login y registro limpiamos errores previos para no mezclar mensajes de distintos flujos.
    setMode(nextMode);
    setAuthStep("credentials");
    setPendingOtpChallenge(null);
    // El cambio de modo exige que Google vuelva a confirmar cuándo su botón está listo.
    setIsGoogleReady(false);
    setFieldErrors(initialFieldErrors);
    setFormData((current) => ({
      ...current,
      // # El registro público es siempre como residente: conserje y administrador
      // # solo se asignan desde el panel de administración interno.
      role: nextMode === "register" ? "residente" : current.role,
      otpCode: "",
    }));
    resetFeedback();
  };

  const handleRoleChange = (role: Role) => {
    setFormData((current) => ({
      ...current,
      role,
      otpCode: "",
    }));

    setAuthStep("credentials");
    setPendingOtpChallenge(null);
    setIsGoogleReady(false);
    resetFeedback();
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));

    setFieldErrors((current) => ({
      ...current,
      [name]: "",
    }));

    if (authStep === "otp" && name !== "otpCode") {
      // # Si el usuario vuelve a editar credenciales, descartamos el OTP pendiente
      // # porque ya no representa exactamente el mismo intento de login.
      setAuthStep("credentials");
      setPendingOtpChallenge(null);
    }

    resetFeedback();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedFormData: AuthFormState = {
      role: formData.role,
      name: formData.name.trim(),
      email: formData.email.trim(),
      username: formData.username.trim(),
      identifier: formData.identifier.trim(),
      password: formData.password,
      confirmPassword: formData.confirmPassword,
      otpCode: formData.otpCode.trim(),
    };

    const validationErrors =
      authStep === "otp"
        ? validateOtpForm(normalizedFormData)
        : mode === "login"
          ? validateLoginForm(normalizedFormData)
          : validateRegisterForm(normalizedFormData);

    setFieldErrors(validationErrors);
    resetFeedback();

    if (hasValidationErrors(validationErrors)) {
      return;
    }

    try {
      if (authStep === "otp") {
        if (!pendingOtpChallenge) {
          setAuthStep("credentials");
          return;
        }

        const authenticatedUser = await verifyOtp(
          pendingOtpChallenge,
          normalizedFormData.otpCode
        );

        handleSuccessfulAuth(
          authenticatedUser.role,
          t("auth.success.otp", {
            destination: t(`auth.destination.${authenticatedUser.role}`),
          })
        );

        return;
      }

      if (mode === "login") {
        const loginResult = await login({
          role: normalizedFormData.role,
          identifier: normalizedFormData.identifier,
          password: normalizedFormData.password,
        });

        if (loginResult.status === "authenticated") {
          handleSuccessfulAuth(
            loginResult.session.user.role,
            t("auth.success.login", {
              destination: t(`auth.destination.${loginResult.session.user.role}`),
            })
          );
          return;
        }

        // # El backend ya confirmó usuario + contraseña; ahora pedimos el segundo factor.
        setAuthStep("otp");
        setPendingOtpChallenge(loginResult.challenge);
        setFormData((current) => ({
          ...current,
          otpCode: "",
        }));
        toastInfo(
          loginResult.challenge.otpCode
            ? t("auth.success.otpSentWithPreview", {
                code: loginResult.challenge.otpCode,
              })
            : t("auth.success.otpSent")
        );

        return;
      }

      const registeredUser = await register({
        // # Hardcodeado a propósito: el registro público nunca envía un rol elegido por el usuario.
        role: "residente",
        name: normalizedFormData.name,
        email: normalizedFormData.email,
        username: normalizedFormData.username,
        password: normalizedFormData.password,
      });

      handleSuccessfulAuth(
        registeredUser.role,
        t("auth.success.register", {
          destination: t(`auth.destination.${registeredUser.role}`),
        })
      );
    } catch (error) {
      toastError(getAuthErrorMessage(error));
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(109,140,92,0.22),_transparent_38%),linear-gradient(135deg,_#eef3e6_0%,_#d7e2cc_45%,_#c3d0bd_100%)] px-4 py-6 text-slate-900 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-lg items-center sm:min-h-[calc(100vh-5rem)]">
        <section className="w-full rounded-[2rem] border border-slate-900/10 bg-[#111915] p-5 text-white shadow-[0_35px_80px_rgba(13,18,15,0.35)] sm:p-8 lg:p-10">
          <div className="mb-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-300/80">
                {t("common.appName")}
              </p>
              <LanguageSwitcher />
            </div>

            <div className="mt-4 grid grid-cols-2 rounded-2xl bg-white/5 p-1">
              <button
                type="button"
                onClick={() => handleModeChange("login")}
                disabled={isAuthenticating}
                className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                  mode === "login"
                    ? "bg-emerald-400 text-slate-950"
                    : "text-white/75 hover:text-white"
                }`}
              >
                {t("auth.mode.login")}
              </button>
              <button
                type="button"
                onClick={() => handleModeChange("register")}
                disabled={isAuthenticating}
                className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                  mode === "register"
                    ? "bg-emerald-400 text-slate-950"
                    : "text-white/75 hover:text-white"
                }`}
              >
                {t("auth.mode.register")}
              </button>
            </div>

            <h1 className="mt-5 text-2xl font-semibold text-white sm:text-3xl">
              {authStep === "otp" ? t("auth.title.otp") : t(`auth.title.${mode}`)}
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/70">
              {authStep === "otp"
                ? t("auth.description.otp", {
                    identifier: formData.identifier || formData.email,
                  })
                : t(`auth.description.${mode}`)}
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* # El mismo formulario soporta login y registro; solo alternamos los campos que cambian entre ambos modos. */}
            {/* # El selector de roles solo aplica al login: conserje y administrador son
                # cuentas existentes que inician sesión, nunca roles auto-asignables al registrarse. */}
            {authStep === "credentials" && mode === "login" && (
              <div>
                <p className="text-sm font-medium text-white/85">
                  {t("auth.selectRole")}
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {roleOptions.map((option) => {
                    const isSelected = formData.role === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleRoleChange(option.value)}
                        disabled={isAuthenticating}
                        className={`overflow-hidden rounded-2xl border px-4 py-4 text-left transition ${
                          isSelected
                            ? "border-emerald-400 bg-emerald-400/10 shadow-[0_0_0_1px_rgba(52,211,153,0.2)]"
                            : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/8"
                        }`}
                      >
                        <p className="break-words text-sm font-semibold text-white">
                          {option.label}
                        </p>
                        <p className="mt-1 break-words text-sm leading-5 text-white/65">
                          {option.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* # El registro público siempre crea una cuenta "residente"; no se ofrece
                # forma de elegir conserje/administrador desde este formulario. */}
            {authStep === "credentials" && mode === "register" && (
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-4">
                <p className="text-sm font-semibold text-white">
                  {t("common.roleLabel.resident")}
                </p>
                <p className="mt-1 text-sm leading-5 text-white/65">
                  {t("auth.roleDescription.resident")}
                </p>
              </div>
            )}

            {authStep === "credentials" && mode === "register" && (
              <>
                <div>
                  <label htmlFor="name" className="text-sm font-medium text-white/85">
                    {t("auth.field.name")}
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    value={formData.name}
                    onChange={handleChange}
                    disabled={isAuthenticating}
                    placeholder={t("auth.placeholder.name")}
                    aria-invalid={fieldErrors.name !== ""}
                    className={`mt-2 w-full rounded-2xl border bg-white/5 px-4 py-3.5 text-white outline-none transition placeholder:text-white/35 ${
                      fieldErrors.name
                        ? "border-red-400/80 focus:border-red-300"
                        : "border-white/10 focus:border-emerald-400"
                    }`}
                  />
                  {fieldErrors.name && (
                    <p className="mt-2 text-sm text-red-300">{fieldErrors.name}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="email" className="text-sm font-medium text-white/85">
                    {t("auth.field.email")}
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={isAuthenticating}
                    placeholder={t("auth.placeholder.email")}
                    aria-invalid={fieldErrors.email !== ""}
                    className={`mt-2 w-full rounded-2xl border bg-white/5 px-4 py-3.5 text-white outline-none transition placeholder:text-white/35 ${
                      fieldErrors.email
                        ? "border-red-400/80 focus:border-red-300"
                        : "border-white/10 focus:border-emerald-400"
                    }`}
                  />
                  {fieldErrors.email && (
                    <p className="mt-2 text-sm text-red-300">{fieldErrors.email}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="username"
                    className="text-sm font-medium text-white/85"
                  >
                    {t("auth.field.username")}
                  </label>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    value={formData.username}
                    onChange={handleChange}
                    disabled={isAuthenticating}
                    placeholder={t("auth.placeholder.username")}
                    aria-invalid={fieldErrors.username !== ""}
                    className={`mt-2 w-full rounded-2xl border bg-white/5 px-4 py-3.5 text-white outline-none transition placeholder:text-white/35 ${
                      fieldErrors.username
                        ? "border-red-400/80 focus:border-red-300"
                        : "border-white/10 focus:border-emerald-400"
                    }`}
                  />
                  {fieldErrors.username && (
                    <p className="mt-2 text-sm text-red-300">
                      {fieldErrors.username}
                    </p>
                  )}
                </div>
              </>
            )}

            {authStep === "credentials" && mode === "login" && (
              <div>
                <label
                  htmlFor="identifier"
                  className="text-sm font-medium text-white/85"
                >
                  {t("auth.field.identifier")}
                </label>
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  value={formData.identifier}
                  onChange={handleChange}
                  disabled={isAuthenticating}
                  placeholder={t(`auth.placeholder.identifier.${formData.role}`)}
                  aria-invalid={fieldErrors.identifier !== ""}
                  className={`mt-2 w-full rounded-2xl border bg-white/5 px-4 py-3.5 text-white outline-none transition placeholder:text-white/35 ${
                    fieldErrors.identifier
                      ? "border-red-400/80 focus:border-red-300"
                      : "border-white/10 focus:border-emerald-400"
                  }`}
                />
                {fieldErrors.identifier && (
                  <p className="mt-2 text-sm text-red-300">
                    {fieldErrors.identifier}
                  </p>
                )}
              </div>
            )}

            {authStep === "credentials" && (
              <div>
                <label htmlFor="password" className="text-sm font-medium text-white/85">
                  {t("auth.field.password")}
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={formData.password}
                  onChange={handleChange}
                  disabled={isAuthenticating}
                  placeholder={t(`auth.placeholder.password.${mode}`)}
                  aria-invalid={fieldErrors.password !== ""}
                  className={`mt-2 w-full rounded-2xl border bg-white/5 px-4 py-3.5 text-white outline-none transition placeholder:text-white/35 ${
                    fieldErrors.password
                      ? "border-red-400/80 focus:border-red-300"
                      : "border-white/10 focus:border-emerald-400"
                  }`}
                />
                {fieldErrors.password && (
                  <p className="mt-2 text-sm text-red-300">{fieldErrors.password}</p>
                )}
              </div>
            )}

            {authStep === "otp" && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-white/70">
                  {t("auth.otpSummary", {
                    role: t(
                      `common.roleLabel.${normalizeRoleTranslationKey(formData.role)}`
                    ),
                    identifier: formData.identifier,
                  })}
                </p>

                <label
                  htmlFor="otpCode"
                  className="mt-4 block text-sm font-medium text-white/85"
                >
                  {t("auth.field.otpCode")}
                </label>
                <input
                  id="otpCode"
                  name="otpCode"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={formData.otpCode}
                  onChange={handleChange}
                  disabled={isAuthenticating}
                  placeholder={t("auth.placeholder.otpCode")}
                  aria-invalid={fieldErrors.otpCode !== ""}
                  className={`mt-2 w-full rounded-2xl border bg-white/5 px-4 py-3.5 text-white outline-none transition placeholder:text-white/35 ${
                    fieldErrors.otpCode
                      ? "border-red-400/80 focus:border-red-300"
                      : "border-white/10 focus:border-emerald-400"
                  }`}
                />
                {fieldErrors.otpCode && (
                  <p className="mt-2 text-sm text-red-300">{fieldErrors.otpCode}</p>
                )}

                {pendingOtpChallenge && (
                  <p className="mt-3 text-xs text-white/55">
                    {t("auth.otpExpiresAt", {
                      expiresAt: new Date(
                        pendingOtpChallenge.otpExpiresAt
                      ).toLocaleTimeString(),
                    })}
                  </p>
                )}
              </div>
            )}

            {authStep === "credentials" && mode === "register" && (
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="text-sm font-medium text-white/85"
                >
                  {t("auth.field.confirmPassword")}
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  disabled={isAuthenticating}
                  placeholder={t("auth.placeholder.confirmPassword")}
                  aria-invalid={fieldErrors.confirmPassword !== ""}
                  className={`mt-2 w-full rounded-2xl border bg-white/5 px-4 py-3.5 text-white outline-none transition placeholder:text-white/35 ${
                    fieldErrors.confirmPassword
                      ? "border-red-400/80 focus:border-red-300"
                      : "border-white/10 focus:border-emerald-400"
                  }`}
                />
                {fieldErrors.confirmPassword && (
                  <p className="mt-2 text-sm text-red-300">
                    {fieldErrors.confirmPassword}
                  </p>
                )}
              </div>
            )}

            {isAuthenticating && (
              <div
                aria-live="polite"
                className="flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100"
              >
                <LoadingSpinner size="sm" color="emerald" />
                {authStep === "otp"
                  ? t("auth.loadingOtp")
                  : t(`auth.loading${mode === "login" ? "Login" : "Register"}`, {
                      role: t(`common.role.${formData.role}`),
                    })}
              </div>
            )}

            <button
              type="submit"
              disabled={isAuthenticating}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-500 px-4 py-3.5 text-base font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/70"
            >
              {isAuthenticating ? (
                <>
                  <LoadingSpinner size="sm" color="slate" />
                  {t(
                    authStep === "otp"
                      ? "auth.status.verifyingOtp"
                      : mode === "login"
                        ? "auth.status.loggingIn"
                        : "auth.status.registering"
                  )}
                </>
              ) : (
                authStep === "otp"
                  ? t("auth.verifyOtpButton")
                  : t(
                      mode === "login" ? "auth.loginButton" : "auth.registerButton",
                      {
                        role: t(`common.role.${formData.role}`),
                      }
                )
              )}
            </button>

            {authStep === "credentials" && googleClientId && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-xs uppercase tracking-[0.24em] text-white/35">
                  <span className="h-px flex-1 bg-white/10" />
                  <span>{t("auth.googleDivider")}</span>
                  <span className="h-px flex-1 bg-white/10" />
                </div>

                {/* # Google renderiza su botón dentro de este contenedor para mantener
                    # la experiencia oficial sin replicar estilos ni lógica sensible. */}
                <div className="flex min-h-[44px] justify-center">
                  <div ref={googleButtonContainerRef} />
                </div>

                {!isGoogleReady && (
                  <p className="text-center text-xs text-white/45">
                    {t("auth.googleLoading")}
                  </p>
                )}
              </div>
            )}
          </form>
        </section>
      </div>
    </div>
  );
};

export default Login;
