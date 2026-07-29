/** SCHEMA.md §4.1 — jamais une chaine encodee, deux colonnes. */
export type VisibilityLevel = "public" | "players" | "gm" | "campaign" | "user" | "private";

/** Ce dont canSee a besoin pour trancher, independamment de sa forme en base. */
export interface VisibilitySubject {
  level: VisibilityLevel;
  scopeId: string | null;
  createdBy: string | null;
}

/** SCHEMA.md §4.2. */
export type Viewer =
  | { kind: "anonymous" }
  | {
      kind: "user";
      userId: string;
      worldRole: "owner" | "editor" | "viewer" | null;
      campaignRoles: Record<string, "gm" | "player">;
    };

export interface VisibilityContext {
  /** La campagne dans le contexte de laquelle la lecture a lieu, le cas echeant. */
  campaignId?: string;
}

/** Tout ce qui porte une visibilite : un segment narratif, un bloc, une relation... */
export interface VisibilityAware {
  visibility: VisibilitySubject;
}
