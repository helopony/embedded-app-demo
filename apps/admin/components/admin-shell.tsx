"use client";

import { useCallback, useRef, useState } from "react";
import { createHostBridge, type NavItem } from "@/bridge";
import type { AppManifest } from "@/lib/manifest";
import { BridgeInspector, type BridgeEvent } from "./bridge-inspector";
import { PartnerFrame } from "./partner-frame";
import { useWorkspaceSession } from "./use-workspace-session";
import { AppSidebar, WorkspaceLayout, type ConnectionStatus } from "./workspace-layout";

type Props = { manifest: AppManifest; initialPath: string };

function outerRoute(appBase: string, home: string) {
  const { pathname, search, hash } = window.location;
  return pathname.startsWith(appBase + "/")
    ? pathname.slice(appBase.length) + search + hash
    : home;
}

export default function AdminShell({ manifest, initialPath }: Props) {
  const appBase = "/apps/" + encodeURIComponent(manifest.id);
  const hostSession = useWorkspaceSession();
  const bridge = useRef<ReturnType<typeof createHostBridge> | null>(null);

  const [attempt, setAttempt] = useState(0);
  const [path, setPath] = useState(initialPath);
  const [navigation, setNavigation] = useState<NavItem[]>([]);
  const [connection, setConnection] = useState<ConnectionStatus>("connecting");
  const [events, setEvents] = useState<BridgeEvent[]>([]);

  const pushRoute = useCallback((next: string) => {
    if (next === outerRoute(appBase, manifest.home)) return;
    window.history.pushState(null, "", appBase + next);
    setPath(next);
  }, [appBase, manifest.home]);

  const connect = useCallback((frame: HTMLIFrameElement | null) => {
    if (!frame) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => setConnection("timeout"), 12000);

    function record(label: string) {
      if (controller.signal.aborted) return;
      const time = new Date().toLocaleTimeString("en-GB");
      setEvents(previous => [{ id: (previous[0]?.id ?? 0) + 1, label, time }, ...previous].slice(0, 20));
    }

    const session = createHostBridge({
      frame,
      appOrigin: manifest.origin,
      onNavigation: setNavigation,
      onRoute: pushRoute,
      onReady() {
        window.clearTimeout(timeout);
        setConnection("connected");
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
  }, [appBase, manifest.home, manifest.origin, pushRoute]);

  function navigate(next: string) {
    pushRoute(next);
    bridge.current?.navigate(next);
  }

  function reconnect() {
    setConnection("connecting");
    setNavigation([]);
    setAttempt(previous => previous + 1);
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
        ref={connect}
        key={attempt}
        manifest={manifest}
        session={hostSession}
        currentPath={path}
        onReconnect={connection === "timeout" ? reconnect : undefined}
      />
      <BridgeInspector manifest={manifest} events={events} />
    </WorkspaceLayout>
  );
}
