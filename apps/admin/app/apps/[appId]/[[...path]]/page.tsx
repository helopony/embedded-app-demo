import { notFound } from "next/navigation";
import AdminShell from "@/components/admin-shell";
import { installedManifest } from "@/lib/manifest";

export default async function EmbeddedApp({ params }: {
  params: Promise<{ appId: string; path?: string[] }>;
}) {
  const { appId, path } = await params;
  const manifest = installedManifest();
  if (appId !== manifest.id) notFound();
  const initialPath = path?.length ? "/" + path.map(encodeURIComponent).join("/") : manifest.home;
  return <AdminShell manifest={manifest} initialPath={initialPath} />;
}
