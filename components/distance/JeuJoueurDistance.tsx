"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import FilADistance from "./FilADistance";
import { useTableADistanceContexte } from "./TableADistanceContexte";

/**
 * Le jeu à distance, côté joueur (variante 2, choisie le 23 nov.) : le fil au
 * centre, et une saisie qui reste libre — la demande de jet vit en carte
 * dans le fil, jamais dans la barre. Une puce dit ce qu'on attend de toi.
 * « Pour : MJ seul » envoie un mot que seul le MJ lit (RLS, `visible_to = '{}'`).
 */
export default function JeuJoueurDistance() {
  const t = useTranslations("distance");
  const { view, erreur, envoyer } = useTableADistanceContexte();
  const [dernierLu] = useState(view.lastReadSeq);
  const [texte, setTexte] = useState("");
  const [auMjSeul, setAuMjSeul] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreurEnvoi, setErreurEnvoi] = useState<string | null>(null);
  const moi = view.waiting.find((w) => w.userId === view.viewerId);

  async function envoyerMessage() {
    const corps = texte.trim();
    if (!corps || envoi) return;
    setEnvoi(true);
    const e = await envoyer("messages", { text: corps, visibleTo: auMjSeul ? [] : null });
    setErreurEnvoi(e);
    if (!e) setTexte("");
    setEnvoi(false);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {moi && moi.reason !== "waits_for_gm" && (
        <p className="self-start rounded-full border border-accent bg-accent/10 px-3 py-1 text-xs text-accent">
          {moi.reason === "must_roll" ? t("onAttendTonJet") : t("onAttendTaReponse")}
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <FilADistance
          feed={view.feed}
          requests={view.requests}
          viewerId={view.viewerId}
          estMj={false}
          dernierLuAuChargement={dernierLu}
          onRepondre={(id, corps) => envoyer(`demandes/${id}/reponse`, corps)}
          onAnnuler={async () => null}
        />
      </div>
      {(erreur || erreurEnvoi) && <p className="text-xs text-danger">{erreurEnvoi ?? erreur}</p>}
      <div className="flex shrink-0 flex-col gap-2">
        <div className="flex items-end gap-2">
          <textarea
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void envoyerMessage();
              }
            }}
            rows={2}
            maxLength={4000}
            placeholder={auMjSeul ? t("ecrireAuMj") : t("queFaisTu")}
            aria-label={auMjSeul ? t("ecrireAuMj") : t("queFaisTu")}
            className={`min-h-[52px] flex-1 resize-none rounded-md border bg-panel px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-muted ${
              auMjSeul ? "border-dashed border-gm" : "border-edge"
            }`}
          />
          <button
            type="button"
            onClick={() => void envoyerMessage()}
            disabled={!texte.trim() || envoi}
            className="min-h-11 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {t("envoyer")}
          </button>
        </div>
        <button
          type="button"
          aria-pressed={auMjSeul}
          onClick={() => setAuMjSeul((v) => !v)}
          className={`self-start rounded-full border px-3 py-1 text-xs transition-colors ${auMjSeul ? "border-gm text-gm" : "border-edge text-ink-muted hover:bg-panel-raised"}`}
        >
          {auMjSeul ? t("pourMjSeul") : t("pourTous")}
        </button>
      </div>
    </div>
  );
}
