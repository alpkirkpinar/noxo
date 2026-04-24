import { redirect } from "next/navigation";

export default async function OfferEditRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard/offers?edit=${id}`);
}
