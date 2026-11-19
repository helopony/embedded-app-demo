"use client";

import { createElement, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, ChartNoAxesColumnIncreasing, CircleAlert, Fingerprint, LoaderCircle, RefreshCw } from "lucide-react";
import { createAppBridge } from "@workspace/bridge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Authentication, readLaunchClaims, StandaloneCheck, type AuthorizationReceipt } from "./authentication";

type Props = { hostOrigin: string; initialPath: string };
type Forecast = {
  store: { name: string };
  actor: { name: string };
  scope: string;
  authorization: AuthorizationReceipt;
  rows: { day: string; orders: number }[];
};

function replaceDocumentRoute(path: string) {
  const url = new URL(window.location.href);
  url.pathname = "/embed" + path;
  window.history.replaceState(null, "", url);
}

function OrderChart({ rows }: { rows: Forecast["rows"] }) {
  const highest = Math.max(1, ...rows.map(row => row.orders));
  return <figure aria-label="Expected orders by day" className="flex h-28 gap-1.5 sm:gap-3">
    {rows.map(row => <div key={row.day} className="flex min-w-0 flex-1 flex-col items-center">
      <div className="flex w-full flex-1 items-end justify-center border-b border-slate-200">
        <div title={row.day + ": " + row.orders + " orders"} className="w-full max-w-12 rounded-t-sm bg-emerald-600" style={{height: (row.orders / highest * 100) + "%"}} />
      </div>
      <span className="mt-1.5 text-[10px] text-slate-600 sm:text-xs">{row.day.slice(0,3)}</span>
    </div>)}
    <figcaption className="sr-only">{rows.map(row => row.day + " " + row.orders + " orders").join(", ")}</figcaption>
  </figure>;
}

