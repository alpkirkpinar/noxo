"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

type SupabaseLike = SupabaseClient;

export type OfflineServiceFormFieldValue = {
  template_field_id: string;
  field_key: string;
  field_type: string;
  value_text: string;
};

export type QueuedOfflineServiceForm = {
  queue_id: string;
  company_id: string;
  user_id: string;
  template_id: string;
  template_name: string | null;
  customer_id: string;
  machine_id: string | null;
  ticket_id: string | null;
  service_date: string;
  created_at: string;
  values: OfflineServiceFormFieldValue[];
};

export type CachedServiceFormTemplate = {
  id: string;
  template_name: string;
  template_code: string | null;
  file_path: string | null;
  page_count: number | null;
};

export type CachedServiceFormTemplateField = {
  id: string;
  template_id: string;
  field_key: string;
  field_label: string;
  page_number: number;
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
  font_size: number;
  field_type: string;
  is_required: boolean;
  data_source: string | null;
  options_json: string[];
  show_in_input_panel: boolean;
  is_readonly: boolean;
  text_align: string;
  default_value?: string | null;
};

export type CachedServiceFormSelectData = {
  customers: Array<{ id: string; company_name: string | null }>;
  machines: Array<{ id: string; customer_id: string | null; machine_name: string | null; serial_number: string | null }>;
  tickets: Array<{
    id: string;
    customer_id: string | null;
    machine_id: string | null;
    ticket_no: string | null;
    title: string | null;
  }>;
  employees: Array<{ full_name: string | null }>;
};

export const OFFLINE_SERVICE_FORMS_CHANGED = "noxo:offline-service-forms-changed";
export const OFFLINE_SERVICE_FORM_DATA_CHANGED = "noxo:offline-service-form-data-changed";
const STORAGE_KEY = "noxo_offline_service_forms_v1";
const TEMPLATE_STORAGE_KEY = "noxo_offline_service_form_templates_v1";
const FIELD_STORAGE_KEY = "noxo_offline_service_form_fields_v1";
const SELECT_DATA_STORAGE_KEY = "noxo_offline_service_form_select_data_v1";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function notifyChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OFFLINE_SERVICE_FORMS_CHANGED));
}

export function readQueuedOfflineServiceForms() {
  if (!canUseStorage()) return [] as QueuedOfflineServiceForm[];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is QueuedOfflineServiceForm => {
      return (
        typeof item?.queue_id === "string" &&
        typeof item.company_id === "string" &&
        typeof item.user_id === "string" &&
        typeof item.template_id === "string" &&
        typeof item.customer_id === "string" &&
        Array.isArray(item.values)
      );
    });
  } catch {
    return [];
  }
}

function writeQueuedOfflineServiceForms(items: QueuedOfflineServiceForm[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  notifyChanged();
}

export function enqueueOfflineServiceForm(item: Omit<QueuedOfflineServiceForm, "queue_id" | "created_at">) {
  const queueItem: QueuedOfflineServiceForm = {
    ...item,
    queue_id: globalThis.crypto?.randomUUID?.() ?? `offline-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    created_at: new Date().toISOString(),
  };

  writeQueuedOfflineServiceForms([...readQueuedOfflineServiceForms(), queueItem]);
  return queueItem;
}

export function removeQueuedOfflineServiceForm(queueId: string) {
  writeQueuedOfflineServiceForms(readQueuedOfflineServiceForms().filter((item) => item.queue_id !== queueId));
}

export function isLikelyOfflineError(error: unknown) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;

  const message = error instanceof Error ? error.message : String(error ?? "");
  const lower = message.toLocaleLowerCase("tr-TR");

  return (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network error") ||
    lower.includes("load failed") ||
    lower.includes("offline")
  );
}

export function writeCachedServiceFormTemplates(items: CachedServiceFormTemplate[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(OFFLINE_SERVICE_FORM_DATA_CHANGED));
}

export function readCachedServiceFormTemplates() {
  if (!canUseStorage()) return [] as CachedServiceFormTemplate[];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(TEMPLATE_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as CachedServiceFormTemplate[]) : [];
  } catch {
    return [];
  }
}

export function writeCachedServiceFormFields(items: CachedServiceFormTemplateField[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(FIELD_STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(OFFLINE_SERVICE_FORM_DATA_CHANGED));
}

export function readCachedServiceFormFields(templateId?: string) {
  if (!canUseStorage()) return [] as CachedServiceFormTemplateField[];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(FIELD_STORAGE_KEY) ?? "[]");
    const fields = Array.isArray(parsed) ? (parsed as CachedServiceFormTemplateField[]) : [];
    return templateId ? fields.filter((field) => field.template_id === templateId) : fields;
  } catch {
    return [];
  }
}

export function writeCachedServiceFormSelectData(data: CachedServiceFormSelectData) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(SELECT_DATA_STORAGE_KEY, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent(OFFLINE_SERVICE_FORM_DATA_CHANGED));
}

export function readCachedServiceFormSelectData() {
  if (!canUseStorage()) return null as CachedServiceFormSelectData | null;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(SELECT_DATA_STORAGE_KEY) ?? "null");
    if (!parsed || typeof parsed !== "object") return null;

    return {
      customers: Array.isArray(parsed.customers) ? parsed.customers : [],
      machines: Array.isArray(parsed.machines) ? parsed.machines : [],
      tickets: Array.isArray(parsed.tickets) ? parsed.tickets : [],
      employees: Array.isArray(parsed.employees) ? parsed.employees : [],
    };
  } catch {
    return null;
  }
}

async function insertQueuedForm(supabase: SupabaseLike, item: QueuedOfflineServiceForm) {
  const formResult = await supabase
    .from("service_forms")
    .insert({
      company_id: item.company_id,
      template_id: item.template_id,
      customer_id: item.customer_id,
      machine_id: item.machine_id,
      ticket_id: item.ticket_id,
      engineer_id: item.user_id,
      service_date: item.service_date,
      status: "draft",
      created_by: item.user_id,
    })
    .select("id, form_no")
    .single();

  if (formResult.error) throw new Error(formResult.error.message);
  if (!formResult.data?.id) throw new Error("Form kaydı oluşturulamadı.");

  if (item.values.length === 0) return;

  const formNo = formResult.data.form_no ?? "";
  const fieldPayload = item.values.map((value) => ({
    company_id: item.company_id,
    service_form_id: formResult.data!.id,
    template_field_id: value.template_field_id,
    field_key: value.field_key,
    value_text: value.field_type === "serial_number" ? formNo : value.value_text,
    created_by: item.user_id,
  }));

  const fieldInsert = (await supabase.from("service_form_field_values").insert(fieldPayload)) as {
    error: { message: string } | null;
  };

  if (fieldInsert.error) throw new Error(fieldInsert.error.message);
}

export async function syncQueuedOfflineServiceForms(supabase: SupabaseLike) {
  const queued = readQueuedOfflineServiceForms();
  let synced = 0;
  const errors: string[] = [];

  for (const item of queued) {
    try {
      await insertQueuedForm(supabase, item);
      removeQueuedOfflineServiceForm(item.queue_id);
      synced += 1;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Çevrimdışı form senkronize edilemedi.");
      if (isLikelyOfflineError(error)) break;
    }
  }

  return {
    synced,
    errors,
    remaining: readQueuedOfflineServiceForms().length,
  };
}
