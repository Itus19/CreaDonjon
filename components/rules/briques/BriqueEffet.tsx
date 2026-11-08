"use client";

import { useTranslations } from "next-intl";
import Dropdown from "@/components/shared/Dropdown";
import Checkbox from "@/components/shared/Checkbox";
import { ABILITY_LABELS } from "@/src/core/rules/abilities";
import type { Ability } from "@/src/core/rules/sheet";
import { SAVE_ABILITIES, SPELL_DAMAGE_TYPES } from "@/src/core/rules/homebrewSpell";
import { MODIFIER_TARGET_OPTIONS, modifierOpNeedsValue } from "@/src/core/rules/modifierTargets";
import { isRollTarget } from "@/src/core/schemas/rule-blocks/primitives";
import { BUDGET_KINDS } from "@/src/core/rules/actionBudget";
import { TRIGGER_EVENTS, TRIGGER_ZONES } from "@/src/core/rules/triggers";
import { DAMAGE_TYPE_LABELS_FR, MODIFIER_OP_LABELS_FR, modifierTargetLabel } from "@/src/i18n/fr";
import {
  ENTREES_AJOUT,
  deplacerA,
  nouveauModificateur,
  opsPourCible,
  remplacerA,
  retirerA,
  type BrouillonDuree,
  type BrouillonEffet,
  type BrouillonFin,
  type BrouillonModificateur,
  type CorpsEffet,
} from "@/lib/ui/briquesRegle";
import ChampFormule from "@/components/rules/briques/ChampFormule";
import { BoutonPetit, CarteBrique, ChampListe, ChampTexte, Citation, useContexteBriques } from "@/components/rules/briques/ContexteBriques";

const UNITES_DUREE = ["round", "minute", "hour", "day", "until_turn_end", "until_rest", "permanent"] as const;

/** Une liste d'effets ordonnée, avec la liste « Ajouter une brique ». Récursive : une sauvegarde porte deux listes. */
export function ListeEffets({ effets, onChange }: { effets: BrouillonEffet[]; onChange: (l: BrouillonEffet[]) => void }) {
  const t = useTranslations("regles.briques");
  const { creerEffet } = useContexteBriques();
  return (
    <div className="flex flex-col gap-2">
      {effets.map((e, i) => (
        <BriqueEffet
          key={e.uid}
          effet={e}
          onChange={(n) => onChange(remplacerA(effets, i, n))}
          onRemove={() => onChange(retirerA(effets, i))}
          onMove={(d) => onChange(deplacerA(effets, i, d))}
          peutMonter={i > 0}
          peutDescendre={i < effets.length - 1}
        />
      ))}
      <div className="w-fit">
        <Dropdown
          value=""
          options={[{ value: "", label: t("ajouterBrique") }, ...ENTREES_AJOUT.map((k) => ({ value: k, label: t(`ajout.${k}`) }))]}
          onChange={(v) => {
            const entree = ENTREES_AJOUT.find((k) => k === v);
            if (entree) onChange([...effets, creerEffet(entree)]);
          }}
          aria-label={t("ajouterBrique")}
        />
      </div>
    </div>
  );
}

