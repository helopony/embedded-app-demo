import type { MouseEvent, ReactNode } from "react";
import { Boxes, ChartNoAxesColumnIncreasing, Check, ChevronRight, Circle, LayoutGrid, LoaderCircle, Plug, Terminal } from "lucide-react";
import type { NavItem } from "@workspace/bridge/host";
import type { WorkspaceSession } from "./use-workspace-session";
import { ProjectGuide } from "./project-guide";

export type ConnectionStatus = "connecting" | "connected" | "timeout";

type SidebarProps = {
  appName: string;
  appBase: string;
  items: NavItem[];
  currentPath: string;
  unavailable: boolean;
  onNavigate: (path: string) => void;
};

export function AppSidebar({ appName, appBase, items, currentPath, unavailable, onNavigate }: SidebarProps) {
  function selectRoute(event: MouseEvent<HTMLAnchorElement>, path: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    onNavigate(path);
  }

  return (
    <aside className="flex flex-col bg-[#172923] px-5 py-5 text-white lg:sticky lg:top-0 lg:h-screen lg:py-7">
      <div className="flex items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#d7ef8b] text-[#172923]"><Boxes size={21} /></div>
        <div>
          <p className="text-lg font-bold leading-none tracking-tight">Workspace</p>
          <p className="mt-1 text-xs text-[#b4c6bd]">Administration</p>
        </div>
      </div>
      <nav aria-label="Installed app navigation" className="mt-6 lg:mt-12">
        <p className="mb-3 text-[11px] font-semibold tracking-[0.14em] text-[#aec0b7] uppercase">Installed apps</p>
        <div className="flex items-center gap-2.5 font-semibold">
          <ChartNoAxesColumnIncreasing size={18} className="text-[#d7ef8b]" /> {appName}
        </div>
        <div className="mt-3 flex flex-wrap gap-1 border-l border-white/15 pl-3 lg:flex-col">
          {items.map(item => {
            const active = item.path === currentPath;
            return (
              <a key={item.path} href={appBase + item.path} onClick={event => selectRoute(event, item.path)}
                aria-current={active ? "page" : undefined}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-[#c4d3ca] transition-colors hover:bg-white/8 hover:text-white aria-[current=page]:bg-white/12 aria-[current=page]:font-semibold aria-[current=page]:text-white">
                <Circle aria-hidden size={7} className={active ? "fill-[#d7ef8b] text-[#d7ef8b]" : ""} />
                {item.label}
              </a>
            );
          })}
          {items.length === 0 && (
            <span className="px-2 py-1 text-xs text-[#b4c6bd]">{unavailable ? "App unavailable" : "Loading app menu…"}</span>
          )}
        </div>
      </nav>
      <div className="mt-auto hidden items-center gap-2 border-t border-white/10 pt-5 text-xs text-[#c4d3ca] lg:flex">
        <Terminal size={15} /> Developer sandbox
      </div>
    </aside>
  );
}

function WorkspaceHeader({ session }: { session: WorkspaceSession }) {
  return (
    <header className="flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-200 bg-white px-4 py-2.5 sm:px-7">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <LayoutGrid size={15} /><span>Workspace</span><ChevronRight size={13} /><span className="font-medium text-slate-800">Apps</span>
      </div>
      <div role="group" aria-label="Workspace session" className="text-xs leading-relaxed text-slate-600">
        {typeof session === "object" ? <>
          <p>Signed in as <strong className="font-semibold text-slate-900">{session.actor.name}</strong></p>
          <p>Workspace <span className="font-medium text-slate-800">{session.store.name}</span></p>
        </> : <span>{session === "loading" ? "Loading workspace session…" : "Workspace session unavailable"}</span>}
      </div>
    </header>
  );
}

function BridgeStatus({ status }: { status: ConnectionStatus }) {
  const states = {
    connecting: <><LoaderCircle size={15} className="animate-spin" />Connecting bridge</>,
    connected: <><Check size={16} className="text-emerald-700" />Bridge connected</>,
    timeout: <><Plug size={15} />Connection timed out</>,
  };
  return <span role="status" className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">{states[status]}</span>;
}

type LayoutProps = {
  appName: string;
  session: WorkspaceSession;
  connection: ConnectionStatus;
  sidebar: ReactNode;
  children: ReactNode;
};

export function WorkspaceLayout({ appName, session, connection, sidebar, children }: LayoutProps) {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 lg:grid lg:grid-cols-[215px_minmax(0,1fr)]">
      {sidebar}
      <section className="min-w-0">
        <WorkspaceHeader session={session} />
        <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-7 lg:py-8">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{appName}</h1>
              <p className="mt-1.5 text-sm text-slate-600">Partner app workspace</p>
            </div>
            {typeof session === "object" && <BridgeStatus status={connection} />}
          </div>
          <ProjectGuide />
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(245px,28%)]">{children}</div>
        </div>
      </section>
    </main>
  );
}
