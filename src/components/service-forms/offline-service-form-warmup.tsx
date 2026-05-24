"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  syncQueuedOfflineServiceForms,
  writeCachedServiceFormFields,
  writeCachedServiceFormSelectData,
  writeCachedServiceFormTemplates,
  type CachedServiceFormSelectData,
  type CachedServiceFormTemplate,
  type CachedServiceFormTemplateField,
} from "@/lib/offline-service-forms";

type Props = {
  companyId: string | null;
};

export default function OfflineServiceFormWarmup({ companyId }: Props) {
  useEffect(() => {
    if (!companyId || typeof navigator === "undefined") return;

    let active = true;
    const supabase = createClient();

    async function warmup() {
      if (navigator.onLine === false) return;

      const syncResult = await syncQueuedOfflineServiceForms(supabase);
      if (syncResult.synced > 0) {
        window.dispatchEvent(
          new CustomEvent("noxo:notification", {
            detail: { message: `${syncResult.synced} çevrimdışı form veritabanına eşitlendi.` },
          })
        );
      }

      try {
        await fetch("/dashboard/service-forms/new", {
          cache: "reload",
          credentials: "include",
        });
      } catch {
        // The data cache below is still useful even if the route prefetch fails.
      }

      const templatesResult = await supabase
        .from("pdf_templates")
        .select("id, template_name, template_code, file_path, page_count")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("template_name", { ascending: true });

      if (!active || templatesResult.error) return;

      const templates = (templatesResult.data ?? []) as CachedServiceFormTemplate[];
      writeCachedServiceFormTemplates(templates);

      const templateIds = templates.map((template) => template.id);
      if (templateIds.length > 0) {
        const fieldsResult = await supabase
          .from("pdf_template_fields")
          .select(`
            id,
            template_id,
            field_key,
            field_label,
            page_number,
            pos_x,
            pos_y,
            width,
            height,
            font_size,
            field_type,
            is_required,
            data_source,
            options_json,
            show_in_input_panel,
            is_readonly,
            text_align,
            default_value
          `)
          .in("template_id", templateIds)
          .order("sort_order", { ascending: true });

        if (active && !fieldsResult.error) {
          writeCachedServiceFormFields((fieldsResult.data ?? []) as CachedServiceFormTemplateField[]);
        }
      }

      const [customersResult, machinesResult, ticketsResult, employeesResult] = await Promise.all([
        supabase
          .from("customers")
          .select("id, company_name")
          .eq("company_id", companyId)
          .order("company_name", { ascending: true }),
        supabase
          .from("machines")
          .select("id, customer_id, machine_name, serial_number")
          .eq("company_id", companyId)
          .order("machine_name", { ascending: true }),
        supabase
          .from("tickets")
          .select("id, customer_id, machine_id, ticket_no, title")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),
        supabase
          .from("app_users")
          .select("full_name")
          .eq("company_id", companyId)
          .order("full_name", { ascending: true }),
      ]);

      if (!active) return;

      const selectData: CachedServiceFormSelectData = {
        customers: customersResult.error ? [] : customersResult.data ?? [],
        machines: machinesResult.error ? [] : machinesResult.data ?? [],
        tickets: ticketsResult.error ? [] : ticketsResult.data ?? [],
        employees: employeesResult.error ? [] : employeesResult.data ?? [],
      };

      writeCachedServiceFormSelectData(selectData);
    }

    void warmup();
    window.addEventListener("online", warmup);

    return () => {
      active = false;
      window.removeEventListener("online", warmup);
    };
  }, [companyId]);

  return null;
}
