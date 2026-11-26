"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * V3.2-22 (ADR 0113) — L'onglet « Changements » du Monde : ce que le monde a
 * gagné pendant la séance, au même endroit.
 *
 * - « À relire » : une note que le moteur n'a pas pu écrire d'office (droit,
 *   conflit), qu'on accepte, modifie ou rejette comme avant (V3-C5).
 * - « Ajouté au monde » : ce que la séance a écrit. Une note du monde se
 *   corrige ou se retire ici : elle est écrite d'office, la personne qui
 *   joue répare après coup au lieu de tout valider.
 *
 * Il remplace le bandeau « N changements dans le monde » sous le fil, et lit
 * `/consequences` lui-même, seulement quand il est ouvert (docs/QUOTAS.md) :
 * à l'ouverture, toutes les 8 s ensuite, et après chaque geste.
 */

export interface ConsequenceEntryView {
  id: string;
  kind: string;
  text: string;
  targetName: string | null;
  fixable: boolean;
}

export interface ConsequencesData {
  pending: ConsequenceEntryView[];
  applied: ConsequenceEntryView[];
  tally: { entities: number; blocks: number; relations: number };
}

const SONDAGE_MS = 8000;
const NOTE_MAX = 400;

const BOUTON_PLEIN = "rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50";
const BOUTON_BORD = "rounded-full border border-edge px-2.5 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50";
const TITRE = "text-xs font-semibold uppercase tracking-wide text-ink-muted";

function tallyLine(tally: ConsequencesData["tally"]): string | null {
  const parts: string[] = [];
  if (tally.entities > 0) parts.push(`${tally.entities} fiche${tally.entities > 1 ? "s" : ""}`);
  if (tally.blocks > 0) parts.push(`${tally.blocks} bloc${tally.blocks > 1 ? "s" : ""}`);
  if (tally.relations > 0) parts.push(`${tally.relations} relation${tally.relations > 1 ? "s" : ""}`);
  if (parts.length === 0) return null;
  return `Depuis le début de cette séance, le monde a gagné ${parts.join(", ")}.`;
}

/** Une requête de geste ; `false` si le serveur a refusé (la raison est journalisée côté serveur). */
async function envoyer(url: string, corps?: unknown): Promise<boolean> {
  const res = await fetch(url, {
    method: "POST",
    ...(corps === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) }),
  });
  return res.ok;
}

/**
 * Une entrée : le texte, et ses gestes. `mode` dit lesquels : relecture
 * (accepter / modifier / rejeter) ou réparation (corriger / retirer).
 */
