import { ArrowLeft, ArrowRight, CalendarDays, Fingerprint } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export type ForecastRow = { day: string; orders: number };

function OrderChart({ rows }: { rows: ForecastRow[] }) {
  const highest = Math.max(1, ...rows.map(row => row.orders));
  return (
    <figure aria-label="Expected orders by day" className="flex h-28 gap-1.5 sm:gap-3">
      {rows.map(row => (
        <div key={row.day} className="flex min-w-0 flex-1 flex-col items-center">
          <div className="flex w-full flex-1 items-end justify-center border-b border-slate-200">
            <div
              title={row.day + ": " + row.orders + " orders"}
              className="w-full max-w-12 rounded-t-sm bg-emerald-600"
              style={{ height: (row.orders / highest * 100) + "%" }}
            />
          </div>
          <span className="mt-1.5 text-[10px] text-slate-600 sm:text-xs">{row.day.slice(0, 3)}</span>
        </div>
      ))}
      <figcaption className="sr-only">{rows.map(row => row.day + " " + row.orders + " orders").join(", ")}</figcaption>
    </figure>
  );
}

function ForecastOverview({ rows }: { rows: ForecastRow[] }) {
  const total = rows.reduce((sum, row) => sum + row.orders, 0);
  const peak = rows.reduce<ForecastRow | undefined>((top, row) => !top || row.orders > top.orders ? row : top, undefined);
  return (
    <Card className="gap-0 rounded-lg border-slate-200 p-4 shadow-none sm:p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-600">Expected orders</p>
          <div className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">{total.toLocaleString("en-US")}</div>
        </div>
        <Badge variant="outline" className="bg-slate-50 font-medium text-slate-600">
          <CalendarDays size={12} />{rows.length}-day outlook
        </Badge>
      </div>
      <OrderChart rows={rows} />
      {peak && (
        <p className="mt-4 text-xs text-slate-600">
          {peak.day} has the highest forecast at <strong className="font-semibold text-slate-800">{peak.orders} orders</strong>.
        </p>
      )}
    </Card>
  );
}

function ForecastTable({ rows }: { rows: ForecastRow[] }) {
  return (
    <Card className="block gap-0 overflow-hidden rounded-lg p-0 shadow-none">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Forecast daily order counts</caption>
        <thead>
          <tr className="bg-slate-50 text-left text-xs text-slate-600">
            <th scope="col" className="px-4 py-2 font-medium">Day</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Expected orders</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.day} className="border-t border-slate-100">
              <th scope="row" className="px-4 py-1.5 text-left font-normal">{row.day}</th>
              <td className="px-4 py-1.5 text-right font-medium tabular-nums">{row.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

type ForecastViewProps = {
  rows: ForecastRow[];
  actor: string;
  scope: string;
  detailed: boolean;
  onNavigate: (path: string) => void;
};

export function ForecastView({ rows, actor, scope, detailed, onNavigate }: ForecastViewProps) {
  return (
    <>
      {detailed ? <ForecastTable rows={rows} /> : <ForecastOverview rows={rows} />}
      <div className="mt-3 flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={() => onNavigate(detailed ? "/overview" : "/forecast")}>
          {detailed ? <><ArrowLeft size={13} />Back to overview</> : <>View forecast<ArrowRight size={13} /></>}
        </Button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-600">
        <Fingerprint size={14} className="text-emerald-700" />
        <span>Authenticated as <strong className="font-medium text-slate-800">{actor}</strong></span>
        <code className="rounded bg-slate-100 px-1.5 py-0.5">{scope}</code>
        <button type="button" className="font-medium text-emerald-700 underline underline-offset-2" onClick={() => onNavigate("/authentication")}>
          Inspect authentication
        </button>
      </div>
    </>
  );
}
