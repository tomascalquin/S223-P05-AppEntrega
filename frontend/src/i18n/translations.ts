export type Locale = "es" | "en";

export type TranslationParams = Record<string, string | number>;

export const DEFAULT_LOCALE: Locale = "es";
export const LOCALE_STORAGE_KEY = "encombox.locale";

export const localeLabels: Record<Locale, string> = {
  es: "ES",
  en: "EN",
};

const translations: Record<Locale, Record<string, string>> = {
  es: {
    "common.appName": "EncomBox",
    "common.locale.es": "Español",
    "common.locale.en": "English",
    "common.language": "Idioma",
    "common.openMenu": "Abrir navegación",
    "common.closeMenu": "Cerrar navegación",
    "common.logout": "Volver al login",
    "common.loading": "Cargando...",
    "common.retry": "Reintentar",
    "common.refresh": "Actualizar",
    "common.save": "Guardar cambios",
    "common.cancel": "Cancelar",
    "common.role.residente": "residente",
    "common.role.conserje": "conserje",
    "common.roleLabel.residente": "Residente",
    "common.roleLabel.conserje": "Conserje",
    "nav.registerPackage": "Registrar encomienda",
    "nav.history": "Historial",
    "nav.packageHistory": "Historial de encomiendas",
    "nav.myPackages": "Mis encomiendas",
    "auth.mode.login": "Iniciar sesión",
    "auth.mode.register": "Registrarse",
    "auth.title.login": "Iniciar sesión",
    "auth.title.register": "Crear cuenta",
    "auth.title.otp": "Verificar código OTP",
    "auth.description.login":
      "Ingresa con tu email o usuario y tu contraseña.",
    "auth.description.register":
      "Completa tus datos para registrarte y entrar de inmediato.",
    "auth.description.otp":
      "Ingresa el código temporal enviado para completar el acceso de {{identifier}}.",
    "auth.selectRole": "Entrar como",
    "auth.loginButton": "Entrar como {{role}}",
    "auth.registerButton": "Registrarme como {{role}}",
    "auth.verifyOtpButton": "Validar código OTP",
    "auth.googleDivider": "o continúa con",
    "auth.googleLoading": "Cargando acceso con Google...",
    "auth.loadingLogin":
      "Validando acceso de {{role}} y preparando tu dashboard...",
    "auth.loadingRegister":
      "Creando cuenta de {{role}} y preparando tu dashboard...",
    "auth.loadingOtp": "Validando el segundo factor de autenticación...",
    "auth.success.login":
      "Acceso concedido. Redirigiendo al {{destination}}.",
    "auth.success.register":
      "Cuenta creada correctamente. Redirigiendo al {{destination}}.",
    "auth.success.otp":
      "OTP validado correctamente. Redirigiendo al {{destination}}.",
    "auth.success.google":
      "Sesión iniciada con Google. Redirigiendo al {{destination}}.",
    "auth.success.otpSent":
      "Se generó un OTP temporal. Ingresa el código para continuar.",
    "auth.success.otpSentWithPreview":
      "Se generó un OTP temporal. Para pruebas locales, usa el código {{code}}.",
    "auth.roleDescription.residente":
      "Revisa el estado y retiro de tus encomiendas.",
    "auth.roleDescription.conserje":
      "Administra ingresos e historial de encomiendas.",
    "auth.field.name": "Nombre completo",
    "auth.field.email": "Email",
    "auth.field.username": "Nombre de usuario",
    "auth.field.identifier": "Email o usuario",
    "auth.field.password": "Contraseña",
    "auth.field.confirmPassword": "Confirmar contraseña",
    "auth.field.otpCode": "Código OTP",
    "auth.placeholder.name": "Ej: Martina Soto",
    "auth.placeholder.email": "Ej: usuario@encombox.cl",
    "auth.placeholder.username": "Crea tu usuario",
    "auth.placeholder.identifier.residente":
      "Ej: residente o residente@encombox.cl",
    "auth.placeholder.identifier.conserje":
      "Ej: conserje o conserje@encombox.cl",
    "auth.placeholder.password.login": "Ingresa tu contraseña",
    "auth.placeholder.password.register": "Crea una contraseña segura",
    "auth.placeholder.confirmPassword": "Repite tu contraseña",
    "auth.placeholder.otpCode": "Ingresa los 6 dígitos",
    "auth.validation.identifier.required":
      "Ingresa tu email institucional o tu usuario.",
    "auth.validation.identifier.invalidEmail":
      "El formato del email no es válido.",
    "auth.validation.password.required":
      "Ingresa tu contraseña para continuar.",
    "auth.validation.password.min":
      "La contraseña debe tener al menos 8 caracteres.",
    "auth.validation.name.required": "Ingresa tu nombre completo.",
    "auth.validation.name.min": "Ingresa un nombre más completo.",
    "auth.validation.email.required": "Ingresa tu email.",
    "auth.validation.email.invalid": "El formato del email no es válido.",
    "auth.validation.username.required": "Crea un nombre de usuario.",
    "auth.validation.username.invalid":
      "Usa entre 4 y 20 caracteres sin espacios.",
    "auth.validation.password.create":
      "Crea una contraseña para tu cuenta.",
    "auth.validation.confirmPassword.required": "Confirma tu contraseña.",
    "auth.validation.confirmPassword.match":
      "Las contraseñas no coinciden.",
    "auth.validation.otpCode.invalid":
      "Ingresa un código OTP de 6 dígitos.",
    "auth.status.loggingIn": "Ingresando...",
    "auth.status.registering": "Registrando...",
    "auth.status.verifyingOtp": "Validando OTP...",
    "auth.destination.residente": "panel del residente",
    "auth.destination.conserje": "panel de conserjería",
    "auth.otpSummary":
      "Segundo factor para {{role}} con identificador {{identifier}}.",
    "auth.otpExpiresAt": "El código expira a las {{expiresAt}}.",
    "auth.errors.networkLogin":
      "No pudimos conectar con el servicio de autenticación. Revisa tu red e intenta otra vez.",
    "auth.errors.networkRegister":
      "No pudimos conectar con el servicio de registro. Revisa tu red e intenta otra vez.",
    "auth.errors.networkOtp":
      "No pudimos validar el OTP. Revisa tu conexión e intenta nuevamente.",
    "auth.errors.invalidCredentials":
      "Usuario, email o contraseña incorrectos. Verifica los datos e intenta nuevamente.",
    "auth.errors.invalidOtp":
      "El código OTP es incorrecto. Verifica los 6 dígitos e intenta nuevamente.",
    "auth.errors.otpExpired":
      "El OTP expiró. Debes volver a iniciar sesión para generar uno nuevo.",
    "auth.errors.invalidResponse":
      "El servicio de autenticación respondió con un formato inválido.",
    "auth.errors.userAlreadyExists":
      "Ya existe una cuenta con ese email o nombre de usuario.",
    "auth.errors.googleLogin":
      "No se pudo completar el acceso con Google. Intenta nuevamente.",
    "auth.errors.generic":
      "No se pudo completar la autenticación. Intenta nuevamente en unos segundos.",
    "layout.navigation": "Navegación",
    "layout.menu": "Menú",
    "historial.title": "Historial de encomiendas",
    "historial.description":
      "Revisa todas las encomiendas registradas y su estado actual.",
    "historial.description.conserje":
      "Revisa todas las encomiendas registradas y actualiza su estado cuando el residente la retire.",
    "historial.description.residente":
      "Revisa solo tus encomiendas registradas y el estado en que se encuentran.",
    "historial.filter.mine":
      "Mostrando encomiendas asociadas a {{recipient}}.",
    "historial.recentSuccess":
      "Se agregó correctamente la encomienda de {{recipient}} y ya se encuentra en el historial.",
    "historial.recentRecipientFallback": "este residente",
    "historial.loading": "Cargando encomiendas...",
    "historial.error.load": "No se pudo cargar el historial.",
    "historial.error.network": "Error al conectar con el servidor.",
    "historial.empty": "Aún no hay encomiendas registradas.",
    "historial.empty.residente":
      "Todavía no hay encomiendas registradas a tu nombre.",
    "historial.table.resident": "Residente",
    "historial.table.apartment": "Depto",
    "historial.table.sender": "Remitente",
    "historial.table.deliveryDate": "Fecha entrega",
    "historial.table.createdAt": "Registrada",
    "historial.table.status": "Estado",
    "historial.table.actions": "Acciones",
    "historial.date.none": "Sin fecha",
    "historial.date.invalid": "Fecha no válida",
    "historial.status.received": "Recibida",
    "historial.status.delivered": "Entregada",
    "historial.status.pending": "Pendiente",
    "historial.action.markDelivered": "Marcar como entregada",
    "historial.action.edit": "Editar",
    "historial.action.editing": "Editando",
    "historial.action.updating": "Actualizando...",
    "historial.action.alreadyDelivered": "Ya entregada",
    "historial.statusUpdate.success":
      "La encomienda de {{recipient}} fue marcada como entregada.",
    "historial.statusUpdate.error":
      "No se pudo actualizar el estado de la encomienda.",
    "historial.edit.title": "Editar encomienda",
    "historial.edit.description":
      "Corrige los datos registrados y guarda los cambios en el backend.",
    "historial.edit.field.description": "Observaciones",
    "historial.edit.saving": "Guardando...",
    "historial.edit.success":
      "La encomienda de {{recipient}} fue actualizada correctamente.",
    "historial.edit.error": "No se pudo guardar la edición.",
    "historial.edit.validation.recipient.required":
      "El nombre del residente es obligatorio.",
    "historial.edit.validation.apartment.required":
      "El departamento es obligatorio.",
    "historial.edit.validation.apartment.invalid":
      "Usa un formato válido, por ejemplo 101 o A-12.",
    "historial.edit.validation.sender.required":
      "El remitente es obligatorio.",
    "historial.edit.validation.deliveryDate.future":
      "La fecha no puede ser posterior al día actual.",
    "historial.edit.validation.status.required":
      "Selecciona un estado para la encomienda.",
    "historial.edit.validation.general":
      "Corrige los campos marcados antes de guardar la edición.",
    "conserje.title": "Registrar encomienda",
    "conserje.field.recipient": "Nombre residente *",
    "conserje.field.apartment": "Departamento *",
    "conserje.field.sender": "Remitente *",
    "conserje.field.deliveryDate": "Fecha de entrega *",
    "conserje.field.urgency": "Urgencia",
    "conserje.placeholder.recipient": "Ej: Camila Soto",
    "conserje.placeholder.apartment": "Ej: 101 o A-12",
    "conserje.placeholder.sender": "Ej: Mercado Libre",
    "conserje.maxDate": "Fecha máxima permitida: {{date}}",
    "conserje.urgency.normal": "No urgente",
    "conserje.urgency.urgent": "Urgente",
    "conserje.urgency.normalHelp":
      "Se registrará como no urgente en esta pantalla.",
    "conserje.urgency.urgentHelp":
      "Se marcará visualmente como urgente en esta pantalla.",
    "conserje.validation.recipient.required":
      "El nombre del residente es obligatorio.",
    "conserje.validation.apartment.required":
      "El departamento es obligatorio.",
    "conserje.validation.apartment.invalid":
      "Usa un formato válido, por ejemplo 101 o A-12.",
    "conserje.validation.sender.required":
      "El remitente es obligatorio.",
    "conserje.validation.deliveryDate.required":
      "La fecha es obligatoria.",
    "conserje.validation.deliveryDate.future":
      "La fecha no puede ser posterior al día actual.",
    "conserje.validation.general":
      "Corrige los campos marcados antes de continuar.",
    "conserje.error.submit": "Error al registrar la encomienda.",
    "conserje.error.network": "Error al conectar con el servidor.",
    "conserje.success":
      "Encomienda registrada correctamente como {{urgency}}.",
    "conserje.success.urgent": "urgente",
    "conserje.success.normal": "no urgente",
    "conserje.submit": "Registrar encomienda",
    "conserje.submitting": "Registrando...",
    "residente.title": "Mis encomiendas",
    "residente.description":
      "Consulta tus encomiendas recientes y revisa rápidamente su estado.",
    "residente.filter.mine":
      "Tablero filtrado para {{recipient}}.",
    "residente.loading": "Cargando tus encomiendas...",
    "residente.error.load": "No se pudieron cargar tus encomiendas.",
    "residente.stats.received": "Recibidas",
    "residente.stats.pending": "Pendientes",
    "residente.stats.delivered": "Entregadas",
    "residente.section.recent": "Últimas encomiendas",
    "residente.empty": "Todavía no tienes encomiendas recientes.",
    "residente.item.one": "Encomienda 1 - Entregada",
    "residente.item.two": "Encomienda 2 - Pendiente",
  },
  en: {
    "common.appName": "EncomBox",
    "common.locale.es": "Spanish",
    "common.locale.en": "English",
    "common.language": "Language",
    "common.openMenu": "Open navigation",
    "common.closeMenu": "Close navigation",
    "common.logout": "Back to login",
    "common.loading": "Loading...",
    "common.retry": "Retry",
    "common.refresh": "Refresh",
    "common.save": "Save changes",
    "common.cancel": "Cancel",
    "common.role.residente": "resident",
    "common.role.conserje": "concierge",
    "common.roleLabel.residente": "Resident",
    "common.roleLabel.conserje": "Concierge",
    "nav.registerPackage": "Register package",
    "nav.history": "History",
    "nav.packageHistory": "Package history",
    "nav.myPackages": "My packages",
    "auth.mode.login": "Sign in",
    "auth.mode.register": "Sign up",
    "auth.title.login": "Sign in",
    "auth.title.register": "Create account",
    "auth.title.otp": "Verify OTP code",
    "auth.description.login": "Sign in with your email or username and password.",
    "auth.description.register":
      "Fill in your details to create an account and enter right away.",
    "auth.description.otp":
      "Enter the temporary code sent to complete access for {{identifier}}.",
    "auth.selectRole": "Continue as",
    "auth.loginButton": "Sign in as {{role}}",
    "auth.registerButton": "Sign up as {{role}}",
    "auth.verifyOtpButton": "Verify OTP code",
    "auth.googleDivider": "or continue with",
    "auth.googleLoading": "Loading Google sign in...",
    "auth.loadingLogin":
      "Validating {{role}} access and preparing your dashboard...",
    "auth.loadingRegister":
      "Creating your {{role}} account and preparing your dashboard...",
    "auth.loadingOtp": "Validating the second authentication factor...",
    "auth.success.login":
      "Access granted. Redirecting to the {{destination}}.",
    "auth.success.register":
      "Account created successfully. Redirecting to the {{destination}}.",
    "auth.success.otp":
      "OTP validated successfully. Redirecting to the {{destination}}.",
    "auth.success.google":
      "Signed in with Google. Redirecting to the {{destination}}.",
    "auth.success.otpSent":
      "A temporary OTP was generated. Enter the code to continue.",
    "auth.success.otpSentWithPreview":
      "A temporary OTP was generated. For local testing, use code {{code}}.",
    "auth.roleDescription.residente":
      "Track the status and pickup of your packages.",
    "auth.roleDescription.conserje":
      "Manage incoming packages and their history.",
    "auth.field.name": "Full name",
    "auth.field.email": "Email",
    "auth.field.username": "Username",
    "auth.field.identifier": "Email or username",
    "auth.field.password": "Password",
    "auth.field.confirmPassword": "Confirm password",
    "auth.field.otpCode": "OTP code",
    "auth.placeholder.name": "Example: Martina Soto",
    "auth.placeholder.email": "Example: user@encombox.cl",
    "auth.placeholder.username": "Create your username",
    "auth.placeholder.identifier.residente":
      "Example: residente or residente@encombox.cl",
    "auth.placeholder.identifier.conserje":
      "Example: conserje or conserje@encombox.cl",
    "auth.placeholder.password.login": "Enter your password",
    "auth.placeholder.password.register": "Create a secure password",
    "auth.placeholder.confirmPassword": "Repeat your password",
    "auth.placeholder.otpCode": "Enter the 6 digits",
    "auth.validation.identifier.required":
      "Enter your institutional email or username.",
    "auth.validation.identifier.invalidEmail":
      "The email format is invalid.",
    "auth.validation.password.required":
      "Enter your password to continue.",
    "auth.validation.password.min":
      "Password must be at least 8 characters long.",
    "auth.validation.name.required": "Enter your full name.",
    "auth.validation.name.min": "Enter a more complete name.",
    "auth.validation.email.required": "Enter your email.",
    "auth.validation.email.invalid": "The email format is invalid.",
    "auth.validation.username.required": "Create a username.",
    "auth.validation.username.invalid":
      "Use between 4 and 20 characters without spaces.",
    "auth.validation.password.create":
      "Create a password for your account.",
    "auth.validation.confirmPassword.required": "Confirm your password.",
    "auth.validation.confirmPassword.match": "Passwords do not match.",
    "auth.validation.otpCode.invalid": "Enter a valid 6-digit OTP code.",
    "auth.status.loggingIn": "Signing in...",
    "auth.status.registering": "Signing up...",
    "auth.status.verifyingOtp": "Verifying OTP...",
    "auth.destination.residente": "resident dashboard",
    "auth.destination.conserje": "concierge dashboard",
    "auth.otpSummary":
      "Second factor for {{role}} using identifier {{identifier}}.",
    "auth.otpExpiresAt": "The code expires at {{expiresAt}}.",
    "auth.errors.networkLogin":
      "We could not connect to the authentication service. Check your network and try again.",
    "auth.errors.networkRegister":
      "We could not connect to the registration service. Check your network and try again.",
    "auth.errors.networkOtp":
      "We could not validate the OTP. Check your connection and try again.",
    "auth.errors.invalidCredentials":
      "Incorrect username, email, or password. Check your details and try again.",
    "auth.errors.invalidOtp":
      "The OTP code is incorrect. Check the 6 digits and try again.",
    "auth.errors.otpExpired":
      "The OTP expired. You must sign in again to generate a new one.",
    "auth.errors.invalidResponse":
      "The authentication service returned an invalid response.",
    "auth.errors.userAlreadyExists":
      "An account with that email or username already exists.",
    "auth.errors.googleLogin":
      "We could not complete Google sign in. Please try again.",
    "auth.errors.generic":
      "Authentication could not be completed. Please try again in a few seconds.",
    "layout.navigation": "Navigation",
    "layout.menu": "Menu",
    "historial.title": "Package history",
    "historial.description":
      "Review every registered package and its current status.",
    "historial.description.conserje":
      "Review every registered package and update the status when the resident picks it up.",
    "historial.description.residente":
      "Review only your registered packages and the status they are currently in.",
    "historial.filter.mine":
      "Showing packages associated with {{recipient}}.",
    "historial.recentSuccess":
      "The package for {{recipient}} was added successfully and is already in the history.",
    "historial.recentRecipientFallback": "this resident",
    "historial.loading": "Loading packages...",
    "historial.error.load": "The history could not be loaded.",
    "historial.error.network": "Error connecting to the server.",
    "historial.empty": "There are no registered packages yet.",
    "historial.empty.residente":
      "There are no packages registered under your name yet.",
    "historial.table.resident": "Resident",
    "historial.table.apartment": "Apt",
    "historial.table.sender": "Sender",
    "historial.table.deliveryDate": "Delivery date",
    "historial.table.createdAt": "Created",
    "historial.table.status": "Status",
    "historial.table.actions": "Actions",
    "historial.date.none": "No date",
    "historial.date.invalid": "Invalid date",
    "historial.status.received": "Received",
    "historial.status.delivered": "Delivered",
    "historial.status.pending": "Pending",
    "historial.action.markDelivered": "Mark as delivered",
    "historial.action.edit": "Edit",
    "historial.action.editing": "Editing",
    "historial.action.updating": "Updating...",
    "historial.action.alreadyDelivered": "Already delivered",
    "historial.statusUpdate.success":
      "The package for {{recipient}} was marked as delivered.",
    "historial.statusUpdate.error":
      "The package status could not be updated.",
    "historial.edit.title": "Edit package",
    "historial.edit.description":
      "Correct the stored data and save the changes to the backend.",
    "historial.edit.field.description": "Notes",
    "historial.edit.saving": "Saving...",
    "historial.edit.success":
      "The package for {{recipient}} was updated successfully.",
    "historial.edit.error": "The changes could not be saved.",
    "historial.edit.validation.recipient.required":
      "Resident name is required.",
    "historial.edit.validation.apartment.required":
      "Apartment is required.",
    "historial.edit.validation.apartment.invalid":
      "Use a valid format such as 101 or A-12.",
    "historial.edit.validation.sender.required": "Sender is required.",
    "historial.edit.validation.deliveryDate.future":
      "The date cannot be later than today.",
    "historial.edit.validation.status.required":
      "Select a status for the package.",
    "historial.edit.validation.general":
      "Fix the highlighted fields before saving the changes.",
    "conserje.title": "Register package",
    "conserje.field.recipient": "Resident name *",
    "conserje.field.apartment": "Apartment *",
    "conserje.field.sender": "Sender *",
    "conserje.field.deliveryDate": "Delivery date *",
    "conserje.field.urgency": "Urgency",
    "conserje.placeholder.recipient": "Example: Camila Soto",
    "conserje.placeholder.apartment": "Example: 101 or A-12",
    "conserje.placeholder.sender": "Example: Mercado Libre",
    "conserje.maxDate": "Maximum allowed date: {{date}}",
    "conserje.urgency.normal": "Not urgent",
    "conserje.urgency.urgent": "Urgent",
    "conserje.urgency.normalHelp":
      "It will be displayed as not urgent on this screen.",
    "conserje.urgency.urgentHelp":
      "It will be visually marked as urgent on this screen.",
    "conserje.validation.recipient.required":
      "Resident name is required.",
    "conserje.validation.apartment.required":
      "Apartment is required.",
    "conserje.validation.apartment.invalid":
      "Use a valid format such as 101 or A-12.",
    "conserje.validation.sender.required": "Sender is required.",
    "conserje.validation.deliveryDate.required":
      "Delivery date is required.",
    "conserje.validation.deliveryDate.future":
      "The date cannot be later than today.",
    "conserje.validation.general":
      "Fix the highlighted fields before continuing.",
    "conserje.error.submit": "Error registering the package.",
    "conserje.error.network": "Error connecting to the server.",
    "conserje.success":
      "Package registered successfully as {{urgency}}.",
    "conserje.success.urgent": "urgent",
    "conserje.success.normal": "not urgent",
    "conserje.submit": "Register package",
    "conserje.submitting": "Registering...",
    "residente.title": "My packages",
    "residente.description":
      "Check your recent packages and quickly review their status.",
    "residente.filter.mine": "Dashboard filtered for {{recipient}}.",
    "residente.loading": "Loading your packages...",
    "residente.error.load": "Your packages could not be loaded.",
    "residente.stats.received": "Received",
    "residente.stats.pending": "Pending",
    "residente.stats.delivered": "Delivered",
    "residente.section.recent": "Latest packages",
    "residente.empty": "You do not have any recent packages yet.",
    "residente.item.one": "Package 1 - Delivered",
    "residente.item.two": "Package 2 - Pending",
  },
};

export const getStoredLocale = (): Locale => {
  const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return storedLocale === "en" ? "en" : DEFAULT_LOCALE;
};

export const setStoredLocale = (locale: Locale) => {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
};

export const translateText = (
  locale: Locale,
  key: string,
  params?: TranslationParams
) => {
  const template =
    translations[locale][key] ?? translations[DEFAULT_LOCALE][key] ?? key;

  if (!params) {
    return template;
  }

  return template.replace(/\{\{(\w+)\}\}/g, (_, token: string) => {
    const value = params[token];
    return value === undefined ? `{{${token}}}` : String(value);
  });
};

export const getLocaleTag = (locale: Locale) => {
  return locale === "es" ? "es-CL" : "en-US";
};
