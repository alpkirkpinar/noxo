import { redirect } from "next/navigation";

export default function NewOfferRedirectPage() {
  redirect("/dashboard/offers?new=1");
}
