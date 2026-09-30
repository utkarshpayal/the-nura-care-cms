import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownUp, BarChart3, MousePointerClick, Smartphone } from "lucide-react";
import { UsageRange, UsageReport, errorMessage, getUsage } from "../lib/api";
import { PLACEMENT_LABEL } from "../lib/catalog";
import { launchItems } from "../lib/launch";
import { useCms } from "../lib/store";
import { ErrorState, Loading, PageHeader, Segmented } from "../components/ui";

type SortKey = "title" | "opens" | "taps" | "devices";

const fmt = (n: number) => n.toLocaleString();
const shortDay = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });

/** A clean top for the y-axis: 1, 2 or 5 × a power of ten, at or above `max`. */
const niceMax = (max: number) => {
  if (max <= 5) return 5;
  const p = 10 ** Math.floor(Math.log10(max));
  return [1, 2, 5, 10].map((m) => m * p).find((v) => v >= max)!;
};

/** Opens per day, all features: one series, so no legend; each column has its own tooltip. */
const DailyColumns: React.FC<{ days: string[]; values: number[] }> = ({ days, values }) => {
  const [hover, setHover] = useState<number | null>(null);
  const top = niceMax(Math.max(0, ...values));
  return (
    <div className="usage-chart" role="img" aria-label={`App-wide feature opens per day, ${shortDay(days[0])} to ${shortDay(days[days.length - 1])}`}>
      <div className="usage-axis" aria-hidden>
        <span>{fmt(top)}</span>
        <span>{fmt(top / 2)}</span>
        <span>0</span>
      </div>
      <div className="usage-plot" onPointerLeave={() => setHover(null)}>
        <div className="usage-grid" aria-hidden>
          <i />
          <i />
          <i />
        </div>
        {values.map((v, i) => (
          <button
            key={days[i]}
            type="button"
            className={`usage-col ${hover === i ? "is-hover" : ""}`}
            aria-label={`${shortDay(days[i])}: ${fmt(v)} opens`}
            onPointerEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
          >
            <span style={{ height: `${(v / top) * 100}%` }} />
          </button>
        ))}
        {hover !== null && (
          <div className="usage-tip" style={{ left: `${((hover + 0.5) / values.length) * 100}%` }}>
            <strong>{fmt(values[hover])}</strong>
            <span>opens · {shortDay(days[hover])}</span>
          </div>
        )}
      </div>
      <div className="usage-x" aria-hidden>
        <span>{shortDay(days[0])}</span>
        <span>{shortDay(days[days.length - 1])}</span>
      </div>
    </div>
  );
};

