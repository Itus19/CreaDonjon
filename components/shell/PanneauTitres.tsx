"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import Dropdown from "@/components/shared/Dropdown";
import { resetPlayerTitleTiersAction, savePlayerTitleTiersAction } from "@/app/admin/titresActions";
import { checkTiers, renderTemplate } from "@/src/core/stats/playerStats";
import { TITLE_ACTION_KINDS, TITLE_COLOR_TOKENS, TITLE_FAMILIES, TITLE_ICON_KEYS, TITLE_TEMPLATE_VARIABLES, type PlayerTitleTier, type TitleFamily } from "@/src/core/stats/titleTiers";
import { classesPastille } from "@/lib/ui/statsJoueur";
import {
  ajouterPalier,
  CHIFFRES_EXEMPLE,
  ecrireDecimal,
  ESSAI,
  lireDecimal,
  modifierPalier,
  rangTouche,
  retirerPalier,
  tiersDeFamille,
  type ActionKind,
} from "@/lib/ui/titresAdmin";
import CarteTitre from "./CarteTitre";
import IconeTitre from "./IconeTitre";

const CHAMP = "rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-accent";
const BOUTON = "rounded-md border border-edge px-3 py-1.5 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50 motion-reduce:transition-none";
const BOUTON_PRIMAIRE =
  "rounded-md border border-accent/50 bg-accent/15 px-3 py-1.5 text-xs text-accent transition-colors hover:bg-accent/25 disabled:opacity-50 motion-reduce:transition-none";

/** Les classes de fond d'une pastille de couleur du sélecteur, écrites en entier pour Tailwind. */
const FOND_COULEUR: Record<(typeof TITLE_COLOR_TOKENS)[number], string> = {
  success: "bg-success",
  danger: "bg-danger",
  accent: "bg-accent",
  link_entity: "bg-link-entity",
  link_rule: "bg-link-rule",
};

const CLE_FAMILLE: Record<TitleFamily, string> = { luck: "chance", bad_luck: "malchance", purse: "bourse", favorite_action: "action" };
const CLE_ACTION: Record<ActionKind, string> = { sneak_attack: "sournoise", attack: "arme", spell: "sort", heal: "soin", check: "test" };

/**
 * Un champ de plage en virgule décimale. Le texte tapé vit ici (« 0, » est
 * un état légitime) ; seule une saisie lisible remonte. Quand la valeur
 * change de l'extérieur (retrait d'un palier, rétablissement), il se réécrit.
 */
function ChampDecimal({
  valeur,
  videVaut,
  onChange,
  placeholder,
  ariaLabel,
}: {
  valeur: number | null;
  videVaut: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  ariaLabel: string;
}) {
  const [texte, setTexte] = useState(ecrireDecimal(valeur));
  const [vue, setVue] = useState(valeur);
  if (vue !== valeur) {
    setVue(valeur);
    const lu = lireDecimal(texte);
    if (!lu.ok || (lu.valeur ?? videVaut) !== valeur) setTexte(ecrireDecimal(valeur));
  }
  const illisible = !lireDecimal(texte).ok;
  return (
    <input
      type="text"
      inputMode="decimal"
      value={texte}
      placeholder={placeholder}
      aria-label={ariaLabel}
      aria-invalid={illisible}
      onChange={(e) => {
        setTexte(e.target.value);
        const lu = lireDecimal(e.target.value);
        if (lu.ok) onChange(lu.valeur ?? videVaut);
      }}
      onBlur={() => setTexte(ecrireDecimal(valeur))}
      className={`${CHAMP} w-16 text-center ${illisible ? "border-danger" : ""}`}
    />
  );
}

/**
 * V3.1-92 — L'éditeur des titres des joueurs (Administration › Titres des
 * joueurs). Le jeu COMPLET des paliers vit dans l'état local, part d'un coup
 * à l'enregistrement et se réaligne sur ce que le serveur renvoie. Le choix
 * du palier, les trous et chevauchements viennent du noyau (`pickTitle`,
 * `checkTiers`) ; le serveur revalide tout (Zod, superadmin).
 */
