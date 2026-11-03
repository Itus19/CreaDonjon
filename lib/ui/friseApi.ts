import type { CalendarConfigInput } from "@/src/core/schemas/calendar";

/**
 * Appels réseau de la frise de la Chronologie (V3.1-98), sortis du composant :
 * aucun effet de montage ici (cliquet du câblage, docs/CABLAGE.md §6). Chaque
 * appel rend `null` si tout va bien, sinon le message d'erreur du serveur
 * (`conflit` : la version du bloc a changé, il faut relire la frise).
 */

export type ResultatEcriture = { ok: true } | { ok: false; conflit: boolean; message: string | null };

async function lireErreur(res: Response): Promise<string | null> {
  const corps = (await res.json().catch(() => null)) as { error?: unknown } | null;
  return typeof corps?.error === "string" ? corps.error : null;
}

async function echec(res: Response): Promise<ResultatEcriture> {
  return { ok: false, conflit: res.status === 409, message: await lireErreur(res) };
}

/** « → en faire une fiche » : l'entrée devient une fiche `event`, liée par `ref`. */
export async function promouvoirEntree(params: { blockId: string; version: number; entryId: string }): Promise<ResultatEcriture> {
  const res = await fetch(`/api/blocks/${params.blockId}/timeline-promote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version: params.version, entryId: params.entryId }),
  });
  return res.ok ? { ok: true } : echec(res);
}

/** Écrit tout le calendrier du monde (la route le remplace en entier) : seules les ères ont changé ici. */
export async function enregistrerCalendrier(worldSlug: string, calendrier: CalendarConfigInput): Promise<ResultatEcriture> {
  const res = await fetch(`/api/worlds/${worldSlug}/calendar`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(calendrier),
  });
  return res.ok ? { ok: true } : echec(res);
}

type BlocLu = {
  id: string;
  display: unknown;
  data: { entries?: { id: string; visibility?: unknown }[] } & Record<string, unknown>;
  version: number;
  visibilityLevel: string;
  visibilityScopeId: string | null;
};

/**
 * Change la visibilité d'UNE date d'un bloc Chronologie : la frise ne porte
 * pas le bloc entier, on le relit (version comprise) puis on le réécrit avec
 * la seule date changée — le chemin habituel d'enregistrement d'un bloc.
 */
export async function changerVisibiliteEntree(params: { entityId: string; blockId: string; entryId: string; niveau: string }): Promise<ResultatEcriture> {
  const lecture = await fetch(`/api/entities/${params.entityId}/blocks`);
  if (!lecture.ok) return echec(lecture);
  const blocs = (await lecture.json()) as BlocLu[];
  const bloc = blocs.find((b) => b.id === params.blockId);
  if (!bloc || !Array.isArray(bloc.data.entries) || !bloc.data.entries.some((e) => e.id === params.entryId)) {
    return { ok: false, conflit: false, message: null };
  }
  const entries = bloc.data.entries.map((e) => (e.id === params.entryId ? { ...e, visibility: { level: params.niveau, scopeId: null } } : e));
  const res = await fetch(`/api/blocks/${params.blockId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      version: bloc.version,
      display: bloc.display,
      data: { ...bloc.data, entries },
      visibility: { level: bloc.visibilityLevel, scopeId: bloc.visibilityScopeId },
    }),
  });
  return res.ok ? { ok: true } : echec(res);
}
