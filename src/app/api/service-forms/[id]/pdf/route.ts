import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { NextResponse } from "next/server";
import { getServerIdentity } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
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
  font_size: number | null;
  field_type: string;
  data_source: string | null;
  options_json: string[] | null;
  text_align: "left" | "center" | "right" | null;
};

type ServiceForm = {
  id: string;
  form_no: string | null;
  template_id: string;
  customer_id: string | null;
  machine_id: string | null;
  ticket_id: string | null;
  service_date: string | null;
};

type Template = {
  id: string;
  template_name: string;
  file_path: string | null;
};

type Customer = {
  company_name: string | null;
};

type Machine = {
  machine_name: string | null;
  machine_code: string | null;
};

type Ticket = {
  ticket_no: string | null;
  title: string | null;
};

const STORAGE_BUCKET = "template-pdfs";
const PDF_FONT_PATH = path.join(process.cwd(), "public", "fonts", "arial.ttf");
const MULTI_SELECT_OPTION_MARKER = "__noxo_multi_select__";

function sanitizePdfText(value: string) {
  return value
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ş/g, "S")
    .replace(/İ/g, "I")
    .replace(/İ/g, "I")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

function isMultiSelectField(field: Pick<TemplateField, "field_type" | "options_json">) {
  return field.field_type === "select" && (field.options_json ?? []).includes(MULTI_SELECT_OPTION_MARKER);
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

function formatPdfText(field: TemplateField, rawValue: string) {
  if (field.field_type === "checkbox") {
    return rawValue === "true" ? "X" : "";
  }

  if (field.field_type === "select" && isMultiSelectField(field)) {
    return parseMultiSelectValue(rawValue).join(", ");
  }

  if (field.field_type === "date" && rawValue) {
    const date = new Date(rawValue);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("tr-TR");
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

function getAutoValue(
  field: TemplateField,
  form: ServiceForm,
  customer: Customer | null,
  machine: Machine | null,
  ticket: Ticket | null
) {
  if (field.field_type === "serial_number") {
    return form.form_no ?? "";
  }

  switch (field.data_source) {
    case "customer.company_name":
      return customer?.company_name ?? "";
    case "machine.machine_name":
      return machine?.machine_name ?? "";
    case "machine.machine_code":
      return machine?.machine_code ?? "";
    case "ticket.ticket_no":
      return ticket?.ticket_no ?? "";
    case "ticket.title":
      return ticket?.title ?? "";
    case "service.service_date":
      return form.service_date ? String(form.service_date).slice(0, 10) : "";
    case "today.date":
      return new Date().toISOString().slice(0, 10);
    default:
      return "";
  }
}

function safeFileName(value: string) {
  const normalized = sanitizePdfText(value)
    .trim()
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || "servis_formu";
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

async function maybeSingle<T>(
  query: PromiseLike<{ data: T | null; error: { message: string } | null }>
) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await getServerIdentity(PERMISSIONS.serviceFormPdf);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { id } = await context.params;

    const { data: form, error: formError } = await auth.supabase
      .from("service_forms")
      .select("id, form_no, template_id, customer_id, machine_id, ticket_id, service_date")
      .eq("id", id)
      .eq("company_id", auth.identity.companyId)
      .single();

    if (formError || !form) {
      return NextResponse.json({ error: formError?.message ?? "Servis formu bulunamadi." }, { status: 404 });
    }

    const serviceForm = form as ServiceForm;

    const [{ data: template, error: templateError }, { data: fields, error: fieldsError }, { data: values, error: valuesError }] =
      await Promise.all([
        auth.supabase
          .from("pdf_templates")
          .select("id, template_name, file_path")
          .eq("id", serviceForm.template_id)
          .eq("company_id", auth.identity.companyId)
          .single(),
        auth.supabase
          .from("pdf_template_fields")
          .select("id, field_key, field_label, page_number, pos_x, pos_y, width, height, font_size, field_type, data_source, options_json, text_align")
          .eq("template_id", serviceForm.template_id)
          .order("sort_order", { ascending: true }),
        auth.supabase
          .from("service_form_field_values")
          .select("template_field_id, value_text")
          .eq("service_form_id", serviceForm.id),
      ]);

    if (templateError || !template) {
      return NextResponse.json({ error: templateError?.message ?? "PDF sablonu bulunamadi." }, { status: 404 });
    }

    if (fieldsError) {
      return NextResponse.json({ error: fieldsError.message }, { status: 500 });
    }

    if (valuesError) {
      return NextResponse.json({ error: valuesError.message }, { status: 500 });
    }

    const pdfTemplate = template as Template;
    if (!pdfTemplate.file_path) {
      return NextResponse.json({ error: "PDF dosyasi bulunamadi." }, { status: 404 });
    }

    const [customer, machine, ticket] = await Promise.all([
      serviceForm.customer_id
        ? maybeSingle<Customer>(
            auth.supabase
              .from("customers")
              .select("company_name")
              .eq("id", serviceForm.customer_id)
              .eq("company_id", auth.identity.companyId)
              .maybeSingle()
          )
        : Promise.resolve(null),
      serviceForm.machine_id
        ? maybeSingle<Machine>(
            auth.supabase
              .from("machines")
              .select("machine_name, machine_code")
              .eq("id", serviceForm.machine_id)
              .eq("company_id", auth.identity.companyId)
              .maybeSingle()
          )
        : Promise.resolve(null),
      serviceForm.ticket_id
        ? maybeSingle<Ticket>(
            auth.supabase
              .from("tickets")
              .select("ticket_no, title")
              .eq("id", serviceForm.ticket_id)
              .eq("company_id", auth.identity.companyId)
              .maybeSingle()
          )
        : Promise.resolve(null),
    ]);

    const { data: pdfBlob, error: pdfDownloadError } = await auth.supabase.storage
      .from(STORAGE_BUCKET)
      .download(pdfTemplate.file_path);

    if (pdfDownloadError || !pdfBlob) {
      return NextResponse.json({ error: pdfDownloadError?.message ?? "PDF indirilemedi." }, { status: 500 });
    }

    const pdfDoc = await PDFDocument.load(await pdfBlob.arrayBuffer());
    pdfDoc.registerFontkit(fontkit);
    const font = await pdfDoc.embedFont(await readFile(PDF_FONT_PATH), { subset: true });
    const valueMap = new Map(
      ((values ?? []) as Array<{ template_field_id: string; value_text: string | null }>).map((item) => [
        item.template_field_id,
        item.value_text ?? "",
      ])
    );

    for (const field of (fields ?? []) as TemplateField[]) {
      if (field.page_number < 1 || field.page_number > pdfDoc.getPageCount()) continue;

      const page = pdfDoc.getPage(field.page_number - 1);

      const pageSize = page.getSize();
      const x = (field.pos_x / 100) * pageSize.width;
      const yTop = pageSize.height - (field.pos_y / 100) * pageSize.height;
      const boxWidth = (field.width / 100) * pageSize.width;
      const boxHeight = (field.height / 100) * pageSize.height;
      const y = yTop - boxHeight;
      const rawValue = valueMap.get(field.id) || getAutoValue(field, serviceForm, customer, machine, ticket);

      if (field.field_type === "signature" && rawValue.startsWith("data:image")) {
        const base64 = rawValue.includes(",") ? rawValue.split(",")[1] : rawValue;
        const pngImage = await pdfDoc.embedPng(Buffer.from(base64, "base64"));
        page.drawImage(pngImage, { x, y, width: boxWidth, height: boxHeight });
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
      const textAlign = field.text_align ?? "left";

      let drawX = x + 3;
      if (textAlign === "center") {
        drawX = x + Math.max(3, (boxWidth - textWidth) / 2);
      } else if (textAlign === "right") {
        drawX = x + Math.max(3, boxWidth - textWidth - 3);
      }

      page.drawText(textValue, {
        x: drawX,
        y: y + Math.max(2, boxHeight / 2 - fontSize / 2),
        size: fontSize,
        font,
        maxWidth: Math.max(20, boxWidth - 6),
      });
    }

    const finalBytes = await pdfDoc.save();
    const fileName = `${safeFileName(serviceForm.form_no || pdfTemplate.template_name)}_${new Date()
      .toISOString()
      .slice(0, 10)}.pdf`;

    return new Response(Buffer.from(finalBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Download-Options": "noopen",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PDF olusturulamadi." },
      { status: 500 }
    );
  }
}
