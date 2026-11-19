import AdminShell from "@/apps/admin/admin-shell";
import { manifest } from "@/lib/manifest";
import { partnerOrigin } from "@/lib/origins";

export default function Home() {
  const origin = partnerOrigin();
  return <AdminShell manifest={{ ...manifest, origin }} appOrigin={origin} initialPath={manifest.home} />;
}
