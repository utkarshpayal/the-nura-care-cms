import React, { useCallback, useEffect, useState } from "react";
import { History, Loader2, RotateCcw } from "lucide-react";
import { ConfigSection, Revision, errorMessage, listRevisions, restoreRevision } from "../lib/api";
import { relativeTime, staffName } from "../lib/catalog";
import { useCms } from "../lib/store";
import { ErrorState, Loading, PageHeader, Segmented, useToast } from "../components/ui";

const SECTION_LABEL: Record<ConfigSection, string> = {
  features: "Screens & features",
  homeSections: "Home layout",
  theme: "Theme",
  settings: "App settings"
};

/** A short, human summary of what a revision holds. */
const summarize = (r: Revision) => {
  const d = r.data as Record<string, any>;
  switch (r.section) {
    case "features": {
      const hidden = (d.features ?? []).filter((f: any) => f.enabled === false).length;
      const links = (d.customTiles ?? []).length;
      const all = [...(d.features ?? []), ...(d.customTiles ?? [])];
      const count = (state: string) => all.filter((f: any) => f.launch?.state === state).length;
      const launch = [["coming_soon", "coming soon"], ["rolling_out", "rolling out"], ["paused", "paused"]]
        .map(([k, label]) => (count(k) ? `${count(k)} ${label}` : null))
        .filter(Boolean);
      return [`${hidden} feature${hidden === 1 ? "" : "s"} hidden`, `${links} link tile${links === 1 ? "" : "s"}`, ...launch].join(" · ");
    }
    case "homeSections": {
      const hidden = (d.homeSections ?? []).filter((s: any) => s.visible === false).length;
      return hidden ? `${hidden} section${hidden === 1 ? "" : "s"} hidden` : "All sections visible";
    }
    case "theme": {
      const n = Object.keys(d.theme?.light ?? {}).length + Object.keys(d.theme?.dark ?? {}).length;
      return n ? `${n} colour${n === 1 ? "" : "s"} changed` : "App default colours";
    }
    case "settings": {
      const s = d.settings ?? {};
      const parts = [s.maintenance?.enabled ? "Maintenance ON" : "Maintenance off"];
      if (s.update?.minVersion) parts.push(`min v${s.update.minVersion}`);
      if (s.update?.latestVersion) parts.push(`latest v${s.update.latestVersion}`);
      return parts.join(" · ");
    }
    default:
      return "";
  }
};

export const HistoryPage: React.FC = () => {
  const { canManage, applySaved } = useCms();
  const toast = useToast();
  const [section, setSection] = useState<ConfigSection | "all">("all");
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRevisions((await listRevisions(section === "all" ? undefined : section)).revisions);
    } catch (err) {
      setError(errorMessage(err, "Couldn't load the history."));
    }
  }, [section]);

  useEffect(() => {
    setRevisions(null);
    load();
  }, [load]);

  // The newest revision of each section is what's live now.
  const current = new Set<string>();
  const seen = new Set<string>();
  for (const r of revisions ?? []) {
    if (!seen.has(r.section)) {
      seen.add(r.section);
      current.add(r._id);
    }
  }

  const restore = async (r: Revision) => {
    if (!window.confirm(`Restore ${SECTION_LABEL[r.section]} to how it was ${relativeTime(r.createdAt)}? This publishes it to the app now.`)) return;
    setBusy(r._id);
    try {
      applySaved(await restoreRevision(r._id));
      toast("success", `${SECTION_LABEL[r.section]} restored and published.`);
      await load();
    } catch (err) {
      toast("error", errorMessage(err, "Couldn't restore."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="page narrow">
      <PageHeader eyebrow="Safety net" title="History">
        Every publish is saved. Restore any earlier version of a section in one click; the restore itself is recorded too.
        The last 50 versions of each section are kept. Banners are edited individually, so they aren't versioned here.
      </PageHeader>

      <div className="toolbar">
        <Segmented
          label="Section"
          value={section}
          onChange={setSection}
          options={[{ value: "all", label: "All" }, ...(Object.keys(SECTION_LABEL) as ConfigSection[]).map((s) => ({ value: s, label: SECTION_LABEL[s] }))]}
        />
      </div>

      {error ? (
        <ErrorState text={error} onRetry={load} />
      ) : !revisions ? (
        <Loading text="Loading history…" />
      ) : revisions.length === 0 ? (
        <div className="card empty">
          <History size={22} />
          <p>Nothing published yet.</p>
        </div>
      ) : (
        <ol className="timeline">
          {revisions.map((r) => (
            <li key={r._id} className={`card timeline-item ${current.has(r._id) ? "is-current" : ""}`}>
              <div className="timeline-main">
                <div className="timeline-top">
                  <span className="pill pill-scheduled">{SECTION_LABEL[r.section]}</span>
                  {current.has(r._id) && <span className="pill pill-live">Live now</span>}
                  <span className="muted small" title={new Date(r.createdAt).toLocaleString()}>
                    {relativeTime(r.createdAt)} · {staffName(r.createdBy)}
                  </span>
                </div>
                <strong>{summarize(r)}</strong>
                {r.note && <span className="muted small">{r.note}</span>}
              </div>
              {canManage && !current.has(r._id) && (
                <button type="button" className="btn btn-ghost" onClick={() => restore(r)} disabled={busy !== null}>
                  {busy === r._id ? <Loader2 size={15} className="spin" /> : <RotateCcw size={15} />} Restore
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};
