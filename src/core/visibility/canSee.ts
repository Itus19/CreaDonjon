import { VisibilityScopeError } from "./errors";
import type { VisibilityContext, VisibilitySubject, Viewer } from "./types";

const ADMIN_WORLD_ROLES = new Set<string>(["owner", "editor"]);

function assertNever(x: never): never {
  throw new Error(`Niveau de visibilite non gere : ${JSON.stringify(x)}`);
}

/**
 * Fonction pure et unique de resolution de visibilite (SCHEMA.md §4.2).
 * Toute fuite de secret du projet passe par ici : c'est pour ca qu'elle
 * n'est jamais reimplementee ailleurs, et testee exhaustivement.
 */
export function canSee(subject: VisibilitySubject, viewer: Viewer, ctx: VisibilityContext = {}): boolean {
  switch (subject.level) {
    case "public":
      return true;

    case "players":
      if (viewer.kind === "anonymous") return false;
      if (viewer.worldRole && ADMIN_WORLD_ROLES.has(viewer.worldRole)) return true;
      return Object.keys(viewer.campaignRoles).length > 0;

    case "gm":
      if (viewer.kind === "anonymous") return false;
      if (viewer.worldRole && ADMIN_WORLD_ROLES.has(viewer.worldRole)) return true;
      return Object.values(viewer.campaignRoles).includes("gm");

    case "campaign": {
      if (!subject.scopeId) throw new VisibilityScopeError("campaign");
      if (viewer.kind === "anonymous") return false;
      // Le contenu 'campaign' n'est deverrouille que si on le consulte
      // effectivement depuis cette campagne precise, meme si le lecteur
      // est aussi membre d'une autre campagne du meme monde : un secret
      // propre a la campagne A ne doit pas transparaitre dans la
      // campagne B du meme MJ.
      if (ctx.campaignId !== subject.scopeId) return false;
      return viewer.campaignRoles[subject.scopeId] !== undefined;
    }

    case "user": {
      if (!subject.scopeId) throw new VisibilityScopeError("user");
      if (viewer.kind === "anonymous") return false;
      return viewer.userId === subject.scopeId;
    }

    case "private": {
      if (viewer.kind === "anonymous") return false;
      if (!subject.createdBy) return false;
      return viewer.userId === subject.createdBy;
    }

    default:
      return assertNever(subject.level);
  }
}
