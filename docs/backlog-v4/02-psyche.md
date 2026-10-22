# Lot B — La psyché

*Partie du backlog V4. L'index : [`docs/BACKLOG_V4.md`](../BACKLOG_V4.md). Le cadre commun : [`00-cadre.md`](00-cadre.md).*

Passer de « une fiche qui décrit une personne » à « une personne que le moteur peut faire vivre ». La richesse visée est celle de Dwarf Fortress ; la saisie reste supportable grâce au questionnaire (lot D).

Les couches, décidées le 22 octobre 2026 :

| Couche | Nature | Ordre de grandeur visé | Bouge |
|---|---|---|---|
| **Facettes** (tempérament) | stables | une cinquantaine, groupées en familles | rarement, par transformation (E5) |
| **Valeurs** (convictions) | stables, communes aux personnes et aux factions | une trentaine | rarement, par transformation |
| **Besoins** | jauges qui s'épuisent avec le temps | une douzaine à une trentaine | sans cesse (E3) |
| **Rêves** | buts typés, avec paramètres | une liste fermée d'une quinzaine de types | quand ils sont atteints, abandonnés ou trahis |
| **Émotions, stress** | états passagers | une vingtaine d'émotions | à chaque événement (E2) |
| **Préférences** | goûts et dégoûts | listes ouvertes par monde | presque jamais |
| **Lignes et limites** | ce que la personne ne fera jamais, ou à contrecœur | texte, plus une forme typée quand c'est possible | par transformation |
| **Identité et orientations** | genre, pronoms, orientations sexuelle, romantique, relationnelle | listes du monde (A6) | jamais par la simulation |

---

### ☐ V4-B1 — La spec de la psyché V4 · `L` · sans modèle IA — **à concevoir**

**Modèle conseillé : Opus** — conception du cœur du lot.

**Sous-tâches Haiku** : aucune avant la spec ; ensuite, la liste des libellés à reporter dans `messages/`.

Écrire `specs/psyche-v4.md`, qui remplace `specs/psyche-pnj.md` sur tout ce qu'il redéfinit.

