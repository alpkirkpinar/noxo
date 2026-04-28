"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Document, Page, pdfjs } from "react-pdf";
import SignatureCanvas from "react-signature-canvas";
import { PDFDocument, PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { createClient } from "@/lib/supabase/client";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type TemplateItem = {
  id: string;
  template_name: string;
  template_code: string | null;
  file_path: string | null;
  page_count: number | null;
};

type TemplateField = {
  id: string;
  field_key: string;
  field_label: string;
  page_number: number;
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
  font_size: number;
  field_type: "text" | "textarea" | "number" | "date" | "time" | "serial_number" | "select" | "checkbox" | "signature";
  is_required: boolean;
  data_source: string | null;
  options_json: string[];
  show_in_input_panel: boolean;
  is_readonly: boolean;
  text_align: "left" | "center" | "right";
};

type FormFieldValue = {
  template_field_id: string;
  field_key: string;
  value_text: string;
};

type PickerControl = HTMLInputElement | HTMLSelectElement;
type OverlayControlStyle = CSSProperties & {
  "--overlay-mobile-scale": string;
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

type SelectDataSource = "" | "customers" | "machines" | "tickets" | "employees";

type CustomerOption = {
  id: string;
  label: string;
};

type MachineOption = {
  id: string;
  customer_id: string | null;
  label: string;
  machine_code: string | null;
};

type TicketOption = {
  id: string;
  customer_id: string | null;
  machine_id: string | null;
  label: string;
  ticket_no: string | null;
};

type SelectSourceRecords = {
  customers: CustomerOption[];
  machines: MachineOption[];
  tickets: TicketOption[];
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

const STORAGE_BUCKET = "template-pdfs";
const BASE_PAGE_WIDTH = 900;
const MIN_ZOOM = 50;
const MAX_ZOOM = 150;
const MOBILE_MIN_ZOOM = 26;
const PDF_FONT_PATH = "/fonts/arial.ttf";
const MULTI_SELECT_OPTION_MARKER = "__noxo_multi_select__";

function normalizeExistingValues(initialFields: FormFieldValue[] | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  for (const item of initialFields ?? []) {
    if (item?.template_field_id) {
      map[item.template_field_id] = item.value_text ?? "";
    }
  }
  return map;
}

function getVisibleSelectOptions(values: string[]) {
  return values.filter((value) => value !== MULTI_SELECT_OPTION_MARKER);
}

function isMultiSelectField(field: Pick<TemplateField, "field_type" | "options_json">) {
  return field.field_type === "select" && field.options_json.includes(MULTI_SELECT_OPTION_MARKER);
}

function withMultiSelectMarker(values: string[], enabled: boolean) {
  const visibleOptions = sortOptions(getVisibleSelectOptions(values));
  return enabled ? [MULTI_SELECT_OPTION_MARKER, ...visibleOptions] : visibleOptions;
}

function parseMultiSelectValue(value: string) {
  if (!value.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map(String).filter(Boolean);
    }
  } catch {
    // Older saved values may be plain text.
  }

  return [value].filter(Boolean);
}

function serializeMultiSelectValue(values: string[]) {
  return JSON.stringify(Array.from(new Set(values.filter(Boolean))));
}

function formatMultiSelectValue(value: string) {
  return parseMultiSelectValue(value).join(", ");
}

function formatPdfText(field: TemplateField, rawValue: string) {
  if (field.field_type === "checkbox") {
    return rawValue === "true" ? "X" : "";
  }

  if (field.field_type === "select" && isMultiSelectField(field)) {
    return formatMultiSelectValue(rawValue);
  }

  if (field.field_type === "date" && rawValue) {
    const d = new Date(rawValue);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("tr-TR");
    }
  }

  if (field.field_type === "time" && rawValue) {
    return rawValue.slice(0, 5);
  }

  if (field.field_type === "serial_number") {
    return rawValue;
  }

  return rawValue;
}

function formatOverlayText(field: TemplateField, rawValue: string) {
  if (field.field_type === "date" && rawValue) {
    const match = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  }

  if (field.field_type === "time" && rawValue) {
    return rawValue.slice(0, 5);
  }

  return formatPdfText(field, rawValue);
}

function getFittedFontSize(font: PDFFont, text: string, requestedSize: number, maxWidth: number, maxHeight: number) {
  const minimumSize = 4;
  let fontSize = Math.max(minimumSize, requestedSize);

  while (fontSize > minimumSize) {
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const textHeight = font.heightAtSize(fontSize);

    if (textWidth <= maxWidth && textHeight <= maxHeight) {
      return fontSize;
    }

    fontSize -= 0.5;
  }

  return minimumSize;
}

function getOverlayFittedFontSize(text: string, requestedSize: number, boxWidthPx: number, boxHeightPx: number) {
  const minimumSize = 4;
  if (!text.trim()) return Math.max(minimumSize, requestedSize);

  let fontSize = Math.max(minimumSize, requestedSize);
  const maxWidth = Math.max(1, boxWidthPx - 6);
  const maxHeight = Math.max(1, boxHeightPx - 2);

  while (fontSize > minimumSize) {
    const estimatedWidth = text.length * fontSize * 0.64;
    const estimatedHeight = fontSize * 1.05;

    if (estimatedWidth <= maxWidth && estimatedHeight <= maxHeight) {
      return fontSize;
    }

    fontSize -= 0.5;
  }

  return minimumSize;
}

function sortOptions(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "tr", { sensitivity: "base" })
  );
}

