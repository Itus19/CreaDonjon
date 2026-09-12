import { notFound } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { listCampaigns } from "@/src/server/services/campaigns";
import { getClaimedCharacterEntityId } from "@/src/server/repos/campaigns";
import { getEntityById } from "@/src/server/repos/entities";
import ParticipantCharacterSheet from "@/components/shell/ParticipantCharacterSheet";

/**
 * Onglet Personnage (V2-M7b suite, retour utilisateur 31 août) : premier
 * onglet par defaut de la coquille joueur — uniquement la fiche jouable
 * (stats, actions, inventaire), jamais l'identite/bio/relations qui restent
 * dans l'onglet Fiche (`/joueur/fiche`). Reutilise `ParticipantCharacterSheet`
 * tel quel (ecran Initiative, V1-E4 suite) : il se charge deja lui-meme et
 * transmet un `campaignId` reel — les jets et changements de PV comptent
 * pour de vrai, contrairement a `EntityBlocks.tsx` (`campaignId: null`).
 */
export default async function JoueurPersonnagePage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();
  const user = await getAuthUser(supabase);
  if (!user) notFound();

  const campaigns = await listCampaigns(supabase, world.id);
  const campaign = campaigns[0] ?? null;
  const entityId = campaign ? await getClaimedCharacterEntityId(supabase, { campaignId: campaign.id, userId: user.id }) : null;
  if (!campaign || !entityId) {
    return <p className="mx-auto max-w-[70ch] text-sm text-ink-muted">Aucun personnage réclamé pour l&apos;instant dans ce monde.</p>;
  }

  // Nom/version necessaires seulement pour amorcer l'assistant de creation
  // (retour utilisateur : "si le PJ reclame n'a pas de fiche de personnage")
  // — `ParticipantCharacterSheet` ne les connaissait pas jusqu'ici, il ne
  // charge que les BLOCS de l'entite, jamais l'entite elle-meme.
  const entity = await getEntityById(supabase, entityId);
  if (!entity) notFound();

  return (
    // `max-w-5xl` (pas `70ch`, retour utilisateur : "les boutons des actions
    // soient sur une même ligne") — la fiche jouable est un tableau de bord
    // a deux colonnes (caracteristiques + onglet Actions), pas de la prose :
    // assez large pour que les lignes Attaquer/Degats d'une arme restent sur
    // une seule ligne, contrairement a `70ch` qui forcait la bascule mobile
    // (`md:flex-row`, PlayableCharacterSheet.tsx) meme sur grand ecran.
    <div className="mx-auto max-w-5xl">
      <ParticipantCharacterSheet
        worldSlug={worldSlug}
        campaignId={campaign.id}
        entityId={entityId}
        entityName={entity.name}
        entityVersion={entity.version}
      />
    </div>
  );
}
