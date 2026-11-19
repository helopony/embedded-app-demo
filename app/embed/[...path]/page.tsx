import { notFound } from "next/navigation";
import PartnerApp from "@/apps/test-app/partner-app";
import { hostApiOrigin, isHostOrigin } from "@/lib/origins";

export default async function PartnerPage({ params, searchParams }: {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<{ hostOrigin?: string | string[] }>;
}) {
  const [{ path }, query] = await Promise.all([params, searchParams]);
  const host = query.hostOrigin ?? hostApiOrigin();
  if (typeof host !== "string" || !isHostOrigin(host) || path.length !== 1 || !["overview", "forecast"].includes(path[0])) notFound();
  return <PartnerApp initialPath={"/" + path[0]} hostOrigin={host} />;
}
