"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { classeItemFlyout, IconeRail, OutilsDalle, Rail, RailFilet, RailPart, RailRow, useRailReplie } from "./Rail";
import SectionToggle, { SectionRailRows } from "./SectionToggle";
import { EnTeteRail } from "./WorldSidebarHeader";
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
 * V2.1-2 : bloc-notes quitte la reserve et devient un outil actif (cahier
 * de notes MJ, `app/m/[worldSlug]/mj/notes/page.tsx`) ; "Tables aleatoires"
 * retire de la reserve (retour utilisateur, aucun besoin concret identifie
 * pour l'instant — a reproposer le jour d'un cas reel).
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
  dansMenu = false,
}: {
  worldSlug: string;
  toolKey: MjToolKey;
  label: string;
  active: boolean;
  badge?: number;
  onNavigate?: () => void;
  /** Rendu dans le menu flottant du rail replie (V3.1-27) : memes liens, habillage de menu. */
  dansMenu?: boolean;
}) {
  const link = useOpenMjToolLink(worldSlug, toolKey);
  return (
    <Link
      href={link.href}
      role={dansMenu ? "menuitem" : undefined}
      onClick={(e) => {
        link.onClick(e);
        onNavigate?.();
      }}
      className={
        dansMenu
          ? `flex items-center justify-between ${classeItemFlyout(active)}`
          : `flex items-center justify-between rounded px-2 py-1.5 text-sm transition-colors hover:bg-panel-raised ${
              active ? "bg-panel-raised text-accent" : "text-ink-soft"
            }`
      }
    >
      {label}
      {!!badge && (
        <span className="ml-2 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold leading-none text-accent-ink">{badge}</span>
      )}
    </Link>
  );
}

export default function MjSidebar({
  worldSlug,
  worldName,
  campaignName,
}: {
  worldSlug: string;
  worldName: string;
  /** Seule section a l'afficher, comme le faisait l'en-tete avant V2.1-16 — `null` si le monde n'a pas encore de campagne. */
  campaignName: string | null;
}) {
  const t = useTranslations("mj");
  const tShell = useTranslations("shell");
  const pathname = usePathname();
  const { unreadCount } = useChatUnread();
  const { replie, basculer } = useRailReplie();

  const tools: { key: MjToolKey; label: string }[] = [
    { key: "notes", label: t("blocNotes") },
    { key: "calendrier", label: t("calendrier") },
    { key: "calendrier-reel", label: t("calendrierReel") },
    { key: "chat", label: t("chat") },
    { key: "creation-personnage", label: t("creationPersonnage") },
    { key: "generateurs", label: t("generateurs") },
    { key: "gestion-campagne", label: t("gestionCampagne") },
    { key: "initiative", label: t("initiative") },
    { key: "journal-historique", label: t("journalHistorique") },
    { key: "livre-de-sessions", label: t("livreDeSessions") },
    { key: "personnalisation", label: t("personnalisation") },
    { key: "probabilites", label: t("probabilites") },
    { key: "publication", label: t("publication") },
    { key: "regles-actives", label: t("reglesActives") },
    { key: "rencontres", label: t("rencontres") },
    { key: "table", label: tShell("table") },
  ];

  return (
    <>
      {/* V3.1-29 : plus de ☰ sous 768 px. Les outils vivent dans la feuille
          « Outils » de la barre flottante (`BarreTelephoneMj`) ; ce rail n'existe
          qu'a partir de 768 px (`Rail` ne rend rien sous ce seuil sans feuille). */}
      <Rail ouvert={false} replie={replie} onBasculer={basculer}>
        <RailPart className="md:min-h-0 md:flex-1">
          {/* Les 6px de rembourrage haut d'un lien d'outil (`py-1.5`), rendus
              ici a la main : sans eux, l'ecart VU sous le nom du monde (4px,
              le `gap-1` seul) etait la moitie de celui vu sous la bascule
              (4px + ces 6px). Meme espace des deux cotes de la bascule, comme
              demande — mesure en navigateur, pas devine. Dans le rail
              (V3.1-27), la barre de sections est faite de lignes de meme
              hauteur : le correctif n'a plus d'objet. */}
          <div className="pb-1.5 md:p-2 md:pb-0">
            <EnTeteRail worldSlug={worldSlug} worldName={worldName} campaignName={campaignName} replie={replie} />
          </div>
          <div className="flex flex-col gap-1 md:gap-0.5 md:px-2">
            <SectionToggle worldSlug={worldSlug} />
            <SectionRailRows worldSlug={worldSlug} />
            <RailFilet />
          </div>
          {/* V2.1-16 — la liste des outils defile dans son propre cadre. Elle
              n'avait aucune zone defilante : les dix-sept outils tenaient par
              chance sur l'ecran de l'auteur, et allongeaient la page partout
              ailleurs. `min-h-0` est ce qui autorise cet enfant a descendre
              sous la taille de son contenu — sans lui, `flex-1` ne borne rien
              et l'imposerait a son parent. */}
          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto md:gap-0.5 md:overflow-x-hidden md:p-2">
            {replie ? (
              // Replie : une seule ligne « Outils », dont le menu flottant liste les outils.
              <RailRow
                icone={<IconeRail nom="outils" />}
                libelle={tShell("outils")}
                badge={unreadCount}
                actif={tools.some((tool) => pathname === mjToolHref(worldSlug, tool.key))}
                menu={(fermer) =>
                  tools.map((tool) => (
                    <MjToolLink
                      key={tool.key}
                      worldSlug={worldSlug}
                      toolKey={tool.key}
                      label={tool.label}
                      active={pathname === mjToolHref(worldSlug, tool.key)}
                      badge={tool.key === "chat" ? unreadCount : undefined}
                      onNavigate={fermer}
                      dansMenu
                    />
                  ))
                }
              />
            ) : (
              tools.map((tool) => (
                <MjToolLink
                  key={tool.key}
                  worldSlug={worldSlug}
                  toolKey={tool.key}
                  label={tool.label}
                  active={pathname === mjToolHref(worldSlug, tool.key)}
                  badge={tool.key === "chat" ? unreadCount : undefined}
                />
              ))
            )}
          </div>
        </RailPart>
        <OutilsDalle worldSlug={worldSlug} />
      </Rail>
    </>
  );
}
