import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  getLocaleTag,
  getStoredLocale,
  localeLabels,
  setStoredLocale,
  type Locale,
  type Translate,
} from "../services/i18n";
import { translate } from "../services/translationLoader";

type I18nContextType = {
  locale: Locale;
  localeTag: string;
  setLocale: (locale: Locale) => void;
  t: Translate;
  formatDate: (value: Date | string, options?: Intl.DateTimeFormatOptions) => string;
  localeLabels: Record<Locale, string>;
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocaleState] = useState<Locale>(getStoredLocale);

  useEffect(() => {
    // # Guardamos el idioma elegido para que el usuario no tenga que cambiarlo en cada visita.
    setStoredLocale(locale);
  }, [locale]);

  const contextValue = useMemo<I18nContextType>(() => {
    const localeTag = getLocaleTag(locale);
    return {
      locale,
      localeTag,
      setLocale: setLocaleState,
      // # El contexto expone la única función de traducción, ya validada por TranslationKey.
      t: (key, params) => translate(locale, key, params),
      formatDate: (value, options) => {
        const parsedDate = value instanceof Date ? value : new Date(value);
        return new Intl.DateTimeFormat(localeTag, options).format(parsedDate);
      },
      localeLabels,
    };
  }, [locale]);

  return (
    <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }

  return context;
};

export type { Locale };
