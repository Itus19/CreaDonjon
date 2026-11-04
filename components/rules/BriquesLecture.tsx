"use client";

import { useTranslations } from "next-intl";
import { ABILITY_LABELS } from "@/src/core/rules/abilities";
import type { Ability } from "@/src/core/rules/sheet";
import { formatFormulaNode } from "@/src/core/formula";
import type { EffectNode } from "@/src/core/rules/triggers";
import type { ActivationBlockData, CoverageBlockData, DurableEffect, RuleResourcesBlockData } from "@/src/core/schemas/rule-blocks/playable";
import { libelleFr } from "@/lib/ui/briquesRegle";

type Traduire = ReturnType<typeof useTranslations>;

/** Un petit libellé en capitales, comme `lbl` de la planche. */
function Etiquette({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">{children}</span>;
}

function Puce({ children, pointille }: { children: React.ReactNode; pointille?: boolean }) {
  return (
    <span className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs text-ink-soft ${pointille ? "border-dashed border-danger" : "border-edge"}`}>{children}</span>
  );
}

function dureeTexte(d: DurableEffect["duration"], t: Traduire): string {
  if (d.unit === "until_turn_end") return t(`lecture.duree.until_turn_end_${d.which}`, { qui: t(`sujet.${d.whose}`) });
  if (d.unit === "until_rest" || d.unit === "permanent") return t(`lecture.duree.${d.unit}`);
  return t(`lecture.duree.${d.unit}`, { n: d.amount });
}

function finTexte(f: DurableEffect["ends_on"][number], t: Traduire): string {
  return f.event === "dismissed" ? t("evenements.dismissed") : `${t(`evenements.${f.event}`)} (${t(`sujet.${f.subject}`)})`;
}

function decrire(e: EffectNode, durables: ReadonlyMap<string, DurableEffect>, t: Traduire): { titre: string; detail?: string; dure?: boolean } {
  switch (e.action) {
    case "saving_throw":
      return { titre: t("lecture.sauvegarde", { carac: ABILITY_LABELS[e.ability as Ability] ?? e.ability }), detail: t("lecture.dd", { dd: formatFormulaNode(e.dc) }) };
    case "deal_damage":
      return { titre: t("lecture.degats", { montant: formatFormulaNode(e.amount) }), detail: e.damage_type };
    case "heal":
      return { titre: t("lecture.soins", { montant: formatFormulaNode(e.amount) }) };
    case "apply_condition":
      return { titre: t("lecture.appliquerEtat", { etat: e.key }) };
    case "remove_condition":
      return { titre: t("lecture.retirerEtat", { etat: e.key }) };
    case "apply_effect": {
      const d = durables.get(e.effect);
      if (!d) return { titre: t("lecture.appliquerEtat", { etat: e.effect }) };
      const fin = d.ends_on.length > 0 ? ` · ${t("lecture.priseFin", { quand: d.ends_on.map((f) => finTexte(f, t)).join(", ") })}` : "";
      return {
        titre: t("lecture.appliquerEtat", { etat: libelleFr(d.label) }),
        detail: `${t("lecture.dureeDe", { duree: dureeTexte(d.duration, t) })}${d.concentration ? ` · ${t("concentration")}` : ""}${fin}`,
        dure: true,
      };
    }
    case "apply_modifier":
      return { titre: t("lecture.modificateur", { libelle: e.modifier.label }) };
    case "grant_budget":
      return { titre: t("lecture.budget", { genre: t(`budget.${e.kind}`), montant: formatFormulaNode(e.amount) }) };
    case "move":
      return { titre: t("lecture.deplacement", { zone: t(`zones.${e.zone}`) }) };
    case "roll":
      return { titre: t("lecture.jet", { libelle: e.label }), detail: formatFormulaNode(e.formula) };
    case "narrate_hint":
      return { titre: t("lecture.indication"), detail: e.text };
    case "spend_resource":
      return { titre: t("lecture.depense", { montant: formatFormulaNode(e.amount), cle: e.key }) };
    case "grant_inspiration":
      return { titre: t("lecture.inspiration") };
  }
}

/** Les numéros des effets d'une activation, dans l'ordre de lecture (branches comprises). */
function numeroter(listes: readonly (readonly EffectNode[])[]): Map<EffectNode, number> {
  const numeros = new Map<EffectNode, number>();
  const parcourir = (liste: readonly EffectNode[]) => {
    for (const e of liste) {
      numeros.set(e, numeros.size + 1);
      if (e.action === "saving_throw") {
        parcourir(e.on_fail ?? []);
        parcourir(e.on_pass ?? []);
      }
    }
  };
  listes.forEach(parcourir);
  return numeros;
}

function LigneEffet({ numero, effet, durables, t }: { numero: number; effet: EffectNode; durables: ReadonlyMap<string, DurableEffect>; t: Traduire }) {
  const d = decrire(effet, durables, t);
  return (
    <div className="flex items-center gap-3 rounded-lg border border-edge bg-panel-sunken p-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-edge font-mech text-xs text-ink-soft">{numero}</span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium text-ink">{d.titre}</span>
        {d.detail && <span className="text-xs text-ink-soft">{d.detail}</span>}
      </div>
      {d.dure && <Puce>{t("lecture.effetQuiDure")}</Puce>}
    </div>
  );
}

/** Les effets numérotés à travers les branches de sauvegarde : « si la cible échoue », « si elle réussit ». */
function ListeLecture({ effets, numeros, durables, t }: { effets: readonly EffectNode[]; numeros: ReadonlyMap<EffectNode, number>; durables: ReadonlyMap<string, DurableEffect>; t: Traduire }) {
  return (
    <div className="flex flex-col gap-2">
      {effets.map((e, i) => {
        const numero = numeros.get(e) ?? 0;
        return (
          <div key={i} className="flex flex-col gap-2">
            <LigneEffet numero={numero} effet={e} durables={durables} t={t} />
            {e.action === "saving_throw" && e.on_fail && e.on_fail.length > 0 && (
              <div className="ml-6 flex flex-col gap-2 border-l-2 border-dashed border-edge pl-4">
                <Etiquette>{t("lecture.siEchec")}</Etiquette>
                <ListeLecture effets={e.on_fail} numeros={numeros} durables={durables} t={t} />
              </div>
            )}
            {e.action === "saving_throw" && e.on_pass && e.on_pass.length > 0 && (
              <div className="ml-6 flex flex-col gap-2 border-l-2 border-dashed border-edge pl-4">
                <Etiquette>{t("lecture.siReussite")}</Etiquette>
                <ListeLecture effets={e.on_pass} numeros={numeros} durables={durables} t={t} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Cout({ cout, t }: { cout: ActivationBlockData["activations"][number]["cost"]; t: Traduire }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-edge bg-panel-sunken p-3">
      <Etiquette>{t("cout")}</Etiquette>
      <span className="text-sm text-ink">{t(`actions.${cout.action}`)}</span>
      {cout.resources.map((r, i) => (
        <span key={i} className="font-mech text-xs text-ink-soft">
          − {formatFormulaNode(r.amount)} {r.key}
        </span>
      ))}
    </div>
  );
}

function LectureActivation({ data, t }: { data: ActivationBlockData; t: Traduire }) {
  const durables = new Map(data.durable_effects.map((d) => [d.id, d]));
  return (
    <div className="flex flex-col gap-5">
      {data.activations.map((a) => {
        const numeros = numeroter([a.effects, ...(a.variants ?? []).map((v) => v.effects)]);
        const cibles = a.targets;
        return (
          <div key={a.id} className="flex flex-col gap-3">
            <span className="text-sm font-semibold text-ink">{libelleFr(a.label)}</span>
            <div className="grid gap-3 sm:grid-cols-2">
              <Cout cout={a.cost} t={t} />
              <div className="flex flex-col gap-1 rounded-lg border border-edge bg-panel-sunken p-3">
                <Etiquette>{t("cibles")}</Etiquette>
                <span className="text-sm text-ink">
                  {t(`genresCible.${cibles.kind}`)}
                  {cibles.range ? `, ${cibles.range.value} m` : ""}
                  {cibles.must_see ? ` · ${t("lecture.visibles")}` : ""}
                </span>
                {cibles.count && <span className="font-mech text-xs text-ink-soft">{formatFormulaNode(cibles.count)}</span>}
              </div>
            </div>
            {a.effects.length > 0 && (
              <div className="flex flex-col gap-2">
                <Etiquette>{t("lecture.effetsSurCible")}</Etiquette>
                <ListeLecture effets={a.effects} numeros={numeros} durables={durables} t={t} />
              </div>
            )}
            {(a.variants ?? []).map((v) => (
              <div key={v.id} className="flex flex-col gap-2 rounded-lg border border-edge p-3">
                <span className="text-sm font-medium text-ink">{t("lecture.variante", { nom: libelleFr(v.label) })}</span>
                {v.cost && <Cout cout={v.cost} t={t} />}
                <ListeLecture effets={v.effects} numeros={numeros} durables={durables} t={t} />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function LectureRessources({ data, t }: { data: RuleResourcesBlockData; t: Traduire }) {
  return (
    <div className="flex flex-col gap-2">
      {data.resources.map((r) => (
        <div key={r.key} className="flex flex-wrap items-center gap-3 rounded-lg border border-edge bg-panel-sunken p-3">
          <span className="min-w-0 flex-1 text-sm font-medium text-ink">{libelleFr(r.label)}</span>
          <span className="font-mech text-xs text-ink-soft">{t("lecture.maximum", { formule: formatFormulaNode(r.max) })}</span>
          <Puce>{t(`recharges.${r.recharge}`)}</Puce>
        </div>
      ))}
    </div>
  );
}

function LectureCouverture({ data, t }: { data: CoverageBlockData; t: Traduire }) {
  return (
    <div className="flex flex-col gap-2">
      {data.gaps.map((g, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-dashed border-danger p-3">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-medium text-ink">« {g.text} »</span>
            <span className="text-xs text-ink-soft">{g.missing}</span>
          </div>
          <Puce pointille>{t("lecture.resteEnTexte")}</Puce>
        </div>
      ))}
    </div>
  );
}

export const BLOCS_BRIQUES = ["resources", "activation", "coverage"] as const;

/** V3.1-132 — le rendu des blocs `resources`, `activation` et `coverage` sur la fiche (planche « Fiche terminée »). */
export default function BriquesLecture({ blockType, data }: { blockType: (typeof BLOCS_BRIQUES)[number]; data: unknown }) {
  const t = useTranslations("regles.briques");
  if (blockType === "resources") return <LectureRessources data={data as RuleResourcesBlockData} t={t} />;
  if (blockType === "activation") return <LectureActivation data={data as ActivationBlockData} t={t} />;
  return <LectureCouverture data={data as CoverageBlockData} t={t} />;
}
