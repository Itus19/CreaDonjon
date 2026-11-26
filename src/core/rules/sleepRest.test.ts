import { describe, expect, it } from "vitest";
import { decideLongRest, sommeilDemande, LONG_REST_MIN_MINUTES } from "./sleepRest";

describe("sommeilDemande — le joueur dit que son personnage dort", () => {
  it("reconnaît les tournures courantes", () => {
    for (const texte of ["je dors", "Je vais dormir", "je me couche", "je vais me coucher dans ma chambre", "je m'endors", "je fais un repos long", "on prend un long repos", "je dors jusqu'au matin", "je vais au lit"]) {
      expect(sommeilDemande(texte), texte).toBe(true);
    }
  });

  it("une négation, une parole ou un autre sens ne comptent pas", () => {
    for (const texte of ["je ne dors pas", "je reste éveillé sans dormir", "je lui demande « tu dors ? »", "je regarde la chambre", "je m'installe sur le lit", "je fais un repos court"]) {
      expect(sommeilDemande(texte), texte).toBe(false);
    }
  });
});

describe("decideLongRest — le moteur valide le repos long (règles 2024)", () => {
  const soir = { day: 1, hour: 22, minute: 0 };

  it("sans durée écrite, dormir vaut huit heures et un repos long", () => {
    expect(decideLongRest({ sommeil: true, minutesEcrites: null, enCombat: false, maintenant: soir, dernierRepos: null })).toEqual({ minutes: LONG_REST_MIN_MINUTES, repos: "applique" });
  });

  it("une durée écrite d'au moins 8 h compte ; plus courte, le temps passe sans repos long", () => {
    expect(decideLongRest({ sommeil: true, minutesEcrites: 9 * 60, enCombat: false, maintenant: soir, dernierRepos: null })).toEqual({ minutes: 9 * 60, repos: "applique" });
    expect(decideLongRest({ sommeil: true, minutesEcrites: 5 * 60, enCombat: false, maintenant: soir, dernierRepos: null })).toEqual({ minutes: 5 * 60, repos: "trop_court" });
  });

  it("un seul repos long par tranche de 16 h après la fin du précédent", () => {
    const fin = { day: 1, hour: 10, minute: 0 };
    expect(decideLongRest({ sommeil: true, minutesEcrites: null, enCombat: false, maintenant: soir, dernierRepos: fin })?.repos).toBe("trop_tot");
    expect(decideLongRest({ sommeil: true, minutesEcrites: null, enCombat: false, maintenant: { day: 2, hour: 2, minute: 0 }, dernierRepos: fin })?.repos).toBe("applique");
  });

  it("jamais en combat, jamais sans sommeil demandé", () => {
    expect(decideLongRest({ sommeil: true, minutesEcrites: null, enCombat: true, maintenant: soir, dernierRepos: null })).toBeNull();
    expect(decideLongRest({ sommeil: false, minutesEcrites: 8 * 60, enCombat: false, maintenant: soir, dernierRepos: null })).toBeNull();
  });
});
