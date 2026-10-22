# Lot E — La boucle de vie

*Partie du backlog V4. L'index : [`docs/BACKLOG_V4.md`](../BACKLOG_V4.md). Le cadre commun : [`00-cadre.md`](00-cadre.md).*

Le cœur de la V4 : ce qui fait qu'une personne **vit** au lieu d'être décrite.

```
événement
  → évaluation (pure) : événement × facettes × valeurs × relation à l'auteur
  → émotion (type, intensité) et stress
  → souvenir (lot C)
  → effets : attitudes, besoins
  → avec le temps : consolidation → glissement des facettes et des valeurs
besoins + rêves + valeurs + relations
  → choix d'une action par score d'utilité
  → nouvel événement
```

L'émergence ne vient pas de règles complexes, mais de **règles simples qui se répondent**. Deux conditions : des boucles qui **s'amortissent** (sinon le monde s'emballe ou s'endort), et une histoire **lisible** (la chronique, G5).

---

### ☐ V4-E1 — Évaluer un événement · `L` · sans modèle IA — **à concevoir (ADR)**

**Modèle conseillé : Opus** — règles d'évaluation, en données.

**Sous-tâches Haiku** : aucune avant l'ADR.

**À décider dans l'ADR**
- La liste fermée des **émotions** (B1) et leur retombée.
- **Les règles d'évaluation, en données** (comme les déclencheurs) : pour un genre d'événement du monde (A4), quelle émotion, de quelle intensité, selon quelles facettes et valeurs du témoin, et selon sa relation à l'auteur et à la victime. Une personne très empathique témoin d'une cruauté envers un inconnu ressent de l'horreur ; une personne dure, de l'indifférence.
- **Le stress** : une jauge que les émotions négatives remplissent et que les besoins comblés vident. Ce qui se passe à ses seuils (crise, effondrement, colère) est un événement.
- Ce qui reste hors du vocabulaire : jamais une règle écrite en code par l'utilisateur.

**Critères d'acceptation**
- [ ] ADR écrit, découpage en tickets prêts.

---

### ☐ V4-E2 — Émotions et stress, dans le noyau · `M` · sans modèle IA — **prêt après E1**

**Modèle conseillé : Opus** — noyau, tests d'abord.

**Sous-tâches Haiku** : lancer `npm run test:core` et résumer les échecs.

`appraise(event, witness, context): Emotion[]` et la retombée dans le temps, dans `src/core/sim/appraisal.ts`.

**Critères d'acceptation**
- [ ] Deux témoins aux facettes opposées ressentent des émotions différentes du même événement (test).
- [ ] Le stress d'une personne laissée en paix redescend (test sur un an simulé).

---

### ☐ V4-E3 — Les besoins · `M` · sans modèle IA — **prêt après B2 et A3**

**Modèle conseillé : Opus** — noyau.

**Sous-tâches Haiku** : lancer `npm run test:core` et résumer les échecs.

- Chaque besoin se creuse avec le temps, à une vitesse qui dépend des facettes.
- Une action le comble (E4). Un besoin longtemps insatisfait produit du stress.
- **Ce sont les besoins qui font bouger une personne sans scénario** : un PNJ seul cherche de la compagnie, un dévot va au temple.

**Critères d'acceptation**
- [ ] Un besoin non comblé atteint sa bande « pressant » en un temps conforme à la spec (test).
- [ ] Rattraper un mois d'un coup donne le même état qu'avancer jour par jour (test : le rattrapage paresseux ne change pas le résultat, à la tolérance fixée en A3).

---

### ☐ V4-E4 — Agir : les actions de vie et le choix par utilité · `L` · sans modèle IA — **à concevoir, puis prêt**

**Modèle conseillé : Opus** — vocabulaire fermé, moteur de décision.

**Sous-tâches Haiku** : libellés des actions.

- **Un vocabulaire fermé d'actions de vie**, en données, au niveau de détail des figures complètes : se lier, se disputer, séduire, rompre, aider, voler, prier, travailler, s'entraîner, voyager, chercher quelqu'un, comploter, se venger, fuir, fêter, pleurer…
- Chaque action déclare ses **conditions** (qui, où, avec quoi), ses **effets** (événement du monde produit, besoins comblés) et ses **affinités** (quelles facettes, valeurs et émotions la favorisent).
- **Le choix par score d'utilité** : besoins pressants, rêve actif, émotion du moment, valeurs, relations avec les personnes concernées. Puis un tirage dérivé (A2) parmi les meilleures, pour que la même personne ne fasse pas toujours la même chose.
- **Lignes rouges** : une action contraire à une ligne n'est jamais choisie ; une action contraire à une limite l'est rarement, et laisse un souvenir de malaise.
- **Bornes** comme les déclencheurs : actions par personne et par pas, profondeur des conséquences.
- **Les PJ ne sont jamais acteurs de la simulation** : la simulation ne choisit jamais une action à la place d'un joueur.

**Critères d'acceptation**
- [ ] Une action contraire à une ligne rouge n'est jamais choisie, sur 10 000 tirages (test).
- [ ] Deux personnes aux facettes opposées dans la même situation choisissent des actions différentes (test).
- [ ] Aucun PJ n'est jamais acteur d'une action simulée (test).

---

### ☐ V4-E5 — Se transformer · `M` · sans modèle IA — **prêt après C2 et E2**

**Modèle conseillé : Opus** — touche aux valeurs ; ce que la spec V2 protégeait.

**Sous-tâches Haiku** : vérifications et résumé des échecs.