export default function PartnerApp({ hostOrigin, initialPath }: Props) {
  const bridge = useRef<ReturnType<typeof createAppBridge> | null>(null);
  const [path, setPath] = useState(initialPath);
  const [data, setData] = useState<(Forecast & { claims: ReturnType<typeof readLaunchClaims> }) | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [standalone, setStandalone] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [publishForecast, setPublishForecast] = useState(true);

  useEffect(() => {
    if (window.parent === window || !hostOrigin) {
      setStandalone(true);
      setLoading(false);
      return;
    }
    const session = createAppBridge({
      hostOrigin,
      onNavigate(next) {
        replaceDocumentRoute(next);
        setPath(next);
      }
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

    async function readForecast() {
      if (!session) return;
      setLoading(true);
      setError("");
      setData(null);
      // Mint a fresh launch assertion for every read, including retries.
      const assertion = await session.getAssertion();
      if (controller.signal.aborted) return;
      const response = await fetch("/api/partner/forecast", {
        headers: { Authorization: "Bearer " + assertion }, cache: "no-store", signal: controller.signal
      });
      if (!response.ok) throw new Error(response.status === 401 || response.status === 403
        ? "The partner could not verify this session. Request a fresh assertion to retry."
        : "The forecast service could not complete the request.");
      const result: Forecast = await response.json();
      if (!controller.signal.aborted) setData({ ...result, claims: readLaunchClaims(assertion) });
    }
    readForecast().catch((failure: unknown) => {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Unable to load the forecast.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [hostOrigin, attempt]);

  function navigate(next: string) {
    if (next === path) return;
    replaceDocumentRoute(next);
    setPath(next);
    bridge.current?.routeChanged(next);
  }

  const isForecast = path === "/forecast";
  const isAuthentication = path === "/authentication";
  const total = data?.rows.reduce((sum, row) => sum + row.orders, 0) ?? 0;
  const peak = data?.rows.reduce<Forecast["rows"][number] | undefined>((top, row) =>
    !top || row.orders > top.orders ? row : top, undefined);

  return <main className="min-h-screen bg-white px-4 py-5 text-slate-900 sm:px-6 sm:py-6">
    {createElement("workspace-app-nav", { hidden: true },
      <a href="/overview">Overview</a>,
      publishForecast ? <a href="/forecast">Forecast</a> : null,
      <a href="/authentication">Authentication</a>
    )}
    <div className="mb-4 flex items-center gap-2.5 text-sm font-semibold">
      <span className="grid size-8 place-items-center rounded-md bg-emerald-100 text-emerald-800"><ChartNoAxesColumnIncreasing size={18} /></span>Demand Forecast
    </div>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-[26px] font-semibold tracking-tight">{isAuthentication ? "Authentication" : isForecast ? "Order forecast" : "Overview"}</h1>
        <p className="mt-1 text-sm text-slate-600">{isAuthentication ? "What the workspace shared for this request" : data ? data.store.name : "Restaurant demand planning"}</p>
      </div>
      {data && <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => setAttempt(value => value + 1)} aria-label={isAuthentication ? "Run authentication again" : "Refresh forecast data"}>
        <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> {isAuthentication ? "Run authentication again" : "Refresh"}
      </Button>}
    </div>
    {standalone ? <StandaloneCheck hostOrigin={hostOrigin} /> : error ? <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
      <div className="flex items-start gap-2"><CircleAlert size={16} className="mt-0.5 shrink-0" /><p>{error}</p></div>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setAttempt(value => value + 1)}>Retry authentication</Button>
    </div> : data && isAuthentication ? <Authentication claims={data.claims} authorization={data.authorization}
      actor={data.actor.name} store={data.store.name} days={data.rows.length} /> : data ? <>
      {isForecast ? <Card className="block gap-0 overflow-hidden rounded-lg p-0 shadow-none">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Forecast daily order counts</caption>
          <thead><tr className="bg-slate-50 text-left text-xs text-slate-600"><th scope="col" className="px-4 py-2 font-medium">Day</th><th scope="col" className="px-4 py-2 text-right font-medium">Expected orders</th></tr></thead>
          <tbody>{data.rows.map(row => <tr key={row.day} className="border-t border-slate-100">
            <th scope="row" className="px-4 py-1.5 text-left font-normal">{row.day}</th><td className="px-4 py-1.5 text-right font-medium tabular-nums">{row.orders}</td>
          </tr>)}</tbody>
        </table>
      </Card> : <Card className="gap-0 rounded-lg border-slate-200 p-4 shadow-none sm:p-5">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-sm font-medium text-slate-600">Expected orders</p><div className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">{total.toLocaleString("en-US")}</div></div>
          <Badge variant="outline" className="bg-slate-50 font-medium text-slate-600"><CalendarDays size={12} />{data.rows.length}-day outlook</Badge>
        </div>
        <OrderChart rows={data.rows} />
        {peak && <p className="mt-4 text-xs text-slate-600">{peak.day} has the highest forecast at <strong className="font-semibold text-slate-800">{peak.orders} orders</strong>.</p>}
      </Card>}
      <div className="mt-3 flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={() => navigate(isForecast ? "/overview" : "/forecast")}>
          {isForecast && <ArrowLeft size={13} />}{isForecast ? "Back to overview" : "View forecast"}{!isForecast && <ArrowRight size={13} />}
        </Button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-600">
        <Fingerprint size={14} className="text-emerald-700" /><span>Authenticated as <strong className="font-medium text-slate-800">{data.actor.name}</strong></span><code className="rounded bg-slate-100 px-1.5 py-0.5">{data.scope}</code>
        <button type="button" className="font-medium text-emerald-700 underline underline-offset-2" onClick={() => navigate("/authentication")}>Inspect authentication</button>
      </div>
    </> : <p role="status" className="flex items-center gap-2 rounded-lg border border-slate-200 p-4 text-sm text-slate-600"><LoaderCircle size={16} className="animate-spin" /> Authenticating with the workspace…</p>}
    {!standalone && !isAuthentication && <label className="mt-4 inline-flex min-h-8 cursor-pointer items-center gap-2 text-xs text-slate-600">
      <input type="checkbox" checked={publishForecast} onChange={event => setPublishForecast(event.target.checked)}
        className="size-4 shrink-0 accent-emerald-700" />
      Show Forecast in workspace menu
    </label>}
  </main>;
}
