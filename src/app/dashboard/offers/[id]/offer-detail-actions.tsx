"use client";

import { useMemo } from "react";

type Props = {
  offerId: string;
  isIos: boolean;
  label: string;
};

export default function OfferDetailActions({ offerId, isIos, label }: Props) {
  const handleDownload = () => {
    window.dispatchEvent(
      new CustomEvent("noxo:notification", {
        detail: { message: "Pdf oluşturuluyor lütfen bekleyin" },
      })
    );

    const anchor = document.createElement("a");
    anchor.href = `/dashboard/offers/${offerId}/pdf/file`;
    if (isIos) {
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
    }
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
    >
      {label}
    </button>
  );
}
