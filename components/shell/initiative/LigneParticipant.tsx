"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Dropdown from "@/components/shared/Dropdown";
import { MonsterCard } from "@/components/rules/blockContentRenderer";
import ParticipantCharacterSheet from "@/components/shell/ParticipantCharacterSheet";
import type { CombatParticipantRow } from "@/src/server/repos/combats";
import type { CorrectifParticipant } from "@/lib/ui/initiativeApi";
import {
  appliquerPv,
  concentrationDe,
  estUnPj,
  etatsDe,
  fractionsAnneau,
  INITIATIVE_DE_DEPART,
  libellePv,
  pasInitiative,
} from "@/lib/ui/initiative";
import AnneauPv from "./AnneauPv";
import IconeGenre from "./IconeGenre";
import ActionsParticipant, { type DetailsParticipant } from "./ActionsParticipant";

const PETIT_BOUTON =
  "rounded-full border border-edge px-2.5 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50";

/**
 * Une ligne de l'ordre du tour. À droite, des colonnes de largeur fixe (CA,
 * anneau de PV, PV) pour qu'elles s'alignent d'une ligne à l'autre. Toucher le
 * score le rend modifiable ; toucher la ligne la déplie.
 */
export default function LigneParticipant({
  participant: p,
  worldSlug,
  campaignId,
  combatId,
  participants,
  actif,
  ouvert,
  enCours,
  occupe,
  nomOrigine,
  etatsDisponibles,
  details,
  onBasculer,
  onModifier,
  onRetirer,
  onRelancer,
  apresJet,
}: {
  participant: CombatParticipantRow;
  worldSlug: string;
  campaignId: string;
  combatId: string;
  participants: CombatParticipantRow[];
  actif: boolean;
  ouvert: boolean;
  enCours: boolean;
  occupe: boolean;
  nomOrigine: string | null;
  etatsDisponibles: string[];
  details: DetailsParticipant | "chargement" | "erreur" | undefined;
  onBasculer: () => void;
  onModifier: (correctif: CorrectifParticipant, note: string) => Promise<void>;
  onRetirer: () => void;
  onRelancer: () => void;
  apresJet: () => void;
}) {
  const t = useTranslations("initiative");
  const [brouillon, setBrouillon] = useState<number | null>(null);
  const [tempOuvert, setTempOuvert] = useState(false);
  const [tempSaisie, setTempSaisie] = useState("");
  const [renommage, setRenommage] = useState<string | null>(null);
  const [fiche, setFiche] = useState(false);

  const etats = etatsDe(p);
  const concentration = concentrationDe(p);
  const anneau = fractionsAnneau(p);
  const pv = libellePv(p);
  const aPv = p.hp_max !== null && p.hp_max > 0;
  const horsCombat = aPv && (p.hp_current ?? 0) <= 0;
  const peutRenommer = !p.is_ally && !estUnPj(p);

  function changerPv(delta: number) {
    const suite = appliquerPv(p, delta);
    void onModifier({ hpCurrent: suite.hpCurrent, tempHp: suite.tempHp }, `PV ${delta >= 0 ? "+" : ""}${delta}`);
  }

  function basculerEtat(nom: string) {
    const suite = etats.includes(nom) ? etats.filter((e) => e !== nom) : [...etats, nom];
    void onModifier({ conditions: suite }, `${t("etat")} : ${nom}`);
  }

  return (
    <li
      className={`@container flex flex-col gap-1.5 rounded-[14px] border px-2 py-1.5 ${
        actif ? "border-accent bg-panel-raised" : "border-edge bg-panel"
      } ${horsCombat ? "opacity-70" : ""}`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setBrouillon(p.initiative ?? INITIATIVE_DE_DEPART)}
          title={t("modifierInitiative")}
          aria-label={t("modifierInitiativeDe", { nom: p.label })}
          className={`flex h-9 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed font-mech text-sm font-bold transition-colors hover:border-accent ${
            p.initiative === null ? "border-accent text-accent" : "border-edge-strong text-ink"
          }`}
        >
          {p.initiative ?? "…"}
        </button>

        <button
          type="button"
          onClick={onBasculer}
          aria-expanded={ouvert}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-baseline gap-1.5">
              <IconeGenre genre={p.source_kind} />
              <b className="truncate text-sm font-semibold text-ink">{p.label}</b>
              {nomOrigine && <small className="truncate text-xs font-normal text-ink-muted">{nomOrigine}</small>}
            </span>
            {(etats.length > 0 || concentration || horsCombat) && (
              <span className="flex flex-wrap gap-1 pt-0.5">
                {horsCombat && <span className="rounded-full border border-danger px-1.5 text-xs text-danger">{t("horsDeCombat")}</span>}
                {etats.map((e) => (
                  <span key={e} className="rounded-full border border-gm px-1.5 text-xs text-gm">
                    {e}
                  </span>
                ))}
                {concentration && <span className="rounded-full border border-edge px-1.5 text-xs text-ink-soft">{t("concentration", { sort: concentration })}</span>}
              </span>
            )}
          </span>

          {/* Colonnes de droite : même largeur sur toutes les lignes. */}
          <span className="flex w-9 shrink-0 justify-center" title={t("classeArmure")}>
            {p.ac !== null && (
              <span className="relative flex h-8 w-7 items-center justify-center">
                <svg viewBox="0 0 24 26" className="absolute inset-0 h-full w-full fill-panel-sunken stroke-edge-strong" strokeWidth="1.4" aria-hidden="true">
                  <path d="M12 1.5 21.5 5v7.2c0 6-4.1 10.3-9.5 12.3C6.6 22.5 2.5 18.2 2.5 12.2V5L12 1.5Z" />
                </svg>
                <span className="relative font-mech text-xs font-semibold text-ink">{p.ac}</span>
              </span>
            )}
          </span>
          <span className="flex w-8 shrink-0 justify-center">
            {anneau ? <AnneauPv fractions={anneau} /> : <span className="text-ink-muted">—</span>}
          </span>
          <span className="w-12 shrink-0 text-right font-mech text-xs text-ink-soft @md:w-14">{pv ?? ""}</span>
        </button>
      </div>

      {brouillon !== null && (
        <div className="flex items-center gap-2 rounded-lg bg-panel-sunken px-2 py-1 text-xs">
          <span className="min-w-0 flex-1 truncate text-ink-muted">{t("initiativeDe", { nom: p.label })}</span>
          <button type="button" aria-label={t("initiativeMoins")} onClick={() => setBrouillon(pasInitiative(brouillon, -1))} className={PETIT_BOUTON}>
            ▼
          </button>
          <b className="w-8 text-center font-mech text-sm text-ink">{brouillon}</b>
          <button type="button" aria-label={t("initiativePlus")} onClick={() => setBrouillon(pasInitiative(brouillon, 1))} className={PETIT_BOUTON}>
            ▲
          </button>
          <button
            type="button"
            disabled={occupe}
            onClick={() => {
              const valeur = brouillon;
              setBrouillon(null);
              if (valeur !== p.initiative) void onModifier({ initiative: valeur }, t("initiativeModifiee"));
            }}
            className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {t("ok")}
          </button>
          <button type="button" onClick={() => setBrouillon(null)} className={PETIT_BOUTON}>
            {t("annuler")}
          </button>
        </div>
      )}

      {ouvert && (
        <div className="flex flex-col gap-2 border-t border-edge pt-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {aPv && (
              <>
                <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">{t("pv")}</span>
                {[-5, -1, 1].map((d) => (
                  <button key={d} type="button" disabled={occupe} onClick={() => changerPv(d)} className={PETIT_BOUTON}>
                    {d > 0 ? `+${d}` : `−${-d}`}
                  </button>
                ))}
                <button type="button" onClick={() => setTempOuvert((v) => !v)} aria-expanded={tempOuvert} className={`${PETIT_BOUTON} text-ink`}>
                  {t("pvTemporaires")}
                </button>
              </>
            )}
            <Dropdown
              value=""
              onChange={(nom) => nom && basculerEtat(nom)}
              aria-label={t("ajouterEtat", { nom: p.label })}
              options={[{ value: "", label: t("plusEtat") }, ...etatsDisponibles.filter((e) => !etats.includes(e)).map((e) => ({ value: e, label: e }))]}
            />
            {peutRenommer && (
              <button type="button" onClick={() => setRenommage(p.label)} className={PETIT_BOUTON}>
                ✎ {t("renommer")}
              </button>
            )}
            {nomOrigine && (
              <button type="button" disabled={occupe} onClick={() => void onModifier({ label: nomOrigine }, t("nomOrigineRetabli"))} className={PETIT_BOUTON}>
                {t("nomOrigine")}
              </button>
            )}
            <button type="button" onClick={() => setFiche((v) => !v)} aria-expanded={fiche} className={PETIT_BOUTON}>
              {t("fiche")} {fiche ? "▾" : "▸"}
            </button>
            {!estUnPj(p) && (
              <button type="button" disabled={occupe} onClick={onRelancer} title={t("relancerInitiative")} className={PETIT_BOUTON}>
                {t("relancer")}
              </button>
            )}
            <button type="button" onClick={onRetirer} aria-label={t("retirer", { nom: p.label })} className="ml-auto text-xs text-danger hover:underline">
              {t("retirerCourt")}
            </button>
          </div>

          {tempOuvert && (
            <div className="flex items-center gap-2 text-xs">
              <label className="flex items-center gap-1.5 text-ink-muted">
                {t("pvTemporairesChamp")}
                <input
                  type="number"
                  min={0}
                  value={tempSaisie}
                  onChange={(e) => setTempSaisie(e.target.value)}
                  placeholder={String(p.temp_hp)}
                  className="w-16 rounded-md border border-edge bg-transparent px-2 py-1 text-center text-ink outline-none"
                />
              </label>
              <button
                type="button"
                disabled={occupe || tempSaisie === "" || !Number.isInteger(Number(tempSaisie)) || Number(tempSaisie) < 0}
                onClick={() => {
                  void onModifier({ tempHp: Number(tempSaisie) }, t("pvTemporaires"));
                  setTempSaisie("");
                  setTempOuvert(false);
                }}
                className={PETIT_BOUTON}
              >
                {t("ok")}
              </button>
            </div>
          )}

          {etats.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {etats.map((e) => (
                <button key={e} type="button" onClick={() => basculerEtat(e)} title={t("retirerEtat")} className="rounded-full border border-gm px-2 py-0.5 text-xs text-gm hover:bg-panel-raised">
                  {e} ×
                </button>
              ))}
            </div>
          )}

          {renommage !== null && (
            <div className="flex items-center gap-2">
              <input
                value={renommage}
                onChange={(e) => setRenommage(e.target.value)}
                aria-label={t("nouveauNom")}
                className="min-w-0 flex-1 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
              />
              <button
                type="button"
                disabled={occupe || renommage.trim() === ""}
                onClick={() => {
                  const nom = renommage.trim();
                  setRenommage(null);
                  if (nom !== p.label) void onModifier({ label: nom }, t("renomme", { nom }));
                }}
                className={PETIT_BOUTON}
              >
                {t("ok")}
              </button>
              <button type="button" onClick={() => setRenommage(null)} className={PETIT_BOUTON}>
                {t("annuler")}
              </button>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">{t("actions")}</span>
            <ActionsParticipant
              details={details}
              contexte={{ acteur: p, participants, worldSlug, campaignId, combatId, enCours, apresJet }}
            />
          </div>

          {fiche && (
            <div className="rounded-xl border border-edge bg-panel-sunken p-2.5">
              {p.source_kind === "entity" && p.entity_id ? (
                <ParticipantCharacterSheet worldSlug={worldSlug} campaignId={campaignId} entityId={p.entity_id} isWorldAdmin />
              ) : details && details !== "chargement" && details !== "erreur" && details.kind === "monstre" && details.caracteristiques.kind === "monster" ? (
                <MonsterCard
                  statBlock={details.caracteristiques.statBlock}
                  traits={details.caracteristiques.traits}
                  actions={details.caracteristiques.actions}
                  legendaryActions={details.caracteristiques.legendaryActions}
                />
              ) : (
                <p className="text-xs text-ink-muted">{t("aucuneFiche")}</p>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
