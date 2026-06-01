import type es from '../i18n/locales/es'

export type Locale = 'es' | 'en'
export type BaseTranslation = typeof es

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
  obj: Record<string, any>,
  path: string
): string | undefined => {
  const keys = path.split('.')
  let result: any = obj

  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key]
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
  params?: Record<string, string | number>
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
  translations: Record<Locale, Record<string, any>>,
  locale: Locale,
  key: string,
  params?: Record<string, string | number>
): string => {
  const template =
    getNestedValue(translations[locale], key) ||
    getNestedValue(translations[DEFAULT_LOCALE], key) ||
    key

  if (!template) return key

  return interpolateString(template, params)
}
