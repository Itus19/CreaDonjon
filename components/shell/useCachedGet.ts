"use client";

import { useEffect, useState } from "react";

// Cache module-level, meme motif que `useWorldRuleEntries.ts` — mais qui ne
// s'arrete jamais au premier succes : contrairement a la liste de regles
// d'un monde, un journal ou une liste d'invitations change pendant la
// partie. Un GET par cle est donc TOUJOURS relance au montage (voir
// l'effet ci-dessous), ce cache ne sert qu'a peindre quelque chose
// d'immediat plutot que "Chargement..." pendant que la requete tourne.
const cache = new Map<string, unknown>();

/**
 * Bug reel (retour utilisateur, V2-M7 suite : "elle a l'air de se
 * recharger a chaque changement d'onglet") : `WindowsDesktop` est monte une
 * fois PAR SECTION (Monde/Regles/MJ, ADR-0011), jamais une seule fois pour
 * les trois — chaque bascule de section demonte donc et remonte les
 * fenetres `avec` en cours, y compris leur contenu React. Un composant qui
 * charge ses propres donnees au montage (`GmJournalPanel`, `CampaignDetail`,
 * `InviteLinkPanel`) rejouait donc un "Chargement..." visible a chaque
 * bascule, alors que les donnees n'avaient pas change. Ce hook peint le
 * dernier resultat connu INSTANTANEMENT (jamais de flash), tout en relancant
 * quand meme une requete fraiche en arriere-plan a chaque montage — la
 * donnee affichee reste a jour, seul le flash disparait.
 */
export function useCachedGet<T>(key: string, url: string): { data: T | null; reload: () => void } {
  const [data, setData] = useState<T | null>(() => (cache.has(key) ? (cache.get(key) as T) : null));
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: T | null) => {
        if (cancelled || body === null) return;
        cache.set(key, body);
        setData(body);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [key, url, nonce]);

  return { data, reload: () => setNonce((n) => n + 1) };
}
