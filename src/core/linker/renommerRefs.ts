/**
 * AG-12 — quand le MJ remplit (ou vide) le « Nom pour la table » d'une fiche,
 * les mentions de cette fiche dont le texte est l'ancien nom prennent le
 * nouveau (décidé le 24 novembre : « réécrits automatiquement »). Un texte
 * de lien choisi librement (« le vieux ») n'est pas un nom : il reste.
 *
 * Seuls le texte (segments) et l'Encadré (valeurs) portent un texte de lien ;
 * la chronologie et la quête ne gardent que l'identifiant. Agit sur la donnée
 * brute, comme `retirerCiblesCachees`, sans la réécrire par un schéma.
 */
function objet(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

const cle = (s: string) => s.trim().toLocaleLowerCase("fr");

export function renommerRefs<T>(blockType: string, data: T, entityId: string, anciens: readonly string[], nouveau: string): { data: T; change: boolean } {
  const noms = new Set(anciens.map(cle).filter((n) => n !== ""));
  let change = false;
  const noeuds = (liste: unknown): unknown => {
    if (!Array.isArray(liste)) return liste;
    return liste.map((n) => {
      const o = objet(n);
      if (o && o.t === "ref" && o.kind === "entity" && o.id === entityId && typeof o.label === "string" && noms.has(cle(o.label)) && o.label !== nouveau) {
        change = true;
        return { ...o, label: nouveau };
      }
      return n;
    });
  };
  const d = objet(data);
  if (!d) return { data, change: false };
  let resultat: unknown = data;
  if (blockType === "text" && Array.isArray(d.segments)) {
    resultat = {
      ...d,
      segments: d.segments.map((s) => {
        const seg = objet(s);
        return seg && Array.isArray(seg.content) ? { ...seg, content: noeuds(seg.content) } : s;
      }),
    };
  } else if (blockType === "infobox" && Array.isArray(d.entries)) {
    resultat = { ...d, entries: d.entries.map((e) => (objet(e) ? { ...objet(e), value: noeuds(objet(e)!.value) } : e)) };
  }
  return change ? { data: resultat as T, change } : { data, change: false };
}
