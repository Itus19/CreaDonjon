"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Checkbox from "@/components/shared/Checkbox";
import ChoixSort from "@/components/rules/ChoixSort";
import { EditeurModificateurs } from "@/components/rules/briques/BriqueEffet";
import { BoutonPetit, ChampListe, ChampTexte } from "@/components/rules/briques/ContexteBriques";
import { useWorldRuleEntries } from "@/components/blocks/useWorldRuleEntries";
import { modificateursEcrits, modificateursVersBrouillons, remplacerA, retirerA, type BrouillonModificateur } from "@/lib/ui/briquesRegle";
import { ABILITY_LABELS } from "@/src/core/rules/abilities";
import { RULE_RECHARGES } from "@/src/core/schemas/rule-blocks/playable";
import type { EquippableBlockData } from "@/src/core/schemas/blocks/equippable";

type Action = EquippableBlockData["actions"][number];
type Sort = EquippableBlockData["spells"][number];
const CARACS = ["str", "dex", "con", "int", "wis", "cha"] as const;

/** Une copie sans la clé facultative nommée (une caractéristique ou un lancement gratuit retirés). */
function sans<T extends object, K extends keyof T>(objet: T, cle: K): Omit<T, K> {
  const copie = { ...objet };
  delete copie[cle];
  return copie;
}

/** Un identifiant d'action libre (`action-2`…) : le compteur de charges de la fiche se range sous lui. */
function idAction(pris: readonly Action[]): string {
  const ids = new Set(pris.map((a) => a.id));
  let n = pris.length + 1;
  while (ids.has(`action-${n}`)) n += 1;
  return `action-${n}`;
}

/**
 * AG-19 (ADR 0107) — le bloc « Objet équipable » d'un artéfact : les deux
 * conditions, les effets (mêmes briques que les dons), les sorts accordés et
 * les actions à charges. Rien d'autre : l'histoire de l'objet reste dans ses
 * autres blocs. Les effets passent par un brouillon : une formule mal tapée
 * n'est pas écrite, son erreur s'affiche.
 */
