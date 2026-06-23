import { useI18n } from "../context/I18nContext";

const locales = ["es", "en"] as const;

const LanguageSwitcher = () => {
  const { locale, setLocale, t, localeLabels } = useI18n();

  return (
    // # Este selector es reutilizable para mantener el cambio de idioma accesible en login y vistas internas.
    <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
      <span className="sr-only">{t("common.language")}</span>
      {locales.map((option) => {
        const isSelected = locale === option;

        return (
          <button
            key={option}
            type="button"
            onClick={() => setLocale(option)}
            aria-pressed={isSelected}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              isSelected
                ? "bg-emerald-400 text-slate-950"
                : "text-white/75 hover:text-white"
            }`}
          >
            {localeLabels[option]}
          </button>
        );
      })}
    </div>
  );
};

export default LanguageSwitcher;
