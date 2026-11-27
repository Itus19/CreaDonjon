import type { AbstractWorld } from "./world";

/**
 * G-7b — les villes à faire naître autour d'un lieu (choix de l'auteur,
 * 26 novembre 2026 : la ville où l'on est, puis celles à une certaine distance
 * par la route). La distance suit les liens du monde (routes, sentiers, routes
 * maritimes), pas le vol d'oiseau : c'est ce qu'on entend dire en voyageant.
 */
export function sitesWithinKm(world: AbstractWorld, fromSiteId: string, radiusKm: number): { siteId: string; km: number }[] {
  if (!world.sites.some((s) => s.id === fromSiteId)) throw new RangeError(`Ville inconnue : ${fromSiteId}`);
  if (!(radiusKm >= 0)) throw new RangeError("Le rayon doit être positif ou nul");

  const neighbors = new Map<string, { to: string; km: number }[]>();
  for (const link of world.links) {
    neighbors.set(link.a, [...(neighbors.get(link.a) ?? []), { to: link.b, km: link.distanceKm }]);
    neighbors.set(link.b, [...(neighbors.get(link.b) ?? []), { to: link.a, km: link.distanceKm }]);
  }

  // Dijkstra simple : quelques centaines de villes, une file triée suffit.
  const best = new Map<string, number>([[fromSiteId, 0]]);
  const done = new Set<string>();
  const queue: string[] = [fromSiteId];
  while (queue.length > 0) {
    queue.sort((x, y) => (best.get(x) ?? 0) - (best.get(y) ?? 0));
    const current = queue.shift() as string;
    if (done.has(current)) continue;
    done.add(current);
    const base = best.get(current) ?? 0;
    for (const { to, km } of neighbors.get(current) ?? []) {
      const d = base + km;
      if (d > radiusKm || d >= (best.get(to) ?? Infinity)) continue;
      best.set(to, d);
      queue.push(to);
    }
  }
  return [...best.entries()]
    .map(([siteId, km]) => ({ siteId, km }))
    .sort((x, y) => x.km - y.km || x.siteId.localeCompare(y.siteId));
}

/** Les villes sans page dans le rayon, les plus proches d'abord, au plus `max` (un plafond pour la base). */
export function sitesToReveal(
  world: AbstractWorld,
  fromSiteId: string,
  options: { radiusKm: number; placed: ReadonlySet<string>; max: number }
): string[] {
  return sitesWithinKm(world, fromSiteId, options.radiusKm)
    .filter((s) => !options.placed.has(s.siteId))
    .slice(0, options.max)
    .map((s) => s.siteId);
}
