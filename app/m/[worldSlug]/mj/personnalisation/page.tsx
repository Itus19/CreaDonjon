import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { resolveBackgroundSelection } from "@/src/server/services/backgroundImages";
import PersonnalisationPanel from "@/components/shell/PersonnalisationPanel";
import RegisterPrimaryWindow from "@/components/shell/RegisterPrimaryWindow";

const VALID_MODES = ["dark", "dim", "soft", "light"];

/** Ancien onglet "Thème" du menu de réglages (retour utilisateur, gomme le bouton ⚙) — mêmes cookies (`mode`/`contrast`/`background`/`bgBlur`) lus ici plutôt que dans `app/layout.tsx`, qui les lit toujours pour rendre `<html>` côté serveur. */
export default async function MjPersonnalisationPage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const cookieStore = await cookies();
  const modeCookie = cookieStore.get("mode")?.value ?? "dark";
  const mode = VALID_MODES.includes(modeCookie) ? modeCookie : "dark";
  const contrast = cookieStore.get("contrast")?.value === "high" ? "high" : "off";

  const supabase = await createClient();
  const backgroundRef = cookieStore.get("background")?.value;
  const background = await resolveBackgroundSelection(supabase, backgroundRef);

  const bgBlurCookie = Number(cookieStore.get("bgBlur")?.value);
  const bgBlur = Number.isFinite(bgBlurCookie) && bgBlurCookie >= 0 && bgBlurCookie <= 40 ? bgBlurCookie : 20;

  return (
    <>
      <RegisterPrimaryWindow windowRef={{ kind: "mj", key: "personnalisation" }} name="Personnalisation" badge="" homeHref={`/m/${worldSlug}/mj/personnalisation`} />
      <PersonnalisationPanel
        currentMode={mode}
        currentContrast={contrast}
        currentBackgroundRef={background.ref}
        currentBackgroundAvailableModes={background.availableModes}
        currentBgBlur={bgBlur}
      />
    </>
  );
}
