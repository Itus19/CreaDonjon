"use client";

import { useTranslations } from "next-intl";
import Checkbox from "@/components/shared/Checkbox";
import { ARMURES, PROPRIETES_ARME, basculerDans, type BrouillonCondition } from "@/lib/ui/briquesRegle";
import { ChampListe } from "@/components/rules/briques/ContexteBriques";

/**
 * V3.1-170 (ADR 0077) — « Seulement si… » : la condition d'équipement d'un
 * modificateur ou d'une activation. Cases à cocher, sans JSON : armure portée
 * (l'une des cochées), bouclier, propriété de l'arme tenue (l'une suffit).
 * Rien de coché : aucune condition.
 */
export default function ConditionEquipement({ condition, onChange }: { condition: BrouillonCondition; onChange: (c: BrouillonCondition) => void }) {
  const t = useTranslations("regles.briques.condition");
  const proprietes = [...PROPRIETES_ARME, ...condition.armes.filter((a) => !(PROPRIETES_ARME as readonly string[]).includes(a))];
  return (
    <fieldset className="flex flex-col gap-2 rounded-md border border-edge/60 p-2 sm:col-span-2 lg:col-span-3">
      <legend className="px-1 text-xs font-medium uppercase tracking-wide text-ink-muted">{t("titre")}</legend>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-ink-soft">{t("armure")}</span>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {ARMURES.map((a) => (
            <Checkbox key={a} checked={condition.armures.includes(a)} onChange={() => onChange({ ...condition, armures: basculerDans(condition.armures, a) })} label={t(`armures.${a}`)} />
          ))}
        </div>
      </div>
      <div className="max-w-xs">
        <ChampListe
          libelle={t("bouclier")}
          valeur={condition.bouclier}
          options={[
            { value: "", label: t("peuImporte") },
            { value: "oui", label: t("avecBouclier") },
            { value: "non", label: t("sansBouclier") },
          ]}
          onChange={(v) => onChange({ ...condition, bouclier: v === "oui" || v === "non" ? v : "" })}
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-ink-soft">{t("arme")}</span>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {proprietes.map((p) => (
            <Checkbox key={p} checked={condition.armes.includes(p)} onChange={() => onChange({ ...condition, armes: basculerDans(condition.armes, p) })} label={t.has(`proprietes.${p}`) ? t(`proprietes.${p}`) : p} />
          ))}
        </div>
      </div>
    </fieldset>
  );
}
