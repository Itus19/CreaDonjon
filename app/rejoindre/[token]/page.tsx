import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { listUnclaimedCharactersForToken, resolveDestinationForInvitedUser, resolveInviteForJoin } from "@/src/server/services/campaignInvites";
import { getOwnProfile } from "@/src/server/repos/account";
import { isCampaignMember } from "@/src/server/repos/campaigns";
import { hasVerifiedInvitePassword } from "./passwordActions";
import InvitePasswordGate from "./InvitePasswordGate";
import JoinForm from "./JoinForm";

/**
 * Point d'entrée d'un ami invité (V2-M4, Lot M) — jamais d'email ni de mot
 * de passe visibles : le jeton lui-même est la clé. Un lien déjà réclamé
 * redirige directement vers `/entrer`, qui rétablit la session sans jamais
 * remontrer cet écran de choix (specs/module-joueur-et-solo.md §A1).
 */
export default async function JoinInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const resolved = await resolveInviteForJoin(supabase, token);

  if (!resolved.ok) {
    return (
      <div className="flex flex-1 items-center justify-center font-sans">
        <div className="w-full max-w-sm rounded-lg border border-edge bg-panel p-6 text-center">
          <p className="text-sm text-danger">Ce lien n&apos;est plus valide.</p>
        </div>
      </div>
    );
  }

  // Mot de passe optionnel (V2-M4 suite, retour utilisateur 30 août) :
  // jamais l'ecran de choix ni la reconnexion avant validation — meme
  // discipline que le partage public (SharePasswordGate).
  if (resolved.invite.passwordHash && !(await hasVerifiedInvitePassword(token))) {
    return <InvitePasswordGate token={token} />;
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

  const characters =
    resolved.invite.intendedRole === "gm" ? [] : await listUnclaimedCharactersForToken(supabase, token);

  // Retour utilisateur 30 aout ("Jeremy MJ dans un monde ET joueur dans un
  // autre") : ce nouveau role s'ajoutera au compte DEJA connecte, le cas
  // echeant — prevenir plutot que de le faire silencieusement.
  const currentAccountName = currentUser ? (await getOwnProfile(supabase, currentUser.id))?.display_name || null : null;

  return (
    <div className="flex flex-1 items-center justify-center font-sans">
      <JoinForm
        token={token}
        intendedRole={resolved.invite.intendedRole}
        characters={characters}
        currentAccountName={currentAccountName}
      />
    </div>
  );
}
