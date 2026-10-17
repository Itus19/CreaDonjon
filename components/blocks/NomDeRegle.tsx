"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import type { RuleEntryDetail } from "@/src/server/services/rules";
import FeuilleDuBas from "@/components/shared/FeuilleDuBas";
import { useOpenRuleLink } from "@/components/shell/useOpenRuleLink";
import { useMatchMedia, WINDOWS_MOBILE_QUERY } from "@/components/shell/useMatchMedia";
import { windowHref } from "@/components/shell/windowRefs";

/** Chargée à la demande : la fiche d'une règle n'entre pas dans le code de la fiche de personnage tant qu'on n'en touche pas une. */
const RuleEntryView = dynamic(() => import("@/components/rules/RuleEntryView"), {
  ssr: false,
  loading: () => <p className="text-sm text-ink-muted">Chargement...</p>,
});

/** Nom souligné en pointillé, couleur des règles : le même sur téléphone (bouton) et sur ordinateur (lien). */
const CLASSE_NOM = "cursor-pointer underline decoration-dotted underline-offset-2 hover:opacity-80";
const STYLE_NOM = { color: "var(--link-rule)" } as const;

/**
 * Contenu de la feuille : monté seulement quand la feuille est ouverte, donc
 * la règle n'est demandée qu'au toucher (docs/CABLAGE.md, C1). Même route de
 * données que les fenêtres du bureau ; `playerRestricted` = lecture seule,
 * sans les gestes d'édition d'une règle maison, pour le MJ comme pour le joueur.
 */
function ContenuRegle({ worldSlug, ruleKey }: { worldSlug: string; ruleKey: string }) {
  // Cote joueur, la page de la regle est la sienne (`/joueur/regles/…`) : le
  // chemin MJ ne le redirigeait pas jusque-la (verifie a 390 px, le joueur
  // restait sur sa fiche).
  const pathname = usePathname();
  const hrefRegle = pathname.startsWith(`/m/${worldSlug}/joueur`)
    ? `/m/${worldSlug}/joueur/regles/${encodeURIComponent(ruleKey)}`
    : windowHref(worldSlug, { kind: "rule", key: ruleKey });
  const [entry, setEntry] = useState<RuleEntryDetail | null>(null);
  const [introuvable, setIntrouvable] = useState(false);

  useEffect(() => {
    let annule = false;
    fetch(`/api/worlds/${worldSlug}/regles/${ruleKey}/window`)
      .then((res) => (res.ok ? (res.json() as Promise<RuleEntryDetail>) : Promise.reject(new Error(`regle : ${res.status}`))))
      .then((corps) => {
        if (!annule) setEntry(corps);
      })
      .catch((erreur: unknown) => {
        console.error("Règle non chargée", erreur);
        if (!annule) setIntrouvable(true);
      });
    return () => {
      annule = true;
    };
  }, [worldSlug, ruleKey]);

  return (
    <div className="flex flex-col gap-3">
      {introuvable ? (
        <p className="text-sm text-danger">Fiche de règle introuvable ou plus visible.</p>
      ) : entry ? (
        <RuleEntryView entry={entry} worldSlug={worldSlug} playerRestricted />
      ) : (
        <p className="text-sm text-ink-muted">Chargement...</p>
      )}
      <Link
        href={hrefRegle}
        className="sticky bottom-0 block rounded-full border border-edge bg-panel-raised px-4 py-2 text-center text-sm font-medium text-ink no-underline hover:bg-panel"
      >
        Ouvrir dans Règles
      </Link>
    </div>
  );
}

/**
 * Nom d'une règle sur la fiche (V3.1-32) : arme, sort, objet, aptitude, état,
 * épuisement, concentration d'un sort. Un seul composant, deux gestes :
 *
 * - sous 768 px : un bouton qui ouvre la règle dans une feuille du bas, avec
 *   « Ouvrir dans Règles » en bas ;
 * - au-dessus : le lien d'avant, qui ouvre la règle en fenêtre (`useOpenRuleLink`).
 *
 * N'est à utiliser que pour un nom qui A une clé de règle : sans clé, le nom reste du texte.
 */
export default function NomDeRegle({
  worldSlug,
  ruleKey,
  children,
  className = "",
}: {
  worldSlug: string;
  ruleKey: string;
  children: string;
  className?: string;
}) {
  const telephone = useMatchMedia(WINDOWS_MOBILE_QUERY);
  const lien = useOpenRuleLink(worldSlug, ruleKey);
  const [ouverte, setOuverte] = useState(false);

  if (!telephone) {
    return (
      <Link href={lien.href} onClick={lien.onClick} className={`${CLASSE_NOM} ${className}`} style={STYLE_NOM}>
        {children}
      </Link>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOuverte(true)}
        aria-haspopup="dialog"
        className={`${CLASSE_NOM} text-left ${className}`}
        style={STYLE_NOM}
      >
        {children}
      </button>
      {ouverte && (
        <FeuilleDuBas titre={children} titreVisible onFermer={() => setOuverte(false)}>
          <ContenuRegle worldSlug={worldSlug} ruleKey={ruleKey} />
        </FeuilleDuBas>
      )}
    </>
  );
}
