import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { getMachineMaintenancePdfData } from "@/lib/machine-maintenance-pdf-data";
import { MachineMaintenanceCertificatePdf, makePdfFileName } from "@/lib/pdf/machine-maintenance-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const data = await getMachineMaintenancePdfData(id);

  if ("error" in data) {
    return NextResponse.json({ error: data.error }, { status: data.status });
  }

  try {
    const pdfBuffer = await renderToBuffer(
      createElement(MachineMaintenanceCertificatePdf as never, {
        entries: [
          {
            machine: data.machine,
            customer: data.customer,
            settings: data.settings,
            latestRecord: data.records[0] ?? null,
          },
        ],
      }) as never
    );

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${makePdfFileName(data.settings?.company_name?.trim() || "firma")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF olusturulamadi.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
