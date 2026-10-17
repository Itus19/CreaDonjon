import { describe, expect, it } from "vitest";
import { jetonDepuisLien, verifierLienSchema } from "./lienInvitation";

describe("jeton d'un lien d'invitation collé (V3.1-35)", () => {
  it("un lien complet, de n'importe quel hôte", () => {
    expect(jetonDepuisLien("https://creadonjon.vercel.app/rejoindre/AbC_12-xyZ987")).toBe("AbC_12-xyZ987");
    expect(jetonDepuisLien("http://localhost:3100/rejoindre/AbC_12-xyZ987")).toBe("AbC_12-xyZ987");
  });
  it("espaces, barre finale, suite d'adresse, paramètres : ignorés", () => {
    expect(jetonDepuisLien("  https://x.fr/rejoindre/AbC_12-xyZ987/  ")).toBe("AbC_12-xyZ987");
    expect(jetonDepuisLien("https://x.fr/rejoindre/AbC_12-xyZ987/entrer")).toBe("AbC_12-xyZ987");
    expect(jetonDepuisLien("https://x.fr/rejoindre/AbC_12-xyZ987?x=1#haut")).toBe("AbC_12-xyZ987");
  });
  it("un chemin sans hôte, ou le jeton seul", () => {
    expect(jetonDepuisLien("/rejoindre/AbC_12-xyZ987")).toBe("AbC_12-xyZ987");
    expect(jetonDepuisLien("rejoindre/AbC_12-xyZ987")).toBe("AbC_12-xyZ987");
    expect(jetonDepuisLien("AbC_12-xyZ987")).toBe("AbC_12-xyZ987");
  });
  it("ce qui n'est pas une invitation : null", () => {
    expect(jetonDepuisLien("")).toBeNull();
    expect(jetonDepuisLien("bonjour")).toBeNull();
    expect(jetonDepuisLien("https://x.fr/m/faerun")).toBeNull();
    expect(jetonDepuisLien("https://x.fr/rejoindre/")).toBeNull();
    expect(jetonDepuisLien("https://x.fr/rejoindre/a b")).toBeNull();
    expect(jetonDepuisLien("https://x.fr/rejoindre/<script>")).toBeNull();
    expect(jetonDepuisLien("x".repeat(300))).toBeNull();
  });
  it("le schéma d'entrée borne le texte collé", () => {
    expect(verifierLienSchema.safeParse({ lien: "https://x.fr/rejoindre/AbC_12-xyZ987" }).success).toBe(true);
    expect(verifierLienSchema.safeParse({ lien: "" }).success).toBe(false);
    expect(verifierLienSchema.safeParse({ lien: "x".repeat(2001) }).success).toBe(false);
    expect(verifierLienSchema.safeParse({}).success).toBe(false);
  });
});
