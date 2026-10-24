import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { listCampaigns } from "@/src/server/services/campaigns";
import { listCartesPersonnage } from "@/src/server/services/choixPersonnage";
import { getClaimedCharacterEntityId } from "@/src/server/repos/campaigns";
import { getEntityById } from "@/src/server/repos/entities";
import { listVisibleBlocks } from "@/src/server/services/blocks";
import { lancerFicheAvecPage } from "@/src/server/services/ficheAvecPage";
import type { Locale } from "@/src/i18n/request";
import { getPlayerCombatView } from "@/src/server/services/playerCombatView";
import ParticipantCharacterSheet from "@/components/shell/ParticipantCharacterSheet";
import CombatJoueur from "@/components/shell/combat/CombatJoueur";
import { VUE_AUCUN_COMBAT, type VueCombatJoueur } from "@/lib/ui/combatJoueur";
import ChooseCharacterScreen from "./ChooseCharacterScreen";

/**
 * Onglet Personnage (V2-M7b suite, retour utilisateur 31 août) : premier
 * onglet par defaut de la coquille joueur — uniquement la fiche jouable
 * (stats, actions, inventaire), jamais l'identite/bio/relations qui restent
 * dans l'onglet Fiche (`/joueur/fiche`). Reutilise `ParticipantCharacterSheet`
 * tel quel (ecran Initiative, V1-E4 suite) : il se charge deja lui-meme et
 * transmet un `campaignId` reel — les jets et changements de PV comptent
 * pour de vrai, contrairement a `EntityBlocks.tsx` (`campaignId: null`).
 */
export default async function JoueurPersonnagePage({
  params,
  searchParams,
}: {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ reclame?: string }>;
}) {
  const { worldSlug } = await params;
  // V3.1-82 : retour de la réclamation (`claimCharacterAction`) — un message, une fois.
  const vientDeReclamer = (await searchParams).reclame === "1";
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();
  const user = await getAuthUser(supabase);
  if (!user) notFound();

  const campaigns = await listCampaigns(supabase, world.id);
  const campaign = campaigns[0] ?? null;
  if (!campaign) {
    return <p className="mx-auto max-w-[70ch] text-sm text-ink-muted">Aucun personnage réclamé pour l&apos;instant dans ce monde.</p>;
  }

  const entityId = await getClaimedCharacterEntityId(supabase, { campaignId: campaign.id, userId: user.id });
  if (!entityId) {
    // Ecran "Choisis ton personnage" (V3.1-10) : membre du monde sans PJ
    // assigné (ajoutée par email, ou personnage réinitialisé par le MJ) —
    // jamais imposé à la création du compte.
    // V3.1-100 : le serveur dit quoi montrer et sur quelle carte s'ouvrir.
    // V3.1-82 : le carrousel reçoit des cartes complètes (portrait, phrase, identité).
    const { cartes, startOn } = await listCartesPersonnage(supabase, {
      campaignId: campaign.id,
      rulesetId: campaign.rulesetId,
      worldId: world.id,
      userId: user.id,
      locale: (await getLocale()) as Locale,
    });
    return (
      <ChooseCharacterScreen
        worldSlug={worldSlug}
        worldName={world.name}
        campaignName={campaign.name}
        cartes={cartes}
        startOn={startOn}
      />
    );
  }

  // Nom/version necessaires seulement pour amorcer l'assistant de creation
  // (retour utilisateur : "si le PJ reclame n'a pas de fiche de personnage")
  // — `ParticipantCharacterSheet` ne les connaissait pas jusqu'ici, il ne
  // charge que les BLOCS de l'entite, jamais l'entite elle-meme.
  // V3.1-62, étape 3 (C1, ADR 0056) : les blocs arrivent avec la page (même
  // filtre de visibilité que `GET /api/entities/[id]/blocks`), et la fiche
  // calculée part en promesse, pour la campagne que la fiche demandera.
  // V3.1-38 (C1) : le combat en cours part avec la page, en parallèle.
  const [entity, blocks, locale, vueCombat] = await Promise.all([
    getEntityById(supabase, entityId),
    listVisibleBlocks(supabase, world.id, entityId, user.id),
    getLocale(),
    getPlayerCombatView(supabase, campaign.id),
  ]);
  const vueInitiale: VueCombatJoueur = vueCombat.kind === "ok" ? vueCombat : VUE_AUCUN_COMBAT;
  if (!entity) notFound();
  const t = await getTranslations("choixPersonnage");
  const ficheAvecPage = lancerFicheAvecPage(supabase, {
    worldId: world.id,
    entityId,
    userId: user.id,
    campaignId: campaign.id,
    locale: locale as Locale,
    blocks,
  });

  return (
    // `max-w-5xl` (pas `70ch`, retour utilisateur : "les boutons des actions
    // soient sur une même ligne") — la fiche jouable est un tableau de bord
    // a deux colonnes (caracteristiques + onglet Actions), pas de la prose :
    // assez large pour que les lignes Attaquer/Degats d'une arme restent sur
    // une seule ligne, contrairement a `70ch` qui forcait la bascule mobile
    // (`md:flex-row`, PlayableCharacterSheet.tsx) meme sur grand ecran.
    <div className="mx-auto max-w-5xl">
      {vientDeReclamer && (
        <p role="status" className="mb-3 rounded-2xl border border-accent/50 bg-accent/10 px-3 py-2.5 text-sm text-ink">
          {t("reclame", { prenom: entity.name.split(" ")[0] })}
        </p>
      )}
      <CombatJoueur campaignId={campaign.id} entityId={entityId} vueInitiale={vueInitiale}>
        <ParticipantCharacterSheet
          worldSlug={worldSlug}
          campaignId={campaign.id}
          entityId={entityId}
          entityName={entity.name}
          entityVersion={entity.version}
          initialBlocks={blocks}
          ficheAvecPage={ficheAvecPage}
        />
      </CombatJoueur>
    </div>
  );
}
