type StatTone = "blue" | "green" | "yellow";

type DashboardStat = {
  label: string;
  value: number;
  tone: StatTone;
};

type DashboardStatsProps = {
  items: DashboardStat[];
};

const toneClasses: Record<StatTone, string> = {
  blue: "text-blue-300",
  green: "text-green-300",
  yellow: "text-yellow-300",
};

const DashboardStats = ({ items }: DashboardStatsProps) => {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <article
          key={item.label}
          className="rounded-xl border border-white/10 bg-[#2a2a2a] p-4"
        >
          {/* # Cada tarjeta recibe su etiqueta y contador desde la página,
              # así el componente sirve tanto para datos reales como para otros tableros futuros. */}
          <p className="text-sm text-gray-400">{item.label}</p>
          <h2 className={`mt-2 text-3xl font-semibold ${toneClasses[item.tone]}`}>
            {item.value}
          </h2>
        </article>
      ))}
    </div>
  );
};

export default DashboardStats;
