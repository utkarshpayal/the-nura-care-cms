import React, { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Megaphone } from "lucide-react";
import { HomeSection, errorMessage, saveHomeSections } from "../lib/api";
import { resolvePalette } from "../lib/catalog";
import { isConflict, useCms } from "../lib/store";
import { HomeScreen, PhoneFrame, liveBannersIn } from "../components/AppPreview";
import { PageHeader, SaveBar, Segmented, Switch, useToast } from "../components/ui";

const SECTION_HELP: Record<string, string> = {
  statPills: "Streak and points counters under the greeting.",
  weekStrip: "This week's days with the cycle day marker.",
  promo_top: "Shows live banners placed in “Home — top slot”.",
  phaseHero: "The big cycle-phase card.",
  quickActions: "Log period / symptoms / mood buttons.",
  shortcuts: "Features and link tiles you placed on Home (Features page). Hidden while empty.",
  promo_middle: "Shows live banners placed in “Home — middle slot”.",
  insights: "Cycle health and length trend carousel.",
  moreForYou: "Entry cards for the three hubs (a hub with no visible features is skipped)."
};

const sameOrder = (a: HomeSection[], b: HomeSection[]) =>
  a.map((s) => `${s.key}:${s.visible}`).join() === b.map((s) => `${s.key}:${s.visible}`).join();

export const HomeLayoutPage: React.FC = () => {
  const { config, banners, canManage, applySaved, reload } = useCms();
  const toast = useToast();
  const [draft, setDraft] = useState<HomeSection[]>(config!.homeSections);
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(config!.homeSections), [config]);

  const dirty = !sameOrder(draft, config!.homeSections);
  const palette = useMemo(() => resolvePalette(mode, config!.theme), [mode, config]);

  const move = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      const j = i + dir;
      if (j < 0 || j >= d.length) return d;
      const next = [...d];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const handleSave = async () => {
    setSaving(true);
    try {
      applySaved(await saveHomeSections(config!.sectionVersions.homeSections, draft));
      toast("success", "Home layout published.");
    } catch (err) {
      if (isConflict(err)) {
        toast("error", errorMessage(err));
        await reload();
      } else toast("error", errorMessage(err, "Couldn't save the home layout."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <PageHeader eyebrow="Home screen" title="Home layout">
        Reorder or hide the blocks on the app's Home screen. The two promo slots show whatever banners you place there.
      </PageHeader>

      <div className="with-preview">
        <section className="card">
          <ol className="section-list">
            {draft.map((s, i) => {
              const promo = s.key.startsWith("promo_");
              const liveCount = promo ? liveBannersIn(banners, s.key === "promo_top" ? "home_top" : "home_middle").length : 0;
              return (
                <li key={s.key} className={`section-row ${s.visible ? "" : "is-hidden"}`}>
                  <span className="section-num">{i + 1}</span>
                  <div className="section-text">
                    <strong>
                      {promo && <Megaphone size={13} />} {s.label}
                    </strong>
                    <span>
                      {SECTION_HELP[s.key]}
                      {promo && ` ${liveCount} live now.`}
                    </span>
                  </div>
                  <div className="order-btns horizontal">
                    <button type="button" className="icon-btn sm" aria-label={`Move ${s.label} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp size={13} />
                    </button>
                    <button type="button" className="icon-btn sm" aria-label={`Move ${s.label} down`} disabled={i === draft.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown size={13} />
                    </button>
                  </div>
                  <Switch
                    checked={s.visible}
                    label={`Show ${s.label}`}
                    hideLabel
                    onChange={(v) => setDraft((d) => d.map((x) => (x.key === s.key ? { ...x, visible: v } : x)))}
                  />
                </li>
              );
            })}
          </ol>
        </section>

        <aside className="preview-col">
          <div className="preview-controls">
            <Segmented label="Preview mode" value={mode} onChange={setMode} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
          </div>
          <PhoneFrame palette={palette}>
            <HomeScreen sections={draft} features={config!.features} links={config!.customTiles} banners={banners} palette={palette} mode={mode} />
          </PhoneFrame>
        </aside>
      </div>

      <SaveBar dirty={dirty} saving={saving} canManage={canManage} onSave={handleSave} onDiscard={() => setDraft(config!.homeSections)} />
    </div>
  );
};
