"use client";

import dynamic from "next/dynamic";

const PdfTemplateEditor = dynamic(
  () => import("@/components/form-templates/pdf-template-editor"),
  { ssr: false }
);

type Props = {
  companyId: string;
  userId: string;
  mode: "create" | "edit";
  initialTemplate?: any;
  initialFields?: any[];
};

export default function PdfTemplateEditorClient(props: Props) {
  return <PdfTemplateEditor {...props} />;
}
