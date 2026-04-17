import { useI18n } from "../context/I18nContext";

const Residente = () => {
  const { t } = useI18n();

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-2xl font-bold">{t("residente.title")}</h2>

      <ul className="grid gap-3 sm:grid-cols-2">
        <li className="rounded-xl border border-white/10 bg-[#2a2a2a] p-4">
          {t("residente.item.one")}
        </li>
        <li className="rounded-xl border border-white/10 bg-[#2a2a2a] p-4">
          {t("residente.item.two")}
        </li>
      </ul>
    </section>
  );
};

export default Residente;
