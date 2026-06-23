import type { TranslationFunctions, Locales } from "./locales/i18n-types";
import { i18nObject } from "./locales/i18n-util";
import { loadAllLocales } from "./locales/i18n-util.sync";

// Cargamos ambos diccionarios una sola vez; el runtime oficial construye las funciones LL tipadas.
loadAllLocales();

export type Locale = Locales;

type LeafPath<T> = {
  [Key in keyof T & string]: T[Key] extends (...args: never[]) => unknown
    ? Key
    : T[Key] extends object
      ? `${Key}.${LeafPath<T[Key]>}`
      : never;
}[keyof T & string];

export type TranslationKey = LeafPath<TranslationFunctions>;
export type TranslationParams = Record<string, string | number>;
export type Translate = (
  key: TranslationKey,
  params?: TranslationParams
) => string;

export const DEFAULT_LOCALE: Locale = "es";
export const LOCALE_STORAGE_KEY = "encombox.locale";

export const localeLabels: Record<Locale, string> = {
  es: "ES",
  en: "EN",
};

export const getStoredLocale = (): Locale => {
  const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return storedLocale === "en" ? "en" : DEFAULT_LOCALE;
};

export const setStoredLocale = (locale: Locale) => {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
};

export const getLocaleTag = (locale: Locale) =>
  locale === "es" ? "es-CL" : "en-US";

export const getTranslationFunctions = (locale: Locale) => i18nObject(locale);

// Este adaptador conserva `t("ruta")`, pero solo acepta rutas generadas por typesafe-i18n.
export const translateFromFunctions = (
  LL: TranslationFunctions,
  key: TranslationKey,
  params?: TranslationParams
): string => {
  let current: unknown = LL;

  for (const segment of key.split(".")) {
    if ((typeof current !== "object" && typeof current !== "function") || current === null) {
      return key;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  if (typeof current !== "function") {
    return key;
  }

  const translation = current as (values?: TranslationParams) => string;
  return params ? translation(params) : translation();
};

export const translateForLocale = (
  locale: Locale,
  key: TranslationKey,
  params?: TranslationParams
) => translateFromFunctions(getTranslationFunctions(locale), key, params);
