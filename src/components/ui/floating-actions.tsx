"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const actions = [
  { label: "Yeni Ticket", href: "/dashboard/tickets?new=1" },
  { label: "Yeni Form", href: "/dashboard/service-forms/new" },
  { label: "Yeni Teklif", href: "/dashboard/offers?new=1" },
  { label: "Yeni Müşteri", href: "/dashboard/customers/new" },
];

export default function FloatingActions() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (wrapRef.current && event.target instanceof Node && wrapRef.current.contains(event.target)) {
        return;
      }

      setOpen(false);
    }

    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  return (
    <div ref={wrapRef} className="floating-actions fixed z-[35]">
      {open ? (
        <div className="mb-3 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          {actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              onClick={() => setOpen(false)}
              className="block border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700 transition-colors last:border-b-0 hover:bg-slate-100"
            >
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-3xl font-light text-white shadow-[0_16px_40px_rgba(15,23,42,0.30)] transition hover:bg-slate-800"
        aria-label="Hızlı ekleme menüsü"
      >
        +
      </button>
    </div>
  );
}
