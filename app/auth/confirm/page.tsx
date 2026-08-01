import ConfirmForm from "./ConfirmForm";

/**
 * Route de callback partagee par la confirmation d'inscription et la
 * recuperation de mot de passe. La verification du jeton n'a lieu qu'au
 * clic (voir actions.ts) — jamais au simple chargement de cette page.
 */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
}) {
  const { token_hash, type, next } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center font-sans">
      <ConfirmForm tokenHash={token_hash} type={type} next={next} />
    </div>
  );
}
