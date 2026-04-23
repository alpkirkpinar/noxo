import type { ReactNode } from "react";

type CompactFilterActionBarProps = {
  children: ReactNode;
  className?: string;
};

export default function CompactFilterActionBar({ children, className = "" }: CompactFilterActionBarProps) {
  return (
    <div className={`elevated-surface rounded-2xl border bg-white p-5 transition-shadow ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">{children}</div>
    </div>
  );
}
