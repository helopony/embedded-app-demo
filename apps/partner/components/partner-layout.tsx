import type { ReactNode } from "react";
import { ChartNoAxesColumnIncreasing, CircleAlert, LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@workspace/ui/button";

type PartnerLayoutProps = {
  children: ReactNode;
  path: string;
  storeName?: string;
  onRefresh?: () => void;
};

export function PartnerLayout({ children, path, storeName, onRefresh }: PartnerLayoutProps) {
  const authentication = path === "/authentication";
  const title = authentication ? "Authentication" : path === "/forecast" ? "Order forecast" : "Overview";
  const subtitle = authentication ? "What the workspace shared for this request" : storeName ?? "Restaurant demand planning";

  return (
    <main className="min-h-screen bg-white px-4 py-5 text-slate-900 sm:px-6 sm:py-6">
      <div className="mb-4 flex items-center gap-2.5 text-sm font-semibold">
        <span className="grid size-8 place-items-center rounded-md bg-emerald-100 text-emerald-800">
          <ChartNoAxesColumnIncreasing size={18} />
        </span>
        Demand Forecast
      </div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        </div>
        {onRefresh && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            aria-label={authentication ? "Run authentication again" : "Refresh forecast data"}
          >
            <RefreshCw size={14} /> {authentication ? "Run authentication again" : "Refresh"}
          </Button>
        )}
      </div>
      {children}
    </main>
  );
}

export function ForecastMenuToggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="mt-4 inline-flex min-h-8 cursor-pointer items-center gap-2 text-xs text-slate-600">
      <input
        type="checkbox"
        checked={checked}
        onChange={event => onChange(event.target.checked)}
        className="size-4 shrink-0 accent-emerald-700"
      />
      Show Forecast in workspace menu
    </label>
  );
}

export function AuthenticationPending() {
  return (
    <p role="status" className="flex items-center gap-2 rounded-lg border border-slate-200 p-4 text-sm text-slate-600">
      <LoaderCircle size={16} className="animate-spin" /> Authenticating with the workspace…
    </p>
  );
}

export function AuthenticationError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
      <div className="flex items-start gap-2">
        <CircleAlert size={16} className="mt-0.5 shrink-0" /><p>{message}</p>
      </div>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry}>
        Retry authentication
      </Button>
    </div>
  );
}
