import React from "react";
import path from "node:path";
import { existsSync } from "node:fs";
import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export type MachinePdfCustomer = {
  company_name?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
};

export type MachinePdfMachine = {
  id: string;
  machine_code?: string | null;
  machine_name?: string | null;
  brand?: string | null;
  model?: string | null;
  serial_number?: string | null;
  installation_date?: string | null;
  maintenance_period_days?: number | null;
  last_maintenance_date?: string | null;
  next_maintenance_date?: string | null;
  location_text?: string | null;
  notes?: string | null;
};

export type MachineMaintenanceRecord = {
  id: string;
  performed_at: string | null;
  next_maintenance_date?: string | null;
  maintenance_notes?: string | null;
  maintenance_scope_items?: string[];
  performed_by_name?: string | null;
  performed_by_title?: string | null;
};

type CompanySettings = {
  company_name?: string | null;
  logo_url?: string | null;
  maintenance_approver_name?: string | null;
  maintenance_approver_title?: string | null;
};

export type CertificateEntry = {
  machine: MachinePdfMachine;
  customer: MachinePdfCustomer | null;
  settings?: CompanySettings | null;
  latestRecord: MachineMaintenanceRecord | null;
};

const LOCAL_ARIAL = path.join(process.cwd(), "public", "fonts", "arial.ttf");
const LOCAL_ARIAL_BOLD = path.join(process.cwd(), "public", "fonts", "arialbd.ttf");
const LOCAL_LOGO = path.join(process.cwd(), "public", "noxo-logo.png");
const MAX_ENTRIES_PER_CERTIFICATE = 5;

if (existsSync(LOCAL_ARIAL) && existsSync(LOCAL_ARIAL_BOLD)) {
  Font.register({
    family: "MachinePdfSans",
    fonts: [
      { src: LOCAL_ARIAL, fontWeight: 400 },
      { src: LOCAL_ARIAL_BOLD, fontWeight: 700 },
    ],
  });
}

Font.registerHyphenationCallback((word) => [word]);

const colors = {
  navy: "#1a4a7a",
  navyDark: "#0d2d52",
  navyMid: "#2060a0",
  line: "#3a7abd",
  ink: "#1a2e45",
  pale: "#f2f6fb",
  paleStrong: "#ddeaf8",
};

