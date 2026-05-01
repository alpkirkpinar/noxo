"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Document, Page, pdfjs } from "react-pdf";
import { createClient } from "@/lib/supabase/client";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type FontFamily =
  | "Calibri"
  | "Arial"
  | "Helvetica"
  | "Verdana"
  | "Tahoma"
  | "TrebuchetMS"
  | "Georgia"
  | "TimesNewRoman"
  | "CourierNew"
  | "LucidaSans";

type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "time"
  | "serial_number"
  | "select"
  | "checkbox"
  | "signature";

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
  font_family: FontFamily;
  text_align: "left" | "center" | "right";
  vertical_align: "top" | "middle" | "bottom";
  field_type: FieldType;
  is_required: boolean;
  data_source: string | null;
  options_json: string[];
  show_in_input_panel: boolean;
  is_readonly: boolean;
  default_value?: string | null;
  form_row_id?: string | null;
};

type TemplateInitialValues = {
  id?: string;
  template_code?: string | null;
  template_name?: string | null;
  page_count?: number | null;
  is_active?: boolean | null;
  file_path?: string | null;
};

type Props = {
  companyId: string;
  userId: string;
  mode: "create" | "edit";
  initialTemplate?: TemplateInitialValues;
  initialFields?: TemplateField[];
  editorMode?: "template" | "layout";
};

type DraftRect = {
  pageNumber: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

type PendingRect = {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  clientX: number;
  clientY: number;
};

type DragState = {
  fieldId: string;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
};

type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

type ResizeState = {
  fieldId: string;
  direction: ResizeDirection;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
};

type ContextMenuState = {
  x: number;
  y: number;
  fieldId: string | null;
  pageNumber: number | null;
};

type FieldRow = {
  key: string;
  fields: TemplateField[];
  startIndex: number;
  endIndex: number;
};

type SelectDataSource = "" | "customers" | "machines" | "tickets" | "employees";

const STORAGE_BUCKET = "template-pdfs";
const BASE_PAGE_WIDTH = 900;
const MIN_W = 0.5;
const MIN_H = 0.5;
const MULTI_SELECT_OPTION_MARKER = "__noxo_multi_select__";

function parseFieldLayoutMeta(value: string | null | undefined) {
  if (!value) return { form_row_id: null as string | null };

  try {
    const parsed = JSON.parse(value) as { form_row_id?: unknown };
    return {
      form_row_id: typeof parsed.form_row_id === "string" && parsed.form_row_id.trim() ? parsed.form_row_id : null,
    };
  } catch {
    return { form_row_id: null as string | null };
  }
}

function serializeFieldLayoutMeta(field: Pick<TemplateField, "form_row_id">) {
  if (!field.form_row_id) return null;
  return JSON.stringify({ form_row_id: field.form_row_id });
}

function buildFieldRows(fields: TemplateField[]) {
  const rows: FieldRow[] = [];

  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index];
    const rowFields = [field];
    let cursor = index + 1;

    if (field.form_row_id) {
      while (cursor < fields.length && fields[cursor].form_row_id === field.form_row_id) {
        rowFields.push(fields[cursor]);
        cursor += 1;
      }
    }

    rows.push({
      key: field.form_row_id || field.id,
      fields: rowFields,
      startIndex: index,
      endIndex: cursor - 1,
    });

    index = cursor - 1;
  }

  return rows;
}

const FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: "text", label: "Metin" },
  { value: "textarea", label: "Uzun Metin" },
  { value: "number", label: "Sayı" },
  { value: "date", label: "Tarih" },
  { value: "time", label: "Saat" },
  { value: "serial_number", label: "Seri Numarası" },
  { value: "select", label: "Seçim Kutusu" },
  { value: "checkbox", label: "Onay Kutusu" },
  { value: "signature", label: "İmza" },
];

const SELECT_DATA_SOURCE_OPTIONS: { value: SelectDataSource; label: string }[] = [
  { value: "", label: "Manuel Liste" },
  { value: "customers", label: "Müşteriler" },
  { value: "machines", label: "Makineler" },
  { value: "tickets", label: "Ticketlar" },
  { value: "employees", label: "Çalışanlar" },
] as const;

const FONT_OPTIONS: { value: FontFamily; label: string }[] = [
  { value: "Calibri", label: "Calibri" },
  { value: "Arial", label: "Arial" },
  { value: "Helvetica", label: "Helvetica" },
  { value: "Verdana", label: "Verdana" },
  { value: "Tahoma", label: "Tahoma" },
  { value: "TrebuchetMS", label: "Trebuchet MS" },
  { value: "Georgia", label: "Georgia" },
  { value: "TimesNewRoman", label: "Times New Roman" },
  { value: "CourierNew", label: "Courier New" },
  { value: "LucidaSans", label: "Lucida Sans" },
];

