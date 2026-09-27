import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Bell, Download, Link2, Loader2, Megaphone, MousePointerClick, Pause, Pencil, Play, Plus, Rocket } from "lucide-react";
import { Banner, Feature, Launch, WaitlistEntry, announceLaunch, errorMessage, getWaitlist, saveFeatures } from "../lib/api";
import { PLACEMENT_LABEL, relativeTime, staffName } from "../lib/catalog";
import {
  LaunchItem,
  ROLLOUT_STEPS,
  featureForRoute,
  formatWhen,
  headlineText,
  launchItems,
  launchPill,
  resumed,
  withState
} from "../lib/launch";
import { isConflict, useCms } from "../lib/store";
import { PageHeader, useToast } from "../components/ui";

const DAY = 24 * 60 * 60 * 1000;
const RECENT_DAYS = 14;

const ageMs = (iso: string | null) => (iso ? Date.now() - new Date(iso).getTime() : 0);

/** Live banners and link tiles that open this feature's screen. */
const linksTo = (feature: Feature | undefined, banners: Banner[], tiles: { enabled: boolean; action: Banner["action"] }[]) => {
  if (!feature) return 0;
  const opens = (a: Banner["action"]) => a.type === "route" && featureForRoute([feature], a.value) !== undefined;
  return banners.filter((b) => b.status === "live" && opens(b.action)).length + tiles.filter((t) => t.enabled && opens(t.action)).length;
};

/** §5.4 warnings for one item. */
const warningsFor = (item: LaunchItem, linked: number): string[] => {
  const l = item.launch;
  const out: string[] = [];
  if (linked > 0 && l.state !== "live") out.push(`${linked} live banner${linked === 1 ? "" : "s"} or link tile${linked === 1 ? "" : "s"} open this screen`);
  if ((l.state === "coming_soon" || l.state === "rolling_out") && l.soon.goLiveAt && new Date(l.soon.goLiveAt).getTime() < Date.now()) {
    out.push("The go-live time has passed but it isn't live yet");
  }
  if (l.state === "paused" && ageMs(l.since) > 2 * DAY) out.push(`Paused for ${Math.floor(ageMs(l.since) / DAY)} days`);
  if (l.state === "rolling_out" && ageMs(l.since) > 30 * DAY) out.push("Rolling out for over 30 days — launch it or roll it back?");
  if (!item.enabled) out.push("Hidden with the Show switch, so nobody sees it");
  return out;
};

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

