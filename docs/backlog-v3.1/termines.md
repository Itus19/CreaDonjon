

---

### ☑ V3.1-74 — Dates de naissance et de mort (données) · `M` · sans modèle IA — **fait le 13 octobre (ADR 0063, complément)**

**Modèle conseillé : Opus** — donnée nouvelle, ADR, `SCHEMA.md`.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Départ** : V3.1-48 (la naissance d'un personnage devient une `GameDate`
dans le bloc `character`), `src/core/schemas/blocks/character.ts`,
`src/core/calendar/`, `src/server/services/genealogy.ts`. **Dépend de** :
48.

**La question (ouverte)** : la Généalogie B montre « 1420 – 1478 † » et
« née en 1424 ». La naissance existera avec V3.1-48 (bloc `character`) ;
**la mort n'existe nulle part**, et une fiche sans bloc `character` (un
PNJ décrit en texte) n'a pas de naissance.

**Décidé (auteur, 8 octobre) — la proposition ci-dessous est acceptée**
- Naissance : celle de V3.1-48 (`character`).
- Mort : un champ optionnel `death` (`GameDate`) dans le même bloc ;
  « défunt » = `death` renseigné (pas de booléen à part, règle 16).
- Une fiche sans bloc `character` : pas de dates dans l'arbre (rien
  d'inventé).
- L'âge affiché s'arrête à la mort.

**À faire** : ADR (décision ci-dessus, dix lignes), `SCHEMA.md`, schéma Zod (lecture
tolérante), service de la généalogie qui lit naissance et mort en **une
requête groupée**, remplissage de la ligne prévue en V3.1-73.

**Note de clôture (13 octobre, Opus).** [ADR 0063](../adr/0063-naissance-en-date-de-jeu.md), section « Complément ».

*Fait* :
- `death` dans le bloc `character` ;
- `lifeDatesFromCharacter` et `ageWithDeath` (7 tests) ; l'âge de la fiche et de la colonne solo s'arrête à la mort ;
- la généalogie lit naissance et mort en une requête groupée et les filtre pour le lecteur (2 tests d'intégration : une date réservée au MJ ne part pas vers le wiki public).

*Vu en route* : le bloc `character` a sa propre visibilité. Sans ce filtre, la date de naissance d'un PNJ secret serait partie dans l'arbre.

*Restes* :
- la ligne de dates de l'arbre attend V3.1-73 (Sonnet), qui reçoit la donnée ;
- aucun écran ne permet encore de saisir une mort. Le champ existe, mais il faudra un ticket de saisie (avec 73, ou la fiche).
