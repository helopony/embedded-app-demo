"use client";

import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { Activity, ArrowUpRight, Boxes, ChartNoAxesColumnIncreasing, Check, ChevronRight, Circle, LayoutGrid, Link2, LoaderCircle, Plug, RotateCw, Terminal } from "lucide-react";
import { createHostBridge, type NavItem } from "@sides/bridge";
import type { AppManifest } from "@/lib/manifest";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Props = { appOrigin: string; manifest: AppManifest; initialPath: string };
type EventEntry = { id: number; label: string; time: string };

function Walkthrough() {
  return <ol aria-label="How the prototype works" className="list-decimal space-y-4 py-4 pr-4 pl-9 text-sm leading-relaxed text-slate-600 marker:font-mono marker:text-emerald-700">
    <li><h3 className="font-semibold text-slate-900">SIDES opens the partner</h3>
      The installed manifest gives SIDES the partner origin, home route and requested permissions. The admin loads the app in a cross-origin iframe.</li>
    <li><h3 className="font-semibold text-slate-900">The app publishes its menu</h3>
      Inside the iframe, a <code>MutationObserver</code> watches <code>&lt;sides-app-nav&gt;</code>. The bridge sends link labels and paths through <code>postMessage</code>. Each side checks the sender’s origin and window. SIDES renders the sidebar.</li>
    <li><h3 className="font-semibold text-slate-900">SIDES identifies the session</h3>
      The iframe asks for a launch assertion. The host sends its first-party session cookie to its own backend and gives the iframe a signed, 60-second JWT identifying the demo staff member, store and app installation.</li>
    <li><h3 className="font-semibold text-slate-900">The partner reads sales</h3>
      The partner server presents the assertion and its client credentials at the OAuth token endpoint. SIDES verifies them and issues a scoped access token for the sales API. Open <strong>Authentication</strong> in the sidebar to inspect the claims and both HTTP results.</li>
    <li><h3 className="font-semibold text-slate-900">Try a direct visit</h3>
      Choose <strong>Open partner app directly</strong>. In its own tab the partner has no SIDES parent to issue an assertion. Its forecast endpoint returns HTTP 401 with <code className="break-all">launch_assertion_required</code>.</li>
  </ol>;
}

function outerRoute(appBase: string, home: string) {
  const { pathname, search, hash } = window.location;
  return pathname.startsWith(appBase + "/")
    ? pathname.slice(appBase.length) + search + hash
    : home;
}

