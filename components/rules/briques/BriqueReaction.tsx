"use client";

import { useTranslations } from "next-intl";
import Checkbox from "@/components/shared/Checkbox";
import Dropdown from "@/components/shared/Dropdown";
import { REACTION_ROLLS, REACTION_SUBJECTS } from "@/src/core/schemas/rule-blocks/playable";
import {
  avecDeclencheur,
  momentsPermis,
  nouvelleOperation,
  operationsPermises,
  remplacerA,
  retirerA,
  type BrouillonActivation,
  type BrouillonOperation,
  type JetReaction,
  type LimiteReaction,
  type MomentReaction,
  type SujetReaction,
} from "@/lib/ui/briquesRegle";
import ChampFormule from "@/components/rules/briques/ChampFormule";
import { BoutonPetit, CarteBrique, ChampListe, ChampTexte } from "@/components/rules/briques/ContexteBriques";

/**
 * V3.1-161 (ADR 0075) — « En réaction à un jet » : le déclencheur, les
 * opérations sur le jet et la limite d'une activation. Que des listes et des
 * champs de formule, jamais de JSON. Les choix qui n'ont pas de sens pour le
 * jet visé ne sont pas proposés (`momentsPermis`, `operationsPermises`).
 */
export default function ReactionEditeur({ activation: a, onChange }: { activation: BrouillonActivation; onChange: (a: BrouillonActivation) => void }) {
  const t = useTranslations("regles.briques.reaction");
  const d = a.declencheur;
  const permises = d ? operationsPermises(d.jet) : [];

  return (
    <div className="flex flex-col gap-3">
      <ChampListe
        libelle={t("declenchement")}
        valeur={d ? "reaction" : "clic"}
        options={[
          { value: "clic", label: t("auClic") },
          { value: "reaction", label: t("enReaction") },
        ]}
        onChange={(v) => onChange(avecDeclencheur(a, v === "reaction" ? {} : null))}
      />

      {d && (
        <CarteBrique uid={`${a.uid}:declencheur`} titre={t("declencheur")}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ChampListe
              libelle={t("jetVise")}
              valeur={d.jet}
              options={REACTION_ROLLS.map((x) => ({ value: x, label: t(`jets.${x}`) }))}
              onChange={(v) => onChange(avecDeclencheur(a, { jet: (REACTION_ROLLS.find((x) => x === v) ?? d.jet) as JetReaction }))}
            />
            <ChampListe
              libelle={t("deQui")}
              valeur={d.sujet}
              options={REACTION_SUBJECTS.map((x) => ({ value: x, label: t(`sujets.${x}`) }))}
              onChange={(v) => onChange(avecDeclencheur(a, { sujet: (REACTION_SUBJECTS.find((x) => x === v) ?? d.sujet) as SujetReaction }))}
            />
            <ChampListe
              libelle={t("quand")}
              valeur={d.moment}
              options={momentsPermis(d.jet).map((x) => ({ value: x, label: t(`moments.${x}`) }))}
              onChange={(v) => onChange(avecDeclencheur(a, { moment: (momentsPermis(d.jet).find((x) => x === v) ?? d.moment) as MomentReaction }))}
            />
          </div>
          {d.moment === "natural" && <ChampTexte libelle={t("valeurDuD20")} valeur={d.naturel} onChange={(naturel) => onChange(avecDeclencheur(a, { naturel }))} mecanique />}
          <Checkbox checked={d.automatique} onChange={() => onChange(avecDeclencheur(a, { automatique: !d.automatique }))} label={t("automatique")} />
        </CarteBrique>
      )}

      {d && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">{t("operations")}</span>
          {a.operations.map((o, i) => (
            <CarteBrique
              key={o.uid}
              uid={o.uid}
              titre={t(`op.${o.op}`)}
              actions={
                <BoutonPetit onClick={() => onChange({ ...a, operations: retirerA(a.operations, i) })} danger>
                  {t("retirer")}
                </BoutonPetit>
              }
            >
              <ChampsOperation operation={o} onChange={(n) => onChange({ ...a, operations: remplacerA(a.operations, i, n) })} />
            </CarteBrique>
          ))}
          <div className="w-fit">
            <Dropdown
              value=""
              options={[{ value: "", label: t("ajouterOperation") }, ...permises.map((op) => ({ value: op, label: t(`op.${op}`) }))]}
              onChange={(v) => {
                const op = permises.find((x) => x === v);
                if (op) onChange({ ...a, operations: [...a.operations, nouvelleOperation(op)] });
              }}
              aria-label={t("ajouterOperation")}
            />
          </div>
        </div>
      )}

      <ChampListe
        libelle={t("limite")}
        valeur={a.limite ?? "aucune"}
        options={[
          { value: "aucune", label: t("limites.aucune") },
          { value: "turn", label: t("limites.turn") },
          { value: "round", label: t("limites.round") },
        ]}
        onChange={(v) => onChange({ ...a, limite: v === "turn" || v === "round" ? (v as LimiteReaction) : null })}
      />
    </div>
  );
}

function ChampsOperation({ operation: o, onChange }: { operation: BrouillonOperation; onChange: (o: BrouillonOperation) => void }) {
  const t = useTranslations("regles.briques.reaction");
  switch (o.op) {
    case "add_die":
      return (
        <div className="grid gap-3 sm:grid-cols-3">
          <ChampListe
            libelle={t("signe")}
            valeur={String(o.signe)}
            options={[
              { value: "1", label: t("ajoute") },
              { value: "-1", label: t("retranche") },
            ]}
            onChange={(v) => onChange({ ...o, signe: v === "-1" ? -1 : 1 })}
          />
          <ChampFormule libelle={t("nombreDeDes")} valeur={o.nombre} onChange={(nombre) => onChange({ ...o, nombre })} />
          <ChampFormule libelle={t("facesDuDe")} valeur={o.faces} onChange={(faces) => onChange({ ...o, faces })} />
        </div>
      );
    case "reroll":
      return <ChampFormule facultatif libelle={t("bonusApresRelance")} valeur={o.bonus} onChange={(bonus) => onChange({ ...o, bonus })} />;
    case "set_natural":
      return <ChampTexte libelle={t("valeurDuD20")} valeur={o.valeur} onChange={(valeur) => onChange({ ...o, valeur })} mecanique />;
    case "ac_bonus":
      return <ChampFormule libelle={t("bonusDeCa")} valeur={o.valeur} onChange={(valeur) => onChange({ ...o, valeur })} />;
    case "damage_multiplier":
      return <ChampTexte libelle={t("facteur")} valeur={o.facteur} onChange={(facteur) => onChange({ ...o, facteur })} mecanique />;
    case "add_damage":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <ChampFormule libelle={t("degatsEnPlus")} valeur={o.formule} onChange={(formule) => onChange({ ...o, formule })} />
          <ChampTexte libelle={t("typeDeDegats")} valeur={o.typeDegats} onChange={(typeDegats) => onChange({ ...o, typeDegats })} mecanique />
        </div>
      );
  }
}
