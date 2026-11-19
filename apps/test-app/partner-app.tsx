"use client";

import { createElement, useEffect, useRef, useState } from "react";
import { createAppBridge } from "@workspace/bridge";
import { Authentication } from "./authentication";
import { ForecastView } from "./forecast";
import { readForecast, type Forecast } from "./forecast-data";
import { AuthenticationError, AuthenticationPending, ForecastMenuToggle, PartnerLayout } from "./partner-layout";
import { StandaloneCheck } from "./standalone-check";

type ForecastRequest =
  | { status: "standalone" | "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: Forecast };

export default function PartnerApp({ hostOrigin, initialPath }: { hostOrigin: string; initialPath: string }) {
  const bridge = useRef<ReturnType<typeof createAppBridge> | null>(null);
  const pending = useRef<AbortController | null>(null);
  const [path, setPath] = useState(initialPath);
  const [request, setRequest] = useState<ForecastRequest>({ status: "loading" });
  const [publishForecast, setPublishForecast] = useState(true);

  function showPage(next: string) {
    const url = new URL(window.location.href);
    url.pathname = "/embed" + next;
    window.history.replaceState(null, "", url);
    setPath(next);
  }

  async function refresh() {
    if (!bridge.current) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setRequest({ status: "loading" });
    try {
      const data = await readForecast(bridge.current, controller.signal);
      if (!controller.signal.aborted) setRequest({ status: "ready", data });
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : "Unable to load the forecast.";
      setRequest({ status: "error", message });
    }
  }

  useEffect(() => {
    if (window.parent === window || !hostOrigin) {
      setRequest({ status: "standalone" });
      return;
    }
    const session = createAppBridge({ hostOrigin, onNavigate: showPage });
    bridge.current = session;
    void refresh();
    return () => {
      pending.current?.abort();
      session.destroy();
      bridge.current = null;
    };
  }, [hostOrigin]);

  function navigate(next: string) {
    if (next === path) return;
    showPage(next);
    bridge.current?.routeChanged(next);
  }

  const data = request.status === "ready" ? request.data : undefined;
  return (
    <PartnerLayout path={path} storeName={data?.store.name} onRefresh={data ? refresh : undefined}>
      {createElement("workspace-app-nav", { hidden: true },
        <a href="/overview">Overview</a>,
        publishForecast ? <a href="/forecast">Forecast</a> : null,
        <a href="/authentication">Authentication</a>
      )}
      {request.status === "standalone" && <StandaloneCheck hostOrigin={hostOrigin} />}
      {request.status === "loading" && <AuthenticationPending />}
      {request.status === "error" && <AuthenticationError message={request.message} onRetry={refresh} />}
      {data && (path === "/authentication"
        ? <Authentication forecast={data} />
        : <ForecastView forecast={data} detailed={path === "/forecast"} onNavigate={navigate} />)}
      {request.status !== "standalone" && path !== "/authentication" && (
        <ForecastMenuToggle checked={publishForecast} onChange={setPublishForecast} />
      )}
    </PartnerLayout>
  );
}
