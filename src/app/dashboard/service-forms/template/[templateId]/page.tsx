import { notFound, redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/supabase/app-user";
import ServiceFormTemplateList from "@/components/service-forms/service-form-template-list";

type TemplateFieldRow = {
  id: string;
  field_key: string;
  field_label: string;
  field_type: string;
  options_json: string[] | null;
  sort_order?: number | null;
};

type ServiceFormRow = {
  id: string;
  form_no: string | null;
  service_date: string | null;
  created_at: string | null;
  customers:
    | {
        company_name: string | null;
      }
    | {
        company_name: string | null;
      }[]
    | null;
  machines:
    | {
        machine_name: string | null;
      }
    | {
        machine_name: string | null;
      }[]
    | null;
};

type FieldValueRow = {
  service_form_id: string;
  template_field_id: string;
  value_text: string | null;
};

type PageProps = {
  params: Promise<{ templateId: string }>;
};

export default async function ServiceFormsByTemplatePage({ params }: PageProps) {
  const { templateId } = await params;
  const { supabase, user, appUser } = await getCurrentAppUser("id, company_id");

  if (!user) redirect("/login");

  if (!appUser?.company_id) {
    throw new Error("company_id bulunamadı.");
  }

  const { data: template, error: templateError } = await supabase
    .from("pdf_templates")
    .select("id, template_name")
    .eq("id", templateId)
    .eq("company_id", appUser.company_id)
    .single();

  if (templateError || !template) {
    notFound();
  }

  const { data: fields, error: fieldsError } = await supabase
    .from("pdf_template_fields")
    .select("id, field_key, field_label, field_type, options_json, sort_order")
    .eq("template_id", templateId)
    .order("sort_order", { ascending: true });

  if (fieldsError) {
    throw new Error(fieldsError.message);
  }

  const { data: forms, error: formsError } = await supabase
    .from("service_forms")
    .select(`
      id,
      form_no,
      service_date,
      created_at,
      customer_id,
      machine_id,
      customers(company_name),
      machines(machine_name)
    `)
    .eq("company_id", appUser.company_id)
    .eq("template_id", templateId)
    .order("created_at", { ascending: false });

  if (formsError) {
    throw new Error(formsError.message);
  }

  const formIds = ((forms ?? []) as ServiceFormRow[]).map((row) => row.id);

  let values: FieldValueRow[] = [];
  if (formIds.length > 0) {
    const { data: formValues, error: valuesError } = await supabase
      .from("service_form_field_values")
      .select("service_form_id, template_field_id, value_text")
      .in("service_form_id", formIds);

    if (valuesError) {
      throw new Error(valuesError.message);
    }

    values = (formValues ?? []) as FieldValueRow[];
  }

  const valueMap = new Map<string, Record<string, string>>();

  for (const item of values) {
    if (!valueMap.has(item.service_form_id)) {
      valueMap.set(item.service_form_id, {});
    }

    valueMap.get(item.service_form_id)![item.template_field_id] = item.value_text ?? "";
  }

  const normalizedForms = ((forms ?? []) as ServiceFormRow[]).map((form) => {
    const customer = Array.isArray(form.customers) ? form.customers[0] : form.customers;
    const machine = Array.isArray(form.machines) ? form.machines[0] : form.machines;

    return {
      id: form.id,
      form_no: form.form_no,
      service_date: form.service_date,
      created_at: form.created_at,
      customer_name: customer?.company_name ?? "",
      machine_name: machine?.machine_name ?? "",
      values: valueMap.get(form.id) ?? {},
    };
  });

  return (
    <div className="space-y-6">
      <ServiceFormTemplateList
        templateName={template.template_name}
        fields={((fields ?? []) as TemplateFieldRow[]).filter((field) => field.field_type !== "signature")}
        forms={normalizedForms}
        columnPreferenceUserId={String(appUser.id)}
        backHref="/dashboard/service-forms"
        newFormHref={`/dashboard/service-forms/new?template=${template.id}`}
      />
    </div>
  );
}
