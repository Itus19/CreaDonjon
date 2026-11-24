"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Dropdown from "@/components/shared/Dropdown";
import Checkbox from "@/components/shared/Checkbox";
import { ABILITIES, ABILITY_LABELS, SKILLS } from "@/src/core/rules/abilities";
import { SKILL_LABELS_FR } from "@/src/i18n/fr";
import type { RollAdvantage, RollCheck } from "@/src/core/remote/feed";
import FilADistance from "./FilADistance";
import { useTableADistanceContexte } from "./TableADistanceContexte";

/**
 * Le jeu à distance, côté MJ (option A avec la saisie centrale de l'option B,
 * choisie le 23 nov.) : en tête, qui attend et qui doit lancer ; le fil ; puis
 * une saisie avec « + » qui ouvre les outils et un sélecteur « Pour : ».
 *
 * Outils de cette première partie : demander un jet, choisir les
 * destinataires (secret), dire de qui on attend la réponse. Les autres
 * (faire parler, montrer, texte préparé) viendront avec leurs tickets.
 */

const JETS: { value: string; label: string }[] = [
  ...[...SKILLS].sort((a, b) => SKILL_LABELS_FR[a].localeCompare(SKILL_LABELS_FR[b], "fr")).map((s) => ({ value: `skill:${s}`, label: SKILL_LABELS_FR[s] })),
  ...ABILITIES.map((a) => ({ value: `ability:${a}`, label: ABILITY_LABELS[a] })),
  ...ABILITIES.map((a) => ({ value: `save:${a}`, label: `Sauvegarde de ${ABILITY_LABELS[a]}` })),
];

function checkDepuis(valeur: string): RollCheck {
  const [kind, key] = valeur.split(":");
  return { kind, key } as RollCheck;
}

