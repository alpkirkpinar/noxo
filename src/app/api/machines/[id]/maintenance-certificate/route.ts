import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { writeActivityLogSafe } from "@/lib/activity-log";
import { getServerIdentity } from "@/lib/authz";
import { getMachineMaintenancePdfData } from "@/lib/machine-maintenance-pdf-data";
import { MachineMaintenanceCertificatePdf, makePdfFileName } from "@/lib/pdf/machine-maintenance-pdf";
import { PERMISSIONS } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getServerIdentity(PERMISSIONS.machines);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

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

    await writeActivityLogSafe(auth.admin, {
      companyId: auth.identity.companyId,
      userId: auth.identity.appUserId,
      moduleName: "machines",
      actionName: "maintenance_certificate_downloaded",
      recordType: "machine_certificate",
      recordId: id,
      detail: {
        machineIds: [id],
        machineCount: 1,
        machineName: data.machine.machine_name ?? null,
      },
    });

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
