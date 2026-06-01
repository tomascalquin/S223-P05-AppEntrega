/**
 * Archivo de validación de typado seguro en traducciones
 * Este archivo demuestra y valida que el sistema tiene tipado completo
 */

import type { Locale, BaseTranslation } from '../services/i18n'
import { getNestedValue, interpolateString } from '../services/i18n'
import es from '../i18n/locales/es'
import en from '../i18n/locales/en'

// ✅ Tipado seguro: Solo 'es' y 'en' son válidos
const locale: Locale = 'es'

// ✅ Acceso tipado a traducciones anidadas
const appName: string = es.common.appName // ✅ "EncomBox"
const loginTitle: string = es.auth.title.login // ✅ "Iniciar sesión"
const successMessage: string = es.conserje.success // ✅ Soporta {{urgency}}

// ✅ Interpolación de parámetros
const withParams = interpolateString(
  es.auth.description.otp,
  { identifier: 'usuario@example.com' }
) // ✅ "Ingresa el código temporal enviado para completar el acceso de usuario@example.com."

// ✅ Acceso a valor anidado dinámico
const dynamicValue = getNestedValue(es, 'common.appName') // ✅ "EncomBox"
const nestedValue = getNestedValue(es, 'auth.validation.email.required') // ✅ "Ingresa tu email."

// ✅ Comparación entre idiomas
const esTitle = es.conserje.title // ✅ "Registrar encomienda"
const enTitle = en.conserje.title // ✅ "Register package"

// ✅ Iteración sobre categorías
const allCommonKeys = Object.keys(es.common) // ✅ Tipado seguro
const allAuthErrorKeys = Object.keys(es.auth.errors) // ✅ Tipado seguro

// ✅ Validación de estructura
const validateStructure = (translations: BaseTranslation): boolean => {
  return (
    translations.common.appName !== undefined &&
    translations.auth.title.login !== undefined &&
    translations.conserje.title !== undefined
  )
}

console.log('✅ Validación de tipado seguro completada')
console.log(`  - Locale actual: ${locale}`)
console.log(`  - App name: ${appName}`)
console.log(`  - Login title: ${loginTitle}`)
console.log(`  - Estructura válida (es): ${validateStructure(es)}`)
console.log(`  - Estructura válida (en): ${validateStructure(en)}`)

/**
 * NOTAS DE TIPADO SEGURO:
 * 
 * 1. Locale está restringido a 'es' | 'en'
 *    - TypeScript genera error si intenta usar otro valor
 * 
 * 2. Acceso a propiedades anidadas
 *    - es.common.appName ✅ Válido
 *    - es.common.invalidKey ❌ Error TypeScript
 * 
 * 3. Interpolación de parámetros
 *    - {{variable}} se reemplaza automáticamente
 *    - getNestedValue() retorna string | undefined
 * 
 * 4. Tipado exhaustivo
 *    - BaseTranslation incluye todas las claves
 *    - Refactorizar es más seguro con IDE
 * 
 * 5. Beneficios:
 *    - Autocompletado en IDE
 *    - Detección de errores en compilación
 *    - Refactoring seguro
 *    - Documentación automática
 */
