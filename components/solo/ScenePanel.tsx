"use client";

import { useState } from "react";
import Dropdown from "@/components/shared/Dropdown";
import Checkbox from "@/components/shared/Checkbox";
import type { SceneView } from "@/lib/solo/types";

/**
 * V3-B2 — Où l'on est, et qui est là.
 *
 * Le moteur tient la scène depuis V3-A4, mais rien ne la créait : ce
 * panneau est le plus petit écran qui la pose. Il est volontairement
 * manuel — le lot C fera entrer et sortir les PNJ tout seul, depuis les
 * générateurs et le wiki.
 *
 * L'heure vient du serveur et ne s'y modifie pas : elle avance parce que le
 * code la fait avancer, jamais parce qu'on la tape (ADR 0009, trou n° 1).
 */

const BTN_SECONDARY =
  "rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50";

const LIGHTING_LABELS: Record<SceneView["lighting"], string> = {
  bright: "plein jour",
  dim: "pénombre",
  dark: "obscurité",
};

const ZONE_LABELS: Record<SceneView["present"][number]["zone"], string> = {
  engaged: "au contact",
  near: "à portée",
  far: "au loin",
};

export default function ScenePanel({
  campaignId,
  scene,
  locations,
  candidates,
  onChanged,
}: {
  campaignId: string;
  scene: SceneView | null;
  locations: { id: string; name: string }[];
  candidates: { id: string; name: string }[];
  onChanged: (scene: SceneView) => void;
}) {
  const [open, setOpen] = useState(scene === null);
  const [locationId, setLocationId] = useState(scene?.locationId ?? locations[0]?.id ?? "");
  const [present, setPresent] = useState<string[]>(scene?.present.map((p) => p.entityId) ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (locationId === "") return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/solo/scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, locationId, present }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "La scène n'a pas pu être enregistrée.");
        return;
      }
      onChanged((await res.json()) as SceneView);
      setOpen(false);
    } catch {
      setError("Le serveur n'a pas répondu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-edge bg-panel p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Scène</span>
          {scene ? (
            <span className="text-sm text-ink">
              {scene.locationName}
              <span className="text-ink-muted">
                {" "}
                · jour {scene.time.day}, {String(scene.time.hour).padStart(2, "0")}h
                {String(scene.time.minute).padStart(2, "0")} · {LIGHTING_LABELS[scene.lighting]}
                {scene.inCombat ? " · combat en cours" : ""}
              </span>
            </span>
          ) : (
            <span className="text-sm text-ink-muted">Pas encore posée — sans elle, le temps n&apos;avance pas.</span>
          )}
        </div>
        <button type="button" className={BTN_SECONDARY} onClick={() => setOpen((v) => !v)} disabled={busy}>
          {open ? "fermer" : scene ? "changer" : "poser la scène"}
        </button>
      </div>

      {scene !== null && scene.present.length > 0 && !open && (
        <p className="text-sm text-ink-soft">
          {scene.present.map((p) => `${p.name} (${ZONE_LABELS[p.zone]})`).join(" · ")}
        </p>
      )}

      {open && (
        <div className="flex flex-col gap-3 border-t border-edge pt-3">
          {locations.length === 0 ? (
            <p className="text-sm text-ink-muted">
              Ce monde n&apos;a aucune fiche de lieu : la scène a besoin d&apos;un endroit où se tenir.
            </p>
          ) : (
            <Dropdown
              aria-label="Lieu de la scène"
              size="md"
              className="w-72"
              value={locationId}
              options={locations.map((l) => ({ value: l.id, label: l.name }))}
              onChange={setLocationId}
            />
          )}

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Présents</span>
            {candidates.length === 0 ? (
              <p className="text-sm text-ink-muted">Aucune fiche de personnage dans ce monde.</p>
            ) : (
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {candidates.map((c) => (
                  <Checkbox
                    key={c.id}
                    label={c.name}
                    checked={present.includes(c.id)}
                    onChange={() =>
                      setPresent((previous) =>
                        previous.includes(c.id) ? previous.filter((id) => id !== c.id) : [...previous, c.id],
                      )
                    }
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={BTN_SECONDARY} onClick={() => void save()} disabled={busy || locationId === ""}>
              {busy ? "…" : "enregistrer la scène"}
            </button>
            {error !== null && <span className="text-sm text-danger">{error}</span>}
          </div>
        </div>
      )}
    </section>
  );
}
