import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { getHomePathForRole, type Role } from "../services/auth";

type AuthMode = "login" | "register";

type AuthFormState = {
  role: Role;
  name: string;
  email: string;
  username: string;
  identifier: string;
  password: string;
  confirmPassword: string;
};

type AuthFieldErrors = {
  name: string;
  email: string;
  username: string;
  identifier: string;
  password: string;
  confirmPassword: string;
};

const initialFormState: AuthFormState = {
  role: "residente",
  name: "",
  email: "",
  username: "",
  identifier: "",
  password: "",
  confirmPassword: "",
};

const initialFieldErrors: AuthFieldErrors = {
  name: "",
  email: "",
  username: "",
  identifier: "",
  password: "",
  confirmPassword: "",
};

const Login = () => {
  const navigate = useNavigate();
  const redirectTimeoutRef = useRef<number | null>(null);

  const { login, register, authError, isAuthenticating, clearAuthError } =
    useAuth();
  const { t } = useI18n();

  const [mode, setMode] = useState<AuthMode>("login");
  const [formData, setFormData] = useState<AuthFormState>(initialFormState);
  const [fieldErrors, setFieldErrors] =
    useState<AuthFieldErrors>(initialFieldErrors);
  const [successMessage, setSuccessMessage] = useState("");

  // # Las tarjetas de rol se reconstruyen con `t(...)` para actualizarse al cambiar idioma sin duplicar JSX.
  const roleOptions = useMemo(
    () => [
      {
        value: "residente" as const,
        label: t("common.roleLabel.residente"),
        description: t("auth.roleDescription.residente"),
      },
      {
        value: "conserje" as const,
        label: t("common.roleLabel.conserje"),
        description: t("auth.roleDescription.conserje"),
      },
    ],
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

  const hasValidationErrors = (errors: AuthFieldErrors) => {
    return Object.values(errors).some((error) => error !== "");
  };

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current !== null) {
        window.clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  const resetFeedback = () => {
    setSuccessMessage("");

    if (authError) {
      clearAuthError();
    }
  };

  const handleModeChange = (nextMode: AuthMode) => {
    // # Al cambiar entre login y registro limpiamos errores previos para no mezclar mensajes de distintos flujos.
    setMode(nextMode);
    setFieldErrors(initialFieldErrors);
    resetFeedback();
  };

  const handleRoleChange = (role: Role) => {
    setFormData((current) => ({
      ...current,
      role,
    }));

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

    resetFeedback();
  };

  const handleSuccessfulAuth = (role: Role, message: string) => {
    // # Dejamos visible una confirmación corta antes de redirigir al dashboard del rol autenticado.
    setSuccessMessage(message);
    redirectTimeoutRef.current = window.setTimeout(() => {
      navigate(getHomePathForRole(role), { replace: true });
    }, 800);
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
    };

    const validationErrors =
      mode === "login"
        ? validateLoginForm(normalizedFormData)
        : validateRegisterForm(normalizedFormData);

    setFieldErrors(validationErrors);
    resetFeedback();

    if (hasValidationErrors(validationErrors)) {
      return;
    }

    try {
      if (mode === "login") {
        const authenticatedUser = await login({
          role: normalizedFormData.role,
          identifier: normalizedFormData.identifier,
          password: normalizedFormData.password,
        });

        handleSuccessfulAuth(
          authenticatedUser.role,
          t("auth.success.login", {
            destination: t(`auth.destination.${authenticatedUser.role}`),
          })
        );

        return;
      }

      const registeredUser = await register({
        role: normalizedFormData.role,
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
    } catch {
      setSuccessMessage("");
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
              {t(`auth.title.${mode}`)}
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/70">
              {t(`auth.description.${mode}`)}
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* # El mismo formulario soporta login y registro; solo alternamos los campos que cambian entre ambos modos. */}
            <div>
              <p className="text-sm font-medium text-white/85">
                {t("auth.selectRole")}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {roleOptions.map((option) => {
                  const isSelected = formData.role === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleRoleChange(option.value)}
                      disabled={isAuthenticating}
                      className={`rounded-2xl border px-4 py-4 text-left transition ${
                        isSelected
                          ? "border-emerald-400 bg-emerald-400/10 shadow-[0_0_0_1px_rgba(52,211,153,0.2)]"
                          : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/8"
                      }`}
                    >
                      <p className="text-sm font-semibold text-white">
                        {option.label}
                      </p>
                      <p className="mt-1 text-sm leading-5 text-white/65">
                        {option.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {mode === "register" && (
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

            {mode === "login" && (
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

            {mode === "register" && (
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

            <div aria-live="polite" className="min-h-0 transition">
              {/* # Este bloque concentra loading, error y éxito para que el feedback siempre aparezca en el mismo lugar. */}
              {isAuthenticating && (
                <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-200/30 border-t-emerald-200" />
                  {t(`auth.loading${mode === "login" ? "Login" : "Register"}`, {
                    role: t(`common.role.${formData.role}`),
                  })}
                </div>
              )}

              {!isAuthenticating && authError && (
                <div className="rounded-2xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                  {authError}
                </div>
              )}

              {!isAuthenticating && !authError && successMessage && (
                <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                  {successMessage}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isAuthenticating}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-500 px-4 py-3.5 text-base font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/70"
            >
              {isAuthenticating ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/20 border-t-slate-950" />
                  {t(
                    mode === "login"
                      ? "auth.status.loggingIn"
                      : "auth.status.registering"
                  )}
                </>
              ) : (
                t(
                  mode === "login" ? "auth.loginButton" : "auth.registerButton",
                  {
                    role: t(`common.role.${formData.role}`),
                  }
                )
              )}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};

export default Login;