/** Daily opens for one item as a 2px line; the table cell next to it carries the numbers. */
const Sparkline: React.FC<{ values: number[] }> = ({ values }) => {
  const max = Math.max(1, ...values);
  const w = 96;
  const h = 24;
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(h - 2 - (v / max) * (h - 4)).toFixed(1)}`).join(" ");
  return (
    <svg className="sparkline" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <polyline points={points} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

export const UsagePage: React.FC = () => {
  const { config } = useCms();
  const [range, setRange] = useState<UsageRange>(30);
  const [report, setReport] = useState<UsageReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "opens", desc: true });

  const load = useCallback(async () => {
    setError(null);
    try {
      setReport(await getUsage(range));
    } catch (err) {
      setError(errorMessage(err, "Couldn't load usage."));
    }
  }, [range]);

  useEffect(() => {
    setReport(null);
    load();
  }, [load]);

  const rows = useMemo(() => {
    if (!report) return [];
    const empty = { opens: 0, taps: 0, devices: 0, daily: report.days.map(() => ({ opens: 0, taps: 0 })) };
    const list = launchItems(config!.features, config!.customTiles)
      .filter((i) => i.rowId)
      .map((i) => ({ ...i, usage: report.items[i.itemKey] ?? empty }));
    const dir = sort.desc ? -1 : 1;
    return list.sort((a, b) =>
      sort.key === "title" ? dir * a.title.localeCompare(b.title) : dir * (a.usage[sort.key] - b.usage[sort.key]) || a.title.localeCompare(b.title)
    );
  }, [report, config, sort]);

  const totals = useMemo(() => {
    const items = Object.values(report?.items ?? {});
    const daily = (report?.days ?? []).map((_, i) => items.reduce((sum, it) => sum + it.daily[i].opens, 0));
    return { opens: items.reduce((s, i) => s + i.opens, 0), taps: items.reduce((s, i) => s + i.taps, 0), daily };
  }, [report]);
  const top = [...rows].sort((a, b) => b.usage.opens - a.usage.opens)[0];

  const header = (key: SortKey, label: string, numeric = true) => (
    <th scope="col" className={numeric ? "num" : undefined} aria-sort={sort.key === key ? (sort.desc ? "descending" : "ascending") : "none"}>
      <button type="button" className="th-sort" onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : key !== "title" }))}>
        {label} <ArrowDownUp size={11} />
      </button>
    </th>
  );

  return (
    <div className="page">
      <PageHeader
        eyebrow="Insights"
        title="Feature usage"
        actions={<Segmented label="Range" value={String(range)} onChange={(v) => setRange(Number(v) as UsageRange)} options={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }, { value: "90", label: "90 days" }]} />}
      >
        How often each feature is used. An open is a visit to its screen, however it was reached (a tile, a banner, a notification). A tap is a tap on its tile.
        Devices are distinct app installs. Days are UTC.
      </PageHeader>

      {error ? (
        <ErrorState text={error} onRetry={load} />
      ) : !report ? (
        <Loading text="Loading usage…" />
      ) : (
        <>
          <div className="stat-grid usage-stats">
            <div className="card stat-card">
              <span className="stat-icon">
                <BarChart3 size={17} />
              </span>
              <span className="stat-title">Opens</span>
              <strong>{fmt(totals.opens)}</strong>
            </div>
            <div className="card stat-card">
              <span className="stat-icon">
                <MousePointerClick size={17} />
              </span>
              <span className="stat-title">Tile taps</span>
              <strong>{fmt(totals.taps)}</strong>
            </div>
            <div className="card stat-card">
              <span className="stat-icon">
                <Smartphone size={17} />
              </span>
              <span className="stat-title">Most used</span>
              <strong>{top && top.usage.opens > 0 ? top.title : "—"}</strong>
            </div>
          </div>

          <section className="card">
            <h2 className="card-title">Opens per day, all features</h2>
            {totals.opens === 0 ? (
              <p className="muted">No usage recorded in this range yet. App builds from before usage tracking don't report it.</p>
            ) : (
              <DailyColumns days={report.days} values={totals.daily} />
            )}
          </section>

          <section className="card">
            <h2 className="card-title">By feature</h2>
            <div className="table-scroll">
              <table className="usage-table">
                <thead>
                  <tr>
                    {header("title", "Feature", false)}
                    {header("opens", "Opens")}
                    {header("taps", "Tile taps")}
                    {header("devices", "Devices")}
                    <th scope="col">Trend (opens)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.itemKey} className={r.enabled ? undefined : "is-muted"}>
                      <th scope="row">
                        <strong>{r.title}</strong>
                        <span className="muted small">
                          {r.kind === "link" ? "Link tile · " : ""}
                          {PLACEMENT_LABEL[r.placement]}
                          {!r.enabled && " · hidden"}
                          {r.launch.state !== "live" && ` · ${r.launch.state.replace("_", " ")}`}
                        </span>
                      </th>
                      <td className="num">{fmt(r.usage.opens)}</td>
                      <td className="num">{fmt(r.usage.taps)}</td>
                      <td className="num">{fmt(r.usage.devices)}</td>
                      <td>{r.usage.opens > 0 ? <Sparkline values={r.usage.daily.map((d) => d.opens)} /> : <span className="muted small">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted small">Link tiles that open a website or another app only count taps: their screen isn't in the app.</p>
          </section>
        </>
      )}
    </div>
  );
};
