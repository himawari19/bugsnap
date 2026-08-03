import { redirect } from "next/navigation";

export default function ViewRedirectPage({ params }: { params: { id: string } }) {
  // Safe redirect: route all legacy /view/[id] links directly to the secure /c/[id] share page.
  redirect(`/c/${params.id}`);
}