const styles = StyleSheet.create({
  page: {
    padding: 18,
    backgroundColor: colors.pale,
    fontFamily: "MachinePdfSans",
    color: colors.ink,
    fontSize: 9,
  },
  frameOuter: {
    flex: 1,
    borderWidth: 3,
    borderColor: colors.navy,
    padding: 8,
  },
  frameInner: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.line,
    paddingTop: 18,
    paddingRight: 28,
    paddingBottom: 18,
    paddingLeft: 28,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  topSpacer: {
    width: 92,
  },
  logoWrap: {
    flex: 1,
    alignItems: "center",
  },
  logo: {
    width: 280,
    height: 108,
    objectFit: "contain",
  },
  logoPlaceholder: {
    height: 108,
  },
  docDateWrap: {
    alignItems: "flex-end",
    minWidth: 92,
  },
  docDateLabel: {
    fontSize: 8,
    letterSpacing: 2,
    color: colors.navyMid,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  docDateValue: {
    fontSize: 10,
    fontWeight: 700,
    color: colors.navyDark,
  },
  divider: {
    height: 1,
    backgroundColor: colors.line,
    marginTop: 9,
    marginBottom: 9,
  },
  dividerShort: {
    width: 180,
    height: 1,
    backgroundColor: colors.line,
    marginTop: 8,
    marginBottom: 8,
    alignSelf: "center",
  },
  certMainTitle: {
    fontSize: 29,
    fontWeight: 700,
    color: colors.navyDark,
    textAlign: "center",
    lineHeight: 1.15,
    marginTop: 4,
  },
  certSubTitle: {
    fontSize: 10,
    color: colors.navyMid,
    textAlign: "center",
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  certificateIndex: {
    marginTop: 4,
    fontSize: 8,
    color: colors.navyMid,
    fontWeight: 700,
    textAlign: "center",
  },
  recipientBlock: {
    width: "100%",
    backgroundColor: colors.paleStrong,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderLeftWidth: 5,
    borderLeftColor: colors.navy,
    paddingTop: 12,
    paddingRight: 22,
    paddingBottom: 11,
    paddingLeft: 22,
    marginTop: 10,
    marginBottom: 10,
  },
  recipientEyebrow: {
    fontSize: 8,
    letterSpacing: 4,
    color: colors.navyMid,
    textTransform: "uppercase",
    textAlign: "center",
    marginBottom: 4,
  },
  recipientName: {
    fontSize: 23,
    fontWeight: 700,
    color: "#0a1e38",
    textAlign: "center",
    lineHeight: 1.1,
    marginBottom: 3,
  },
  recipientSub: {
    fontSize: 9,
    letterSpacing: 2,
    color: "#2a4a70",
    textTransform: "uppercase",
    textAlign: "center",
  },
  bodyText: {
    fontSize: 11,
    lineHeight: 1.7,
    textAlign: "center",
    maxWidth: 470,
    alignSelf: "center",
    marginTop: 4,
    marginBottom: 8,
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginTop: 8,
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 8,
    letterSpacing: 3,
    color: colors.navyMid,
    textTransform: "uppercase",
    paddingRight: 6,
  },
  sectionRule: {
    flex: 1,
    height: 0.5,
    backgroundColor: colors.line,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.navy,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#b0cce8",
  },
  tableRowAlt: {
    backgroundColor: "#e8f1fa",
  },
  th: {
    fontSize: 8,
    color: colors.paleStrong,
    fontWeight: 700,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  td: {
    fontSize: 8.5,
    color: colors.navyDark,
  },
  tdSerial: {
    fontSize: 8,
    paddingRight: 4,
  },
  tdNextDate: {
    fontWeight: 700,
  },
  colIndex: {
    width: 22,
    textAlign: "center",
  },
  colMachine: {
    width: 128,
  },
  colBrand: {
    width: 90,
  },
  colSerial: {
    width: 84,
  },
  colDate: {
    width: 68,
  },
  colNextDate: {
    width: 78,
  },
  rowNum: {
    fontSize: 10,
    fontWeight: 700,
    color: colors.line,
    textAlign: "center",
  },
  scopeSection: {
    marginTop: 4,
  },
  scopeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
    marginTop: 6,
    marginBottom: 4,
  },
  scopeBadge: {
    backgroundColor: colors.paleStrong,
    borderWidth: 1,
    borderColor: colors.line,
    fontSize: 8,
    color: colors.navy,
    letterSpacing: 1,
    paddingTop: 3,
    paddingRight: 9,
    paddingBottom: 3,
    paddingLeft: 9,
    textTransform: "uppercase",
    fontWeight: 700,
  },
  bottomBar: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    gap: 34,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  signatureField: {
    width: 155,
    alignItems: "center",
  },
  sigName: {
    fontSize: 13,
    fontWeight: 400,
    color: colors.navyDark,
    textAlign: "center",
  },
  sigLine: {
    width: 110,
    height: 1,
    backgroundColor: colors.navy,
    marginTop: 6,
    marginBottom: 4,
  },
  sigLabel: {
    fontSize: 7.5,
    letterSpacing: 2,
    color: colors.navyMid,
    textTransform: "uppercase",
    textAlign: "center",
  },
  contentSpacer: {
    flexGrow: 1,
    minHeight: 0,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: "#b0cce8",
  },
  infoField: {
    flex: 1,
    alignItems: "center",
  },
  infoValue: {
    fontSize: 9.5,
    color: colors.navyDark,
    fontWeight: 400,
    textAlign: "center",
  },
  infoLabel: {
    marginTop: 2,
    fontSize: 7,
    letterSpacing: 2,
    color: colors.navyMid,
    textTransform: "uppercase",
    textAlign: "center",
  },
  validityBar: {
    backgroundColor: colors.navy,
    color: colors.paleStrong,
    fontSize: 7.5,
    letterSpacing: 2,
    textTransform: "uppercase",
    textAlign: "center",
    paddingTop: 5,
    paddingBottom: 5,
    marginTop: 12,
  },
});

function formatDate(value?: string | null) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleDateString("tr-TR");
  } catch {
    return value;
  }
}

