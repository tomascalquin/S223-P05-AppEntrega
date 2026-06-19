const en = {
  common: {
    appName: 'EncomBox',
    locale: {
      es: 'Spanish',
      en: 'English',
    },
    language: 'Language',
    openMenu: 'Open navigation',
    closeMenu: 'Close navigation',
    logout: 'Back to login',
    loading: 'Loading...',
    retry: 'Retry',
    refresh: 'Refresh',
    save: 'Save changes',
    cancel: 'Cancel',
    role: {
      residente: 'resident',
      conserje: 'concierge',
      administrador: 'administrator',
    },
    roleLabel: {
      residente: 'Resident',
      conserje: 'Concierge',
      administrador: 'Administrator',
      resident: 'Resident',
      concierge: 'Concierge',
      administrator: 'Administrator',
    },
  },
  nav: {
    registerPackage: 'Register package',
    history: 'History',
    packageHistory: 'Package history',
    myPackages: 'My packages',
    home: 'Home',
    notifications: 'Notifications',
    userManagement: 'User management',
    authorizedEmails: 'Authorized emails',
    auditLogs: 'Audit log',
  },
  auth: {
    mode: {
      login: 'Sign in',
      register: 'Sign up',
    },
    title: {
      login: 'Sign in',
      register: 'Create account',
      otp: 'Verify OTP code',
    },
    description: {
      login: 'Sign in with your email or username and password.',
      register: 'Fill in your details to create an account and enter right away.',
      otp: 'Enter the temporary code sent to complete access for {{identifier}}.',
    },
    selectRole: 'Continue as',
    loginButton: 'Sign in as {{role}}',
    registerButton: 'Sign up as {{role}}',
    verifyOtpButton: 'Verify OTP code',
    googleDivider: 'or continue with',
    googleLoading: 'Loading Google sign in...',
    loadingLogin: 'Validating {{role}} access and preparing your dashboard...',
    loadingRegister: 'Creating your {{role}} account and preparing your dashboard...',
    loadingOtp: 'Validating the second authentication factor...',
    success: {
      login: 'Access granted. Redirecting to the {{destination}}.',
      register: 'Account created successfully. Redirecting to the {{destination}}.',
      otp: 'OTP validated successfully. Redirecting to the {{destination}}.',
      google: 'Signed in with Google. Redirecting to the {{destination}}.',
      otpSent: 'A temporary OTP was generated. Enter the code to continue.',
      otpSentWithPreview: 'A temporary OTP was generated. For local testing, use code {{code}}.',
    },
    roleDescription: {
      residente: 'Track the status and pickup of your packages.',
      conserje: 'Manage incoming packages and their history.',
      resident: 'Track the status and pickup of your packages.',
      concierge: 'Manage incoming packages and their history.',
      administrator: 'Manage users, roles and system settings.',
    },
    field: {
      name: 'Full name',
      email: 'Email',
      username: 'Username',
      identifier: 'Email or username',
      password: 'Password',
      confirmPassword: 'Confirm password',
      otpCode: 'OTP code',
    },
    placeholder: {
      name: 'Example: Martina Soto',
      email: 'Example: user@encombox.cl',
      username: 'Create your username',
      identifier: {
        residente: 'Example: residente or residente@encombox.cl',
        conserje: 'Example: conserje or conserje@encombox.cl',
        administrador: 'Example: admin or admin@encombox.cl',
      },
      password: {
        login: 'Enter your password',
        register: 'Create a secure password',
      },
      confirmPassword: 'Repeat your password',
      otpCode: 'Enter the 6 digits',
    },
    validation: {
      identifier: {
        required: 'Enter your institutional email or username.',
        invalidEmail: 'The email format is invalid.',
      },
      password: {
        required: 'Enter your password to continue.',
        min: 'Password must be at least 8 characters long.',
        create: 'Create a password for your account.',
      },
      name: {
        required: 'Enter your full name.',
        min: 'Enter a more complete name.',
      },
      email: {
        required: 'Enter your email.',
        invalid: 'The email format is invalid.',
      },
      username: {
        required: 'Create a username.',
        invalid: 'Use between 4 and 20 characters without spaces.',
      },
      confirmPassword: {
        required: 'Confirm your password.',
        match: 'Passwords do not match.',
      },
      otpCode: {
        invalid: 'Enter a valid 6-digit OTP code.',
      },
    },
    status: {
      loggingIn: 'Signing in...',
      registering: 'Signing up...',
      verifyingOtp: 'Verifying OTP...',
    },
    destination: {
      residente: 'resident dashboard',
      conserje: 'concierge dashboard',
      administrador: 'admin dashboard',
    },
    otpSummary: 'Second factor for {{role}} using identifier {{identifier}}.',
    otpExpiresAt: 'The code expires at {{expiresAt}}.',
    errors: {
      networkLogin: 'We could not connect to the authentication service. Check your network and try again.',
      networkRegister: 'We could not connect to the registration service. Check your network and try again.',
      networkOtp: 'We could not validate the OTP. Check your connection and try again.',
      invalidCredentials: 'Incorrect username, email, or password. Check your details and try again.',
      invalidOtp: 'The OTP code is incorrect. Check the 6 digits and try again.',
      otpExpired: 'The OTP expired. You must sign in again to generate a new one.',
      invalidResponse: 'The authentication service returned an invalid response.',
      userAlreadyExists: 'An account with that email or username already exists.',
      googleLogin: 'We could not complete Google sign in. Please try again.',
      generic: 'Authentication could not be completed. Please try again in a few seconds.',
    },
  },
  layout: {
    navigation: 'Navigation',
    menu: 'Menu',
  },
  historial: {
    title: 'Package history',
    description: 'Review every registered package and its current status.',
    description_conserje: 'Review every registered package and update the status when the resident picks it up.',
    description_residente: 'Review only your registered packages and the status they are currently in.',
    filter: {
      mine: 'Showing packages associated with {{recipient}}.',
    },
    recentSuccess: 'The package for {{recipient}} was added successfully and is already in the history.',
    recentRecipientFallback: 'this resident',
    loading: 'Loading packages...',
    error: {
      load: 'The history could not be loaded.',
      network: 'Error connecting to the server.',
    },
    empty: 'There are no registered packages yet.',
    empty_residente: 'There are no packages registered under your name yet.',
    table: {
      resident: 'Resident',
      apartment: 'Apt',
      sender: 'Sender',
      deliveryDate: 'Delivery date',
      createdAt: 'Created',
      status: 'Status',
      actions: 'Actions',
    },
    date: {
      none: 'No date',
      invalid: 'Invalid date',
    },
    status: {
      received: 'Received',
      delivered: 'Delivered',
      pending: 'Pending',
    },
    action: {
      markDelivered: 'Mark as delivered',
      edit: 'Edit',
      editing: 'Editing',
      updating: 'Updating...',
      alreadyDelivered: 'Already delivered',
    },
    statusUpdate: {
      success: 'The package for {{recipient}} was marked as delivered.',
      error: 'The package status could not be updated.',
    },
    edit: {
      title: 'Edit package',
      description: 'Correct the stored data and save the changes to the backend.',
      field: {
        description: 'Notes',
      },
      saving: 'Saving...',
      success: 'The package for {{recipient}} was updated successfully.',
      error: 'The changes could not be saved.',
      validation: {
        recipient: {
          required: 'Resident name is required.',
        },
        apartment: {
          required: 'Apartment is required.',
          invalid: 'Use a valid format such as 101 or A-12.',
        },
        sender: {
          required: 'Sender is required.',
        },
        deliveryDate: {
          future: 'The date cannot be later than today.',
        },
        status: {
          required: 'Select a status for the package.',
        },
        general: 'Fix the highlighted fields before saving the changes.',
      },
    },
  },
  conserje: {
    title: 'Register package',
    field: {
      recipient: 'Resident name *',
      apartment: 'Apartment *',
      sender: 'Sender *',
      deliveryDate: 'Delivery date *',
      urgency: 'Urgency',
    },
    placeholder: {
      recipient: 'Example: Camila Soto',
      apartment: 'Example: 101 or A-12',
      sender: 'Example: Mercado Libre',
    },
    maxDate: 'Maximum allowed date: {{date}}',
    urgency: {
      normal: 'Not urgent',
      urgent: 'Urgent',
      normalHelp: 'It will be displayed as not urgent on this screen.',
      urgentHelp: 'It will be visually marked as urgent on this screen.',
    },
    validation: {
      recipient: {
        required: 'Resident name is required.',
      },
      apartment: {
        required: 'Apartment is required.',
        invalid: 'Use a valid format such as 101 or A-12.',
      },
      sender: {
        required: 'Sender is required.',
      },
      deliveryDate: {
        required: 'Delivery date is required.',
        future: 'The date cannot be later than today.',
      },
      general: 'Fix the highlighted fields before continuing.',
    },
    error: {
      submit: 'Error registering the package.',
      network: 'Error connecting to the server.',
    },
    success: 'Package registered successfully as {{urgency}}.',
    success_urgency: {
      urgent: 'urgent',
      normal: 'not urgent',
    },
    submit: 'Register package',
    submitting: 'Registering...',
  },
  residente: {
    title: 'My packages',
    description: 'Check your recent packages and quickly review their status.',
    filter: {
      mine: 'Dashboard filtered for {{recipient}}.',
    },
    loading: 'Loading your packages...',
    error: {
      load: 'Your packages could not be loaded.',
    },
    stats: {
      received: 'Received',
      pending: 'Pending',
      delivered: 'Delivered',
    },
    section: {
      recent: 'Latest packages',
    },
    empty: 'You do not have any recent packages yet.',
    item: {
      one: 'Package 1 - Delivered',
      two: 'Package 2 - Pending',
    },
  },
}

export default en
