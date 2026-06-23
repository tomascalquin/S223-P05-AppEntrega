export type LoadingSpinnerSize = "sm" | "md" | "lg";
export type LoadingSpinnerColor = "emerald" | "white" | "slate";

export type LoadingSpinnerProps = {
  size?: LoadingSpinnerSize;
  color?: LoadingSpinnerColor;
  fullScreen?: boolean;
  label?: string;
  className?: string;
};

const SIZE_CLASSES: Record<LoadingSpinnerSize, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-8 w-8 border-2",
  lg: "h-12 w-12 border-[3px]",
};

// # Tailwind solo genera utilidades que detecta como strings literales en el código
// # fuente, así que el color se resuelve contra un mapa cerrado en vez de interpolarse.
const COLOR_CLASSES: Record<LoadingSpinnerColor, string> = {
  emerald: "border-emerald-200/30 border-t-emerald-200",
  white: "border-white/30 border-t-white",
  slate: "border-slate-950/20 border-t-slate-950",
};

const LoadingSpinner = ({
  size = "md",
  color = "emerald",
  fullScreen = false,
  label = "Cargando...",
  className = "",
}: LoadingSpinnerProps) => {
  const spinner = (
    <span
      role="status"
      className={`inline-block animate-spin rounded-full ${SIZE_CLASSES[size]} ${COLOR_CLASSES[color]} ${className}`}
    >
      <span className="sr-only">{label}</span>
    </span>
  );

  if (!fullScreen) {
    return spinner;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      {spinner}
    </div>
  );
};

export default LoadingSpinner;
