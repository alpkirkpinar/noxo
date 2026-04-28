"use client";

import { useCallback, useRef, useState } from "react";

type ConfirmDialogOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type PendingConfirm = Required<ConfirmDialogOptions>;

const defaultOptions = {
  confirmLabel: "Sil",
  cancelLabel: "Vazgeç",
  destructive: true,
};

export function useConfirmDialog() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null);

  const close = useCallback((confirmed: boolean) => {
    resolverRef.current?.(confirmed);
    resolverRef.current = null;
    setPending(null);
  }, []);

  const confirm = useCallback((options: ConfirmDialogOptions) => {
    setPending({ ...defaultOptions, ...options });

    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const dialog = pending ? (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/30 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 id="confirm-dialog-title" className="text-xl font-semibold text-slate-900">
          {pending.title}
        </h2>
        <p id="confirm-dialog-message" className="mt-2 text-sm text-slate-600">
          {pending.message}
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => close(false)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {pending.cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => close(true)}
            className={
              pending.destructive
                ? "rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700"
                : "rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            }
          >
            {pending.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, dialog };
}
