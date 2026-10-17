"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { JournalEntry } from "@/src/server/services/activityJournal";
import WorldCardActions from "@/app/WorldCardActions";
import Tabs, { TabPanel } from "@/components/shared/Tabs";
import DiceStatsPanel from "./DiceStatsPanel";
import InviteLinkPanel from "./InviteLinkPanel";
import FeuilleDuBas from "@/components/shared/FeuilleDuBas";
import AccueilHaut from "./AccueilHaut";
import NouveauMonde from "./NouveauMonde";
import { formaterSeance, monPersonnage, ongletsMondes, premierOnglet, repartirMondes, type OngletMondes } from "@/lib/ui/accueil";
import { useMatchMedia, WINDOWS_MOBILE_QUERY } from "./useMatchMedia";

export interface HomeWorldCard {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  mode: "campaign" | "solo" | null;
  campaignId: string | null;
  campaignName: string | null;
  rulesetName: string | null;
  lastModified: string;
  myRole: "gm" | "player" | null;
  myCharacter: { entityId: string; entitySlug: string; name: string } | null;
  players: { entityId: string; name: string; speciesLabel: string | null; classesLabel: string | null; claimedByDisplayName: string | null }[];
  gmNames: string[];
  /** Prochaine séance planifiée de la campagne du monde (`null` : aucune ou pas de campagne). */
  nextSession: { startsAt: string; durationMinutes: number } | null;
}

