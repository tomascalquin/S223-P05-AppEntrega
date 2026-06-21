import {
  DEFAULT_LOCALE,
  getNestedValue,
  interpolateString,
  type BaseTranslation,
  type Locale,
  type TranslationKey,
  type TranslationParams,
} from './i18n'
import es from '../i18n/locales/es'
import en from '../i18n/locales/en'

type TranslationsMap = Record<Locale, BaseTranslation>

const defaultTranslations: TranslationsMap = {
  es,
  en,
}

export const translations: TranslationsMap = defaultTranslations

/**
 * Obtiene el diccionario completo de traducciones para un locale
 */
export const getTranslations = (locale: Locale): BaseTranslation => {
  return translations[locale] ?? defaultTranslations.es
}

/**
 * Obtiene todas las traducciones disponibles
 */
export const getAllTranslations = (): TranslationsMap => {
  return translations
}

// # Todas las traducciones, incluso las usadas fuera de React, pasan por esta ruta tipada.
export const translate = (
  locale: Locale,
  key: TranslationKey,
  params?: TranslationParams
): string => {
  const template =
    getNestedValue(getTranslations(locale), key) ??
    getNestedValue(getTranslations(DEFAULT_LOCALE), key) ??
    key

  return interpolateString(template, params)
}
