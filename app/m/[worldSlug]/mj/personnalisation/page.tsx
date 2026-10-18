import { createClient } from "@/lib/supabase/server";
import { lirePersonnalisation } from "@/src/server/services/personnalisation";
import PersonnalisationPanel from "@/components/shell/PersonnalisationPanel";
import RegisterPrimaryWindow from "@/components/shell/RegisterPrimaryWindow";

/** Ancien onglet "Thème" du menu de réglages (retour utilisateur, gomme le bouton ⚙). Les cookies sont lus par `lirePersonnalisation` (V3.1-81), comme pour la fenêtre et le Compte ; `app/layout.tsx` les lit toujours pour rendre `<html>` côté serveur. */
export default async function MjPersonnalisationPage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const reglages = await lirePersonnalisation(await createClient());

  return (
    <>
      <RegisterPrimaryWindow windowRef={{ kind: "mj", key: "personnalisation" }} name="Personnalisation" badge="" homeHref={`/m/${worldSlug}/mj/personnalisation`} />
      <PersonnalisationPanel
        currentMode={reglages.mode}
        currentContrast={reglages.contrast}
        currentBackgroundRef={reglages.backgroundRef}
        currentBackgroundAvailableModes={reglages.backgroundAvailableModes}
        currentBgBlur={reglages.bgBlur}
      />
    </>
  );
}