const downloadCsv = (title: string, entries: WaitlistEntry[]) => {
  const rows = [
    ["joined", "name", "email", "phone", "platform"],
    ...entries.map((e) => [
      new Date(e.createdAt).toISOString(),
      e.user ? [e.user.firstName, e.user.lastName].filter(Boolean).join(" ") : "(signed out)",
      e.user?.email ?? "",
      e.user?.phone ?? "",
      e.platform ?? ""
    ])
  ];
  const blob = new Blob([rows.map((r) => r.map(csvCell).join(",")).join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-waitlist.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export const LaunchesPage: React.FC = () => {
  const { config, banners, launchStats, canManage, applySaved, reload, reloadStats } = useCms();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [pauseKey, setPauseKey] = useState("");
  /** The item whose "It's here" push is being written, and its draft. */
  const [announcing, setAnnouncing] = useState<{ itemKey: string; title: string; body: string } | null>(null);
  const c = config!;

  const items = useMemo(() => launchItems(c.features, c.customTiles), [c]);
  const featureByKey = useMemo(() => new Map(c.features.map((f) => [f.key, f])), [c]);
  const groups = {
    coming_soon: items.filter((i) => i.launch.state === "coming_soon"),
    rolling_out: items.filter((i) => i.launch.state === "rolling_out"),
    paused: items.filter((i) => i.launch.state === "paused"),
    // Also any live item whose waitlist still has people to tell (e.g. sign-ups that got an account later).
    recent: items.filter(
      (i) =>
        i.launch.state === "live" &&
        ((i.launch.since && ageMs(i.launch.since) < RECENT_DAYS * DAY) || (launchStats[i.itemKey]?.toNotify ?? 0) > 0)
    )
  };
  const liveItems = items.filter((i) => i.launch.state === "live" && i.enabled);

  const startAnnouncing = (item: LaunchItem) =>
    setAnnouncing({
      itemKey: item.itemKey,
      title: `It’s here: ${item.title}`.slice(0, 100),
      body: "You asked us to tell you when it’s ready. Tap to try it now."
    });

  const sendAnnouncement = async () => {
    if (!announcing) return;
    const n = launchStats[announcing.itemKey]?.toNotify ?? 0;
    if (!window.confirm(`Send this push to ${n.toLocaleString()} ${n === 1 ? "person" : "people"}? It can't be unsent.`)) return;
    setBusy(`announce:${announcing.itemKey}`);
    try {
      const r = await announceLaunch(announcing.itemKey, { title: announcing.title.trim(), body: announcing.body.trim() });
      toast(
        "success",
        `Telling ${r.recipients.toLocaleString()} ${r.recipients === 1 ? "person" : "people"} (${r.withPush.toLocaleString()} with push on; everyone gets it in their app inbox).` +
          (r.remaining ? ` ${r.remaining.toLocaleString()} more to go — send again for the rest.` : "")
      );
      setAnnouncing(null);
      await reloadStats();
    } catch (err) {
      toast("error", errorMessage(err, "Couldn't send the announcement."));
    } finally {
      setBusy(null);
    }
  };

  /** Publish one item's new launch straight away (a normal features save of the whole list). */
  const publish = async (item: LaunchItem, next: Launch, question: string, done: string) => {
    if (!window.confirm(question)) return;
    setBusy(item.itemKey);
    try {
      const features = c.features.map((f) => (f.key === item.itemKey ? { ...f, launch: next } : f));
      const tiles = c.customTiles.map((t) => (`link:${t.id}` === item.itemKey ? { ...t, launch: next } : t));
      applySaved(await saveFeatures(c.sectionVersions.features, features, tiles));
      toast("success", `${done} The app picks it up on its next refresh.`);
      // Just launched with people waiting: offer the "It's here" push right away.
      if (next.state === "live" && item.launch.state !== "live" && (launchStats[item.itemKey]?.toNotify ?? 0) > 0) startAnnouncing(item);
    } catch (err) {
      if (isConflict(err)) {
        toast("error", errorMessage(err));
        await reload();
      } else toast("error", errorMessage(err, "Couldn't publish."));
    } finally {
      setBusy(null);
    }
  };

  const exportWaitlist = async (item: LaunchItem) => {
    setBusy(`csv:${item.itemKey}`);
    try {
      const { entries } = await getWaitlist(item.itemKey);
      if (entries.length === 0) toast("error", "Nobody has joined this waitlist yet.");
      else downloadCsv(item.title, entries);
    } catch (err) {
      toast("error", errorMessage(err, "Couldn't download the waitlist."));
    } finally {
      setBusy(null);
    }
  };

  const actions = (item: LaunchItem) => {
    const l = item.launch;
    const t = item.title;
    const launch = (
      <button
        type="button"
        className="btn btn-primary sm"
        disabled={item.teaser}
        title={item.teaser ? "Give it a tap action in Screens & features first" : undefined}
        onClick={() => publish(item, withState(l, "live"), `Launch “${t}” to everyone in its audience?`, `${t} is live.`)}
      >
        <Rocket size={14} /> Launch
      </button>
    );
    const pause = (
      <button
        type="button"
        className="btn btn-ghost sm"
        onClick={() => publish(item, withState(l, "paused"), `Pause “${t}”? People see a “Taking a short break” sheet until you resume it.`, `${t} is paused.`)}
      >
        <Pause size={14} /> Pause
      </button>
    );
    switch (l.state) {
      case "coming_soon":
        return (
          <>
            <button
              type="button"
              className="btn btn-ghost sm"
              disabled={item.teaser}
              title={item.teaser ? "Give it a tap action in Screens & features first" : undefined}
              onClick={() => publish(item, withState(l, "rolling_out"), `Start rolling out “${t}” to ${l.rollout.percent}% of users?`, `${t} is rolling out.`)}
            >
              <Play size={14} /> Start rollout ({l.rollout.percent}%)
            </button>
            {launch}
          </>
        );
      case "rolling_out":
        return (
          <>
            <div className="segmented" role="group" aria-label="Rollout percentage">
              {ROLLOUT_STEPS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={l.rollout.percent === p ? "is-active" : ""}
                  onClick={() =>
                    p !== l.rollout.percent &&
                    publish(
                      item,
                      { ...l, rollout: { ...l.rollout, percent: p } },
                      p < l.rollout.percent
                        ? `Lower “${t}” from ${l.rollout.percent}% to ${p}%? Some people who have it now will lose access.`
                        : `Raise “${t}” from ${l.rollout.percent}% to ${p}%?`,
                      `${t} is at ${p}%.`
                    )
                  }
                >
                  {p}%
                </button>
              ))}
            </div>
            {pause}
            {launch}
          </>
        );
      case "paused":
        return (
          <button
            type="button"
            className="btn btn-primary sm"
            onClick={() =>
              publish(item, resumed(l), `Resume “${t}”? It goes back to ${l.resumeTo === "rolling_out" ? `rolling out (${l.rollout.percent}%)` : "Live"}.`, `${t} is back.`)
            }
          >
            <Play size={14} /> Resume
          </button>
        );
      default:
        return (
          <>
            {(launchStats[item.itemKey]?.toNotify ?? 0) > 0 && announcing?.itemKey !== item.itemKey && (
              <button type="button" className="btn btn-primary sm" onClick={() => startAnnouncing(item)}>
                <Megaphone size={14} /> Tell {launchStats[item.itemKey].toNotify.toLocaleString()} it’s here
              </button>
            )}
            {pause}
          </>
        );
    }
  };

  const meta = (item: LaunchItem) => {
    const l = item.launch;
    const parts: React.ReactNode[] = [PLACEMENT_LABEL[item.placement]];
    if (l.state === "coming_soon") parts.push(headlineText(l), l.soon.goLiveAt ? `Goes live ${formatWhen(l.soon.goLiveAt)}` : "No date set");
    if (l.state === "rolling_out") {
      parts.push(`Everyone else ${l.rollout.othersSee === "hidden" ? "sees nothing" : "sees Coming soon"}`);
      if (l.soon.goLiveAt) parts.push(`Goes live ${formatWhen(l.soon.goLiveAt)}`);
    }
    if (l.state === "paused" && l.paused.resumeAt) parts.push(`Resumes ${formatWhen(l.paused.resumeAt)}`);
    if (l.since) parts.push(l.state === "live" ? `Launched ${relativeTime(l.since)}` : `Since ${relativeTime(l.since)}`);
    if (l.testers.length) parts.push(`${l.testers.length} tester${l.testers.length === 1 ? "" : "s"}`);
    return parts;
  };

  const renderItem = (item: LaunchItem) => {
    const pill = launchPill(item.launch);
    const stats = launchStats[item.itemKey];
    const warnings = warningsFor(item, linksTo(featureByKey.get(item.itemKey), banners, c.customTiles));
    const working = busy === item.itemKey;
    return (
      <li key={item.itemKey} className="launch-item">
        <div className="launch-item-main">
          <div className="launch-item-title">
            <strong>
              {item.kind === "link" && <Link2 size={12} className="kind-icon" />}
              {item.title}
              {pill && <em className={`pill launch-pill ${pill.cls}`}>{pill.text}</em>}
            </strong>
            <span className="muted small">{meta(item).map((p, i) => <React.Fragment key={i}>{i > 0 && " · "}{p}</React.Fragment>)}</span>
            {stats && (stats.waiting > 0 || stats.lockedTaps > 0) && (
              <span className="muted small launch-stats">
                <Bell size={11} /> {stats.waiting.toLocaleString()} waiting · <MousePointerClick size={11} /> {stats.lockedTaps.toLocaleString()} locked taps
                {stats.lastNotifiedAt && ` · told ${relativeTime(stats.lastNotifiedAt)}`}
              </span>
            )}
            {item.teaser && <span className="muted small">Teaser: no tap action yet, so it can't launch.</span>}
            {warnings.map((w) => (
              <span key={w} className="small warn launch-warning">
                <AlertTriangle size={12} /> {w}
              </span>
            ))}
          </div>
          <div className="launch-item-actions">
            {working && <Loader2 size={15} className="spin" />}
            {canManage && !busy && actions(item)}
            {canManage && stats?.waiting ? (
              <button type="button" className="link-btn" disabled={Boolean(busy)} onClick={() => exportWaitlist(item)}>
                <Download size={12} /> Waitlist CSV
              </button>
            ) : null}
            {item.rowId && (
              <Link className="link-btn" to={`/features?open=${encodeURIComponent(item.rowId)}`}>
                <Pencil size={12} /> Edit
              </Link>
            )}
          </div>
        </div>
        {announcing?.itemKey === item.itemKey && stats && (
          <div className="announce">
            <p className="launch-sub">
              <Megaphone size={13} /> Tell the waitlist it’s here
            </p>
            <label className="field">
              <span>Title</span>
              <input value={announcing.title} maxLength={100} onChange={(e) => setAnnouncing({ ...announcing, title: e.target.value })} />
            </label>
            <label className="field">
              <span>Message</span>
              <textarea rows={2} value={announcing.body} maxLength={500} onChange={(e) => setAnnouncing({ ...announcing, body: e.target.value })} />
            </label>
            <small className="muted">
              Goes to {stats.toNotify.toLocaleString()} {stats.toNotify === 1 ? "person" : "people"} with an account, as a push and in their app inbox, and
              opens {item.route || item.kind === "link" ? "the feature" : "the app"}.
              {stats.deviceOnly > 0 &&
                ` ${stats.deviceOnly.toLocaleString()} signed-out sign-up${stats.deviceOnly === 1 ? "" : "s"} can't get a push; they'll see it live in the app.`}
            </small>
            <div className="toolbar">
              <button
                type="button"
                className="btn btn-primary sm"
                disabled={Boolean(busy) || !announcing.title.trim() || !announcing.body.trim()}
                onClick={sendAnnouncement}
              >
                <Megaphone size={14} /> Send to {stats.toNotify.toLocaleString()}
              </button>
              <button type="button" className="btn btn-ghost sm" onClick={() => setAnnouncing(null)}>
                Not now
              </button>
            </div>
          </div>
        )}
      </li>
    );
  };

  const section = (title: string, list: LaunchItem[], empty: string) => (
    <section className="card">
      <div className="card-title-row">
        <h2 className="card-title">
          {title} <span className="muted">({list.length})</span>
        </h2>
      </div>
      {list.length ? <ul className="launch-list">{list.map(renderItem)}</ul> : <p className="muted small">{empty}</p>}
    </section>
  );

  const pausing = liveItems.find((i) => i.itemKey === pauseKey);

  return (
    <div className="page">
      <PageHeader
        eyebrow="What's coming, rolling out or paused"
        title="Launches"
        actions={
          <Link to="/features" className="btn btn-ghost">
            <Plus size={15} /> Tease a feature
          </Link>
        }
      >
        Every feature and link tile that isn't plainly live. Quick actions here publish straight away; open an item in Screens &
        features to change its message, testers or schedule.
        {c.updatedAt && ` Last change ${relativeTime(c.updatedAt)} by ${staffName(c.updatedBy)}.`}
      </PageHeader>

      {section("Coming soon", groups.coming_soon, "Nothing teased right now. Open a feature in Screens & features and pick Coming soon.")}
      {section("Rolling out", groups.rolling_out, "No rollouts in progress.")}
      {section("Paused", groups.paused, "Nothing paused.")}
      {section(`Recently launched (last ${RECENT_DAYS} days)`, groups.recent, "Nothing launched in the last two weeks.")}

      {canManage && (
        <section className="card">
          <h2 className="card-title">Pause a live feature</h2>
          <p className="muted small">For incidents: the tile stays, and a tap tells people it's taking a short break.</p>
          <div className="toolbar launch-pause">
            <select value={pauseKey} onChange={(e) => setPauseKey(e.target.value)} aria-label="Feature to pause">
              <option value="">Pick a feature…</option>
              {liveItems.map((i) => (
                <option key={i.itemKey} value={i.itemKey}>
                  {i.title} — {PLACEMENT_LABEL[i.placement]}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={!pausing || Boolean(busy)}
              onClick={() =>
                pausing &&
                publish(pausing, withState(pausing.launch, "paused"), `Pause “${pausing.title}”? People see a “Taking a short break” sheet until you resume it.`, `${pausing.title} is paused.`).then(() =>
                  setPauseKey("")
                )
              }
            >
              <Pause size={15} /> Pause
            </button>
          </div>
        </section>
      )}
    </div>
  );
};