export default function JeuMjDistance() {
  const t = useTranslations("distance");
  const { view, erreur, envoyer } = useTableADistanceContexte();
  const [dernierLu] = useState(view.lastReadSeq);
  const [texte, setTexte] = useState("");
  const [outils, setOutils] = useState(false);
  /** `null` : toute la table ; sinon les joueurs qui liront (secret). */
  const [pour, setPour] = useState<string[] | null>(null);
  const [attendre, setAttendre] = useState<string[]>([]);
  const [demande, setDemande] = useState<null | { cible: string; jet: string; avantage: RollAdvantage; dd: string; ddCache: boolean }>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreurEnvoi, setErreurEnvoi] = useState<string | null>(null);
  const joueurs = view.players;
  const nom = (id: string) => joueurs.find((j) => j.userId === id)?.name ?? "Joueur";

  function basculer(liste: string[], id: string): string[] {
    return liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id];
  }

  async function envoyerMessage() {
    const corps = texte.trim();
    if (!corps || envoi) return;
    if (pour !== null && pour.length === 0) {
      setErreurEnvoi(t("choisisDestinataire"));
      return;
    }
    setEnvoi(true);
    const e = await envoyer("messages", { text: corps, visibleTo: pour, awaiting: attendre.length > 0 ? attendre : undefined });
    setErreurEnvoi(e);
    if (!e) {
      setTexte("");
      setAttendre([]);
    }
    setEnvoi(false);
  }

  async function envoyerDemande() {
    if (!demande || envoi) return;
    const dd = demande.dd.trim() === "" ? null : Number(demande.dd);
    if (dd !== null && (!Number.isInteger(dd) || dd < 1 || dd > 40)) {
      setErreurEnvoi(t("ddInvalide"));
      return;
    }
    setEnvoi(true);
    const e = await envoyer("demandes", {
      targetUserId: demande.cible,
      check: checkDepuis(demande.jet),
      advantage: demande.avantage,
      dc: dd,
      dcHidden: demande.ddCache,
      ...(texte.trim() ? { text: texte.trim() } : {}),
    });
    setErreurEnvoi(e);
    if (!e) {
      setTexte("");
      setDemande(null);
      setOutils(false);
    }
    setEnvoi(false);
  }

  const libellePour = pour === null ? t("pourTous") : pour.length === 0 ? t("pourPersonne") : t("pourNoms", { noms: pour.map(nom).join(", ") });

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {view.waiting.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label={t("quiDoitRepondre")}>
          {view.waiting.map((w) => (
            <span
              key={w.userId}
              className={`rounded-full border px-3 py-1 text-xs ${w.reason === "waits_for_gm" ? "border-accent bg-accent/10 text-accent" : "border-edge text-ink-soft"}`}
            >
              {w.reason === "waits_for_gm" ? t("attendLeMj", { nom: w.name }) : w.reason === "must_roll" ? t("doitLancer", { nom: w.name }) : t("doitRepondre", { nom: w.name })}
            </span>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <FilADistance
          feed={view.feed}
          requests={view.requests}
          viewerId={view.viewerId}
          estMj
          dernierLuAuChargement={dernierLu}
          onRepondre={async () => null}
          onAnnuler={(id) => envoyer(`demandes/${id}/annuler`, {})}
        />
      </div>

      {(erreur || erreurEnvoi) && <p className="text-xs text-danger">{erreurEnvoi ?? erreur}</p>}

      {outils && (
        <div className="flex shrink-0 flex-col gap-3 rounded-lg border border-edge-strong bg-panel-raised p-3">
          {joueurs.length === 0 && <p className="text-xs text-ink-muted">{t("aucunJoueur")}</p>}

          <section className="flex flex-col gap-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("pour")}</h3>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                aria-pressed={pour === null}
                onClick={() => setPour(null)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${pour === null ? "border-accent text-accent" : "border-edge text-ink hover:bg-panel"}`}
              >
                {t("toutLaTable")}
              </button>
              {joueurs.map((j) => {
                const actif = pour?.includes(j.userId) ?? false;
                return (
                  <button
                    key={j.userId}
                    type="button"
                    aria-pressed={actif}
                    onClick={() => setPour((p) => basculer(p ?? [], j.userId))}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${actif ? "border-dashed border-gm text-gm" : "border-edge text-ink hover:bg-panel"}`}
                  >
                    {t("secretPourNom", { nom: j.name })}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col gap-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("attendreReponse")}</h3>
            <div className="flex flex-wrap gap-1.5">
              {joueurs.map((j) => {
                const actif = attendre.includes(j.userId);
                return (
                  <button
                    key={j.userId}
                    type="button"
                    aria-pressed={actif}
                    onClick={() => setAttendre((a) => basculer(a, j.userId))}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${actif ? "border-accent text-accent" : "border-edge text-ink hover:bg-panel"}`}
                  >
                    {j.name}
                  </button>
                );
              })}
            </div>
          </section>

          {demande === null ? (
            <button
              type="button"
              disabled={joueurs.length === 0}
              onClick={() => setDemande({ cible: joueurs[0]?.userId ?? "", jet: "skill:perception", avantage: "none", dd: "", ddCache: true })}
              className="min-h-11 self-start rounded-full border border-accent px-4 py-2 text-sm text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
            >
              {t("demanderUnJet")}
            </button>
          ) : (
            <section className="flex flex-col gap-2 rounded-md border border-accent p-3">
              <h3 className="text-sm font-semibold text-accent">{t("demanderUnJet")}</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Dropdown size="md" aria-label={t("aQui")} value={demande.cible} options={joueurs.map((j) => ({ value: j.userId, label: j.name }))} onChange={(v) => setDemande({ ...demande, cible: v })} />
                <Dropdown size="md" aria-label={t("quelJet")} value={demande.jet} options={JETS} onChange={(v) => setDemande({ ...demande, jet: v })} />
                <Dropdown
                  size="md"
                  aria-label={t("avantageOuNon")}
                  value={demande.avantage}
                  options={[
                    { value: "none", label: t("sansAvantage") },
                    { value: "advantage", label: t("avantage") },
                    { value: "disadvantage", label: t("desavantage") },
                  ]}
                  onChange={(v) => setDemande({ ...demande, avantage: v as RollAdvantage })}
                />
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-ink-soft">
                    {t("dd")}
                    <input
                      inputMode="numeric"
                      value={demande.dd}
                      onChange={(e) => setDemande({ ...demande, dd: e.target.value.replace(/\D/g, "").slice(0, 2) })}
                      placeholder="—"
                      aria-label={t("ddDuJet")}
                      className="min-h-10 w-16 rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
                    />
                  </label>
                  <Checkbox checked={demande.ddCache} onChange={() => setDemande({ ...demande, ddCache: !demande.ddCache })} label={t("ddCacheCase")} ecritAilleurs />
                </div>
              </div>
              <p className="text-xs text-ink-muted">{t("demandeTexte")}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={envoi || !demande.cible}
                  onClick={() => void envoyerDemande()}
                  className="min-h-11 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
                >
                  {t("envoyerDemande")}
                </button>
                <button type="button" onClick={() => setDemande(null)} className="min-h-11 rounded-full border border-edge px-4 py-2 text-sm text-ink transition-colors hover:bg-panel">
                  {t("annuler")}
                </button>
              </div>
            </section>
          )}
        </div>
      )}

      <div className="flex shrink-0 items-end gap-2">
        <button
          type="button"
          aria-expanded={outils}
          aria-label={outils ? t("fermerOutils") : t("ouvrirOutils")}
          onClick={() => setOutils((v) => !v)}
          className={`min-h-11 w-11 shrink-0 rounded-full border text-lg leading-none transition-colors ${outils ? "border-accent bg-accent/10 text-accent" : "border-edge text-ink hover:bg-panel-raised"}`}
        >
          {outils ? "×" : "+"}
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <button
            type="button"
            onClick={() => setOutils(true)}
            className={`self-start rounded-full border px-3 py-0.5 text-xs ${pour === null ? "border-edge text-ink-muted" : "border-dashed border-gm text-gm"}`}
          >
            {t("pourLibelle", { qui: libellePour })}
          </button>
          <textarea
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && demande === null) {
                e.preventDefault();
                void envoyerMessage();
              }
            }}
            rows={2}
            maxLength={4000}
            placeholder={t("ecrisLaSuite")}
            aria-label={t("ecrisLaSuite")}
            className={`min-h-[52px] w-full resize-none rounded-md border bg-panel px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-muted ${pour === null ? "border-edge" : "border-dashed border-gm"}`}
          />
        </div>
        <button
          type="button"
          onClick={() => void envoyerMessage()}
          disabled={!texte.trim() || envoi || demande !== null}
          className="min-h-11 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {t("envoyer")}
        </button>
      </div>
    </div>
  );
}
