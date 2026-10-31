"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { DescriptionBlockData, SpellCastingBlockData } from "@/src/core/schemas/rule-blocks";
import { MAGIC_SCHOOL_COLOR_VAR, MAGIC_SCHOOL_LABELS_FR } from "@/src/i18n/fr";
import type { RuleEntryBlockData } from "../useRuleEntryBlocks";

function bloc<T>(blocs: RuleEntryBlockData[] | undefined, type: string): T | null {
  const trouve = blocs?.find((b) => b.blockType === type);
  return trouve ? (trouve.data as T) : null;
}

/** L'école d'un sort, avec la teinte de son jeton (ADR 0010). */
export function ecoleDuSort(blocs: RuleEntryBlockData[] | undefined): { libelle: string; couleur: string } | null {
  const incantation = bloc<SpellCastingBlockData>(blocs, "spell_casting");
  if (!incantation) return null;
  return {
    libelle: MAGIC_SCHOOL_LABELS_FR[incantation.school] ?? incantation.school,
    couleur: MAGIC_SCHOOL_COLOR_VAR[incantation.school] ?? "--link-rule",
  };
}

const LONGUEUR_EFFET = 420;

/**
 * V3.1-50 — La fiche du sort touché : école, temps d'incantation, portée,
 * durée, effet. Montrée à côté (ou sous) le sélecteur de sorts ; ne choisit
 * rien. Lit les blocs déjà préchargés par l'assistant.
 */
export default function FicheSort({
  worldSlug,
  cle,
  nom,
  blocs,
}: {
  worldSlug: string;
  cle: string | null;
  nom: string;
  blocs: RuleEntryBlockData[] | undefined;
}) {
  const t = useTranslations("creation.sorts");
  if (!cle) {
    return <p className="rounded-md border border-dashed border-edge px-3 py-2 text-sm text-ink-muted">{t("ficheVide")}</p>;
  }
  const incantation = bloc<SpellCastingBlockData>(blocs, "spell_casting");
  const ecole = ecoleDuSort(blocs);
  const description = bloc<DescriptionBlockData>(blocs, "description");
  const texte = description?.segments.map((s) => s.text).join(" ") ?? "";
  const effet = texte.length > LONGUEUR_EFFET ? `${texte.slice(0, LONGUEUR_EFFET)}…` : texte;
  const lignes: { cle: string; valeur: string }[] = [
    ...(incantation?.casting_time ? [{ cle: t("temps"), valeur: incantation.casting_time }] : []),
    ...(incantation?.range ? [{ cle: t("portee"), valeur: incantation.range }] : []),
    ...(incantation?.duration ? [{ cle: t("duree"), valeur: incantation.concentration ? t("concentration", { duree: incantation.duration }) : incantation.duration }] : []),
  ];

  return (
    <article aria-label={nom} className="flex flex-col gap-2 rounded-md border border-edge bg-panel-sunken p-3">
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-base font-bold text-ink">{nom}</h3>
        {ecole && (
          <span className="rounded-full border px-2 py-0.5 text-xs" style={{ borderColor: `var(${ecole.couleur})`, color: `var(${ecole.couleur})` }}>
            {ecole.libelle}
          </span>
        )}
        {incantation && <span className="text-xs text-ink-muted">{incantation.level === 0 ? t("mineur") : t("niveau", { n: incantation.level })}</span>}
      </header>
      {lignes.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
          {lignes.map((l) => (
            <div key={l.cle} className="contents">
              <dt className="text-xs text-ink-muted">{l.cle}</dt>
              <dd className="text-ink">{l.valeur}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="text-sm text-ink-soft">{effet || t("sansDescription")}</p>
      <Link href={`/m/${worldSlug}/regles/${cle}`} target="_blank" rel="noreferrer" className="w-fit text-xs no-underline hover:underline" style={{ color: "var(--link-rule)" }}>
        {t("voirRegle")}
      </Link>
    </article>
  );
}
