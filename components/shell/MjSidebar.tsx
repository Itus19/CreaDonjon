"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import SectionToggle from "./SectionToggle";
import { useOpenMjToolLink } from "./useOpenMjToolLink";
import { mjToolHref, type MjToolKey } from "./windowRefs";
import { useChatUnread } from "./useChatUnread";

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
 *
 * Chaque outil s'ouvre desormais en fenetre flottante (retour utilisateur,
 * V2-M7 suite : "les fenetres des outils MJ [...] comme celles des regles
 * ou du wiki") — `useOpenMjToolLink` (meme motif que `useOpenEntityLink`/
 * `useOpenRuleLink`) intercepte le clic normal, jamais un lien plein-page
 * qui fermerait les autres fenetres deja ouvertes.
 */
function MjToolLink({
  worldSlug,
  toolKey,
  label,
  active,
  badge,
  onNavigate,
}: {
  worldSlug: string;
  toolKey: MjToolKey;
  label: string;
  active: boolean;
  badge?: number;
  onNavigate: () => void;
}) {
  const link = useOpenMjToolLink(worldSlug, toolKey);
  return (
    <Link
      href={link.href}
      onClick={(e) => {
        link.onClick(e);
        onNavigate();
      }}
      className={`flex items-center justify-between rounded px-2 py-1.5 text-sm transition-colors hover:bg-panel-raised ${
        active ? "bg-panel-raised text-accent" : "text-ink-soft"
      }`}
    >
      {label}
      {!!badge && (
        <span className="ml-2 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold leading-none text-accent-ink">{badge}</span>
      )}
    </Link>
  );
}

export default function MjSidebar({ worldSlug }: { worldSlug: string }) {
  const t = useTranslations("mj");
  const tShell = useTranslations("shell");
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { unreadCount } = useChatUnread();

  const tools: { key: MjToolKey; label: string }[] = [
    { key: "calendrier", label: t("calendrier") },
    { key: "chat", label: t("chat") },
    { key: "creation-personnage", label: t("creationPersonnage") },
    { key: "generateurs", label: t("generateurs") },
    { key: "gestion-campagne", label: t("gestionCampagne") },
    { key: "initiative", label: t("initiative") },
    { key: "journal-historique", label: t("journalHistorique") },
    { key: "personnalisation", label: t("personnalisation") },
    { key: "probabilites", label: t("probabilites") },
    { key: "publication", label: t("publication") },
    { key: "regles-actives", label: t("reglesActives") },
    { key: "rencontres", label: t("rencontres") },
  ];

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
        {tools.map((tool) => (
          <MjToolLink
            key={tool.key}
            worldSlug={worldSlug}
            toolKey={tool.key}
            label={tool.label}
            active={pathname === mjToolHref(worldSlug, tool.key)}
            badge={tool.key === "chat" ? unreadCount : undefined}
            onNavigate={() => setOpen(false)}
          />
        ))}

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
