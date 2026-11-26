import { describe, expect, it } from "vitest";
import { renommerRefs } from "./renommerRefs";

const E = "11111111-1111-4111-8111-111111111111";
const AUTRE = "22222222-2222-4222-8222-222222222222";
const ref = (id: string, label: string) => ({ t: "ref", kind: "entity", id, label });

describe("renommerRefs (AG-12)", () => {
  it("renomme les mentions de la fiche dont le texte est un des anciens noms", () => {
    const data = { segments: [{ id: "s1", content: [{ t: "text", v: "Le journal d'" }, ref(E, "Aldren Voss"), ref(E, "le vieux"), ref(AUTRE, "Aldren Voss")] }] };
    const { data: apres, change } = renommerRefs("text", data, E, ["aldren voss "], "Le propriétaire inconnu");
    expect(change).toBe(true);
    expect(apres.segments[0]!.content).toEqual([{ t: "text", v: "Le journal d'" }, ref(E, "Le propriétaire inconnu"), ref(E, "le vieux"), ref(AUTRE, "Aldren Voss")]);
    expect(data.segments[0]!.content[1]).toEqual(ref(E, "Aldren Voss"));
  });

  it("renomme aussi les valeurs d'un Encadré, et garde les autres clés", () => {
    const data = { __v: 1, entries: [{ label: "Auteur", value: [ref(E, "Voss")], extra: 1 }] };
    const { data: apres, change } = renommerRefs("infobox", data, E, ["Voss"], "Inconnu");
    expect(change).toBe(true);
    expect(apres).toEqual({ __v: 1, entries: [{ label: "Auteur", value: [ref(E, "Inconnu")], extra: 1 }] });
  });

  it("ne dit rien quand aucune mention ne change, ni pour un autre type de bloc", () => {
    const data = { segments: [{ id: "s1", content: [ref(E, "le vieux")] }] };
    expect(renommerRefs("text", data, E, ["Aldren"], "X")).toEqual({ data, change: false });
    expect(renommerRefs("quest", { giver: { kind: "entity", id: E } }, E, ["Aldren"], "X").change).toBe(false);
  });
});
