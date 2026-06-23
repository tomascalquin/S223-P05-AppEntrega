import type { FormattersInitializer } from 'typesafe-i18n'
import type { Locales, Formatters } from './i18n-types.js'

export const initFormatters: FormattersInitializer<Locales, Formatters> = (locale: Locales) => {
	// Se conserva el parámetro porque typesafe-i18n lo utilizará cuando agreguemos formatters por idioma.
	void locale

	const formatters: Formatters = {
		// add your formatter functions here
	}

	return formatters
}
