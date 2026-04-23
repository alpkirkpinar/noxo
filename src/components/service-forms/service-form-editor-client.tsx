"use client";

import dynamic from "next/dynamic";

const ServiceFormEditor = dynamic(
  () => import("@/components/service-forms/service-form-editor"),
  { ssr: false }
);

type TemplateItem = {
  id: string;
  template_name: string;
  template_code: string | null;
  file_path: string | null;
  page_count: number | null;
};

type InitialServiceForm = {
  id?: string | null;
  template_id?: string | null;
  customer_id?: string | null;
  machine_id?: string | null;
  ticket_id?: string | null;
  service_date?: string | null;
  form_no?: string | null;
};

type FormFieldValue = {
  template_field_id: string;
  field_key: string;
  value_text: string;
};

type Props = {
  companyId: string;
  userId: string;
  mode: "create" | "edit";
  templates: TemplateItem[];
  initialForm?: InitialServiceForm;
  initialFields?: FormFieldValue[];
  pageTitle: string;
  backHref: string;
  canDelete?: boolean;
  deleteAction?: ((formData: FormData) => void | Promise<void>) | undefined;
};

export default function ServiceFormEditorClient(props: Props) {
  return <ServiceFormEditor {...props} />;
}
