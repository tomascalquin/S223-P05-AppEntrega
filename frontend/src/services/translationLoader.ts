import type { BaseTranslation, Locale } from './i18n'
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
