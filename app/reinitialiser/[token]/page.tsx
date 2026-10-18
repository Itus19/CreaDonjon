import { resolveResetToken } from "@/src/server/services/accountAuth";
import ResetPasswordForm from "./ResetPasswordForm";
import { CadreTitre, PANNEAU_VERRE } from "@/components/brand/CadreTitre";
import { getAppIdentity } from "@/src/server/services/appIdentity";

/**
 * Ecran "choisis ton nouveau mot de passe" (V3.1-10, ADR 0031 §5) — atteint
 * depuis un jeton "Forcer une réinitialisation" (MJ/superadmin), jamais par
 * un mot de passe temporaire ni une connexion automatique.
 */
export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // V3.1-86 : la porte prend le cadre de l'écran-titre (même fond, même titre).
  const [resolved, identite] = await Promise.all([resolveResetToken(token), getAppIdentity()]);

  if (!resolved.ok) {
    return (
      <CadreTitre identite={identite}>
        <div className={PANNEAU_VERRE}>
          <p className="text-sm text-danger">Ce lien n&apos;est plus valide.</p>
        </div>
      </CadreTitre>
    );
  }

  return (
    <CadreTitre identite={identite}>
      <ResetPasswordForm token={token} />
    </CadreTitre>
  );
}