function asSelectDataSource(value: string | null | undefined): SelectDataSource {
  if (value === "customers" || value === "machines" || value === "tickets" || value === "employees") {
    return value;
  }

  return "";
}

function normalizeLookupValue(value: string | null | undefined) {
  return String(value ?? "").trim().toLocaleLowerCase("tr-TR");
}

function getInitialZoom() {
  if (typeof window === "undefined") return 100;
  const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;

  if (isTouchDevice || window.innerWidth < 768) {
    const availableWidth = Math.max(220, window.innerWidth - 56);
    const fitZoom = Math.floor((availableWidth / BASE_PAGE_WIDTH) * 100);

    return Math.min(100, Math.max(MOBILE_MIN_ZOOM, fitZoom));
  }

  return window.innerWidth < 1180 ? 87 : 100;
}

export default function ServiceFormEditor({
  companyId,
  userId,
  mode,
  templates,
  initialForm,
  initialFields,
  pageTitle,
  backHref,
  canDelete = false,
  deleteAction,
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const overlayRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const signaturePadRef = useRef<SignatureCanvas | null>(null);
  const signaturePadClearedRef = useRef(false);

  const [templateId, setTemplateId] = useState(initialForm?.template_id ?? "");
  const serviceDate =
    initialForm?.service_date ? String(initialForm.service_date).slice(0, 10) : new Date().toISOString().slice(0, 10)
  ;

  const [templateFields, setTemplateFields] = useState<TemplateField[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(normalizeExistingValues(initialFields));
  const [pdfUrl, setPdfUrl] = useState("");
  const [numPages, setNumPages] = useState(0);
  const [zoom, setZoom] = useState(getInitialZoom);
  const [usePhoneOverlayInputMode, setUsePhoneOverlayInputMode] = useState(false);
  const [selectSourceOptions, setSelectSourceOptions] = useState<Record<SelectDataSource, string[]>>({
    "": [],
    customers: [],
    machines: [],
    tickets: [],
    employees: [],
  });
  const [selectSourceRecords, setSelectSourceRecords] = useState<SelectSourceRecords>({
    customers: [],
    machines: [],
    tickets: [],
  });

  const [activeSignatureFieldId, setActiveSignatureFieldId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");

  const selectedTemplate = useMemo(
    () => templates.find((x) => x.id === templateId) ?? null,
    [templates, templateId]
  );

  const activeSignatureField = useMemo(
    () => templateFields.find((x) => x.id === activeSignatureFieldId) ?? null,
    [templateFields, activeSignatureFieldId]
  );
  useEffect(() => {
    function isEditingFormField() {
      const activeElement = document.activeElement;
      return (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement
      );
    }

    function syncMobileZoom() {
      if (isEditingFormField()) return;

      const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
      setUsePhoneOverlayInputMode(isTouchDevice && window.innerWidth < 768);
      if (!isTouchDevice && window.innerWidth >= 768) return;

      setZoom(getInitialZoom());
    }

    syncMobileZoom();
    window.addEventListener("resize", syncMobileZoom);
    window.addEventListener("orientationchange", syncMobileZoom);

    return () => {
      window.removeEventListener("resize", syncMobileZoom);
      window.removeEventListener("orientationchange", syncMobileZoom);
    };
  }, []);

  useEffect(() => {
    async function loadTemplate() {
      if (!templateId) {
        setTemplateFields([]);
        setPdfUrl("");
        return;
      }

      setLoadingTemplate(true);
      setErrorText("");

      const { data: fields, error } = await supabase
        .from("pdf_template_fields")
        .select(`
          id,
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
          text_align
        `)
        .eq("template_id", templateId)
        .order("sort_order", { ascending: true });

      if (error) {
        setLoadingTemplate(false);
        setErrorText(error.message);
        return;
      }

      setTemplateFields((fields ?? []) as TemplateField[]);

      const template = templates.find((x) => x.id === templateId);
      if (template?.file_path) {
        const { data, error: signedError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(template.file_path, 3600);

        if (signedError) {
          setErrorText(signedError.message);
        } else if (data?.signedUrl) {
          setPdfUrl(data.signedUrl);
        }
      }

      setLoadingTemplate(false);
    }

    loadTemplate();
  }, [templateId, supabase, templates]);

  useEffect(() => {
    let active = true;

    async function loadSelectOptions() {
      const [customersResult, machinesResult, ticketsResult, employeesResult] = await Promise.all([
        supabase
          .from("customers")
          .select("id, company_name")
          .eq("company_id", companyId)
          .order("company_name", { ascending: true }),
        supabase
          .from("machines")
          .select("id, customer_id, machine_name, machine_code")
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

      const customerRecords = ((customersResult.data ?? []) as Array<{ id: string; company_name: string | null }>)
        .map((item) => ({
          id: item.id,
          label: item.company_name ?? "",
        }))
        .filter((item) => item.id && item.label.trim());
      const machineRecords = ((
        machinesResult.data ?? []
      ) as Array<{ id: string; customer_id: string | null; machine_name: string | null; machine_code: string | null }>)
        .map((item) => ({
          id: item.id,
          customer_id: item.customer_id,
          label: item.machine_name ?? "",
          machine_code: item.machine_code,
        }))
        .filter((item) => item.id && item.label.trim());
      const ticketRecords = ((
        ticketsResult.data ?? []
      ) as Array<{
        id: string;
        customer_id: string | null;
        machine_id: string | null;
        ticket_no: string | null;
        title: string | null;
      }>)
        .map((item) => ({
          id: item.id,
          customer_id: item.customer_id,
          machine_id: item.machine_id,
          label: [item.ticket_no, item.title].filter(Boolean).join(" - "),
          ticket_no: item.ticket_no,
        }))
        .filter((item) => item.id && item.label.trim());

      setSelectSourceRecords({
        customers: customerRecords,
        machines: machineRecords,
        tickets: ticketRecords,
      });
      setSelectSourceOptions({
        "": [],
        customers: sortOptions(customerRecords.map((item) => item.label)),
        machines: sortOptions(machineRecords.map((item) => item.label)),
        tickets: sortOptions(ticketRecords.map((item) => item.label)),
        employees: sortOptions(
          ((employeesResult.data ?? []) as Array<{ full_name: string | null }>).map(
            (item) => item.full_name ?? ""
          )
        ),
      });
    }

    loadSelectOptions();

    return () => {
      active = false;
    };
  }, [companyId, supabase]);

  useEffect(() => {
    setTemplateFields((prev) =>
      prev.map((field) => {
        const dataSource = asSelectDataSource(field.data_source);
        if (field.field_type !== "select" || !dataSource) return field;

        return {
          ...field,
          options_json: withMultiSelectMarker(selectSourceOptions[dataSource], isMultiSelectField(field)),
        };
      })
    );
  }, [selectSourceOptions]);

  function setFieldValue(fieldId: string, value: string) {
    setFieldValues((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  }

  function saveSignatureToField(fieldId: string) {
    const pad = signaturePadRef.current;
    if (!pad) return;

    if (signaturePadClearedRef.current || pad.isEmpty()) {
      setFieldValue(fieldId, "");
    } else {
      const dataUrl = pad.toDataURL("image/png");
      setFieldValue(fieldId, dataUrl);
    }
    signaturePadClearedRef.current = false;
    setActiveSignatureFieldId(null);
  }

  function clearSignaturePad() {
    const pad = signaturePadRef.current;
    if (!pad) return;
    signaturePadClearedRef.current = true;
    pad.clear();
  }

  useEffect(() => {
    if (!activeSignatureFieldId) {
      signaturePadClearedRef.current = false;
      return;
    }

    const syncSignaturePad = () => {
      const pad = signaturePadRef.current;
      if (!pad) return;

      const existingValue = fieldValues[activeSignatureFieldId];
      pad.clear();

      if (existingValue && existingValue.startsWith("data:image")) {
        pad.fromDataURL(existingValue);
        signaturePadClearedRef.current = false;
        return;
      }

      signaturePadClearedRef.current = true;
    };

    const frameId = window.requestAnimationFrame(syncSignaturePad);
    return () => window.cancelAnimationFrame(frameId);
  }, [activeSignatureFieldId, fieldValues]);

  function toggleCheckbox(fieldId: string) {
    setFieldValue(fieldId, (fieldValues[fieldId] ?? "") === "true" ? "false" : "true");
  }

  function getSerialNumberValue(formNo?: string | null) {
    return formNo ?? initialForm?.form_no ?? "";
  }

  function activateOverlayFieldControl(container: HTMLDivElement, field: TemplateField) {
    if (field.field_type === "checkbox" || field.field_type === "signature") return;

    const control = container.querySelector<PickerControl | HTMLTextAreaElement>("input, select, textarea");
    if (!control) return;

    control.focus({ preventScroll: true });

    if ((control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) && control.type !== "date") {
      const valueLength = control.value.length;
      try {
        control.setSelectionRange(valueLength, valueLength);
      } catch {
        // Some input types do not support manual selection ranges.
      }
    }

    if ((field.field_type === "date" || field.field_type === "time" || field.field_type === "select") && "showPicker" in control) {
      try {
        control.showPicker?.();
      } catch {
        // Some mobile browsers only allow focus, not programmatic picker opening.
      }
    }
  }

  async function handleExportPdf() {
    try {
      setExportingPdf(true);
      setErrorText("");

      window.dispatchEvent(
        new CustomEvent("noxo:notification", {
          detail: { message: "Pdf oluşturuluyor lütfen bekleyin" },
        })
      );

      if (!pdfUrl) {
        throw new Error("PDF bulunamadı.");
      }

      const pdfBytes = await fetch(pdfUrl).then((res) => {
        if (!res.ok) throw new Error("PDF indirilemedi.");
        return res.arrayBuffer();
      });

      const pdfDoc = await PDFDocument.load(pdfBytes);
      pdfDoc.registerFontkit(fontkit);
      const fontBytes = await fetch(PDF_FONT_PATH).then((res) => {
        if (!res.ok) throw new Error("PDF fontu yüklenemedi.");
        return res.arrayBuffer();
      });
      const font = await pdfDoc.embedFont(fontBytes, { subset: true });

      for (const field of templateFields) {
        const page = pdfDoc.getPage(field.page_number - 1);
        if (!page) continue;

        const pageSize = page.getSize();
        const x = (field.pos_x / 100) * pageSize.width;
        const yTop = pageSize.height - (field.pos_y / 100) * pageSize.height;
        const boxWidth = (field.width / 100) * pageSize.width;
        const boxHeight = (field.height / 100) * pageSize.height;
        const y = yTop - boxHeight;

        const rawValue = fieldValues[field.id] ?? "";

        if (field.field_type === "signature" && rawValue.startsWith("data:image")) {
          const pngImage = await pdfDoc.embedPng(rawValue);
          page.drawImage(pngImage, {
            x,
            y,
            width: boxWidth,
            height: boxHeight,
          });
          continue;
        }

        const textValue = formatPdfText(field, rawValue);
        if (!textValue) continue;

        const fontSize = getFittedFontSize(
          font,
          textValue,
          field.font_size || 10,
          Math.max(8, boxWidth - 6),
          Math.max(4, boxHeight - 4)
        );
        const textWidth = font.widthOfTextAtSize(textValue, fontSize);

        let drawX = x + 3;
        if (field.text_align === "center") {
          drawX = x + Math.max(3, (boxWidth - textWidth) / 2);
        } else if (field.text_align === "right") {
          drawX = x + Math.max(3, boxWidth - textWidth - 3);
        }

        const drawY = y + Math.max(2, boxHeight / 2 - fontSize / 2);

        page.drawText(textValue, {
          x: drawX,
          y: drawY,
          size: fontSize,
          font,
          maxWidth: Math.max(20, boxWidth - 6),
        });
      }

      const finalBytes = await pdfDoc.save();
      const pdfArray = new Uint8Array(finalBytes);
      const blob = new Blob([pdfArray.buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const safeName =
        selectedTemplate?.template_name?.trim().replace(/[^\w\-]+/g, "_") || "servis_formu";

      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();

      URL.revokeObjectURL(url);
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : "PDF export hatası.");
    } finally {
      setExportingPdf(false);
    }
  }

  function resolveLinkedRecordIds() {
    let customerId = initialForm?.customer_id ?? null;
    let machineId = initialForm?.machine_id ?? null;
    let ticketId = initialForm?.ticket_id ?? null;

    for (const field of templateFields) {
      const value =
        field.field_type === "select" && isMultiSelectField(field)
          ? parseMultiSelectValue(fieldValues[field.id] ?? "")[0] ?? ""
          : fieldValues[field.id] ?? "";
      const lookupValue = normalizeLookupValue(value);
      if (!lookupValue) continue;

      const dataSource = asSelectDataSource(field.data_source);
      const fieldKey = field.field_key;

      if (dataSource === "customers" || fieldKey === "customer.company_name") {
        const customer = selectSourceRecords.customers.find(
          (item) => normalizeLookupValue(item.label) === lookupValue
        );
        if (customer) {
          customerId = customer.id;
        }
      }

      if (dataSource === "machines" || fieldKey === "machine.machine_name") {
        const machine = selectSourceRecords.machines.find(
          (item) =>
            normalizeLookupValue(item.label) === lookupValue ||
            normalizeLookupValue(item.machine_code) === lookupValue
        );
        if (machine) {
          machineId = machine.id;
          customerId = customerId ?? machine.customer_id;
        }
      }

      if (dataSource === "tickets" || fieldKey === "ticket.ticket_no") {
        const ticket = selectSourceRecords.tickets.find(
          (item) =>
            normalizeLookupValue(item.label) === lookupValue ||
            normalizeLookupValue(item.ticket_no) === lookupValue
        );
        if (ticket) {
          ticketId = ticket.id;
          customerId = customerId ?? ticket.customer_id;
          machineId = machineId ?? ticket.machine_id;
        }
      }
    }

    return { customerId, machineId, ticketId };
  }

  async function handleSave() {
    try {
      setSaving(true);
      setErrorText("");
      setSuccessText("");

      if (!templateId) throw new Error("Form seçmek zorunludur.");
      const { customerId, machineId, ticketId } = resolveLinkedRecordIds();
      if (!customerId) {
        throw new Error("Müşteri seçmek zorunludur. Formdaki müşteri alanından kayıtlı bir müşteri seçin.");
      }

      let formId = initialForm?.id ?? null;
      let formNo = initialForm?.form_no ?? null;

      if (mode === "create") {
        const { data, error } = await supabase
          .from("service_forms")
          .insert({
            company_id: companyId,
            template_id: templateId,
            customer_id: customerId,
            machine_id: machineId,
            ticket_id: ticketId,
            engineer_id: userId,
            service_date: serviceDate,
            status: "draft",
            created_by: userId,
          })
          .select("id, form_no")
          .single();

        if (error) throw new Error(error.message);
        formId = data.id;
        formNo = data.form_no ?? null;
      } else {
        const { error } = await supabase
          .from("service_forms")
          .update({
            template_id: templateId,
            customer_id: customerId,
            machine_id: machineId,
            ticket_id: ticketId,
            service_date: serviceDate,
          })
          .eq("id", initialForm?.id)
          .eq("company_id", companyId);

        if (error) throw new Error(error.message);
        formId = initialForm?.id ?? null;
      }

      if (!formId) throw new Error("Form kaydı oluşturulamadı.");

      const payload: FormFieldValue[] = templateFields.map((field) => ({
        template_field_id: field.id,
        field_key: field.field_key,
        value_text: field.field_type === "serial_number" ? getSerialNumberValue(formNo) : fieldValues[field.id] ?? "",
      }));

      if (payload.length > 0) {
        const deleteRes = await supabase
          .from("service_form_field_values")
          .delete()
          .eq("service_form_id", formId);

        if (deleteRes.error) throw new Error(deleteRes.error.message);

        const insertPayload = payload.map((item) => ({
          company_id: companyId,
          service_form_id: formId,
          template_field_id: item.template_field_id,
          field_key: item.field_key,
          value_text: item.value_text,
          created_by: userId,
        }));

        const { error: fieldInsertError } = await supabase
          .from("service_form_field_values")
          .insert(insertPayload);

        if (fieldInsertError) throw new Error(fieldInsertError.message);
      }

      setSuccessText("Servis formu kaydedildi.");
      router.push("/dashboard/service-forms");
      router.refresh();
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : "Bilinmeyen hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  const sliderValue = MAX_ZOOM + MIN_ZOOM - zoom;
  const pageWidth = Math.round((BASE_PAGE_WIDTH * zoom) / 100);
  const getOverlayFieldBoxSize = (field: TemplateField) => ({
    width: (field.width / 100) * pageWidth,
    height: (field.height / 100) * pageWidth * 1.414,
  });
  const getOverlayDisplayValue = (field: TemplateField) => {
    if (field.field_type === "serial_number") {
      return getSerialNumberValue();
    }

    const rawValue = fieldValues[field.id] ?? "";
    return formatOverlayText(field, rawValue);
  };
  const getOverlayScaledFontSize = (field: TemplateField) => {
    const baseFontSize = field.font_size || 11;
    const scaledFontSize = Math.max(4, Math.min(baseFontSize, (baseFontSize * zoom) / 100));
    const boxSize = getOverlayFieldBoxSize(field);

    return getOverlayFittedFontSize(getOverlayDisplayValue(field), scaledFontSize, boxSize.width, boxSize.height);
  };
  const getOverlayFieldTextStyle = (field: TemplateField) => {
    const scaledFontSize = getOverlayScaledFontSize(field);
    const scaledPaddingX = Math.max(1, (4 * zoom) / 100);
    const scaledPaddingY = Math.max(0, (2 * zoom) / 100);

    return {
      "--overlay-mobile-scale": String(Math.max(0.25, Math.min(1, scaledFontSize / 16))),
      fontSize: `${scaledFontSize}px`,
      lineHeight: 1,
      paddingLeft: `${scaledPaddingX}px`,
      paddingRight: `${scaledPaddingX}px`,
      paddingTop: `${scaledPaddingY}px`,
      paddingBottom: `${scaledPaddingY}px`,
      textAlign: field.text_align,
    } satisfies OverlayControlStyle;
  };
  const getOverlayInputTextStyle = (field: TemplateField) => {
    const scaledFontSize = getOverlayScaledFontSize(field);
    const scaledPaddingX = Math.max(1, (4 * zoom) / 100);

    return {
      "--overlay-mobile-scale": String(Math.max(0.25, Math.min(1, scaledFontSize / 16))),
      fontSize: `${scaledFontSize}px`,
      lineHeight: 1,
      paddingLeft: `${scaledPaddingX}px`,
      paddingRight: `${scaledPaddingX}px`,
      paddingTop: 0,
      paddingBottom: 0,
      textAlign: field.text_align,
    } satisfies OverlayControlStyle;
  };
  const getOverlayButtonTextStyle = (field: TemplateField) => {
    const scaledFontSize = getOverlayScaledFontSize(field);

    return {
      "--overlay-mobile-scale": String(Math.max(0.25, Math.min(1, scaledFontSize / 16))),
      fontSize: `${scaledFontSize}px`,
      lineHeight: 1,
    } satisfies OverlayControlStyle;
  };
  const getOverlayInputType = (field: TemplateField) => {
    if (field.field_type === "number") return usePhoneOverlayInputMode ? "text" : "number";
    if (field.field_type === "date") return "date";
    if (field.field_type === "time") return "time";
    return "text";
  };
  const getOverlayInputMode = (field: TemplateField) => {
    if (field.field_type === "number") return "decimal";
    return undefined;
  };
  const getOverlayControlClass = (baseClassName: string) => {
    return `h-full w-full ${baseClassName}`;
  };
  const getOverlayEditableControlClass = (baseClassName: string) => {
    return getOverlayControlClass(`service-form-overlay-control ${baseClassName}`);
  };
  const getOverlayInputClass = (field: TemplateField) =>
    getOverlayEditableControlClass(
      `overflow-hidden whitespace-nowrap border-0 bg-transparent text-slate-900 outline-none ${
        field.field_type === "date" || field.field_type === "time" ? "service-form-overlay-picker-input" : ""
      }`
    );
  const getOverlayDateDisplayClass = (field: TemplateField) => {
    const alignClass =
      field.text_align === "center" ? "justify-center text-center" : field.text_align === "right" ? "justify-end text-right" : "justify-start text-left";

    return `pointer-events-none hidden h-full w-full items-center overflow-hidden whitespace-nowrap text-slate-900 ${alignClass} service-form-overlay-date-value`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{pageTitle}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={backHref}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Geri
          </Link>

          {canDelete && deleteAction ? (
            <form action={deleteAction}>
              <button
                type="submit"
                className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:border-red-300 hover:bg-red-50"
              >
                Formu Sil
              </button>
            </form>
          ) : null}

          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exportingPdf || !pdfUrl}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            {exportingPdf ? "Hazırlanıyor..." : "PDF İndir"}
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? "Kaydediliyor..." : mode === "create" ? "Formu Kaydet" : "Formu Güncelle"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="inline-grid gap-3 md:grid-cols-[minmax(280px,360px)]">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Form Seçimi
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm font-normal"
            >
              <option value="">Form seçin</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.template_name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {errorText ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorText}
        </div>
      ) : null}

      {successText ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {successText}
        </div>
      ) : null}

      <div className="rounded-xl border bg-white p-2 sm:p-5">
        {!templateId ? (
          <div className="flex min-h-[500px] items-center justify-center rounded-xl border border-dashed text-sm text-gray-500">
            Önce form seçin
          </div>
        ) : loadingTemplate ? (
          <div className="flex min-h-[500px] items-center justify-center rounded-xl border border-dashed text-sm text-gray-500">
            Form yükleniyor...
          </div>
        ) : !pdfUrl ? (
          <div className="flex min-h-[500px] items-center justify-center rounded-xl border border-dashed text-sm text-gray-500">
            PDF yüklenemedi
          </div>
        ) : (
          <div className="service-form-pdf-grid grid gap-4 overflow-x-hidden overflow-y-visible">
            <div className="min-w-0">
              <Document
                file={pdfUrl}
                onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                loading={<div className="py-10 text-center text-sm text-gray-500">PDF yükleniyor...</div>}
              >
                <div className="space-y-6">
                  {Array.from({ length: numPages || 0 }).map((_, index) => {
                    const pageNumber = index + 1;
                    const pageFields = templateFields.filter((field) => field.page_number === pageNumber);

                    return (
                      <div
                        key={pageNumber}
                        className="flex justify-center"
                        style={{ minWidth: `${pageWidth}px` }}
                      >
                        <div
                          className="relative block overflow-hidden rounded-lg border bg-white shadow-sm [&_.react-pdf__Page]:!w-full [&_.react-pdf__Page__canvas]:!h-auto [&_.react-pdf__Page__canvas]:!w-full"
                          style={{ width: `${pageWidth}px` }}
                        >
                          <Page
                            pageNumber={pageNumber}
                            width={pageWidth}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                          />

                          <div
                            ref={(el) => {
                              overlayRefs.current[pageNumber] = el;
                            }}
                            className="absolute inset-0"
                          >
                            {pageFields.map((field) => (
                              <div
                                key={field.id}
                                className="absolute overflow-hidden rounded border border-blue-500 bg-blue-100/25"
                                onPointerUp={(event) => {
                                  if (event.target !== event.currentTarget) return;
                                  activateOverlayFieldControl(event.currentTarget, field);
                                }}
                                style={{
                                  left: `${field.pos_x}%`,
                                  top: `${field.pos_y}%`,
                                  width: `${field.width}%`,
                                  height: `${field.height}%`,
                                }}
                                title={field.field_label}
                              >
                                {field.field_type === "select" ? (
                                  isMultiSelectField(field) ? (
                                    <select
                                      multiple
                                      value={parseMultiSelectValue(fieldValues[field.id] ?? "")}
                                      onChange={(event) =>
                                        setFieldValue(
                                          field.id,
                                          serializeMultiSelectValue(
                                            Array.from(event.target.selectedOptions, (option) => option.value)
                                          )
                                        )
                                      }
                                      className={getOverlayEditableControlClass("overflow-auto border-0 bg-transparent text-slate-900 outline-none")}
                                      style={getOverlayFieldTextStyle(field)}
                                    >
                                      {getVisibleSelectOptions(field.options_json)
                                        .sort((a, b) => a.localeCompare(b, "tr", { sensitivity: "base" }))
                                        .map((opt) => (
                                          <option key={opt} value={opt}>
                                            {opt}
                                          </option>
                                        ))}
                                    </select>
                                  ) : (
                                    <select
                                      value={fieldValues[field.id] ?? ""}
                                      onChange={(event) => setFieldValue(field.id, event.target.value)}
                                      className={getOverlayEditableControlClass("overflow-hidden whitespace-nowrap border-0 bg-transparent text-slate-900 outline-none")}
                                      style={getOverlayFieldTextStyle(field)}
                                    >
                                      <option value="">Seçin</option>
                                      {getVisibleSelectOptions(field.options_json)
                                        .sort((a, b) => a.localeCompare(b, "tr", { sensitivity: "base" }))
                                        .map((opt) => (
                                          <option key={opt} value={opt}>
                                            {opt}
                                          </option>
                                        ))}
                                    </select>
                                  )
                                ) : field.field_type === "checkbox" ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleCheckbox(field.id)}
                                    className={getOverlayControlClass("flex items-center justify-center font-black text-slate-900")}
                                    style={getOverlayButtonTextStyle(field)}
                                  >
                                    {(fieldValues[field.id] ?? "") === "true" ? "X" : ""}
                                  </button>
                                ) : field.field_type === "signature" ? (
                                  <button
                                    type="button"
                                    onClick={() => setActiveSignatureFieldId(field.id)}
                                    className="flex h-full w-full items-center justify-center text-slate-700"
                                    style={getOverlayButtonTextStyle(field)}
                                  >
                                    {(fieldValues[field.id] ?? "").startsWith("data:image") ? (
                                      <img
                                        src={fieldValues[field.id]}
                                        alt="İmza"
                                        className="max-h-full max-w-full object-contain"
                                      />
                                    ) : (
                                      ""
                                    )}
                                  </button>
                                ) : field.field_type === "textarea" ? (
                                  <textarea
                                    value={fieldValues[field.id] ?? ""}
                                    onChange={(event) => setFieldValue(field.id, event.target.value)}
                                    className={getOverlayEditableControlClass("resize-none overflow-hidden border-0 bg-transparent text-slate-900 outline-none")}
                                    style={getOverlayFieldTextStyle(field)}
                                  />
                                ) : field.field_type === "date" || field.field_type === "time" ? (
                                  <div className="group relative h-full w-full">
                                    <input
                                      type={field.field_type === "date" ? "date" : "time"}
                                      value={fieldValues[field.id] ?? ""}
                                      onChange={(event) => setFieldValue(field.id, event.target.value)}
                                      className={getOverlayInputClass(field)}
                                      style={getOverlayInputTextStyle(field)}
                                    />
                                    <span className={getOverlayDateDisplayClass(field)} style={getOverlayInputTextStyle(field)}>
                                      {getOverlayDisplayValue(field)}
                                    </span>
                                    {fieldValues[field.id] && (
                                      <button
                                        type="button"
                                        onPointerDown={(event) => {
                                          event.stopPropagation();
                                        }}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setFieldValue(field.id, "");
                                        }}
                                        aria-label={`${field.field_label} alanını temizle`}
                                        className="service-form-overlay-clear-button absolute right-0 top-0 z-10 flex h-full min-w-[18px] items-center justify-center bg-blue-100/80 px-1 text-[10px] font-bold text-red-600 dark:bg-slate-800/80"
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </div>
                                ) : field.field_type === "serial_number" ? (
                                  <div
                                    className={getOverlayControlClass("overflow-hidden whitespace-nowrap border-0 bg-transparent text-slate-900 outline-none")}
                                    style={getOverlayInputTextStyle(field)}
                                  >
                                    {getOverlayDisplayValue(field)}
                                  </div>
                                ) : (
                                  <input
                                    type={getOverlayInputType(field)}
                                    inputMode={getOverlayInputMode(field)}
                                    value={fieldValues[field.id] ?? ""}
                                    onChange={(event) => setFieldValue(field.id, event.target.value)}
                                    className={getOverlayInputClass(field)}
                                    style={getOverlayInputTextStyle(field)}
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Document>
            </div>

            <div className="service-form-zoom-control sticky top-4 hidden h-[420px] flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white px-3 py-4 shadow-sm">
              <div className="text-xs font-semibold text-slate-600">{zoom}%</div>
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={1}
                value={sliderValue}
                onChange={(event) => setZoom(MAX_ZOOM + MIN_ZOOM - Number(event.target.value))}
                aria-label="Yakınlaştırma"
                className="h-72 w-8 cursor-pointer accent-slate-900 [writing-mode:vertical-rl]"
              />
            </div>

            {activeSignatureField ? (
              <div
                className="fixed left-1/2 top-1/2 z-50 w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-3 text-sm font-semibold text-slate-950 dark:text-slate-100">{activeSignatureField.field_label}</div>

                <div className="space-y-3">
                  <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-white">
                    <SignatureCanvas
                      ref={(ref) => {
                        signaturePadRef.current = ref;
                      }}
                      penColor="black"
                      onBegin={() => {
                        signaturePadClearedRef.current = false;
                      }}
                      canvasProps={{
                        width: 290,
                        height: 150,
                        className: "block w-full bg-white",
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={clearSignaturePad}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      Temizle
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveSignatureFieldId(null)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        Kapat
                      </button>

                      <button
                        type="button"
                        onClick={() => saveSignatureToField(activeSignatureField.id)}
                        className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                      >
                        Kaydet
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <style jsx global>{`
        @media (min-width: 1024px) and (pointer: fine) {
          .service-form-pdf-grid {
            grid-template-columns: minmax(0, 1fr) 72px;
            overflow: auto;
          }

          .service-form-zoom-control {
            display: flex;
          }
        }

        @media (max-width: 767px) and (pointer: coarse) {
          .service-form-overlay-control {
            font-size: 16px !important;
            height: calc(100% / var(--overlay-mobile-scale));
            left: 0;
            line-height: 1 !important;
            position: absolute;
            top: 50%;
            transform: translateY(-50%) scale(var(--overlay-mobile-scale));
            transform-origin: left center;
            width: calc(100% / var(--overlay-mobile-scale));
          }

          .service-form-overlay-picker-input {
            inset: 0;
            line-height: 1;
            opacity: 0;
            position: absolute;
          }

          .service-form-overlay-picker-input::-webkit-calendar-picker-indicator {
            height: 0;
            margin: 0;
            opacity: 0;
            padding: 0;
            pointer-events: none;
            width: 0;
          }

          .service-form-overlay-picker-input::-webkit-date-and-time-value {
            min-height: 0;
            text-align: inherit;
          }

          .service-form-overlay-picker-input::-webkit-inner-spin-button {
            display: none;
          }

          .service-form-overlay-date-value {
            display: flex;
          }

          .service-form-overlay-clear-button {
            opacity: 1;
          }
        }

        @media (hover: hover) and (pointer: fine) {
          .service-form-overlay-clear-button {
            opacity: 0;
          }

          .group:hover .service-form-overlay-clear-button {
            opacity: 1;
          }
        }

      `}</style>
    </div>
  );
}