function display(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function getLogoSource(entries: CertificateEntry[]) {
  const remoteLogo = entries[0]?.settings?.logo_url?.trim();
  if (remoteLogo) return remoteLogo;
  if (existsSync(LOCAL_LOGO)) return LOCAL_LOGO;
  return null;
}

function getRecipient(entries: CertificateEntry[]) {
  const customers = Array.from(
    new Map(
      entries
        .filter((entry) => entry.customer?.company_name?.trim())
        .map((entry) => [
          entry.customer?.company_name?.trim(),
          {
            name: entry.customer?.company_name?.trim() || "",
            sub: [entry.customer?.address, entry.customer?.city, entry.customer?.country]
              .filter(Boolean)
              .join(" · "),
          },
        ])
    ).values()
  );

  if (customers.length === 1) return customers[0];

  return {
    name: "SEÇİLİ MÜŞTERİLER",
    sub: `${customers.length} farklı müşteri için düzenlenmiştir.`,
  };
}

function getDateRange(entries: CertificateEntry[]) {
  const dates = entries
    .map((entry) => entry.latestRecord?.performed_at ?? entry.machine.last_maintenance_date)
    .filter(Boolean)
    .map((value) => new Date(String(value)).getTime())
    .filter((value) => !Number.isNaN(value))
    .sort((a, b) => a - b);

  if (dates.length === 0) return "-";
  if (dates.length === 1) return formatDate(new Date(dates[0]).toISOString());

  return `${formatDate(new Date(dates[0]).toISOString())} - ${formatDate(new Date(dates[dates.length - 1]).toISOString())}`;
}

function getNextMaintenance(entries: CertificateEntry[]) {
  const dates = entries
    .map((entry) => entry.latestRecord?.next_maintenance_date ?? entry.machine.next_maintenance_date)
    .filter(Boolean)
    .map((value) => new Date(String(value)).getTime())
    .filter((value) => !Number.isNaN(value))
    .sort((a, b) => a - b);

  return dates.length > 0 ? formatDate(new Date(dates[0]).toISOString()) : "-";
}

function getPerformedBy(entries: CertificateEntry[]) {
  const names = Array.from(
    new Set(entries.map((entry) => entry.latestRecord?.performed_by_name?.trim()).filter(Boolean))
  );
  return names.length > 0 ? names.join(", ") : "-";
}

function getPerformedByTitle(entries: CertificateEntry[]) {
  const titles = Array.from(
    new Set(entries.map((entry) => entry.latestRecord?.performed_by_title?.trim()).filter(Boolean))
  );
  return titles.length > 0 ? titles.join(", ") : "Bakım Personeli";
}

function getApproverName(entries: CertificateEntry[]) {
  return entries[0]?.settings?.maintenance_approver_name?.trim() || "-";
}

function getApproverTitle(entries: CertificateEntry[]) {
  return entries[0]?.settings?.maintenance_approver_title?.trim() || "Firma Yetkilisi";
}

function makePdfFileName(companyName: string) {
  const normalized = companyName
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${normalized || "firma"}-bakim-sertifikasi.pdf`;
}

function machineBrandModel(entry: CertificateEntry) {
  return [entry.machine.brand, entry.machine.model].filter(Boolean).join(" / ") || "-";
}

function getScopeBadges(entries: CertificateEntry[]) {
  return Array.from(
    new Set(
      entries.flatMap((entry) =>
        Array.isArray(entry.latestRecord?.maintenance_scope_items)
          ? entry.latestRecord?.maintenance_scope_items.filter(Boolean)
          : []
      )
    )
  );
}

function chunkEntries(entries: CertificateEntry[]) {
  const chunks: CertificateEntry[][] = [];

  for (let index = 0; index < entries.length; index += MAX_ENTRIES_PER_CERTIFICATE) {
    chunks.push(entries.slice(index, index + MAX_ENTRIES_PER_CERTIFICATE));
  }

  return chunks;
}

function CertificatePage({
  entries,
  pageIndex,
  pageCount,
}: {
  entries: CertificateEntry[];
  pageIndex: number;
  pageCount: number;
}) {
  const recipient = getRecipient(entries);
  const scopeBadges = getScopeBadges(entries);
  const logoSource = getLogoSource(entries);

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.frameOuter}>
        <View style={styles.frameInner}>
          <View style={styles.topRow}>
            <View style={styles.topSpacer} />

            <View style={styles.logoWrap}>
              {logoSource ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image src={logoSource} style={styles.logo} />
              ) : (
                <View style={styles.logoPlaceholder} />
              )}
            </View>

            <View style={styles.docDateWrap}>
              <Text style={styles.docDateLabel}>Belge Tarihi</Text>
              <Text style={styles.docDateValue}>{formatDate(new Date().toISOString())}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.certMainTitle}>Makine Bakım{"\n"}Hizmet Sertifikası</Text>
          <Text style={styles.certSubTitle}>Periyodik Bakım Tamamlama Belgesi</Text>
          {pageCount > 1 ? (
            <Text style={styles.certificateIndex}>{`Sertifika ${pageIndex + 1} / ${pageCount}`}</Text>
          ) : null}

          <View style={styles.dividerShort} />

          <View style={styles.recipientBlock}>
            <Text style={styles.recipientEyebrow}>Bu Sertifika Aşağıdaki Firmaya Verilmiştir</Text>
            <Text style={styles.recipientName}>{recipient.name}</Text>
            <Text style={styles.recipientSub}>{recipient.sub || "-"}</Text>
          </View>

          <Text style={styles.bodyText}>
            Yukarıda belirtilen firmaya ait aşağıdaki ekipmanlara yetkili teknik ekibimiz tarafından periyodik bakım
            hizmeti uygulanmış; tüm işlemler planlı bakım esaslarına uygun biçimde eksiksiz tamamlanmıştır.
          </Text>

          <View style={styles.sectionLabelRow}>
            <Text style={styles.sectionLabel}>Bakım Uygulanan Makine ve Ekipmanlar</Text>
            <View style={styles.sectionRule} />
          </View>

          <View>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, styles.colIndex]}>#</Text>
              <Text style={[styles.th, styles.colMachine]}>Makine Adı / Türü</Text>
              <Text style={[styles.th, styles.colBrand]}>Marka / Model</Text>
              <Text style={[styles.th, styles.colSerial]}>Seri No</Text>
              <Text style={[styles.th, styles.colDate]}>Bakım Tarihi</Text>
              <Text style={[styles.th, styles.colNextDate]}>Sonraki Bakım</Text>
            </View>

            {entries.map((entry, index) => (
              <View
                key={entry.machine.id}
                style={index % 2 === 0 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
              >
                <Text style={[styles.rowNum, styles.colIndex]}>{index + 1}</Text>
                <Text style={[styles.td, styles.colMachine]}>{display(entry.machine.machine_name)}</Text>
                <Text style={[styles.td, styles.colBrand]}>{machineBrandModel(entry)}</Text>
                <Text style={[styles.td, styles.tdSerial, styles.colSerial]}>{display(entry.machine.serial_number)}</Text>
                <Text style={[styles.td, styles.colDate]}>
                  {formatDate(entry.latestRecord?.performed_at ?? entry.machine.last_maintenance_date)}
                </Text>
                <Text style={[styles.td, styles.tdNextDate, styles.colNextDate]}>
                  {formatDate(entry.latestRecord?.next_maintenance_date ?? entry.machine.next_maintenance_date)}
                </Text>
              </View>
            ))}
          </View>

          {scopeBadges.length > 0 ? (
            <View style={styles.scopeSection}>
              <View style={styles.sectionLabelRow}>
                <Text style={styles.sectionLabel}>Uygulanan Bakım Kapsamı</Text>
                <View style={styles.sectionRule} />
              </View>

              <View style={styles.scopeRow}>
                {scopeBadges.map((badge, index) => (
                  <Text key={`${badge}-${index}`} style={styles.scopeBadge}>
                    {badge}
                  </Text>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.contentSpacer} />

          <View style={styles.bottomBar}>
            <View style={styles.signatureField}>
              <Text style={styles.sigName}>{getPerformedBy(entries)}</Text>
              <View style={styles.sigLine} />
              <Text style={styles.sigLabel}>{getPerformedByTitle(entries)}</Text>
            </View>

            <View style={styles.signatureField}>
              <Text style={styles.sigName}>{getApproverName(entries)}</Text>
              <View style={styles.sigLine} />
              <Text style={styles.sigLabel}>{getApproverTitle(entries)}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoField}>
              <Text style={styles.infoValue}>{`BKS-${new Date().getFullYear()}-${String(entries.length).padStart(4, "0")}`}</Text>
              <Text style={styles.infoLabel}>Sertifika No</Text>
            </View>
            <View style={styles.infoField}>
              <Text style={styles.infoValue}>{getDateRange(entries)}</Text>
              <Text style={styles.infoLabel}>Hizmet Tarihleri</Text>
            </View>
            <View style={styles.infoField}>
              <Text style={styles.infoValue}>{getNextMaintenance(entries)}</Text>
              <Text style={styles.infoLabel}>Son Geçerlilik Tarihi</Text>
            </View>
            <View style={styles.infoField}>
              <Text style={styles.infoValue}>Planlı Bakım</Text>
              <Text style={styles.infoLabel}>Hizmet Standardı</Text>
            </View>
          </View>

          <Text style={styles.validityBar}>Bu belge imza alanları ile birlikte geçerlidir</Text>
        </View>
      </View>
    </Page>
  );
}

export function MachineMaintenanceCertificatePdf({ entries }: { entries: CertificateEntry[] }) {
  const pages = chunkEntries(entries);

  return (
    <Document
      title="Bakım Sertifikası"
      author="noxo"
      subject="Bakım Sertifikası"
      creator="noxo"
      producer="noxo"
    >
      {pages.map((pageEntries, index) => (
        <CertificatePage
          key={`${pageEntries[0]?.machine.id ?? "certificate"}-${index}`}
          entries={pageEntries}
          pageIndex={index}
          pageCount={pages.length}
        />
      ))}
    </Document>
  );
}

export { makePdfFileName };
