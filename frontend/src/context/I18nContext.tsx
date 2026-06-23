import { createContext, useContext, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import {
  getLocaleTag,
  getStoredLocale,
  localeLabels,
  setStoredLocale,
  translateFromFunctions,
  type Locale,
  type Translate,
} from "../i18n";
import TypesafeI18n, {
  useI18nContext as useTypesafeI18nContext,
} from "../i18n/locales/i18n-react";

type I18nContextType = {
  locale: Locale;
  localeTag: string;
  setLocale: (locale: Locale) => void;
  t: Translate;
  formatDate: (value: Date | string, options?: Intl.DateTimeFormatOptions) => string;
  localeLabels: Record<Locale, string>;
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const I18nBridge = ({ children }: { children: ReactNode }) => {
  const { locale, setLocale, LL } = useTypesafeI18nContext();

  useEffect(() => {
    // # Guardamos el idioma elegido para que el usuario no tenga que cambiarlo en cada visita.
    setStoredLocale(locale);
  }, [locale]);

  const contextValue = useMemo<I18nContextType>(() => {
    const localeTag = getLocaleTag(locale);
    return {
      locale,
      localeTag,
      setLocale,
      // El runtime oficial resuelve pluralización e interpolación; el adaptador solo acepta claves generadas.
      t: (key, params) => translateFromFunctions(LL, key, params),
      formatDate: (value, options) => {
        const parsedDate = value instanceof Date ? value : new Date(value);
        return new Intl.DateTimeFormat(localeTag, options).format(parsedDate);
      },
      localeLabels,
    };
  }, [LL, locale, setLocale]);

  return (
    <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>
  );
};

export const I18nProvider = ({ children }: { children: ReactNode }) => (
  // El locale persistido inicializa el Provider generado; sus cambios se guardan desde I18nBridge.
  <TypesafeI18n locale={getStoredLocale()}>
    <I18nBridge>{children}</I18nBridge>
  </TypesafeI18n>
);

export const useI18n = () => {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }

  return context;
};

export type { Locale };
