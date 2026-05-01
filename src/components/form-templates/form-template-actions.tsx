"use client";

import Link from "next/link";
import { useRef } from "react";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";

type Props = {
  templateId: string;
  canDelete: boolean;
  deleteAction?: ((formData: FormData) => void | Promise<void>) | undefined;
};

const actionButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.08)] transition-colors duration-200 hover:border-slate-900 hover:bg-slate-900 hover:text-white";

export default function FormTemplateActions({ templateId, canDelete, deleteAction }: Props) {
  const deleteConfirm = useConfirmDialog();
  const deleteFormRef = useRef<HTMLFormElement>(null);

  async function handleDeleteClick() {
    const confirmed = await deleteConfirm.confirm({
      title: "Şablonu Sil",
      message: "Bu form şablonu kalıcı olarak silinecek. Devam etmek istiyor musunuz?",
      confirmLabel: "Sil",
      cancelLabel: "Vazgeç",
      destructive: true,
    });

    if (!confirmed) return;
    deleteFormRef.current?.requestSubmit();
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/dashboard/form-templates" className={actionButtonClass}>
          Geri Dön
        </Link>

        <Link href={`/dashboard/form-templates/${templateId}/form-layout`} className={actionButtonClass}>
          Form Düzenleme
        </Link>

        {canDelete && deleteAction ? (
          <form ref={deleteFormRef} action={deleteAction}>
            <button
              type="button"
              onClick={() => void handleDeleteClick()}
              className={`${actionButtonClass} hover:border-red-700 hover:bg-red-700`}
            >
              Şablonu Sil
            </button>
          </form>
        ) : null}
      </div>

      {deleteConfirm.dialog}
    </>
  );
}
