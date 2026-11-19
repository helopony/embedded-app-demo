import { useEffect, useState } from "react";
import { Badge } from "@workspace/ui/badge";
import manifest from "@/app.manifest.json";

type AnonymousRead = "waiting" | "unavailable" | { status: number; error?: string };

export function StandaloneCheck({ hostOrigin }: { hostOrigin: string }) {
  const [result, setResult] = useState<AnonymousRead>("waiting");

  useEffect(() => {
    const controller = new AbortController();
    async function checkAccess() {
      try {
        const response = await fetch("/api/partner/forecast", {
          credentials: "omit", cache: "no-store", signal: controller.signal,
        });
        // An unexpected success could contain sales data. Only inspect error responses.
        const body = response.ok ? null : await response.json().catch(() => null);
        if (!controller.signal.aborted) {
          setResult({ status: response.status, error: typeof body?.error === "string" ? body.error : undefined });
        }
      } catch {
        if (!controller.signal.aborted) setResult("unavailable");
      }
    }
    void checkAccess();
    return () => controller.abort();
  }, []);

  return (
    <section className="max-w-2xl rounded-lg border border-slate-200 p-5">
      <h2 className="font-semibold">Workspace session required</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        This tab has no workspace parent window. The bridge needs that parent to issue a fresh launch assertion for this app.
      </p>
      <div className="my-4 rounded-md bg-slate-50 p-3 text-sm" role="status">
        <p className="font-medium">Request without an assertion</p>
        <code className="mt-1 block text-xs">GET /api/partner/forecast</code>
        <AnonymousResponse result={result} />
      </div>
      <a className="text-sm font-medium text-emerald-700 underline" href={hostOrigin + "/apps/" + manifest.id + "/authentication"}>
        Open workspace
      </a>
    </section>
  );
}

function AnonymousResponse({ result }: { result: AnonymousRead }) {
  if (typeof result === "string") {
    return (
      <p className="mt-2 text-xs text-slate-600">
        {result === "waiting" ? "Waiting for the partner backend…" : "The endpoint could not be reached. Reload to try again."}
      </p>
    );
  }

  const denied = result.status === 401 && result.error === "launch_assertion_required";
  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge variant="outline">HTTP {result.status}</Badge>
        {result.error && <code className="break-all text-xs">{result.error}</code>}
      </div>
      <p className="mt-2 text-xs text-slate-600">
        {denied ? "The partner backend rejected the request before token exchange." : "The endpoint returned an unexpected response to the anonymous request."}
      </p>
    </>
  );
}
