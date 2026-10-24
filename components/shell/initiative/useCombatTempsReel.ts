"use client";

import { useEffect, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CombatRow } from "@/src/server/repos/combats";

/** Les signaux qui se suivent de près (un geste touche le combat et ses participants) ne font qu'une relecture. */
const DELAI_RELECTURE_MS = 350;

/**
 * V3.1-38 — l'Initiative du MJ suit le temps réel. `combats.updated_at` change à
 * chaque changement de participant, y compris quand une joueuse change ses PV
 * sur sa fiche : un seul canal sur la table `combats`, filtré sur la campagne,
 * suffit (une ligne par combat, pas une par participant). Il sert deux besoins :
 * - la ligne reçue met à jour « Mes combats » (nom, statut, round) sans rien relire ;
 * - quand elle concerne le combat ouvert, `surChangement` relit son détail
 *   (le signal ne porte que la ligne du combat, pas les participants).
 *
 * Quota (docs/QUOTAS.md Q3) : un seul canal pour la page, refermé au démontage ;
 * le filtre est posé côté serveur. Ce fichier ne contient aucun `fetch` : la
 * relecture est celle du tracker (`lib/ui/initiativeApi.ts`).
 */
export function useCombatTempsReel({
  campaignId,
  combatId,
  surLigne,
  surChangement,
}: {
  campaignId: string;
  /** Le combat ouvert, ou `null` (la liste seule). */
  combatId: string | null;
  /** Une ligne `combats` de la campagne vient de changer ou d'apparaître. */
  surLigne: (ligne: CombatRow) => void;
  /** Le combat ouvert a changé : relire son détail. */
  surChangement: () => void;
}): void {
  const supabase = useMemo(() => createClient(), []);
  // Les rappels et le combat ouvert changent à chaque rendu : on garde les derniers sans rouvrir le canal.
  const dernier = useRef({ combatId, surLigne, surChangement });
  useEffect(() => {
    dernier.current = { combatId, surLigne, surChangement };
  });

  useEffect(() => {
    let minuteur: ReturnType<typeof setTimeout> | null = null;

    function recu(ligne: CombatRow) {
      dernier.current.surLigne(ligne);
      if (ligne.id !== dernier.current.combatId) return;
      if (minuteur !== null) clearTimeout(minuteur);
      minuteur = setTimeout(() => {
        minuteur = null;
        dernier.current.surChangement();
      }, DELAI_RELECTURE_MS);
    }

    const canal = supabase
      .channel(`combat_mj:${campaignId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "combats", filter: `campaign_id=eq.${campaignId}` }, (payload) => {
        recu(payload.new as CombatRow);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "combats", filter: `campaign_id=eq.${campaignId}` }, (payload) => {
        recu(payload.new as CombatRow);
      })
      .subscribe();

    return () => {
      if (minuteur !== null) clearTimeout(minuteur);
      supabase.removeChannel(canal);
    };
  }, [campaignId, supabase]);
}
