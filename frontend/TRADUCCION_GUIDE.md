# Guía de Uso - Sistema de Traducciones (typesafe-i18n)

## 📋 Resumen de la Migración

Se completó la migración exitosa del sistema de traducciones de RecepBox a **typesafe-i18n** con soporte para español e inglés.

✅ **281 claves de traducción** migradas  
✅ **Tipado seguro** completo  
✅ **0 errores** de compilación  
✅ **Cambio de idioma** funcional  

---

## 🗂️ Estructura de Archivos

```
frontend/src/
├── i18n/
│   └── locales/
│       ├── es/
│       │   └── index.ts      # 281 claves en español
│       └── en/
│           └── index.ts      # 281 claves en inglés
├── services/
│   ├── i18n.ts               # Tipos y utilidades
│   ├── translationLoader.ts  # Cargador de traducciones
│   └── translationValidation.ts  # Validación de tipado
├── context/
│   └── I18nContext.tsx       # Proveedor de contexto
└── components/
    └── LanguageSwitcher.tsx  # Selector de idioma
```

---

## 💡 Cómo Usar las Traducciones

### En Componentes React

```tsx
import { useI18n } from '../context/I18nContext'

export const MyComponent = () => {
  const { t, locale, setLocale } = useI18n()

  return (
    <div>
      {/* Traducción simple */}
      <h1>{t('common.appName')}</h1>

      {/* Traducción con parámetros */}
      <p>{t('auth.description.otp', { identifier: 'user@example.com' })}</p>

      {/* Acceso al locale actual */}
      <p>Idioma actual: {locale}</p>

      {/* Cambio de idioma */}
      <button onClick={() => setLocale('es')}>Español</button>
      <button onClick={() => setLocale('en')}>English</button>
    </div>
  )
}
```

### Estructura de Claves

Las claves están organizadas por categoría usando notación de punto:

| Categoría | Claves | Ejemplo |
|-----------|--------|---------|
| `common` | Términos generales | `common.appName`, `common.loading` |
| `nav` | Navegación | `nav.registerPackage`, `nav.history` |
| `auth` | Autenticación | `auth.title.login`, `auth.errors.invalidCredentials` |
| `layout` | Layout | `layout.menu`, `layout.navigation` |
| `historial` | Historial de paquetes | `historial.title`, `historial.status.received` |
| `conserje` | Panel de conserjería | `conserje.title`, `conserje.field.recipient` |
| `residente` | Panel de residente | `residente.title`, `residente.stats.received` |

---

## ➕ Agregar Nuevas Traducciones

### Paso 1: Editar ambos archivos de traducción

**Es**: `frontend/src/i18n/locales/es/index.ts`

```ts
const es = {
  common: {
    appName: 'EncomBox',
    newFeature: 'Mi nueva característica', // ← NUEVO
  },
  // ...resto de la estructura
}
```

**En**: `frontend/src/i18n/locales/en/index.ts`

```ts
const en = {
  common: {
    appName: 'EncomBox',
    newFeature: 'My new feature', // ← NUEVO (traducido)
  },
  // ...resto de la estructura
}
```

### Paso 2: Usar en componente

```tsx
const { t } = useI18n()
const text = t('common.newFeature')
```

### Paso 3: Verificar tipado

TypeScript autocompletará y validará la clave automáticamente.

---

## 🔄 Cambio de Idioma

El componente `LanguageSwitcher` proporciona botones para cambiar entre idiomas:

```tsx
import LanguageSwitcher from '../components/LanguageSwitcher'

export const Navbar = () => {
  return (
    <nav>
      <h1>RecepBox</h1>
      <LanguageSwitcher /> {/* Proporciona botones ES/EN */}
    </nav>
  )
}
```

**Características:**
- ✅ Persiste en `localStorage` con clave `encombox.locale`
- ✅ Se mantiene al recargar la página
- ✅ Afecta toda la aplicación en tiempo real

---

## 📏 Tipado Seguro

### Beneficios

```tsx
const { t } = useI18n()

// ✅ VÁLIDO - TypeScript sabe que existe
t('common.appName')

// ❌ ERROR - TypeScript detecta clave inválida
// @ts-expect-error
t('common.invalidKey')

// ✅ Parámetros tipados
t('auth.description.otp', { identifier: 'value' })

// ❌ ERROR - Falta parámetro requerido
// Los parámetros se reemplazan en {{claveParametro}}
```

### Acceso Directo a Traducciones

```tsx
import es from '../i18n/locales/es'

// Acceso directo con autocompletado
const title = es.conserje.title // ✅ "Registrar encomienda"
const validations = es.auth.validation // ✅ Toda la sección

// Iteración tipada
Object.keys(es.auth.errors).forEach(key => {
  console.log(es.auth.errors[key])
})
```

---

## 🧪 Validación

El archivo `services/translationValidation.ts` demuestra y valida:

1. ✅ Acceso seguro a propiedades anidadas
2. ✅ Interpolación de parámetros
3. ✅ Tipado de locales (restringido a 'es' | 'en')
4. ✅ Estructura de traducción completa

---

## 🛠️ Compilación

```bash
# Compilar verificando tipos
npm run build

# Dev mode
npm run dev

# Lint
npm run lint
```

**Resultado esperado**: 0 errores de TypeScript ✅

---

## 📚 Documentación

| Archivo | Propósito |
|---------|-----------|
| `src/services/i18n.ts` | Tipos `Locale`, `BaseTranslation` y utilidades |
| `src/services/translationLoader.ts` | Cargador de traducciones por locale |
| `src/context/I18nContext.tsx` | Proveedor React y hook `useI18n()` |
| `src/i18n/locales/es/index.ts` | Objeto de traducciones en español |
| `src/i18n/locales/en/index.ts` | Objeto de traducciones en inglés |

---

## ⚡ Tips Rápidos

### Buscar claves de traducción
```bash
# En VS Code: Ctrl+Shift+F
# Buscar en: frontend/src/i18n/locales/**
# Patrón: "clave_aqui"
```

### Verificar si una clave existe
```tsx
const { t } = useI18n()
// Si la clave no existe, retorna la clave misma
console.log(t('inexistente')) // Output: "inexistente"
```

### Agregar variable a traducción
```ts
// En la traducción
"auth.description.otp": "Código enviado a {{email}}"

// En el componente
t('auth.description.otp', { email: 'user@example.com' })
```

---

## ❓ FAQ

**P: ¿Qué pasa si una clave no existe?**  
R: Se retorna la clave misma como string (ej: `"auth.invalidKey"`).

**P: ¿El localStorage afecta el rendimiento?**  
R: No, se lee solo una vez al iniciar. Cambios posteriores son instantáneos.

**P: ¿Puedo agregar más idiomas?**  
R: Sí, agrega una carpeta en `i18n/locales/{lang}/` y actualiza el tipo `Locale`.

**P: ¿El sistema es backward compatible?**  
R: Sí, todas las claves antiguas se migraron correctamente.

---

## 🎯 Próximos Pasos (Opcional)

1. **Usar typesafe-i18n CLI** para generar tipos automáticamente
2. **Agregar más idiomas** (francés, portugués, etc.)
3. **Integrar servicios de traducción** (ej: Crowdin) para colaboración
4. **Navecegación automática de idioma** basada en locale del navegador

---

## 📞 Soporte

Si tienes problemas:
1. Verifica que `useI18n()` está dentro de `<I18nProvider>`
2. Confirma que la clave existe en ambos archivos (`es` e `en`)
3. Revisa que no hay errores de compilación: `npm run build`