export default function EquippableBlockEditor({ data, onChange, worldSlug }: { data: EquippableBlockData; onChange: (d: EquippableBlockData) => void; worldSlug: string }) {
  const t = useTranslations("fiche.equipable");
  const tSorts = useTranslations("regles.sortsAccordes");
  const regles = useWorldRuleEntries(worldSlug);
  const sorts = regles.filter((e) => e.entryType === "spell").map((e) => ({ key: e.key, name: e.name }));
  const [brouillons, setBrouillons] = useState<BrouillonModificateur[]>(() => modificateursVersBrouillons(data.modifiers));
  const [erreurs, setErreurs] = useState<string[]>([]);

  function majEffets(suivants: BrouillonModificateur[]) {
    setBrouillons(suivants);
    const ecrits = modificateursEcrits(suivants);
    setErreurs(ecrits.erreurs);
    if (ecrits.erreurs.length === 0) onChange({ ...data, modifiers: ecrits.modifiers });
  }
  const majSort = (i: number, s: Sort) => onChange({ ...data, spells: remplacerA(data.spells, i, s) });
  const majAction = (i: number, a: Action) => onChange({ ...data, actions: remplacerA(data.actions, i, a) });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Checkbox checked={data.only_equipped} onChange={() => onChange({ ...data, only_equipped: !data.only_equipped })} label={t("seulementEquipe")} />
        <Checkbox checked={data.requires_attunement} onChange={() => onChange({ ...data, requires_attunement: !data.requires_attunement })} label={t("harmonisation")} />
      </div>

      <section className="flex flex-col gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("effets")}</h4>
        <EditeurModificateurs modificateurs={brouillons} onChange={majEffets} />
        {erreurs.map((e) => (
          <p key={e} className="text-xs text-danger">
            {e}
          </p>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("sorts")}</h4>
        {data.spells.map((s, i) => (
          <div key={s.key} className="flex flex-wrap items-end gap-3 rounded-md border border-edge/60 p-2">
            <span className="rounded-md border border-edge px-2 py-1 text-sm text-ink">{sorts.find((x) => x.key === s.key)?.name ?? s.key}</span>
            <ChampListe
              libelle={t("caracteristique")}
              valeur={s.ability ?? ""}
              options={[{ value: "", label: t("caracteristiqueClasse") }, ...CARACS.map((c) => ({ value: c, label: ABILITY_LABELS[c] }))]}
              onChange={(v) => {
                const ability = CARACS.find((c) => c === v);
                majSort(i, ability ? { ...s, ability } : sans(s, "ability"));
              }}
            />
            <ChampListe
              libelle={tSorts("sansEmplacement")}
              valeur={s.free_cast ? `${s.free_cast.uses}:${s.free_cast.refresh}` : ""}
              options={[
                { value: "", label: tSorts("jamais") },
                { value: "1:long_rest", label: t("uneFoisRepos", { repos: tSorts("reposLong") }) },
                { value: "1:short_rest", label: t("uneFoisRepos", { repos: tSorts("reposCourt") }) },
                { value: "proficiency:long_rest", label: t("maitriseRepos", { repos: tSorts("reposLong") }) },
              ]}
              onChange={(v) => {
                if (v === "") return majSort(i, sans(s, "free_cast"));
                const [uses, refresh] = v.split(":");
                majSort(i, { ...s, free_cast: { uses: uses === "proficiency" ? "proficiency" : 1, refresh: refresh === "short_rest" ? "short_rest" : "long_rest" } });
              }}
            />
            <BoutonPetit danger onClick={() => onChange({ ...data, spells: retirerA(data.spells, i) })}>
              {tSorts("retirer")}
            </BoutonPetit>
          </div>
        ))}
        {data.spells.length < 20 && (
          <ChoixSort
            key={data.spells.length}
            sorts={sorts.filter((x) => !data.spells.some((sp) => sp.key === x.key))}
            value=""
            onChange={(key) => key && onChange({ ...data, spells: [...data.spells, { key }] })}
          />
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("actions")}</h4>
        {data.actions.map((a, i) => (
          <div key={a.id} className="grid gap-3 rounded-md border border-edge/60 p-2 sm:grid-cols-3">
            <ChampTexte libelle={t("nomAction")} valeur={a.name} onChange={(name) => majAction(i, { ...a, name })} />
            <ChampTexte
              libelle={t("charges")}
              valeur={String(a.charges)}
              mecanique
              onChange={(v) => {
                const n = Math.round(Number(v));
                if (Number.isFinite(n)) majAction(i, { ...a, charges: Math.min(50, Math.max(1, n)) });
              }}
            />
            <ChampListe
              libelle={t("recharge")}
              valeur={a.recharge}
              options={RULE_RECHARGES.map((r) => ({ value: r, label: t(`recharges.${r}`) }))}
              onChange={(v) => majAction(i, { ...a, recharge: RULE_RECHARGES.find((r) => r === v) ?? a.recharge })}
            />
            <label className="flex flex-col gap-1 text-xs text-ink-soft sm:col-span-3">
              <span>{t("description")}</span>
              <textarea
                value={a.description ?? ""}
                maxLength={2000}
                rows={2}
                onChange={(e) => majAction(i, { ...a, description: e.target.value })}
                className="w-full rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
              />
            </label>
            <div className="sm:col-span-3">
              <BoutonPetit danger onClick={() => onChange({ ...data, actions: retirerA(data.actions, i) })}>
                {t("retirerAction")}
              </BoutonPetit>
            </div>
          </div>
        ))}
        <div className="w-fit">
          <BoutonPetit
            disabled={data.actions.length >= 10}
            onClick={() => onChange({ ...data, actions: [...data.actions, { id: idAction(data.actions), name: t("nouvelleAction"), charges: 1, recharge: "long_rest" }] })}
          >
            {t("ajouterAction")}
          </BoutonPetit>
        </div>
      </section>
    </div>
  );
}
