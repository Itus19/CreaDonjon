"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import SectionToggle from "./SectionToggle";

/**
 * Barre laterale du Compagnon MJ (nouvel onglet, meme repli mobile que
 * RulesSidebar/Sidebar) : campagnes, probabilites (V1-E5), rencontres
 * (V1-E3) et initiative (V1-E4) — tous remontes de la V2 sur demande
 * explicite de l'utilisateur (docs/SCHEMA.md §7, specs/outils-mj.md §8).
 * Personnalisation/Regles actives/Publication (retour utilisateur, gomme
 * le bouton ⚙ global) : ex-onglets du menu de reglages, chacun sa propre
 * page ici plutot qu'un modal — meme profil que les autres entrees.
 * Tables aleatoires/bloc-notes restent en reserve. Les entrees reservees
 * restent visibles (pas de fonctionnalite cachee) mais desactivees.
 *
 * Liste triee par ordre alphabetique (retour utilisateur) — jamais par
 * ordre d'ajout : verifie avec `localeCompare(..., "fr")` plutot que suppose.
 */
export default function MjSidebar({ worldSlug }: { worldSlug: string }) {
  const t = useTranslations("mj");
  const tShell = useTranslations("shell");
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isCalendrier = pathname === `/m/${worldSlug}/mj/calendrier`;
  const isCampagnes = pathname === `/m/${worldSlug}/mj`;
  const isCreationPersonnage = pathname === `/m/${worldSlug}/mj/creation-personnage`;
  const isInitiative = pathname === `/m/${worldSlug}/mj/initiative`;
  const isPersonnalisation = pathname === `/m/${worldSlug}/mj/personnalisation`;
  const isProbabilites = pathname === `/m/${worldSlug}/mj/probabilites`;
  const isPublication = pathname === `/m/${worldSlug}/mj/publication`;
  const isReglesActives = pathname === `/m/${worldSlug}/mj/regles-actives`;
  const isRencontres = pathname === `/m/${worldSlug}/mj/rencontres`;

  const reserved = [t("tablesAleatoires"), t("blocNotes")];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={tShell("ouvrirArborescence")}
        className="fixed left-3 top-[68px] z-40 rounded-md border border-edge bg-panel-raised p-2 text-sm text-ink shadow-md md:hidden"
      >
        ☰
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-scrim md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 top-14 z-50 flex w-[280px] shrink-0 flex-col gap-1 border-r border-edge bg-panel-sunken p-4 transition-transform md:static md:top-0 md:z-auto md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SectionToggle worldSlug={worldSlug} />
        <Link
          href={`/m/${worldSlug}/mj/calendrier`}
          onClick={() => setOpen(false)}
          className={`rounded px-2 py-1.5 text-sm transition-colors hover:bg-panel-raised ${
            isCalendrier ? "bg-panel-raised text-accent" : "text-ink-soft"
          }`}
        >
          {t("calendrier")}
        </Link>

        <Link
          href={`/m/${worldSlug}/mj`}
          onClick={() => setOpen(false)}
          className={`rounded px-2 py-1.5 text-sm transition-colors hover:bg-panel-raised ${
            isCampagnes ? "bg-panel-raised text-accent" : "text-ink-soft"
          }`}
        >
          {t("campagnes")}
        </Link>

        <Link
          href={`/m/${worldSlug}/mj/creation-personnage`}
          onClick={() => setOpen(false)}
          className={`rounded px-2 py-1.5 text-sm transition-colors hover:bg-panel-raised ${
            isCreationPersonnage ? "bg-panel-raised text-accent" : "text-ink-soft"
          }`}
        >
          {t("creationPersonnage")}
        </Link>

        <Link
          href={`/m/${worldSlug}/mj/initiative`}
          onClick={() => setOpen(false)}
          className={`rounded px-2 py-1.5 text-sm transition-colors hover:bg-panel-raised ${
            isInitiative ? "bg-panel-raised text-accent" : "text-ink-soft"
          }`}
        >
          {t("initiative")}
        </Link>

        <Link
          href={`/m/${worldSlug}/mj/personnalisation`}
          onClick={() => setOpen(false)}
          className={`rounded px-2 py-1.5 text-sm transition-colors hover:bg-panel-raised ${
            isPersonnalisation ? "bg-panel-raised text-accent" : "text-ink-soft"
          }`}
        >
          {t("personnalisation")}
        </Link>

        <Link
          href={`/m/${worldSlug}/mj/probabilites`}
          onClick={() => setOpen(false)}
          className={`rounded px-2 py-1.5 text-sm transition-colors hover:bg-panel-raised ${
            isProbabilites ? "bg-panel-raised text-accent" : "text-ink-soft"
          }`}
        >
          {t("probabilites")}
        </Link>

        <Link
          href={`/m/${worldSlug}/mj/publication`}
          onClick={() => setOpen(false)}
          className={`rounded px-2 py-1.5 text-sm transition-colors hover:bg-panel-raised ${
            isPublication ? "bg-panel-raised text-accent" : "text-ink-soft"
          }`}
        >
          {t("publication")}
        </Link>

        <Link
          href={`/m/${worldSlug}/mj/regles-actives`}
          onClick={() => setOpen(false)}
          className={`rounded px-2 py-1.5 text-sm transition-colors hover:bg-panel-raised ${
            isReglesActives ? "bg-panel-raised text-accent" : "text-ink-soft"
          }`}
        >
          {t("reglesActives")}
        </Link>

        <Link
          href={`/m/${worldSlug}/mj/rencontres`}
          onClick={() => setOpen(false)}
          className={`rounded px-2 py-1.5 text-sm transition-colors hover:bg-panel-raised ${
            isRencontres ? "bg-panel-raised text-accent" : "text-ink-soft"
          }`}
        >
          {t("rencontres")}
        </Link>

        <div className="mt-3 flex flex-col gap-1 border-t border-edge/60 pt-3">
          {/* V2-S1 : ecran jetable de l'experience, garde comme trace — pas une fonctionnalite du produit, jamais scope au monde courant (fixture dediee, docs/adr/0009-viabilite-solo.md). */}
          <a
            href="/spike-solo"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded px-2 py-1.5 text-sm text-ink-muted transition-colors hover:bg-panel-raised hover:text-ink-soft"
            title="Ecran d'experience V2-S1 — fixture dediee, sans rapport avec ce monde"
          >
            {t("spikeSolo")}
          </a>
        </div>

        <div className="mt-3 flex flex-col gap-1 border-t border-edge/60 pt-3">
          {reserved.map((label) => (
            <span
              key={label}
              className="flex items-center justify-between rounded px-2 py-1.5 text-sm text-ink-muted opacity-60"
              title={t("bientot")}
            >
              {label}
              <span className="text-[10px] uppercase tracking-wider">{t("bientot")}</span>
            </span>
          ))}
        </div>
      </aside>
    </>
  );
}
