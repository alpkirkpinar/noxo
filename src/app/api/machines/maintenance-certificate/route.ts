import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { getMachineMaintenancePdfData } from "@/lib/machine-maintenance-pdf-data";
import { MachineMaintenanceCertificatePdf, makePdfFileName } from "@/lib/pdf/machine-maintenance-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ids = (searchParams.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return NextResponse.json({ error: "Sertifika için makine seçilmedi." }, { status: 400 });
  }

  const items = await Promise.all(ids.map((id) => getMachineMaintenancePdfData(id)));

  const firstError = items.find((item) => "error" in item);
  if (firstError && "error" in firstError) {
    return NextResponse.json({ error: firstError.error }, { status: firstError.status });
  }

  const entries = items
    .filter((item): item is Exclude<(typeof items)[number], { error: string; status: number }> => !("error" in item))
    .map((item) => ({
      machine: item.machine,
      customer: item.customer,
      settings: item.settings,
      latestRecord: item.records[0] ?? null,
    }));

  try {
    const pdfBuffer = await renderToBuffer(
      createElement(MachineMaintenanceCertificatePdf as never, {
        entries,
      }) as never
    );

    const companyName = entries[0]?.settings?.company_name?.trim() || "firma";

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${makePdfFileName(companyName)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF oluşturulamadı.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
