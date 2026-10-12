/**
 * V3-F3 (ADR 0058) — remplace, dans une valeur JSON quelconque (donnees d'un
 * bloc, d'une revision mecanique), les identifiants d'image d'un monde par
 * ceux de leurs copies dans un monde neuf.
 *
 * Chaque chaine est parcourue, et chaque identifiant connu y est remplace
 * PARTOUT ou il apparait : une carte le porte seul (`assetId`), une adresse
 * le porte au milieu (`/api/assets/<id>`). Un identifiant est un uuid : il
 * ne peut pas se confondre avec un autre texte. Les cles ne sont jamais
 * touchees. Meme parcours structurel que `remapEntityIds`.
 */
export function remapAssetIds(value: unknown, idMap: ReadonlyMap<string, string>): unknown {
  if (idMap.size === 0) return value;
  if (typeof value === "string") {
    let resultat = value;
    for (const [ancien, nouveau] of idMap) {
      if (resultat.includes(ancien)) resultat = resultat.split(ancien).join(nouveau);
    }
    return resultat;
  }
  if (Array.isArray(value)) return value.map((item) => remapAssetIds(item, idMap));
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) result[key] = remapAssetIds(v, idMap);
    return result;
  }
  return value;
}
