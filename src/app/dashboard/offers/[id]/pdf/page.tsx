import { redirect } from "next/navigation";

export default async function OfferPdfRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard/offers/${id}/pdf/file`);
}