**À fixer**
- **Les listes**, chacune avec sa clé anglaise `snake_case`, son libellé, ses bandes nommées et sa famille : facettes, valeurs, besoins, types de rêves, émotions. L'auteur relit les raws de son installation de Dwarf Fortress pour s'en inspirer ; on n'en recopie rien (`00-cadre.md` §5).
- **Les échelles** : facettes et valeurs en −100…+100 (comme aujourd'hui) ; besoins en 0…100 (0 = comblé) ; émotions en intensité 0…100 avec un délai de retombée.
- **Les liens entre couches** : le poids d'un besoin vient des facettes (une personne très sociable a un besoin de compagnie plus fort) ; un rêve naît des valeurs et des facettes.
- **Les rêves typés** : la liste fermée des types (`avenge`, `rule`, `found_family`, `master_craft`, `acquire`, `protect`, `escape`, `be_recognized`, `explore`, `serve`…), leurs paramètres (entité, lieu, objet), comment on sait qu'un rêve est atteint ou devenu impossible. Le texte libre actuel des aspirations devient l'habillage du rêve.
- **Ce que reçoit le modèle** : un résumé en bandes nommées, borné (B6).
- **Ce que reçoit l'écran**, et pour qui (lot H).

**Critères d'acceptation**
- [ ] `specs/psyche-v4.md` écrit et relu avec l'auteur.
- [ ] `specs/psyche-pnj.md` porte un bandeau qui renvoie à la nouvelle spec.
- [ ] Découpage des tickets B2 à B6 confirmé ou ajusté.

---

### ☐ V4-B2 — Les blocs de la psyché, dans le noyau · `L` · sans modèle IA — **prêt après B1 et A6**

**Modèle conseillé : Opus** — schémas versionnés, migration de données lue par le schéma.

**Sous-tâches Haiku** : lancer `npm run test:core` et résumer les échecs.

- Schémas Zod des blocs de graine : `personality` passe en `__v: 2` (facettes, rêves typés, besoins de départ, préférences) ; `worldview` en `__v: 2` (valeurs). Ou de nouveaux blocs, si B1 le décide.
- Bandes nommées pour chaque échelle (`src/core/psyche/bands.ts` étendu).
- Lecture d'un bloc `__v: 1` : mise à niveau à la lecture (B3), jamais une réécriture forcée en base.

**Critères d'acceptation**
- [ ] Tout bloc `__v: 1` existant se lit sans erreur dans la forme `__v: 2`.
- [ ] Chaque échelle a ses bandes testées aux bornes.
- [ ] Le registre des blocs et `publicShare.blockCoverage.test.ts` restent verts.

---

### ☐ V4-B3 — Convertir l'existant · `M` · sans modèle IA — **prêt après B2**

**Modèle conseillé : Opus** — conversion des données réelles de l'auteur.

**Sous-tâches Haiku** : recenser les blocs `personality`, `worldview` et `relationship` des mondes de l'auteur (compte seulement, aucune donnée recopiée).

L'auteur l'a demandé : les outils actuels se convertissent aux nouveaux.

- Une table de correspondance, dans le noyau, des 6 pôles vers les facettes et des 7 convictions vers les valeurs (un pôle peut nourrir plusieurs facettes). Les facettes sans correspondance partent au neutre.
- Les aspirations deviennent des rêves de type `custom`, avec leur texte, leur horizon et leur visibilité ; l'auteur peut les typer ensuite.
- L'axe `attraction_repulsion` part sur l'attirance **romantique** ; l'attirance sexuelle part au neutre (C3).
- Le journal existant (`personality_events`, `attitude_events`) reste valide : rejouer depuis la graine convertie redonne l'état actuel converti.

**Critères d'acceptation**
- [ ] Une fiche convertie affiche, sur ses facettes correspondantes, la même bande qu'avant.
- [ ] Rejouer le journal d'une paire après conversion redonne la valeur courante.
- [ ] Rien n'est perdu : le texte d'une aspiration, sa visibilité, ses lignes rouges.

---

### ☐ V4-B4 — Identité et orientations · `M` · sans modèle IA — **prêt après A6**

**Modèle conseillé : Opus** — données sensibles, visibilité, règle « un filtre, jamais un trait ».

**Sous-tâches Haiku** : reporter les libellés dans `messages/` ; mettre à jour la planche du catalogue.

Le bloc `character` porte déjà `gender` et `pronouns`. On y ajoute, toujours facultatifs :

- **Identité de genre** : liste du monde (femme, homme, personne non binaire, agenre, genderfluid…), avec la mention trans ou cis séparée et facultative, et un libellé libre.
- **Pronoms structurés** : sujet (il, elle, iel, ou libre) et **accord** (masculin, féminin, neutre, mixte), parce qu'en français la narration doit accorder les adjectifs. Le champ texte actuel reste lisible.
- **Orientation sexuelle** et **orientation romantique**, séparées : hétéro, homo (gay, lesbienne), bi, pan, ace et aro avec leurs nuances (demi, gris), questionnement, libellé libre.
- **Orientation relationnelle** : monogame, polyamour hiérarchique, polyamour non hiérarchique, polyacceptant, anarchie relationnelle, libellé libre.
- **Affichage** : ces champs **sont toujours affichés** sur la fiche, selon la visibilité choisie pour chacun, comme toute donnée (règle 5). Les réglages de table (H1) ne les masquent jamais ; ils ne touchent qu'au récit et à la simulation romantique.

**Critères d'acceptation**
- [ ] Les champs se saisissent, s'affichent, et respectent leur visibilité côté serveur.
- [ ] Le test « un filtre, jamais un trait » (`00-cadre.md` §4, critère 12) existe et passe.
- [ ] Une fiche existante sans ces champs s'affiche exactement comme avant.

---

### ☐ V4-B5 — La psyché sur la fiche · `L` · sans modèle IA — **à esquisser, puis prêt (Sonnet)**

**Modèle conseillé : Sonnet**, après une esquisse décidée avec l'auteur. **Dépend de** : B2, A1.

**Sous-tâches Haiku** : planche du catalogue ; libellés.

- Cinquante facettes ne s'affichent pas en cinquante curseurs : **les familles repliées**, les traits les plus marqués en tête (« les cinq qui la définissent »), le reste à la demande.
- Deux temps lisibles : **au départ** (la graine) et **aujourd'hui** (l'état courant), avec l'écart (A1).
- Besoins et émotions : des jauges en bandes nommées, le nombre au survol pour le MJ.
- Chaque valeur qui a bougé dit **pourquoi** (le souvenir ou l'événement qui l'a fait bouger), comme dans Dwarf Fortress.
- Le catalogue d'interface est cherché d'abord (`docs/CHARTE-UI.md` §9).

**Critères d'acceptation**
- [ ] L'esquisse est validée par l'auteur avant le code.
- [ ] La fiche reste lisible à 375 px.
- [ ] La planche du catalogue est à jour.

---

### ☐ V4-B6 — La psyché dans le contexte du modèle · `M` · **avec modèle IA** — **prêt après B2 et H1**

**Modèle conseillé : Opus** — contexte du modèle, audience (règle 11).

**Sous-tâches Haiku** : vérifications et résumé des échecs.

- Le résumé d'une personne présente : ses traits marquants, ses valeurs prioritaires, ses besoins pressants, son émotion du moment, son rêve actif, ses lignes rouges, ses pronoms et accords. En bandes nommées, jamais en nombres.
- Borné : un plafond de tokens par personne, fixé après mesure (la V2 visait 80).
- Ce que l'audience de la sortie n'a pas le droit de savoir n'y entre pas (règle 11), y compris ce que les réglages de table cachent au joueur (H1).
- Le réglage « récit intime explicite ou en ellipse » (H1) est transmis comme consigne.

**Critères d'acceptation**
- [ ] Le contexte d'une personne ne dépasse pas son plafond.
- [ ] Un test vérifie qu'une donnée « MJ seul » n'entre jamais dans un contexte lu par un joueur.
- [ ] Vérifié en direct sur trois tours : les pronoms et accords sont respectés par la narration.
