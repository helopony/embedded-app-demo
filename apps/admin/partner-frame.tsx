import type { Ref } from "react";
import { ArrowUpRight, Link2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { WorkspaceSession } from "./use-workspace-session";

type PartnerFrameProps = {
  ref: Ref<HTMLIFrameElement>;
  appName: string;
  appOrigin: string;
  session: WorkspaceSession;
  currentPath: string;
  framePath: string;
  attempt: number;
  onReconnect?: () => void;
};

function partnerUrl(path: string, appOrigin: string, hostOrigin: string) {
  const url = new URL("/embed" + path, appOrigin);
  url.searchParams.set("hostOrigin", hostOrigin);
  return url.href;
}

export function PartnerFrame({
  ref, appName, appOrigin, session, currentPath, framePath, attempt, onReconnect,
}: PartnerFrameProps) {
  const hostOrigin = typeof session === "object" ? session.origin : undefined;

  return (
    <Card className="block min-w-0 overflow-hidden rounded-xl border-slate-200 bg-white p-0 shadow-sm">
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-slate-200 bg-slate-50/80 px-4 py-2">
        <span className="flex min-w-0 items-center gap-2 text-xs text-slate-600">
          <Link2 size={14} className="shrink-0" />
          <span className="truncate font-mono" title={appOrigin}>{new URL(appOrigin).host}</span>
        </span>
        {hostOrigin && (
          <a href={partnerUrl(currentPath, appOrigin, hostOrigin)} target="_blank" rel="noopener noreferrer"
            className="inline-flex min-h-7 items-center gap-1 text-xs font-medium text-emerald-800 underline underline-offset-2">
            Open partner app directly <ArrowUpRight aria-hidden size={13} />
          </a>
        )}
      </div>
      {onReconnect && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          <span>The partner app did not connect.</span>
          <Button variant="outline" size="sm" onClick={onReconnect}><RotateCw size={13} /> Reconnect</Button>
        </div>
      )}
      {hostOrigin ? (
        <iframe
          key={attempt}
          ref={ref}
          title={appName + " partner app"}
          src={partnerUrl(framePath, appOrigin, hostOrigin)}
          sandbox="allow-scripts allow-same-origin"
          referrerPolicy="origin"
          className="block h-[650px] w-full border-0 sm:h-[600px]"
        />
      ) : (
        <div className="grid h-[650px] place-content-center gap-3 px-4 text-center text-sm text-slate-600 sm:h-[600px]">
          {session === "unavailable" ? <>
            <p role="alert">The workspace session could not be loaded.</p>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Retry workspace session</Button>
          </> : "Opening partner app…"}
        </div>
      )}
    </Card>
  );
}