function toSlug(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function createFieldKey(label: string, index: number) {
  return `${toSlug(label || "alan")}_${index + 1}`;
}

function createClientId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function fieldTypeLabel(value: FieldType) {
  return FIELD_TYPE_OPTIONS.find((x) => x.value === value)?.label ?? value;
}

function getHandleClass(direction: ResizeDirection) {
  const base = "absolute h-3 w-3 rounded-full border border-white bg-black";
  switch (direction) {
    case "n":
      return `${base} left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-n-resize`;
    case "s":
      return `${base} bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-s-resize`;
    case "e":
      return `${base} right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-e-resize`;
    case "w":
      return `${base} left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-w-resize`;
    case "ne":
      return `${base} right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-ne-resize`;
    case "nw":
      return `${base} left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nw-resize`;
    case "se":
      return `${base} bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-se-resize`;
    case "sw":
      return `${base} bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-sw-resize`;
  }
}

function getRectFromDraft(draft: DraftRect) {
  const left = Math.min(draft.startX, draft.currentX);
  const top = Math.min(draft.startY, draft.currentY);
  const width = Math.abs(draft.currentX - draft.startX);
  const height = Math.abs(draft.currentY - draft.startY);

  return { left, top, width, height };
}

function createFieldFromPending(
  pending: PendingRect,
  fieldType: FieldType,
  index: number
): TemplateField {
  const label = `${fieldTypeLabel(fieldType)} ${index + 1}`;
  let width = pending.width;
  let height = pending.height;

  if (fieldType === "checkbox") {
    const size = Math.min(width, height);
    width = size;
    height = size;
  }

  return {
    id: createClientId(),
    field_key: createFieldKey(label, index),
    field_label: label,
    page_number: pending.pageNumber,
    pos_x: Number(pending.x.toFixed(2)),
    pos_y: Number(pending.y.toFixed(2)),
    width: Number(width.toFixed(2)),
    height: Number(height.toFixed(2)),
    font_size: 10,
    font_family: "Calibri",
    text_align: "left",
    vertical_align: "middle",
    field_type: fieldType,
    is_required: false,
    data_source: null,
    options_json: fieldType === "select" ? ["Seçenek 1", "Seçenek 2"] : [],
    show_in_input_panel: true,
    is_readonly: false,
    default_value: null,
    form_row_id: null,
  };
}

function getPreviewText(field: TemplateField) {
  if (field.field_type === "checkbox") return "☐";
  if (field.field_type === "signature") return "İMZA";
  if (field.field_type === "serial_number") return "SERİ NO";
  return field.field_label;
}

function getPreviewFontFamily(font: FontFamily) {
  switch (font) {
    case "Calibri":
      return "Calibri, Arial, sans-serif";
    case "Arial":
      return "Arial, sans-serif";
    case "Helvetica":
      return "Helvetica, Arial, sans-serif";
    case "Verdana":
      return "Verdana, sans-serif";
    case "Tahoma":
      return "Tahoma, sans-serif";
    case "TrebuchetMS":
      return "'Trebuchet MS', sans-serif";
    case "Georgia":
      return "Georgia, serif";
    case "TimesNewRoman":
      return "'Times New Roman', serif";
    case "CourierNew":
      return "'Courier New', monospace";
    case "LucidaSans":
      return "'Lucida Sans Unicode', 'Lucida Sans', sans-serif";
  }
}

function sortOptions(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "tr", { sensitivity: "base" })
  );
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

function asSelectDataSource(value: string | null | undefined): SelectDataSource {
  if (value === "customers" || value === "machines" || value === "tickets" || value === "employees") {
    return value;
  }

  return "";
}

function getPendingFieldTypeMenuStyle(pending: PendingRect) {
  const viewportWidth = typeof window === "undefined" ? 1024 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 768 : window.innerHeight;
  const menuWidth = 224;
  const maxHeight = Math.min(360, Math.max(180, viewportHeight - 24));

  return {
    left: Math.max(12, Math.min(pending.clientX + 10, viewportWidth - menuWidth - 12)),
    top: Math.max(12, Math.min(pending.clientY + 10, viewportHeight - maxHeight - 12)),
    maxHeight,
  };
}