export default function PanneauTitres({ titresInitiaux }: { titresInitiaux: PlayerTitleTier[] }) {
  const t = useTranslations("administration.titres");
  const [tiers, setTiers] = useState<PlayerTitleTier[]>(titresInitiaux);
  const [famille, setFamille] = useState<TitleFamily>("luck");
  const [essais, setEssais] = useState<Record<string, number>>({ luck: ESSAI.luck.depart, bad_luck: ESSAI.bad_luck.depart, purse: ESSAI.purse.depart });
  const [rangAction, setRangAction] = useState(0);
  const [selecteur, setSelecteur] = useState<number | null>(null);
  const [enregistre, setEnregistre] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const [occupe, demarrer] = useTransition();

  const estAction = famille === "favorite_action";
  const siens = tiersDeFamille(tiers, famille);
  const essai = estAction ? null : ESSAI[famille];
  const mesure: number | ActionKind | null = estAction ? (siens[Math.min(rangAction, siens.length - 1)]?.action_kind ?? null) : (essais[famille] ?? 0);
  const rang = rangTouche(tiers, famille, mesure);
  const touche = rang >= 0 ? siens[rang] : null;
  const variables = TITLE_TEMPLATE_VARIABLES.filter((v) => (estAction ? ["action", "fois", "record"] : famille === "luck" ? ["n20", "table20"] : famille === "bad_luck" ? ["n1", "suite"] : ["depense", "gagne"]).includes(v));

  function changer(suivants: PlayerTitleTier[]) {
    setTiers(suivants);
    setEnregistre(false);
    setErreur(null);
  }
  function modifier(r: number, patch: Partial<PlayerTitleTier>) {
    changer(modifierPalier(tiers, famille, r, patch));
  }
  function choisirFamille(f: TitleFamily) {
    setFamille(f);
    setSelecteur(null);
  }

  function enregistrer() {
    setErreur(null);
    demarrer(async () => {
      const res = await savePlayerTitleTiersAction(tiers).catch((e: unknown) => {
        console.error("Paliers de titres non enregistrés", e);
        return { error: t("erreurServeur") };
      });
      if ("error" in res) {
        setErreur(res.error);
        return;
      }
      setTiers(res.tiers);
      setEnregistre(true);
    });
  }
  function retablir() {
    setConfirmation(false);
    setErreur(null);
    demarrer(async () => {
      const res = await resetPlayerTitleTiersAction().catch((e: unknown) => {
        console.error("Paliers de titres non rétablis", e);
        return { error: t("erreurServeur") };
      });
      if ("error" in res) {
        setErreur(res.error);
        return;
      }
      setTiers(res.tiers);
      setSelecteur(null);
      setEnregistre(false);
    });
  }

  const nomAction = (k: ActionKind | null) => (k ? t(`actions.${CLE_ACTION[k]}`) : "");
  const problemes = checkTiers(tiers).filter((p) => p.family === famille);
  const descriptions = problemes.map((p) => {
    if (p.actionKind) return t("problemeActionDouble", { action: nomAction(p.actionKind) });
    const de = ecrireDecimal(p.from ?? 0);
    if (p.kind === "gap") return p.to === null ? t("problemeTrouFin", { de }) : t("problemeTrou", { de, a: ecrireDecimal(p.to) });
    return p.to === null ? t("problemeChevauchementFin", { de }) : t("problemeChevauchement", { de, a: ecrireDecimal(p.to) });
  });

  const texteApercu = touche ? renderTemplate(touche.template, { ...CHIFFRES_EXEMPLE, action: nomAction(touche.action_kind) }) : t("aucunTitreTexte");

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <p className="text-sm text-ink-muted">{t("note")}</p>

      <div role="group" aria-label={t("famillesAria")} className="flex flex-wrap gap-2">
        {TITLE_FAMILIES.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={famille === f}
            onClick={() => choisirFamille(f)}
            className={`flex flex-col rounded-xl border px-3 py-2 text-left text-sm transition-colors motion-reduce:transition-none ${
              famille === f ? "border-accent bg-accent/15 text-ink" : "border-edge bg-panel text-ink-soft hover:bg-panel-raised"
            }`}
          >
            <span className="font-semibold">{t(`familles.${CLE_FAMILLE[f]}.nom`)}</span>
            <small className="text-xs text-ink-muted">{t(`familles.${CLE_FAMILLE[f]}.sous`)}</small>
          </button>
        ))}
      </div>

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-xs text-ink-muted">
            <b className="text-ink-soft">{t("mesure")}</b> {t(`familles.${CLE_FAMILLE[famille]}.mesure`)}
          </p>

          <ul className="flex flex-col gap-2">
            {siens.map((p, i) => (
              <li
                key={`${famille}-${i}`}
                className={`flex flex-col gap-2 rounded-xl border bg-panel-sunken p-2 ${i === rang ? "border-accent ring-1 ring-accent" : "border-edge"}`}
              >
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 lg:grid-cols-[auto_minmax(0,1.2fr)_auto_minmax(0,2fr)_auto]">
                  <button
                    type="button"
                    aria-label={t("iconeAria")}
                    aria-expanded={selecteur === i}
                    onClick={() => {
                      setSelecteur(selecteur === i ? null : i);
                      if (estAction) setRangAction(i);
                    }}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl border ${classesPastille(p.color_token)}`}
                  >
                    <IconeTitre cle={p.icon_key} className="h-5 w-5" />
                  </button>
                  <input
                    type="text"
                    value={p.name}
                    maxLength={60}
                    aria-label={t("nomAria")}
                    onChange={(e) => modifier(i, { name: e.target.value })}
                    onFocus={() => estAction && setRangAction(i)}
                    className={`${CHAMP} min-w-0`}
                  />
                  <span className="max-lg:col-span-3 max-lg:row-start-2 flex flex-wrap items-center gap-1.5 text-sm text-ink-muted">
                    {estAction ? (
                      <Dropdown
                        value={p.action_kind ?? ""}
                        onChange={(v) => modifier(i, { action_kind: v as ActionKind })}
                        options={TITLE_ACTION_KINDS.map((k) => ({ value: k, label: nomAction(k) }))}
                        aria-label={t("sorteAria")}
                        triggerClassName="rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
                      />
                    ) : (
                      <>
                        {t("de")}
                        <ChampDecimal valeur={p.range_from} videVaut={0} onChange={(v) => modifier(i, { range_from: v })} ariaLabel={t("deAria")} />
                        {t("a")}
                        <ChampDecimal valeur={p.range_to} videVaut={null} onChange={(v) => modifier(i, { range_to: v })} placeholder="∞" ariaLabel={t("aAria")} />
                      </>
                    )}
                  </span>
                  <input
                    type="text"
                    value={p.template}
                    maxLength={200}
                    aria-label={t("texteAria")}
                    onChange={(e) => modifier(i, { template: e.target.value })}
                    onFocus={() => estAction && setRangAction(i)}
                    className={`${CHAMP} min-w-0 max-lg:col-span-3`}
                  />
                  <button
                    type="button"
                    aria-label={t("retirerAria", { nom: p.name })}
                    disabled={siens.length <= 1}
                    onClick={() => {
                      setSelecteur(null);
                      changer(retirerPalier(tiers, famille, i));
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-panel-raised hover:text-danger disabled:opacity-30 max-lg:col-start-3 max-lg:row-start-1 motion-reduce:transition-none"
                  >
                    ×
                  </button>
                </div>

                {selecteur === i && (
                  <div className="flex flex-col gap-2 rounded-lg border border-edge bg-panel p-2">
                    <div role="group" aria-label={t("iconesAria")} className="grid grid-cols-6 gap-1.5">
                      {TITLE_ICON_KEYS.map((k) => (
                        <button
                          key={k}
                          type="button"
                          title={t(`icones.${k}`)}
                          aria-label={t(`icones.${k}`)}
                          aria-pressed={p.icon_key === k}
                          onClick={() => modifier(i, { icon_key: k })}
                          className={`flex h-9 items-center justify-center rounded-lg border transition-colors motion-reduce:transition-none ${
                            p.icon_key === k ? `${classesPastille(p.color_token)}` : "border-edge text-ink-soft hover:bg-panel-raised"
                          }`}
                        >
                          <IconeTitre cle={k} className="h-5 w-5" />
                        </button>
                      ))}
                    </div>
                    <div role="group" aria-label={t("couleursAria")} className="flex gap-2">
                      {TITLE_COLOR_TOKENS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          title={t(`couleurs.${c}`)}
                          aria-label={t(`couleurs.${c}`)}
                          aria-pressed={p.color_token === c}
                          onClick={() => modifier(i, { color_token: c })}
                          className={`h-6 w-6 rounded-full ${FOND_COULEUR[c]} ${p.color_token === c ? "ring-2 ring-ink ring-offset-2 ring-offset-panel" : ""}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSelecteur(null);
                changer(ajouterPalier(tiers, famille, t("nouveauPalier")));
              }}
              className={BOUTON}
            >
              {estAction ? t("ajouterAction") : t("ajouterPalier")}
            </button>
            <span className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
              {t("variables")}
              {variables.map((v) => (
                <span key={v} className="rounded-full border border-edge bg-panel-raised px-2 py-0.5 font-mono text-xs text-ink-soft">{`{${v}}`}</span>
              ))}
            </span>
          </div>

          {descriptions.length > 0 && (
            <p role="status" className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-ink-soft">
              {t("avertissement", { liste: descriptions.join(" ; ") })}
            </p>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-edge bg-panel p-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-ink-muted">{t("apercu")}</h3>
          {essai ? (
            <label className="flex flex-col gap-1 text-xs text-ink-muted">
              <span>
                {t("valeurEssai")} :{" "}
                <b className="text-ink">{t(famille === "purse" ? "unitePurse" : "uniteTable", { valeur: ecrireDecimal(Math.round((essais[famille] ?? 0) * 100) / 100) })}</b>
              </span>
              <input
                type="range"
                min={0}
                max={essai.max}
                step={0.05}
                value={essais[famille] ?? 0}
                onChange={(e) => setEssais({ ...essais, [famille]: Number(e.target.value) })}
                className="w-full accent-accent"
              />
            </label>
          ) : (
            <p className="text-xs text-ink-muted">{t("essaiAction")}</p>
          )}
          <CarteTitre
            icone={touche?.icon_key ?? "d20"}
            couleur={touche?.color_token ?? "none"}
            nom={touche ? touche.name : t("aucunTitre")}
            texte={texteApercu}
          />
          <p className="text-xs text-ink-muted">{t("exemple")}</p>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={enregistrer} disabled={occupe} className={BOUTON_PRIMAIRE}>
              {occupe ? (
                t("enregistrement")
              ) : enregistre ? (
                <span className="inline-flex items-center gap-1">
                  {t("enregistre")}
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.500" />
                  </svg>
                </span>
              ) : (
                t("enregistrer")
              )}
            </button>
            <button type="button" onClick={() => setConfirmation(true)} disabled={occupe} className={BOUTON}>
              {t("retablir")}
            </button>
          </div>
          {erreur && (
            <p role="alert" className="text-xs text-danger">
              {erreur}
            </p>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmation}
        title={t("retablirTitre")}
        message={t("retablirMessage")}
        confirmLabel={t("retablir")}
        danger
        onConfirm={retablir}
        onCancel={() => setConfirmation(false)}
      />
    </div>
  );
}
