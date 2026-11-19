import AdminShell from "@/components/admin-shell";
import { installedManifest } from "@/lib/manifest";

export default function Home() {
  const manifest = installedManifest();
  return <AdminShell manifest={manifest} initialPath={manifest.home} />;
}