/** Le rôle tenu dans CE monde : le solo passe avant le reste, comme dans `repartirMondes`. */
function cleRole(world: HomeWorldCard): "roleJoueur" | "roleSolo" | "roleMj" {
  return world.mode === "solo" ? "roleSolo" : world.myRole === "player" ? "roleJoueur" : "roleMj";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

type DetailTab = "journal" | "joueurs" | "acces" | "reglages";

const DETAIL_TAB_LABELS: Record<DetailTab, string> = {
  journal: "Journal",
  joueurs: "Joueurs",
  acces: "Accès",
  reglages: "Réglages",
};

/**
 * Detail du monde selectionne. Cote MJ, ses sections vivent depuis V2.1-24
 * (lot 3) dans un classeur (`Tabs`, ADR 0034) — demande de l'auteur :
 * "des onglets comme des separateurs de classeur pour passer de la gestion
 * des permissions a l'historique des modifications". Le serveur adapte deja
 * le detail au role (`/journal/mine`), rien a filtrer ici.
 *
 * Cote joueur, PAS de classeur : il n'a qu'une seule vue — retour
 * utilisateur, "a la place d'avoir le journal... un petit ecran sur les
 * stats de lance de des". Un classeur a un onglet est un cadre, pas des
 * onglets.
 *
 * « Rejoindre » reste hors du classeur et toujours visible : c'est la
 * sortie de cet ecran, elle ne se range pas dans un onglet.
 */
function WorldDetail({ world, currentUserId, canUseSoloMode }: { world: HomeWorldCard; currentUserId: string; canUseSoloMode: boolean }) {
  const t = useTranslations("accueil");
  const locale = useLocale();
  const isPlayer = world.myRole === "player";
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>("journal");
  // « Accès » disparaît quand le monde n'a pas de campagne : `InviteLinkPanel`
  // ne sait inviter que dans une campagne, et un onglet qui ne peut rien
  // montrer vaut moins qu'un onglet absent.
  const tabs: DetailTab[] = world.campaignId
    ? ["journal", "joueurs", "acces", "reglages"]
    : ["journal", "joueurs", "reglages"];

  useEffect(() => {
    if (isPlayer) return;
    fetch(`/api/worlds/${world.slug}/journal/mine`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: { entries: JournalEntry[] }) => setEntries(body.entries))
      .catch(() => setLoadError("Impossible de charger le journal."));
  }, [world.slug, isPlayer]);

  const roleLabel = t(cleRole(world));
  const perso = monPersonnage(world);
  // V2-M7b (Lot M, coquille joueur) : un role Joueur mene desormais a la
  // coquille allegee (Fiche/Notes/Wiki/Regles), jamais directement a la
  // fiche brute — celle-ci gere elle-meme le cas "personnage pas encore
  // reclame".
  const href = isPlayer ? `/m/${world.slug}/joueur` : `/m/${world.slug}`;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="shrink-0">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium text-ink">{world.name}</p>
          <span className="shrink-0 rounded-full border border-edge px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted">
            {roleLabel}
          </span>
        </div>
        {world.campaignName && <p className="text-xs text-ink-muted">{t("campagne", { nom: world.campaignName })}</p>}
        {!isPlayer && (
          <p className="text-xs text-ink-muted">
            {world.rulesetName ?? "Aucun ruleset"} · Modifié le {formatDate(world.lastModified)}
          </p>
        )}
      </div>

      {/* Cote joueur, pas de classeur : il n'a qu'une seule vue. Un
          classeur a un onglet est un cadre, pas des onglets. */}
      {isPlayer ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-ink-muted">{t("monPersonnage")}</span>
            {perso ? (
              <p className="text-sm text-ink">
                {perso.nom}
                {perso.detail && <span className="text-ink-muted"> — {perso.detail}</span>}
              </p>
            ) : (
              <p className="text-sm text-ink-muted">{t("personnageIntrouvable")}</p>
            )}
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-ink-muted">{t("prochaineSeance")}</span>
            <p className="text-sm text-ink">
              {world.nextSession ? formaterSeance(world.nextSession.startsAt, locale) : <span className="text-ink-muted">{t("aucuneSeance")}</span>}
            </p>
          </div>
          {world.gmNames.length > 0 && <p className="text-sm text-ink-muted">{t("mjNoms", { noms: world.gmNames.join(", ") })}</p>}
          <span className="text-xs font-bold uppercase tracking-widest text-ink-muted">{t("statsJets")}</span>
          <DiceStatsPanel campaignId={world.campaignId} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <Tabs
            idPrefix="accueil"
            value={tab}
            onChange={setTab}
            aria-label="Sections du monde"
            items={tabs.map((t) => ({ value: t, label: DETAIL_TAB_LABELS[t] }))}
          />

          {/* Seul le panneau defile : Rejoindre reste toujours visible,
              jamais au fond d'une zone qui defile. */}
          <TabPanel idPrefix="accueil" value={tab} className="mt-2 min-h-0 flex-1 overflow-y-auto rounded-lg border border-edge bg-panel p-3">
            {tab === "journal" && (
              <>
                {loadError && <p className="text-xs text-danger">{loadError}</p>}
                {entries === null && !loadError && <p className="text-xs text-ink-muted">…</p>}
                {entries && entries.length === 0 && <p className="text-xs text-ink-muted">Aucune activité pour l&apos;instant.</p>}
                {entries && entries.length > 0 && (
                  <ul className="flex flex-col gap-1.5 text-xs">
                    {entries.slice(0, 30).map((entry, i) => (
                      <li key={i} className="border-b border-edge/30 pb-1">
                        <span className={entry.source === "wiki" ? "text-accent" : "text-ink"}>
                          {entry.source === "wiki" ? "wiki" : "jeu"}
                        </span>{" "}
                        <span className="text-ink-muted">
                          {entry.label}
                          {entry.entityName && <> — {entry.entityName}</>}
                          {entry.blockLabel && <> ({entry.blockLabel})</>}
                        </span>
                        <div className="text-ink-muted">
                          {entry.accountName} · {formatDateTime(entry.createdAt)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {/* Memes donnees que la carte de la colonne de gauche
                (`HomeWorldCard.players`), au large. La carte les garde pour
                l'instant : les alleger est une decision de l'auteur, pas une
                traine de ce lot. */}
            {tab === "joueurs" && (
              <>
                {world.gmNames.length > 0 && (
                  <p className="text-xs text-ink-muted">MJ : {world.gmNames.join(", ")}</p>
                )}
                {world.players.length === 0 ? (
                  <p className="mt-1 text-xs text-ink-muted">Aucun joueur.</p>
                ) : (
                  <ul className="mt-1 flex flex-col gap-1 text-sm">
                    {world.players.map((pc) => (
                      <li key={pc.entityId} className="border-b border-edge/30 pb-1 text-ink-muted">
                        <span className="text-ink">{pc.name}</span>
                        {(pc.speciesLabel || pc.classesLabel) && (
                          <> — {[pc.speciesLabel, pc.classesLabel].filter(Boolean).join(" · ")}</>
                        )}
                        {pc.claimedByDisplayName && <> · jouée par {pc.claimedByDisplayName}</>}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {/* `InviteLinkPanel` existait deja (V2-M4) et ne prend qu'un
                `campaignId` : aucune route serveur ajoutee pour cet onglet,
                il tape le GET `/api/campaigns/[id]/invites` deja en place. */}
            {tab === "acces" && world.campaignId && <InviteLinkPanel campaignId={world.campaignId} />}

            {tab === "reglages" && (
              <WorldCardActions
                worldId={world.id}
                worldSlug={world.slug}
                worldName={world.name}
                campaignId={world.campaignId}
                campaignName={world.campaignName}
                isOwner={world.ownerId === currentUserId}
                canUseSoloMode={canUseSoloMode}
              />
            )}
          </TabPanel>
        </div>
      )}

      <Link
        href={href}
        className="shrink-0 self-end rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover"
      >
        Rejoindre
      </Link>
    </div>
  );
}

/** Une carte de la liste : nom, rôle, campagne, méta. Toucher la carte sélectionne le monde. */
function CarteMonde({ world, selected, onSelect }: { world: HomeWorldCard; selected: boolean; onSelect: () => void }) {
  const t = useTranslations("accueil");
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`w-full rounded-lg border p-4 text-left transition-colors hover:bg-panel-raised ${
          selected ? "border-accent bg-panel-raised" : "border-edge bg-panel"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium text-ink">{world.name}</p>
          <span className="shrink-0 rounded-full border border-edge px-2 py-0.5 text-xs uppercase tracking-wider text-ink-muted">
            {t(cleRole(world))}
          </span>
        </div>
        {world.campaignName && <p className="text-xs text-ink-muted">{t("campagne", { nom: world.campaignName })}</p>}
        {world.myRole === "player" ? (
          <p className="text-sm text-ink-muted">{world.myCharacter ? world.myCharacter.name : t("personnageIntrouvable")}</p>
        ) : (
          <>
            <p className="text-sm text-ink-muted">
              {world.rulesetName ?? "Aucun ruleset"} · Modifié le {formatDate(world.lastModified)}
            </p>
            {world.gmNames.length > 0 && <p className="text-xs text-ink-muted">{t("mjNoms", { noms: world.gmNames.join(", ") })}</p>}
            {world.players.length > 0 ? (
              <ul className="mt-0.5 flex flex-col">
                {world.players.map((pc) => (
                  <li key={pc.entityId} className="text-sm text-ink-muted">
                    {pc.name}
                    {(pc.speciesLabel || pc.classesLabel) && <> — {[pc.speciesLabel, pc.classesLabel].filter(Boolean).join(" · ")}</>}
                    {pc.claimedByDisplayName && <> · jouée par {pc.claimedByDisplayName}</>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">Aucun joueur</p>
            )}
          </>
        )}
      </button>
    </li>
  );
}

function ListeMondes({ mondes, selectedId, onSelect }: { mondes: HomeWorldCard[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const t = useTranslations("accueil");
  if (mondes.length === 0) return <p className="text-sm text-ink-muted">{t("colonneVide")}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {mondes.map((w) => (
        <CarteMonde key={w.id} world={w} selected={selectedId === w.id} onSelect={() => onSelect(w.id)} />
      ))}
    </ul>
  );
}

function TitreColonne({ children }: { children: React.ReactNode }) {
  return <h2 className="shrink-0 text-xs font-bold uppercase tracking-widest text-ink-muted">{children}</h2>;
}

/**
 * Destination « Mondes » de l'accueil en tableau de bord (V3.1-35) : en haut,
 * « Nouveau monde » et les prochaines séances / « Reprendre » ; dessous, « Je
 * mène » (puis « En solo ») et « Je joue » sur une même ligne de titres, et le
 * panneau du monde choisi à droite. Le panneau montre les outils du RÔLE TENU
 * DANS CE MONDE (`WorldDetail`).
 *
 * Sous 768 px : une pilule Je mène / Je joue / Solo au-dessus d'une seule
 * liste, et le panneau du monde s'ouvre dans une feuille du bas. Entre 768 et
 * 1280 px, les trois pistes ne tiennent pas : le panneau passe sous les deux
 * listes et la page défile.
 *
 * La sélection reste locale, jamais dans l'URL (pas de navigation tant qu'on
 * n'a pas cliqué « Rejoindre »).
 */
export default function HomeScreen({
  worlds,
  currentUserId,
  canUseSoloMode,
  menerPartie,
  jouerSolo,
}: {
  worlds: HomeWorldCard[];
  currentUserId: string;
  /** Superadmin : la copie d'un monde peut naître en solo (ADR 0058). */
  canUseSoloMode: boolean;
  /** Chemin « Mener une partie » du panneau « Nouveau monde » : création en mode campagne et import. */
  menerPartie: React.ReactNode;
  /** Chemin « Jouer en solo » ; `null` quand le compte ne peut pas créer de solo. */
  jouerSolo: React.ReactNode | null;
}) {
  const t = useTranslations("accueil");
  const estTelephone = useMatchMedia(WINDOWS_MOBILE_QUERY);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = worlds.find((w) => w.id === selectedId) ?? null;
  const repartition = repartirMondes(worlds);
  const [onglet, setOnglet] = useState<OngletMondes>(() => premierOnglet(repartition));
  const onglets = ongletsMondes(repartition, canUseSoloMode);
  const afficheSolo = onglets.includes("solo");

  const detail = selected && (
    // `key` force un remontage complet a chaque changement de monde
    // selectionne : sans lui, `WorldCardActions`/`RenameWorldSection`
    // gardent leur etat local (`revealed`, `name`) d'un monde a l'autre
    // (bug reel constate : renommage de Valdoria en "Faerûn" apres
    // avoir ouvert "Renommer" sur Faerûn puis change de selection sans
    // fermer le panneau — le nom tape restait celui de l'ancien monde
    // pendant que `worldId` (input cache) pointait deja sur le nouveau).
    <WorldDetail key={selected.id} world={selected} currentUserId={currentUserId} canUseSoloMode={canUseSoloMode} />
  );

  const nouveauMonde = <NouveauMonde menerPartie={menerPartie} jouerSolo={jouerSolo} pleineLargeur={estTelephone} />;

  if (estTelephone) {
    const liste = onglet === "mene" ? repartition.jeMene : onglet === "joue" ? repartition.jeJoue : repartition.enSolo;
    return (
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
        {nouveauMonde}
        <AccueilHaut mondes={worlds} />
        <Tabs<OngletMondes>
          aria-label={t("mondesAria")}
          value={onglet}
          onChange={setOnglet}
          items={onglets.map((o) => ({ value: o, label: t(o === "mene" ? "colMene" : o === "joue" ? "colJoue" : "colSolo") }))}
        />
        <ListeMondes mondes={liste} selectedId={selectedId} onSelect={setSelectedId} />
        {selected && (
          <FeuilleDuBas titre={selected.name} titreVisible onFermer={() => setSelectedId(null)}>
            <div className="flex min-h-[55dvh] flex-col">{detail}</div>
          </FeuilleDuBas>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto xl:overflow-hidden">
      <div className="flex shrink-0 flex-col gap-3 lg:flex-row lg:items-start">
        {nouveauMonde}
        <div className="min-w-0 flex-1">
          <AccueilHaut mondes={worlds} />
        </div>
      </div>

      {/* `min-w-0` sur les pistes : le contenu le plus large ne doit pas pousser la colonne au-dela du cadre. */}
      <div className="grid min-h-0 gap-4 md:grid-cols-2 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)] xl:overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-col gap-2 xl:overflow-y-auto">
          <TitreColonne>{t("colMene")}</TitreColonne>
          <ListeMondes mondes={repartition.jeMene} selectedId={selectedId} onSelect={setSelectedId} />
          {afficheSolo && (
            <>
              <div className="mt-2">
                <TitreColonne>{t("colSolo")}</TitreColonne>
              </div>
              <ListeMondes mondes={repartition.enSolo} selectedId={selectedId} onSelect={setSelectedId} />
            </>
          )}
        </div>

        <div className="flex min-h-0 min-w-0 flex-col gap-2 xl:overflow-y-auto">
          <TitreColonne>{t("colJoue")}</TitreColonne>
          <ListeMondes mondes={repartition.jeJoue} selectedId={selectedId} onSelect={setSelectedId} />
        </div>

        <div className="min-h-48 min-w-0 rounded-lg border border-edge bg-panel-sunken p-4 md:col-span-2 xl:col-span-1 xl:h-full xl:min-h-0">
          {detail ?? <p className="text-sm text-ink-muted">{t("selectionner")}</p>}
        </div>
      </div>
    </div>
  );
}
