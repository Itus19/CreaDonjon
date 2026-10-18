import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { resolveDestinationForInvitedUser, resolveInviteForJoin } from "@/src/server/services/campaignInvites";
import { getOwnProfile } from "@/src/server/repos/account";
import { isCampaignMember } from "@/src/server/repos/campaigns";
import { hasVerifiedInvitePassword } from "@/lib/campaignInvites/passwordCookie";
import InvitePasswordGate from "./InvitePasswordGate";
import JoinForm from "./JoinForm";
import { CadreTitre, PANNEAU_VERRE } from "@/components/brand/CadreTitre";
import { getAppIdentity } from "@/src/server/services/appIdentity";

/**
 * Point d'entrée d'un ami invité (V2-M4, Lot M) — jamais d'email ni de mot
 * de passe visibles : le jeton lui-même est la clé. Un lien déjà réclamé
 * redirige directement vers `/entrer`, qui rétablit la session sans jamais
 * remontrer cet écran de choix (specs/module-joueur-et-solo.md §A1).
 */
export default async function JoinInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  // V3.1-86 : la porte prend le cadre de l'écran-titre (même fond, même titre).
  const [resolved, identite] = await Promise.all([resolveInviteForJoin(supabase, token), getAppIdentity()]);

  if (!resolved.ok) {
    return (
      <CadreTitre identite={identite}>
        <div className={PANNEAU_VERRE}>
          <p className="text-sm text-danger">Ce lien n&apos;est plus valide.</p>
        </div>
      </CadreTitre>
    );
  }

  // Mot de passe optionnel (V2-M4 suite, retour utilisateur 30 août) :
  // jamais l'ecran de choix ni la reconnexion avant validation — meme
  // discipline que le partage public (SharePasswordGate).
  if (resolved.invite.hasPassword && !(await hasVerifiedInvitePassword(token))) {
    return (
      <CadreTitre identite={identite}>
        <InvitePasswordGate token={token} />
      </CadreTitre>
    );
  }

  // Lien MJ (ou heretes sans role fixe) : nominatif, usage unique — inchange.
  // Un lien JOUEUR reutilisable (V3.1-10) ignore ce champ : campaign_members
  // fait foi de qui a rejoint, jamais claimed_by_user_id (ADR 0031).
  if (resolved.invite.claimedByUserId && resolved.invite.intendedRole !== "player") {
    redirect(`/rejoindre/${token}/entrer`);
  }

  const currentUser = await getAuthUser(supabase);

  // Un visiteur DEJA membre de cette campagne (lien joueur reouvert plus
  // tard, ou depuis un autre appareil) se reconnecte directement, sans
  // repasser par le choix de role/personnage.
  if (resolved.invite.intendedRole === "player" && resolved.invite.campaignId && currentUser) {
    const alreadyMember = await isCampaignMember(supabase, { campaignId: resolved.invite.campaignId, userId: currentUser.id });
    if (alreadyMember) {
      redirect(await resolveDestinationForInvitedUser(supabase, resolved.invite, currentUser.id));
    }
  }

  // V3.1-100 : un lien nominatif sert une seule fois. Déjà utilisé par un
  // autre compte : on le dit AVANT le formulaire, qui créerait sinon un
  // compte pour rien. (La personne qui l'a utilisé, connectée, est déjà
  // membre : redirigée plus haut.)
  if (resolved.invite.entityId && resolved.invite.claimedByUserId && resolved.invite.claimedByUserId !== currentUser?.id) {
    return (
      <CadreTitre identite={identite}>
        <div className={PANNEAU_VERRE}>
          <p className="text-sm text-ink">Ce lien a déjà servi.</p>
          <p className="text-xs text-ink-muted">Si c&apos;est toi, connecte-toi ; sinon, demande un nouveau lien à ton MJ.</p>
        </div>
      </CadreTitre>
    );
  }

  // Retour utilisateur 30 aout ("Jeremy MJ dans un monde ET joueur dans un
  // autre") : ce nouveau role s'ajoutera au compte DEJA connecte, le cas
  // echeant — prevenir plutot que de le faire silencieusement.
  const currentAccountName = currentUser ? (await getOwnProfile(supabase, currentUser.id))?.display_name || null : null;

  return (
    <CadreTitre identite={identite}>
      <JoinForm
        token={token}
        intendedRole={resolved.invite.intendedRole}
        currentAccountName={currentAccountName}
      />
    </CadreTitre>
  );
}
