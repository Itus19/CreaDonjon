import { createClient } from "@/lib/supabase/server";
import { lirePersonnalisation } from "@/src/server/services/personnalisation";
import PersonnalisationPanel from "@/components/shell/PersonnalisationPanel";

/**
 * « Apparence » côté joueuse (V3.1-58) : le même panneau que l'outil
 * Personnalisation du MJ et la section Apparence du Compte, en page pleine
 * depuis le pied du rail. Les réglages sont ceux de l'appareil (cookies),
 * lus avec la page (docs/CABLAGE.md C1).
 */
export default async function JoueurApparencePage() {
  const reglages = await lirePersonnalisation(await createClient());

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
      <h1 className="block-title text-base">Apparence</h1>
      <PersonnalisationPanel
        currentMode={reglages.mode}
        currentContrast={reglages.contrast}
        currentBackgroundRef={reglages.backgroundRef}
        currentBackgroundAvailableModes={reglages.backgroundAvailableModes}
        currentBgBlur={reglages.bgBlur}
      />
    </div>
  );
}