- Un souvenir long, ravivé assez souvent, **déplace** des facettes ou des valeurs selon des règles en données : le deuil durcit, la trahison rend méfiant, la reconnaissance rend généreux.
- Un rêve atteint, abandonné ou devenu impossible en fait naître un autre.
- Chaque transformation s'écrit dans `personality_events`, avec le souvenir qui l'a causée.
- **Pour un PJ**, la transformation suit le réglage de table (H1) : proposée au joueur (par défaut) ou appliquée.
- **L'IA ne transforme jamais personne** (`specs/psyche-pnj.md` §5, inchangé).

**Critères d'acceptation**
- [ ] Une transformation dit toujours pourquoi (le souvenir source).
- [ ] Sur 200 ans simulés, les facettes d'une population ne convergent pas toutes vers les mêmes valeurs (le danger que la spec V2 décrivait, « ils finissent tous par se ressembler »).

---

### ☐ V4-E6 — Figures légères et figures complètes · `L` · sans modèle IA — **à concevoir (ADR)**

**Modèle conseillé : Opus** — volume en base, cohérence, passage d'un niveau à l'autre.

**Sous-tâches Haiku** : aucune avant l'ADR.

Tout le monde ne peut pas avoir toutes les couches. Dwarf Fortress fait la même distinction.

**À décider dans l'ADR**
- **Figure légère** : facettes et valeurs résumées, un rêve, les liens majeurs, les actes notables (événements du monde où elle est actrice). Quelques centaines d'octets. Simulée au pas grossier.
- **Figure complète** : toutes les couches, souvenirs compris. Simulée au pas fin.
- **Promotion** : quand une figure se rapproche du joueur, est ouverte par le MJ ou devient actrice d'un événement important. Ses couches manquantes se **reconstituent de façon déterministe** à partir de sa graine (D5) et de ses actes : une figure qui a trahi son frère devient complète avec le souvenir long de cette trahison.
- **Rétrogradation** : une figure complète que plus rien ne rend pertinente redevient légère. Ses souvenirs longs sont conservés en résumé ; elle ne disparaît jamais.
- **La foule anonyme** reste hors simulation individuelle : elle appartient à l'échelle politique (lot P) ou aux générateurs.
- La mesure : combien de figures complètes une partie supporte (A5).

**Critères d'acceptation**
- [ ] ADR écrit, découpage en tickets prêts.

---

### ☐ V4-E7 — L'intime : attirance, couples, et ce qu'on vit de l'exclusivité · `M` · sans modèle IA — **prêt après C3 et B4**

**Modèle conseillé : Opus** — données sensibles, réglages de table, règle « un filtre, jamais un trait ».

**Sous-tâches Haiku** : vérifications et résumé des échecs.

- **L'attirance** romantique ou sexuelle ne peut naître qu'entre personnes dont les orientations la permettent (filtre), puis selon les facettes, les valeurs et les souvenirs partagés.
- **L'orientation relationnelle** décide de la réaction quand un partenaire a une autre relation : jalousie et rupture possible pour une personne monogame ; acceptation pour une personne polyacceptante ; négociation pour une personne en polyamour hiérarchique ; aucune attente d'exclusivité en anarchie relationnelle. Une réaction est une émotion et un souvenir, pas un dénouement écrit d'avance.
- **Les personnes asexuelles et aromantiques** ne développent pas l'attirance correspondante ; elles peuvent former des liens profonds autrement (C3).
- **Réglage de table** (H1) : simulation romantique désactivée → aucune attirance ne naît, aucune action intime n'est choisie. Les données d'identité restent affichées.

**Critères d'acceptation**
- [ ] Aucune attirance n'apparaît contre une orientation, ni quand la table l'a désactivée (tests).
- [ ] Le test « un filtre, jamais un trait » couvre aussi l'orientation relationnelle : elle ne change rien hors des situations de non-exclusivité.

---

### ☐ V4-E8 — Le pas de simulation · `L` · sans modèle IA — **prêt après E2 à E6 et A3 à A5**

**Modèle conseillé : Opus** — l'orchestration de tout le lot ; quotas.

**Sous-tâches Haiku** : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- `advanceWorld` (A3) enchaîne, pour chaque figure à rattraper : besoins, choix d'action, événement du monde, évaluation par les témoins, souvenirs, transformation. Pur.
- Un service (`src/server/services/simulation.ts`) lit l'état, appelle le noyau, et écrit le résultat **en une transaction**, par lots bornés.
- En mode « proposer » (F1), il n'écrit que des propositions (F3).

**Critères d'acceptation**
- [ ] Même état, même graine, même durée → même résultat (test d'intégration sur un monde factice).
- [ ] Un tour solo ordinaire reste dans le budget de A5.
- [ ] Une erreur au milieu ne laisse aucun état à moitié écrit.

---

### ☐ V4-E9 — Raconter ce que le monde a fait · `M` · **avec modèle IA** — **prêt après E8**

**Modèle conseillé : Opus** — contexte du modèle, audience.

**Sous-tâches Haiku** : vérifications et résumé des échecs.

- Le modèle reçoit des **faits** (« Bram a vendu la taverne pour payer ses dettes ; Aude l'a appris et en est blessée ») et les raconte. Il ne décide de rien (règle 8).
- Seuls les événements que le PJ a vécus, vus ou appris entrent dans un récit lu par le joueur (règle 11, découvertes).
- Une personne présente agit selon son état courant : son émotion et son rêve entrent dans le contexte (B6).

**Critères d'acceptation**
- [ ] Un événement inconnu du PJ n'entre jamais dans un contexte lu par le joueur (test).
- [ ] Vérifié en direct sur une séance : un PNJ revu après une semaine de jeu se comporte selon ce qui lui est arrivé entre-temps.
