import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listUnclaimedCharactersForToken, resolveInviteForJoin } from "@/src/server/services/campaignInvites";
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

  if (resolved.invite.claimedByUserId) {
    redirect(`/rejoindre/${token}/entrer`);
  }

  const characters =
    resolved.invite.intendedRole === "gm" ? [] : await listUnclaimedCharactersForToken(supabase, token);

  return (
    <div className="flex flex-1 items-center justify-center font-sans">
      <JoinForm token={token} intendedRole={resolved.invite.intendedRole} characters={characters} />
    </div>
  );
}