function Entree({ entry, mode, onDone }: { entry: ConsequenceEntryView; mode: "relire" | "reparer" | "lire"; onDone: () => void }) {
  const t = useTranslations("solo.changements");
  const [edition, setEdition] = useState(false);
  const [brouillon, setBrouillon] = useState(entry.text);
  const [retrait, setRetrait] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function geste(url: string, corps?: unknown) {
    setBusy(true);
    setErreur(null);
    try {
      if (await envoyer(url, corps)) {
        setEdition(false);
        setRetrait(false);
        onDone();
      } else {
        setErreur(t("erreur"));
      }
    } catch (e) {
      console.error("Geste sur un changement du monde en échec", e);
      setErreur(t("erreur"));
    } finally {
      setBusy(false);
    }
  }

  const texte = brouillon.trim();
  const base = `/api/ai-proposals/${entry.id}`;

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-edge p-2">
      {entry.targetName && <span className="text-xs font-medium text-ink-muted">{entry.targetName}</span>}
      {edition ? (
        <textarea
          value={brouillon}
          maxLength={NOTE_MAX}
          onChange={(e) => setBrouillon(e.target.value)}
          rows={3}
          className="w-full resize-none rounded-md border border-edge bg-panel-sunken px-2 py-1 text-sm text-ink outline-none focus:border-accent"
        />
      ) : (
        <p className="text-sm text-ink-soft">{entry.text}</p>
      )}
      {mode === "relire" && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={busy || texte === ""} onClick={() => void geste(`${base}/apply`, texte !== entry.text ? { text: texte } : {})} className={BOUTON_PLEIN}>
            {t("accepter")}
          </button>
          <button type="button" disabled={busy} onClick={() => setEdition((v) => !v)} className={BOUTON_BORD}>
            {edition ? t("annuler") : t("modifier")}
          </button>
          <button type="button" disabled={busy} onClick={() => void geste(`${base}/reject`)} className={BOUTON_BORD}>
            {t("rejeter")}
          </button>
        </div>
      )}
      {mode === "reparer" && (
        <div className="flex flex-wrap items-center gap-2">
          {edition ? (
            <>
              <button type="button" disabled={busy || texte === "" || texte === entry.text} onClick={() => void geste(`${base}/correct`, { text: texte })} className={BOUTON_PLEIN}>
                {t("enregistrer")}
              </button>
              <button type="button" disabled={busy} onClick={() => { setEdition(false); setBrouillon(entry.text); }} className={BOUTON_BORD}>
                {t("annuler")}
              </button>
            </>
          ) : retrait ? (
            <>
              <span className="text-xs text-ink-soft">{t("retirerQuestion")}</span>
              <button type="button" disabled={busy} onClick={() => void geste(`${base}/remove`)} className={BOUTON_PLEIN}>
                {t("retirer")}
              </button>
              <button type="button" disabled={busy} onClick={() => setRetrait(false)} className={BOUTON_BORD}>
                {t("annuler")}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setEdition(true)} className={BOUTON_BORD}>
                {t("corriger")}
              </button>
              <button type="button" onClick={() => setRetrait(true)} className={BOUTON_BORD}>
                {t("retirer")}
              </button>
            </>
          )}
        </div>
      )}
      {erreur && (
        <span role="alert" className="text-xs text-danger">
          {erreur}
        </span>
      )}
    </div>
  );
}

export default function OngletChangements({ campaignId }: { campaignId: string }) {
  const t = useTranslations("solo.changements");
  const [data, setData] = useState<ConsequencesData | null>(null);

  // Relire après un geste : `tic` change, l'effet relit tout de suite et repart pour 8 s.
  const [tic, setTic] = useState(0);
  const recharger = useCallback(() => setTic((n) => n + 1), []);

  useEffect(() => {
    let annule = false;
    async function lire() {
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/consequences`);
        if (res.ok && !annule) setData((await res.json()) as ConsequencesData);
      } catch (e) {
        // Le prochain tic réessaie ; l'onglet garde ce qu'il montrait.
        console.error("Lecture des changements du monde en échec", e);
      }
    }
    void lire();
    const intervalle = setInterval(() => void lire(), SONDAGE_MS);
    return () => {
      annule = true;
      clearInterval(intervalle);
    };
  }, [campaignId, tic]);

  if (data === null) return <p className="text-sm text-ink-muted">{t("chargement")}</p>;
  const ligne = tallyLine(data.tally);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-ink-muted">{t("explication")}</p>
      {data.pending.length > 0 && (
        <section className="flex flex-col gap-2" aria-label={t("aRelire")}>
          <h3 className={TITRE}>{t("aRelire")}</h3>
          {data.pending.map((entry) => (
            <Entree key={entry.id} entry={entry} mode="relire" onDone={recharger} />
          ))}
        </section>
      )}
      <section className="flex flex-col gap-2" aria-label={t("ajoutes")}>
        <h3 className={TITRE}>{t("ajoutes")}</h3>
        {data.applied.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("vide")}</p>
        ) : (
          data.applied.map((entry) => <Entree key={entry.id} entry={entry} mode={entry.fixable ? "reparer" : "lire"} onDone={recharger} />)
        )}
        {ligne && <p className="text-xs text-ink-muted">{ligne}</p>}
      </section>
    </div>
  );
}
