import { Suspense } from "react";
import { getAppIdentity } from "@/src/server/services/appIdentity";
import { EcranTitre } from "./EcranTitre";

/**
 * Écran-titre (V3.1-85). Composant serveur : l'identité de l'application
 * (nom, phrase, logo) arrive avec la page, sans aucun chargement côté client
 * (CABLAGE C1). Le `Suspense` sert au `useSearchParams` du composant client.
 */
export default async function LoginPage() {
  const { name, tagline, logoKey, logoUrl } = await getAppIdentity();
  return (
    <Suspense fallback={null}>
      <EcranTitre name={name} tagline={tagline} logoKey={logoKey} logoUrl={logoUrl} />
    </Suspense>
  );
}
