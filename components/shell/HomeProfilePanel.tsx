import DisplayNameForm from "./DisplayNameForm";
import PasswordForm from "./PasswordForm";

/** Colonne profil de l'ecran d'accueil (retour utilisateur) — nom et mot de passe modifiables en place, mot de passe toujours optionnel (comptes invites restent sans mot de passe par defaut). */
export default function HomeProfilePanel({ email, displayName }: { email: string; displayName: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-edge bg-panel-sunken p-4">
      <h2 className="block-title text-sm text-ink-muted">Profil</h2>
      <p className="text-sm text-ink-muted">{email}</p>
      <DisplayNameForm initialDisplayName={displayName} />
      <PasswordForm />
    </div>
  );
}