export default function AdminShell({ appOrigin, manifest, initialPath }: Props) {
  const appBase = "/apps/" + encodeURIComponent(manifest.id);
  const iframe = useRef<HTMLIFrameElement>(null);
  const bridge = useRef<ReturnType<typeof createHostBridge> | null>(null);
  const activePath = useRef(initialPath);
  const logId = useRef(0);
  const [hostOrigin, setHostOrigin] = useState("");
  const [framePath, setFramePath] = useState(initialPath);
  const [path, setPath] = useState(initialPath);
  const [navigation, setNavigation] = useState<NavItem[]>([]);
  const [connection, setConnection] = useState<"connecting" | "connected" | "timeout">("connecting");
  const [attempt, setAttempt] = useState(0);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [inspector, setInspector] = useState<"How it works" | "Events" | "Manifest">("How it works");

  useEffect(() => { setHostOrigin(window.location.origin); }, []);

  useEffect(() => {
    const frame = iframe.current;
    if (!frame || !hostOrigin) return;
    let live = true;
    function record(label: string) {
      if (!live) return;
      const entry = { id: ++logId.current, label, time: new Date().toLocaleTimeString("en-GB") };
      setEvents(previous => [entry, ...previous].slice(0, 20));
    }

    const timeout = window.setTimeout(() => setConnection("timeout"), 12000);
    const controller = new AbortController();
    const session = createHostBridge({
      frame, appOrigin,
      onNavigation(items) { if (live) setNavigation(items); },
      onRoute(next) {
        if (!live || next === activePath.current) return;
        activePath.current = next;
        setPath(next);
        window.history.pushState(null, "", appBase + next);
      },
      onReady() {
        if (!live) return;
        window.clearTimeout(timeout);
        setConnection("connected");
        if (activePath.current !== framePath) bridge.current?.navigate(activePath.current);
      },
      async getAssertion() {
        const response = await fetch("/api/host/launch", {
          method: "POST", cache: "no-store", signal: controller.signal
        });
        if (!response.ok) throw new Error("SIDES could not issue a launch assertion.");
        const { assertion } = await response.json();
        if (typeof assertion !== "string") throw new Error("The launch service returned an invalid response.");
        record("SIDES issued a demo launch assertion");
        return assertion;
      },
      onEvent: record
    });
    bridge.current = session;
    function popRoute() {
      const next = outerRoute(appBase, manifest.home);
      activePath.current = next;
      setPath(next);
      session.navigate(next);
    }
    window.addEventListener("popstate", popRoute);
    return () => {
      live = false;
      controller.abort();
      window.clearTimeout(timeout);
      window.removeEventListener("popstate", popRoute);
      session.destroy();
      bridge.current = null;
    };
  }, [appBase, appOrigin, hostOrigin, attempt, framePath, manifest.home]);

  function selectRoute(event: MouseEvent<HTMLAnchorElement>, next: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (next === activePath.current) return;
    activePath.current = next;
    setPath(next);
    window.history.pushState(null, "", appBase + next);
    bridge.current?.navigate(next);
  }

  function reconnect() {
    setConnection("connecting");
    setNavigation([]);
    setFramePath(activePath.current);
    setAttempt(value => value + 1);
  }

  function partnerUrl(route: string) {
    const url = new URL("/embed" + route, appOrigin);
    url.searchParams.set("hostOrigin", hostOrigin);
    return url.href;
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 lg:grid lg:grid-cols-[215px_minmax(0,1fr)]">
      <aside className="flex flex-col bg-[#172923] px-5 py-5 text-white lg:sticky lg:top-0 lg:h-screen lg:py-7">
        <div className="flex items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#d7ef8b] text-[#172923]"><Boxes size={21} /></div>
          <div><p className="text-lg font-bold leading-none tracking-tight">SIDES</p><p className="mt-1 text-xs text-[#b4c6bd]">Administration</p></div>
        </div>
        <nav aria-label="Installed app navigation" className="mt-6 lg:mt-12">
          <p className="mb-3 text-[11px] font-semibold tracking-[0.14em] text-[#aec0b7] uppercase">Installed apps</p>
          <div className="flex items-center gap-2.5 font-semibold"><ChartNoAxesColumnIncreasing size={18} className="text-[#d7ef8b]" /> {manifest.name}</div>
          <div className="mt-3 flex flex-wrap gap-1 border-l border-white/15 pl-3 lg:flex-col">
            {navigation.map(item => (
              <a key={item.path} href={appBase + item.path} onClick={event => selectRoute(event, item.path)}
                aria-current={path === item.path ? "page" : undefined}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${path === item.path ? "bg-white/12 font-semibold text-white" : "text-[#c4d3ca] hover:bg-white/8 hover:text-white"}`}>
                <Circle aria-hidden size={7} className={path === item.path ? "fill-[#d7ef8b] text-[#d7ef8b]" : ""} />{item.label}
              </a>
            ))}
            {navigation.length === 0 && <span className="px-2 py-1 text-xs text-[#b4c6bd]">{connection === "timeout" ? "App unavailable" : "Loading app menu…"}</span>}
          </div>
        </nav>
        <div className="mt-auto hidden items-center gap-2 border-t border-white/10 pt-5 text-xs text-[#c4d3ca] lg:flex"><Terminal size={15} /> Developer sandbox</div>
      </aside>
      <section className="min-w-0">
        <header className="flex min-h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-7">
          <div className="flex items-center gap-2 text-sm text-slate-500"><LayoutGrid size={15} /><span>Workspace</span><ChevronRight size={13} /><span className="font-medium text-slate-800">Apps</span></div>
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">Mock backend</Badge>
        </header>
        <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-7 lg:py-8">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{manifest.name}</h1><p className="mt-1.5 text-sm text-slate-600">Partner app workspace</p></div>
            <span role="status" className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
              {connection === "connected" ? <Check size={16} className="text-emerald-700" /> : connection === "connecting" ? <LoaderCircle size={15} className="animate-spin" /> : <Plug size={15} />}
              {connection === "connected" ? "Bridge connected" : connection === "connecting" ? "Connecting bridge" : "Connection timed out"}
            </span>
          </div>
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(245px,28%)]">
            <Card className="block min-w-0 overflow-hidden rounded-xl border-slate-200 bg-white p-0 shadow-sm">
              <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-slate-200 bg-slate-50/80 px-4 py-2">
                <span className="flex min-w-0 items-center gap-2 text-xs text-slate-600"><Link2 size={14} className="shrink-0" /><span className="truncate font-mono" title={appOrigin}>{new URL(appOrigin).host}</span></span>
                {hostOrigin && <a href={partnerUrl(path)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-7 items-center gap-1 text-xs font-medium text-emerald-800 underline underline-offset-2">
                  Open partner app directly <ArrowUpRight aria-hidden size={13} />
                </a>}
              </div>
              {connection === "timeout" && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm">
                <span>The partner app did not connect.</span><Button variant="outline" size="sm" onClick={reconnect}><RotateCw size={13} /> Reconnect</Button>
              </div>}
              {hostOrigin ? <iframe key={attempt} ref={iframe} title={manifest.name + " partner app"} src={partnerUrl(framePath)}
                sandbox="allow-scripts allow-same-origin" referrerPolicy="origin" className="block h-[650px] w-full border-0 sm:h-[600px]" /> :
                <div className="grid h-[650px] place-items-center text-sm text-slate-500 sm:h-[600px]">Opening partner app…</div>}
            </Card>
            <Card className="block min-w-0 gap-0 overflow-hidden rounded-xl border-slate-200 bg-white p-0 shadow-sm">
              <div className="border-b border-slate-200 px-4 py-4"><h2 className="flex items-center gap-2 font-semibold"><Activity size={16} className="text-emerald-700" /> Bridge inspector</h2></div>
              <div role="group" aria-label="Inspector view" className="mx-3 mt-3 flex flex-wrap gap-0.5 rounded-lg bg-slate-100 p-1">
                {(["How it works", "Events", "Manifest"] as const).map(view => <button key={view} type="button" aria-pressed={inspector === view} onClick={() => setInspector(view)}
                  className={`min-h-8 grow rounded-md px-2 text-xs font-medium ${inspector === view ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}>
                  {view}
                </button>)}
              </div>
              {inspector === "How it works" && <Walkthrough />}
              {inspector === "Manifest" && <div className="px-4 py-4"><pre aria-label="App manifest" className="whitespace-pre-wrap break-all rounded-md bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-700">{JSON.stringify(manifest, null, 2)}</pre></div>}
              {inspector === "Events" && <div className="p-4">
                  {events.length ? <ol aria-label="Bridge events" className="max-h-[410px] overflow-y-auto">
                    {events.map(entry => <li key={entry.id} className="flex items-start gap-2.5 border-b border-slate-100 py-2.5 first:pt-0 last:border-b-0">
                      <ArrowUpRight size={13} className="mt-0.5 shrink-0 text-emerald-700" /><div className="min-w-0"><p className="break-words text-xs font-medium leading-5 text-slate-800">{entry.label}</p><time className="font-mono text-[10px] text-slate-500">{entry.time}</time></div>
                    </li>)}
                  </ol> : <p className="text-xs text-slate-500">Waiting for the app handshake…</p>}
                </div>}
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
}