function BriqueEffet({
  effet,
  onChange,
  onRemove,
  onMove,
  peutMonter,
  peutDescendre,
}: {
  effet: BrouillonEffet;
  onChange: (e: BrouillonEffet) => void;
  onRemove: () => void;
  onMove: (delta: number) => void;
  peutMonter: boolean;
  peutDescendre: boolean;
}) {
  const t = useTranslations("regles.briques");
  const { numeros } = useContexteBriques();
  const maj = (corps: Partial<CorpsEffet> & { who?: string; passage?: string | null }) => onChange({ ...effet, ...corps } as BrouillonEffet);
  const aUnQui = effet.type !== "roll" && effet.type !== "narrate_hint" && effet.type !== "opaque";
  const titre = effet.type === "opaque" ? t("effet.opaque", { action: effet.effet.action }) : effet.type === "existing_durable" ? t("effet.existing_durable") : t(`effet.${effet.type}`);

  return (
    <CarteBrique
      uid={effet.uid}
      titre={titre}
      numero={numeros.get(effet.uid)}
      actions={
        <>
          <BoutonPetit onClick={() => onMove(-1)} disabled={!peutMonter}>
            {t("monter")}
          </BoutonPetit>
          <BoutonPetit onClick={() => onMove(1)} disabled={!peutDescendre}>
            {t("descendre")}
          </BoutonPetit>
          <BoutonPetit onClick={onRemove} danger>
            {t("retirer")}
          </BoutonPetit>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {aUnQui && <ChampListe libelle={t("qui")} valeur={effet.who} options={[{ value: "self", label: t("quiSelf") }, { value: "target", label: t("quiTarget") }]} onChange={(who) => maj({ who })} />}
        <ChampsEffet effet={effet} maj={maj} />
      </div>
      {effet.type === "saving_throw" && (
        <div className="flex flex-col gap-3 border-l-2 border-dashed border-edge pl-3">
          <span className="text-xs font-medium text-ink-soft">{t("siEchec")}</span>
          <ListeEffets effets={effet.echec} onChange={(echec) => onChange({ ...effet, echec })} />
          <span className="text-xs font-medium text-ink-soft">{t("siReussite")}</span>
          <ListeEffets effets={effet.reussite} onChange={(reussite) => onChange({ ...effet, reussite })} />
        </div>
      )}
      {effet.type !== "opaque" && <Citation passage={effet.passage} onChange={(passage) => maj({ passage })} />}
    </CarteBrique>
  );
}

function ChampsEffet({ effet, maj }: { effet: BrouillonEffet; maj: (c: Partial<CorpsEffet>) => void }) {
  const t = useTranslations("regles.briques");
  const { etats } = useContexteBriques();
  const options = etats.length === 0 ? [{ value: "", label: t("aucunEtat") }] : [{ value: "", label: t("choisirEtat") }, ...etats];

  switch (effet.type) {
    case "saving_throw":
      return (
        <>
          <ChampListe
            libelle={t("caracteristique")}
            valeur={effet.ability}
            options={listeCaracteristiques(effet.ability)}
            onChange={(ability) => maj({ ability })}
          />
          <ChampFormule libelle={t("dd")} valeur={effet.dc} onChange={(dc) => maj({ dc })} />
        </>
      );
    case "deal_damage":
      return (
        <>
          <ChampFormule libelle={t("montantDegats")} valeur={effet.montant} onChange={(montant) => maj({ montant })} />
          <ChampListe
            libelle={t("typeDegats")}
            valeur={effet.typeDegats}
            options={[{ value: "", label: t("sansType") }, ...SPELL_DAMAGE_TYPES.map((d) => ({ value: d, label: DAMAGE_TYPE_LABELS_FR[d] ?? d }))]}
            onChange={(typeDegats) => maj({ typeDegats })}
          />
        </>
      );
    case "heal":
      return <ChampFormule libelle={t("montantSoins")} valeur={effet.montant} onChange={(montant) => maj({ montant })} />;
    case "temp_hp":
      return (
        <>
          <ChampFormule libelle={t("montantPvTemporaires")} valeur={effet.montant} onChange={(montant) => maj({ montant })} />
          <p className="col-span-full text-xs text-ink-muted">{t("aidePvTemporaires")}</p>
        </>
      );
    case "apply_condition":
    case "remove_condition":
      return <ChampListe libelle={t("etat")} valeur={effet.cle} options={avecValeur(options, effet.cle)} onChange={(cle) => maj({ cle })} />;
    case "apply_state":
      return <ChampsEtat effet={effet} maj={maj} options={options} />;
    case "existing_durable":
      return <p className="text-xs text-ink-muted sm:col-span-2 lg:col-span-3">{t("effetConserve", { id: effet.effectId })}</p>;
    case "apply_boost":
      return <ChampsBoost effet={effet} maj={maj} />;
    case "grant_budget":
      return (
        <>
          <ChampListe
            libelle={t("genreBudget")}
            valeur={effet.kind}
            options={BUDGET_KINDS.map((k) => ({ value: k, label: t(`budget.${k}`) }))}
            onChange={(kind) => maj({ kind: BUDGET_KINDS.find((k) => k === kind) ?? effet.kind })}
          />
          <ChampFormule libelle={t("montantBudget")} valeur={effet.montant} onChange={(montant) => maj({ montant })} />
        </>
      );
    case "move":
      return (
        <ChampListe
          libelle={t("zone")}
          valeur={effet.zone}
          options={TRIGGER_ZONES.map((z) => ({ value: z, label: t(`zones.${z}`) }))}
          onChange={(zone) => maj({ zone: TRIGGER_ZONES.find((z) => z === zone) ?? effet.zone })}
        />
      );
    case "roll":
      return (
        <>
          <ChampTexte libelle={t("libelleJet")} valeur={effet.libelle} onChange={(libelle) => maj({ libelle })} />
          <ChampFormule libelle={t("formuleJet")} valeur={effet.formule} onChange={(formule) => maj({ formule })} />
        </>
      );
    case "narrate_hint":
      return (
        <div className="sm:col-span-2 lg:col-span-3">
          <ChampTexte libelle={t("indication")} valeur={effet.texte} onChange={(texte) => maj({ texte })} />
        </div>
      );
    case "cast_spell":
      return (
        <>
          <ChampTexte libelle={t("cleDuSort")} valeur={effet.sort} onChange={(sort) => maj({ sort })} mecanique />
          <div className="sm:pt-5">
            <Checkbox checked={effet.gratuit} onChange={() => maj({ gratuit: !effet.gratuit })} label={t("sortGratuit")} />
          </div>
        </>
      );
    case "opaque":
      return <p className="text-xs text-ink-muted sm:col-span-2 lg:col-span-3">{t("effetOpaque")}</p>;
  }
}

function listeCaracteristiques(courante: string) {
  const liste = SAVE_ABILITIES.map((a) => ({ value: a, label: ABILITY_LABELS[a as Ability] }));
  return liste.some((o) => o.value === courante) ? liste : [...liste, { value: courante, label: courante }];
}

/** Une valeur déjà enregistrée mais absente de la liste (état d'un autre ruleset) reste visible et choisie. */
function avecValeur(options: { value: string; label: string }[], valeur: string) {
  return valeur === "" || options.some((o) => o.value === valeur) ? options : [...options, { value: valeur, label: valeur }];
}

/** « Appliquer un état » : l'état, sa durée, la concentration, et ce qui y met fin. Une brique à l'écran, deux données en base. */
function ChampsEtat({
  effet,
  maj,
  options,
}: {
  effet: Extract<BrouillonEffet, { type: "apply_state" }>;
  maj: (c: Partial<CorpsEffet>) => void;
  options: { value: string; label: string }[];
}) {
  const t = useTranslations("regles.briques");
  return (
    <>
      <ChampListe libelle={t("etat")} valeur={effet.cle} options={avecValeur(options, effet.cle)} onChange={(cle) => maj({ cle })} />
      <ChampsDuree duree={effet.duree} concentration={effet.concentration} finSi={effet.finSi} maj={maj} />
    </>
  );
}

/**
 * « Modificateur temporaire » et « Avantage / désavantage » : le nom de l'effet, ses modificateurs (cible, effet, valeur en formule),
 * puis sa durée et sa concentration. Une brique à l'écran, un effet qui dure en base (ADR 0074).
 */
function ChampsBoost({ effet, maj }: { effet: Extract<BrouillonEffet, { type: "apply_boost" }>; maj: (c: Partial<CorpsEffet>) => void }) {
  const t = useTranslations("regles.briques");
  const majModificateur = (i: number, m: BrouillonModificateur) => maj({ modificateurs: remplacerA(effet.modificateurs, i, m) });
  return (
    <>
      <ChampTexte libelle={t("nomEffet")} valeur={effet.nom} onChange={(nom) => maj({ nom })} />
      <div className="flex flex-col gap-3 sm:col-span-2 lg:col-span-3">
        {effet.modificateurs.map((m, i) => {
          const ops = opsPourCible(m.cible);
          return (
            <div key={m.uid} className="grid gap-3 rounded-md border border-edge/60 p-2 sm:grid-cols-2 lg:grid-cols-3">
              <ChampListe
                libelle={t("cibleModificateur")}
                valeur={m.cible}
                options={avecValeur(MODIFIER_TARGET_OPTIONS.map((o) => ({ value: o.target, label: modifierTargetLabel(o.target) })), m.cible)}
                onChange={(cible) => {
                  const opsCible = opsPourCible(cible);
                  majModificateur(i, { ...m, cible, op: opsCible.includes(m.op) ? m.op : opsCible[0] });
                }}
              />
              <ChampListe
                libelle={t("operation")}
                valeur={m.op}
                options={ops.map((o) => ({ value: o, label: MODIFIER_OP_LABELS_FR[o] }))}
                onChange={(op) => majModificateur(i, { ...m, op: ops.find((o) => o === op) ?? ops[0] })}
              />
              {modifierOpNeedsValue(m.op) && (
                <ChampFormule libelle={t("valeur")} valeur={m.valeur} onChange={(valeur) => majModificateur(i, { ...m, valeur })} sansDes={!isRollTarget(m.cible)} />
              )}
              <div className="flex items-end">
                <BoutonPetit onClick={() => maj({ modificateurs: retirerA(effet.modificateurs, i) })} danger>
                  {t("retirerModificateur")}
                </BoutonPetit>
              </div>
            </div>
          );
        })}
        <div className="w-fit">
          <BoutonPetit onClick={() => maj({ modificateurs: [...effet.modificateurs, nouveauModificateur("ac", "add", "1")] })}>{t("ajouterModificateur")}</BoutonPetit>
        </div>
      </div>
      <ChampsDuree duree={effet.duree} concentration={effet.concentration} finSi={effet.finSi} maj={maj} />
    </>
  );
}

/** La durée d'un effet qui dure, sa concentration et ce qui y met fin : commun à « Appliquer un état » et aux modificateurs temporaires. */
function ChampsDuree({
  duree: d,
  concentration,
  finSi,
  maj,
}: {
  duree: BrouillonDuree;
  concentration: boolean;
  finSi: BrouillonFin[];
  maj: (c: Partial<CorpsEffet>) => void;
}) {
  const t = useTranslations("regles.briques");
  const avecMontant = d.unit === "round" || d.unit === "minute" || d.unit === "hour" || d.unit === "day";
  const majFin = (i: number, f: BrouillonFin) => maj({ finSi: remplacerA(finSi, i, f) });
  return (
    <>
      <ChampListe
        libelle={t("duree")}
        valeur={d.unit}
        options={UNITES_DUREE.map((u) => ({ value: u, label: t(`unites.${u}`) }))}
        onChange={(unit) => maj({ duree: { ...d, unit: UNITES_DUREE.find((u) => u === unit) ?? d.unit } })}
      />
      {avecMontant && <ChampTexte libelle={t("nombre")} valeur={d.amount} onChange={(amount) => maj({ duree: { ...d, amount } })} mecanique />}
      {d.unit === "until_turn_end" && (
        <>
          <ChampListe
            libelle={t("dontLeTour")}
            valeur={d.whose}
            options={[{ value: "bearer", label: t("sujet.bearer") }, { value: "source", label: t("sujet.source") }]}
            onChange={(whose) => maj({ duree: { ...d, whose: whose === "source" ? "source" : "bearer" } })}
          />
          <ChampListe
            libelle={t("quelTour")}
            valeur={d.which}
            options={[{ value: "current", label: t("tourEnCours") }, { value: "next", label: t("tourSuivant") }]}
            onChange={(which) => maj({ duree: { ...d, which: which === "current" ? "current" : "next" } })}
          />
        </>
      )}
      <div className="sm:col-span-2 lg:col-span-3">
        <Checkbox checked={concentration} onChange={() => maj({ concentration: !concentration })} label={t("concentration")} />
      </div>
      <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-3">
        <span className="text-xs text-ink-soft">{t("priseFinSi")}</span>
        {finSi.map((f, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2">
            <ChampListe
              libelle={t("evenement")}
              valeur={f.event}
              options={[...TRIGGER_EVENTS.map((e) => ({ value: e, label: t(`evenements.${e}`) })), { value: "dismissed", label: t("evenements.dismissed") }]}
              onChange={(event) => majFin(i, { ...f, event })}
            />
            {f.event !== "dismissed" && (
              <ChampListe
                libelle={t("pour")}
                valeur={f.subject}
                options={[{ value: "bearer", label: t("sujet.bearer") }, { value: "source", label: t("sujet.source") }]}
                onChange={(subject) => majFin(i, { ...f, subject: subject === "source" ? "source" : "bearer" })}
              />
            )}
            <BoutonPetit onClick={() => maj({ finSi: retirerA(finSi, i) })} danger>
              {t("retirer")}
            </BoutonPetit>
          </div>
        ))}
        <div className="w-fit">
          <BoutonPetit onClick={() => maj({ finSi: [...finSi, { event: "damage_taken", subject: "bearer" }] })}>{t("ajouterFin")}</BoutonPetit>
        </div>
      </div>
    </>
  );
}
