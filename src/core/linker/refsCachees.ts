/**
 * AG-11 — un lien vers une fiche que le lecteur ne voit pas devient du texte
 * ordinaire, côté serveur, avant l'envoi.
 *
 * Avant, le lien partait avec l'identifiant de la fiche cachée et
 * s'affichait en rouge : la joueuse apprenait qu'une fiche secrète existait.
 * Un masquage à l'affichage ne suffirait pas (règle absolue 5) :
 * l'identifiant resterait lisible dans la page. Le texte du lien, lui, est
 * celui que le MJ a écrit dans le récit : il reste.
 */
function objet(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Une référence `{ kind: "entity", id }` vers une fiche cachée. */
function refCachee(ref: unknown, visibles: ReadonlySet<string>): boolean {
  const r = objet(ref);
  return !!r && r.kind === "entity" && (typeof r.id !== "string" || !visibles.has(r.id));
}

function noeudsSansCachees(noeuds: unknown, visibles: ReadonlySet<string>): unknown {
  if (!Array.isArray(noeuds)) return noeuds;
  return noeuds.map((n) => {
    const o = objet(n);
    if (o && o.t === "ref" && refCachee(o, visibles)) return { t: "text", v: typeof o.label === "string" ? o.label : "" };
    return n;
  });
}

/**
 * AG-11 — la même règle pour chaque bloc qui cite des fiches : texte
 * (mentions), Encadré (valeurs), chronologie et quête (références). Agit sur
 * la donnée brute, sans la réécrire par un schéma (qui retirerait des clés),
 * et rend la donnée d'origine pour tout autre type de bloc.
 */
export function retirerCiblesCachees<T>(blockType: string, data: T, visibles: ReadonlySet<string>): T {
  return retirer(blockType, data, visibles) as T;
}

/** Même forme en sortie qu'en entrée : seuls des nœuds `ref` deviennent des nœuds `text`, ou des `ref` optionnelles disparaissent. */
function retirer(blockType: string, data: unknown, visibles: ReadonlySet<string>): unknown {
  const d = objet(data);
  if (!d) return data;
  if (blockType === "text" && Array.isArray(d.segments)) {
    return {
      ...d,
      segments: d.segments.map((s) => {
        const seg = objet(s);
        return seg && Array.isArray(seg.content) ? { ...seg, content: noeudsSansCachees(seg.content, visibles) } : s;
      }),
    };
  }
  if (blockType === "infobox" && Array.isArray(d.entries)) {
    return { ...d, entries: d.entries.map((e) => (objet(e) ? { ...objet(e), value: noeudsSansCachees(objet(e)!.value, visibles) } : e)) };
  }
  const sansRef = (liste: unknown) =>
    Array.isArray(liste)
      ? liste.map((item) => {
          const o = objet(item);
          if (!o || !refCachee(o.ref, visibles)) return item;
          return Object.fromEntries(Object.entries(o).filter(([cle]) => cle !== "ref"));
        })
      : liste;
  if (blockType === "timeline") return { ...d, entries: sansRef(d.entries) };
  if (blockType === "quest") {
    return {
      ...d,
      giver: refCachee(d.giver, visibles) ? null : d.giver,
      objectives: sansRef(d.objectives),
      rewards: sansRef(d.rewards),
      prerequisites: sansRef(d.prerequisites),
    };
  }
  return data;
}
