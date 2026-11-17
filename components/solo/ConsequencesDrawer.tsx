"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/**
 * V3-C5 — Le tiroir de conséquences : « rend visible ce que le monde vient
 * d'écrire, sans interrompre le jeu » (docs/BACKLOG_V3.md). Un bandeau
 * discret, replié par défaut — jamais un bloqueur, jamais rouvert tout seul.
 *
 * **V3-F2 : « Annuler le dernier tour ».** Un geste en deux temps (demander,
 * puis confirmer), une requête : le serveur défait le tour entier (fiches nées
 * automatiquement, découvertes, état du personnage et scène d'avant), écrit
 * l'annulation au journal sans rien effacer, puis l'écran se relit.
 */

export interface ConsequenceEntryView {
  id: string;
  kind: string;
  text: string;
  targetName: string | null;
}

export interface ConsequencesDrawerData {
  pending: ConsequenceEntryView[];
  applied: ConsequenceEntryView[];
  tally: { entities: number; blocks: number; relations: number };
}

function tallyLine(tally: ConsequencesDrawerData["tally"]): string | null {
  const parts: string[] = [];
  if (tally.entities > 0) parts.push(`${tally.entities} fiche${tally.entities > 1 ? "s" : ""}`);
  if (tally.blocks > 0) parts.push(`${tally.blocks} bloc${tally.blocks > 1 ? "s" : ""}`);
  if (tally.relations > 0) parts.push(`${tally.relations} relation${tally.relations > 1 ? "s" : ""}`);
  if (parts.length === 0) return null;
  return `Depuis le début de cette séance, le monde a gagné ${parts.join(", ")}.`;
}

function PendingEntry({ entry, onDone }: { entry: ConsequenceEntryView; onDone: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.text);
  const [busy, setBusy] = useState(false);

  async function accept() {
    setBusy(true);
    try {
      const edited = draft.trim();
      const res = await fetch(`/api/ai-proposals/${entry.id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edited !== entry.text ? { text: edited } : {}),
      });
      if (res.ok) onDone();
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    setBusy(true);
    try {
      const res = await fetch(`/api/ai-proposals/${entry.id}/reject`, { method: "POST" });
      if (res.ok) onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-edge p-2">
      {entry.targetName && <span className="text-xs font-medium text-ink-muted">{entry.targetName}</span>}
      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          className="w-full resize-none rounded-md border border-edge bg-panel-sunken px-2 py-1 text-sm text-ink"
        />
      ) : (
        <p className="text-sm text-ink-soft">{entry.text}</p>
      )}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => void accept()} disabled={busy} className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50">
          Accepter
        </button>
        <button type="button" onClick={() => setEditing((v) => !v)} disabled={busy} className="rounded-full border border-edge px-2.5 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50">
          {editing ? "annuler la modification" : "Modifier"}
        </button>
        <button type="button" onClick={() => void reject()} disabled={busy} className="rounded-full border border-edge px-2.5 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50">
          Rejeter
        </button>
      </div>
    </div>
  );
}

/** V3-F2 — annuler le dernier tour : demander, puis confirmer ; une seule requête. */
function AnnulerTour({ campaignId, onDone }: { campaignId: string; onDone: () => void }) {
  const t = useTranslations("solo.annulerTour");
  const [confirmer, setConfirmer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function annuler() {
    setBusy(true);
    setErreur(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/solo/annuler-tour`, { method: "POST" });
      const corps: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const message = corps && typeof corps === "object" && typeof (corps as { error?: unknown }).error === "string" ? (corps as { error: string }).error : t("erreur");
        setErreur(message);
        return;
      }
      setConfirmer(false);
      onDone();
    } catch (e) {
      console.error("Annulation du tour en échec", e);
      setErreur(t("erreur"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {confirmer ? (
        <>
          <span className="text-xs text-ink-soft">{t("question")}</span>
          <button type="button" onClick={() => void annuler()} disabled={busy} className="min-h-11 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50 sm:min-h-0">
            {t("confirmer")}
          </button>
          <button type="button" onClick={() => setConfirmer(false)} disabled={busy} className="min-h-11 rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50 sm:min-h-0">
            {t("garder")}
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setConfirmer(true)} className="min-h-11 rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised sm:min-h-0">
          {t("bouton")}
        </button>
      )}
      {erreur && (
        <span role="alert" className="text-xs text-danger">
          {erreur}
        </span>
      )}
    </div>
  );
}

export default function ConsequencesDrawer({
  data,
  onChanged,
  ouvertParDefaut = false,
  annulation = null,
}: {
  data: ConsequencesDrawerData | null;
  onChanged: () => void;
  /** V3.1-36 : dans la feuille du bas du téléphone, la liste est déjà ouverte — la feuille EST le geste d'ouvrir. */
  ouvertParDefaut?: boolean;
  /** V3-F2 : la campagne solo, quand un tour de la joueuse existe à annuler ; `null` : pas de geste. */
  annulation?: { campaignId: string } | null;
}) {
  const t = useTranslations("solo.annulerTour");
  const [open, setOpen] = useState(ouvertParDefaut);
  const vide = !data || (data.pending.length === 0 && data.applied.length === 0);
  if (vide && !annulation) return null;
  if (vide && annulation) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-edge bg-panel-sunken px-3 py-2">
        <span className="text-xs text-ink-muted">{t("aucunChangement")}</span>
        <AnnulerTour campaignId={annulation.campaignId} onDone={onChanged} />
      </div>
    );
  }
  if (!data) return null;

  const total = data.pending.length + data.applied.length;
  const line = tallyLine(data.tally);

  return (
    <div className="rounded-md border border-edge bg-panel-sunken px-3 py-2">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 text-left text-xs font-medium text-ink-muted">
        <span>
          {total} changement{total > 1 ? "s" : ""} dans le monde
        </span>
        <span>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-3 border-t border-edge pt-2">
          {data.pending.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">En attente de relecture</span>
              {data.pending.map((entry) => (
                <PendingEntry key={entry.id} entry={entry} onDone={onChanged} />
              ))}
            </div>
          )}
          {data.applied.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Déjà écrit dans le monde</span>
              {data.applied.map((entry) => (
                <div key={entry.id} className="rounded-md border border-edge p-2">
                  {entry.targetName && <span className="text-xs font-medium text-ink-muted">{entry.targetName}</span>}
                  <p className="text-sm text-ink-soft">{entry.text}</p>
                </div>
              ))}
            </div>
          )}
          {line && <p className="text-xs text-ink-muted">{line}</p>}
          {annulation && <AnnulerTour campaignId={annulation.campaignId} onDone={onChanged} />}
        </div>
      )}
    </div>
  );
}
