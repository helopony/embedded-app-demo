import { useState, type ReactNode } from "react";
import { Activity, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { AppManifest } from "@/lib/manifest";
import { cn } from "@/lib/utils";

export type BridgeEvent = { id: number; label: string; time: string };

function Step({ title, children }: { title: string; children: ReactNode }) {
  return <li><h3 className="font-semibold text-slate-900">{title}</h3>{children}</li>;
}

function Walkthrough() {
  return (
    <ol aria-label="How the prototype works" className="list-decimal space-y-4 py-4 pr-4 pl-9 text-sm leading-relaxed text-slate-600 marker:font-mono marker:text-emerald-700">
      <Step title="The workspace opens the partner">
        The installed manifest gives the host the partner origin, home route and requested permissions. The admin loads the app in a cross-origin iframe.
      </Step>
      <Step title="The app publishes its menu">
        Inside the iframe, a <code>MutationObserver</code> watches <code>&lt;workspace-app-nav&gt;</code>. The bridge sends link labels and paths through <code>postMessage</code>. Each side checks the sender’s origin and window. The host renders the sidebar.
      </Step>
      <Step title="The host identifies the session">
        Before loading the iframe, the host reads the staff and workspace shown in its header from a first-party session. When the iframe requests a launch assertion, the same session cookie authorizes a signed, 60-second JWT for that staff member, store and app installation.
      </Step>
      <Step title="The partner reads sales">
        The partner server presents the assertion and its client credentials at the OAuth token endpoint. The host verifies them and issues a scoped access token for the sales API. Open <strong>Authentication</strong> in the sidebar to inspect the claims and both HTTP results.
      </Step>
      <Step title="Try a direct visit">
        Choose <strong>Open partner app directly</strong>. In its own tab the partner has no workspace window to issue an assertion. Its forecast endpoint returns HTTP 401 with <code className="break-all">launch_assertion_required</code>.
      </Step>
    </ol>
  );
}

function EventLog({ events }: { events: BridgeEvent[] }) {
  return (
    <div className="p-4">
      {events.length ? (
        <ol aria-label="Bridge events" className="max-h-[410px] overflow-y-auto">
          {events.map(entry => (
            <li key={entry.id} className="flex items-start gap-2.5 border-b border-slate-100 py-2.5 first:pt-0 last:border-b-0">
              <ArrowUpRight size={13} className="mt-0.5 shrink-0 text-emerald-700" />
              <div className="min-w-0">
                <p className="break-words text-xs font-medium leading-5 text-slate-800">{entry.label}</p>
                <time className="font-mono text-[10px] text-slate-500">{entry.time}</time>
              </div>
            </li>
          ))}
        </ol>
      ) : <p className="text-xs text-slate-500">Waiting for the app handshake…</p>}
    </div>
  );
}

const views = ["How it works", "Events", "Manifest"] as const;

export function BridgeInspector({ manifest, events }: { manifest: AppManifest; events: BridgeEvent[] }) {
  const [view, setView] = useState<(typeof views)[number]>("How it works");

  return (
    <Card className="block min-w-0 gap-0 overflow-hidden rounded-xl border-slate-200 bg-white p-0 shadow-sm">
      <div className="border-b border-slate-200 px-4 py-4">
        <h2 className="flex items-center gap-2 font-semibold"><Activity size={16} className="text-emerald-700" /> Bridge inspector</h2>
      </div>
      <div role="group" aria-label="Inspector view" className="mx-3 mt-3 flex flex-wrap gap-0.5 rounded-lg bg-slate-100 p-1">
        {views.map(option => (
          <button key={option} type="button" aria-pressed={view === option} onClick={() => setView(option)}
            className={cn("min-h-8 grow rounded-md px-2 text-xs font-medium",
              view === option ? "bg-white text-slate-900 shadow-sm" : "text-slate-600")}>
            {option}
          </button>
        ))}
      </div>
      {view === "How it works" && <Walkthrough />}
      {view === "Events" && <EventLog events={events} />}
      {view === "Manifest" && (
        <div className="px-4 py-4">
          <pre aria-label="App manifest" className="whitespace-pre-wrap break-all rounded-md bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-700">{JSON.stringify(manifest, null, 2)}</pre>
        </div>
      )}
    </Card>
  );
}
