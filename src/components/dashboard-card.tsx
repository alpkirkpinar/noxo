type DashboardCardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
};

export default function DashboardCard({
  title,
  value,
  subtitle,
}: DashboardCardProps) {
  return (
    <div className="elevated-surface rounded-3xl border bg-white p-5 transition-shadow">
      <div className="text-sm font-medium text-slate-500">{title}</div>
      <div className="mt-3 text-4xl font-black tracking-tight text-slate-900">
        {value}
      </div>
      {subtitle ? (
        <div className="mt-2 text-sm text-slate-500">{subtitle}</div>
      ) : null}
    </div>
  );
}
