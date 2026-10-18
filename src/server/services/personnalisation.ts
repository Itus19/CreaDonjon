import "server-only";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { resolveBackgroundSelection } from "@/src/server/services/backgroundImages";

type TypedClient = SupabaseClient<Database>;

const VALID_MODES = ["dark", "dim", "soft", "light"];

/** Ce que `PersonnalisationPanel` reçoit : les réglages d'apparence de CET appareil. */
export interface ReglagesPersonnalisation {
  mode: string;
  contrast: "high" | "off";
  backgroundRef: string;
  backgroundAvailableModes: string[];
  bgBlur: number;
}

/**
 * Les réglages d'apparence, lus dans les cookies de l'appareil (`mode`,
 * `contrast`, `background`, `bgBlur`), chacun ramené à une valeur valide.
 * V3.1-81 : un code, trois portes — la page Personnalisation des outils du MJ,
 * sa fenêtre, et la section Apparence du Compte (règle des trois).
 */
export async function lirePersonnalisation(supabase: TypedClient): Promise<ReglagesPersonnalisation> {
  const cookieStore = await cookies();
  const modeCookie = cookieStore.get("mode")?.value ?? "dark";
  const mode = VALID_MODES.includes(modeCookie) ? modeCookie : "dark";
  const contrast = cookieStore.get("contrast")?.value === "high" ? "high" : "off";
  const background = await resolveBackgroundSelection(supabase, cookieStore.get("background")?.value);
  const bgBlurCookie = Number(cookieStore.get("bgBlur")?.value);
  const bgBlur = Number.isFinite(bgBlurCookie) && bgBlurCookie >= 0 && bgBlurCookie <= 40 ? bgBlurCookie : 20;
  return { mode, contrast, backgroundRef: background.ref, backgroundAvailableModes: background.availableModes, bgBlur };
}
