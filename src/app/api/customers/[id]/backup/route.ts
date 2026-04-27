import { NextResponse } from "next/server";
import { writeActivityLogSafe } from "@/lib/activity-log";
import { getServerIdentity } from "@/lib/authz";
import { localizeErrorMessage } from "@/lib/error-messages";
import { uploadJsonBackupToGoogleDrive } from "@/lib/google-drive";
import { isMasterUser, PERMISSIONS } from "@/lib/permissions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type BackupRequestBody = {
  companyId?: string;
};

function slugify(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(_request: Request, context: RouteContext) {
  const auth = await getServerIdentity(PERMISSIONS.customers);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!isMasterUser(auth.identity)) {
    return NextResponse.json({ error: "Bu yedekleme işlemi yalnızca master kullanıcı için açıktır." }, { status: 403 });
  }

  const { id } = await context.params;
  const body = ((await _request.json().catch(() => ({}))) ?? {}) as BackupRequestBody;
  const requestedCompanyId = String(body.companyId ?? "").trim();
  const targetCompanyId =
    isMasterUser(auth.identity) && requestedCompanyId ? requestedCompanyId : auth.identity.companyId;

  try {
    const customerResult = await auth.admin
      .from("customers")
      .select("*")
      .eq("company_id", targetCompanyId)
      .eq("id", id)
      .single();

    if (customerResult.error || !customerResult.data) {
      return NextResponse.json(
        { error: localizeErrorMessage(customerResult.error?.message, "Müşteri bulunamadı.") },
        { status: 404 }
      );
    }

    const customer = customerResult.data;
    const machinesResult = await auth.admin
      .from("machines")
      .select("*")
      .eq("company_id", targetCompanyId)
      .eq("customer_id", id);

    if (machinesResult.error) {
      return NextResponse.json(
        { error: localizeErrorMessage(machinesResult.error.message, "Makine kayıtları alınamadı.") },
        { status: 500 }
      );
    }

    const machineIds = (machinesResult.data ?? []).map((machine) => String(machine.id));

    const [ticketsResult, serviceFormsResult, offersResult, maintenanceResult] = await Promise.all([
      auth.admin.from("tickets").select("*").eq("company_id", targetCompanyId).eq("customer_id", id),
      auth.admin.from("service_forms").select("*").eq("company_id", targetCompanyId).eq("customer_id", id),
      auth.admin.from("offers").select("*").eq("company_id", targetCompanyId).eq("customer_id", id),
      machineIds.length > 0
        ? auth.admin.from("machine_maintenance_records").select("*").eq("company_id", targetCompanyId).in("machine_id", machineIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (ticketsResult.error) {
      return NextResponse.json(
        { error: localizeErrorMessage(ticketsResult.error.message, "Ticket kayıtları alınamadı.") },
        { status: 500 }
      );
    }
    if (serviceFormsResult.error) {
      return NextResponse.json(
        { error: localizeErrorMessage(serviceFormsResult.error.message, "Servis formu kayıtları alınamadı.") },
        { status: 500 }
      );
    }
    if (offersResult.error) {
      return NextResponse.json(
        { error: localizeErrorMessage(offersResult.error.message, "Teklif kayıtları alınamadı.") },
        { status: 500 }
      );
    }
    if (maintenanceResult.error) {
      return NextResponse.json(
        { error: localizeErrorMessage(maintenanceResult.error.message, "Bakım kayıtları alınamadı.") },
        { status: 500 }
      );
    }

    const ticketIds = (ticketsResult.data ?? []).map((ticket) => String(ticket.id));
    const serviceFormIds = (serviceFormsResult.data ?? []).map((form) => String(form.id));
    const offerIds = (offersResult.data ?? []).map((offer) => String(offer.id));

    const [ticketHistoryResult, ticketCommentsResult, serviceFormValuesResult, offerItemsResult] = await Promise.all([
      ticketIds.length > 0
        ? auth.admin.from("ticket_status_history").select("*").eq("company_id", targetCompanyId).in("ticket_id", ticketIds)
        : Promise.resolve({ data: [], error: null }),
      ticketIds.length > 0
        ? auth.admin.from("ticket_comments").select("*").eq("company_id", targetCompanyId).in("ticket_id", ticketIds)
        : Promise.resolve({ data: [], error: null }),
      serviceFormIds.length > 0
        ? auth.admin.from("service_form_field_values").select("*").in("service_form_id", serviceFormIds)
        : Promise.resolve({ data: [], error: null }),
      offerIds.length > 0
        ? auth.admin.from("offer_items").select("*").in("offer_id", offerIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    for (const result of [ticketHistoryResult, ticketCommentsResult, serviceFormValuesResult, offerItemsResult]) {
      if (result.error) {
        return NextResponse.json(
          { error: localizeErrorMessage(result.error.message, "İlişkili kayıtlar alınamadı.") },
          { status: 500 }
        );
      }
    }

    const backupPayload = {
      version: 1,
      backup_type: "customer_full_backup",
      exported_at: new Date().toISOString(),
      company_id: targetCompanyId,
      customer_id: id,
      exported_by_app_user_id: auth.identity.appUserId,
      customer,
      machines: machinesResult.data ?? [],
      machine_maintenance_records: maintenanceResult.data ?? [],
      tickets: ticketsResult.data ?? [],
      ticket_status_history: ticketHistoryResult.data ?? [],
      ticket_comments: ticketCommentsResult.data ?? [],
      service_forms: serviceFormsResult.data ?? [],
      service_form_field_values: serviceFormValuesResult.data ?? [],
      offers: offersResult.data ?? [],
      offer_items: offerItemsResult.data ?? [],
    };

    const customerName = String(customer.company_name ?? "musteri");
    const backupFileName = `${new Date().toISOString().slice(0, 10)}-${slugify(customerName) || "musteri"}-${id}.noxo-customer-backup.json`;
    const upload = await uploadJsonBackupToGoogleDrive(backupFileName, backupPayload);

    await writeActivityLogSafe(auth.admin, {
      companyId: targetCompanyId,
      userId: auth.identity.appUserId,
      moduleName: "customers",
      actionName: "customer_backup_uploaded",
      recordType: "customer_backup",
      recordId: id,
      detail: {
        customerName,
        fileName: backupFileName,
        driveFileId: upload.id,
      },
    });

    return NextResponse.json({ success: true, fileId: upload.id, webViewLink: upload.webViewLink ?? null });
  } catch (error) {
    return NextResponse.json(
      { error: localizeErrorMessage(error instanceof Error ? error.message : null, "Müşteri yedeği oluşturulamadı.") },
      { status: 500 }
    );
  }
}
