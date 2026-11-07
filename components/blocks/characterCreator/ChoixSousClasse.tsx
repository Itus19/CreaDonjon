"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { SousEtape } from "@/lib/ui/cheminCreation";
import { premierePhrase, texteDescription } from "@/lib/ui/texteRegle";
import { renderBlockData } from "@/components/rules/blockContentRenderer";
import { toggleChoice } from "@/components/blocks/characterChoiceUtils";
import { useRuleEntryBlocks, type RuleEntryBlockData } from "../useRuleEntryBlocks";
import FicheSelection, { type LigneFiche } from "./FicheSelection";

/** Les aptitudes d'une sous-classe, lues sans confiance dans le bloc `subclass_features` (traduit par la route). */
export function aptitudesDeSousClasse(blocs: readonly RuleEntryBlockData[] | undefined): { nom: string; niveau: number; texte: string }[] {
  const features = (blocs?.find((b) => b.blockType === "subclass_features")?.data as { features?: unknown } | undefined)?.features;
  if (!Array.isArray(features)) return [];
  return features.flatMap((f) => {
    if (!f || typeof f !== "object") return [];
    const { name, level, description } = f as { name?: unknown; level?: unknown; description?: unknown };
    if (typeof name !== "string" || typeof level !== "number") return [];
    return [{ nom: name, niveau: level, texte: typeof description === "string" ? description : "" }];
  });
}

/** Le compteur « Choisissez-en un. 1 / 1 », commun aux sélecteurs de l'assistant. */
function Compteur({ sous }: { sous: SousEtape }) {
  const t = useTranslations("creation");
  return (
    <p className="text-xs text-ink-muted">
      {sous.nombre > 1 ? t("choisirN", { n: sous.nombre }) : t("choisirUn")}{" "}
      <span className="font-semibold text-accent">{t("compte", { fait: sous.choisis.length, total: sous.nombre })}</span>
    </p>
  );
}

function classeCarte(choisi: boolean): string {
  return `flex min-w-0 flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors aria-disabled:cursor-not-allowed aria-disabled:opacity-45 ${
    choisi ? "border-accent bg-accent/10 text-accent" : "border-edge bg-panel-sunken text-ink hover:bg-panel-raised"
  }`;
}

/**
 * V3.1-174 — La sous-étape « Sous-classe » : les sous-classes du monde pour
 * cette classe en cartes courtes (un ruleset personnel s'y range comme une
 * officielle), et la fiche de la sous-classe touchée — ou à défaut choisie —
 * dessous : ses aptitudes par niveau, dépliables (la fiche de l'espèce,
 * V3.1-172), puis ses propres choix en pastilles. Un seul geste, celui du
 * don d'origine. Les blocs viennent d'UNE requête pour les sous-classes
 * proposées.
 */
