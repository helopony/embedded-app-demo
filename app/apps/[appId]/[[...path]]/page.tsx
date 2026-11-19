import { notFound } from "next/navigation";
import AdminShell from "@/apps/admin/admin-shell";
import { manifest } from "@/lib/manifest";
import { partnerOrigin } from "@/lib/origins";

export default async function EmbeddedApp({ params }: {
  params: Promise<{ appId: string; path?: string[] }>;
}) {
  const { appId, path } = await params;
  if (appId !== manifest.id) notFound();
  const origin = partnerOrigin();
  const initialPath = path?.length ? "/" + path.map(encodeURIComponent).join("/") : manifest.home;
  return <AdminShell manifest={{ ...manifest, origin }} appOrigin={origin} initialPath={initialPath} />;
}