export default function PdfTemplateEditor({
  companyId,
  userId,
  mode,
  initialTemplate,
  initialFields = [],
  editorMode = "template",
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const normalizedInitialFields = useMemo(
    () =>
      initialFields.map((field) => ({
        ...field,
        form_row_id: parseFieldLayoutMeta(field.default_value).form_row_id,
      })),
    [initialFields]
  );

  const [templateCode, setTemplateCode] = useState(initialTemplate?.template_code ?? "");
  const [templateName, setTemplateName] = useState(initialTemplate?.template_name ?? "");
  const isActive = initialTemplate?.is_active ?? true;

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfPath] = useState(initialTemplate?.file_path ?? "");
  const [numPages, setNumPages] = useState<number>(initialTemplate?.page_count ?? 0);

  const [zoom, setZoom] = useState(100);
  const pageWidth = Math.round((BASE_PAGE_WIDTH * zoom) / 100);

  const [fields, setFields] = useState<TemplateField[]>(normalizedInitialFields);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(normalizedInitialFields[0]?.id ?? null);

  const [draftRect, setDraftRect] = useState<DraftRect | null>(null);
  const [pendingRect, setPendingRect] = useState<PendingRect | null>(null);

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);

  const [fieldPage, setFieldPage] = useState(0);
  const [copiedField, setCopiedField] = useState<TemplateField | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [fieldTypeMenuOpen, setFieldTypeMenuOpen] = useState(false);
  const [selectSourceOptions, setSelectSourceOptions] = useState<Record<SelectDataSource, string[]>>({
    "": [],
    customers: [],
    machines: [],
    tickets: [],
    employees: [],
  });

  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");

  const overlayRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const fieldTypeMenuRef = useRef<HTMLDivElement | null>(null);

  const selectedField = useMemo(
    () => fields.find((field) => field.id === selectedFieldId) ?? null,
    [fields, selectedFieldId]
  );
  const selectedFieldUsesText =
    selectedField ? !["checkbox", "signature"].includes(selectedField.field_type) : false;
  const fieldPageSize = 8;
  const fieldRows = useMemo(() => buildFieldRows(fields), [fields]);
  const fieldPageCount = Math.max(
    1,
    Math.ceil((editorMode === "layout" ? fieldRows.length : fields.length) / fieldPageSize)
  );
  const visibleFields = fields.slice(fieldPage * fieldPageSize, fieldPage * fieldPageSize + fieldPageSize);
  const visibleRows = fieldRows.slice(fieldPage * fieldPageSize, fieldPage * fieldPageSize + fieldPageSize);

  useEffect(() => {
    if (!pdfFile) return;
    const objectUrl = URL.createObjectURL(pdfFile);
    setPdfUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [pdfFile]);

  useEffect(() => {
    async function loadExistingPdf() {
      if (!pdfFile && pdfPath) {
        const { data, error } = await supabase.storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(pdfPath, 3600);

        if (error) {
          console.error("PDF signed URL alınamadı:", error.message);
          return;
        }

        if (data?.signedUrl) {
          setPdfUrl(data.signedUrl);
        }
      }
    }
    loadExistingPdf();
  }, [pdfPath, pdfFile, supabase]);

  useEffect(() => {
    let active = true;

    async function loadSelectOptions() {
      const [customersResult, machinesResult, ticketsResult, employeesResult] = await Promise.all([
        supabase
          .from("customers")
          .select("company_name")
          .eq("company_id", companyId)
          .order("company_name", { ascending: true }),
        supabase
          .from("machines")
          .select("machine_name")
          .eq("company_id", companyId)
          .order("machine_name", { ascending: true }),
        supabase
          .from("tickets")
          .select("ticket_no, title")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),
        supabase
          .from("app_users")
          .select("full_name")
          .eq("company_id", companyId)
          .order("full_name", { ascending: true }),
      ]);

      if (!active) return;

      setSelectSourceOptions({
        "": [],
        customers: sortOptions(
          ((customersResult.data ?? []) as Array<{ company_name: string | null }>).map(
            (item) => item.company_name ?? ""
          )
        ),
        machines: sortOptions(
          ((machinesResult.data ?? []) as Array<{ machine_name: string | null }>).map(
            (item) => item.machine_name ?? ""
          )
        ),
        tickets: sortOptions(
          ((ticketsResult.data ?? []) as Array<{ ticket_no: string | null; title: string | null }>).map((item) =>
            [item.ticket_no, item.title].filter(Boolean).join(" - ")
          )
        ),
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
    setFields((prev) =>
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

  useEffect(() => {
    setFieldPage((currentPage) => Math.min(currentPage, fieldPageCount - 1));
  }, [fieldPageCount]);

  useEffect(() => {
    if (!dragState) return;
    const activeDragState: DragState = dragState;

    function onMove(e: MouseEvent) {
      setFields((prev) =>
        prev.map((field) => {
          if (field.id !== activeDragState.fieldId) return field;

          const overlay = overlayRefs.current[field.page_number];
          if (!overlay) return field;

          const rect = overlay.getBoundingClientRect();
          const dx = ((e.clientX - activeDragState.startClientX) / rect.width) * 100;
          const dy = ((e.clientY - activeDragState.startClientY) / rect.height) * 100;

          const nextX = Math.max(0, Math.min(100 - field.width, activeDragState.startX + dx));
          const nextY = Math.max(0, Math.min(100 - field.height, activeDragState.startY + dy));

          return {
            ...field,
            pos_x: Number(nextX.toFixed(2)),
            pos_y: Number(nextY.toFixed(2)),
          };
        })
      );
    }

    function onUp() {
      setDragState(null);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragState]);

  useEffect(() => {
    if (!resizeState) return;
    const activeResizeState: ResizeState = resizeState;

    function onMove(e: MouseEvent) {
      setFields((prev) =>
        prev.map((field) => {
          if (field.id !== activeResizeState.fieldId) return field;

          const overlay = overlayRefs.current[field.page_number];
          if (!overlay) return field;

          const rect = overlay.getBoundingClientRect();
          const deltaX = ((e.clientX - activeResizeState.startClientX) / rect.width) * 100;
          const deltaY = ((e.clientY - activeResizeState.startClientY) / rect.height) * 100;

          let x = activeResizeState.startX;
          let y = activeResizeState.startY;
          let width = activeResizeState.startWidth;
          let height = activeResizeState.startHeight;

          if (activeResizeState.direction.includes("e")) {
            width = Math.max(MIN_W, activeResizeState.startWidth + deltaX);
          }
          if (activeResizeState.direction.includes("s")) {
            height = Math.max(MIN_H, activeResizeState.startHeight + deltaY);
          }

          if (activeResizeState.direction.includes("w")) {
            width = Math.max(MIN_W, activeResizeState.startWidth - deltaX);
            x = activeResizeState.startX + deltaX;
          }

          if (activeResizeState.direction.includes("n")) {
            height = Math.max(MIN_H, activeResizeState.startHeight - deltaY);
            y = activeResizeState.startY + deltaY;
          }

          if (field.field_type === "checkbox") {
            const size = Math.max(MIN_W, Math.min(width, height));
            width = size;
            height = size;
          }

          x = Math.max(0, Math.min(100 - width, x));
          y = Math.max(0, Math.min(100 - height, y));

          return {
            ...field,
            pos_x: Number(x.toFixed(2)),
            pos_y: Number(y.toFixed(2)),
            width: Number(width.toFixed(2)),
            height: Number(height.toFixed(2)),
          };
        })
      );
    }

    function onUp() {
      setResizeState(null);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizeState]);

  useEffect(() => {
    function closeMenus() {
      setContextMenu(null);
    }
    window.addEventListener("click", closeMenus);
    return () => window.removeEventListener("click", closeMenus);
  }, []);

  useEffect(() => {
    function closeFieldTypeMenu(event: MouseEvent) {
      if (fieldTypeMenuRef.current && event.target instanceof Node) {
        if (fieldTypeMenuRef.current.contains(event.target)) return;
      }

      setFieldTypeMenuOpen(false);
    }

    window.addEventListener("click", closeFieldTypeMenu);
    return () => window.removeEventListener("click", closeFieldTypeMenu);
  }, []);

  function copyField(field: TemplateField) {
    setCopiedField({ ...field });
    setSuccessText("Alan kopyalandı.");
  }

  function pasteField(pageNumber?: number | null) {
    if (!copiedField) return;

    const newField: TemplateField = {
      ...copiedField,
      id: createClientId(),
      field_key: createFieldKey(copiedField.field_label, fields.length),
      page_number: pageNumber ?? copiedField.page_number,
      pos_x: Math.min(95, copiedField.pos_x + 1),
      pos_y: Math.min(95, copiedField.pos_y + 1),
      form_row_id: null,
    };

    setFields((prev) => [...prev, newField]);
    setSelectedFieldId(newField.id);
    setSuccessText("Alan yapıştırıldı.");
  }

  function deleteFieldById(fieldId: string) {
    setFields((prev) => prev.filter((field) => field.id !== fieldId));
    if (selectedFieldId === fieldId) setSelectedFieldId(null);
    setSuccessText("Alan silindi.");
  }

  function updateSelectedField<K extends keyof TemplateField>(key: K, value: TemplateField[K]) {
    if (!selectedFieldId) return;

    setFields((prev) =>
      prev.map((field) =>
        field.id === selectedFieldId ? { ...field, [key]: value } : field
      )
    );
  }

  function updateSelectedFieldType(fieldType: FieldType) {
    if (!selectedFieldId) return;
    setFieldTypeMenuOpen(false);

    setFields((prev) =>
      prev.map((field) => {
        if (field.id !== selectedFieldId) return field;

        return {
          ...field,
          field_type: fieldType,
          data_source: fieldType === "select" ? field.data_source : null,
          options_json:
            fieldType === "select"
              ? withMultiSelectMarker(field.options_json, isMultiSelectField(field))
              : [],
          is_readonly: fieldType === "select" ? false : field.is_readonly,
        };
      })
    );
  }

  function updateSelectedDataSource(dataSource: SelectDataSource) {
    if (!selectedFieldId) return;

    setFields((prev) =>
      prev.map((field) => {
        if (field.id !== selectedFieldId) return field;

        return {
          ...field,
          data_source: dataSource || null,
          options_json: withMultiSelectMarker(
            dataSource ? selectSourceOptions[dataSource] : field.options_json,
            isMultiSelectField(field)
          ),
        };
      })
    );
  }

  function updateSelectedOptions(value: string) {
    if (!selectedField) return;
    updateSelectedField("options_json", withMultiSelectMarker(value.split(","), isMultiSelectField(selectedField)));
  }

  function updateSelectedMultiSelect(enabled: boolean) {
    if (!selectedFieldId) return;

    setFields((prev) =>
      prev.map((field) =>
        field.id === selectedFieldId
          ? { ...field, options_json: withMultiSelectMarker(field.options_json, enabled) }
          : field
      )
    );
  }

  function removeSelectedField() {
    if (!selectedFieldId) return;
    setFields((prev) => prev.filter((field) => field.id !== selectedFieldId));
    setSelectedFieldId(null);
  }

  function duplicateSelectedField() {
    if (!selectedField) return;

    const duplicatedField: TemplateField = {
      ...selectedField,
      id: createClientId(),
      field_key: createFieldKey(`${selectedField.field_label} kopya`, fields.length),
      field_label: `${selectedField.field_label} (kopya)`,
      pos_x: Math.min(95, selectedField.pos_x + 1),
      pos_y: Math.min(95, selectedField.pos_y + 1),
      form_row_id: null,
    };

    setFields((prev) => [...prev, duplicatedField]);
    setSelectedFieldId(duplicatedField.id);
    setSuccessText("Alan kopyalandı.");
  }

  function moveField(fieldId: string, direction: "up" | "down") {
    setFields((prev) => {
      const rows = buildFieldRows(prev);
      const rowIndex = rows.findIndex((row) => row.fields.some((field) => field.id === fieldId));
      if (rowIndex === -1) return prev;

      const targetRowIndex = direction === "up" ? rowIndex - 1 : rowIndex + 1;
      if (targetRowIndex < 0 || targetRowIndex >= rows.length) return prev;

      const nextRows = [...rows];
      const [row] = nextRows.splice(rowIndex, 1);
      nextRows.splice(targetRowIndex, 0, row);

      return nextRows.flatMap((rowItem) => rowItem.fields);
    });

    setSuccessText(direction === "up" ? "Satır yukarı taşındı." : "Satır aşağı taşındı.");
  }

  function mergeFieldWithNeighbor(direction: "up" | "down", fieldId?: string) {
    const targetFieldId = fieldId ?? selectedFieldId;
    if (!targetFieldId) return;

    setFields((prev) => {
      const rows = buildFieldRows(prev);
      const rowIndex = rows.findIndex((row) => row.fields.some((field) => field.id === targetFieldId));
      if (rowIndex === -1) return prev;

      const neighborRowIndex = direction === "up" ? rowIndex - 1 : rowIndex + 1;
      if (neighborRowIndex < 0 || neighborRowIndex >= rows.length) return prev;

      const currentRow = rows[rowIndex];
      const neighborRow = rows[neighborRowIndex];
      const currentGroupId = currentRow.fields[0]?.form_row_id ?? null;
      const neighborGroupId = neighborRow.fields[0]?.form_row_id ?? null;
      const nextGroupId = currentGroupId ?? neighborGroupId ?? `row-${createClientId()}`;

      return prev.map((field) => {
        if (
          currentRow.fields.some((rowField) => rowField.id === field.id) ||
          neighborRow.fields.some((rowField) => rowField.id === field.id) ||
          (currentGroupId && field.form_row_id === currentGroupId) ||
          (neighborGroupId && field.form_row_id === neighborGroupId)
        ) {
          return { ...field, form_row_id: nextGroupId };
        }

        return field;
      });
    });

    setSuccessText(direction === "up" ? "Alan üsttekiyle birleştirildi." : "Alan alttakiyle birleştirildi.");
  }

  function clearFieldMerge(fieldId?: string) {
    const targetFieldId = fieldId ?? selectedFieldId;
    if (!targetFieldId) return;

    setFields((prev) => {
      const selectedIndex = prev.findIndex((field) => field.id === targetFieldId);
      if (selectedIndex === -1) return prev;

      const selected = prev[selectedIndex];
      if (!selected?.form_row_id) return prev;

      const groupId = selected.form_row_id;
      const groupIndexes = prev.flatMap((field, index) => (field.form_row_id === groupId ? [index] : []));
      if (groupIndexes.length === 0) return prev;

      const nextFields = prev.map((field) => ({ ...field }));
      nextFields[selectedIndex].form_row_id = null;

      const selectedGroupPosition = groupIndexes.indexOf(selectedIndex);
      const trailingIndexes = groupIndexes.slice(selectedGroupPosition + 1);

      if (trailingIndexes.length > 0) {
        const trailingGroupId = `row-${createClientId()}`;
        trailingIndexes.forEach((index) => {
          nextFields[index].form_row_id = trailingGroupId;
        });
      }

      return nextFields;
    });

    setSuccessText("Alan birleşimi kaldırıldı.");
  }

  function getPercentPoint(pageNumber: number, clientX: number, clientY: number) {
    const overlay = overlayRefs.current[pageNumber];
    if (!overlay) return null;

    const rect = overlay.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;

    return {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    };
  }

  function handleOverlayMouseDown(pageNumber: number, e: React.MouseEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).dataset.stopCreate === "true") return;

    const point = getPercentPoint(pageNumber, e.clientX, e.clientY);
    if (!point) return;

    setErrorText("");
    setSuccessText("");
    setPendingRect(null);
    setSelectedFieldId(null);

    setDraftRect({
      pageNumber,
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y,
    });
  }

  function handleOverlayMouseMove(pageNumber: number, e: React.MouseEvent<HTMLDivElement>) {
    if (!draftRect || draftRect.pageNumber !== pageNumber) return;

    const point = getPercentPoint(pageNumber, e.clientX, e.clientY);
    if (!point) return;

    setDraftRect((prev) => (prev ? { ...prev, currentX: point.x, currentY: point.y } : null));
  }

  function handleOverlayMouseUp(pageNumber: number, e: React.MouseEvent<HTMLDivElement>) {
    if (!draftRect || draftRect.pageNumber !== pageNumber) return;

    const point = getPercentPoint(pageNumber, e.clientX, e.clientY);
    if (!point) {
      setDraftRect(null);
      return;
    }

    const completedDraft = { ...draftRect, currentX: point.x, currentY: point.y };
    const rect = getRectFromDraft(completedDraft);
    setDraftRect(null);

    if (rect.width < MIN_W || rect.height < MIN_H) {
      setErrorText("Alan çok küçük. Biraz daha geniş sürükleyin.");
      return;
    }

    setPendingRect({
      pageNumber,
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
      clientX: e.clientX,
      clientY: e.clientY,
    });
  }

  function createField(fieldType: FieldType) {
    if (!pendingRect) return;

    const newField = createFieldFromPending(pendingRect, fieldType, fields.length);
    setFields((prev) => [...prev, newField]);
    setSelectedFieldId(newField.id);
    setPendingRect(null);
    setSuccessText("Alan oluşturuldu.");
  }

  function startDragField(e: React.MouseEvent<HTMLDivElement>, field: TemplateField) {
    e.preventDefault();
    e.stopPropagation();

    setSelectedFieldId(field.id);
    setDragState({
      fieldId: field.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: field.pos_x,
      startY: field.pos_y,
    });
  }

  function startResize(
    e: React.MouseEvent<HTMLButtonElement>,
    field: TemplateField,
    direction: ResizeDirection
  ) {
    e.preventDefault();
    e.stopPropagation();

    setSelectedFieldId(field.id);
    setResizeState({
      fieldId: field.id,
      direction,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: field.pos_x,
      startY: field.pos_y,
      startWidth: field.width,
      startHeight: field.height,
    });
  }

  async function uploadPdfIfNeeded() {
    if (!pdfFile) return pdfPath || null;

    const safeCode = templateCode.trim() || toSlug(templateName) || "template";
    const fileName = `${Date.now()}_${safeCode}.pdf`;
    const filePath = `${companyId}/${fileName}`;

    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(filePath, pdfFile, {
      cacheControl: "3600",
      upsert: true,
      contentType: "application/pdf",
    });

    if (error) {
      if (error.message.toLowerCase().includes("bucket")) {
        throw new Error("Storage bucket bulunamadı. Supabase Storage içinde 'template-pdfs' adında bucket oluştur.");
      }
      throw new Error(error.message);
    }

    return filePath;
  }

    async function handleSave() {
    try {
      setSaving(true);
      setErrorText("");
      setSuccessText("");

      if (!templateName.trim()) throw new Error("Şablon adı zorunludur.");
      if (!pdfFile && !pdfPath) throw new Error("PDF yüklemek zorunludur.");

      let resolvedCompanyId = companyId;
      let resolvedUserId = userId;

      if (!resolvedCompanyId || !resolvedUserId) {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          throw new Error("Oturum bilgisi alınamadı.");
        }

        const { data: appUser, error: appUserError } = await supabase
          .from("app_users")
          .select("id, company_id")
          .eq("auth_user_id", user.id)
          .single();

        if (appUserError || !appUser?.company_id || !appUser?.id) {
          throw new Error("app_users içinde company_id veya kullanıcı kaydı bulunamadı.");
        }

        resolvedCompanyId = String(appUser.company_id);
        resolvedUserId = String(appUser.id);
      }

      const finalPdfPath = await uploadPdfIfNeeded();
      if (!finalPdfPath) throw new Error("PDF yolu oluşturulamadı.");

      let templateId = initialTemplate?.id ?? null;

      if (mode === "create") {
        const { data, error } = await supabase
          .from("pdf_templates")
          .insert({
            company_id: resolvedCompanyId,
            template_code: templateCode.trim() || toSlug(templateName),
            template_name: templateName.trim(),
            template_type: "custom_form",
            file_path: finalPdfPath,
            page_count: numPages || 1,
            is_active: isActive,
            created_by: resolvedUserId,
          })
          .select("id")
          .single();

        if (error) throw new Error(error.message);
        templateId = data.id;
      } else {
        const { error } = await supabase
          .from("pdf_templates")
          .update({
            template_code: templateCode.trim() || toSlug(templateName),
            template_name: templateName.trim(),
            template_type: "custom_form",
            file_path: finalPdfPath,
            page_count: numPages || 1,
            is_active: isActive,
          })
          .eq("id", initialTemplate?.id)
          .eq("company_id", resolvedCompanyId);

        if (error) throw new Error(error.message);
        templateId = initialTemplate?.id ?? null;
      }

      if (!templateId) throw new Error("Şablon kimliği oluşturulamadı.");

      const normalizedFields = fields.map((field, index) => ({
        ...field,
        field_key: createFieldKey(field.field_label, index),
        data_source: field.field_type === "select" ? asSelectDataSource(field.data_source) || null : null,
        options_json:
          field.field_type === "select"
            ? withMultiSelectMarker(field.options_json, isMultiSelectField(field))
            : [],
        default_value: serializeFieldLayoutMeta(field),
      }));

      const { error: deleteError } = await supabase
        .from("pdf_template_fields")
        .delete()
        .eq("template_id", templateId);

      if (deleteError) throw new Error(deleteError.message);

      if (normalizedFields.length > 0) {
        const payload = normalizedFields.map((field, index) => ({
          template_id: templateId,
          field_key: field.field_key,
          field_label: field.field_label,
          page_number: field.page_number,
          pos_x: field.pos_x,
          pos_y: field.pos_y,
          width: field.width,
          height: field.height,
          font_size: field.font_size,
          field_type: field.field_type,
          is_required: field.is_required,
          default_value: field.default_value,
          data_source: field.data_source,
          options_json: field.options_json,
          sort_order: index + 1,
          show_in_input_panel: true,
          is_readonly: field.is_readonly,
          is_multiline: field.field_type === "textarea",
          text_align: field.text_align,
        }));

        const { error: insertError } = await supabase
          .from("pdf_template_fields")
          .insert(payload);

        if (insertError) throw new Error(insertError.message);
      }

      setSuccessText("Şablon kaydedildi.");
      router.push(`/dashboard/form-templates/${templateId}`);
      router.refresh();
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : "Bilinmeyen hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  const currentDraft = draftRect ? getRectFromDraft(draftRect) : null;
  const isLayoutMode = editorMode === "layout";

  return (
    <div className={`grid gap-6 ${isLayoutMode ? "grid-cols-1" : "xl:grid-cols-[360px_minmax(0,1fr)]"}`}>
      <div className="space-y-6">
        {!isLayoutMode ? (
          <div className="rounded-xl border bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold">Şablon Bilgileri</h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Şablon Kodu</label>
                <input
                  type="text"
                  value={templateCode}
                  onChange={(e) => setTemplateCode(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="İsteğe bağlı"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Şablon Adı</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="Örnek: Standart Servis Formu"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">PDF Dosyası</label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                  className="w-full rounded-lg border px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-black file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
                />
              </div>
            </div>
          </div>
        ) : null}

        {!isLayoutMode && selectedField ? (
          <div className="rounded-xl border bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Seçili Alan</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={duplicateSelectedField}
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  Kopyala
                </button>
                <button
                type="button"
                onClick={removeSelectedField}
                className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600"
              >
                Sil
              </button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Alan Adı</label>
                <input
                  type="text"
                  value={selectedField.field_label}
                  onChange={(e) => updateSelectedField("field_label", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Alan Türü</label>
                <div ref={fieldTypeMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setFieldTypeMenuOpen((open) => !open);
                    }}
                    className="flex w-full items-center justify-between rounded-lg border bg-white px-3 py-2 text-left text-sm"
                    aria-haspopup="listbox"
                    aria-expanded={fieldTypeMenuOpen}
                  >
                    <span>{fieldTypeLabel(selectedField.field_type)}</span>
                    <span className="text-xs text-slate-500">v</span>
                  </button>

                  {fieldTypeMenuOpen ? (
                    <div
                      role="listbox"
                      className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
                      onWheel={(event) => event.stopPropagation()}
                    >
                      {FIELD_TYPE_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          role="option"
                          aria-selected={selectedField.field_type === option.value}
                          onClick={(event) => {
                            event.stopPropagation();
                            updateSelectedFieldType(option.value);
                          }}
                          className={`block w-full px-3 py-2 text-left text-sm transition hover:bg-slate-100 ${
                            selectedField.field_type === option.value ? "bg-slate-100 font-medium text-slate-950" : "text-slate-700"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              {selectedField.field_type === "select" ? (
                <div className="grid gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Veri Kaynağı</label>
                    <select
                      value={asSelectDataSource(selectedField.data_source)}
                      onChange={(e) => updateSelectedDataSource(e.target.value as SelectDataSource)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    >
                      {SELECT_DATA_SOURCE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={isMultiSelectField(selectedField)}
                      onChange={(e) => updateSelectedMultiSelect(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Çoklu seçim
                  </label>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Seçim Listesi</label>
                    <textarea
                      value={getVisibleSelectOptions(selectedField.options_json).join(", ")}
                      onChange={(e) => updateSelectedOptions(e.target.value)}
                      readOnly={Boolean(asSelectDataSource(selectedField.data_source))}
                      className="min-h-24 w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-60 read-only:bg-slate-50"
                      placeholder="Örnek: Evet, Hayır"
                    />
                    <div className="mt-1 text-xs text-slate-500">
                      {getVisibleSelectOptions(selectedField.options_json).length} seçenek · A-Z sıralı
                    </div>
                  </div>
                </div>
              ) : null}

              {selectedFieldUsesText ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium">Yatay Hizalama</label>
                      <select
                        value={selectedField.text_align}
                        onChange={(e) => updateSelectedField("text_align", e.target.value as "left" | "center" | "right")}
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                      >
                        <option value="left">Sola Yasla</option>
                        <option value="center">Ortala</option>
                        <option value="right">Sağa Yasla</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">Dikey Hizalama</label>
                      <select
                        value={selectedField.vertical_align}
                        onChange={(e) => updateSelectedField("vertical_align", e.target.value as "top" | "middle" | "bottom")}
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                      >
                        <option value="top">Üste Yasla</option>
                        <option value="middle">Ortala</option>
                        <option value="bottom">Alta Yasla</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium">Yazı Tipi</label>
                      <select
                        value={selectedField.font_family}
                        onChange={(e) => updateSelectedField("font_family", e.target.value as FontFamily)}
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                      >
                        {FONT_OPTIONS.map((font) => (
                          <option key={font.value} value={font.value}>
                            {font.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">Yazı Boyutu</label>
                      <input
                        type="number"
                        min="6"
                        max="72"
                        value={selectedField.font_size}
                        onChange={(e) => updateSelectedField("font_size", Number(e.target.value))}
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedField.is_required}
                    onChange={(e) => updateSelectedField("is_required", e.target.checked)}
                  />
                  Zorunlu
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedField.is_readonly}
                    onChange={(e) => updateSelectedField("is_readonly", e.target.checked)}
                  />
                  Salt okunur
                </label>

              </div>
            </div>
          </div>
        ) : null}

        <div className="rounded-xl border bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Alanlar</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">
                {isLayoutMode ? `${fields.length} alan · ${fieldRows.length} satır` : `${fields.length} adet`}
              </span>
              {fieldPageCount > 1 ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFieldPage((page) => Math.max(0, page - 1))}
                    disabled={fieldPage === 0}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Önceki alanlar"
                  >
                    {"<"}
                  </button>
                  <span className="min-w-12 text-center text-xs font-medium text-slate-500">
                    {fieldPage + 1}/{fieldPageCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFieldPage((page) => Math.min(fieldPageCount - 1, page + 1))}
                    disabled={fieldPage >= fieldPageCount - 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Sonraki alanlar"
                  >
                    {">"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            {fields.length === 0 ? (
              <p className="text-sm text-gray-500">PDF üzerinde basılı tutup sürükleyin.</p>
            ) : isLayoutMode ? (
              visibleRows.map((row, index) => (
                <div
                  key={row.key}
                  className={`rounded-lg border px-3 py-2 text-left text-sm ${
                    row.fields.some((field) => field.id === selectedFieldId) ? "border-black bg-gray-50" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                    <div
                      className="grid min-w-0 flex-1 gap-2"
                      style={{
                        gridTemplateColumns: `repeat(auto-fit, minmax(${row.fields.length > 1 ? 160 : 0}px, 1fr))`,
                      }}
                    >
                      {row.fields.map((field) => (
                        <button
                          key={field.id}
                          type="button"
                          onClick={() => setSelectedFieldId(field.id)}
                          className={`min-w-0 overflow-hidden rounded-md border px-2 py-2 text-left transition ${
                            selectedFieldId === field.id ? "border-slate-900 bg-white shadow-sm" : "border-transparent bg-transparent hover:bg-white"
                          }`}
                        >
                          <div className="break-words text-sm font-medium leading-snug">
                            {row.startIndex + row.fields.findIndex((item) => item.id === field.id) + 1}. {field.field_label}
                          </div>
                          <div className="mt-1 break-words text-xs leading-snug text-gray-500">
                            Sayfa {field.page_number} · {fieldTypeLabel(field.field_type)}
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="flex shrink-0 items-center justify-end gap-1 self-start md:justify-start">
                      <button
                        type="button"
                        onClick={() => mergeFieldWithNeighbor("up", row.fields[0]?.id)}
                        disabled={fieldPage * fieldPageSize + index === 0}
                        className="flex h-8 w-8 items-center justify-center rounded-md border text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Üstteki alanla birleştir"
                        title="Üsttekiyle birleştir"
                      >
                        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2.5" y="3" width="4" height="4" rx="1" />
                          <rect x="9.5" y="3" width="4" height="4" rx="1" />
                          <path d="M8 13V8.5" />
                          <path d="M6.5 10 8 8.5 9.5 10" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => mergeFieldWithNeighbor("down", row.fields[0]?.id)}
                        disabled={fieldPage * fieldPageSize + index === fieldRows.length - 1}
                        className="flex h-8 w-8 items-center justify-center rounded-md border text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Alttaki alanla birleştir"
                        title="Alttakiyle birleştir"
                      >
                        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2.5" y="9" width="4" height="4" rx="1" />
                          <rect x="9.5" y="9" width="4" height="4" rx="1" />
                          <path d="M8 3v4.5" />
                          <path d="M6.5 6 8 7.5 9.5 6" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => clearFieldMerge(row.fields[0]?.id)}
                        disabled={!row.fields.some((field) => field.form_row_id)}
                        className="flex h-8 w-8 items-center justify-center rounded-md border text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Birleşimi kaldır"
                        title="Birleşimi kaldır"
                      >
                        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2.5" y="5" width="4" height="6" rx="1" />
                          <rect x="9.5" y="5" width="4" height="6" rx="1" />
                          <path d="M7 8h2" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => moveField(row.fields[0]?.id, "up")}
                        disabled={fieldPage * fieldPageSize + index === 0}
                        className="flex h-8 w-8 items-center justify-center rounded-md border text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Alanı yukarı taşı"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveField(row.fields[0]?.id, "down")}
                        disabled={fieldPage * fieldPageSize + index === fieldRows.length - 1}
                        className="flex h-8 w-8 items-center justify-center rounded-md border text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Alanı aşağı taşı"
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              visibleFields.map((field, index) => (
                <button
                  key={field.id}
                  type="button"
                  onClick={() => setSelectedFieldId(field.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                    selectedFieldId === field.id ? "border-black bg-gray-50" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="font-medium">
                    {fieldPage * fieldPageSize + index + 1}. {field.field_label}
                  </div>
                  <div className="text-xs text-gray-500">
                    Sayfa {field.page_number} · {fieldTypeLabel(field.field_type)}
                  </div>
                </button>
              ))
            )}
          </div>

          {fieldPageCount > 1 ? (
            <p className="mt-3 text-xs text-gray-500">
              {isLayoutMode
                ? `${fieldPage * fieldPageSize + 1}-${Math.min(fieldRows.length, (fieldPage + 1) * fieldPageSize)} arası satır gösteriliyor.`
                : `${fieldPage * fieldPageSize + 1}-${Math.min(fields.length, (fieldPage + 1) * fieldPageSize)} arası gösteriliyor.`}
            </p>
          ) : null}
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

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-xl bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Kaydediliyor..." : mode === "create" ? "Şablonu Kaydet" : "Şablonu Güncelle"}
        </button>
      </div>

      {!isLayoutMode ? (
        <div className="rounded-xl border bg-white p-5">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">PDF Önizleme</h2>
              <p className="text-sm text-gray-500">Basılı tutup sürükleyerek alan oluştur.</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(50, z - 10))}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                -
              </button>
              <div className="min-w-[70px] text-center text-sm font-medium">{zoom}%</div>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(200, z + 10))}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                +
              </button>
            </div>
          </div>

          {!pdfUrl ? (
            <div className="flex min-h-[500px] items-center justify-center rounded-xl border border-dashed text-sm text-gray-500">
              Önizleme için PDF yükleyin
            </div>
          ) : (
            <div className="max-w-full space-y-6 overflow-x-auto overflow-y-visible pb-3">
              <Document
                file={pdfUrl}
                onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                loading={<div className="py-10 text-center text-sm text-gray-500">PDF yükleniyor...</div>}
              >
                {Array.from({ length: numPages || 0 }).map((_, index) => {
                  const pageNumber = index + 1;
                  const pageFields = fields.filter((field) => field.page_number === pageNumber);
                  const pageDraft =
                    currentDraft && draftRect?.pageNumber === pageNumber ? currentDraft : null;

                  return (
                    <div
                      key={pageNumber}
                      className="rounded-xl border bg-gray-50 p-3"
                      style={{ minWidth: `${pageWidth + 24}px` }}
                    >
                      <div className="mb-3 text-sm font-medium">Sayfa {pageNumber}</div>

                      <div className="relative inline-block overflow-hidden rounded-lg border bg-white">
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
                          onMouseDown={(e) => handleOverlayMouseDown(pageNumber, e)}
                          onMouseMove={(e) => handleOverlayMouseMove(pageNumber, e)}
                          onMouseUp={(e) => handleOverlayMouseUp(pageNumber, e)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setContextMenu({
                              x: e.clientX,
                              y: e.clientY,
                              fieldId: null,
                              pageNumber,
                            });
                          }}
                        >
                          {pageFields.map((field) => (
                            <div
                              key={field.id}
                              data-stop-create="true"
                              onMouseDown={(e) => startDragField(e, field)}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSelectedFieldId(field.id);
                                setContextMenu({
                                  x: e.clientX,
                                  y: e.clientY,
                                  fieldId: field.id,
                                  pageNumber: field.page_number,
                                });
                              }}
                              className={`absolute overflow-visible rounded border px-2 py-1 text-[11px] font-medium ${
                                selectedFieldId === field.id
                                  ? "border-red-500 bg-red-100 text-red-700"
                                  : "border-blue-500 bg-blue-100 text-blue-700"
                              }`}
                              style={{
                                left: `${field.pos_x}%`,
                                top: `${field.pos_y}%`,
                                width: `${field.width}%`,
                                height: `${field.height}%`,
                                boxSizing: "border-box",
                                display: "flex",
                                alignItems:
                                  field.field_type === "checkbox"
                                    ? "center"
                                    : field.vertical_align === "top"
                                      ? "flex-start"
                                      : field.vertical_align === "bottom"
                                        ? "flex-end"
                                        : "center",
                                justifyContent:
                                  field.field_type === "checkbox"
                                    ? "center"
                                    : field.text_align === "left"
                                      ? "flex-start"
                                      : field.text_align === "right"
                                        ? "flex-end"
                                        : "center",
                                fontSize: `${field.font_size}px`,
                                fontFamily: getPreviewFontFamily(field.font_family),
                                lineHeight: 1.1,
                                cursor: "move",
                              }}
                              title={`${field.field_label} - ${fieldTypeLabel(field.field_type)}`}
                            >
                              <div className="pointer-events-none w-full overflow-hidden break-words">
                                {getPreviewText(field)}
                              </div>

                              {selectedFieldId === field.id ? (
                                <>
                                  {(["n", "s", "e", "w", "ne", "nw", "se", "sw"] as ResizeDirection[]).map((dir) => (
                                    <button
                                      key={dir}
                                      type="button"
                                      data-stop-create="true"
                                      onMouseDown={(e) => startResize(e, field, dir)}
                                      className={getHandleClass(dir)}
                                    />
                                  ))}
                                </>
                              ) : null}
                            </div>
                          ))}

                          {pageDraft ? (
                            <div
                              className="pointer-events-none absolute border-2 border-dashed border-black bg-black/10"
                              style={{
                                left: `${pageDraft.left}%`,
                                top: `${pageDraft.top}%`,
                                width: `${pageDraft.width}%`,
                                height: `${pageDraft.height}%`,
                              }}
                            />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </Document>

              {pendingRect ? (
                <div
                  className="context-menu-layer fixed w-56 overflow-hidden rounded-xl border bg-white p-3 shadow-xl"
                  style={getPendingFieldTypeMenuStyle(pendingRect)}
                  onWheel={(event) => event.stopPropagation()}
                >
                  <div className="mb-2 text-sm font-medium">Alan Türü Seç</div>
                  <div className="grid max-h-72 gap-2 overflow-y-auto pr-1">
                    {FIELD_TYPE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => createField(option.value)}
                        className="rounded-lg border px-3 py-2 text-left text-sm hover:bg-gray-50"
                      >
                        {option.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPendingRect(null)}
                      className="rounded-lg border border-red-200 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                    >
                      İptal
                    </button>
                  </div>
                </div>
              ) : null}

              {contextMenu ? (
                <div
                  className="context-menu-layer fixed rounded-xl border bg-white p-2 shadow-xl"
                  style={{ left: contextMenu.x + 8, top: contextMenu.y + 8 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="grid min-w-[140px] gap-1">
                    {contextMenu.fieldId ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            const field = fields.find((x) => x.id === contextMenu.fieldId);
                            if (field) copyField(field);
                            setContextMenu(null);
                          }}
                          className="rounded-lg border px-3 py-2 text-left text-sm hover:bg-gray-50"
                        >
                          Kopyala
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            pasteField(contextMenu.pageNumber);
                            setContextMenu(null);
                          }}
                          disabled={!copiedField}
                          className="rounded-lg border px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50"
                        >
                          Yapıştır
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            deleteFieldById(contextMenu.fieldId!);
                            setContextMenu(null);
                          }}
                          className="rounded-lg border border-red-200 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                        >
                          Sil
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          pasteField(contextMenu.pageNumber);
                          setContextMenu(null);
                        }}
                        disabled={!copiedField}
                        className="rounded-lg border px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50"
                      >
                        Yapıştır
                      </button>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}