export function ChoixSousClasse({
  worldSlug,
  sous,
  naissent,
  onAller,
  onChoisir,
}: {
  worldSlug: string;
  sous: SousEtape;
  /** Les sous-étapes que fait naître une sous-classe choisie (`sousClasse`). */
  naissent: (sousClasse: string) => SousEtape[];
  onAller: (position: string) => void;
  onChoisir: (cle: string | null) => void;
}) {
  const t = useTranslations("creation.sousClasse");
  const blocs = useRuleEntryBlocks(
    worldSlug,
    sous.options.map((o) => o.cle)
  );
  const [touche, setTouche] = useState<string | null>(null);

  if (sous.options.length === 0) {
    return <p className="rounded-md border border-dashed border-edge px-3 py-2 text-sm text-ink-muted">{t("aucune")}</p>;
  }

  const vu = sous.options.find((o) => o.cle === (touche ?? sous.choisis[0]));
  const lignes: LigneFiche[] = vu
    ? aptitudesDeSousClasse(blocs[vu.cle]).map((a) => ({
        nom: `${t("niveau", { n: a.niveau })} · ${a.nom}`,
        ...(a.texte ? { texte: premierePhrase(a.texte), entier: a.texte } : {}),
      }))
    : [];

  return (
    <div className="flex flex-col gap-3">
      <Compteur sous={sous} />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-2">
        {sous.options.map((o) => {
          const choisi = sous.choisis.includes(o.cle);
          const resume = premierePhrase(texteDescription(blocs[o.cle]));
          return (
            <button
              key={o.cle}
              type="button"
              aria-pressed={choisi}
              onClick={() => {
                setTouche(o.cle);
                onChoisir(choisi ? null : o.cle);
              }}
              className={classeCarte(choisi)}
            >
              <span className="font-semibold">{o.libelle ?? o.cle}</span>
              {resume && <span className="w-full truncate text-xs font-normal text-ink-muted">{resume}</span>}
            </button>
          );
        })}
      </div>
      {vu && (
        <FicheSelection
          key={vu.cle}
          worldSlug={worldSlug}
          titre={vu.libelle ?? vu.cle}
          resume={
            texteDescription(blocs[vu.cle])
              .split("\n")
              .map((l) => l.replace(/\*\*/g, "").trim())
              .filter((l) => l !== "")
              .join(" — ") || null
          }
          lignes={lignes}
          naissent={sous.choisis.includes(vu.cle) ? naissent(vu.cle) : []}
          onAller={onAller}
        />
      )}
    </div>
  );
}

/**
 * V3.1-174 — Un choix entre options nommées (Proie du chasseur, Tactiques
 * défensives…) : des cartes courtes, et le texte de l'option touchée — ou à
 * défaut choisie — en entier dessous. Le même geste que le don d'origine
 * (V3.1-172) : un seul partout. `textes` vient de la donnée (la description
 * de l'option, ou son paragraphe dans l'aptitude qui l'accorde).
 */
export function ChoixOptionAvecFiche({
  worldSlug,
  sous,
  textes,
  libelleOption,
  dejaAcquis,
  onChoisir,
}: {
  worldSlug: string;
  sous: SousEtape;
  textes: Readonly<Record<string, string>>;
  libelleOption: (cle: string) => string;
  dejaAcquis: ReadonlySet<string>;
  onChoisir: (valeurs: string[]) => void;
}) {
  const t = useTranslations("creation");
  const [touche, setTouche] = useState<string | null>(null);
  const complet = sous.choisis.length >= sous.nombre;
  const vu = sous.options.find((o) => o.cle === (touche ?? sous.choisis[0]));
  const texteVu = vu ? textes[vu.cle] : "";

  return (
    <div className="flex flex-col gap-3">
      <Compteur sous={sous} />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-2">
        {sous.options.map((o) => {
          const choisi = sous.choisis.includes(o.cle);
          const acquis = !choisi && dejaAcquis.has(o.cle);
          const bloque = acquis || (!choisi && complet && sous.nombre > 1);
          return (
            <button
              key={o.cle}
              type="button"
              aria-pressed={choisi}
              aria-disabled={bloque}
              onClick={() => {
                setTouche(o.cle);
                if (bloque) return;
                onChoisir(sous.nombre === 1 ? (choisi ? [] : [o.cle]) : toggleChoice(sous.choisis, o.cle, sous.nombre));
              }}
              className={`${classeCarte(choisi)} font-semibold`}
            >
              {o.libelle ?? libelleOption(o.cle)}
              {acquis && <span className="text-xs font-normal text-ink-muted">{t("dejaAcquis")}</span>}
            </button>
          );
        })}
      </div>
      {vu && texteVu && (
        <article aria-label={vu.libelle ?? libelleOption(vu.cle)} className="flex flex-col gap-1.5 rounded-md border border-edge/60 bg-panel-sunken p-3">
          <h3 className="font-display text-base font-bold text-ink">{vu.libelle ?? libelleOption(vu.cle)}</h3>
          <div className="text-sm text-ink-soft">{renderBlockData("description", { segments: [{ text: texteVu }] }, worldSlug)}</div>
        </article>
      )}
    </div>
  );
}
