"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { lireVueCombat, type VueCombatJoueur } from "@/lib/ui/combatJoueur";

/**
 * V3.1-38 — la vue du combat, tenue à jour en temps réel. `combats.updated_at`
 * change à chaque changement de participant : un seul canal sur la table
 * `combats`, filtré sur la campagne, suffit (une ligne par campagne, pas une
 * par participant). À chaque signal on relit la vue filtrée par le serveur —
 * le signal ne porte aucune donnée.
 *
 * Quota (docs/QUOTAS.md Q3) : un seul canal par page, refermé au démontage.
 * Les relectures sont mises en file : jamais deux en vol, et les signaux reçus
 * pendant une relecture n'en déclenchent qu'une de plus.
 */
export function useCombatJoueur(
  campaignId: string,
  vueInitiale: VueCombatJoueur
): { vue: VueCombatJoueur; relire: () => Promise<void> } {
  const [vue, setVue] = useState(vueInitiale);
  const supabase = useMemo(() => createClient(), []);
  const enVol = useRef(false);
  const rejouer = useRef(false);
  const monte = useRef(true);

  const relire = useCallback(async () => {
    if (enVol.current) {
      rejouer.current = true;
      return;
    }
    enVol.current = true;
    try {
      do {
        rejouer.current = false;
        try {
          const suivante = await lireVueCombat(campaignId);
          if (monte.current && suivante) setVue(suivante);
        } catch (erreur) {
          console.error("Vue du combat non relue", erreur);
        }
      } while (rejouer.current && monte.current);
    } finally {
      enVol.current = false;
    }
  }, [campaignId]);

  useEffect(() => {
    monte.current = true;
    const canal = supabase
      .channel(`combat_joueur:${campaignId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "combats", filter: `campaign_id=eq.${campaignId}` }, () => {
        void relire();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "combats", filter: `campaign_id=eq.${campaignId}` }, () => {
        void relire();
      })
      .subscribe();

    return () => {
      monte.current = false;
      supabase.removeChannel(canal);
    };
  }, [campaignId, supabase, relire]);

  return { vue, relire };
}
