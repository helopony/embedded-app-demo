"use client";

import { createElement, useEffect, useRef, useState } from "react";
import { createAppBridge } from "@workspace/bridge";
import { Authentication } from "./authentication";
import { readLaunchClaims, type AuthorizationReceipt } from "./auth-data";
import { ForecastView, type ForecastRow } from "./forecast";
import { AuthenticationError, AuthenticationPending, ForecastMenuToggle, PartnerLayout } from "./partner-layout";
import { StandaloneCheck } from "./standalone-check";

type ForecastResponse = {
  store: { name: string };
  actor: { name: string };
  scope: string;
  authorization: AuthorizationReceipt;
  rows: ForecastRow[];
};

type AppBridge = ReturnType<typeof createAppBridge>;
type ForecastRequest =
  | { status: "standalone" | "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: Awaited<ReturnType<typeof readForecast>> };

async function readForecast(bridge: AppBridge, signal: AbortSignal) {
  // Each read, including a retry, gets its own launch assertion from the host.
  const assertion = await bridge.getAssertion();
  signal.throwIfAborted();
  const response = await fetch("/api/partner/forecast", {
    headers: { Authorization: "Bearer " + assertion },
    cache: "no-store",
    signal,
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error("The partner could not verify this session. Request a fresh assertion to retry.");
  }
  if (!response.ok) throw new Error("The forecast service could not complete the request.");
  const forecast: ForecastResponse = await response.json();
  return { ...forecast, claims: readLaunchClaims(assertion) };
}

function replaceDocumentRoute(path: string) {
  const url = new URL(window.location.href);
  url.pathname = "/embed" + path;
  window.history.replaceState(null, "", url);
}

export default function PartnerApp({ hostOrigin, initialPath }: { hostOrigin: string; initialPath: string }) {
  const bridge = useRef<AppBridge | null>(null);
  const [path, setPath] = useState(initialPath);
  const [request, setRequest] = useState<ForecastRequest>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [publishForecast, setPublishForecast] = useState(true);

  useEffect(() => {
    if (window.parent === window || !hostOrigin) {
      setRequest({ status: "standalone" });
      return;
    }
    const session = createAppBridge({
      hostOrigin,
      onNavigate(next) {
        replaceDocumentRoute(next);
        setPath(next);
      },
    });
    bridge.current = session;
    return () => {
      bridge.current = null;
      session.destroy();
    };
  }, [hostOrigin]);

  useEffect(() => {
    const session = bridge.current;
    if (!session) return;
    const controller = new AbortController();
    setRequest({ status: "loading" });
    readForecast(session, controller.signal).then(data => {
      if (!controller.signal.aborted) setRequest({ status: "ready", data });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        const message = error instanceof Error ? error.message : "Unable to load the forecast.";
        setRequest({ status: "error", message });
      }
    });
    return () => controller.abort();
  }, [hostOrigin, attempt]);

  function navigate(next: string) {
    if (next === path) return;
    replaceDocumentRoute(next);
    setPath(next);
    bridge.current?.routeChanged(next);
  }

  const navigation = createElement("workspace-app-nav", { hidden: true },
    <a href="/overview">Overview</a>,
    publishForecast ? <a href="/forecast">Forecast</a> : null,
    <a href="/authentication">Authentication</a>
  );
  const refresh = () => setAttempt(value => value + 1);
  const data = request.status === "ready" ? request.data : undefined;

  return (
    <PartnerLayout navigation={navigation} path={path} storeName={data?.store.name} onRefresh={data ? refresh : undefined}>
      {request.status === "standalone" && <StandaloneCheck hostOrigin={hostOrigin} />}
      {request.status === "loading" && <AuthenticationPending />}
      {request.status === "error" && <AuthenticationError message={request.message} onRetry={refresh} />}
      {data && (path === "/authentication" ? (
        <Authentication claims={data.claims} authorization={data.authorization}
          actor={data.actor.name} store={data.store.name} days={data.rows.length} />
      ) : (
        <ForecastView rows={data.rows} actor={data.actor.name} scope={data.scope}
          detailed={path === "/forecast"} onNavigate={navigate} />
      ))}
      {request.status !== "standalone" && path !== "/authentication" && (
        <ForecastMenuToggle checked={publishForecast} onChange={setPublishForecast} />
      )}
    </PartnerLayout>
  );
}
