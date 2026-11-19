"use client";

import { useEffect, useRef, useState } from "react";
import { createHostBridge, type NavItem } from "@workspace/bridge";
import type { AppManifest } from "@/lib/manifest";
import { BridgeInspector, type BridgeEvent } from "./bridge-inspector";
import { PartnerFrame } from "./partner-frame";
import { useWorkspaceSession } from "./use-workspace-session";
import { AppSidebar, WorkspaceLayout, type ConnectionStatus } from "./workspace-layout";

type Props = { appOrigin: string; manifest: AppManifest; initialPath: string };

function outerRoute(appBase: string, home: string) {
  const { pathname, search, hash } = window.location;
  return pathname.startsWith(appBase + "/")
    ? pathname.slice(appBase.length) + search + hash
    : home;
}

export default function AdminShell({ appOrigin, manifest, initialPath }: Props) {
  const appBase = "/apps/" + encodeURIComponent(manifest.id);
  const hostSession = useWorkspaceSession();
  const hostOrigin = typeof hostSession === "object" ? hostSession.origin : undefined;
  const iframe = useRef<HTMLIFrameElement>(null);
  const bridge = useRef<ReturnType<typeof createHostBridge> | null>(null);
  const activePath = useRef(initialPath);
  const logId = useRef(0);

  const [framePath, setFramePath] = useState(initialPath);
  const [path, setPath] = useState(initialPath);
  const [navigation, setNavigation] = useState<NavItem[]>([]);
  const [connection, setConnection] = useState<ConnectionStatus>("connecting");
  const [attempt, setAttempt] = useState(0);
  const [events, setEvents] = useState<BridgeEvent[]>([]);

  useEffect(() => {
    const frame = iframe.current;
    if (!frame || !hostOrigin) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => setConnection("timeout"), 12000);

    function record(label: string) {
      if (controller.signal.aborted) return;
      const entry = { id: ++logId.current, label, time: new Date().toLocaleTimeString("en-GB") };
      setEvents(previous => [entry, ...previous].slice(0, 20));
    }

    const session = createHostBridge({
      frame,
      appOrigin,
      onNavigation(items) {
        if (!controller.signal.aborted) setNavigation(items);
      },
      onRoute(next) {
        if (controller.signal.aborted || next === activePath.current) return;
        activePath.current = next;
        setPath(next);
        window.history.pushState(null, "", appBase + next);
      },
      onReady() {
        if (controller.signal.aborted) return;
        window.clearTimeout(timeout);
        setConnection("connected");
        if (activePath.current !== framePath) bridge.current?.navigate(activePath.current);
      },
      async getAssertion() {
        const response = await fetch("/api/host/launch", {
          method: "POST", cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) throw new Error("The host could not issue a launch assertion.");
        const { assertion } = await response.json();
        if (typeof assertion !== "string") throw new Error("The launch service returned an invalid response.");
        record("The host issued a demo launch assertion");
        return assertion;
      },
      onEvent: record,
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
      controller.abort();
      window.clearTimeout(timeout);
      window.removeEventListener("popstate", popRoute);
      session.destroy();
      bridge.current = null;
    };
  }, [appBase, appOrigin, hostOrigin, attempt, framePath, manifest.home]);

  function navigate(next: string) {
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

  const sidebar = (
    <AppSidebar
      appName={manifest.name}
      appBase={appBase}
      items={navigation}
      currentPath={path}
      unavailable={connection === "timeout" || hostSession === "unavailable"}
      onNavigate={navigate}
    />
  );

  return (
    <WorkspaceLayout appName={manifest.name} session={hostSession} connection={connection} sidebar={sidebar}>
      <PartnerFrame
        ref={iframe}
        appName={manifest.name}
        appOrigin={appOrigin}
        session={hostSession}
        currentPath={path}
        framePath={framePath}
        attempt={attempt}
        onReconnect={connection === "timeout" ? reconnect : undefined}
      />
      <BridgeInspector manifest={manifest} events={events} />
    </WorkspaceLayout>
  );
}
