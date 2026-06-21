import type es from '../i18n/locales/es'

export type Locale = 'es' | 'en'
export type BaseTranslation = typeof es

// # La unión se deriva del catálogo base: una clave inexistente ahora falla en compilación.
type NestedTranslationKey<T> = {
  [Key in keyof T & string]: T[Key] extends string
    ? Key
    : T[Key] extends Record<string, unknown>
      ? `${Key}.${NestedTranslationKey<T[Key]>}`
      : never
}[keyof T & string]

export type TranslationKey = NestedTranslationKey<BaseTranslation>
export type TranslationParams = Record<string, string | number>
export type Translate = (key: TranslationKey, params?: TranslationParams) => string

export const DEFAULT_LOCALE: Locale = 'es'
export const LOCALE_STORAGE_KEY = 'encombox.locale'

export const localeLabels: Record<Locale, string> = {
  es: 'ES',
  en: 'EN',
}

export const getStoredLocale = (): Locale => {
  const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY)
  return storedLocale === 'en' ? 'en' : DEFAULT_LOCALE
}

export const setStoredLocale = (locale: Locale) => {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
}

export const getLocaleTag = (locale: Locale) => {
  return locale === 'es' ? 'es-CL' : 'en-US'
}

/**
 * Obtiene un valor anidado de un objeto usando una ruta de punto.
 * Por ejemplo: 'common.appName' obtiene obj.common.appName
 */
export const getNestedValue = (
  obj: BaseTranslation,
  path: TranslationKey
): string | undefined => {
  const keys = path.split('.')
  let result: unknown = obj

  for (const key of keys) {
    if (result !== null && typeof result === 'object' && key in result) {
      result = (result as Record<string, unknown>)[key]
    } else {
      return undefined
    }
  }

  return typeof result === 'string' ? result : undefined
}

/**
 * Reemplaza marcadores de posición {{key}} en una cadena con valores del objeto params
 */
export const interpolateString = (
  template: string,
  params?: TranslationParams
): string => {
  if (!params) return template

  return template.replace(/\{\{(\w+)\}\}/g, (_, token: string) => {
    const value = params[token]
    return value === undefined ? `{{${token}}}` : String(value)
  })
}

/**
 * Traduce una clave (usando notación de punto) a la cadena correspondiente
 * con soporte para parámetros interpolados
 */
export const translateKey = (
  translations: Record<Locale, BaseTranslation>,
  locale: Locale,
  key: TranslationKey,
  params?: TranslationParams
): string => {
  const template =
    getNestedValue(translations[locale], key) ||
    getNestedValue(translations[DEFAULT_LOCALE], key) ||
    key

  if (!template) return key

  return interpolateString(template, params)
}
