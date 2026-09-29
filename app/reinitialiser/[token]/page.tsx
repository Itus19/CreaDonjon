import { resolveResetToken } from "@/src/server/services/accountAuth";
import ResetPasswordForm from "./ResetPasswordForm";

/**
 * Ecran "choisis ton nouveau mot de passe" (V3.1-10, ADR 0031 §5) — atteint
 * depuis un jeton "Forcer une réinitialisation" (MJ/superadmin), jamais par
 * un mot de passe temporaire ni une connexion automatique.
 */
export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const resolved = await resolveResetToken(token);

  if (!resolved.ok) {
    return (
      <div className="flex flex-1 items-center justify-center font-sans">
        <div className="w-full max-w-sm rounded-lg border border-edge bg-panel p-6 text-center">
          <p className="text-sm text-danger">Ce lien n&apos;est plus valide.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center font-sans">
      <ResetPasswordForm token={token} />
    </div>
  );
}
