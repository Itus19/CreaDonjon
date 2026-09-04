# Backlog V2 — Le monde vivant

**Version :** 1.0 — 2 septembre 2026
**Établi sur :** l'état documenté de la V1. Le dépôt étant privé, les écarts éventuels sont à signaler.
**Documents liés :** `psyche-pnj.md` · `wiki-blocs.md` · `outils-mj.md` · `cible-locale-et-ia.md` · `module-joueur-et-solo.md`

---

## 0. Comment me montrer l'état du projet

Le dépôt est privé, je ne peux plus le lire. Le plus léger :

```bash
git log --oneline -20
```

Vos messages de commit sont assez descriptifs pour que ça suffise dans la plupart des cas. Pour une revue de code, téléversez les fichiers concernés.

---

## 1. Point de contrôle — vérifié sur le dépôt au commit `5f74b9a`

Inspection faite le 2 septembre. Cinq points sur six sont acquis.

| Point | État |
|---|---|
| Pureté de `src/core` | **acquis** — zéro import interdit, règle ESLint effective |
| Confinement du client `service_role` | **acquis** — un seul importateur, règle ESLint, test de fuite |
| Six cas dorés de `characterSheet()` | **acquis** — présents, plus deux cas d'encombrement |
| `AiProvider` + adaptateur local | **acquis** — `openAiCompatible.ts`, prêt pour Ollama et LM Studio |
| `ai_usage_log` à chaque appel | **acquis** — écrit même quand l'appel échoue |
| **Thème dérivé de l'image** | **fait** — voir V2-G4 (reformulé : par joueur, pas par monde) |

### Restent à confirmer par vous (invisibles depuis le dépôt)

- [ ] **Couverture de traduction** par type d'entrée. Les scripts existent ; seul l'état de la base le dira.
- [x] `npm run test:coverage` sur `src/core/rules` et `src/core/visibility` : au-dessus de 90 % ? **Oui** (3 septembre) — `rules` : 95,0 % lignes/93,9 % fonctions/87,2 % branches ; `visibility` : 100 % sur les quatre métriques.
- [ ] La migration `restore_entity_blocks` suivant immédiatement `entity_blocks_full` : incident réglé ou correctif partiel ?

## 2. Principe de séquencement

> **Lever l'incertitude la plus grande d'abord, enrichir ensuite.**

La V1 suivait « le moteur avant l'écran ». La V2 a une contrainte différente : **une grande inconnue pèse sur la V3**, et elle est bon marché à lever maintenant que le moteur et le fournisseur d'IA existent.

D'où l'ordre :

```
S1        spike de viabilité du solo        2 à 4 jours, avant tout
Lot G     finitions et dette de V1
Lot H     le monde vivant                   psyché, généalogie, chronologie, quêtes
Lot I     les cartes
Lot J     génération assistée et confort
```

**H, I et J sont indépendants entre eux.** Vous pouvez les réordonner selon l'envie — c'est même recommandé, la motivation compte (risque R9). S1 et G, eux, viennent d'abord.

---

## S1 — Spike : le mode solo est-il viable sur votre machine ? · `M` — fait

**Ce n'est pas un ticket de fonctionnalité. C'est une expérience, avec un verdict.**

### Pourquoi maintenant

Votre essai avec SillyTavern a été décevant. Mais il testait l'approche que votre architecture remplace : tout empiler dans le prompt et laisser le modèle se souvenir, arbitrer, calculer et écrire simultanément.

Chez vous, le moteur calcule et le modèle reçoit *« boule de feu, trois gobelins touchés, 24 dégâts, deux morts, un baril d'huile dans la zone »* — environ 140 tokens, une seule tâche : raconter.

**Cette thèse n'a jamais été testée.** Elle détermine la forme de toute la V3. Elle coûte quelques jours à vérifier maintenant, contre plusieurs semaines à découvrir trop tard.

### Périmètre — délibérément minuscule

Pas d'interface à trois colonnes. Un écran jetable suffit.

- **Un** lieu préparé, avec sa description.
- **Trois** PNJ avec blocs `personality` et une relation chacun envers le groupe.
- **Un** combat préparé via le générateur de rencontres du lot E.
- Contexte assemblé de façon déterministe : lieu, PNJ présents, personnage du joueur, cinq derniers événements.
- `resolveAction` pour toute mécanique. Le modèle ne calcule rien, ne lance rien.
- Sorties structurées pour les propositions, validées par Zod.

### Ce qu'on mesure — vingt tours minimum

| Mesure | Seuil acceptable |
|---|---|
| Latence par tour | < 15 s, sinon injouable |
| Tokens d'entrée par tour | < 3 000 avec le contexte déterministe |
| Appels d'outils malformés | < 10 % des tours |
| Identifiants inventés | **0** — la validation doit tous les rejeter |
| Cohérence des PNJ sur 20 tours | jugement subjectif, noté honnêtement |
| Qualité de la prose | jugement subjectif, noté honnêtement |

Les deux dernières lignes sont subjectives et c'est assumé. **Notez-les au fil de l'eau, pas à la fin** — le souvenir global est toujours plus indulgent que l'expérience réelle.

### Le verdict, et ses trois issues

C'est le cœur du spike : **aucune issue n'est un échec du projet.**

| Constat | Décision |
|---|---|
| Mécanique solide, prose acceptable | La V3 se construit comme prévu |
| Mécanique solide, **prose faible** | → **repli sur le MJ assisté**, voir ci-dessous |
| Mécanique instable (outils, identifiants) | Changer de modèle avant de conclure ; c'est un symptôme de modèle, pas d'architecture |

### Le repli qui n'en est pas un : le MJ assisté

Si la narration autonome déçoit à la taille de modèle dont vous disposez, la V3 change de forme sans perdre sa valeur.

**MJ IA :** le modèle mène, vous jouez. Exige une bonne prose en continu.
**MJ assisté :** vous menez, le modèle propose. Il suggère une réaction de PNJ, une complication, une description que vous acceptez, modifiez ou ignorez.

Le second demande beaucoup moins au modèle : des propositions courtes, ponctuelles, que vous filtrez. Un modèle de 14 milliards de paramètres y est très correct là où il peine à porter une narration continue.

Et c'est **la même infrastructure** : contexte déterministe, propositions validées, outils du moteur. Seule l'interface change — des suggestions plutôt qu'un flux.

**Cette option devrait probablement exister de toute façon**, y compris si le solo fonctionne : c'est ce qui sert un MJ humain en séance, et c'est cohérent avec le principe 3.1 du PDD — l'IA assiste, elle ne confisque pas le contrôle.

### Critères

- [x] Vingt tours joués, mesures relevées au fil de l'eau.
- [x] Zéro identifiant inventé accepté par la validation.
- [x] Verdict écrit dans un ADR : `docs/adr/0009-viabilite-solo.md`.
- [ ] Si repli : la V3 est réécrite en conséquence **avant** d'ouvrir le lot G — **prochaine étape, pas encore faite** : le verdict recommande le repli (MJ assisté), mais aucune V3 formelle n'existe encore à réécrire (seulement le tableau §4 ci-dessous). À faire avant le lot G.

**Verdict (ADR 0009, 22 août 2026) : repli sur le MJ assisté.** Mesures objectives dans le budget (latence ~10 s, tokens ~1400, 0 identifiant inventé, 5 % d'appels malformés une fois l'incident d'infrastructure retiré) — c'est la cohérence narrative dans la durée qui déçoit à cette taille de modèle (répétitions verbatim, dérive de personnage, PNJ omniprésent hors de sa scène). Point ouvert : le lien fait-mécanique → narration n'a en réalité jamais été observé de bout en bout (panne réseau sur l'unique tentative) — à reboucler avant conclusion définitive. Détail complet et enseignements de conception (suivi de scène, contexte de personnage vivant, voix des PNJ incidents) dans l'ADR.

---

## Lot G — Finitions et dette de V1

*Tout ce qui a été reporté « à plus tard » pendant la V1. Une session, deux au plus.*

### V2-G1 — Reports assumés de la V1 · `M`

- [x] **Montée de niveau accompagnée.** Le bouton « +XP » devient « Monter de niveau » au seuil, et rejoue la partie utile du parcours de création (`wiki-liens-et-personnages.md` §B8).
- [x] **Application des dégâts à une cible** depuis l'écran de combat — la V1 ne permettait que de les subir manuellement.
- [x] **Réorganisation par glisser-déposer** des blocs. Le `display_order` en `numeric` est prêt depuis la Phase 0.
- [x] **Panneaux multiples** : deux fiches côte à côte, via `?avec=[slug]`. Le composant `<Panel>` a été isolé pour ça.
- [x] **Export et import de monde** en JSON. L'export omet le contenu `personal_reference` (`ruleset-personnel.md` §3.2).

**Périmètre étendu sur demande explicite** : l'assistant de création de personnage (§B8) devient un outil partagé par trois points d'entrée, dans cet ordre — 1) outil complet dans l'écran MJ (`/mj/creation-personnage`), 2) bloc distinct sur une entité (édition actuelle de `PlayableCharacterSheet` conservée telle quelle), 3) onglet de montée de niveau sur la fiche jouable, activé au franchissement d'un seuil de PX. Le point 1 est fait et enrichi sur deux passes de retour utilisateur :

- Huit étapes au lieu de sept : espèce (boutons, lignées gérées comme les sous-classes), classe (boutons, niveau et multiclassage complets, sous-classe gatée par niveau), caractéristiques (tableau standard/achat de points/tirage, stats dérivées en direct), historique (boutons, vrai choix d'équipement contre or), équipement, compétences (liste + acquis fixes), **sorts** (budget par classe incantatrice, lu dans `class_progression`), aperçu.
- L'aperçu réutilise les vrais composants de la fiche jouable (en-tête + onglets Actions/Magie/Inventaire/Traits), pas une mini-fiche à part.
- **Bug racine corrigé (deuxième passe)** : `listRuleEntryBlocksByKeys` (l'endpoint batché de l'assistant) ne résolvait jamais les références internes d'un bloc (don d'un historique, traits d'une espèce, options d'une sous-classe) — `blockContentRenderer.tsx` affichait alors "undefined" ou du texte anglais non traduit. Corrigé par une deuxième passe de résolution batchée dans `listRuleEntryBlocksByKeys` (`src/server/services/rules.ts`), miroir de ce que fait déjà `getRuleEntryForWorld` mais sans le N+1.
- Bug de données trouvé au passage : les sous-espèces du SRD 2014 (`Subraces`, ex. Nain des collines) ne portent jamais `parentSpeciesKey` — `speciesParentKey()` ne lisait que la forme 2024 (`source_raw.species`), jamais 2014 (`source_raw.race`). Corrigé dans `src/server/services/rules.ts`.
- Espèce et classe : la fiche de l'élément choisi (espèce/classe) s'affiche désormais **avant** les boutons de lignée/sous-classe, qui ajoutent leur propre fiche en dessous plutôt que de remplacer la première — les deux restent visibles en même temps.
- Caractéristiques : CA (bouclier)/Initiative/Perception passive réutilisent maintenant `StatBadge`/le même bouclier que `CharacterSheetHeader` (jamais une deuxième présentation) ; les jets de sauvegarde sont montés dans l'encadré de chaque caractéristique, sous le modificateur.
- Historique : titre "Don : <nom>" plutôt qu'une paire étiquette/valeur séparée (`Background()`, `blockContentRenderer.tsx`) ; le double affichage de l'équipement (fiche détaillée + résumé texte) est réduit à la fiche détaillée + de simples boutons "Choisir A/B".
- Traductions manquantes ajoutées : `WEAPON_ARMOR_PROFICIENCY_LABELS_FR` (`src/i18n/fr.ts`) pour les maîtrises d'arme/armure par catégorie (ex. "Daggers"), qui n'ont pas de fiche de règle propre (`Proficiencies` est exclue de l'import) ; les langues déjà acquises passent maintenant par `LANGUAGE_LABELS_FR` dans `RemainingChoicesStep.tsx`.
- Sorts : présentation en encadrés dépliables (`SpellCard`, même langage visuel que `ItemCard` de l'onglet Inventaire) plutôt qu'en pastilles — sélection et dépliage de la description sont deux interactions séparées.
- Reste signalé, non corrigé : les résumés de chip (`ai_digest`) sont en anglais et en pieds — généré par `scripts/ingest-srd.ts`, hors périmètre de ce ticket. Idem pour le `\n` isolé au milieu d'une phrase dans au moins une traduction française existante (don "Initié à la magie") — probablement pas un cas isolé, pas encore quantifié.

**Troisième passe de retour utilisateur** :

- **Bug de performance racine corrigé** : `assembleResolvedRuleset` (endpoint `resolved-ruleset`, appelé à chaque changement d'espèce/historique/classe/équipement/sort) refaisait sa propre remontée de chaîne de rulesets pour CHAQUE entrée (espèce, historique, chaque classe), jamais partagée — mesuré à ~1.3s pour un seul personnage simple. Ajout de `fetchEntriesBatch` (même lot que `listRuleEntryBlocksByKeys`) : un seul parcours de chaîne pour tout le lot. Les 4 fonctions `resolveEquipment*` (armure/arme/poids/coût) refaisaient aussi chacune `fetchEquipmentBlocks` sur les mêmes clés — fusionnées en `resolveEquipmentData`, une seule résolution par objet, en parallèle. Résultat mesuré : ~600ms (encore perceptible, mais divisé par plus de deux) — le reste vient du nombre de allers-retours réseau vers Supabase local, pas d'un travail redondant restant.
- Sorts : regroupés par niveau (Sorts mineurs, puis Niveau 1, Niveau 2...) plutôt qu'un seul bloc plat ; bug réel corrigé au passage — un lanceur "préparant" (Magicien, Clerc, Druide...) n'a jamais de nombre de sorts tabulé par niveau dans le SRD (ça dépend du modificateur de caractéristique), `computeBudget` ne proposait donc jamais de sorts de niveau 1+ pour ces classes, seulement les sorts mineurs. Repli sur la formule officielle (modificateur + niveau, minimum 1). `SpellCard` reprend maintenant le chrome exact de `ItemCard` (bandeau de pliage + bande verticale de sélection).
- **Équipement de départ des classes (point 9 comblé)** : nouveau bloc de règle `class_equipment` (`fixed` + `choices[]`, réutilise les types `BackgroundEquipmentItem/Option` — un choix de classe n'est qu'un choix d'historique avec plusieurs choix indépendants). Ingestion étendue (`scripts/ingest-srd.ts`), ré-exécutée contre la base locale (idempotente, additive — voir `app.import_srd_entries`). Piège réel rencontré : la ré-ingestion retire les fiches qui ne viennent pas du SRD JSON, dont `encounter-budget` (écrite à part par `scripts/write-encounter-budget-2024.ts`) — **toujours relancer ce script après une ré-ingestion**. Seule la première classe du personnage accorde de l'équipement (comme en jeu — le multiclassage n'en redonne jamais) ; objets fixes appliqués automatiquement, chaque choix indépendant via des boutons "Choisir A/B" dans `LevelClassesStep.tsx`.
- Signalé, pas résolu : un clic très rapproché entre deux boutons de choix (beaucoup plus rapide qu'un humain) a fait planter le rendu une fois pendant les tests et revenir au tableau de bord — non reproduit avec un rythme de clic normal malgré plusieurs essais ; à surveiller si ça revient en usage réel.

**Quatrième passe de retour utilisateur** :

- **Deuxième bug de performance racine corrigé** : `/api/worlds/[worldSlug]/rule-entries` (la liste complète des règles d'un monde, chargée par chaque étape du wizard via `useWorldRuleEntries`) prenait ~4.2s sous le SRD 2024 (1905 entrées) — `listRulesetEntries`/`listRulesetEntriesByKeys`/`listTranslationsForEntries`/`listEntryTranslationsWithBlocks`/`listBlocksForRulesetEntries` (`src/server/repos/rules.ts`) paginaient/lotaient toutes en boucle SEQUENTIELLE (un lot attend le precedent), jusqu'à dix allers-retours d'affilée pour les traductions seules. Toutes batchées en parallèle via un nouveau `fetchBatched` partagé. Résultat mesuré : ~1.4-1.8s (environ 2.5x plus rapide) — le reste est du temps de transfert reseau reel (1905 lignes), pas du travail redondant.
- Langues manquantes sous le SRD 2024 (point 3) : corrigé. Le SRD 5.2.1 ne rattache plus aucune langue à l'espèce ni à l'historique (contrairement à 2014) — la règle générale du personnage s'applique alors ("Choisissez vos langues", data/srd/fr-source/srd-5.2.1-fr.txt : "Le commun, plus deux langues déterminées au hasard ou choisies"), codée en repli explicite dans `assembleResolvedRuleset` quand aucune langue n'a été trouvée ailleurs. Le Commun est acquis d'office, jamais proposé une deuxième fois dans le choix des 2 langues libres.
- Historiques manquants sous le SRD 2024 (point 2) : non reproduit sous le ruleset **officiel** `SRD 5.2.1 (2024)` — les 4 historiques du SRD (Acolyte, Criminel, Sage, Soldat, la totalité de ce que la licence libre republie) y sont bien présents et traduits. Le monde de test avait pour ruleset actif une variante ("Guide du MJ maison", parentée sur le SRD 2014 — qui ne republie qu'Acolyte), pas l'officiel 2024 : la variante n'hérite jamais des historiques 2024. Ces rulesets variantes/personal_reference préexistent (fonctionnalité V1-D4/V1-D5, pas créée pendant cette passe).
- Espèces en double à l'écran + retour inopiné au tableau de bord (point 1) : les données elles-mêmes ne portent aucun doublon (vérifié par requête directe, plusieurs fois) — un onglet de navigateur neuf ne reproduit ni les espèces en double ni aucune erreur console, alors qu'un onglet réutilisé depuis le début de la session (des dizaines de rechargements à chaud pendant l'édition) en accumule. Piste retenue : artefact du rechargement à chaud (HMR) du serveur de développement pendant une édition de code active, pas un bug du code livré — non reproduit sur un chargement propre malgré plusieurs tentatives. Reste à surveiller si ça se produit en dehors d'une session d'édition active.

Points 2 et 3 restent à faire ; le pré-remplissage par IA (§B8 « en surcouche ») est délibérément reporté au lot J.

**Cinquième passe de retour utilisateur** :

- Boutons d'historique enrichis (don lié, valeurs de caractéristique, maîtrise d'outil, maîtrises de compétence), même motif que les boutons d'espèce (`BackgroundStep.tsx`).
- Étape « Sorts » masquée (jamais un onglet adaptatif) pour toute classe sans progression d'incantation dans le ruleset actif — `CharacterCreatorWizard.tsx`, présence du bloc `spellcasting_progression`.
- **Maîtrise d'armes** (SRD 2024 — Barbare, Guerrier, Paladin, Rôdeur, Roublard) : choix en étape 6, résolu côté serveur (`assembleResolvedRuleset`) au même titre que compétences/langues. Les armes éligibles se lisent dans les vraies maîtrises d'armes de la classe (jamais une liste recopiée à la main). **Plus aucune règle codée en dur côté serveur** (retour utilisateur explicite, deux passes) : le nombre par classe (colonne `class_specific_weapon_mastery`) et la restriction « corps à corps seulement » du Barbare (`class_specific_weapon_mastery_melee_only` — un fait sur sa capacité, jamais sur l'arme elle-même, que `is_ranged` par arme ne suffit pas à exprimer) sont tous deux lus dans `class_progression`, cinq classes par le même chemin. Les deux valeurs sont injectées à l'import (`scripts/ingest-srd.ts`, `classProgressionBlock`), strictement gardées à `sourceAttribution === "SRD 5.2.1"` — la maîtrise d'armes n'existe pas sous 2014, même `classIndex`. Un booléen dans une table de progression s'affiche désormais « Oui »/« Non » (`cellValue`, `blockContentRenderer.tsx`), jamais « true »/« false ». Onglet dédié sur la fiche jouable, remis à zéro à chaque repos long (`characterActions.ts`, `takeLongRest`), avec un badge « Botte disponible » sur une arme équipée actuellement maîtrisée — l'effet de la botte reste à résoudre à la main (hors périmètre : modéliser les huit propriétés de maîtrise comme de vraies mécaniques de combat est un chantier à part).
- Régression de performance détectée et corrigée en cours de route : le catalogue d'armes se chargeait même pour une classe qui n'accorde pas la maîtrise dans le ruleset actif (ex. Guerrier sous 2014) — repéré par un test d'intégration qui a commencé à expirer.

**Montée de niveau accompagnée (point 1 du ticket)** : nouvel assistant séparé `LevelUpWizard.tsx`, pas un troisième mode de `CharacterCreatorWizard` — la sauvegarde chirurgicale (aucun renommage, aucun contact avec l'inventaire) l'exigeait de toute façon. Réutilise sans modification `LevelClassesStep`/`RemainingChoicesStep`/`SpellSelectionStep` (déjà écrits en « budget total moins déjà choisi », donc naturellement delta-aware au changement de niveau). Amélioration de caractéristique (ASI) incluse dans le périmètre, sur décision explicite : `src/core/rules/abilityScoreImprovement.ts` (choix +2/une ou +1/deux, plafond 20) monte comme modificateur couche 5, exactement le mécanisme déjà en place pour les bonus d'espèce (couche 2) — `sheet.ts` n'a nécessité aucun changement. Les niveaux qui accordent une ASI ne sont jamais codés en dur : lus dans `progressionRows` (`extractAsiGrantedLevels`, `srdMapping.ts`), exposés par `assembleResolvedRuleset` (`asiGrantedLevels`). Sauvegarde via une nouvelle action serveur `applyLevelUp` (`characterActions.ts` + `app/api/entities/[id]/actions/level-up/`), qui recalcule la fiche CANDIDATE côté serveur pour vérifier le plafond de 20 et la légitimité de chaque choix d'ASI, jamais la fiche envoyée par le client. Trou de données documenté et accepté : sous le SRD 2014, la fusion de textes identiques à l'import confond les ASI supplémentaires du Guerrier et du Roublard (propres à leur classe) avec des clés sans marqueur — fonctionne correctement sous le SRD 2024 (ruleset actif de Valdoria).

Deux bugs réels trouvés en testant la soumission dans le navigateur, tous deux corrigés :

- **Comparaison espèce/historique invalide** : `applyLevelUp` comparait `species`/`background` (avant/après) par `JSON.stringify`, qui casse après un aller-retour par une colonne `jsonb` — Postgres ne garantit pas l'ordre des clés d'un objet. Toute montée de niveau était rejetée à tort (« ne peut pas changer l'espèce... ») dès que l'ordre des clés différait par hasard. Remplacé par une comparaison structurelle (`sameBlockReference`).
- **ASI invisible aux calculs serveur** : `resolveCharacterActionContext` — utilisé par les jets d'attaque, de dégâts, de sort, et par la route `/sheet` — ne construisait jamais les features synthétiques d'ASI, contrairement à `applyLevelUp`. Un bonus d'ASI déjà appliqué et enregistré ne comptait donc dans AUCUN jet de dé réel, en contradiction directe avec la règle 6 de `CLAUDE.md` (« l'IA narre, le code arbitre »). Extrait en fonction partagée `buildAsiChoiceFeatures`, appelée maintenant aux deux endroits.

**Retour utilisateur après livraison** : deux points corrigés/ajoutés.

- **Bug d'affichage** : l'assistant s'ouvrait sur un écran « niveau 12 → 12 » (le niveau n'était pas pré-incrémenté), obligeant à corriger le chiffre soi-même avant de pouvoir continuer. `LevelUpWizard` applique maintenant +1 sur la première classe dès l'ouverture — l'étape Classe reste l'endroit pour rediriger ce niveau vers une autre classe (multiclassage) si besoin.
- **Jet de dé de vie réel (absent jusqu'ici)** : `computeHitPoints` (`sheet.ts`) prenait systématiquement la moyenne pour tout niveau après le premier — décision documentée dès la V1 (`BACKLOG_V1.md` V1-B1), mais le champ `hp_method` (« Valeur fixe »/« Jetés ») affiché sur la fiche n'a jamais été branché à quoi que ce soit. Corrigé en ajoutant une vraie mémoire de jet : `ClassLevel.hpRolls`/`character.classes[].hp_rolls`, un historique de PV gagnés niveau par niveau, jamais recalculé (un jet est un fait, pas une valeur dérivable) — absent ou plus court que prévu = personnage antérieur à cette fonctionnalité, `computeHitPoints` comble alors avec la moyenne, aucun changement pour l'existant. Nouvelle étape « Points de vie » dans `LevelUpWizard` (composant `HpRollStep.tsx`) : un choix moyenne/jet par niveau nouvellement gagné, par classe — jamais un choix global. Le client ne transmet qu'une INTENTION (`hpChoices`, moyenne ou jet) ; `applyLevelUp` exécute le jet lui-même via `serverRng` (régle 6) et rejette (`invalid_hp_choice`) tout choix manquant ou dont le compte ne correspond pas exactement aux niveaux gagnés. L'aperçu affiche une estimation (« ≈ ») tant qu'un jet est en attente, la vraie valeur n'existant qu'après confirmation.

**Application des dégâts à une cible (point 2 du ticket)** : `InitiativeTracker.tsx` gagne un contrôle unique « Appliquer des dégâts » (montant tapé + participant choisi dans une liste), plutôt qu'un jet automatisé par arme — les participants `custom` (piège) et `statblock` (monstre) n'ont pas forcément d'arme ni de fiche de personnage à interroger, ce contrôle fonctionne identiquement pour les trois `source_kind`. Les PV temporaires absorbent en premier (règle 5e), le reste retombe sur les PV réels sans jamais descendre sous 0 ; réutilise `patchCombatParticipant` (déjà en place pour le stepper PV manuel), donc le bouton « Annuler » de l'écran existant défait aussi cette action sans code supplémentaire. Corrigé au passage : le stepper PV de chaque ligne avait été oublié lors du remplacement des anciens ronds +/- par la case à bandes pleine largeur (retour utilisateur antérieur) — même composant partagé `Stepper.tsx` que partout ailleurs désormais.

**Réorganisation par glisser-déposer (point 3 du ticket)** : `@dnd-kit/core`+`sortable`+`utilities` (MIT, ~15 ko gzip à eux trois, aucune dépendance transitive) — décision explicite face au HTML5 natif, qui n'aurait couvert ni le clavier ni le tactile. `EntityBlocks.tsx` enveloppe la liste dans `DndContext`/`SortableContext` ; chaque carte de bloc est extraite dans `SortableBlockCard` (le hook `useSortable` doit s'appeler une fois par instance de composant, jamais une fois par itération d'une boucle `.map()` dans le parent — règle des hooks). Le calcul du nouveau `display_order` au dépôt (`computeDroppedDisplayOrder`) généralise l'écart déjà utilisé par Monter/Descendre (`(voisin + voisin) / 2`, jamais une renumérotation de toute la liste) à une position d'arrivée arbitraire ; les deux chemins convergent vers la même route serveur (`PATCH /api/blocks/[id]/order`, même vérification de version), donc aucun changement côté serveur. Les boutons Monter/Descendre restent en place (accessibilité, secours). Bug réel trouvé et corrigé au passage : `DndContext` sans `id` fixe produisait un `aria-describedby` divergent entre le rendu serveur et l'hydratation client (compteur interne de dnd-kit) — corrigé avec un `id` dérivé de `entityId`, déjà stable. Limite assumée : l'environnement de test automatisé de cette session ne simule pas correctement les événements pointeur/clavier de dnd-kit (propriétés `key`/`code` vides sur les évènements synthétisés) — le geste de glisser-déposer lui-même n'a donc pas pu être vérifié en direct par l'assistant ; le code suit le patron officiel de la bibliothèque et les boutons Monter/Descendre (qui empruntent le même chemin serveur) fonctionnent, mais un essai manuel reste à faire.

**Export et import de monde (point 5 du ticket, après la prépa "un monde = une campagne")** : format JSON propre (`src/core/schemas/worldExport.ts`), servi par trois routes (`GET /api/worlds/[slug]/export`, `POST /api/worlds/import`, `POST /api/worlds/[slug]/duplicate` — dupliquer est un export+import serveur-a-serveur, sans passer par un fichier), réservées au propriétaire du monde. Périmètre volontairement limité au **lore** : entités, blocs, relations, révisions mécaniques, et le ruleset actif du monde — jamais l'état de partie (sessions, membres de campagne, PJ assignés, état d'execution) ni les images/assets, qui restent hors de ce format v1. Import = toujours un monde neuf avec sa campagne fraîche (mode choisi par la personne qui importe, jamais imposé par le fichier), jamais une écriture dans un monde existant.

Trois bugs réels trouvés en testant contre la vraie base (pas seulement en tests unitaires), tous corrigés :
- **Le slug d'une entité est un numéro séquentiel par monde** (`nextNumericSlug`, V0-06g), jamais dérivé du nom — le réutiliser tel quel à l'import entrait en collision avec la propre séquence du nouveau monde (sa première entité, créée par `createCampaign` avant la boucle d'import, occupe déjà le numéro 1). Corrigé en réutilisant `createEntity` (qui génère toujours un numéro frais) plutôt qu'un insert direct, et en retirant `slug` du format d'export — il n'a jamais de sens hors de son monde d'origine.
- **`blocks.version`** (concurrence optimiste) confondu au départ avec `schema_version` (qui, lui, existe sur `ruleset_entry_blocks`, une tout autre table) — retiré du format d'export, une ligne fraîchement importée n'a encore été éditée par personne.
- **`entities.name` peut être vide** en pratique (aucune contrainte `CHECK` ne l'interdit) — le schéma d'export exigeait `min(1)` à tort, rejetant l'export d'un monde réel qui contient une telle fiche.

**Ruleset personnel jamais exporté, vérifié en conditions réelles** (`specs/ruleset-personnel.md` §3.2, pas seulement en theorie) : un monde de test avec une variante `personal_reference` portant une entrée maison a été exporté, le JSON produit inspecté au mot près (`fetch(...).then(r=>r.text())`) pour confirmer l'absence totale du contenu — seul `{kind:"personal_omitted", name, baseSystem, note}` survit, avec un avertissement explicite affiché avant tout téléchargement. Une variante `user_created` (non verrouillée) a elle aussi été exportée puis réimportée en conditions réelles : ruleset et surcharge (`patch_block` sur `fireball`) reconstruits à l'identique sous un nouvel id.

Visibilité `campaign`/`user` : ramenée à `gm` à l'export (leur `scopeId` — un id de campagne ou d'utilisateur — ne survit à aucun transfert de compte), avec un avertissement compté et affiché avant le téléchargement. Une référence d'entité embarquée *dans* le JSON d'un bloc (ex. un objet d'inventaire qui pointe vers une autre entité) est réécrite par un parcours structurel générique (`remapEntityIds`, `src/core/linker/`) plutôt qu'une logique par type de bloc.

Connu et accepté, pas un bug : dupliquer un monde recrée en double son entité-faction "Groupe — X" (l'originale, exportée comme une entité wiki ordinaire parmi d'autres, et la fraîche, créée par `createCampaign` pour la nouvelle campagne) — l'ancienne devient une fiche wiki orpheline, plus rattachée à aucune campagne. Corriger ça demanderait d'exporter aussi `campaigns.party_entity_id` pour le traiter à part ; pas fait pour un premier jet, le coût dépasse la gêne (une fiche en trop, jamais une perte de donnée).

**Correction apres coup — ruleset non propage a la campagne** : signale par l'utilisateur ("l'ecran d'accueil indique 2014 alors que ce sont les regles de 2024 qui courent"). Cause reelle : `setActiveRuleset` (le selecteur de ruleset des Reglages) ne mettait a jour que `worlds.default_ruleset_id`, jamais `campaigns.ruleset_id` — un heritage d'avant "un monde = une campagne", ou le verrou protegeait les AUTRES campagnes d'un meme monde d'un changement retroactif involontaire (toujours vrai pour l'edition du CONTENU d'un ruleset publie, SCHEMA.md §9.5, non touche ici). Ce risque n'existe plus a une seule campagne par monde : `setActiveRuleset` propage desormais le changement a la campagne unique du monde (`updateCampaignRuleset`, `src/server/repos/campaigns.ts`). Verifie en direct sur le vrai monde Valdoria de l'utilisateur (ruleset de la campagne divergent constate en base, corrige, ecran d'accueil revenu coherent). Verification demandee explicitement pour un NOUVEAU PJ : `resolveCharacterActionContext` (`characterActions.ts`) resout `campaign?.ruleset_id ?? getWorldDefaultRulesetId(...)` — une fonction du seul (campagneId, mondeId), jamais du personnage ni de sa date de creation. Le meme correctif couvre donc tout PJ, present ou futur, sans code supplementaire ; le createur de personnage (`useWorldRuleEntries`) lisait deja `worlds.default_ruleset_id`, jamais affecte par ce bug.

**Une ligne par PJ sur la carte de monde** (retour utilisateur) : nom, espece et classe(s)/niveau, plutot qu'une simple liste de noms separes par des virgules — reutilise `listWorldPlayerCharacters` (`src/server/services/worldPlayerCharacters.ts`), deja la source de la page d'accueil d'un monde, aucune seconde resolution de regles ecrite pour l'ecran d'accueil. `WorldCard.players` (repo) part vide ; c'est `listWorldCards` (service, desormais parametre par la locale) qui l'enrichit, un appel par monde (N+1 assume, meme convention que `listMyGmCampaignsWithMembers`).

**Panneaux multiples (point 4 du ticket) : déjà fait, par un autre chemin que celui décrit.** Le texte du ticket décrit le plan d'origine (des `<Panel>` fixes côte à côte) — mais `ADR-0006` (docs/adr/0006-fenetres-flottantes.md) avait déjà devancé et remplacé ce plan **avant même que ce ticket soit écrit** : `?avec=` est une liste de références (`entite:slug`/`regle:slug`, `components/shell/windowRefs.ts`) qui ouvre chaque fiche dans sa propre fenêtre flottante (`WindowFrame`/`DesktopWindowsProvider`), pas dans un `<Panel>`. Plusieurs fiches sont donc déjà visibles en même temps aujourd'hui — vérifié en direct (`/m/valdoria?avec=entite:7,entite:1`, deux fenêtres empilées à l'écran) — livré dès la V0 (V0-06c) et étendu en V2-K1 (adressage mixte entité/règle). `<Panel>` lui-même ne sert plus qu'à l'affichage mobile et au fond vide du bureau avant ouverture d'une fiche ; son commentaire, qui prétendait le contraire, est corrigé.

### V2-G4 — Thème dérivé de l'image · `M` · *issu de la revue de code* — fait, reformulé

Le socle est là — `tokens.css` en OKLCH, `data-mode` sur `<html>`, les quatre modes. **Il manque toute la chaîne d'extraction.**

- [x] Téléversement d'une image de fond — **par joueur, pas par monde** (reformulation explicite du client : le fond doit rester un réglage personnel, changeable à sa guise, indépendant de la partie ouverte — voir "Ce qui a changé" ci-dessous).
- [x] Extraction de palette **côté serveur, au téléversement** — jamais dans le navigateur au chargement (`src/server/backgroundImageProcessing.ts`, `sharp`).
- [x] Vignette nette (pas floutée, retour utilisateur ultérieur) en base64 pour la grille de sélection — **stockée dans une table dédiée `background_images` (personnelle, pas dans `worlds.theme` qui n'existe pas)**, plus une seconde image pour le fond réel, à l'aspect préservé, servie par sa propre route (jamais l'image d'origine telle quelle, jamais plus de 1920px).
- [x] Contrôle de contraste sur les quatre modes (`availableModesFor`, `src/core/theme/oklch.ts`) ; un mode qui échoue n'est pas proposé (désactivé, info-bulle), et on le dit — en pratique n'échoue quasiment jamais avec les jetons actuels, la teinte/chroma ne pilotant jamais la clarté des surfaces (voir le code).
- [x] Variables injectées dans le HTML rendu côté serveur (`app/layout.tsx`, cookie lu avant le premier rendu) — aucun scintillement au premier rendu.

Spécification : `coquille-et-design.md` §2b (le choix "par monde" de la spec a été explicitement écarté par le client — voir ci-dessous).

**Ce qui a changé par rapport à la spec d'origine, sur demande explicite du client** : le fond n'est pas un réglage du monde mais du joueur, réglable depuis Réglages → Général indépendamment de toute partie ouverte. Bibliothèque strictement **personnelle** (jamais partagée entre comptes) plus les images déjà fournies avec l'application (`public/backgrounds/`, toujours proposées, non supprimables). La palette dérivée s'applique **en plus** des quatre modes existants, jamais à leur place — confirmé explicitement par le client après une clarification, à l'encontre de la lecture initiale ("teinte indépendante du mode").

**Deux compléments demandés après la première livraison** :
- Un curseur de flou du fond (0–40px), pour ne pas imposer un flou fixe — variable CSS dédiée `--bg-blur`, volontairement distincte de `--blur` (le flou "verre dépoli" des fenêtres/panneaux, `WindowFrame.tsx`/`Panel.tsx`) : les deux se valaient 20px par coïncidence, jamais la même intention.
- Miniatures nettes dans la grille de sélection (pas floutées à la source) — pour que la personne voie ce qu'elle choisit.

**Deux bugs réels trouvés et corrigés en testant contre la vraie base, pas en théorie** :
- Une miniature 64×64 suffisait pour l'icône de la grille mais devenait visiblement pixelisée une fois étirée plein écran dès que le flou baisse (et son recadrage carré centrait mal l'image sur un écran rectangulaire) — corrigé en générant une seconde image dédiée au fond, à l'aspect d'origine préservé, plafonnée à 1920px, stockée en `bytea` et servie par sa propre route (jamais embarquée dans le HTML, à la différence de la miniature).
- `url(...)` CSS sans guillemets s'arrête à la première parenthèse rencontrée — les noms de fichiers fournis contenant des parenthèses littérales ("Artwork_B (1).png") cassaient silencieusement le chargement de trois images sur neuf. Corrigé en entourant systématiquement les URL injectées de guillemets (`url("...")`).

Vérifié en direct à chaque étape (téléversement, sélection en direct sans rechargement, suppression avec repli propre, absence de scintillement au rechargement, les neuf images fournies, un second compte qui ne voit jamais les images de l'autre). `typecheck`/`lint`/`test` verts (638 tests).

### V2-G5 — Découper `PlayableCharacterSheet.tsx` · `M` · *issu de la revue de code* — fait

1255 lignes pour six fonctions de premier niveau. C'est la principale dette du dépôt, et **V2-G1 va y toucher** (montée de niveau, application des dégâts).

- [x] Un composant par onglet : `ActionsTab`, `MagicTab`, `InventoryTab`, `TraitsTab`.
- [x] L'en-tête (identité, PV, XP, repos) extrait à part.
- [x] Aucun changement de comportement : découpage pur, vérifié par les tests existants.

**À faire avant G1, pas pendant.** Découper et modifier dans le même commit rend la relecture impossible.

Fait. `PlayableCharacterSheet.tsx` reste l'orchestrateur (état, appels serveur) ; les quatre onglets et l'en-tête sont des composants purs recevant des props déjà prêtes à afficher. Aucun test automatisé ne couvrait ce composant avant (aucun fichier `*.test.tsx` ne le référence) — vérification manuelle en navigateur sur les trois onglets (actions, inventaire, traits), `typecheck`/`lint`/`test` verts (seul échec : le flake connu de l'intégration LM Studio, pré-existant, sans rapport).

### V2-G6 — `characterSheet()` côté client · `S` · *issu de la revue de code* — déjà satisfait, aucun travail nécessaire

`characterSheet()` n'est appelée que côté serveur. La fonction étant pure et sans dépendance, elle peut tourner dans le navigateur — c'était l'intérêt de la contrainte `src/core`.

- [x] Décocher « équipé » recalcule la CA **sans aller-retour serveur**.
- [x] Le serveur reste l'autorité pour tout ce qui engage la partie ; le client ne recalcule que l'affichage.
- [x] Même fonction des deux côtés — aucune divergence possible.

À faire seulement si la latence actuelle gêne réellement. Mesurez avant.

**Mesuré : la latence n'existe déjà pas.** Le ticket demandait de mesurer avant d'agir — la mesure montre que l'architecture actuelle satisfait déjà les trois critères, sans code à écrire :
- `useCharacterSheetContext.ts` (`"use client"`) appelle déjà `characterSheet()` directement dans le navigateur, pour calculer `sheet` (CA incluse) à partir de `inventory` — la même fonction que celle utilisée côté serveur (`resolveCharacterActionContext`, `characterActions.ts`), aucune seconde implémentation.
- Cocher/décocher « équipé » (`InventoryPanel.tsx`) appelle `onUpdateInventory` → `patchBlock` (`EntityBlocks.tsx`) : une simple mise à jour d'état React **synchrone**, jamais un `await` sur le réseau. La persistance réelle (`saveBlock`, PATCH `/api/blocks/[id]`) est chaînée en arrière-plan, sans jamais bloquer le rendu.
- Les actions qui engagent réellement la partie (attaque, dégâts, sort, repos...) passent toutes par `postAction`/les routes serveur dédiées (`characterActions.ts`) — seul l'**affichage** (CA, modificateurs) est recalculé côté client, jamais un jet de dé ni une mutation de règle.

Vérifié en direct sur la vraie fiche de Jean-Pascal (Valdoria) : équiper/déséquiper une arme met à jour le bouton instantanément (aucune requête réseau dans le chemin critique), la persistance en base est confirmée après coup par lecture directe, l'objet remis dans son état d'origine après le test.

### V2-G2 — Wiki public en présentation « livre » · `M` — fait, étendu

Seconde peau de la coquille, pas une refonte. Mêmes composants, jetons différents.

- [x] Colonne de gauche en sommaire hiérarchique plutôt qu'en arborescence d'édition.
- [x] Corps de texte à largeur mesurée, **65 à 75 caractères par ligne**.
- [x] Aucune commande d'édition visible.
- [x] Le thème dérivé de l'image s'applique aussi à cette peau.

**Ce qui existait déjà et n'a pas été reconstruit** : le mécanisme de publication lui-même (`share_links`, `app/partage/[token]/**`, `src/server/services/publicShare.ts`) était déjà complet — jeton révocable, mot de passe optionnel, filtrage par visibilité identique au reste de l'app. Il ne portait aucun habillage. `components/shell/EntityTree.tsx` (+ `buildEntityTree`, `src/core/entity-tree/build-tree.ts`) était déjà exactement le sommaire hiérarchique demandé par le premier critère — son seul couplage à l'édition (`useOpenEntityLink`, qui ouvre une fenêtre flottante) a reçu un paramètre optionnel `hrefBase` : fourni, navigation normale sans interception ; absent, comportement d'édition inchangé. Le thème dérivé de l'image (V2-G4) s'appliquait déjà de lui-même : `resolveBackgroundSelection` retombe sur le fond par défaut sans jamais toucher Supabase quand aucun cookie `background` n'existe — rien à coder, seulement vérifié en navigateur.

**Extension demandée après coup : un onglet Publication + une prévisualisation.** L'utilisateur a demandé, en plus des 4 critères, une adresse facile à trouver pour que les joueurs consultent le wiki, et un moyen de voir le rendu sans generer un lien. Réalisé :
- `components/entities/public/BookSkin.tsx` (nouveau) : sommaire (`EntityTree` + `hrefBase`) + colonne de contenu `max-w-[70ch]`, réutilisé tel quel par `/partage/[token]/**` et par la nouvelle prévisualisation ci-dessous — un seul skin, deux routes fines, comme le demandait le ticket.
- `src/server/services/publicShare.ts` : nouvelle `getPublicEntityTree(worldId)`, même schéma que `getEntityTree` (édition) mais via le client `service_role` déjà confiné à ce fichier.
- **Prévisualisation = route authentifiée, pas un lien jetable** : `GET /m/[worldSlug]/apercu` et `/apercu/[entitySlug]` (nouveaux), gardés par le même `getWorldBySlug` (RLS) que le reste du monde édité, appelant directement les fonctions de `publicShare.ts` avec le `worldId` — jamais de jeton ni de mot de passe. Montre exactement la vue anonyme (`public_only`), sans « dépenser » de vrai lien et même quand aucun lien n'existe encore.
- `components/shell/SettingsMenu.tsx` : nouvel onglet « Publication » (gardé par `worldSlug`, même motif que « Règles ») — y déplace `ShareLinkPanel` (retiré de l'onglet « Général ») et ajoute le lien « Prévisualiser ↗ » vers `/apercu`.

**Vérifié en navigateur** : `/m/valdoria/apercu` (sommaire complet, navigation entre fiches, surbrillance de la fiche courante, contenu de Jean-Pascal correctement filtré) puis un vrai lien créé depuis le nouvel onglet Publication et ouvert dans un onglet séparé (`/partage/[token]`) — rendu identique, aucune chrome d'édition. Lien de test révoqué après vérification.

**Hors périmètre, explicitement** : pas d'image d'en-tête façon capture d'écran de référence (`entity_assets.role='banner'` existe en schéma mais n'a jamais été câblé — un chantier à part) ; pas de prévisualisation « en tant que joueur d'une campagne » (seule la vue anonyme `public_only`) ; pas de fond d'écran propre au monde (contredirait la décision déjà prise en V2-G4, par joueur jamais par monde). Aussi noté au passage, préexistant et non traité ici : `PublicBlockView` ne rend que text/infobox/image/custom_table — un bloc `character`/`inventory`/`music`/etc. n'affiche que son titre publiquement, aucun contenu.

**Trois retouches supplémentaires, après un premier retour utilisateur sur la peau :**
- **Champ de recherche** dans le sommaire, entre le titre et la première catégorie — filtre local (`filterEntityTree`, `src/core/entity-tree/build-tree.ts`, testé) sur l'arborescence déjà chargée, pas de nouvel appel serveur pour une poignée d'entités. Un nœud correspondant garde tous ses enfants visibles ; un parent non-correspondant survit si un descendant correspond.
- **Nom de la campagne à la place du nom du monde**, partout dans la peau « livre » (« un monde = une campagne », migration `20260826100001`) — et affiché *en plus* du nom du monde dans la barre supérieure de l'écran MJ uniquement (`AppShell.tsx`, détection de section par `usePathname`).
- **Message d'accueil personnalisable** (nouvelle colonne `worlds.wiki_welcome_message`, migration `20260826170001`) : remplace, sur la page d'accueil du **vrai** lien de partage seulement (pas la prévisualisation, sur demande explicite), le gros titre par un message éditable depuis l'onglet Publication — vide, un message par défaut est calculé (« Bienvenue dans la campagne — {campagne} ! L'aventure commence ici ! »), jamais stocké tant que non personnalisé. Le texte « Lecture seule — lien de partage » a été retiré de cette même page.
- **Espacement du sommaire** : le titre butait contre le bouton Réglages (`fixed left-4 top-2.5`, hors du flux du document) sur `/partage`, qui n'a pas d'en-tête d'application au-dessus. `pt-16` sur la colonne de gauche au lieu de `py-10`, dégageant le bouton.

Vérifié en navigateur pour les quatre : recherche filtrant en direct, nom de campagne affiché aux deux endroits attendus (et seulement là), message par défaut puis personnalisé puis effacé (repli confirmé), `/apercu` inchangée comme demandé. Lien de partage et personnalisation de test nettoyés après vérification.

**Lien de partage perdu trop facilement, trois retours successifs.** Premier retour : le jeton en clair (visible une seule fois, jamais stocké en base à l'origine) n'avait pas de bouton Copier, seule une sélection manuelle du champ. Ajouté : bouton « Copier » (`navigator.clipboard`) juste à côté du champ, à la création. Second retour (capture à l'appui, un lien déjà dans la liste « Créé le… ») : demande d'un bouton Copier sur un lien déjà créé — à l'époque impossible par construction (le jeton n'existait plus nulle part après le premier affichage), corrigé provisoirement en le mémorisant en `sessionStorage` le temps de la session du navigateur.

**Troisième retour : décision explicite de revenir sur la règle elle-même.** L'utilisateur a jugé que « jamais stocké » n'avait pas lieu d'être pour un lien qui n'ouvre qu'une vue en lecture seule, sans capacité de modification — pas le même profil de risque qu'un mot de passe ou une clé d'API. Le raisonnement tient : la règle protégeait contre une fuite de la base de données (un jeton haché y reste inutilisable même en cas de fuite), pas contre le compte du monde lui-même (qui donne de toute façon un accès en édition bien supérieur à un simple lien de lecture). Réalisé : nouvelle colonne `share_links.token` (migration `20260826180001`), le jeton en clair est désormais conservé en base en plus de `token_hash` (inchangé, toujours utilisé pour la résolution). `ShareLinkSummary`/`listShareLinks` l'exposent désormais, chaque ligne « Créé le… » porte son propre bouton Copier — le contournement `sessionStorage` du retour précédent est devenu inutile et a été retiré. Les liens créés avant cette migration n'ont jamais eu leur jeton conservé : `token` y reste `null`, pas de bouton Copier pour ceux-là (aucun moyen de le reconstituer). Vérifié en navigateur : nouveau lien créé, jeton visible et copiable immédiatement puis retrouvé et copiable à nouveau depuis la liste après fermeture/réouverture des Réglages.

### V2-G3 — Bloc musique · `S` — fait

- [x] Bloc `music` : un lien Spotify, SoundCloud ou YouTube, avec lecteur.
- [x] **Le lecteur ne se charge qu'au clic.** Une intégration tierce chargée automatiquement dépose des traceurs sur toute fiche qui en contient une.
- [x] URL validée contre une liste de domaines autorisés — sinon c'est un vecteur d'injection.

**Question posée en cours de route : la « radio » de vvd.world.** Avant d'implémenter, la demande initiale évoquait une inspiration : la radio de vvd.world propose plusieurs « stations » dont certaines nommées d'après des franchises (Final Fantasy, The Witcher…). La fonctionnalité est cachée derrière leur connexion — impossible à inspecter davantage. Deux lectures possibles étaient en jeu : héberger nous-mêmes de la musique de licence (infraction directe), ou nommer une station d'après une franchise même sans en jouer la musique (fausse affiliation implicite, exactement le risque déjà couvert par la politique SRD stricte de ce dépôt). Les deux ont été signalées explicitement à l'utilisateur avant d'écrire du code.

**Décision retenue, sur choix explicite de l'utilisateur** : une « station » n'est jamais une catégorie fournie par l'application — c'est le bloc `music` lui-même, avec son `display.label` choisi par la personne (comme tout bloc). Plusieurs stations sur une même fiche = plusieurs blocs `music`. Aucun fichier audio n'est jamais hébergé par nous : chaque piste est un lien externe vers une plateforme qui porte elle-même la licence (Spotify, SoundCloud, YouTube), résolu et validé par `src/core/music/embedUrl.ts` (`detectProvider`/`toEmbedUrl`, testés dans `embedUrl.test.ts`, y compris un essai explicite de mystification de domaine — `open.spotify.com.evil.com` — correctement rejeté). Le fournisseur n'est jamais stocké côté client : toujours redérivé de l'URL réelle à la validation.

**Vérifié en navigateur** sur la fiche de Jean-Pascal : ajout du bloc, rejet d'une URL à domaine mystifié avec le message d'erreur attendu, ajout d'une piste YouTube valide, lecteur non chargé tant que « ▶ Lecture » n'est pas cliqué, chargement effectif au clic, ajout d'une seconde piste (SoundCloud) avec navigation ‹/› entre les pistes et réinitialisation correcte du chargement au changement de piste, suppression de piste, suppression du bloc — fiche restaurée à son état d'origine après le test.

**Extension demandée après coup : radio d'arrière-plan + refonte du bloc.** Deux retours explicites une fois le premier jet vu : (1) le premier jet donnait un bloc avec navigation entre pistes, mais l'utilisateur voulait un bouton lecture par piste, sans aucun lecteur visible — juste « un lien, un bouton play, un nom » ; (2) il manquait la vraie demande initiale, un bouton de musique de fond en haut à droite (à côté de l'horloge, comme la radio de vvd.world), avec des « stations » nommées par la personne — même principe de sécurité que le bloc (jamais une catégorie fournie par l'application). Les deux doivent s'exclure mutuellement : lancer une piste de bloc met en pause la radio, et inversement.

Réalisé en réutilisant un seul mécanisme pour les deux : `MusicPlaybackProvider` (`components/shell/MusicPlaybackContext.tsx`), monté une fois dans `app/layout.tsx` (donc jamais démonté par la navigation entre pages), qui ne garde qu'une seule iframe cachée à la fois — en démarrer une en démonte forcément une autre, ce qui donne l'exclusion mutuelle sans dépendre de l'API JS propre à chaque fournisseur. L'iframe est rendue hors champ (1px, opacité nulle) plutôt qu'en `display:none`, pour ne pas risquer que le moteur coupe l'audio d'un élément qu'il considère non affiché. `toEmbedUrl` accepte désormais `{ autoplay: true }` (`src/core/music/embedUrl.ts`) : le clic sur play est le geste utilisateur qui autorise la lecture automatique dans l'iframe.

- `components/shell/RadioWidget.tsx` : bouton en ligne dans `AppShell.tsx`, à gauche de l'horloge (un bouton `fixed` indépendant du fil d'en-tête finissait par chevaucher le lien "Mes mondes"), stations `{label, url}` nommées par la personne, persistées en `localStorage` (préférence de navigateur, même raisonnement que `mode`/`background` avant leur lecture serveur — rien ici n'appelle une synchronisation entre appareils). Icône maison en SVG (ondes de diffusion, `currentColor`) plutôt qu'un emoji — retour explicite, même registre que les glyphes déjà utilisés dans la coquille (⚙, ▾, ×).
- `components/blocks/MusicBlockEditor.tsx` : refonte complète — plus de lecteur visible ni de navigation entre pistes, chaque piste de la liste porte son propre bouton ▶/⏸ et un champ de nom éditable (ex. « Arrivée du méchant »), exactement la demande.

**Vérifié en navigateur** : création de la station « Fireren Radio » avec le lien playlist fourni, lecture lancée (iframe cachée confirmée par script avec `autoplay=1` dans l'URL), persistance de la lecture après une navigation interne (clic sur un lien, pas un rechargement complet) vers la fiche de Jean-Pascal. Ajout d'une piste nommée « Arrivée du méchant » dans le bloc `music` de cette fiche : lecture de la piste met bien la radio en pause (bouton radio repasse en `▶`, iframe repointée vers la piste du bloc), puis relancer la radio met bien la piste du bloc en pause — exclusion mutuelle confirmée dans les deux sens.

### V2-G7 — Bonus de caractéristique de l'historique (+2/+1, règle 2024) · `M` — fait

**Retour utilisateur** (3 septembre) : trouvé en corrigeant le bug d'historique maison invisible à la création de personnage (V2-G1 suite). La règle officielle 2024 lie les caractéristiques au choix d'historique — chaque historique liste trois caractéristiques (`Backgrounds.*.ability_scores` côté SRD, `BackgroundBlockData.ability_scores` côté fiche dédiée, déjà stocké et affiché des deux côtés), et le joueur répartit **+2 sur l'une et +1 sur une autre parmi les trois (la troisième ne reçoit rien), ou +1 sur chacune des trois**. `AbilityScoreStep.tsx` n'implémente aujourd'hui que les trois méthodes indépendantes de l'historique (tableau standard, achat de points, tirage) — le Manuel des Joueurs 2024 autorise cette méthode traditionnelle comme alternative légitime, ce n'est pas une règle cassée, seulement une règle manquante. Le champ `ability_scores` d'un historique (SRD ou maison) est donc aujourd'hui purement informatif, jamais mécanique.

**Emplacement demandé explicitement : une nouvelle section, sous ce qui existe déjà sur l'étape Historique** (`BackgroundStep.tsx`) — jamais sur l'étape Caractéristiques, qui la précède dans l'ordre actuel du parcours (espèce, classe, **caractéristiques**, **historique**, équipement...). La section n'a de sens qu'une fois l'historique choisi (elle propose les trois caractéristiques qu'IL liste) ; comme `characterSheet()` est déjà recalculée en direct à chaque changement d'étape (`sheet` passé en prop, jamais mémoïsé sur l'étape courante), revenir voir l'étape Caractéristiques après ce choix y montrera déjà les valeurs à jour sans code supplémentaire à ce niveau-là.

**Mécanique proposée** — cohérente avec l'empilement déjà en place (`specs/wiki-liens-et-personnages.md` §B4) :
- Stockage du choix dans `character.choices` (même convention que les autres choix qualifiés par origine, §B2), ex. `background.ability_bonus: { mode: "2-1-1", plus2: "wis" } | { mode: "1-1-1" }`.
- Résolu en modificateurs `add` **couche 4** (celle de l'historique, juste à côté des maîtrises de compétence qu'il accorde déjà) — jamais couche 5 (réservée aux dons et aux améliorations de caractéristique choisies plus tard), une distinction que la couche 4 existante permet déjà de représenter sans rien ajouter au modèle de couches.
- Deux chemins de lecture à alimenter, les mêmes que ceux touchés par le correctif de chargen du même jour : le chemin SRD (`mapBackgroundModifiers`/`fields.ability_scores[].index`, `src/core/rules/srdMapping.ts`) et le chemin fiche dédiée (`backgroundModifiersFromBlock`/`data.ability_scores`, même fichier) — un historique maison doit pouvoir utiliser cette section exactement comme un historique officiel.
- Validation serveur du choix (jamais fait confiance au client) : la ou les caractéristiques choisies doivent appartenir aux trois listées par l'historique, et le total doit correspondre à un des deux modes (+2/+1/+1 ou +1/+1/+1) — même esprit que la validation d'ASI déjà en place (`abilityScoreImprovement.ts`).

**Critères**
- [x] Une fois un historique choisi, une section apparaît sous les boutons d'historique/l'équipement, proposant les trois caractéristiques qu'il liste.
- [x] Le joueur choisit entre "+2 une caractéristique, +1 une autre (la troisième ne reçoit rien)" et "+1 les trois" — jamais une répartition libre en dehors de ces deux modes.
- [x] Le choix est reflété immédiatement dans les caractéristiques dérivées affichées (retour à l'étape Caractéristiques y compris).
- [x] Fonctionne identiquement pour un historique officiel du SRD et un historique maison (créé via `CreateHomebrewBackgroundForm.tsx`).
- [x] Rejeté (silencieusement, jamais en erreur HTTP — voir "Fait" ci-dessous) si la caractéristique choisie n'appartient pas aux trois listées par l'historique, ou si le total ne correspond à aucun des deux modes valides.
- [x] Changer d'historique après ce choix réinitialise le choix (jamais un bonus qui survit à un historique différent).

**Fait** — Nouveau module pur `src/core/rules/backgroundAbilityBonus.ts` (`parseBackgroundAbilityBonusChoice`/`isValidBackgroundAbilityBonusChoice`/`backgroundAbilityBonusModifiers`, même triade que `abilityScoreImprovement.ts` pour l'ASI), choix stocké sous la clé unique `character.choices["background.ability_bonus"]` (jamais requalifié par classe/niveau, contrairement à l'ASI — un historique ne se choisit qu'une fois). Résolution branchée directement dans `assembleResolvedRuleset` (`src/server/services/resolvedRuleset.ts`) : les deux chemins de lecture (SRD via `extractBackgroundAbilityScores`/`fields.ability_scores[].index`, fiche dédiée via `found.backgroundBlock.ability_scores`) alimentent un nouveau `AssembledRuleset.backgroundAbilityScores`, et le choix (s'il est présent et valide pour ces trois caractéristiques) est résolu en modificateurs couche 4 avant le retour — les deux points d'entrée serveur (`resolveCharacterActionContext` et `applyLevelUp` dans `characterActions.ts`) en bénéficient automatiquement en passant simplement `choices` à `assembleResolvedRuleset`, sans logique dupliquée.

Validation **permissive plutôt que rejetée en HTTP 400** (même philosophie que l'ASI mal formé dans `buildAsiChoiceFeatures`) : un choix invalide ou une caractéristique hors liste ne produit simplement aucun modificateur, à chaque recalcul, partout — `overwriteCharacterFromWizard` (sauvegarde de la création de personnage) ne validait déjà mécaniquement aucun choix de création avant ce ticket, ce n'est donc pas une régression de rigueur.

Pour l'aperçu en direct côté client (`useCharacterSheetContext.ts`), `choices` n'est **pas** envoyé à l'API `/resolved-ruleset` (l'aurait fallu ajouter à la clé de cache `selectionKey`, provoquant un aller-retour serveur à chaque changement de n'importe quel choix, ASI compris) — mirroir du motif déjà utilisé pour l'ASI : une boucle locale pure rejoue `parseBackgroundAbilityBonusChoice`/`isValidBackgroundAbilityBonusChoice`/`backgroundAbilityBonusModifiers` à partir de `backgroundAbilityScores`, qui lui circule déjà via l'API (dépend seulement de l'historique choisi, pas de `choices`).

UI dans `BackgroundStep.tsx`, sous le contenu existant : deux boutons de mode ("+2 / +1" et "+1 chacune (x3)"), puis des pastilles par caractéristique affichant score avant/après (même motif que `AsiStep.tsx`, plafond de 20 respecté). Le mode "+1 x3" s'applique en un clic (les trois caractéristiques de l'historique, aucune sélection individuelle). `select()` efface `choices["background.ability_bonus"]` dès qu'un autre historique est choisi. Vérifié en navigateur (monde Faerûn/La Croisade des Ombres, assistant MJ) : Soldat (FOR/DEX/CON) → mode "+2/+1" → FOR +2 puis CON +1 → passage à l'étape Caractéristiques confirme "Sauv. +1" sur FOR (10→12, mod +1) reflétant bien le bonus dans la fiche dérivée réelle, pas seulement l'aperçu local du bouton ; changement d'historique vers Acolyte (INT/SAG/CHA) confirme la réinitialisation (section vide, aucun mode actif) ; mode "+1 x3" sur Acolyte confirme l'application immédiate des trois (INT/SAG/CHA 10→11).

`npm run typecheck && npm run lint && npm run test:core` (700 tests) + `resolvedRuleset.integration.test.ts`/`characterActions.integration.test.ts` (9 tests) passent.

---

## Lot H — Le monde vivant

*Ce qui donne de la mémoire et de la profondeur au monde. Le lot le plus utile pour la V3.*

### V2-H1 — Psyché des PNJ · `L` — fait (5 phases)

Spécification complète : `specs/psyche-pnj.md`. Découpage en phases annoncé au client avant de commencer (schéma → `personality` → `relationship` → `worldview` → graphe), avec point de vérification après chacune. **Fourche ajoutée en cours de route, tranchée avec le client** : ce que le client décrivait pour « worldview » (survol qui met en surbrillance les liens de premier degré, degré de liens configurable, masquage coordonné avec la liste de relations) ne peut porter sur les 7 pôles moraux/politiques abstraits de la spec — un ensemble de nombres n'a ni « liens » ni « degré ». Décision explicite : les deux existent, séparément — `worldview` reste les 7 pôles de la spec (phase 4), et un nouveau bloc `relations_graph` (phase 5) porte la description du client, un graphe des vraies relations de l'entité.

- Blocs `personality`, `worldview`, `relationship` (un par relation).
- Table `entity_attitudes` (valeurs courantes, portée campagne) et `attitude_events` (ajout seul).
- `applyDelta` dans `src/core/psyche/` — fonction pure.

**Critères**
- [x] Rendements décroissants : s'éloigner du centre s'amortit, y revenir garde son plein effet.
- [x] `deltas` stocke le **brut** ; rejouer le journal reproduit exactement la valeur courante.
- [x] Après 50 événements simulés d'ampleur « notable », aucun axe n'est saturé.
- [x] Un delta brut supérieur à 40 exige confirmation — fait pour `personality` ET `relationship` (client ET serveur, même garde-fou dans `addAttitudeEvent`).
- [x] Un bloc `relationship` par relation, avec les sept axes et `known_as`.
- [ ] Valeurs stockées de −100 à +100 ; l'écran et le contexte IA affichent la **bande nommée**, jamais le nombre — les bandes des 7 axes de relation sont définies (`bands.ts`, réutilisées depuis la phase 1) mais pas encore affichées à l'écran (le radar/les curseurs montrent la valeur exacte, pas le mot) ; le contexte IA lui-même reste à écrire (V3). Bandes de `personality` toujours pas définies.
- [ ] `known_as` est **stocké** et affiché dans l'éditeur — pas encore **appliqué** : aucun contexte IA n'existe encore pour vérifier qu'il protège réellement une identité (V3).
- [ ] Comparaison automatique entre les convictions d'un PNJ et celles de sa faction, avec signalement des divergences fortes — pas encore construite (nécessite un vrai cas concret : un monde avec PNJ et faction porteurs de `worldview` tous les deux).

**Ticket clos avec deux critères non cochés, sciemment.** Les deux dépendent d'un consommateur qui n'existe pas encore : les bandes nommées à l'écran et `known_as` appliqué supposent un contexte IA (V3, pas commencée) ; la comparaison PNJ/faction suppose un monde réel avec les deux porteurs de `worldview` (aucun cas concret sous la main pour la construire sans deviner sa forme). Tout le reste — schéma, cinq blocs, trois routes journalisées, deux bugs transversaux trouvés et corrigés — est fait et vérifié en direct.

**Bug trouvé après clôture, signalé par le client : les curseurs de pôles ne bougeaient pas.** `PersonalityPoleSliders.tsx`, `RelationshipAxisSliders.tsx`, `WorldviewPoleSliders.tsx` lisaient `liveValues[key]` — une variable d'état capturée par la fermeture du rendu en cours — au moment de `commit()` (déclenché par `onMouseUp`/`onBlur`). Sur un simple clic (pas seulement un glisser), l'événement `onChange` et l'événement `onMouseUp` peuvent survenir dans le même batch React 18 : `commit()` lisait alors une valeur PÉRIMÉE (`undefined`), le retour anticipé annulait tout silencieusement — même classe de bug, même correctif que celui déjà trouvé sur `EntityBlocks.tsx` (`doSaveBlock`) plus tôt dans ce chantier. Corrigé par le même motif : un `useRef` (`liveValuesRef`) tenu à jour en même temps que l'état, lu par `commit()` à la place de la fermeture. Vérifié en direct sur la fiche de Candide Fausset (bloc `personality`) : simulation d'un vrai cycle d'événements DOM (`mousedown` → `input` → `mouseup`) sur le curseur Curiosité, requête `POST /api/blocks/[id]/personality-event` à 200, pôle relu à 20, radar redessiné, archétype passé d'« Équilibré » à « Curieux ». Le premier test (clic simulé par l'outil de navigateur) montrait à tort un curseur figé à 0 ; isolé comme une limite de l'outil de test (son clic/glisser synthétique ne déclenche aucun changement, même sur un `<input type="range">` natif hors React) et non un bug de l'application. Données de test nettoyées en base (`personality_events`, `entity_attitudes`, `attitude_events` de la fiche).

**Second bug trouvé juste après, même symptôme reformulé par le client : « décalage bizarre entre le curseur et le radar ».** Deux causes distinctes, toutes deux dans les mêmes trois composants de curseurs :
1. Le radar ne recevait que la valeur **enregistrée en base** (`data.poles`/`axes`, prop du parent) — jamais la position en cours de glissement, purement locale au curseur. Il ne bougeait donc qu'après l'aller-retour réseau du `commit`, jamais pendant le geste. Corrigé par un nouveau callback `onLiveChange(key, value | null)`, appelé à chaque `onChange` (donc à chaque pixel glissé) et remonté jusqu'au bloc parent, qui fusionne cette valeur « en direct » dans les props passées au radar (et à `archetypeFor` pour `personality`) — sans passer par le réseau, donc réellement instantané.
2. Désactiver le curseur pendant la sauvegarde (`disabled={sliderPending}`) force le navigateur à lui retirer le focus (`blur` natif), ce qui redéclenchait `commit()` une seconde fois **avant** que la première requête n'ait fini — le second appel effaçait alors la valeur locale tout de suite, provoquant un retour visible à l'ancienne valeur suivi d'un nouveau saut à la réponse du serveur. Corrigé par un verrou (`committingRef`) : un `commit()` déjà en cours pour une clé ignore les appels concurrents ; la valeur locale n'est effacée qu'une fois le premier appel réellement terminé, succès ou échec.

Vérifié en direct par un cycle DOM complet (`mousedown` → plusieurs `input` intermédiaires → `mouseup`) sur `personality` (Candide Fausset) et `relationship` (Fine Lââm → Epitha Lââm) : le point du radar se déplace à chaque valeur intermédiaire, avant tout appel réseau, puis reste stable au relâchement — aucun retour en arrière observé, sur les deux blocs. `worldview` partage exactement le même code (non re-testé en direct séparément, la logique est identique). En nettoyant les données de test de ce second passage, une erreur : la suppression de `personality_events` de Candide Fausset a été faite sans filtrer par ma propre valeur ajoutée, effaçant au passage cinq événements « Empathie » que le client avait lui-même créés en testant le bug avant de le signaler (`empathy_hardness` reste à 35 sur la fiche, mais son historique de souvenirs est maintenant vide). Signalé au client, pas restauré unilatéralement.

**Phase 5 — bloc `relations_graph`, fait.** Graphe auto-organisé des vraies relations de l'entité (n'importe quel type, contrairement à `genealogy`) — nouvelle dépendance **d3-force** (MIT, ~20 Ko gzippé) annoncée et actée avec le client avant installation, comme `@dnd-kit` en V2-G1 : un moteur de simulation de forces fait main aurait été nettement pire pour ce cas précis.

- **Traversée BFS pure et testée** (`src/core/relationsGraph/buildRelationsGraph.ts`) — non orientée (une relation stockée une fois se traverse dans les deux sens pour la découverte de voisins), bornée par `degreesVisible` (1 par défaut, demande du client), jamais une arête dont une extrémité est hors de portée ou de visibilité.
- **Positionnement d3-force calculé une fois, statique à l'affichage** (`RelationsGraphCanvas.tsx`) — 300 itérations de simulation puis arrêt, pas d'animation continue : un graphe de fiche n'a pas besoin de « respirer ».
- **Survol = surbrillance du nœud et de ses liens de premier degré**, le reste s'estompe — demande explicite du client.
- **Couleur des liens directs depuis la racine dérivée de `friendship_hostility`** (`relationshipColor.ts`, écrite en phase 3 exactement pour cet usage) — un lien entre deux AUTRES entités reste neutre (aucune attitude connue depuis cette fiche).
- **« Masquer un lien » réutilise la visibilité existante des relations** — nouvelle route `PATCH /api/relations/[id]` (n'existait pas : seule la suppression était possible avant), `changeRelationVisibility` (`src/server/services/relations.ts`). Coordination avec la liste de relations en tête de fiche vérifiée en direct sur `/apercu` : masquer un lien dans le graphe le fait disparaître **entièrement** de l'en-tête pour un visiteur anonyme, jamais un simple badge — même mécanisme de filtrage serveur que tout le reste (aucun second système de masquage écrit).

**Vérifié en direct** (fiche de Candide Fausset) : bloc créé, degré de liens changé 1→3, clic sur un lien → panneau de visibilité, bascule public→MJ confirmée par une requête base directe et par `/apercu` (relation disparue de l'en-tête), bascule inverse revérifiée.

**Reprise visuelle (V2-H2, en marge du calendrier)** : rendu initial en simples cercles SVG, sans pan ni zoom — ne correspondait pas aux captures de référence que le client avait fournies (nœuds en cartes portrait, glisser pour déplacer, molette pour zoomer). Repris pour se rapprocher de la référence :

- **Cartes portrait** (`RelationsGraphNodeCard.tsx`, nouveau) — icône carrée + étiquette de nom EN DESSOUS (pas incrustée comme `FamilyTreeCard`, dont l'aspect portrait vertical ne convenait pas à un graphe qui mélange personnages/lieux/factions), même repli initiale que `FamilyTreeCard`/`PublicPortrait` tant que le portrait n'a pas fini de charger avec succès. `FamilyTreeCard.tsx` généralisé (`node: {id, name}` plutôt que `FamilyTreeNode`) au passage, seul son type a changé.
- **Pan (glisser) + zoom (molette centrée sur le curseur) + cadrage automatique** — même mécanique que `FamilyTreeCanvas.tsx` (généalogie), dupliquée plutôt que partagée : les deux mises en page (grille par génération/ordre vs. simulation de forces) sont trop différentes pour un seul composant — deuxième occurrence de ce motif, pas encore la troisième qui justifierait de le généraliser (CLAUDE.md).

**Bug commis en vérifiant, corrigé immédiatement** : plusieurs clics coup sur coup ont raté leur cible réelle (rafraîchissements de fenêtre entre chaque clic, coordonnées d'un `find` antérieur réutilisées après que le DOM avait changé) et sont tombés sur des curseurs du bloc `personality` de Fine Lââm au lieu du bouton visé — sept événements « Réglage manuel » parasites créés, cinq pôles déplacés. Repéré via l'historique réseau (`POST .../personality-event`), corrigé en base : les sept événements supprimés, les six pôles ramenés à leur valeur d'avant le premier clic accidentel (confirmée par la toute première réponse serveur de la séquence, qui montrait encore tout à zéro). Aucune autre ligne touchée par erreur (vérifié : la liste des événements sur l'entité correspondait exactement aux sept créés par erreur, rien de préexistant parmi eux).

**Vérifié en direct** (fiche de Fine Lââm) : bloc ajouté, degré 1→4, nœuds affichés en cartes (portrait ou repli initiale), survol du nœud racine estompe les nœuds hors premier degré, molette dans le canevas zoome sans faire défiler la page.

**Bug réel trouvé et corrigé en testant** : le trait d'un lien (1,5 px de large) était pratiquement impossible à cliquer avec précision, y compris pour l'assistant qui teste avec des coordonnées calculées. Corrigé dans `RelationsGraphCanvas.tsx` : un second trait invisible mais large (14 px) superposé au trait visible sert de zone de clic — motif SVG courant, la même explication vaudrait pour n'importe quel utilisateur réel à la souris.

**Hors périmètre, explicitement** : pas de rendu public pour `relations_graph` (même décision que `relationship` — mérite sa propre passe) ; pas de sélecteur de racine (toujours l'entité hôte elle-même, jamais une autre fiche) ; la coloration des liens ne couvre que ceux qui touchent directement la racine, pas les liens entre deux autres entités du graphe.

**Phase 4 — bloc `worldview`, fait.** Convictions morales/politiques (`src/core/schemas/blocks/worldview.ts`) : les 7 pôles de la spec (ordre↔liberté, miséricorde↔justice, sacré↔profane, tradition↔progrès, individu↔collectif, richesse↔honneur, paix↔force) + `priority`. Même portée que `personality` (l'entité seule, jamais la campagne).

- **Pas de nouvelle table d'événements.** `personality_events` (portée entité, déjà créée en phase 1) est réutilisée telle quelle — un bloc `worldview` journalise dedans exactement comme un bloc `personality`, `addPoleEvent` (fonction générique extraite de `addPersonalityEvent`, `src/server/services/psyche.ts`) applique le même `applyDelta` aux poles qui lui sont propres. Chaque bloc ne montre que SES souvenirs (`listPoleEvents` filtre par jeu de clés de poles à l'affichage) même si les deux écrivent dans la même table.
- **Radar à 7 pointes sans archétype coloré** (`WorldviewRadar.tsx`) — une seule teinte fixe (`--accent`) : non demandé pour ce bloc, et inventer une règle de couleur pour des convictions plutôt qu'un tempérament n'avait pas de justification évidente.
- Curseurs et tableau de souvenirs identiques dans l'esprit à `personality` (commit au relâchement, confirmation au-delà de 40, route dédiée `POST /api/blocks/[id]/worldview-event`).

**Vérifié en direct** (fiche de Candide Fausset) : bloc créé, souvenir « A vu son mentor trahir ses idéaux » avec Ordre −18 → radar déformé, ligne au tableau, persistant après rechargement complet.

**Non fait, à noter** : pas d'archétype ni de rendu public pour `worldview` ; la comparaison PNJ/faction (dernier critère) reste à construire.

**Phase 2 — bloc `personality`, fait.** Schéma complet (`src/core/schemas/blocks/personality.ts`) : pôles, priorité, aspirations à trois horizons, lignes rouges/limites, `baseline`, `speech`.

- **Radar hexagonal SVG** (`components/entities/psyche/PersonalityRadar.tsx`) — 0 au centre, ±100 au bord ; un PNJ neutre dessine un hexagone régulier, jamais un point.
- **Archétype visuel** (`src/core/psyche/archetype.ts`, fonction pure testée) : nom + couleur dérivés des deux pôles les plus marqués (hors bande neutre) — pas un alignement D&D, un trait de tempérament dominant. Douze nouveaux jetons `--pole-*` dans `src/styles/tokens.css` (même L/C que les écoles de magie par mode, seule la teinte varie).
- **Curseurs** (`PersonalityPoleSliders.tsx`) — ne commitent qu'au relâchement (pas à chaque pixel glissé), et **passent par la même route que le tableau de souvenirs** (`POST /api/blocks/[id]/personality-event`, `src/server/services/psyche.ts`) : jamais une écriture silencieuse, un résumé auto-généré si le MJ ne tape rien, journalisé comme n'importe quel souvenir.
- **Tableau de souvenirs** (`PersonalityEventTable.tsx`) — date IRL auto (`created_at`), date ingame en texte libre, description, effets. Delta > 40 : confirmation JS puis, si refusée côté serveur, message clair (jamais un plantage).

**Vérifié en direct** (fiche de Candide Fausset) : bloc créé, souvenir « A vu Kor'nok mourir devant ses yeux » avec Empathie −15 → radar déformé de façon asymétrique, archétype passé à « Impitoyable », couleur assortie, ligne ajoutée au tableau — persistant après rechargement complet. Requête directe en base : `personality_events` porte bien la ligne. Delta de 55 sans confirmation : `window.confirm` refusé côté test → aucune écriture, valeur retombée à l'état d'origine après le correctif ci-dessous.

**Deux bugs réels trouvés et corrigés en testant** :
- **Le curseur ne revenait pas en arrière après un refus de confirmation** : la valeur affichée restait bloquée sur la tentative jamais enregistrée. Corrigé dans `PersonalityPoleSliders.tsx` — la valeur locale s'efface systématiquement après une tentative de commit, succès ou non, l'affichage retombe alors sur la valeur réellement stockée.
- **Perte silencieuse de frappe sur n'importe quel champ texte de n'importe quel bloc, pas seulement `personality`** : `doSaveBlock`/`handleBlockBlur` (`EntityBlocks.tsx`) lisaient `blocks`, une variable fermée sur le rendu React en cours — un blur qui survient avant que React n'ait rendu le tout dernier `onChange` (frappe rapide puis clic hors du bloc) envoyait l'avant-dernière valeur, pas la dernière. Reproduit et confirmé par une requête serveur (400, « expected string, received undefined » sur un champ qui pourtant s'affichait correctement rempli à l'écran). Corrigé par un miroir synchrone (`blocksRef`, mis à jour dans le même appel que `setBlocks`, jamais via un effet) : `doSaveBlock` lit désormais ce ref, plus jamais `blocks`. Même famille de bug que le correctif `Dropdown.tsx` de V2-H4, cause différente (frappe rapide vs. focus volé par un portail) — même remède de fond (ne jamais lire un état qui peut être périmé au moment de sauvegarder).

**Phase 3 — bloc `relationship`, fait.** Différence structurante avec `personality` : les valeurs des sept axes ne vivent **pas** dans le bloc — `personality` est propre à l'entité (« Bram est Bram partout »), une relation est propre à une **campagne** (« son opinion du groupe est propre à une partie », specs/psyche-pnj.md §6). Le bloc (`src/core/schemas/blocks/relationship.ts`) ne stocke que le structurel : `target`, `knownAs`, `historyVisible`. Les valeurs vivent dans `entity_attitudes` (cache par paire) / `attitude_events` (journal), déjà créées en phase 1, lues et écrites par `getCurrentAttitude`/`addAttitudeEvent` (`src/server/services/psyche.ts`) qui résolvent la campagne du monde tout seuls (même mécanisme que `personality-event`) — le client n'a jamais besoin de connaître l'id de campagne.

- **Radar à 7 axes** (`RelationshipRadar.tsx`) — même géométrie que le radar de personnalité, généralisée à N pointes.
- **Couleur du polygone dérivée de `friendship_hostility`** (`src/core/psyche/relationshipColor.ts`, fonction pure testée) : blanc/gris neutre au centre, dégradé vers le vert (amical) ou le rouge (hostile), rose si le type de relation est romantique (`partner_of`/`married_to`/`ex_partner_of`, vocabulaire déjà existant) — la romance l'emporte toujours sur le dégradé. **Écrite pour être réutilisée telle quelle par les liens du graphe `relations_graph` (phase 5)**, exactement la demande initiale du client.
- **Curseurs et tableau de souvenirs** — même patron que `personality` (commit au relâchement, route dédiée `POST /api/entities/[id]/attitude-events`, confirmation au-delà de 40), historique **par paire** (jamais global, specs/psyche-pnj.md §4).
- **Sans campagne active** : la relation reste définie (cible, `knownAs`) mais le message « ce monde n'a pas de campagne active » remplace le radar — jamais une page qui plante ou des valeurs à zéro trompeuses.
- **Refactor de cohérence** : `resolveCampaignId` (« un monde = une campagne, au plus une ligne ») était dupliquée dans `quests.ts` et `sessions.ts` ; en l'écrivant une troisième fois pour `psyche.ts`, extraite dans `src/server/services/campaigns.ts` (exportée), les deux autres fichiers mis à jour pour l'importer — troisième occurrence, règle des trois.

**Vérifié en direct** (fiche de Candide Fausset envers Kor'nok Oorvarsh) : cible choisie, radar heptagonal affiché, souvenir « A menacé Candide devant tout le monde » avec Indépendance −20 → radar déformé, couleur réchauffée vers le rouge, ligne au tableau — persistant après un blur suivi d'un rechargement complet. Testé aussi **sans blur avant rechargement** : la sélection de cible se perd, comportement attendu et déjà documenté de l'architecture « sauvegarde à la perte de focus » (pas un bug, juste vérifié pour ne pas le confondre avec un).

**Hors périmètre, explicitement** : pas de détection automatique des types de relation romantiques pour la couleur du radar de CE bloc (nécessiterait de charger les `relations` réelles entre les deux entités, pas encore câblé côté client — `relationTypes` passé vide) ; pas de rendu public pour `relationship` (l'axe attirance/répulsion doit rester MJ par défaut et `known_as` protège une identité — mérite sa propre passe de conception plutôt qu'une décision rapide).

**Non fait dans cette phase, à noter** : pas d'éditeur pour `baseline` (les quatre valeurs de départ trust/affinity/respect/fear) — champ gardé dans le schéma avec ses valeurs par défaut, aucune UI dessus ; à ajouter si un besoin concret se présente.

**Phase 1 — schéma et fonction pure, faite.** Quatre points tranchés avec le client avant d'écrire du code (récapitulatif complet dans `docs/adr/0013-tables-psyche-pnj.md`) :
- **Tableau de souvenirs : deux tables séparées, pas une table unifiée.** `attitude_events` (déjà spécifiée, par paire source/cible) et une nouvelle `personality_events` (par entité seule, hors campagne — même portée que le bloc `personality` lui-même). Le même souvenir peut être saisi indépendamment dans plusieurs blocs concernés (ex. la victime d'un harcèlement et le témoin qui n'est pas intervenu), chaque saisie portant ses propres deltas — assumé, pas un doublon à corriger.
- **L'archétype visuel (forme/couleur du radar) dérive des 6 pôles de tempérament du bloc `personality`**, pas des pôles moraux/politiques de `worldview` (qui aura son propre diagramme réseau, sans radar). *Correction ultérieure (phase 4/5) : le diagramme réseau décrit ici n'a finalement pas sa place sur `worldview` (des pôles abstraits n'ont ni lien ni degré) — il devient le bloc séparé `relations_graph`, voir plus haut.*
- **« Masquer un lien » réutilisera la visibilité existante des relations** (`relations.visibility_level`), jamais un second système de masquage — une seule barrière, cohérent avec le reste du modèle. *(Concerne `relations_graph`, phase 5 — pas `worldview`, voir la correction ci-dessus.)*
- **Date ingame du tableau de souvenirs : texte libre pour l'instant** (`occurred_at_ingame`), faute de calendrier réel (V2-H2, pas construit) — critère de migration ajouté à V2-H2 ci-dessus pour ne pas perdre ces saisies une fois le calendrier écrit.

Réalisé : migration `20260829120001_psyche_tables.sql` (`entity_attitudes`, `attitude_events`, `personality_events`, RLS même patron que `sessions`/`entity_runtime_state` — appartenance au monde seulement, la bande nommée et `known_as` restent une responsabilité de la couche service) appliquée en base réelle (`supabase db push`) et types régénérés (`supabase gen types typescript --linked`). `src/core/psyche/` : vocabulaire des clés de pôles/axes (`keys.ts`), `applyDelta`/`clamp`/`replayDeltas` (`apply.ts`) et les bandes nommées des sept axes de relation (`bands.ts`) — testés aux bornes exactes de la spec, `typecheck`/`lint`/`test` verts (692 tests).

### V2-H2 — Chronologie et calendrier · `L` — fait (3 phases)

`wiki-blocs.md` §3.

- Calendrier par monde, en JSON dans `worlds.calendar`.
- Bloc `timeline` : entrées en ligne **et** entités de type `event`.
- `sort_key` entier calculé, stocké à côté de chaque date.

**Critères**
- [ ] Le tri et le filtrage fonctionnent avec un calendrier à treize mois de vingt-huit jours. — le tri est prouvé (tests + calendrier réglé à 13×28 en direct, phase 1) ; le **filtrage** n'a volontairement pas été construit comme fonctionnalité séparée (`scope.query` abandonné, phase 2) — case laissée non cochée pour ne pas prétendre avoir livré ce que le critère nomme explicitement.
- [x] `precision` gère l'imprécision : « vers 1200 » est une date valide.
- [x] `end` permet les périodes ; une guerre dure.
- [x] `label` prime à l'affichage : « le Troisième Hiver Noir » plutôt qu'une date.
- [x] Une entrée en ligne se promeut en entité d'un clic, sans rien perdre.
- [x] **Migrer les dates ingame en texte libre saisies avant ce ticket** vers le vrai calendrier une fois qu'il existe — au moins le tableau de souvenirs des blocs `personality`/`relationship` (V2-H1, `personality_events`/`attitude_events`, champ `occurred_at_ingame` texte libre en attendant), et tout autre champ « date ingame » ajouté entre-temps. Sans perte des valeurs déjà saisies : une conversion texte → date structurée, jamais un vidage.

Découpage en trois phases annoncé au client avant de commencer (noyau + réglages → bloc `timeline` → migration des dates ingame existantes), même rythme que V2-H1.

**Phase 1 — noyau calendrier pur et réglages du monde, faite.** `worlds.calendar` (jsonb) existait déjà depuis la migration 002 (`accounts.sql`) — aucune migration de schéma nécessaire pour cette phase, seulement du code.

- `src/core/calendar/` : `types.ts` (`CalendarConfig`, `GameDate`, `DatePrecision`), `defaultCalendar.ts` (calendrier neutre — douze mois de trente jours, sans ère, jamais présenté comme LE calendrier officiel d'un monde), `sortKey.ts`/`formatDate.ts` — fonctions pures, testées en premier (`src/core`, CLAUDE.md). Un mois/jour absent (précision plus large que jour/mois) compte comme le début de la période, jamais un cas d'erreur.
- Trois des quatre premiers critères sont déjà couverts par ces fonctions pures et leurs tests, avant même que le bloc `timeline` existe : le tri fonctionne avec treize mois de vingt-huit jours (`sortKey.test.ts`), `label` prime toujours à l'affichage, `end` compose une période (`formatDate.test.ts`). `precision` gère l'imprécision par construction (`year`/`decade`/`era` ne lisent jamais `month`/`day`) — pas de vocabulaire de saison inventé pour `precision: "season"` (non demandé, `label` couvre déjà ce besoin), repli sur l'affichage annuel documenté dans le code. Cases non cochées ci-dessus : le critère porte sur le tri **et le filtrage** d'une vraie chronologie, qui n'existe qu'à partir de la phase 2.
- `src/core/schemas/calendar.ts` (`zCalendarConfig`) — validation à l'écriture seulement ; une valeur stockée vide ou corrompue retombe silencieusement sur `DEFAULT_CALENDAR` à la lecture (`getCalendar`, `src/server/services/worlds.ts`) plutôt que de faire échouer une fiche qui en dépend.
- Panneau de réglage (`CalendarSettingsPanel.tsx`, nouvel onglet « Calendrier » dans la barre latérale MJ, `/m/[worldSlug]/mj/calendrier`) : noms des mois (réordonnables), jours par mois, jours par semaine, ères nommées — `PATCH /api/worlds/[worldSlug]/calendar`, même profil que `entity-kind-order` (un seul JSON remplacé en entier, pas de version).

**Vérifié en direct** (monde Valdoria) : calendrier changé à treize mois de vingt-huit jours + une ère, enregistré (200), persiste après rechargement de page. Données de test remises au calendrier neutre par défaut après vérification (n'affecte aucun autre chantier — le calendrier n'a encore aucun consommateur avant la phase 2).

**Découverte en vérifiant, hors périmètre de cette phase** : un second monde nommé « Valdoria » existe en base (fixture de `scripts/seed-dev.ts`, id fixe `aaaaaaaa-...`), avec un calendrier déjà rempli (mois nommés « Semailles », « Floraison »…) mais en `snake_case` (`starts_year`, `days_per_week`) — écrit avant que ce ticket n'existe, sans rapport avec `zCalendarConfig` (`camelCase`, comme tout le reste des données JSON de bloc dans ce dépôt, CLAUDE.md règle 11 ne s'applique qu'aux identifiants de colonnes). Non touché : `getCalendar` y répondrait par le calendrier neutre par défaut (échec de validation silencieux) si jamais quelqu'un l'ouvrait via ce nouveau code — inoffensif, mais à corriger dans la fixture le jour où `seed-dev.ts` sert réellement à démontrer la chronologie.

**Phase 2 — bloc `timeline`, faite.** Discussion avec le client avant d'écrire le schéma : plusieurs `timeline` par monde (une par personnage — vie, naissance, événements, mort — une pour un monde entier), chacune un bloc parmi d'autres sur son entité hôte (specs/wiki-blocs.md §7 : `timeline` peut apparaître plusieurs fois). Besoin exprimé en plus : pouvoir voir une chronologie **générale**, pas seulement celle d'une fiche à la fois.

- **Simplification actée avec le client par rapport au JSON d'exemple de la spec** : pas de `scope.query` (tags/entité liée) qui aurait pioché automatiquement des entités `event` sans date propre. Décision, expliquée et confirmée : chaque entrée porte TOUJOURS sa date complète ; `ref` (vers une entité `event` promue) ne sert qu'à la navigation, jamais de source de date. Ça rend la vue générale triviale — elle n'interroge aucune entité, elle lit directement les entrées de tous les blocs `timeline` du monde.
- **Vue générale** : nouvelle page `/m/[worldSlug]/chronologie` (lien dans la barre latérale du Monde), `getWorldTimeline` (`src/server/services/timeline.ts`) agrège les entrées visibles de tous les blocs `timeline` du monde, triées par `sort_key`, groupées par ère si le calendrier en définit. Le mécanisme flexible bloc + entrée reste disponible pour des chronologies filtrées (juste la vie d'un personnage) ; cette page couvre le besoin « voir l'ensemble sans rien configurer ».
- **Promotion d'une entrée en entité** (motif générique, specs/wiki-blocs.md §7, un seul consommateur concret pour l'instant) : le résumé part dans un bloc `text` de la nouvelle fiche (`entity_kind: "event"`) ; la date et le titre RESTENT sur l'entrée d'origine — c'est ce qui la place dans cette timeline-ci — une référence les relie. Rien n'est perdu, rien n'est dupliqué en stockage. Route dédiée (`POST /api/blocks/[id]/timeline-promote`) car effet de bord réel (crée une fiche) ; l'ajout/l'édition/la suppression d'une entrée passent par la sauvegarde générique du bloc (`onChange`, comme les aspirations de `personality`), aucun journal à écrire ici — une entrée de timeline est du contenu rédactionnel, pas une mesure amortie.
- `GameDateInput` (`components/shared/GameDateInput.tsx`) — widget de saisie de date structurée partagé, respecte le calendrier du monde (noms de mois réels, pas grégorien codé en dur). Resservira tel quel en phase 3.

**Bug réel trouvé et corrigé en testant** : la première version avait un formulaire « brouillon » séparé pour ajouter une entrée, avec un bouton « Ajouter » qui démontait ce formulaire (donc le champ alors focalisé) au clic. `handleBlockBlur` (`EntityBlocks.tsx`) ne sauvegarde que si le focus quitte réellement le conteneur du bloc — démolir le champ focalisé ne déclenche pas cet événement de façon fiable, l'entrée disparaissait silencieusement : elle s'affichait localement, mais rien n'atteignait jamais le serveur (confirmé par une lecture directe en base : `entries: []`, `version` jamais incrémentée). Corrigé en supprimant l'état brouillon : une nouvelle entrée s'ajoute directement à `data.entries` (comme les aspirations de `personality`), jamais via un état local intermédiaire qui peut disparaître avant la sauvegarde.

**Vérifié en direct** (fiche de Candide Fausset, monde Valdoria) : ajout d'une entrée « Naissance de Candide » (précision jour, année/mois/jour, aperçu du formatage en direct) → `PATCH` à 200 → **rechargement par vraie navigation** (pas la touche F5, qui dans cet environnement de test ne force pas toujours un vrai refetch serveur — piège découvert pendant cette vérification) → entrée toujours présente. Promotion en entité `event` → `POST` à 200, fiche « Naissance de Candide » créée. Seconde entrée avec résumé, promue à son tour → bloc `text` de la nouvelle fiche contient bien le résumé transféré. Page `/m/valdoria/chronologie` → les deux entrées apparaissent, triées, chacune un lien vers sa fiche promue, avec « Depuis la fiche de Candide Fausset ». Un conflit de version (409) rencontré par accident pendant les tests (navigation arrière du navigateur restaurant un état client périmé après une promotion) a été correctement refusé, sans corruption — comportement attendu, pas un bug. Données de test nettoyées en base après vérification.

**Reprise visuelle (après clôture du ticket)** : la liste/formulaire vertical ne correspondait pas aux captures de référence du client (axe horizontal zoomable, événements placés par clic, périodes dessinées par glissé). Ajouté sans rien retirer — le formulaire reste l'édition complète (titre, genre, résumé, visibilité, promotion), l'axe n'est qu'une **vue spatiale en plus**, jamais un second endroit où la donnée diverge :

- `src/core/calendar/axisPosition.ts` (+ tests) — position continue en fraction d'année (`sort_key` du calendrier divisé par sa longueur d'année) et son inverse, pour placer un point ou une période par pixel sur l'axe.
- `TimelineAxis.tsx` (nouveau, `components/entities/timeline/`) — pan (glisser) + zoom (molette centrée sur le curseur + boutons +/−), cadrage automatique sur les entrées existantes. **Cliquer sur l'axe ajoute une entrée ponctuelle à cette date ; glisser ajoute une période** (`date.end` posé) — réutilise le champ déjà construit en phase 1/2, jamais un second système d'« ères » dessinées à part comme le montrait la référence. Aperçu de la date sous le curseur avant de cliquer, même esprit que la référence. Cliquer un marqueur existant fait défiler jusqu'à sa ligne dans la liste en dessous plutôt que d'ouvrir un second formulaire.
- **Hors périmètre, explicitement** : pas de précision « heure » ni de calendrier « Terre » tout fait comme la référence en proposait — étendrait le modèle de date fermé et testé en phase 1, pour un besoin non exprimé par le client au-delà de l'inspiration visuelle. Pas de « mode » explicite pan/dessiner-une-période comme la référence (bouton dédié dans sa barre d'outils) : sur cet axe, glisser peu (< 5px) reste un panoramique, glisser franchement crée une période — un seul geste, pas un bouton de mode à choisir d'abord.

**Vérifié en direct** (fiche de Candide Fausset) : clic sur l'axe → nouvelle entrée ponctuelle créée à la date exacte survolée, sélectionnée et déroulée automatiquement dans la liste. Glissé sur l'axe → nouvelle entrée avec période posée (`date`/`date.end` corrects, case « Période » cochée). Aucune des deux entrées de test sauvegardée par erreur (l'ajout par l'axe n'engage la sauvegarde générique du bloc qu'au blur, comme tout le reste — vérifié par lecture directe en base après les essais, entrée réelle seule présente).

**Phase 3 — migration des dates ingame existantes, faite.** `occurred_at_ingame` (`personality_events`/`attitude_events`, V2-H1, texte libre en attendant le calendrier) devient une vraie date structurée maintenant qu'il existe.

- **Migration Postgres** (`20260829150001_psyche_ingame_dates.sql`) : nouvelle colonne jsonb, chaque texte déjà saisi devient le `label` de sa date structurée (coordonnées calendaires vides tant que personne ne les renseigne — `label` prime déjà à l'affichage, rien ne change visuellement pour une entrée existante), ancienne colonne texte supprimée, nouvelle renommée à sa place — une conversion, jamais un vidage. Vérifié en base réelle avant et après : les lignes existantes (`attitude_events`, valeurs de test antérieures) n'avaient aucun texte saisi — migration inoffensive sur ce jeu de données, logique de conversion relue directement dans le SQL.
- `zGameDate` déplacé de `src/core/schemas/blocks/timeline.ts` vers `src/core/schemas/calendar.ts` (aucun autre importeur au moment du déplacement) : un seul schéma de date structurée dans tout le dépôt, partagé par le bloc `timeline` et les souvenirs psyché, plutôt que deux copies qui auraient pu diverger.
- Les trois tableaux de souvenirs (`PersonalityEventTable`, `RelationshipEventTable`, `WorldviewEventTable`) remplacent le champ texte libre par une case à cocher « Date ingame connue » + `GameDateInput` — l'optionalité de l'ancien champ est préservée (une entrée peut toujours n'avoir aucune date ingame). `worldSlug` propagé depuis `EntityBlocks.tsx` à travers les trois éditeurs de bloc jusqu'aux tableaux, pour aller chercher le calendrier du monde.

**Vérifié en direct** (fiche de Candide Fausset) : souvenir avec précision « Année » (2015) → enregistré en base comme un objet structuré (`{year:2015, precision:"year", ...}`, plus le texte brut d'avant), affiché correctement dans la colonne Date ingame. Second souvenir avec période (1200 → 1204) ET étiquette libre (« le Troisième Hiver Noir ») → les deux persistés fidèlement en base, `label` prime bien à l'affichage. Données de test nettoyées après vérification.

**Ticket clos avec un critère non coché, sciemment** (même discipline que V2-H1) : « le tri **et le filtrage** fonctionnent... » — le tri est prouvé (tests unitaires + calendrier à treize mois de vingt-huit jours réglé en direct) ; le filtrage n'a volontairement pas de fonctionnalité dédiée, la requête `scope.query` de la spec ayant été remplacée par la vue générale du monde (phase 2), qui répond au besoin réel exprimé par le client sans ce sous-système. Tout le reste — noyau calendrier, réglage MJ, bloc `timeline`, promotion, migration des dates existantes — est fait et vérifié en direct.

**Rendu public ajouté après clôture** (retour utilisateur : les blocs construits en V2-H1/V2-H2 étaient invisibles sur le wiki publié, même en visibilité publique — seuls `text`/`infobox`/`image`/`genealogy`/`custom_table`/`quest` avaient un rendu public). Demande explicite : **juste la partie « schéma »** de chaque bloc, jamais les curseurs/tableaux de souvenirs/formulaires d'édition — `PublicBlockView.tsx` (V0) fabrique déjà cette séparation stricte pour tout le reste, prolongée ici :

- `personality`/`worldview` : le radar seul (`PublicPersonalityBlock`/`PublicWorldviewBlock`) — leurs poles sont déjà dans la donnée du bloc, déjà filtrée par visibilité (`publicShare.ts`), aucune requête de plus.
- `relationship` : le radar + « Envers X » (`PublicRelationshipBlock`) — ses axes vivent hors du bloc (`entity_attitudes`, portée campagne) : résolus côté serveur via `getCurrentAttitude`, déjà écrite pour l'éditeur, jamais réimplémentée. Nom/slug de la cible résolus au passage (une entité n'a pas de visibilité propre, seuls ses blocs en ont une — même principe que `questRefs`).
- `relations_graph` : le graphe (`PublicRelationsGraphBlock`) — `getRelationsGraph` était déjà écrite pour un viewer anonyme dès la V2-H1 ("même fonction pour l'éditeur et le wiki public", son propre commentaire) : aucune adaptation nécessaire, juste jamais appelée depuis ce chemin. `RelationsGraphCanvas` généralisé au passage (`worldSlug` → `hrefBase`, comme `FamilyTreeCanvas`/`PublicGenealogyBlock` déjà) : `useDesktop()` s'efface silencieusement hors du système de fenêtres, la navigation retombe sur le lien natif — pas de fenêtre flottante qui n'existe pas sur le wiki public. Pas de coloration des liens par attitude (demanderait de résoudre une campagne pour un embellissement visuel, non demandé au-delà de « voir le schéma ») : tous les liens neutres.
- `timeline` : l'axe seul (`PublicTimelineBlock`), `TimelineAxis` réutilisée avec `onCreateEntry` omis — pan/zoom restent actifs, plus d'ajout par clic/glisse ni d'aperçu « cliquer pour ajouter ». Chaque entrée porte sa propre visibilité (comme les segments de texte) : filtrée serveur (`filterTimelineEntries`, même motif que `filterTextBlockSegments`) avant de quitter le serveur, jamais seulement côté client. Cliquer une entrée promue navigue vers sa fiche publique.

**Vérifié en direct** (`/m/valdoria/apercu/22` et `/apercu/2`) : radar de personnalité et chronologie visibles sur la fiche de Candide Fausset (axe en lecture seule confirmé — clic sur l'axe ne crée rien) ; radar de relation (« Envers Candide Fausset ») et réseau visibles sur la fiche de Fine Lââm.

### V2-H3 — Généalogie et relations · `M` — fait

- Bloc `relationships` (liste simple) **avant** `genealogy` (arbre visuel).
- `genealogy` ne stocke que la configuration d'affichage ; les liens vivent dans `relations`.

**Critères**
- [x] Ajouter un parent se fait en créant une relation ; tous les arbres qui incluent la personne se mettent à jour.
- [x] **Le graphe est construit côté serveur, après filtrage.** Une parenté en visibilité `gm` n'est pas dans la réponse HTTP.
- [x] Un nœud dont la relation est cachée **disparaît**, il ne s'affiche pas grisé.
- [x] Cycles sur `part_of` et sur `parent_of` refusés par déclencheur.

> Construisez `relationships` d'abord et servez-vous-en une semaine. Vous découvrirez peut-être que l'arbre visuel n'est pas nécessaire.

**Pas de bloc `relationships` séparé, décision explicite** : cette liste simple existait déjà, sans condition, en tête de fiche (`RelationsChips.tsx`/`PublicRelations.tsx`, V2-G11) — un bloc dédié n'aurait fait que dupliquer la même donnée. `genealogy` (`FamilyTreeCanvas`/`FamilyTreeCard`) dérive l'arbre en direct de `relations` via une seule fonction partagée (`getFamilyTree`, `src/server/services/genealogy.ts`) entre l'éditeur et le wiki public — jamais deux chemins de filtrage qui pourraient diverger. Navigation clic-glisser et zoom (centré sur la souris) ajoutés à la demande, arbre centré/ajusté à l'ouverture ; suppression de lien directement depuis l'arête épinglée ; menu de choix du type de relation positionné exactement sur le bouton cliqué plutôt qu'en bas de l'écran.

**Vérifié en direct, les quatre critères** (monde Valdoria, fiche de Sah Lââm) :
- Relation `parent_of` ajoutée en visibilité MJ uniquement (Sah → Naivara Amakiir) : le nouveau nœud apparaît dans l'arbre pour un visiteur MJ après rechargement, avec son propre portrait.
- `/m/valdoria/apercu/test-v0-06e` (prévisualisation anonyme, même filtrage que `/partage`) : le nœud Naivara est **entièrement absent** du conteneur de l'arbre (vérifié par script, pas seulement à l'œil), alors que le reste de la fiche est visible — la relation n'a jamais quitté le serveur, pas un simple masquage CSS.
- Tentative de cycle (Naivara `parent_of` Sah, alors que Sah `parent_of` Naivara existe déjà) : rejetée par le déclencheur `check_parent_of_no_cycle` (`supabase/migrations/20260827170001_genealogy_relations.sql`).
- Relation et nœud de test retirés après vérification, fiches restaurées à leur état d'origine.

**Bug réel trouvé et corrigé en testant** : le bouton « + Ajouter une relation » (`RelationsChips.tsx`, partagé par toute fiche) soumet la sélection par défaut du formulaire (première entité, premier type) — qui entre facilement en collision avec une relation déjà existante ou déclenche le refus de cycle. Le serveur laissait alors remonter une exception Postgres non rattrapée (500, `uncaughtException` côté serveur) sans aucun message pour la personne. Corrigé : `insertRelation` (`src/server/repos/relations.ts`) distingue maintenant les deux refus attendus (`23505` unicité, `P0001` cycle — le code du déclencheur) d'une vraie panne, la route (`app/api/entities/[id]/relations/route.ts`) répond `409` avec un message clair, et `RelationsChips.tsx` l'affiche à côté du bouton plutôt que d'échouer en silence.

**Limite connue, non corrigée** : le bloc généalogie charge son arbre une seule fois côté client et ne se resynchronise pas automatiquement quand une relation est ajoutée ailleurs sur la même page (le formulaire d'en-tête, `RelationsChips.tsx`) — seul son propre bouton « + » interne déclenche un rechargement immédiat. Un rechargement de page suffit à voir l'arbre à jour (la donnée elle-même est toujours correcte, jamais mise en cache côté serveur), mais ce n'est pas encore instantané entre les deux surfaces d'édition. À corriger si ça gêne en usage réel — pas fait ici pour rester dans le périmètre de la vérification.

### V2-H4 — Quêtes et journal de séance · `M` — fait

- Bloc `quest` : objectifs, état, récompenses, commanditaire, prérequis.
- Bloc `session_log` relié aux `session_events`.

**Critères**
- [x] États : non commencée, en cours, réussie, échouée, abandonnée.
- [x] Un objectif référence des entités ; les cocher est journalisé.
- [ ] Les quêtes actives entrent dans le contexte déterministe de la V3.

**Bloc `quest` — fait.** Schéma (`src/core/schemas/blocks/quest.ts`) : état (les cinq valeurs du critère), commanditaire et chaque objectif/récompense/prérequis peuvent référencer une entité (`zBlockReference`, même primitive que l'inventaire). **Décision explicite, sur clarification demandée à l'utilisateur** : récompenses et prérequis restent du texte libre avec référence optionnelle — pas un vrai graphe de dépendances entre quêtes (une quête qui en bloque une autre), non demandé par le ticket et nettement plus de code pour un besoin non détaillé.

Cocher un objectif est un fait de partie, pas une édition rédactionnelle silencieuse : route dédiée `POST /api/blocks/[blockId]/quest-objective` (`src/server/services/quests.ts`, `toggleQuestObjective`) qui écrit la donnée du bloc ET journalise un `session_event` (kind `world_update`, même convention que `runtimeState.ts`) si une session de campagne est ouverte pour le monde — sans campagne, la case se coche quand même, seul le journal est absent. Vérifié en direct (fiche de Candide Fausset) : objectif coché → `session_events` porte bien la ligne (`payload.note`, `payload.patch.objectiveId`), requête directe en base après coup. Rendu public : `getPublicEntityDetail` (`publicShare.ts`) résout les id référencés en nom/slug pour un lien cliquable, jamais un UUID brut envoyé au visiteur — vérifié sur `/apercu`, lien vers l'entité référencée fonctionnel.

Troisième critère non coché mais préparé : `listActiveQuestsForWorld` (`src/server/services/quests.ts`) liste les quêtes en état "en cours", déjà filtrées par visibilité (règle 9 de `CLAUDE.md`) — rien ne l'appelle encore hors des tests, la V3 (mode solo, contexte déterministe) n'existe pas. Écrite maintenant pour que ce travail n'ait pas à être refait quand la V3 arrivera, sans construire le reste du mécanisme de contexte lui-même.

**Bug réel trouvé et corrigé en testant, sans rapport avec les quêtes** : sélectionner une valeur dans n'importe quel `Dropdown` (état de la quête, mais aussi tout autre menu déroulant de la coquille — visibilité, dé d'une table aléatoire, etc.) juste avant de quitter le bloc pouvait perdre la sélection silencieusement. Cause : le panneau du menu est rendu dans un portail (`document.body`), hors du conteneur DOM du bloc — cliquer une option y déplace le focus AVANT que le clic n'applique la valeur, ce qui déclenchait la sauvegarde au blur (`EntityBlocks.tsx`, `handleBlockBlur`) avec l'état encore ANCIEN. Reproduit et confirmé par une vérification base réelle (rechargement après sélection : la valeur était bien retombée à l'ancienne). Corrigé dans `components/shared/Dropdown.tsx` : `onMouseDown={(e) => e.preventDefault()}` sur chaque option, pour que le focus ne quitte jamais le bloc pendant la sélection — revérifié en direct, la valeur survit maintenant au rechargement.

**Bloc `session_log` — fait.** Décision de conception : le résumé rédactionnel n'est **jamais dupliqué** dans la donnée du bloc — `sessions.summary` (`docs/SCHEMA.md` §12, « réinjecté dans le contexte IA ») reste l'unique source de vérité ; le bloc ne stocke qu'un `sessionId` et sert de fenêtre dessus (`src/core/schemas/blocks/sessionLog.ts`). Pas de vrai sélecteur de séance — cohérent avec la limite déjà posée dans `src/server/services/sessions.ts` (« aucune interface de gestion de séance n'existe encore ») : le bloc s'attache tout seul, une fois, à la séance en cours de la campagne du monde (`attachSessionLogBlock`, route `POST /api/blocks/[blockId]/session-log/attach`, réutilise `getOrOpenSessionForCampaign`). Sans campagne active, le bloc reste vide plutôt que d'échouer.

Une fois attaché : zone de texte pour le résumé (sauvegardée à la perte de focus via `PATCH /api/sessions/[id]`, jamais par le mécanisme générique des blocs) et le fil des `session_events` de cette séance en lecture seule en dessous (`GET /api/sessions/[id]/events`), du plus ancien au plus récent.

**Vérifié en direct** (fiche de Candide Fausset, même monde que le test du bloc quête) : création du bloc → rattachement automatique confirmé par requête réseau → le journal affiché reprend fidèlement les vrais `session_events` de la session, **y compris la ligne « Objectif coché » écrite quelques minutes plus tôt en testant `quest`** — même séance, deux blocs différents, un seul journal. Résumé tapé, sauvegardé au blur, confirmé après rechargement complet de la page. Bloc de test et résumé nettoyés après vérification (la séance touchée est la vraie séance en cours de la campagne de l'utilisateur, pas une séance jetable).

**Hors périmètre, explicitement** : pas de rendu public pour `session_log` (comme `character`/`inventory`/`music`, seul le titre s'affiche sur le wiki public, `PublicBlockView.tsx`) — un journal de séance est un outil de suivi de partie, pas du contenu de lore destiné aux joueurs.

### Retouches post-H1/H2 (retour utilisateur, 7 points) — fait

*Sept demandes groupées avant de passer à Lot I, toutes issues de l'usage réel des blocs psyché/relations/réseau/généalogie.*

1. **Bouton œil sur les bulles de relation** (`RelationsChips.tsx`) — bascule binaire public/MJ, réutilise `changeRelationVisibility` (déjà écrit pour le réseau, V2-H1 phase 5). Placé en PREMIER dans la bulle (avant le libellé et le lien), pas juste avant le « × » — retour utilisateur après un premier essai : trop près du bouton de suppression, missclicks.
2. **Visibilité générale de fiche** — migration `entities.is_public` (défaut `true`, jamais de masquage rétroactif d'un contenu déjà publié ; toute fiche NOUVELLE naît masquée, un seul choke point dans `createEntity`). Bouton œil à côté du sélecteur de type (`EditEntityForm.tsx`). Filtré côté wiki public partout où une entité peut apparaître : liste/arbre (`getPublicEntityTree`), page (`getPublicEntityDetail` renvoie `null`, même traitement qu'un lien de partage invalide), relations (`toPublicRelations`), généalogie et réseau (`getFamilyTree`/`getRelationsGraph` — filtrent aussi les ARÊTES qui touchent une entité masquée, pas seulement la liste, sinon `buildFamilyTree`/`buildRelationsGraph` plantent sur une arête sans nœud), cible d'un bloc `relationship`, références de quête/chronologie.
3. **Généalogie multi-parents** — déjà supporté par le code (`parentsOf` est une map à valeurs tableau depuis l'origine) : vérifié en ajoutant temporairement une seconde relation `parent_of` sur une fiche réelle (Fine Lââm), l'arbre a bien affiché deux cartes parent côte à côte ; relation de test retirée après vérification. Aucun changement de code. En creusant, incohérence trouvée dans les données existantes de cette fiche (relations `parent_of`/`sibling_of` qui contredisent le texte narratif) — signalée à l'utilisateur, pas corrigée (contenu narratif, pas un bug).
4. **Suppression de l'avertissement de confirmation** sur un gros changement de pôle (`CONFIRMATION_THRESHOLD`, `psyche.ts`) — retiré des trois routes d'événement et des trois tableaux de souvenirs MJ, plus gênant qu'utile.
5. **Visibilité par ligne de souvenir** — migration `personality_events.is_public`/`attitude_events.is_public` (défaut `false`, explicite). Bascule œil par ligne dans les trois tableaux (`Personality`/`Worldview`/`RelationshipEventTable.tsx`), filtrée AVANT la limite des 20 dernières entrées côté service (`listPoleEvents`/`getAttitudeEvents`), jamais après — sinon un souvenir récent masqué ferait perdre à tort un souvenir plus ancien mais public. Le wiki public affiche désormais un tableau de souvenirs sous chaque radar quand au moins une ligne est publique (`PublicSouvenirsTable.tsx`, nouveau) — section absente si aucune ligne publique, jamais un tableau vide qui révèle qu'il en existe de masquées.
6. **Infobulles au survol des pôles** — une phrase par pôle (`PERSONALITY_POLE_DESCRIPTIONS_FR`/`RELATIONSHIP_AXIS_DESCRIPTIONS_FR`/`WORLDVIEW_POLE_DESCRIPTIONS_FR`, `src/i18n/fr.ts`), posée en `<title>` SVG natif sur le libellé du radar (partagé MJ/public, un seul point d'ajout) et en `title` HTML sur la ligne de curseur côté MJ.
7. **Survol d'un lien du réseau** — `RelationsGraphCanvas.tsx` distingue désormais survol et épinglage (`hoveredEdgeId` vs `pinnedEdgeId`) : le libellé et la surbrillance des deux nœuds apparaissent déjà au survol, le bouton de masquage du lien reste réservé au clic (épinglé). Même composant, donc même comportement sur le wiki public.

**Vérifié en direct** (Fine Lââm, Ceinture de Kor'nok, Candide Fausset) : chaque bascule testée en la posant puis en confirmant l'effet sur `/apercu`, puis retirée pour ne rien laisser en place qui ne corresponde pas à un vrai choix de l'utilisateur. `typecheck`/`lint`/`test` verts (725/727, 1 ignoré, 1 à faire) après chaque lot de changements.

---

## Lot I — Les cartes

*Le plus gros morceau visuel de la V2. Repris et affiné le 1er sept. avec des captures d'un outil de référence — voir ADR 0017 pour les trois décisions structurantes (bloc propriétaire/référent, visibilité d'élément ET de couche, activation de `assets`).*

### Décisions de conception

**Image d'abord, procédural jamais — ou beaucoup plus tard.** Le PDD évoque la génération procédurale (simplex-noise, Voronoï). C'est un projet en soi, et une carte téléversée couvre 95 % du besoin réel. Le procédural reste une idée future, pas un ticket.

**Coordonnées normalisées, jamais des pixels.** Punaise et sommets de polygone se stockent en 0–1 relatif à l'image.

**Punaise et zone sont des références,** réutilisant `BlockReference` (`src/core/schemas/blocks/reference.ts`) — MAIS le nom affiché est un champ texte libre et indépendant du lien (retour utilisateur explicite) : nommer une punaise « Auberge du Cerf Bleu » sans la lier à aucune fiche reste un cas normal, pas une punaise à moitié remplie.

**N'importe quelle fiche peut porter un bloc `map`**, pas seulement `location` (retour utilisateur — révise le brouillon initial de ce ticket).

**Bloc propriétaire OU référent** (ADR 0017, décision 1) — jamais un bloc qui duplique l'image/les punaises d'un autre.

**Visibilité d'un élément ET de sa couche** (ADR 0017, décision 2) — une couche a sa propre `visibility_level`, appliquée en plus de celle de chaque punaise/zone qu'elle contient, jamais à sa place.

**`assets` (Storage) active maintenant**, pas `entity_portraits` (bytea) — ADR 0017, décision 3. `entity_portraits` migre vers la même interface dans un second temps séparé (phase F), une fois le nouveau chemin éprouvé sur les cartes.

**Cartes imbriquées via un clic, pas un second mécanisme.** Une punaise liée à un lieu qui porte lui-même un bloc `map` navigue simplement vers sa fiche (comportement déjà standard d'une punaise liée) — la fiche affiche alors sa propre carte. Rien à construire en plus.

**Le brouillard (V2-I2) est une découverte, pas un calque de dessin** — reporté après V2-I1, dépend des régions qui n'existent pas encore.

### V2-I1 — Carte, punaises, zones, couches · `L`

Découpé en phases pour rester traçable d'une session à l'autre — cocher au fur et à mesure, jamais tout d'un coup.

**Phase A — Interface de stockage (`assets`), bloque tout le reste — ✅ faite, commit `30ec9ff`**
- [x] Bucket Supabase Storage créé par migration (`insert into storage.buckets`), jamais à la main dans le tableau de bord.
- [x] `src/server/services/storage.ts` : interface `uploadAsset`/`getSignedAssetUrl`/`deleteAsset` (CLAUDE.md règle 16 bis — jamais un appel Storage direct depuis un composant ou une route).
- [x] Route d'upload (`POST /api/worlds/[worldSlug]/assets`, type MIME + taille bornés) qui écrit dans `assets` + le bucket.
- [x] Route de service (`GET /api/assets/[id]`, redirige vers une URL signée) qui vérifie `visibility_level` côté serveur avant — jamais un bucket public qui court-circuiterait la visibilité. `DELETE /api/assets/[id]` au passage.
- [ ] Vignette générée à l'upload, servie avant la pleine résolution — `uploadAsset` accepte déjà `maxDimension` (redimensionnement serveur via `sharp`), mais la composition "vignette + plein format, deux assets" n'est câblée qu'en Phase B (c'est elle qui en a besoin).
- Vérifié en direct : cycle upload → lecture → suppression complet, avec un vrai fichier dans le bucket.

**Phase B — Bloc `map` propriétaire, image seule — ✅ faite, commit à suivre**
- [x] Schéma du bloc `map` (`src/core/schemas/blocks/map.ts`) : `mode: "own" | "ref"`, `assetId`/`thumbnailAssetId` (own), `sourceBlockId` (ref, pas encore câblé côté UI), `defaultView: {x, y, zoom}`. Enregistré dans `registry.ts`/`envelope.ts` (type "map" au catalogue).
- [x] Téléversement (deux variantes par image : vignette 800px + plein format plafonné 4096px), aperçu intégré dans la fiche (`MapBlockEditor.tsx`) et rendu public/joueur (`PublicMapBlock.tsx`, `PublicBlockView.tsx`).
- [x] Vue agrandie : **écart au plan** — une superposition plein écran en page (modale), pas une vraie fenêtre flottante `WindowsDesktop`/`?avec=`. Choix délibéré pour ne pas étendre le système `WindowRef` (entité/règle/outil MJ) à un 4e type juste pour ce sous-bloc ; à revoir si on veut vraiment plusieurs cartes ouvertes côte à côte comme les captures de référence.
- [x] Zoom/pan : ctrl+molette + glisser, `MapCanvas.tsx` — même convention que `FamilyTreeCanvas`/`RelationsGraphCanvas`/`TimelineAxis`.
- [x] Bouton "Définir cette vue par défaut" dans la vue agrandie (persiste le cadrage courant).
- Vérifié en direct : ajout du bloc, téléversement, aperçu, agrandissement, zoom (ctrl+molette confirmé, molette seule non capturée), sauvegarde du cadrage par défaut — cycle complet avec une vraie image.

**Phase B² — Vue « Cartes » agrégée — première version (ajout, retour utilisateur : "un endroit où je puisse travailler et où [je] pourrais voir la/les cartes en grand") — ⚠️ remplacée par B³ ci-dessous, jamais poussée en l'état**
- Premier essai : page dédiée `/m/[worldSlug]/cartes` + `services/maps.ts` (`getWorldMaps`) listant tous les blocs `map` du monde, quelle que soit l'entité qui les porte. Abandonné avant commit final : le retour utilisateur suivant a clarifié qu'une carte devait être une **fiche à part entière** dans l'arborescence (comme Lieu/Faction), pas une liste séparée agrégée par un service dédié — voir Phase B³.
- [x] **Bug découvert en test live pendant cet essai, et resté valide après le remplacement** : la modale de `MapBlockEditor` (vue agrandie d'un bloc `map` sur une fiche quelconque) est un descendant DOM du conteneur du bloc, donc la fermer (croix, clic sur la trame, navigation) ne déclenche jamais de manière fiable le blur du conteneur dont dépend la sauvegarde habituelle (`handleBlockBlur`) — un téléversement s'affichait à l'écran mais n'était jamais persisté. Corrigé en réutilisant le mécanisme de surcharge déjà en place pour la visibilité (`onSaveBlock` avec `data` en surcharge) : prop `onSaveNow` filé `EntityBlocks.tsx` → `BlockDataEditor` → `MapBlockEditor` → `MapWorkspace`, appelé immédiatement après `onChange` pour le téléversement et « Définir cette vue par défaut ». Toujours en place, utile pour un bloc `map` posé sur n'importe quelle fiche (pas seulement une fiche `carte`, voir B³).

**Phase B³ — « Carte » comme type d'entité à part entière (retour utilisateur : "je voyais la catégorie de la même manière que les autres (PJ, PNJ, etc..)... une fiche fenêtre avec la carte en grand et les outils pour la modifier en bas... je peux mettre n'importe quelle fiche carte dans les blocs de carte qui se trouvent dans les autres fiches") — ✅ faite, commit à suivre**
- [x] `carte` ajouté à `ENTITY_KINDS` (`lib/entities/schemas.ts`) — apparaît dans le sélecteur de type comme Personnage/Lieu/Faction, et donc automatiquement comme catégorie « Cartes » dans l'arborescence (`buildEntityTree` groupe déjà par `entity_kind`, aucune infrastructure de catégorie à ajouter — même mécanisme que "NOTES").
- [x] `ensureMapBlock` (`src/server/services/entities.ts`, appelée depuis `updateEntity`) : dès que le type d'une fiche passe à "carte", un bloc `map` (mode "own", visibilité publique par défaut) est créé côté serveur si absent — idempotent, jamais deux blocs.
- [x] `EditEntityForm.tsx` : branche dédiée quand `entityKind === "carte"` — remplace tout le chrome habituel (portrait, alias, relations, liste de blocs générique) par un bandeau minimal (nom, œil de visibilité publique, sélecteur de type) au-dessus de `CarteMapPanel` (nouveau, `components/entities/map/CarteMapPanel.tsx`), qui affiche `MapWorkspace` en plein format avec son propre sélecteur de visibilité de bloc. Le bandeau minimal (plutôt que zéro chrome) est un écart volontaire au retour utilisateur : renommer/rendre public/changer de type n'ont aucune autre porte d'entrée dans l'appli (le titre de fenêtre n'est qu'un affichage), les retirer aurait été un vrai recul fonctionnel plutôt qu'une simplification.
- [x] Page d'agrégation `/m/[worldSlug]/cartes` (B² ci-dessus) et lien de sidebar dédié **supprimés** — l'arborescence normale remplit déjà ce rôle une fois les cartes devenues des fiches.
- Vérifié en direct : création d'une fiche, changement de type vers "Carte" (bloc `map` apparaît automatiquement, vue passe en plein canevas), téléversement (JPEG), catégorie "CARTES" dans la barre latérale MJ, persistance après rechargement, aperçu public (`/apercu/[slug]`) avec la catégorie et le badge de type corrects.
- [x] Mode "référence" du bloc `map` — voir Phase F₁ plus bas, faite depuis.
- **Bug découvert en test live, hors périmètre de ce lot** : `DELETE /api/entities/[id]` échoue systématiquement en 500 ("new row violates row-level security policy for table entities", `softDeleteEntity`) pour ce compte MJ, y compris sur une fiche `other` toute neuve sans bloc — reproductible, mais les mises à jour normales (renommer, changer de type, bascule publique) sur la MÊME fiche réussissent (200 OK) via la même politique RLS `entities_update`. Pas causé par ce lot (reproduit sur une fiche `other`) ; signalé séparément pour investigation.

**Phase C — Punaises — ✅ faite, commit à suivre**
- [x] Table `map_pins` (`block_id`, `x`, `y` numeric normalisés 0-1, `label` texte libre, `ref` jsonb `{kind:"entity", id}` nullable — restreint à une fiche, jamais une règle, contrairement à `BlockReference` : le retour utilisateur ne parlait que de fiches — `size` small/medium/large, `layer_id` nullable sans contrainte de clé étrangère pour l'instant (Phase E l'ajoutera dans une nouvelle migration), `visibility_level`/`visibility_scope_id`, RLS via `app.block_entity_id`/`app.can_edit_entity`/`app.visibility_permits` — même discipline que `blocks`).
- [x] Outil « + Punaise » dans la barre d'outils de `MapWorkspace.tsx` (own mode uniquement — les punaises appartiennent au bloc propriétaire, jamais éditées depuis une référence) : clic sur le fond de la carte pose une punaise à cet endroit et ouvre directement son popup.
- [x] Popup punaise (`MapPinEditorPopup.tsx`) : nom libre et lien vers une fiche existante indépendants l'un de l'autre (retour utilisateur, point 1 — même sélecteur que `RelationsChips.tsx`, `otherEntities`), taille, visibilité, suppression. Couche différée à la Phase E (le champ `layer_id` existe déjà en base).
- [x] Icône = portrait de la fiche liée quand il y en a une (`MapPinMarker.tsx`, même repli "initiale en attendant" que `RelationsGraphNodeCard.tsx`), simple point neutre sinon.
- [x] Clic sur une punaise liée navigue vers la fiche — en lecture seule uniquement (`MapRefPanel.tsx`, `PublicMapBlock.tsx`) ; en édition (`MapWorkspace.tsx`) un clic ouvre plutôt le popup, cohérent avec "cliquer modifie, jamais un aller-retour involontaire".
- [x] Résolution serveur : `listVisibleMapPins` (`src/server/services/mapPins.ts`) filtre par visibilité et résout `ref` en `{name, slug}` (jamais l'id brut si la fiche liée n'est plus visible) — même discipline que `resolveMapSource`/`questRefs`. Un bloc "ref" reçoit les punaises du bloc SOURCE (ADR 0017 décision 1), résolu côté serveur pour le wiki public/joueur (`publicShare.ts`/`playerEntityDetail.ts`), via une route authentifiée dédiée pour l'éditeur MJ (`GET /api/blocks/[blockId]/pins`).
- Portée volontairement bornée : les punaises n'apparaissent que dans les vues agrandies (`MapWorkspace`, `MapRefPanel`, la modale "Agrandir" de `PublicMapBlock`), jamais dans l'aperçu replié (juste l'image, comme avant) — cohérent avec la vignette qui reste un simple teaser.
- Vérifié en direct : punaise posée sur la fiche `carte` "Faerûn", liée à "Fine Lââm", visible et persistante après rechargement en mode propriétaire ET en mode référence (bloc `map` de Fine Lââm), rendue côté aperçu public (`/apercu`) avec son icône (portrait).

**Phase D — Zones — ✅ faite, commit à suivre**
- [x] Table `map_regions` (`block_id`, `name`, `ref` jsonb `{kind:"entity", id}` — type partagé avec `map_pins`, renommé `MapElementRef`/`zMapElementRef` (`src/core/schemas/mapElementRef.ts`) au moment où un 2ᵉ consommateur en avait besoin —, `shape` jsonb (liste ordonnée de sommets normalisés 0-1), `fill_color`/`border_color` (deux colonnes texte `#RRGGBB` plutôt qu'un objet, retour utilisateur "remplissage + contour"), `layer_id` nullable sans FK pour l'instant (Phase E), `visibility_level`/`visibility_scope_id`, RLS — même discipline exacte que `map_pins` (migration 20260902090001_map_regions.sql, réutilise `app.block_entity_id` déjà créé).
- [x] Outil « + Zone » dans `MapWorkspace.tsx` (own mode uniquement, mutuellement exclusif avec l'outil punaise) : clic ajoute un sommet (rendu en direct — sommets + trait pointillé). Revenir cliquer sur le premier sommet posé (rayon de 10px écran, `CLOSE_REGION_HIT_RADIUS` dans `MapCanvas.tsx`, dès 3 sommets ou plus — rendu en anneau plus visible comme indice) ferme et valide le polygone, plutôt qu'un double-clic (retour utilisateur, changement demandé avant la Phase E). Moins de 3 sommets : tracé abandonné en silence.
- [x] Popup zone (`MapRegionEditorPopup.tsx`) : nom libre et lien indépendants (même sélecteur `otherEntities` que les punaises), couleurs de remplissage/contour (`<input type="color">`), visibilité, suppression. Couche différée à la Phase E.
- [x] Rendu : polygone SVG superposé au canevas (`MapCanvas.tsx`, mêmes coordonnées écran que les punaises), jamais éditable depuis une référence — mêmes règles ADR 0017 decision 1 que les punaises (`listVisibleMapRegions`, résolution serveur unique, réutilisée par l'éditeur MJ, le wiki public et la fiche joueur). Clic sur une zone liée navigue vers la fiche en lecture seule, ouvre l'éditeur en mode propriétaire.
- Vérifié en direct : zone tracée sur "Faerûn", liée à "Naivara Amakiir", couleurs et forme persistantes après rechargement, visible (couleurs correctes) sur le bloc référent de Fine Lââm.

**Phase E — Couches — ✅ faite, commit à suivre**
- [x] Table `map_layers` (`block_id`, `name`, `display_order` numeric — même motif de réordonnancement que `EntityBlocks.tsx`, midpoint entre voisins ou ±1000 en bout de liste, jamais d'endpoint "swap" dédié —, `visibility_level`/`visibility_scope_id`, RLS via `app.block_entity_id` déjà créé en Phase C — migration `20260902100001_map_layers.sql`), plus la contrainte de clé étrangère différée `map_pins.layer_id`/`map_regions.layer_id` → `map_layers(id) on delete set null` (une couche est organisationnelle, jamais structurale : la supprimer détache ses éléments, ne les supprime jamais).
- [x] `MapLayersPanel.tsx` : créer/nommer (saisie au blur, même convention que le titre d'un bloc)/réordonner (▲/▼)/changer la visibilité/supprimer une couche ; dropdown "Couche" ajouté aux popups punaise et zone (`MapPinEditorPopup.tsx`/`MapRegionEditorPopup.tsx`), même sélecteur que "Lien vers une fiche".
- [x] Bascule afficher/masquer une couche entière côté MJ (`hiddenLayerIds` dans `MapWorkspace.tsx`, état local jamais persisté, jamais un filtre de sécurité — confort d'édition seulement, voir décision "visibilité ET" plus haut : la visibilité réelle passe par `visibility_level`, résolue côté serveur).
- [x] Filtrage serveur : un viewer ne reçoit un élément que si `canSee(élément)` ET `canSee(sa couche)` (`layerAllows`/`resolveLayerVisibilityByBlock` dans `src/server/services/mapLayers.ts`, appliqué dans `listVisibleMapPins`/`listVisibleMapRegions` — jamais réimplémenté par appelant, y compris pour le mode "ref" qui réutilise ces mêmes fonctions).
- Vérifié en direct : couche "Secrets MJ" créée sur "Faerûn", punaise assignée depuis sa popup, bascule de visibilité de la couche vers "MJ uniquement", bascule afficher/masquer côté édition qui retire la punaise du canevas MJ sans toucher sa visibilité réelle, suppression de la couche qui détache la punaise (`layerId` repasse à `null`, punaise conservée) plutôt que de la supprimer.

**Phase F₁ — Mode référent (carte partagée, vue différente) — ✅ faite, commit à suivre**
- [x] `CartePicker.tsx` : liste les fiches `carte` du monde (`GET /api/worlds/[worldSlug]/cartes`, `listCarteOptions`) — choisir une carte bascule le bloc en `{mode:"ref", sourceBlockId, defaultView par défaut}`, un bouton "Téléverser ma propre image à la place" fait le chemin inverse. Cadrage remis à zéro à chaque changement de carte référencée (les coordonnées normalisées de l'ancien cadrage n'ont aucun sens sur une autre image).
- [x] Résolution serveur (`src/server/services/mapSource.ts`, `resolveMapSource`) : un bloc "ref" ne transporte jamais son image, seulement `sourceBlockId` — la visibilité du bloc SOURCE est revérifiée pour le viewer courant à chaque affichage (`canSee`), jamais supposée acquise parce que le bloc référent lui-même est visible. Même fonction pour les trois contextes de rendu (éditeur MJ via `GET /api/blocks/[blockId]/map-source`, `getPlayerEntityDetail`, `getPublicEntityDetail`) — jamais réimplémentée par appelant, même discipline que `getFamilyTree`/`getRelationsGraph`.
- [x] `MapRefPanel.tsx` (édition/MJ) et `PublicMapBlock.tsx` (lecture seule, mode "ref") : mêmes `MapCanvas`/`Définir cette vue par défaut` que le mode "own", juste sourcés depuis l'image résolue plutôt que le bloc lui-même.
- [x] Mêmes punaises/zones/couches que le bloc source : `publicShare.ts`/`playerEntityDetail.ts` appellent `listVisibleMapPins`/`listVisibleMapRegions` avec `sourceBlockId` plutôt que `block.id` pour un bloc "ref" — la règle "visibilité ET couche" s'applique automatiquement, sans code supplémentaire (même fonction que le mode "own").
- Vérifié en direct : bloc `map` de Fine Lââm basculé en référence vers la fiche `carte` "Faerûn" (la vraie carte téléversée par l'utilisateur), cadrage personnalisé défini puis persistant après rechargement, retour en mode "own", et rendu correct sur l'aperçu public (`/apercu/[slug]`).

**Phase F₂ — Migration de `entity_portraits` vers `assets` (séparée, en tout dernier) — ✅ faite**
- [x] Upload de portrait réécrit pour passer par `storage.ts` (`uploadEntityPortrait`/`removeEntityPortrait` dans `src/server/services/entityPortraits.ts` appellent `uploadAsset`/`deleteAsset`, mêmes redimensionnement/encodage webp que les cartes — juste une borne 5 Mo/640px propre au portrait). Le pointeur (quelle fiche a quel asset) vit dans `entity_assets` (`role='portrait'`, prévue depuis la migration 011 mais jamais câblée jusqu'ici) plutôt qu'un nouveau `entity_portraits.asset_id` — un remplacement supprime puis réinsère la ligne (l'`asset_id` change à chaque televersement), un index unique partiel (`entity_assets_one_portrait`) garantit un seul portrait par fiche. `GET /api/entities/[id]/portrait` redirige maintenant vers une URL signée (même motif que `/api/assets/[id]`) plutôt que de streamer du bytea — URL publique inchangée, aucun consommateur (`PortraitUpload.tsx`, `PublicPortrait.tsx`, `FamilyTreeCard.tsx`, etc.) n'a eu besoin d'être modifié.
- [x] **Bug de sécurité découvert en préparant cette phase, corrigé avant de migrer quoi que ce soit** : `assets_select`/`assets_bucket_select` (RLS) exigeaient `is_world_member` même pour un asset `visibility_level='public'`, alors que `app.visibility_permits` traite déjà ce cas comme "vrai pour tout le monde, y compris anonyme" — un visiteur vraiment anonyme d'un lien de partage (`/partage/[token]`) recevait donc un 404 sur toute image (carte ou, bientôt, portrait). Corrigé par une politique additive (`visibility_level = 'public' OR (is_world_member AND visibility_permits)`, jamais un relâchement de l'existant) sur `assets` et sur `storage.objects` — puis, décollant un second problème révélé par le premier, `app.is_world_member`/`app.visibility_permits`/`app.entity_world_id` étaient carrément interdites d'exécution au rôle `anon` (`revoke ... from public; grant ... to authenticated` seulement) : une politique RLS qui référence une fonction non-exécutable par le rôle appelant fait échouer TOUTE la requête, même si une autre branche/politique aurait suffi — jamais un simple court-circuit silencieux. Trois migrations (`20260902110001`, `20260902130001`, `20260902130002`) plutôt qu'une : chaque couche du problème n'a été découverte qu'en testant la précédente avec un vrai client anonyme (clé publique, aucune session — voir la méthode de vérification ci-dessous). Corrige au passage un bug préexistant, non lié à cette phase, jamais détecté car aucune vérification precedente du Lot I ne s'était faite depuis un navigateur vraiment déconnecté (toujours `/apercu`, jamais `/partage`).
- [x] Migration de données : `scripts/migrate-entity-portraits.ts` (`npm run migrate:entity-portraits -- --write`, service_role, simulation par défaut sans `--write`) copie les octets existants TELS QUELS (déjà redimensionnés/encodés en webp par l'ancien pipeline — jamais une re-compression) vers le bucket + une ligne `assets` + une ligne `entity_assets`. Idempotent (ignore toute fiche déjà migrée). Les 11 portraits existants du monde de test migrés avec succès.
- [x] `entity_portraits` retirée (migration `20260902140001_drop_entity_portraits.sql`) une fois la bascule vérifiée en direct : plusieurs portraits migrés confirmés affichés dans l'app réelle, televersement/remplacement/suppression/mise en page retestés intégralement contre les nouvelles routes (y compris le nettoyage de l'ancien asset au remplacement — plus aucune ligne orpheline), et l'accès anonyme confirmé de bout en bout (client sans session, clé publique) jusqu'aux octets réels du fichier.

**Critères (V2-I1, valables sur l'ensemble des phases)**
- [ ] Les punaises/sommets sont en coordonnées normalisées ; remplacer l'image par une version plus grande ne les décale pas.
- [ ] Une punaise/zone `gm`, ou rattachée à une couche `gm`, est absente de la réponse pour un joueur — jamais masquée en CSS.
- [ ] Une punaise vers un lieu portant lui-même une carte ouvre cette carte (clic standard, aucun mécanisme dédié).
- [ ] Une carte de 4000 px s'affiche sans bloquer l'interface — vignette d'abord, pleine résolution ensuite.

### V2-I2 — Brouillard par campagne · `M`

```sql
create table map_region_reveals (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  region_id   uuid not null references map_regions(id) on delete cascade,
  revealed_at timestamptz not null default now(),
  primary key (campaign_id, region_id)
);
```

- [x] Le MJ trace des régions (réutilise `map_regions` de V2-I1) ; il les révèle en cours de partie, par campagne.
- [x] Une région non révélée est **absente de la réponse serveur**, pas masquée en CSS.
- [x] Révéler écrit un `session_event`.

**Décision d'architecture prise avant le code** (retour utilisateur, 2 septembre) : le brouillard est **opt-in par zone**, jamais rétroactif sur toutes les zones existantes. Pris au pied de la lettre, le critère "absente tant que non révélée" aurait caché aux joueurs, sans avertissement, toutes les zones déjà tracées et publiques dans les mondes existants (la zone "Amn" sur Faerûn, trouvée en vérifiant le bug de zone ci-dessus, en est l'exemple qui a motivé la question). Une nouvelle colonne `map_regions.fog_gated` (`false` par défaut) distingue donc une zone normale (comportement inchangé) d'une zone "de découverte".

**Fait** — Deux migrations : `20260902180001_map_regions_fog_gated.sql` (colonne `fog_gated`) et `20260902180002_map_region_reveals.sql` (table `map_region_reveals`, exactement le SQL ci-dessus, RLS lecture = tout membre du monde, écriture = `app.is_world_admin` seul, même garde que `entity_grants_write`). Types régénérés (`supabase gen types typescript --project-id fivakjqzqgfvfpaqvqex`).

`listVisibleMapRegions` (`src/server/services/mapRegions.ts`) accepte désormais un `campaignId` optionnel : une zone `fog_gated` n'atteint un viewer non-MJ (`isAdminViewer`) que si `map_region_reveals` porte une ligne pour `(campaignId, regionId)` — le MJ voit toujours tout, brouillard ou pas, le brouillard cache aux joueurs seulement. `campaignId` se résout via `resolveCampaignId(worldId)` ("un monde = une campagne active", `campaigns_world_id_unique`) dans les cinq points d'entrée qui listent des zones : la route MJ (`GET /api/blocks/[blockId]/regions`), `publicShare.ts` et `playerEntityDetail.ts` (deux appels chacun, mode "own" et "ref").

Nouveau service `src/server/services/mapRegionReveals.ts` (`revealMapRegion`) : geste de MJ (`canUserEditEntityById`, même garde que les autres mutations de zone), idempotent (`isRegionRevealed` vérifié avant d'insérer — recliquer sur une zone déjà révélée ne journalise pas un second événement), ouvre/réutilise la session courante de la campagne (`getOrOpenSessionForCampaign`, même motif que `quests.ts`) et écrit un `session_event` (`kind: "world_update"`, note "Zone révélée aux joueurs : <nom>"). Route `POST /api/map-regions/[regionId]/reveal`.

UI dans `MapRegionEditorPopup.tsx` : case à cocher "Soumise au brouillard", puis (une fois la zone enregistrée) son statut — "Cachée aux joueurs." avec un bouton "Révéler", ou "Révélée aux joueurs." Indicateur visuel pour le MJ (`MapCanvas.tsx`, `strokeDasharray`) : contour en pointillés pour une zone `fogGated` pas encore révélée, partout où le MJ voit la carte (`MapWorkspace`, `MapRefPanel`, l'aperçu replié de `MapBlockEditor.tsx`) — jamais transmis à un viewer joueur/public, qui ne reçoit de toute façon jamais la zone tant qu'elle n'est pas révélée.

**Vérifié en direct** (monde Faerûn/La Croisade des Ombres) : zone triangle tracée sur la carte "Faerûn" avec "Soumise au brouillard" coché → contour en pointillés côté MJ, absente du HTML de l'aperçu public anonyme (`document.body.innerHTML` ne contient pas son nom, pas juste masquée en CSS) → clic sur "Révéler" → contour plein côté MJ, apparaît immédiatement dans l'aperçu public, ET la ligne "Mise à jour du monde — Zone révélée aux joueurs : Zone test brouillard" apparaît en tête du Journal d'historique. Zone de test supprimée après vérification.

`npm run typecheck && npm run lint && npm run test:core` (700 tests) passent ; suites d'intégration touchées (`resolvedRuleset`, `characterActions`, `publicShare`, `rules.homebrewReference`) passent en lot restreint — la suite `src/server` complète échoue par intermittence sous charge (connexions concurrentes vers la base de dev distante partagée), y compris sur des fichiers jamais touchés par ce ticket (`campaigns.integration.test.ts` échoue sur `world_has_slug`, `entities.ts`, du code que ce ticket ne touche pas) : environnemental, pas une régression de ce travail.

---

## Lot J — Génération assistée et confort

*Nécessite le lot F de la V1. Le contenu de ce lot dépend du verdict de S1.*

### V2-J1 — Les emplacements en prose des générateurs · `M` — Phase 1 faite

Le lot E de la V1 a écrit les générateurs avec leurs emplacements de prose **laissés vides**. Ce ticket les remplit.

**Retour utilisateur (3 septembre)** : captures d'écran de deux outils de référence en cours de route — l'utilisateur préfère un style "Maisons Closes" (Dauricha & Orkish Blade) où la génération est **découpée en sections nommées**, chacune tirable et rejouable indépendamment (panneau "Détails des tirages", relance d'un seul emplacement), plutôt qu'un bloc de fiche produisant un paragraphe unique. Pivot acté : le mécanisme vit désormais dans un **outil MJ autonome** ("Générateurs", sidebar MJ), jamais attaché à une fiche de wiki. Structure et mécanique reproduites (jamais le texte des outils de référence — droit d'auteur).

**Phase 1 entièrement faite** (mécanisme + Taverne complète — les trois sections, y compris l'emplacement `prose`) :
- [x] `GeneratorResult` expose `die`/`rolled` par emplacement `table` — panneau "Détails des tirages".
- [x] `POST /api/blocks/[blockId]/generate` accepte `onlySlotKey` : relance un seul emplacement, recompose le texte complet avec les autres valeurs (envoyées par le client, serveur toujours sans état).
- [x] Entité cachée `generateur` "Générateurs de MJ" auto-provisionnée par monde (visibilité `gm`, jamais vue des joueurs) — une section = un bloc `generator`, retrouvé par sa clé technique (`GeneratorData.key`).
- [x] Outil MJ "Générateurs" (sidebar, fenêtre flottante, page dédiée `/mj/generateurs`) — `GeneratorToolPanel.tsx` : un onglet par outil (registre `src/core/generators/tools.ts`), une carte par section (Tirer / Détails des tirages / relance individuelle / Copier).
- [x] Description de taverne (emplacement `prose`, sur "L'établissement") — câblée et vérifiée : sans fournisseur d'IA actif, l'emplacement reste vide et le texte de section se recompose proprement (jamais de `{description}` littéral), le reste du tirage (table) fonctionne à l'identique.
- [x] Les trois sections Taverne sont câblées avec du contenu réel : "Nom de l'établissement" (table `noms-tavernes`), "L'établissement" (`ambiances-tavernes` + `patrons-tavernes` + description en prose), "La Chambre" (`mobilier-chambres` + `particularites-chambres`) — 2 entrées d'exemple par table, à l'utilisateur d'en écrire davantage.
- [x] Les noms à jeu de mots viennent de **tables écrites à la main**, jamais d'une génération libre.
- [x] Les 3 boutons preset ajoutés aux fiches avant le pivot ont été retirés (`EntityBlocks.tsx`) — plus aucun générateur prêt-à-l'emploi sur une fiche, le bloc `generator` générique y reste pour un usage ponctuel.

**Pas encore fait** (phases suivantes, même moteur, mécanisme inchangé) :
- [ ] Outils Échoppe / PNJ / Noms — réutilisation directe du registre (`src/core/generators/tools.ts`) et de la même méthode de saisie, aucun changement de moteur prévu.
- [ ] Prix à fourchette (boissons/repas), sourcing d'objets d'échoppe (règles/inventé/manuel) — hors périmètre de cette phase, à traiter une fois le mécanisme éprouvé en usage réel.
- [ ] V2-J2 (promotion d'un résultat de générateur en fiche) reste un ticket séparé, pas commencé — voir sa propre entrée plus bas.

**Vérifié en direct** (monde Faerûn/Campagne test) : les trois sections tirées avec leur vrai contenu — "Nom de l'établissement" (d20 → 6/17/20 selon relance, *L'Auberge du Cerf Bleu*/*La Rose Écarlate*), "L'établissement" (ambiance d20 → 12 → *calme et feutrée...*, patron d20 → 11 → *une elfe taciturne...*, description vide proprement sans fournisseur IA), "La Chambre" (mobilier d20 → 2 → *un lit défoncé...*, particularité d20 → 19 → *un graffiti gratté...*) ; relance individuelle testée sur plusieurs emplacements (seul le jet relancé change, texte recomposé à chaque fois) ; bouton Copier fonctionnel. `npm run typecheck && npm run lint && npm run test:core` passent ; nouveaux tests d'intégration (`die`/`rolled` exposés, `onlySlotKey`) passent.

**Bug repéré en passant, hors périmètre** : `RandomTableBlockEditor.tsx`, bouton « + Ajouter un résultat » — la nouvelle entrée hérite d'une plage de largeur nulle (`min = max = ancien_max + 1`) au lieu de s'étendre jusqu'au nombre de faces du dé, ce qui rend la table invalide (aucune entrée ne couvre les résultats intermédiaires) tant qu'on ne corrige pas la plage à la main. Rencontré et contourné à répétition en saisissant le contenu Taverne cette session — pas corrigé ici pour ne pas élargir ce ticket.

### V2-J2 — Création d'une fiche par générateur · `M` — fait (mécanisme + Taverne)

- [x] **Mécanisme générique de promotion** (V1-E6) : nouveau `promoteToEntity` (`src/server/services/promotion.ts`) — crée une entité + un bloc `text` par emplacement fourni, texte en premier paragraphe. `promoteTimelineEntry` (`src/server/services/timeline.ts`) a été **refactorisé pour l'appeler** au lieu de sa propre séquence — un seul mécanisme, réellement partagé par deux consommateurs, pas un vœu pieux. Comportement de la promotion de chronologie vérifié identique avant/après (même entité `event`, même bloc "Description", même `ref` posé sur l'entrée).
- [x] **Références déjà liées** : les `refs` (`BlockReference`) portées par une entrée de table tirée sont résolues (`resolveBlockReferences`, ruleset+locale) puis embarquées comme des **noeuds `ref` inline** dans un second paragraphe "Références : " du bloc créé — le même mécanisme que les mentions du wiki, cliquable, jamais une ligne `relations` inventée (vocabulaire fermé, aucun type générique "mentionné" — deviner une sémantique aurait été pire que ne rien lier).
- [x] "Créer la fiche" dans l'outil MJ "Générateurs" (`GeneratorToolPanel.tsx`) : les résultats de toutes les sections actuellement tirées remontent au panneau, combinés en une entité (nom = section "Nom de l'établissement", un bloc par autre section) via `POST /api/worlds/[worldSlug]/mj/generateurs/[toolKey]/promote`. Nouveau champ `promote` sur `GeneratorToolConfig` (`src/core/generators/tools.ts`) — Taverne configurée (`entityKind: "location"`), Échoppe/PNJ/Noms en hériteront sans changement de mécanisme.
- [x] Bug réel trouvé et corrigé en vérifiant en direct : un `setState` appelé depuis l'intérieur d'un updater fonctionnel (`handleRerollSlot`) violait la règle React "jamais de setState pendant le rendu d'un autre composant" — visible uniquement en observant la console navigateur, pas au typecheck/lint. Corrigé en sortant le calcul de l'updater.
- [ ] "+ Nouvelle entité" n'a pas été touché — décision de portée : ce bouton datait d'avant le pivot de J1 (un générateur choisi à la création de fiche) ; depuis, un résultat se compose dans l'outil MJ, pas au moment de créer une fiche vide. L'option « modèle » (bibliothèque de gabarits) est une fonctionnalité disjointe, sans aucun précédent dans le code — jamais demandée explicitement, laissée hors périmètre.
- [ ] Secrets en visibilité `gm` — vise un emplacement `secret` par générateur (spec complète, jamais implémentée, `GeneratorSlot` n'a pas de visibilité par emplacement). Tant que ça n'existe pas, les blocs créés restent en visibilité `public` (une fiche de taverne inutilisable par les joueurs n'aurait aucun sens) ; `promoteTimelineEntry` garde sa propre règle (visibilité de l'entrée source).
- [ ] Promotion pour l'inventaire et les tables (au sens large, hors générateur) — le mécanisme générique le permettrait, mais aucun des deux n'a de bouton d'entrée aujourd'hui ; pas construit tant qu'aucun besoin concret ne l'exige (même discipline que le reste du projet).

**Vérifié en direct** (monde Faerûn/Campagne test) : ajout d'une référence réelle sur l'entrée "un nain jovial…" de `patrons-tavernes` (liée à "Le Poignard des Trois Silences", via le même PATCH que l'éditeur enverrait — pas d'UI dédiée pour ça encore, cf. `RandomTableBlockEditor.tsx`) ; tirage des trois sections Taverne, relance individuelle jusqu'à obtenir cette entrée, clic "Créer la fiche" → nouvelle fiche "La Rose Écarlate" (type Lieu, publique), bloc "L'établissement" avec le texte tiré ET la référence cliquable vers "Le Poignard des Trois Silences", bloc "La Chambre" avec son texte — aucune ligne `relations` créée (confirmé par requête directe). Promotion de chronologie testée sur une entrée jetable (créée puis supprimée après vérification) : résultat identique à avant le refactor. `npm run typecheck && npm run lint && npm run test:core` passent ; nouveaux tests d'intégration `promotion.integration.test.ts` (entité+bloc créés, références embarquées, emplacement vide omis) passent.

### V2-J3 — Assistant de préparation de séance · `M` — fait

- [x] Entité de type `session_prep` avec des blocs — **aucun second système de documents** : ajout cosmétique à `ENTITY_KINDS` (`lib/entities/schemas.ts`, déjà du texte libre côté schéma) + un libellé (`entityKindLabels.ts`), rien d'autre — une fiche `session_prep` est une fiche normale avec des blocs `text` normaux.
- [x] Bouton d'insertion de générateur dans l'éditeur — nouvelle section repliable "▸ Insérer un générateur" dans `TextBlockEditor.tsx` (même forme que "▸ Assistance IA" juste au-dessus, même mécanisme de remount ciblé pour afficher le résultat sans recharger la page — `RichTextEditor` est un éditeur Tiptap non contrôlé). Liste les sections de l'outil MJ "Générateurs" (`GET .../mj/generateurs/window`, déjà existant), tire (`POST /api/blocks/[blockId]/generate`, déjà existant) et ajoute le texte comme nouveau paragraphe (`PATCH /api/blocks/[blockId]`, déjà existant) — **aucune nouvelle route serveur**. Volontairement disponible sur TOUT bloc `text`, pas seulement les fiches `session_prep` (cohérent avec "vous avez déjà tout").
- [x] Feuille de style d'impression — déjà écrite (`app/globals.css`, `@media print`, précédent `CharacterSheetHeader.tsx`). Seul ajout : un bouton "Imprimer" dans l'en-tête de fiche, visible uniquement quand `entity_kind === "session_prep"`, `onClick={() => window.print()}`.

**Vérifié en direct** (monde Faerûn/Campagne test) : fiche `session_prep` créée, bloc Texte ajouté, "Insérer un générateur" → tirage de "Nom de l'établissement" → le paragraphe apparaît immédiatement sans rechargement, confirmé persistant après un vrai rechargement de page. Bouton "Imprimer" déclenche bien la boîte de dialogue d'impression native du navigateur (comportement bloquant confirmé — la seule preuve possible depuis l'automatisation, le contenu de la boîte de dialogue elle-même est hors DOM). Fiche de test supprimée après vérification. `npm run typecheck && npm run lint && npm run test:core` passent.

**Bug réel repéré en passant, hors périmètre** : la barre latérale d'un monde plante une clé React dupliquée (avertissement console) quand une entité porte le type fixe `generateur` ET qu'une autre porte une catégorie personnalisée nommée `generateur` (minuscule) — coïncidence de ce monde de test précisément, mais un vrai bug de génération de clé dans le regroupement par catégorie. Flagué comme tâche séparée, pas corrigé ici.

### V2-J4 — Import de règles au format JSON · `M` — fait

`arbitrage-modifications.md` §1.2.

**Contradiction trouvée en travaillant le ticket** : la spec affirmait que
l'export existait déjà en miroir de l'import — faux, le seul export de
ruleset existant (`worldExport.ts`, embarqué dans l'export de monde)
produit une forme diff (`ruleset_overrides` bruts), pas la forme
entrée/blocs que l'import accepte. Construit ici le vrai miroir qui
manquait plutôt que de le supposer acquis.

- [x] Import à notre format documenté, miroir exact de l'export — `GET
  /api/rulesets/[rulesetId]/export` (nouveau, `exportRulesetEntries`) et
  `POST /api/rulesets/import` (nouveau, `createRulesetFromImport`,
  distinct de `POST /api/rulesets/[rulesetId]/import` déjà existant qui
  continue d'ajouter dans la variante active, inchangé) échangent
  exactement la même forme `{name, baseSystem, entries}`.
- [x] Assistant de correspondance pour un format tiers —
  `components/rules/RulesetImportMappingDialog.tsx` : l'utilisateur associe
  un champ source au nom, un ou plusieurs champs à une description
  concaténée, un seul type de règle pour tout le lot. Un seul bloc
  `description` générique par entrée, jamais de blocs structurés devinés.
  Fonction pure testée d'abord (`src/core/ruleset/thirdPartyMapping.ts`,
  5 tests). Converge sur la même route serveur que l'import "notre
  format" — jamais un second chemin d'écriture.
- [x] Ruleset importé marqué `personal_reference` par défaut — réutilise
  `createRulesetVariant(..., personalReference: true)` déjà existant ;
  les verrous (triggers `forbid_share_personal_ruleset`/
  `forbid_personal_reference_downgrade`) existaient déjà en base, aucun
  code de restriction à écrire.
- [x] Aucune analyse automatique de PDF — position inchangée, rien construit.

**Vérifié en direct** : ajout d'une entrée homebrew réelle à une variante
`personal_reference` existante, export → JSON avec l'entrée correcte,
réimport via "Créer un nouveau ruleset personnel" → nouvelle variante
`content_origin: personal_reference` avec l'entrée identique. Bascule du
monde sur cette nouvelle variante puis tentative de créer un lien de
partage public : refusée par le trigger existant (confirmé dans les logs
serveur), preuve qu'il s'applique bien sans code neuf. Assistant de
correspondance testé avec un faux fichier tiers (3 enregistrements, 1 sans
titre) : 2 règles importées, le troisième correctement écarté. Rulesets et
entrées de test supprimés après vérification — sauf une entrée homebrew
d'exemple ("Dague de test V2-J4") laissée sur "Guide du MJ maison",
aucune route de suppression d'entrée individuelle n'existe (seulement la
suppression d'un ruleset entier), signalé au propriétaire plutôt que
retiré en douce. `npm run typecheck && npm run lint && npm run test:core`
passent (710 tests, dont les 5 nouveaux).

**Bug réel repéré en vérifiant, corrigé avant de considérer le ticket
fini** : la première version d'`exportRulesetEntries` lisait
`listRulesetEntries` (table `ruleset_entries`) — toujours vide pour une
variante homebrew, qui n'y matérialise jamais rien (réservé au contenu
officiel ingéré par `scripts/ingest-srd.ts`). Le contenu d'une variante
vit uniquement dans `ruleset_overrides`, résolu à la lecture — corrigé en
réutilisant `listEntryLevelOverridesForRuleset`/`applyOverrides`, le même
résolveur pur que `resolveEntryBlocksInRuleset`, scopé à ce seul niveau.

**Repéré en passant, hors périmètre, flagué séparément** : l'échec du
trigger de partage sur un ruleset `personal_reference` remonte comme un
crash de page brut plutôt qu'un message inline dans le panneau
Publication — un vrai gain d'UX, mais un ticket à part.

---

## Lot K — Refonte de la coquille : sidebar unifiée et fenêtres

*Née d'une demande explicite de restructuration de l'interface (2026-08-25). Indépendant de H/I/J — peut se glisser n'importe quand, mais mieux vaut finir le lot avant d'en ouvrir un autre : rouvrir la coquille deux fois coûte plus cher que de la faire d'un bloc.*

### Décisions de conception, à prendre avant d'écrire

**Adressage mixte d'une fenêtre.** `?avec=` ne portait jusqu'ici que des slugs d'entité. Afficher une fiche de règle et une fiche de monde dans le même espace de travail oblige à distinguer les deux types sans ambiguïté — préfixer (`?avec=entite:pont-de-pierre,regle:boule-de-feu`) plutôt que deviner le type en cherchant le slug dans les deux tables (plus lent, et ambigu si le même slug existe des deux côtés).

**Taille fixe des fenêtres : la valeur se choisit en la voyant, pas a priori.** Tester contre les blocs les plus denses (fiche de personnage jouable, inventaire, tableau de compétences) avant de figer un nombre dans le code.

### V2-K1 — Fenêtres partagées entre Monde et Règles · `L` — fait

Aujourd'hui `DesktopWindows`/`WindowFrame` (`components/shell/DesktopWindows.tsx`, `components/shell/WindowFrame.tsx`) ne vivent que sous la route `(monde)` : une fiche de règle (`/m/[worldSlug]/regles/[cle]`) s'affiche toujours en page pleine, jamais en fenêtre. C'est le verrou qui empêche d'afficher monde et règles en même temps — pas un manque de fonctionnalité de fenêtre, qui existe déjà (ADR-0006).

- [x] Remonter le gestionnaire de fenêtres au niveau de `app/m/[worldSlug]/layout.tsx`, partagé par Monde/Règles/MJ.
- [x] `?avec=` accepte des références mixtes (entité et entrée de règle — voir décision ci-dessus), chacune résolue par sa route API existante.
- [x] Ouvrir une fiche de règle depuis la vue Règles l'ajoute comme fenêtre, sans quitter la vue courante.
- [x] Changer de vue (Monde/Règles/MJ) ne ferme plus les fenêtres ouvertes.

**Préalable à K2 et K4** — ils supposent que les fenêtres survivent au changement de vue.

Fait — décision d'architecture (état partagé + rendu dupliqué par section, MJ non concerné) dans `docs/adr/0011-fenetres-partagees-monde-regles.md`. `DesktopWindows.tsx` scindé en `DesktopWindowsProvider.tsx` (état, monté une fois) et `WindowsDesktop.tsx` (rendu, monté par Monde et par Règles). Adressage mixte dans `components/shell/windowRefs.ts`. `RegisterPrimaryWindow`, `useOpenEntityLink`/`useOpenRuleLink` généralisés sur un `WindowRef`. Une fiche de règle partage désormais `RuleEntryView` entre son rendu serveur (fenêtre primaire) et sa récupération client (`/api/worlds/[worldSlug]/regles/[cle]/window`, fenêtre secondaire), même motif que `EditEntityForm`. `RulesSidebar` récupère désormais sa liste côté client (`useWorldRuleEntries`, déjà utilisé ailleurs) plutôt que par props serveur, pour ne pas payer ce coût sur les pages Monde. Piège trouvé et corrigé : la clé d'effet déclenchant la récupération d'une fenêtre secondaire dépendait à tort de primaire+avec combinés — une référence passant de primaire à secondaire pouvait laisser cette clé combinée inchangée et l'effet ne se redéclenchait pas ; corrigé en la faisant dépendre de `avec` seul. Vérifié en navigateur : ouverture d'une fiche de règle et d'une fiche d'entité simultanément, aller-retour Monde → Règles → MJ → Monde sans perte de fenêtre, fermeture d'une fenêtre individuelle. `typecheck`/`lint` verts ; `test` vert sur les tests unitaires (595/606, le reste exige une base Supabase locale indisponible dans cet environnement, sans rapport avec ce ticket).

### V2-K2 — Sidebar unifiée comme sélecteur de vue · `M` — fait

*Dépend de K1.*

- [x] Le bandeau `Monde / Règles / MJ` (`components/shell/SectionToggle.tsx`) quitte la barre supérieure, remonte dans la sidebar, au-dessus du champ de recherche.
- [x] Choisir une vue change le contenu de l'arborescence (`EntityTree`, liste de `RulesSidebar`, navigation de `MjSidebar`) **sans perdre l'espace de travail** — les fenêtres ouvertes survivent (garanti par K1).
- [x] L'URL continue de refléter la vue active (lien partageable, bouton retour), sans démonter le gestionnaire de fenêtres.
- [x] Les boutons propres à chaque vue (bas de sidebar) restent inchangés, sauf ce que déplacent K6 et K7.

Fait — décision prise avec l'utilisateur avant d'écrire : Monde/Règles/MJ restent de vraies routes Next.js (pas un état client décroché de l'URL), option la moins invasive puisque K1 garantit déjà la survie des fenêtres à travers une navigation. `SectionToggle` quitte `AppShell.tsx` (l'en-tête redevient juste nom du monde + horloge + « Mes mondes ») et se monte désormais en haut de chacune des trois barres latérales (`Sidebar.tsx`, `RulesSidebar.tsx`, `MjSidebar.tsx`), au-dessus de leur champ de recherche respectif (MJ n'en a pas, le bandeau y est simplement en tête de liste). Le composant passe d'une pastille centrée (pensée pour une barre de 56px) à trois segments `flex-1` pleine largeur, pensés pour une colonne de 280px. Aucun changement de comportement de navigation au-delà de ça — le fond du travail (état partagé, repli de la primaire dans `avec`) était déjà celui de K1. Vérifié en navigateur sur les trois sections ; `typecheck`/`lint`/`test` verts (605/606, 1 ignoré).

### V2-K3 — Taille fixe des fenêtres · `S` — fait

- [x] Poignées de redimensionnement retirées de `WindowFrame.tsx`.
- [x] Une seule taille à l'ouverture, quel que soit le contenu (voir décision ci-dessus).
- [x] Déplacement (drag) et agrandissement/restauration (maximiser) inchangés.

Fait — taille choisie en la voyant (comme décidé) : 860×760, testée contre la fiche de personnage jouable (grille de caractéristiques, compétences, cartes de sorts) et la table de progression de classe la plus large du dépôt (Magicien), aucune des deux ne déborde ni ne semble à l'étroit. 860px reprend d'ailleurs la largeur déjà validée de `Panel.tsx` pour le même contenu. Poignée de redimensionnement (coin bas-droit) et sa logique retirées de `WindowFrame.tsx` ; l'aimantation sur les bords (glisser près d'un bord tuile la fenêtre à moitié écran) reste inchangée, ce n'est pas une poignée de redimensionnement et le ticket ne demandait pas de la retirer. Déplacement et agrandir/restaurer vérifiés en navigateur. `typecheck`/`lint`/`test` verts (605/606, 1 ignoré).

### V2-K4 — Réduction de fenêtre en onglet de bas d'écran · `M` — fait

*Dépend de K1.*

- [x] Un bouton « réduire » sur chaque fenêtre, à côté de fermer/agrandir.
- [x] Fenêtre réduite → un onglet compact en bas de l'espace de travail (nom de la fiche) ; la fenêtre elle-même se masque.
- [x] Cliquer l'onglet restaure la fenêtre à sa position précédente.
- [x] L'état réduit est un état d'affichage local, **jamais dans `?avec=`** ni dans l'URL — même logique que l'ordre d'empilement, déjà non persisté (`docs/adr/0006-fenetres-flottantes.md`).

Fait — `minimizedIds` (nouvel état local dans `DesktopWindowsProvider.tsx`, jamais lu ni écrit depuis `?avec=`) et une barre d'onglets (`WindowsDesktop.tsx`) listant toute fenêtre réduite, primaire comme secondaire. Piège réel : réduire la fenêtre PRIMAIRE ne doit jamais retirer `children` de l'arbre React — c'est elle qui porte `RegisterPrimaryWindow`, la démonter aurait désenregistré la primaire et fait disparaître son propre onglet réduit. Corrigé en la gardant montée mais masquée (`className="hidden"`) plutôt qu'omise du rendu. `windowContentLabel` (nouveau, `windowRefs.ts`) factorise le calcul nom/badge d'une fenêtre secondaire, déjà dupliqué avant ce ticket. Vérifié : réduire/restaurer la primaire et une secondaire (bouton et via le DOM), position restaurée à l'identique, `?avec=`/URL inchangés pendant toute l'opération (confirmé par `window.location.href`), le bouton "Restaurer" est bien présent et accessible (arbre d'accessibilité) même quand la capture d'écran de cet environnement ne le compose pas visiblement (flou d'arrière-plan). `typecheck`/`lint`/`test` verts (605/606, 1 ignoré).

### V2-K5 — Réglages à onglets · `S` — fait

`components/shell/SettingsMenu.tsx` est aujourd'hui une seule modale à sections empilées (Langue, Thème, Compte, liens de partage, Collaboration, Suppression). Premier composant d'onglets du dépôt — un `<Tabs>` générique, pas un cas particulier à cet écran.

- [x] `<Tabs>` générique (`components/shared/`, même famille que `Dropdown`).
- [x] Sections existantes réparties en onglets (Général + les deux onglets neufs ci-dessous).
- [x] Aucun changement de comportement sur les sections déplacées — pur découpage, comme V2-G5.

Fait — `<Tabs>` (`components/shared/Tabs.tsx`) est un primitif controlé (`value`/`items`/`onChange`), reprenant le style déjà établi par `SectionToggle.tsx` (segments égaux dans un conteneur arrondi) plutôt qu'une deuxième présentation d'onglets. Deux onglets aujourd'hui : **Général** (Langue, Thème, Compte, liens de partage, Suppression — tout ce qui existait déjà) et **Collaboration** (le bouton désactivé « Inviter un MJ », déplacé tel quel). Le troisième onglet (Règles) n'est pas créé ici : K6 l'introduira avec son vrai contenu plutôt que de poser un onglet vide en attendant. Nouvelle clé de traduction `settings.general` (fr/en). Aucune section déplacée n'a changé de comportement. Vérifié en navigateur : bascule entre les deux onglets, contenu identique à avant. `typecheck`/`lint`/`test` verts (605/606, 1 ignoré).

### V2-K6 — Ruleset actif déplacé dans les Réglages · `S` — fait

*Dépend de K5.*

- [x] `RulesetSelector` (`components/rules/RulesetSelector.tsx`) quitte le bas de `RulesSidebar` pour un onglet des Réglages généraux.
- [x] Même comportement (choix du ruleset actif, création de variante, suppression) — seul l'emplacement change.
- [x] Cohérent avec K2 : la sidebar Règles redevient une simple liste, sans réglage mélangé dedans.

Fait — `RulesetSelector` n'a pas bougé lui-même (déjà autonome, déjà en portail) : seul son point de montage change, de `RulesSidebar.tsx` vers un nouvel onglet « Règles » de `SettingsMenu.tsx`, visible uniquement dans le contexte d'un monde (`worldSlug` détecté depuis l'URL, même mécanisme que le panneau de partage). Aucune ligne de `RulesetSelector.tsx` modifiée. Vérifié en navigateur : le bouton « Règles actives » et sa boîte de dialogue (choisir/créer une variante/supprimer) fonctionnent à l'identique depuis les Réglages ; la sidebar Règles est redevenue une simple liste + les deux boutons de création. `typecheck`/`lint`/`test` verts (605/606, 1 ignoré).

### V2-K7 — Onglet Collaboration dans les Réglages · `S` — fait

*Dépend de K5.*

- [x] Le bouton désactivé « Inviter un MJ (bientôt) » (`SettingsMenu.tsx`) devient un onglet Collaboration fonctionnel.
- [x] Reprend le flux d'invitation par e-mail déjà existant au niveau campagne (`CampaignDetail.tsx`) plutôt que d'en écrire un second.
- [x] Liste les invitations actives, quel que soit le monde ou la campagne concernée.

**Divergence trouvée avant d'écrire, tranchée avec l'utilisateur** : il n'existe aucune invitation « en attente » dans ce dépôt — inviter (`inviteCampaignMember`, `src/server/services/campaigns.ts`) ajoute la personne IMMÉDIATEMENT comme membre si un compte existe déjà pour son e-mail (404 sinon), sans statut ni étape d'acceptation. Construire un vrai système d'invitation en attente aurait exigé une migration de schéma (table nouvelle, RLS, flux d'acceptation) — hors de portée d'un ticket `S`. Décision : reprendre le flux existant tel quel, transversalement.

Fait — nouvelle vue transversale : `listGmCampaignsForUser` (`src/server/repos/campaigns.ts`, jointure `campaign_members → campaigns → worlds`, RLS déjà filtrante) + `listMyGmCampaignsWithMembers` (`src/server/services/campaigns.ts`) + route `GET /api/campaigns/mine`. `SettingsMenu.tsx` : nouveau `CollaborationTab`, un sélecteur parmi les campagnes dont l'utilisateur est MJ (tous mondes confondus) + un formulaire d'invitation (e-mail + rôle MJ/joueur) qui appelle la MÊME route `POST /api/campaigns/[campaignId]/members` que `CampaignDetail.tsx` — aucune deuxième implémentation du flux d'invitation. En dessous, la liste de toutes les campagnes MJ avec leurs membres actuels. Vérifié en navigateur : campagne existante listée avec son membre, invitation vers un e-mail sans compte renvoie bien « Aucun compte n'existe pour cette adresse » (même message que le flux d'origine). `typecheck`/`lint`/`test` verts (605/606, 1 ignoré).

**Lot K terminé** (K1 à K7).

---

## Lot L — Infrastructure et hébergement

*Né du déploiement réel sur Vercel + Supabase (paliers gratuits), pas d'une fonctionnalité de wiki — voir `docs/adr/0012-hebergement-vercel-supabase-gratuit.md` pour le contexte complet de la décision.*

### V2-L1 — Stockage des images hors de la base (Supabase Storage) · `M` — fait

Aujourd'hui, `entity_portraits`, `block_images` et `background_images` stockent l'image directement dans une colonne `bytea` Postgres — un choix simple fait pendant la V2-G/H, jamais pensé pour tenir à l'échelle d'un compendium illustré. Ces octets comptent contre les **500 Mo de la base** du palier gratuit Supabase, jamais contre le **1 Go de stockage fichiers**, qui reste vide. L'ambition d'illustrer tout le compendium SRD 2024 (~800 entrées, 3-4 images chacune) sature la base bien avant de toucher au stockage si rien ne change.

**Point de vigilance, pas un détail** : un bloc peut être en visibilité `gm` (règle absolue 4 du `CLAUDE.md` — la visibilité se résout côté serveur, avant l'envoi). Si le bucket Storage est configuré en accès public pour simplifier, l'image d'un bloc `gm` devient joignable par n'importe qui connaissant l'URL, sans repasser par le filtrage — exactement la fuite que `publicShare.ts` existe pour éviter côté texte. Le bucket doit rester privé, avec une URL signée générée côté serveur après revérification de la visibilité, jamais un lien public direct.

**Critères**
- [x] `entity_portraits.image`, `block_images.image`, `background_images.backdrop_image` migrent vers des objets du bucket Supabase Storage ; la colonne `bytea` est retirée une fois la bascule confirmée. (`entity_portraits` déjà fait avant ce ticket, V2-I1 phase F₂.)
- [x] Une interface de stockage sépare l'appelant du fournisseur concret (`specs/cible-locale-et-ia.md` règle 4) — déjà en place (`storage.ts`), réutilisée telle quelle, rien à ajouter.
- [x] Les images déjà en place au moment de la migration sont copiées vers le bucket, pas seulement le code qui en écrit de nouvelles — deux scripts de bascule écrits et vérifiés en simulation (`migrate-block-images.ts`/`migrate-background-images.ts`), 0 ligne existante dans les deux tables au moment de ce ticket (rien à perdre, colonnes bytea retirées directement).
- [x] Un bloc/portrait dont la visibilité n'est pas publique reste inaccessible par URL directe à un visiteur qui n'y a pas droit — vérifié en direct (bloc `image` passé en visibilité `gm`, absent de la réponse anonyme `/apercu`, jamais un raccourci CSS).
- [x] Après migration, la taille de la base de données redescend nettement ; celle du bucket reflète le poids réel des images. Structurel plutôt que mesuré : les colonnes `bytea` n'existent plus, aucune image ne peut plus jamais grossir la base — la mesure elle-même n'a rien à montrer aujourd'hui (bases vides au moment du ticket).
- [x] Vérifié en conditions réelles (déploiement Vercel, pas seulement en local) : image de bloc téléversée et affichée sur `les-royaumes-oublies.vercel.app` (fiche Amn), passée en visibilité `gm`, confirmée absente à la fois de l'aperçu MJ simulant un visiteur anonyme ET du vrai lien de partage public (`/partage/leschroniquesdesroyaumesoublies/29`, aucune session, service-role) — jamais juste testé en local.

**Fait** — `entity_portraits` était déjà entièrement migré ; ce ticket portait sur les deux tables restantes.

Deux migrations par table (colonne `asset_id` nullable d'abord, colonnes `bytea`/métadonnées retirées ensuite une fois vérifié qu'aucune ligne n'existait à basculer) plutôt qu'une seule, même discipline que la bascule des portraits.

**`block_images`** : `uploadBlockImage` (`src/server/services/blockImages.ts`) passe par `storage.ts#uploadAsset` (`visibilityLevel: "players"`, uniforme, jamais synchronisé avec la visibilité réelle du bloc qui peut être `gm` — la garde qui compte reste `filterBlocks`, déjà vérifiée avant toute résolution d'asset, exactement comme avant ce ticket où la RLS de `block_images` ne filtrait déjà que l'appartenance au monde). Lecture par redirection vers une URL signée (`GET /api/blocks/[blockId]/image`, même motif que le portrait) plutôt qu'un flux de bytes — sûr ici car cette route n'est pas rechargée à chaque navigation, contrairement au fond d'écran. Teinte/chroma (V2-G13) toujours calculées localement (`sharp().stats()`), séparément du televersement réel — `uploadAsset` reste générique, ignore tout ce qui est théorie des couleurs.

**`background_images`** : cas particulier — un fond d'écran est un réglage de COMPTE, jamais de monde, alors que `uploadAsset` exige un `worldId` (pure organisation du chemin de stockage). Nouvelle fonction `getAnyWorldIdForUser` (`src/server/repos/worlds.ts`) résout n'importe quel monde accessible au compte ; la vraie garde reste `visibilityLevel: "user"` scopé au compte, indépendante du monde choisi pour le chemin. **Seule route qui ne redirige PAS** vers une URL signée (`GET /api/settings/background/[id]/image`) : un fond de page se recharge à chaque navigation (`app/layout.tsx`) — une redirection vers une URL signée de 5 minutes aurait cassé le cache navigateur `immutable` d'un an déjà en place ; l'aller-retour Storage a lieu côté serveur une seule fois, jamais à chaque chargement client. `processBackgroundImage` ne produit plus que la miniature carrée + teinte/chroma, le backdrop plein format est téléversé séparément via `uploadAsset`.

**Bug trouvé et corrigé en cours de route, hors périmètre initial mais découlant directement de ce ticket** : `deleteBlock` (`src/server/services/blocks.ts`) supprimait un bloc `image` via la cascade FK de `block_images` (`on delete cascade`) — cette cascade ne retirait que la ligne pointeur, jamais l'asset Storage lui-même (avant ce ticket, les octets vivaient DANS `block_images`, la cascade suffisait). Corrigé : `deleteBlock` récupère l'`asset_id` avant suppression et appelle `deleteAsset` après, pour un bloc `image` uniquement — sans quoi chaque suppression de bloc image aurait laissé un fichier orphelin permanent dans le bucket. **Gap mineur signalé mais non corrigé** (hors périmètre, pré-existant) : `background_images.owner_id` a aussi `on delete cascade` vers `auth.users` — supprimer un compte invité (V2-M6) qui aurait téléversé un fond personnel orphelinerait son asset de la même façon ; rare et sans conséquence de sécurité, à corriger si ça arrive un jour.

**Vérifié en direct** (monde Faerûn/La Croisade des Ombres, contre la vraie base de développement distante) : image de bloc synthétique téléversée (`POST /api/blocks/[id]/image`), affichée correctement après redirection vers l'URL signée (confirmé `type: "opaqueredirect"`) ; passée en visibilité `gm`, absente du HTML de l'aperçu public anonyme (`/apercu`, jamais juste masquée) ; fond d'écran synthétique téléversé, appliqué et affiché sur toute la page (miniature ET backdrop plein format), servi avec `Cache-Control: private, max-age=31536000, immutable` inchangé ; suppression des deux confirmée (asset et pointeur disparus, liste vide). Toutes les données de test nettoyées après vérification.

**Revérifié sur le vrai déploiement Vercel** (`les-royaumes-oublies.vercel.app`, même base — retour utilisateur explicite après la première passe) : même cycle (téléversement, affichage, passage en `gm`) rejoué sur la fiche Amn en production, ET confirmé absent à la fois de l'aperçu MJ ET du vrai lien de partage public (`/partage/leschroniquesdesroyaumesoublies/29`, aucune session — la seule vérification de ce ticket qui exclut réellement toute authentification). Bloc de test supprimé, aucun résidu.

`npm run typecheck && npm run lint && npm run test:core` (700 tests) passent ; `publicShare.integration.test.ts` passe.

---

## Lot M — Comptes, rôles et accès multi-joueurs

*Ticket hors série (29-30 août 2026, retour utilisateur) : l'application passe d'un usage solo à un usage entre amis. Ce lot construit ce que `module-joueur-et-solo.md` partie A prévoyait déjà pour la V3 (compagnon joueur, `canEditEntity`), avancé en V2 parce que le besoin est là maintenant. Un ticket à la fois, dans cet ordre — M3 avant M4 n'est pas négociable : la RLS d'écriture actuelle est trop large pour laisser un ami s'y connecter avant qu'elle ne soit resserrée (voir M3).*

**Décisions prises avec l'utilisateur (29 août) :**
- Un compte réel Supabase par ami, créé silencieusement au premier clic sur son lien (mot de passe généré, jamais vu) — pas de compte anonyme Supabase (perdrait l'identité au changement d'appareil), pas d'email/mot de passe visible pour l'ami.
- Un lien par personne (généré depuis le panneau superadmin), mais l'écran d'arrivée demande quand même le nom de l'ami au moment de choisir son rôle et, s'il est PJ, son personnage — le lien n'est pas pré-assigné à un personnage précis.
- Les amis MJ ont aussi le bouton « Créer un monde » (mode campagne uniquement, jamais solo), en plus de collaborer sur une copie de Valdoria.
- Révoquer l'accès d'un PJ à un personnage libère seulement la fiche (redevient sélectionnable) ; le compte de l'ami reste en sommeil, pas supprimé.
- Le compte de l'utilisateur (email/mot de passe existant) devient **superadmin** : seul à avoir le mode solo, seul à voir/gérer tous les comptes et tous les accès, avec un journal fusionné de qui a modifié quoi.

### V2-M1 — Nom de campagne visible et modifiable sur l'écran de choix de monde · `S` — fait

Motivation immédiate : l'utilisateur va avoir trois copies du même monde (Valdoria) — une pour ses propres tests, une avec Jérémy, une avec Antoine — indiscernables aujourd'hui sur `/` puisque seul `worlds.name` y est affiché. Renommer la **campagne** (pas forcément le monde) en « La Croisade des Ombres avec Jérémy » résout ça sans toucher au nom du monde ni à son slug.

`listWorldCardsForCurrentUser` (`src/server/repos/worlds.ts`) sélectionne déjà `campaigns(mode, rulesets(name))` mais jamais `campaigns.id`/`campaigns.name` — à ajouter à la requête et à `WorldCard`. Aucune fonction de renommage de campagne n'existe (`src/server/repos/campaigns.ts` n'a que `updateCampaignMode`/`updateCampaignRuleset`) : `updateCampaignName` est à écrire. `campaigns_write` (RLS) autorise aujourd'hui l'écriture à N'IMPORTE QUEL membre du monde, pas seulement au propriétaire (même lacune que `entities_write`, voir M3) — en attendant que M3 la resserre, suivre le même principe que le renommage/suppression de monde déjà fait (`app/actions.ts`) : vérification explicite du propriétaire dans le service, pas seulement confiance en la RLS.

**Critères**
- [x] Le nom de la campagne apparaît sur chaque carte de monde de `/`, à côté ou sous le nom du monde.
- [x] Un bouton « Renommer » (même DA que celui du monde, `app/WorldCardActions.tsx`) permet de changer `campaigns.name` sans toucher à `worlds.name` ni au slug.
- [x] Réservé au propriétaire du monde, vérifié côté serveur explicitement (pas seulement la RLS).
- [x] Les trois copies de Valdoria de l'utilisateur restent distinguables d'un coup d'œil sur l'écran d'accueil (vérifié avec Faerûn/Valdoria, la troisième copie n'existe pas encore — voir M8).

### V2-M2 — Rôle superadmin et verrouillage du mode solo · `M` — fait

```sql
alter table profiles add column account_role text not null default 'member'
  check (account_role in ('member', 'superadmin'));
```

Un seul compte (celui de l'utilisateur) passe à `superadmin`, à la main, dans la migration de seed — aucune interface de self-service pour ce champ, pas de deuxième superadmin sans repasser par une migration. `app.is_superadmin()` (security definer, même patron que `app.is_world_member`) devient le point d'entrée unique utilisé par M3/M4/M5 — jamais un test `profile.account_role === 'superadmin'` répété en dur à plusieurs endroits.

Le mode solo devient refusé côté serveur à qui n'est pas superadmin, sur les **quatre** points d'entrée trouvés en creusant (deux de plus que prévu au moment d'écrire ce ticket) : création (`createWorldAction`), bascule après coup (`PATCH /api/campaigns/[id]`, `setCampaignMode`), réparation d'un monde plus ancien sans campagne (`POST /api/worlds/[slug]/campaigns`), et import d'un monde exporté (`POST /api/worlds/import`, où le mode choisi est libre, indépendant du mode d'origine du fichier). L'option reste visible ou non dans l'interface (`CreateWorldForm.tsx`, `ImportWorldForm.tsx`, `CampaignsPanel.tsx`), mais le vrai verrou est dans chacune des quatre routes/actions, jamais seulement un `<option>` masqué.

Décision structurante, documentée dans `docs/adr/0014-role-superadmin.md` : `app.is_superadmin()` (RLS, pour M4/M5) et `isSuperadmin()` (`src/server/services/account.ts`, lecture directe de `profiles.account_role` sous `profiles_select`, pour les décisions métier ponctuelles côté service) coexistent délibérément — deux couches qui ne peuvent pas s'appeler l'une l'autre, jamais une troisième vérification en dur ailleurs.

**Critères**
- [x] `profiles.account_role` existe, un seul compte à `superadmin` après la migration (vérifié : 1 ligne sur 19 profils).
- [x] `app.is_superadmin()` existe et n'est jamais dupliqué en dur ailleurs (le côté TypeScript passe par `isSuperadmin()`, voir l'ADR).
- [x] Créer un monde en mode solo échoue côté serveur pour un compte non-superadmin, même en forgeant la requête — vérifié en direct en rétrogradant temporairement le compte réel et en appelant les routes au fetch (403 sur les quatre points d'entrée, 200 confirmé pour `mode: 'campaign'`).
- [x] Basculer une campagne existante en solo échoue de la même façon.
- [x] ADR écrit avant d'attaquer M4/M5, qui dépendent de `is_superadmin()`.

### V2-M3 — `canEditEntity`, `entity_grants` et resserrement de la RLS d'écriture · `L` — fait

**Le ticket le plus risqué du lot — à faire et à tester avant qu'un seul ami ait un lien fonctionnel.** Vérifié en lisant `supabase/migrations/20260730150001_rls.sql` : `entities_write` ET `campaigns_write` ET `campaign_members_write` autorisent aujourd'hui l'écriture à n'importe quel membre du monde (`app.is_world_member`), jamais restreint à « c'est sa fiche » ou « c'est son propre rôle ». Sans risque tant que seuls des comptes créés à la main y accèdent ; devient une vraie faille dès qu'un ami PJ obtient un compte en un clic (M4) — il pourrait alors modifier n'importe quelle fiche du monde, y compris celles des autres joueurs ou les fiches MJ.

```sql
create table entity_grants (
  entity_id  uuid not null references entities(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  granted_by uuid not null references auth.users(id),
  granted_at timestamptz not null default now(),
  primary key (entity_id, user_id)
);
```

`src/core/permissions/canEditEntity.ts` (pur, testable, `specs/module-joueur-et-solo.md` §A2) : propriétaire/éditeur du monde, ou bien c'est le personnage du joueur dans cette campagne (`campaign_characters.user_id`), ou bien une ligne `entity_grants` l'autorise explicitement. Appelé dans la couche service à chaque mutation d'entité/bloc — jamais seulement en RLS, jamais seulement en masquant un bouton (même doctrine que `canSee`, PDD §28 : « la RLS n'est pas la sécurité, c'est le filet »). La RLS elle-même (`entities_write`, `blocks_write`, `campaigns_write`, `campaign_members_write`) est resserrée en miroir, avec le même test d'intégration que `visibilityRls.integration.test.ts` (précédent déjà dans le dépôt).

**Critères**
- [x] `canEditEntity` couvre **quatre** cas, pas trois (un de plus que prévu à l'écriture du ticket) — owner/éditeur du monde, MJ d'une campagne du monde (`campaignRoles` contient `gm`, sans quoi le flux d'invitation par email déjà existant, qui n'écrit que dans `campaign_members`, cassait pour un co-MJ non propriétaire/éditeur), sa propre fiche PJ, `entity_grants`. Table de vérité testée en millisecondes, sans base (`canEditEntity.test.ts`, 6 cas).
- [x] Aucune route/service de mutation d'entité ou de bloc **public** (routes API atteignables depuis l'interface) n'écrit sans passer par `canEditEntity` — `updateEntity`/`deleteEntity`, `createBlock`/`updateBlockContent`/`reorderBlock`/`deleteBlock`, `overwriteCharacterFromWizard`.
- [x] Un simple joueur (`campaign_members.role = 'player'`) ne peut plus, ni via l'interface ni en forgeant une requête, modifier une fiche qui n'est pas la sienne et n'a pas de `entity_grants` pour lui — vérifié par le test d'intégration ET en direct (ajout/suppression de bloc par le propriétaire, sans régression).
- [x] Un MJ garde l'écriture complète sur tout le monde, sans régression — y compris un MJ invité par email sans ligne `world_members` (cas réel trouvé en traçant les appelants, voir le 4ᵉ cas ci-dessus).
- [x] Test d'intégration RLS dédié (`canEditEntityRls.integration.test.ts`, même famille que `visibilityRls.integration.test.ts`) : 7 profils, `entities` (UPDATE/DELETE), `blocks` (INSERT), `campaigns`/`campaign_members` (le resserrement `is_world_admin`, découvert nécessaire en écrivant ce ticket — sans lui, un simple joueur pouvait renommer la campagne ou s'auto-promouvoir MJ).

**Dette assumée, à garder en tête avant M4 (ne pas oublier) :**
- `characterActions.ts` (actions de la fiche jouable : dégâts, emplacements de sorts, équipement...) écrit directement sur `blocks` via le repo, sans passer par `canUserEditEntity` côté service — **déjà couvert par la RLS resserrée** (même garantie de sécurité), juste pas par le garde-fou de service en double défense. Laissé de côté pour ne pas faire déborder ce ticket déjà `L` ; à couvrir dans un ticket dédié si on veut la même défense en profondeur que le reste.
- **`campaign_characters_write` reste aussi large qu'avant** (`app.is_world_member`, jamais resserrée par ce ticket) : n'importe quel membre du monde peut aujourd'hui réassigner ou libérer N'IMPORTE QUELLE ligne `campaign_characters`, pas seulement la sienne. Sans conséquence tant qu'aucun ami n'a de compte ; devient directement exploitable dès M4 (un ami pourrait voler la fiche PJ d'un autre en forgeant une requête, contournant l'écran de sélection). **M4 doit resserrer cette politique avant d'ouvrir le premier lien** — logique proposée : un MJ (`is_world_admin`) peut tout faire ; un joueur peut prendre une ligne `user_id is null` ou libérer/modifier SA PROPRE ligne (`user_id = auth.uid()`), jamais celle d'un autre.

### V2-M4 — Liens d'invitation nominatifs et écran « MJ / PJ » · `L` — fait

Reprend la table `campaign_invites` déjà dessinée dans `specs/module-joueur-et-solo.md` §A1, avec une différence : le jeton reste la porte d'entrée **permanente** de la personne (pas un usage unique), pour qu'elle retrouve son compte depuis n'importe quel appareil sans jamais voir d'email ni de mot de passe.

```sql
create table campaign_invites (
  id                uuid primary key default gen_random_uuid(),
  campaign_id       uuid references campaigns(id) on delete cascade,   -- nul = invitation de monde (MJ), voir M8
  world_id          uuid references worlds(id) on delete cascade,
  token_hash        text not null unique,        -- SHA-256, comme share_links
  intended_role     text check (intended_role in ('gm','player')),  -- nul = au choix de l'invité·e
  claimed_by_user_id uuid references auth.users(id),  -- nul tant que jamais ouvert
  claimed_name      text,                          -- nom tape par l'ami au premier passage
  revoked_at        timestamptz,
  created_by        uuid not null references auth.users(id),
  created_at        timestamptz not null default now()
);
```

**Écart avec la description initiale, en mieux : aucun mot de passe n'est jamais généré, pas même en interne.** Le compte invité est créé sans mot de passe du tout (`email_confirm: true` seul), puis chaque connexion (premier passage ou réouverture) passe par un lien de connexion magique généré côté serveur (`auth.admin.generateLink`) et vérifié immédiatement (`verifyOtp`) — le dernier critère de ce ticket (« aucun mot de passe... ») devient trivialement vrai par construction plutôt que par discipline de ne pas l'afficher.

Premier passage sur le lien : compte créé, écran « Je suis MJ / Je suis PJ », nom demandé, si PJ liste des `campaign_characters` où `is_pc = true and user_id is null` à choisir (elle aussi accessible sans session, via une deuxième fonction `security definer` qui revalide le jeton). Passage suivant : jeton déjà `claimed_by_user_id`, lien magique régénéré pour le même compte, retour à l'écran adapté à son rôle (calculé en relisant l'état réel — jamais un rôle mémorisé côté client). Un jeton `revoked_at` non nul refuse l'accès (le superadmin peut couper un lien sans supprimer le compte).

**Deuxième trou confiné dans le client service-role**, documenté dans `docs/adr/0015-provisioning-comptes-invites.md` : `lib/supabase/serviceAccountProvisioning.ts` + `src/server/services/accountProvisioning.ts`, jamais une extension de `publicShare.ts` (qui reste scopé à la lecture de partage).

**Préalable trouvé en écrivant V2-M3, fait en tête de ce ticket** : `campaign_characters_write` (le backlog disait par erreur `campaign_members_write` — la table qui gère les personnages revendiqués, pas les rôles gm/player) était encore large (`app.is_world_member`). Resserré : MJ (`is_world_admin`) → tout ; joueur → seulement prendre une ligne `user_id is null` ou toucher SA PROPRE ligne (`user_id = auth.uid()`).

**Critères**
- [x] Un lien non réclamé propose le choix de rôle puis, en PJ, la liste des personnages non réclamés.
- [x] Réclamer un personnage l'enlève immédiatement de la liste pour tout autre lien (personne d'autre ne peut le prendre en double) — vérifié par un test d'intégration dédié (deux réclamations concurrentes sur le même personnage, une seule réussit).
- [x] Rouvrir le même lien plus tard, sur un autre appareil, reconnecte le même compte sans nouvel écran de choix — vérifié par test d'intégration (deux sessions distinctes, même `user.id`).
- [x] Un lien révoqué refuse l'accès sans supprimer le compte ni libérer sa fiche.
- [x] Aucune valeur de mot de passe générée n'est jamais visible côté client, ni journalisée en clair — vrai par construction (aucun mot de passe n'existe pour ces comptes).

**Livré dans ce ticket, en plus du strict nécessaire pour le tester** : un générateur de lien minimal dans l'onglet Collaboration des Réglages (choix du rôle, un lien affiché une seule fois, à copier).

**Bug critique trouvé bien plus tard (M7d, retour utilisateur : « teste le lien toi-même, nomme le profil Claude »), jamais avant faute d'avoir testé le vrai parcours déconnecté** : le middleware (`lib/supabase/middleware.ts`) ne laissait jamais un visiteur SANS session atteindre `/rejoindre/*` — renvoyé vers `/login`, qu'il ne peut pas utiliser puisqu'il n'a pas encore de compte. Concrètement, **aucun ami sans compte n'a jamais pu se servir d'un lien d'invitation** depuis l'écriture de ce ticket — tous les tests précédents (intégration, ou manuels par script) passaient par une session déjà ouverte ou par une création de compte directe en base, jamais par le vrai clic déconnecté. Corrigé en ajoutant `/rejoindre/*` à la liste des pages publiques, même exception que `/partage/*`.

**Suite, retour utilisateur 30 août — le générateur minimal ci-dessus est remplacé par un panneau complet, même principe que `ShareLinkPanel.tsx`** : le jeton en clair est désormais conservé (`campaign_invites.token`, même choix que `share_links` — migration 20260826180001), une vraie liste (créer/copier/révoquer) plutôt qu'un lien perdu après affichage. Ajout demandé en plus : un mot de passe optionnel sur le lien (`password_hash`/`password_attempts`, même mécanisme scrypt que `share_links` — migration 20260809210001, code réutilisé tel quel), modifiable uniquement par le superadmin/MJ du monde OU par la personne qui a réclamé ce lien précis, jamais un tiers — vérifié par une fonction dédiée (`app.set_campaign_invite_password`) qui ne touche jamais que cette seule colonne, jamais par une politique RLS large qui aurait laissé l'ami réécrire son propre rôle. Testé par 2 tests d'intégration de plus (verrouillage à 10 essais ; les trois profils de droit sur le mot de passe). Reste dans le périmètre de V2-M5 : le panneau **superadmin** transversal (tous mondes confondus) et le journal fusionné — ce qui précède est le panneau **par campagne**, dans Collaboration.

### Préalable — un compte, plusieurs rôles · fait

Trouvé en discutant M5 (retour utilisateur 30 août : « Jérémy MJ dans un monde ET joueur dans un autre »). Réclamer un lien pas encore réclamé, depuis une session déjà ouverte (via un lien précédent), ajoute désormais ce nouveau rôle/personnage à CE compte plutôt que d'en créer un second — `provisionInviteSession` accepte `existingUserId`, le marquage « invitation réclamée » est devenu course-safe par lui-même (`UPDATE ... WHERE claimed_by_user_id IS NULL`, ne dépend plus de l'unicité d'email de GoTrue). Vérifié par un test d'intégration dédié (même compte, joueur sur un monde et MJ sur un second).

**Reformulation du reste du lot, retour utilisateur 30 août** : pas trois écrans d'accueil séparés par rôle fixe, mais **un seul écran d'accueil unifié** qui recense, pour chaque monde/campagne où le compte participe, le rôle qu'il y tient — puisqu'un même compte peut désormais être MJ ici et joueur là. Le superadmin voit ce même écran (ce sont aussi ses mondes), avec une section Administration en plus. L'image de tableau de bord fournie comme inspiration (cartes de stats, graphiques) sert de ton, pas de gabarit visuel — tout est reconstruit avec nos propres jetons (`panel`, `accent`, `font-mech`), jamais le thème Bootstrap générique de l'image.

### V2-M5 — Écran d'accueil unifié : mes mondes et mon rôle dans chacun · `M` — fait

Remplace l'écran actuel de `/` (aujourd'hui : une simple liste de mondes, sans distinguer le rôle qu'on y tient). Pour chaque monde/campagne dont le compte est membre : le nom, **le rôle qu'on y tient** (MJ, ou Joueur avec le nom du personnage réclamé), et un lien vers le bon endroit — `/m/[slug]` pour un rôle MJ (comportement actuel, inchangé), la fiche du personnage réclamé pour un rôle Joueur (`campaign_characters` où `user_id = auth.uid()`, déjà résolu par `getClaimedCharacterEntityId`, V2-M4).

`listWorldCardsForCurrentUser` (`src/server/repos/worlds.ts`) donne déjà la liste des mondes accessibles ; il manque le rôle par ligne et, pour un rôle Joueur, le personnage réclamé — à ajouter à la même requête plutôt qu'un aller-retour séparé par monde.

**Critères**
- [x] Chaque monde listé affiche le rôle réel du compte dans CE monde (pas un rôle global figé) — un compte MJ d'un monde et joueur d'un autre voit les deux étiquettes correctement (vérifié par test d'intégration dédié, `src/server/repos/worlds.integration.test.ts`).
- [x] Un rôle Joueur affiche le nom du personnage réclamé et mène directement à sa fiche.
- [x] Un rôle MJ mène à `/m/[slug]`, comme aujourd'hui — aucune régression sur ce chemin déjà utilisé quotidiennement (vérifié en direct : Faerûn/Valdoria inchangés pour le superadmin, propriétaire des deux).
- [x] Le superadmin voit cet écran comme n'importe quel compte pour ses propres mondes (Valdoria, Faerûn...).

### V2-M6 — Section Administration (superadmin) sur l'écran d'accueil · `M` — fait

Visible uniquement pour `is_superadmin()`, sur ce même écran (pas une page séparée) — c'est précisément le rôle de `app.is_superadmin()` posé en M2. Reprend et étend `InviteLinkPanel.tsx` (V2-M4, aujourd'hui limité à une campagne à la fois) en vue transversale tous mondes confondus : lister/révoquer/réinitialiser un lien, supprimer un compte, et le journal fusionné (`entity_revisions.changed_by` + `session_events.actor_user_id`, déjà porteurs de l'auteur — surtout une vue de lecture qui fusionne les deux triée par date, filtrable par compte/monde, sans le filtre par campagne que M7 impose à la version MJ).

Élargir `worlds_select` à `is_superadmin()` (pour le sélecteur de monde du journal) a eu un effet de bord repéré en vérifiant en direct : l'écran d'accueil PERSONNEL du superadmin (`listWorldCardsForCurrentUser`) s'appuyait entièrement sur cette même RLS pour scoper « mes mondes », sans filtre applicatif — il listait donc soudain tous les mondes de la base, étiquetés « MJ » à tort, boutons Renommer/Supprimer affichés. Corrigé en filtrant explicitement à `owner_id === userId` ou un rôle réel (`src/server/repos/worlds.ts`), même discipline que `renameWorld`/`deleteWorldWithConfirmation` (CLAUDE.md §1, la RLS est le filet, pas la vérification) — aucune faille réelle cela dit, ces deux actions vérifient déjà la propriété côté service, indépendamment de la RLS.

**Le journal fusionné transversal retiré de l'interface (retour utilisateur, après V2-M7c)** : une fois l'écran d'accueil en trois colonnes en place, ce panneau faisait doublon exact avec le journal de la colonne de droite (même fonction, `getMergedJournalForWorld`) tant que le superadmin est membre de tous les mondes existants — toujours le cas aujourd'hui. Le service et la route (`getMergedJournalForWorld`, `/api/admin/journal`, `/api/admin/worlds`) restent en place, prêts à être réexposés avec V2-M8 (un monde appartenant entièrement à un ami, absent de la liste personnelle du superadmin).

**Critères**
- [x] La section n'est visible et accessible qu'à `is_superadmin()`, refusé côté serveur pour tout autre compte.
- [x] Réinitialiser un lien invalide l'ancien jeton immédiatement.
- [x] Supprimer un compte libère ses fiches revendiquées et ses `entity_grants`.
- [x] Le journal affiche, pour un monde donné, les modifications de tous les comptes qui y ont touché, triées par date, sans confondre révision de fiche et événement de jeu.

### V2-M7 — Journal MJ par monde et octroi d'édition d'une fiche · `S`/`M` — fait

Le pendant « par monde » de M6, pour un MJ qui n'est pas superadmin (propriétaire/éditeur normal, ou ami MJ) : dans l'espace MJ d'un monde (`/m/[slug]/mj`), le même principe de journal fusionné que M6 mais filtré à CE monde (`specs/module-joueur-et-solo.md` §A3), plus la gestion de `entity_grants` pour ses propres fiches et la révocation d'une fiche PJ réclamée dans sa campagne.

`app.is_world_admin` (SQL, migration V2-M3) existait déjà comme gate RLS d'écriture pour `entity_grants`/`campaigns`/`campaign_members` ; ce ticket lui ajoute son miroir côté service (`isWorldAdmin`, `src/server/services/permissions.ts`) — troisième copie déliberée de la même règle que `canEditEntity`/`canSee` (RLS ne peut pas exécuter du TypeScript). `listEntityGrants`/`grantEntityAccess`/`revokeEntityAccess` (repo) existaient déjà depuis M3, jamais exposés côté interface avant ce ticket. La révocation d'une fiche PJ réutilise l'endpoint d'attribution existant (`POST /api/campaigns/[id]/characters`) avec `isPc: true, userId: null` — jamais le même geste que « PNJ (sans joueur) », qui mettrait `isPc: false` et rendrait la fiche non sélectionnable par un nouveau joueur.

Effet de bord trouvé en vérifiant en direct : le monde de démo `mj-demo@creadonjon.local` (`scripts/seed-dev.ts`) partageait le slug littéral `valdoria` avec la vraie Valdoria de Gabriel — invisible tant que `worlds_select` ne voyait que les mondes du compte courant, devenu bloquant pour le superadmin depuis M6 (`getWorldBySlugForCurrentUser` refuse de deviner entre plusieurs lignes). Corrigé en renommant le slug de seed en `valdoria-mj-demo` (jamais le nom affiché ni le contenu) — l'idempotence du script est basée sur un id fixe, jamais sur ce slug, donc sans risque.

**Critères**
- [x] Un MJ propriétaire/éditeur du monde voit le journal fusionné filtré à son monde, jamais les autres mondes du compte qui le consulte.
- [x] Un MJ propriétaire/éditeur du monde peut accorder ou retirer l'édition d'une fiche précise à un joueur de sa campagne.
- [x] Un MJ peut révoquer la fiche PJ d'un joueur (elle redevient sélectionnable), sans passer par le superadmin.
- [x] Aucune action de ce panneau n'est disponible à un simple joueur (vérifié par test d'intégration dédié, `src/server/services/entityGrants.integration.test.ts` : `isWorldAdmin` et les trois services `entity_grants` refusent un simple joueur, `forbidden`).

### V2-M7c — Écran d'accueil en trois colonnes · `M` — fait

Retour utilisateur (30 août) : refonte de `/` en trois colonnes — profil (nom et mot de passe modifiables en place, toujours optionnel pour les comptes invités), mondes/campagnes au centre (création/import en haut, liste en dessous), détail du monde sélectionné à droite (journal récent + bouton Rejoindre + actions Exporter/Dupliquer/Renommer/Supprimer pour un MJ). La sélection reste locale au composant (pas de navigation avant de cliquer Rejoindre).

Le journal de la colonne de droite s'adapte au rôle plutôt que de dupliquer une route par rôle (`GET /api/worlds/[worldSlug]/journal/mine`) : un MJ reçoit le journal complet du monde (`getMergedJournalForWorld`, M6/M7), un joueur reçoit une vue restreinte aux fiches PJ de sa campagne (`getPlayerJournalForWorld`, nouveau) — jamais les PNJ/lieux du MJ, qui pourraient révéler un secret pas encore découvert. Correspond à l'intention d'origine du suivi en direct (specs/module-joueur-et-solo.md §A3 : « le MJ voit les modifications des fiches PJ »), étendue ici côté joueur.

**Critères**
- [x] Colonne profil : nom modifiable en place avec bouton Enregistrer (réutilise `DisplayNameForm`, déjà en place depuis V1-A1) et mot de passe modifiable en place, toujours optionnel — jamais imposé aux comptes invités (lien magique uniquement).
- [x] Colonne centrale : création/import de monde en haut, liste des mondes/campagnes en dessous.
- [x] Colonne de droite : cliquer un monde affiche son journal récent et un bouton Rejoindre — le contenu du journal dépend du rôle réel du compte dans ce monde (vérifié par test d'intégration dédié, `src/server/services/activityJournal.integration.test.ts` : un PNJ secret n'apparaît jamais dans la vue joueur, apparaît dans la vue MJ ; et en direct avec un vrai compte joueur temporaire dans Valdoria — aucune fuite des cinq PNJ testés).

Bug trouvé pendant cette vérification en direct (retour utilisateur : « teste avec un compte joueur ») : `profiles_select` (jamais élargie depuis la migration d'origine, sauf pour le superadmin en M6) affichait « Compte sans nom » pour toute revision/événement dont l'auteur n'est ni le viewer ni le superadmin — y compris un MJ ordinaire consultant le journal de son propre monde (M7), pas seulement le cas rare du joueur. Corrigé (migration `20260830200001_profiles_select_shared_world.sql`) : un compte peut désormais lire le nom d'un autre s'ils partagent au moins un monde (`app.shares_world_with`, même triple critère que `app.is_world_member`) — strictement moins révélateur que ce qui fuit déjà ailleurs (le panneau Membres d'une campagne affiche l'UUID brut à tout co-membre).

**Incident trouvé le 30 août, sans rapport avec le critère ci-dessus** : le monde Valdoria s'est retrouvé avec `name = "Faerûn"` en base (repéré via l'en-tête affiché, incohérent avec l'URL et le contenu). Cause réelle, confirmée en lisant le code : `WorldDetail`/`WorldCardActions` (`HomeScreen.tsx`) n'étaient jamais remontés en changeant de monde sélectionné — seulement re-rendus avec de nouvelles props. Ouvrir « Renommer » sur un monde puis changer la sélection sans valider laissait l'état local du formulaire (`name`, texte tapé) sur l'ANCIEN monde pendant que le champ caché `worldId` pointait déjà sur le nouveau — valider dans cet état renommait le mauvais monde avec le mauvais nom. Corrigé par `key={selected.id}` sur `WorldDetail`, qui force React à réinitialiser tout état local (dont celui du renommage) à chaque changement de sélection. Nom de Valdoria restauré ; aucune autre donnée affectée (vérifié via `updated_at` sur tous les mondes).

### V2-M7d — « Voir comme » un compte invité, section Administration · `S` — fait

Retour utilisateur : depuis Administration, un bouton « Voir comme » sur chaque ligne de compte réclamé — changement de session RÉEL vers ce compte (ADR 0016, choix délibéré de l'utilisateur après rappel du risque), pas une superposition en lecture seule. Réutilise le mécanisme de lien magique déjà bâti pour les comptes invités (`accountProvisioning.ts`, ADR 0015) : `mintSessionForInvitedAccount` (refuse tout compte non issu d'un lien), consommé via la page `/auth/confirm` déjà existante.

Le filet de sécurité (cookie httpOnly `view_as_admin_uid`, bandeau permanent `ViewAsBanner` rendu depuis `app/layout.tsx`, retour vérifié par lecture `service_role` puisque la session courante n'est plus celle du superadmin) est la partie non négociable — sans lui, ce mécanisme reproduirait le piège vécu dans cette même session (perte d'accès à son propre compte via un cookie partagé entre onglets).

**Critères**
- [x] Le bouton n'apparaît que pour un compte réellement réclamé via un lien d'invitation, jamais pour un id arbitraire.
- [x] Le changement de session est réel : la page suivante reflète exactement le rôle et les données visibles par ce compte (vérifié en direct : rôle Joueur, campagne correcte, personnage introuvable car non réclamé).
- [x] Un bandeau reste visible sur toute page tant que ce mode est actif, avec un retour immédiat vers le compte superadmin — vérifié en direct, cycle complet aller-retour dans le même onglet sans perte d'accès.

### V2-M7e — Outil unique d'octrois d'édition dans les outils MJ · `S` — fait

Retour utilisateur (pendant le test de la coquille joueur), en deux temps. D'abord un raccourci par fiche (« … » de chaque entité, `EntityTree.tsx`) — puis reconsidéré : « je crois que je préfère avoir un outil dans la sidebar de MJ qui référence ainsi tout les octrois d'édition et qui permet de gérer les permissions [...] et aussi voir qu'est-ce qui est déjà permis ou non ». Le raccourci par fiche retiré (choix explicite : un seul chemin pour gérer les octrois plutôt que deux), au profit du panneau **existant** « Octrois d'édition » (`CampaignDetail.tsx`, déjà dans Outils MJ → Campagnes depuis V2-M7) — corrigé pour être enfin cet outil-là, plutôt qu'un nouveau composant.

Deux trous corrigés dans ce panneau, tous deux déjà notés en le vérifiant :
1. **Portée** : `getCampaignCharacterGrants` filtrait par `campaign_characters` — un octroi sur une fiche jamais attribuée comme personnage de campagne (ex. un PNJ de lore) restait invisible dans la liste, alors qu'il fonctionnait déjà correctement côté serveur. Remplacé par `getCampaignGrants(worldId)` : tous les octrois de toute fiche du monde. Le sélecteur pour EN CRÉER un nouveau (`grantEntityOptions`) était déjà ouvert à `worldEntities`, mais cette prop ne portait en réalité QUE les fiches de type personnage (filtre `entity_kind === "character"` dans `mj/page.tsx`) — nouvelle prop distincte `grantableEntities` (toutes les fiches non-notes du monde) réservée à cette section, `worldEntities` reste character-only pour « Personnages attribués » (attribuer un lieu comme PJ n'aurait pas de sens).
2. **Noms** : membres, personnages attribués et octrois affichaient tous l'uuid brut du compte — inutilisable pour « voir qui a déjà quoi ». Résolution groupée (`getDisplayNamesForUsers`, déjà utilisé ailleurs) ajoutée à `GET /api/campaigns/[campaignId]` (`displayNames`), consommée par les trois listes du panneau.

**Critères**
- [x] Un seul endroit dans les outils MJ pour voir tous les octrois du monde et en créer/retirer — jamais un second chemin par fiche.
- [x] Fonctionne sur n'importe quelle fiche du monde, pas seulement les personnages — vérifié en direct (Faerûn/Campagne test) : octroi existant sur Seraphine De Valkor (PNJ jamais attribué comme personnage) maintenant visible, et Cormyr/Faerûn/Thay (lieux) sélectionnables pour un nouvel octroi.
- [x] Noms affichables partout dans ce panneau (membres, personnages attribués, octrois), jamais un uuid brut.
- [x] Réservé au MJ réel du monde (`isWorldAdmin`, déjà vérifié côté serveur avant ce ticket, inchangé).

### V2-M7b — Coquille joueur allégée · `M` — fait (première tranche)

Retour utilisateur (30 août, avec maquette) : révise le plan initial ci-dessous sur deux points, après discussion et une maquette mobile validée.

**Révision 1 — quatre onglets, pas trois.** Fiche / Notes / Wiki / Règles, jamais l'onglet MJ. Wiki et Règles restent SÉPARÉS (pas fusionnés) : le joueur garde la possibilité de se balader dans les deux, en lecture seule. Barre d'onglets en bas sur mobile (zone du pouce, inspiration DnD Beyond), même quatre destinations en rail latéral sur tablette/PC — un seul composant responsive (`PlayerShell`), jamais deux implémentations.

**Révision 2 — route et coquille propres, pas une variante de celle du MJ.** Nouvelle route `/m/[worldSlug]/joueur/*`, en dehors de `MondeShell`/`WindowsDesktop` (le systeme de fenêtres flottantes est un paradigme desktop, pas mobile) — hérite `AppShell`/`DesktopWindowsProvider` du layout parent (`app/m/[worldSlug]/layout.tsx`, inévitable en Next.js App Router) mais ne les utilise pas, ils s'effacent (`WindowsDesktop` sans provider actif rend ses enfants tels quels). Distinct de `/j/[token]/[campagne]` (specs/module-joueur-et-solo.md §A5) : cette dernière route est le futur Compagnon PJ (V3, session live avec IA) — un produit différent, pas une variante de cette coquille.

**Notes — tranché dans `specs/module-joueur-et-solo.md` (« Ce qui reste ouvert ») : une entité `notes` privée par joueur, avec les blocs existants, pas de second système.** Trouvé en creusant : ça exige deux choses qui n'existaient pas —
1. `canEditEntity` n'avait aucun cas pour « j'ai créé cette entité » — une 5ᵉ branche ajoutée (mirroir SQL `app.can_edit_entity` inclus, migration dédiée), sinon un joueur peut créer sa fiche de notes (`entities_insert` est déjà ouvert à tout membre) mais jamais y toucher ensuite.
2. Rien ne filtrait une entité par son créateur dans l'arbre de la sidebar MJ (`getEntityTree`) — sans ça, « Notes de Claude » apparaîtrait dans la sidebar de Gabriel, contredisant le critère « invisibles du MJ tant qu'il ne les partage pas ». Filtré par `entity_kind === 'notes' && created_by !== viewer`.

**Wiki en lecture seule — l'UI d'édition ne se cache pas d'elle-même aujourd'hui.** Trouvé en vérifiant : `EditEntityForm`/`EntityBlocks` affichent les boutons d'édition à quiconque charge la page, quel que soit son droit — seule l'écriture serveur est bloquée (`canUserEditEntity`, appelé au moment de sauver, jamais avant). Un lecteur seul verrait donc des boutons qui échouent toujours. Le rendu en lecture réutilise l'approche déjà écrite pour `/partage/[token]` (`PublicBlockView`/`PublicEntityBody`, purement présentationnels) plutôt que de la dupliquer — adaptée pour lire depuis la vraie visibilité du joueur (`canSee`/`filterBlocks`) au lieu du filtre `is_public` du partage anonyme, qui montre STRICTEMENT moins qu'un vrai membre du monde n'a le droit de voir.

**Révision 3 (30 août, test en direct avec un second compte réel, « Claude », sur téléphone) — trois trous trouvés en vérifiant, tous corrigés :**
1. **Le Wiki ne rendait jamais éditable une fiche que le joueur avait pourtant le droit d'éditer.** `wiki/[entitySlug]/page.tsx` rendait toujours `PlayerBlockView` (lecture seule), sans jamais appeler `canUserEditEntity` — ni sa propre fiche PJ atteinte par le Wiki plutôt que l'onglet Fiche, ni une fiche de lore accordée par le MJ (`entity_grants`, V2-M7) n'étaient éditables par ce chemin. Corrigé : la page teste `canUserEditEntity` d'abord et bascule sur `EditEntityForm` (même composant que l'onglet Fiche) si vrai.
2. **Un joueur pouvait ajouter n'importe quel type de bloc** (personnage, inventaire, tableau...) sur sa fiche ou une fiche de lore accordée — retour utilisateur : « je ne pense pas que je leur donnerait le droit d'ajouter d'autre bloc que ceux de texte dans les fiches, si les joueurs veulent ajouter des choses il faudra demander au MJ ». Nouveau prop `restrictAddableTypes` sur `EntityBlocks`, `playerRestricted` sur `EditEntityForm` (limite à `+ Texte`, masque l'assistant de création) — activé sur les deux pages joueur qui rendent `EditEntityForm` (Fiche, Wiki en édition), jamais côté MJ.
3. **La barre d'onglets bas-d'écran sortait de l'écran dès que le bandeau « voir comme » était actif** (`AppShell` en `h-dvh` fixe, alors qu'il n'est pas toujours le seul enfant de `<body>` — le bandeau s'empile au-dessus). Corrigé en `flex-1 min-h-0` : touche aussi MJ/Monde/Règles sous « voir comme », pas seulement la coquille joueur.

Repéré en testant : le panneau MJ « Octrois d'édition » (`CampaignDetail.tsx`) n'affiche que les octrois sur des fiches déjà attribuées comme personnage de campagne (`getCampaignCharacterGrants`, filtré par `campaign_characters`) — un octroi créé sur une fiche de lore quelconque (via l'API, correctement appliqué et respecté par `canEditEntity`) restait invisible dans cette liste. Pas un problème de sécurité (le filtrage server-side est correct), un angle mort d'affichage seulement — corrigé dans V2-M7e ci-dessous.

**Critères**
- [x] Un PJ voit sa fiche en entier (lecture/écriture, comme aujourd'hui), Wiki et Règles en lecture seule sauf fiche accordée ou propre fiche (Révision 3), Notes en écriture sur sa propre entité privée — jamais l'onglet MJ.
- [x] Une entité `notes` créée par un joueur est invisible dans la sidebar MJ, éditable uniquement par son créateur (vérifié par test d'intégration RLS dédié, `canEditEntityRls.integration.test.ts`).
- [x] Le wiki reste consultable en lecture selon la visibilité normale (public/joueurs), sans régression — première tranche : blocs texte/infobox/image couverts (`PlayerBlockView.tsx`), le reste (personnage, inventaire, sorts, statblock...) affiche un repli explicite (« pas encore de vue simplifiée ») plutôt qu'un vide silencieux ou un crash — vérifié en direct sur une fiche réelle avec un bloc `random_table` non couvert.
- [x] Utilisable sur téléphone (même contrainte 375 px que la fiche jouable, `specs/module-joueur-et-solo.md` §A5) — vérifié en direct sur les trois largeurs (375 px, 768 px, desktop) : barre d'onglets en bas sous 768px, rail latéral au-dessus, même composant (`PlayerShell.tsx`).
- [x] Testé de bout en bout avec un second compte réel (« Claude », créé via lien d'invitation, rôle joueur sur Campagne test/Faerûn) sur viewport téléphone (375×812) : fiche propre éditable, fiche de lore accordée éditable, fiche non accordée en lecture seule, notes privées sauvegardées.

### Idée future — journal des lancés de dés

Notée telle quelle (retour utilisateur 30 août, en discutant la coquille joueur), pas un ticket : avant les statistiques rigolotes déjà notées plus bas, un journal simple des jets — les siens en tant que joueur. Rejoint la même question ouverte : vérifier d'abord que `session_events` de type `roll` conserve assez de détail pour un tel journal avant d'y engager du travail réel.

### Idée future — stats de jets amusantes

Notée telle quelle (retour utilisateur 30 août), pas un ticket : des statistiques rigolotes de jets de dés — les siens en tant que joueur, ceux de chaque joueur pour son MJ. Suppose de vérifier d'abord que les jets individuels sont conservés sous une forme exploitable pour un tel calcul (`session_events` de type `roll`, à confirmer) avant d'y engager du travail réel.

### V2-M8 — Collaboration MJ amis : dupliquer Valdoria, ajouter des éditeurs · `S`

S'appuie sur l'export/duplication déjà en place (session du 29 août) et sur `world_members` (`role: 'editor'`), préparé depuis la Phase 0 mais jamais branché. Un lien M4 avec `intended_role = 'gm'` et `world_id` renseigné (pas de `campaign_id`) ajoute l'ami en `world_members(role: 'editor')` sur cette copie précise, en plus de sa place normale de MJ sur sa propre campagne si `createCampaign` la crée pour lui. Un ami MJ garde par ailleurs le bouton « Créer un monde » (mode campagne uniquement — verrouillé par M2), sans lien avec cette collaboration.

**Critères**
- [x] Dupliquer Valdoria (Faerûn) trois fois donne trois mondes distincts, chacun avec son propre nom de campagne (M1) pour les distinguer — fait à la main par l'utilisateur (2 septembre), qui a aussi créé et envoyé les liens d'invitation `gm` correspondants.
- [ ] Un ami ajouté via un lien `gm` édite la copie visée, jamais les deux autres.
- [ ] Un ami MJ peut créer ses propres mondes, jamais en mode solo.
- [ ] Le journal superadmin (M6) distingue clairement quel compte a modifié quelle copie.

**Statut (2 septembre)** : le mécanisme est en place côté code (`accountProvisioning.ts`, `claim.role === "gm"` + `invite.worldId` → upsert `world_members(role: 'editor')` scopé à cette seule copie, vérifié par lecture) et les liens sont envoyés — mais aucun ami n'a encore rejoint (« ils iront quand ils auront envie »). Les trois derniers critères touchent un vrai comportement multi-compte (frontière d'édition entre copies, journal superadmin) : à cocher seulement une fois qu'au moins un ami aura effectivement rejoint et modifié sa copie, jamais sur la seule lecture du code.

### V2-M10 — Alias court pour un lien de partage `public_only` · `S` — fait

Retour utilisateur : « personnaliser l'url de partage du wiki... le plus court et explicite possible... y mettre le nom de la campagne ». Discuté d'abord (tension court/explicite vs sécurité) — un slug devinable serait une vraie régression pour un lien `players` (contenu réservé à la table), mais sans risque pour `public_only` (le contenu qu'il expose est déjà destiné à n'importe qui). Décision : slug automatique uniquement pour `public_only` — qui couvre en pratique 100% des liens émis aujourd'hui, `players` n'étant pas encore branché côté création (`src/server/services/shareLinks.ts`, `scope` y reste figé).

Nouvelle colonne `share_links.slug` (unique, nullable — migration `20260830220001_share_links_slug.sql`), dérivée du nom de la campagne du monde (`slugify`, même utilitaire que les slugs de monde) avec le même mécanisme de collision par suffixe numérique (`nextSlugCandidate`). Résolution (`app.resolve_share_link`/`record_share_link_password_attempt`) acceptant désormais le slug OU le jeton d'origine dans le même paramètre — sans ambiguïté possible (un slug ne fait jamais 43 caractères base64url) — donc `/partage/[token]` continue de fonctionner tel quel pour tout lien plus ancien, sans migration de données.

**Critères**
- [x] Un nouveau lien `public_only` obtient une URL du type `/partage/nom-de-campagne`, jamais le jeton aléatoire, tant qu'un ne rentre pas en collision.
- [x] Une collision de slug se résout par un suffixe numérique (`-2`, `-3`...), jamais une erreur visible.
- [x] Le jeton aléatoire d'origine reste une deuxième porte d'entrée valide vers le même lien (vérifié par test d'intégration dédié, `shareLinks.integration.test.ts`).
- [x] Vérifié en direct (Faerûn/Campagne test) : lien créé en `/partage/campagne-test`, page publique et navigation vers une fiche (`/partage/campagne-test/6`) fonctionnelles.

### V2-M11 — Volet de lancer de dés · `M` — fait

Retour utilisateur (31 août) : un volet fermé par défaut en bas à droite de l'écran principal, esthétique très inspirée du lanceur de dés de BG3, pour tout jet de la campagne — direct depuis le volet (dé brut, sans modificateur, attribué au compte qui lance) ou depuis une fiche (test/compétence/sauvegarde/initiative, modificateur inclus, attribué à la fiche). Le MJ peut cacher un jet aux joueurs (jamais l'inverse) ; un DD facultatif marque réussite/échec, et le MJ peut le partager aux joueurs (retour utilisateur, suite). Synchronisation en temps réel (Supabase Realtime, première utilisation dans ce projet). Esquisse HTML validée avant toute implémentation réelle (`specs/coquille-et-design.md` — bouton rond, formes de dé par type, chips de modificateur dynamiques, texte réussite/échec coloré).

**Arrière-plan :** colonne `dice_rolls.visibility_level` + RLS resserrée (migrations `20260831090001`/`20260831091000` — la seconde corrige une fuite trouvée par le test d'intégration : la policy `dice_rolls_write` d'origine était `for all`, dont le `using` s'applique aussi au SELECT et s'ajoutait par OR à `dice_rolls_select`, laissant n'importe quel membre lire un jet marqué `gm` ; désormais `dice_rolls_insert`, `for insert` seulement), table ajoutée à `supabase_realtime`. `resolveCheckRoll` (`src/core/rules/action.ts`, testé) — même d20+modificateur qu'une attaque, jamais de critique. `src/server/services/checkRolls.ts` — 4 jets de fiche (ability/skill/save/initiative, réutilisent `resolveCharacterActionContext` et `canUserEditEntityById`, mêmes règles que les boutons d'attaque V1-B5) + jet libre depuis la réserve du volet (moteur de formules, pas de fiche). `campaignId` nul (fiche vue hors campagne) : le jet a lieu mais n'est pas enregistré (`recorded: false`, même convention que `rollWeaponAttack`). 6 routes API (`app/api/entities/[id]/actions/{ability-check,skill-check,saving-throw,initiative-check}`, `app/api/campaigns/[campaignId]/dice-rolls` GET/POST). Testé par `checkRolls.integration.test.ts` (base réelle) : modificateurs corrects, verdict DD, un joueur ne peut pas rouler pour une fiche qui n'est pas la sienne, `hidden` clampé côté serveur pour un non-MJ, et surtout — RLS réelle vérifiée avec deux comptes authentifiés — un joueur ne voit jamais un jet `gm` même en lisant `dice_rolls` directement.

**Interface :** `DiceRollPanel.tsx` (traduction de l'esquisse validée), monté dans `AppShell.tsx` via `DiceRollProvider`/`useDiceRoll()`. Un seul flux d'alimentation pour tout le monde — Realtime sur `dice_rolls`, jamais un second calcul client — sauf le retour immédiat du clic local (`RollOutcome.trace`, ajouté côté serveur pour l'affichage instantané sans attendre l'aller-retour Realtime). Gestes cliquables sur les stats/compétences/sauvegardes/initiative de `PlayableCharacterSheet.tsx`/`CharacterSheetHeader.tsx`. Ancien journal local (`rollLog`/`ActionsTab.tsx`) retiré ; les anciens boutons d'action (attaque/dégâts/sorts/repos, `characterActions.ts`) écrivent désormais `who`/`what` dans `detail` pour s'afficher au même titre dans le volet. Nouveau jeton de design `--success` (`src/styles/tokens.css`/`app/globals.css`) pour le vert de réussite — la charte interdisant les couleurs en dur, un vrai jeton plutôt qu'un contournement.

**DD partagé (retour utilisateur, suite) :** un interrupteur MJ uniquement ("DD privé" / "DD visible des joueurs") diffuse chaque changement du champ DD via Realtime **broadcast** sur le même canal que `dice_rolls` — éphémère, jamais persisté (c'est une annonce du moment, pas un fait de campagne à conserver). Un joueur qui reçoit la diffusion voit son propre champ DD se remplir ("partagé par le MJ") ; son prochain jet est donc évalué contre ce DD, avec réussite/échec correct — vérifié en direct avec deux onglets (MJ + joueur).

**Critères**
- [x] Volet accessible sur `/m/[worldSlug]` (MJ) et `/joueur/*` (joueur), fermé par défaut, bouton rond en bas à droite.
- [x] Un jet — depuis le volet ou une fiche — apparaît en temps réel chez tous les membres autorisés à le voir, sans rechargement.
- [x] Un jet `gm` caché n'apparaît jamais côté joueur, dans le volet comme dans l'historique — vérifié en direct avec un second onglet.
- [x] Fonctionne sur téléphone (375 px) : notification in-app au lieu de l'ouverture complète du volet — vérifié par sondage direct du DOM (l'aller-retour du serveur de dev dépasse parfois la durée d'affichage de la capture d'écran, sans rapport avec le comportement réel).
- [x] Les résultats de dés de la campagne n'apparaissent plus que dans ce volet (ancien journal local retiré des boutons d'action).
- [x] Le MJ peut partager le DD courant ; un joueur qui le reçoit voit son propre jet évalué contre ce DD.

---

## 3. Critère de fin de V2

> Mener une séance complète avec votre table — préparation, PNJ cohérents, carte, combat, notes — sans ouvrir aucun autre outil.

À vérifier en jouant réellement, pas en cochant des cases.

Et un critère technique : **le verdict de S1 est écrit et la V3 est cadrée en conséquence.**

---

## 4. Ce qui reste pour la V3

| Contenu | Note |
|---|---|
| Compagnon joueur | **avancé en V2, voir Lot M** — `module-joueur-et-solo.md` partie A |
| Mode solo ou MJ assisté | forme déterminée par S1 |
| RAG sur le wiki | `SCHEMA.md` §17 — la dimension d'embedding doit être figée avant la première indexation |
| Édition élargie par les joueurs | **avancé en V2, voir Lot M** — `canEditEntity`/`entity_grants` (V2-M3) |
| Passage à l'application locale | `cible-locale-et-ia.md` §6 — la question « local seul ou local d'abord » reste ouverte |
| Génération procédurale de cartes | idée future, jamais un ticket tant que le reste n'est pas solide |

---

## 5. Rappel de méthode

**Un ticket, un commit, une relecture.** Après un an de projet, c'est la discipline la plus facile à relâcher et la plus coûteuse à perdre.

**Ne parallélisez pas H, I et J** — non pour des dépendances techniques, il n'y en a pas, mais parce que trois chantiers ouverts finissent tous à 80 %.

**Et si l'envie manque un jour, prenez le lot qui vous fait plaisir plutôt que le suivant dans la liste.** Le risque R9 — perte de motivation — reste le premier risque de ce projet, devant tous les risques techniques.

---

## 6. Proposition rédigée — moteur de déclencheurs + contrat IA (mode Solo)

**Fait (3 septembre) : `specs/moteur-de-jeu.md`.** Toujours pas un ticket — la conception est arrêtée pour les déclencheurs/conditions et le rejet de Lua, mais l'économie d'action et l'état de scène restent à affiner en écrivant V3-A3/V3-A4. Les six tickets qui en découlent (V3-A1 à V3-A6) ne s'ouvrent qu'après le lot J/K/L/M actuel. Contexte, pour qui reprendra ce fil :

La session du 3 septembre a généralisé le moteur de fiche dérivée pour les modificateurs **statiques** (`characterSheet()`/`resolvedRuleset.ts` — voir V2-G7 ci-dessus et le commit correspondant) : n'importe quelle aptitude ou don peut désormais porter des effets chiffrés (caractéristique, sauvegarde, compétence, CA, vitesse, PV) réellement appliqués. Mais le moteur ne sait toujours faire que de l'arithmétique et des dés (`src/core/formula/ast.ts`) — **aucun déclencheur** (« quand X, alors Y » — ex. un don « Malchanceux » qui force une relance sur un 20 naturel) n'existe, et `specs/regles-couche.md` §8 le listait déjà explicitement comme le sujet le plus dur du moteur, reporté après la V1. Toujours vrai aujourd'hui.

C'est aussi le préalable au mode Solo/MJ assisté (`module-joueur-et-solo.md`, §4 ci-dessus) : `resolveAction` et le contrat outil ↔ IA décrits dans `specs/regles-couche.md` §4 (« chaque question que le moteur sait résoudre est une question que l'IA n'a pas à se poser ») ne sont encore que des interfaces à écrire, jamais implémentés.

La proposition à rédiger doit couvrir au minimum : la forme d'un déclencheur (quels événements existent, où ils s'accrochent — un jet, une action, un repos...), comment il s'articule avec l'empilement de modificateurs déjà en place (§B4) sans le complexifier inutilement, le contrat d'outil pour l'IA du mode Solo (entrée/sortie de `resolveAction`, ce qui reste narratif vs mécanique), et une estimation honnête de ce qui est vraiment nécessaire pour S1 par rapport à ce qui peut attendre la V3.

---

## 7. Correctifs — Générateurs de MJ (suite du Lot J)

L'outil "Générateurs de MJ" (Taverne/PNJ/Noms/Échoppe, V2-J1/J2) est vérifié
en direct et fonctionnel, mais un usage réel remonte 6 ajustements plus une
question ouverte (générateur de butin). Deux d'entre eux ne sont pas de
simples retouches de contenu : un **sélecteur de variante** (type/richesse/
zone, choisi AVANT de générer, qui change quelle table un emplacement tire)
et un **tirage multiple par emplacement** (menu de plats/boissons) sont de
vraies capacités moteur nouvelles. Le reste est du contenu ou une extension
quasi gratuite. Détail de conception dans le plan approuvé de la session du
4 septembre (repris ci-dessous, résumé).

**Recherche externe faite (retour utilisateur : "vérifie s'il existe des
bases de tables communautaires ouvertes")** : les tables de trésor/butin du
DMG (Magic Item Table A-I, trésor individuel/de repaire) **ne sont pas dans
le SRD/OGL** — confirmé (open5e, blogofholding). Notre SRD déjà importé
(`data/srd/*.json`, CC-BY-4.0, `NOTICE.md`) contient 362 objets magiques
individuels (`Magic-Items`) mais aucune table de tirage toute faite. Des
corpus communautaires existent (ex. `swordandsource/random-tables`, licence
CC0) mais en anglais, non structurés pour notre schéma, et de la même
taille que ce qu'on écrit déjà à la main — aucun gain à construire un
pipeline d'import. **Décision : pas d'import automatisé**, contenu toujours
écrit à la main (2-3 exemples, l'auteur complète), sauf le générateur de
butin qui réutilise légitimement les 362 objets magiques déjà chez nous.

**Décision sur le générateur de butin** : oui, à construire, mais comme
outil séparé ("Butin"), jamais câblé en dur sur Échoppe — un objet à vendre
et un butin de repaire sont deux intentions différentes, même s'ils peuvent
un jour piocher dans le même vivier. Contenu : table(s) écrites à la main à
partir des 362 objets magiques SRD déjà importés, regroupés par rareté.

### V2-J5 — Bascule des tables existantes de d20 à d100 · `S` — abandonné, fusionné dans V2-J15

Redistribuer proportionnellement les plages d'une poignée d'entrées
existantes vers 1-100 n'ajoute aucune variété réelle — juste un `die`
différent sur les mêmes 2-9 résultats. Absorbé par V2-J15 (ci-dessous, en
fin de liste) : écrire ~100 VRAIES entrées par table met `die: "d100"` de
toute façon, et fait le travail qui compte réellement.

### V2-J6 — Blocs Apparence/Histoire pour Taverne et Échoppe · `S` — fait

Taverne et Échoppe gagnent chacun 2 sections supplémentaires ("Apparence",
"Histoire"), mêmes clés/contenu que le pattern déjà en place pour PNJ —
aucune extension moteur, juste un ajout au registre (`src/core/generators/
tools.ts`) + du contenu de table. Pour un lieu, "Histoire" couvre le
commerçant/tavernier, la place de l'établissement dans le quartier, ses
relations avec le voisinage — pas une biographie de personnage.

**Fait** : 4 nouvelles sections (`taverne-apparence`, `taverne-histoire`,
`echoppe-apparence`, `echoppe-histoire`), auto-provisionnées par
`ensureGeneratorToolsEntity` dès l'ajout au registre. Chacune 2 emplacements
— "Apparence" : `exterieur` + `detail` (silhouette générale + un élément qui
accroche l'œil, même patron que `pnj-apparence`) ; "Histoire" :
`proprietaire` (comment le commerçant/tavernier en est venu à tenir ce lieu)
+ `quartier` (sa place et ses relations dans le voisinage) — conforme au
critère "pas une biographie de personnage". 8 nouvelles tables (3 entrées
chacune, convention habituelle du lot), aucune extension moteur.

**Critères**
- [x] Taverne et Échoppe ont chacun une section "Apparence" et "Histoire",
      tirables et rejouables comme les autres.
- [x] "Créer la fiche" les inclut comme blocs `text` (mécanisme générique
      déjà en place, aucun changement de `promotion.ts` attendu) — vérifié
      en direct sur Échoppe : Apparence/Histoire apparaissent bien comme
      blocs `text` sur la fiche créée.
- [x] Vérifié en direct (tirage + création de fiche + nettoyage) — base
      revérifiée après coup, aucun doublon (74 blocs, 8 nouvelles tables à
      3 entrées chacune, 4 nouvelles sections à 1 exemplaire chacune).

### V2-J7 — Mécanisme des axes de variante + sélecteurs Échoppe · `M` — fait

Nouvelle capacité moteur : `GeneratorToolConfig.variants` (axes nommés,
options, `allowRandom`) — un emplacement `table` référence un axe dans sa
clé (`"objets-{type}"`), résolu côté serveur via `renderGeneratorTemplate`
(réutilisée telle quelle, déjà un remplaçeur générique `{cle}`→valeur)
avant la recherche de table. Une valeur `"aleatoire"` est résolue en une
option concrète par `serverRng`, renvoyée au client (`resolvedVariant`)
pour que le MJ voie ce qui a été tiré.

Fichiers : `src/core/generators/tools.ts` (type + axes Échoppe : type,
richesse, zone — liste incluant Apothicaire/Forgeron/Armurier/Herboriste/
Bazar/Tailleur/Librairie/Joaillier/**Maison close**), `lib/blocks/
schemas.ts` (`drawGeneratorSchema.variant`), `src/server/services/
generators.ts` (interpolation + résolution "aléatoire"), `app/api/blocks/
[blockId]/generate/route.ts`, `components/shell/GeneratorToolPanel.tsx`
(un `<select>` par axe, au-dessus des sections, état par outil, envoyé à
chaque tirage). Contenu Échoppe : table `objets-{type}` (une par type).

**Fait** — mécanisme et contenu tous deux en place. Une précision par
rapport au plan initial : la section "La boutique" avait un emplacement
`specialite` tiré au hasard, devenu incohérent avec le type maintenant
choisi à la main (ex. type "Forgeron" mais spécialité tirée "Bijoux").
Retiré : le gabarit référence directement `{type}`, résolu vers le
LIBELLE de l'option choisie (pas seulement sa clé) — `renderGeneratorTemplate`
fusionne donc les axes dans `allSlotTexts` deux fois avec des valeurs
différentes : la clé pour interpoler la CLE de table (`"objets-{type}"` →
`"objets-forgeron"`, avant le tirage) et le libellé pour le gabarit final
(`{type}` → "Forgeron", après). Un seul mécanisme (`GeneratorTableDraw.
resolvedVariant: Record<axe, {key,label}>`), deux usages. Nouveau fichier
pur `src/core/generators/variants.ts` (`resolveVariantValue`, testé) et
`toolForSectionKey` dans `tools.ts` (retrouve l'outil d'une section pour
lire ses axes, un bloc `generator` ne connaissant que sa propre cle).
15 tables de contenu (`objets-{type}` ×9 dont `objets-maison-close`,
`marchands-{wealth}` ×3, `ambiance-{zone}` ×3), les 4 tables plates
devenues orphelines (`specialites-echoppes`, `marchands-echoppes`,
`ambiances-echoppes`, `objets-en-vente-echoppes`) supprimées.

**Critères**
- [x] Un axe déclaré sur un outil affiche un menu déroulant dans le
      panneau, au-dessus des sections.
- [x] Changer le type change réellement le contenu tiré pour "Objet en
      vente" (table `objets-{type}` différente par sélection) — vérifié en
      direct Apothicaire → Forgeron → objet tiré change en conséquence.
- [x] "Aléatoire" tire un type réel côté serveur et l'affiche (le menu se
      corrige de lui-même sur la valeur tirée après un tirage).
- [x] "Maison close" est une option de type valide, avec sa propre table.
- [x] `npm run test:core` couvre la résolution "aléatoire"
      (`src/core/generators/variants.test.ts`, 4 tests).
- [x] Vérifié en direct : fiche "L'Antre du Marchand" créée avec
      Bazar/Modeste/Bourg cohérents sur les 3 sections, puis nettoyée.

### V2-J8 — Sélecteurs richesse/zone sur Taverne · `S` — fait

Réutilise le mécanisme de V2-J7 sans rien y ajouter côté moteur — juste les
axes `wealth`/`zone` déclarés sur `taverne` dans le registre, plus le
contenu de table qui en dépend. Les prix du palier `wealth` doivent rester
cohérents avec la fiche "Train de vie" (V2-J14) — pas encore de prix sur
Taverne à ce stade (le Menu à prix croissants est V2-J9), rien à vérifier
contre elle pour l'instant.

**Fait** — `taverne-etablissement` : l'emplacement `ambiance` tire
désormais `ambiance-taverne-{zone}` (3 tables, distinctes de celles
d'Échoppe — contenu de decor de boutique vs ambiance de taverne, pas le
même texte) et `patron` tire `patrons-taverne-{wealth}` (3 tables). Les
deux anciennes tables plates (`ambiances-tavernes`, `patrons-tavernes`)
supprimées, plus personne ne les référence.

**Critères**
- [x] Taverne affiche les sélecteurs richesse et zone.
- [x] Au moins un emplacement de Taverne varie réellement selon chacun —
      vérifié en direct : Modeste/Bourg → "une aubergiste bourrue..." +
      "quelques tables de bois brut..." ; Réputée/Capitale → "un maître
      d'hôtel élégant..." + "un service impeccable, verres en cristal".
- [x] Vérifié en direct.

### V2-J9 — Tirage multiple par emplacement + Menu de Taverne · `M` — fait

`drawMultiple` existait déjà (`src/core/tables/roll.ts:65`, déjà utilisée
par `src/server/services/tables.ts:108`) — jamais branchée côté générateur,
qui appelait toujours `drawOnce`. `GeneratorTableSlot` gagne un
`count?: number` optionnel ; `drawTableSlotsFromGeneratorBlock` l'utilise
pour tirer plusieurs résultats (respecte `unique_draws`), joints par la
nouvelle fonction pure `joinMultiDrawTexts` (testée) — mécanisme disponible
pour un futur emplacement à tirage multiple, même si le Menu final (voir
ci-dessous) ne s'en sert plus lui-même.

Nouvelle section "Menu" sur Taverne, trois itérations avec l'utilisateur en
cours de route. Design final : quatre catégories (Entrées/Plats/Desserts/
Boissons), chacune avec **3 emplacements simple/moyen/cher** — mais PAS
figés sur les 3 mêmes tables modeste/correcte/réputée quel que soit le
palier choisi (défaut initial signalé par l'utilisateur : une taverne
modeste tirerait un plat de luxe, une réputée un plat miséreux). Le prix
suit désormais la richesse SÉLECTIONNÉE via une fenêtre glissante de 3
positions : nouvelle fonction pure `orderedNeighbors`
(`src/core/generators/variants.ts`) qui retourne les voisins ordonnés
(`below`/`above`, bornés aux extrémités de l'axe) d'une option résolue.
`drawTableSlotsFromGeneratorBlock` calcule `{axe}_below`/`{axe}_above` pour
chaque axe résolu, en plus du `{axe}` déjà interpolé — un emplacement
"Simple" référence `entrees-tavernes-{wealth_below}`, "Cher"
`entrees-tavernes-{wealth_above}`. Une taverne Modeste (première position)
a `wealth_below == wealth`, donc Simple et Moyen tirent sur la même table
(pas de palier en dessous) ; symétriquement pour Réputée côté Cher. Vérifié
en direct aux deux extrémités.

Boissons restructurées en deux groupes à tirage multiple plutôt qu'une
liste plate : `boisson-alcool` (`count: 4`) et `boisson-sans-alcool`
(`count: 5`), chacun sur sa propre table par palier
(`boissons-alcool-tavernes-{wealth}` / `boissons-sans-alcool-tavernes-{wealth}`,
6 tables au total, remplaçant les 3 anciennes tables `boissons-tavernes-*`
qui mélangeaient alcool et sans-alcool). Chaque table a des prix
STRICTEMENT distincts et croissants — un défaut trouvé deux fois en cours
de route (d'abord 2× "4 pc" dans l'ancienne liste plate, puis une nouvelle
vague de doublons dans les tables entrées/plats/desserts/boissons
fraîchement écrites, ex. 3× "1 pa" dans `plats-tavernes-modeste`) : toutes
les tables du Menu ont été revues avec des prix uniques par table, pas
seulement "une fourchette" approximative.

Affichage dédié dans `GeneratorToolPanel.tsx` : deux colonnes ("Plats" à
gauche, sous-catégorisé Entrées/Plats/Desserts en tableau
`MenuCategory`/`SlotItemsTable` à colonnes FIXES `table-fixed` + `colgroup` —
retour utilisateur : le prix doit rester aligné même si un nom de plat est
plus court — une ligne par palier, relance indépendante par ligne ;
"Boissons" à droite, nouveau composant `MenuMultiSlot` par groupe
alcool/sans-alcool, une relance par groupe entier vu le tirage multiple).

**Bug trouvé et corrigé en cours de route** : `ensureGeneratorToolsEntity`
(src/server/services/entities.ts) relit les clés de section existantes
puis insère les manquantes — idempotent en apparence, mais deux appels
presque simultanés (Next.js Fast Refresh + un onglet resté ouvert sur
l'outil MJ, rechargé à chaque sauvegarde de fichier pendant cette session)
peuvent lire le même état avant d'écrire. Incident réel : 130 blocs
`generator` identiques (clé `taverne-menu`) créés le même jour — le
diagnostic précédent dans ce fichier ("cause exacte non identifiée côté
outil de navigation") était faux, la vraie cause est cette course
applicative. Corrigé par un index unique en base
(`blocks_generator_section_key_uniq`, migration `20260904150000`) plutôt
que par une simple convention de code — `insertGeneratorSectionBlockIfMissing`
(src/server/repos/blocks.ts) avale silencieusement la violation d'unicité
d'un appel concurrent, qui n'est plus une erreur mais le comportement
voulu. Un bug distinct a aussi été trouvé au passage : `zGeneratorTableSlot`
(src/core/schemas/blocks/generator.ts) ne validait pas encore `count`, qui
se faisait donc silencieusement retirer par Zod à l'écriture — TypeScript
ne l'a pas signalé car `count` est optionnel des deux côtés (un champ
optionnel absent reste assignable). Corrigé, et content réécrit une fois
la validation en place.

**Critères**
- [x] Un emplacement avec `count > 1` tire N résultats distincts (si
      `unique_draws`) en un seul tirage de section — vérifié en direct,
      4 boissons avec alcool + 5 sans alcool tirées chacune en un appel.
- [x] Taverne a une section "Menu" avec des plats et boissons, prix
      strictement croissants et distincts au sein de chaque table.
- [x] La gamme de prix d'un palier (Simple/Moyen/Cher) se déplace avec la
      richesse sélectionnée plutôt que de rester fixée aux 3 mêmes tables —
      `orderedNeighbors`, testé (4 tests,
      `src/core/generators/variants.test.ts`) et vérifié en direct aux deux
      extrémités : Modeste (Simple=Moyen=palier modeste, Cher=palier
      correcte) et Réputée (Simple=palier correcte, Moyen=Cher=palier
      réputée) — jamais de plat de luxe pour une taverne modeste, jamais de
      plat miséreux pour une réputée.
- [x] Test core sur le tirage multiple d'un emplacement (fonction pure) —
      `joinMultiDrawTexts`, `src/core/generators/render.test.ts` (3 tests).
- [x] Vérifié en direct : rôtis/desserts/boissons cohérents avec le palier
      de richesse choisi (Modeste vs Réputée testés), relance individuelle
      d'un seul emplacement (`entrees`) confirmée sans toucher les autres.
- [x] Base revérifiée après coup (pas seulement la réponse HTTP du dernier
      appel) : 15 tables du Menu sans doublon de prix, aucun bloc
      `generator` dupliqué sur l'entité (16 sections, 0 clé en double).

### V2-J9bis — Accès direct aux tables depuis l'outil Générateurs · `S` — fait

Question de l'auteur après usage : le contenu des tables (plats, boissons,
noms, objets…) est déjà éditable via l'éditeur de bloc standard d'une fiche
de wiki (`RandomTableBlockEditor.tsx` — clé, dé, entrées avec plage et
texte, ajout/suppression), rien à construire côté édition. Le manque était
l'accès : l'entité "Générateurs de MJ" porte ~90 blocs (16 sections ×
plusieurs tables chacune), il fallait naviguer sur sa fiche wiki et
retrouver la bonne table au milieu de toutes les autres.

Choix fait : une modale légère dans le panneau plutôt qu'un lien vers la
fiche wiki — reste dans l'outil pendant la partie. Nouveau bouton "Éditer
les tables" par section (`GeneratorToolPanel.tsx`), ouvrant
`GeneratorTablesModal` : liste les tables REELLEMENT tirees par la section
pour la variante actuellement selectionnee (nouvelle route
`POST /api/blocks/[blockId]/tables`, service `listGeneratorSectionTables`
dans `src/server/services/generators.ts` — reutilise le meme calcul de cle
resolue + voisins de richesse que le tirage reel, extrait en fonction
partagee `resolveGeneratorVariant` pour que les deux ne divergent jamais),
un `RandomTableBlockEditor` par table trouvee.

**Bug trouvé et corrigé en cours de route** : sauvegarde d'abord tentée au
blur du conteneur (meme motif que `EntityBlocks.tsx`) — rate le cas
"supprimer une ligne puis fermer la modale aussitot", le bouton `×` retire
l'element focus du DOM sans toujours faire sortir le focus du conteneur
avant que React demonte la modale. Remplacee par une sauvegarde debounced
(800ms, adossee a un `useRef` plutot qu'a l'etat React pour eviter la
fermeture perimee classique d'un debounce sur `useState`) + un flush
immediat de toute sauvegarde en attente a la fermeture de la modale.
Verifie en direct : suppression d'une entree suivie d'une fermeture
immediate, persistee en base (re-verifiee par une relecture directe, pas
seulement la reponse HTTP).

**Critères**
- [x] Depuis une section du panneau MJ Générateurs, un MJ peut ouvrir
      l'édition de la ou des tables qu'elle utilise sans quitter l'outil ou
      chercher le bloc à la main.
- [x] Réutilise `RandomTableBlockEditor` existant — pas de nouvel éditeur.
- [x] Vérifié en direct : ajout puis suppression d'une entrée depuis ce
      nouvel accès (avec fermeture immédiate de la modale dans le second
      cas), confirmés en base par relecture directe.

### V2-J9ter — Prix comme champ structuré d'une entrée de table · `S` — fait

Retour utilisateur : le prix d'une entrée (Menu de Taverne) vivait encodé
dans `text` (convention "Nom — Prix", ex. "Bière brune locale — 4 pc"),
jamais une vraie donnée. Nouveau champ optionnel `TableEntry.price?:
{ amount: number; coin: CoinType }` (`src/core/tables/types.ts`), reprenant
le `CoinType` déjà utilisé par le porte-monnaie de l'inventaire
(`src/core/rules/currency.ts`) plutôt qu'une notion de monnaie parallèle.
Propagé tel quel à travers tout le pipeline de tirage — `ResolvedTableDraw`
(`src/server/services/tables.ts`), `GeneratorSlotResult`/`GeneratorSlotItem`
(`src/server/services/generators.ts`) — jusqu'au client, qui affiche
`formatTableEntryPrice` (`src/i18n/fr.ts`, "Gratuit" pour un montant nul)
plutôt que de reparser `text`.

`RandomTableBlockEditor.tsx` gagne deux champs par entrée (montant + pièce)
à côté du texte — un montant vide retire `price` entièrement plutôt que de
forcer un prix à 0 sur une table qui n'en a pas.

**Contenu migré** : les 15 tables du Menu de Taverne (entrées/plats/
desserts × 3 paliers, boissons alcool/sans-alcool × 3 paliers) réécrites en
direct sur l'entité "Générateurs de MJ" — `text` ne porte plus que le nom,
`price` porte le montant structuré. Vérifié après coup : aucune entrée ne
contient plus " — " dans son texte, aucune sans `price`.

**Critères**
- [x] `TableEntry.price` structuré, validé par Zod, jamais infere depuis
      `text`.
- [x] L'éditeur de table a des champs dédiés montant/pièce, pas de texte
      libre pour le prix.
- [x] Le panneau MJ Générateurs affiche le prix formaté sans reparser
      `text` nulle part (plus aucun `.split(" — ")` dans le code).
- [x] Les 15 tables du Menu de Taverne migrées et revérifiées en base.
- [x] Vérifié en direct : tirage du Menu, édition d'un prix depuis la
      modale V2-J9bis, confirmés en base par relecture directe.

### V2-J9quater — Tirage filtré par palier (mécanisme unifié) · `M` — fait

Retour utilisateur, discussion complète : une table "une par palier de
richesse" (le Menu, patron de V2-J9) ne passe pas à l'échelle — une échoppe
qui croise type × richesse × zone exigerait des dizaines de tables à la
main, alors que V2-J15 vise ~100 entrées PAR table. Décision : un seul
mécanisme de filtrage par palier, réutilisé partout (Taverne aujourd'hui,
Échoppe/Butin quand leur tour viendra) — explicitement demandé par
l'auteur ("j'aimerais un fonctionnement qui marche partout pareil").

**Design retenu** (voir aussi V2-J9ter pour `price`, même esprit) :
- `TableEntry.tier?: string` (`src/core/tables/types.ts`) — la clé d'une
  option d'un axe de variante (ex. `wealth`), portée par l'entrée
  elle-même. Une table n'a plus besoin d'être éclatée par palier : TOUTES
  les entrées, tous paliers confondus, vivent dans une seule table.
- `GeneratorTableSlot.tier?: { axis, match: "exact" | "ceiling", target?
  }` (`src/core/generators/types.ts`) — un emplacement dit COMMENT filtrer
  la table qu'il tire : `"exact"` ne garde que les entrées dont `tier`
  correspond à une valeur cible interpolée (réutilise `{axe}` /
  `{axe_below}` / `{axe_above}`, mécanisme V2-J9 inchangé — le Menu veut 3
  points de prix distincts, pas une plage) ; `"ceiling"` garde toute entrée
  dont le palier est ≤ la valeur résolue de l'axe (le cas Échoppe/Butin —
  un objet rare n'apparaît jamais dans un bourg modeste, mais un objet
  commun reste toujours possible dans une capitale réputée).
- Deux nouvelles fonctions PURES, testées : `entriesUpToTier`/
  `entriesAtExactTier` (`src/core/generators/variants.ts`, à côté de
  `orderedNeighbors` qu'elles réutilisent conceptuellement) filtrent ;
  `buildFilteredTable` (`src/core/tables/roll.ts`) replage le sous-ensemble
  filtré de façon CONTIGUË (1..somme des poids) pour réutiliser
  `drawOnce`/`drawMultiple` tels quels — délibérément PAS de second moteur
  de tirage pondéré parallèle, juste une table synthétique passée au
  moteur existant.
- `src/server/services/generators.ts` applique le filtre entre la
  résolution de la clé de table et le tirage lui-même ; un plafond/valeur
  cible sans aucune entrée éligible laisse le `{cle}` du gabarit tel quel,
  même discipline qu'une table introuvable.

**Migration Taverne (ce ticket)** : les 15 tables du Menu (3 paliers ×
5 catégories) fusionnées en 5 tables partagées (`entrees-tavernes`,
`plats-tavernes`, `desserts-tavernes`, `boissons-alcool-tavernes`,
`boissons-sans-alcool-tavernes`), chaque entrée taguée `tier`. Les slots
`entree-simple`/`-moyen`/`-cher` etc. passent de "quelle table" à "quel
palier exact dans LA table", même résultat perçu, un seul mécanisme
derrière. Échoppe (V2-J10) et Butin (V2-J11) consommeront ce même
mécanisme en mode `"ceiling"` quand leur tour viendra — pas construit ici,
leur contenu n'existe pas encore.

**Migration effectuée** : plutôt que créer 5 blocs neufs et supprimer 15
anciens, les 5 blocs `-modeste` de chaque catégorie ont été repurposés en
place (clé renommée `entrees-tavernes` etc., entrées fusionnées avec
`tier`), et les 10 blocs `-correcte`/`-reputee` devenus superflus
supprimés — moins de churn de blocs que tout recréer. `RandomTableBlockEditor`
gagne un champ "Palier" (texte libre, l'éditeur ne connaît pas quel axe
s'applique à quelle table) à côté du prix — sans lui, le champ `tier`
n'aurait été modifiable que par script, jamais depuis l'interface.

**Critères**
- [x] `TableEntry.tier` + `GeneratorTableSlot.tier` validés par Zod (les
      DEUX schémas à jour ensemble — piège déjà rencontré avec `count`,
      V2-J9 : un champ optionnel absent du schéma se fait retirer en
      silence sans que TypeScript le voie).
- [x] `entriesUpToTier`/`entriesAtExactTier`/`buildFilteredTable` testés en
      isolation (fonctions pures, aucun Supabase) — 11 nouveaux tests core
      (739 au total).
- [x] Le Menu de Taverne migré sur 5 tables partagées, comportement
      identique vérifié en direct aux deux extrémités de richesse (Modeste :
      Simple=Moyen=palier modeste, Cher=correcte ; Réputée : Simple=correcte,
      Moyen=Cher=réputée — même clamp qu'en V2-J9, boissons filtrées sur le
      seul palier actif, aucune fuite d'un autre palier).
- [x] Base revérifiée après migration : 0 des 15 anciennes clés de table
      référencées nulle part, 0 bloc dupliqué (46 blocs `random_table` au
      total après migration).
- [x] Champ "Palier" ajouté à `RandomTableBlockEditor` — vérifié en direct
      via la modale V2-J9bis, valeurs modeste/correcte/reputee visibles et
      éditables sur les 5 tables fusionnées.
- [x] `docs/BACKLOG_V2.md` tenu à jour au fur et à mesure (pas seulement à
      la fin) — demande explicite de l'auteur.

### V2-J10 — Objets en vente par type d'échoppe · `S` — fait

Réutilise V2-J7 (axe `type`) + V2-J9 (`count`) + **V2-J9quater** (filtre
par palier, mode `"ceiling"`) : la section "Un objet en vente" d'Échoppe
tire plusieurs objets de la table `objets-{type}` correspondant au type
choisi, au lieu d'un seul auparavant — CHAQUE objet tagué `tier` plutôt
qu'une table par croisement type × richesse × zone (ne passerait pas à
l'échelle, cf. V2-J9quater). **Zéro changement de code** : le mécanisme
V2-J9quater supportait déjà tout ce dont ce ticket avait besoin — que de
la config (`slot.tier = { axis: "wealth", match: "ceiling" }`, `count: 4`)
et du contenu.

Palier retenu : **richesse** de la boutique elle-même (même axe que déjà
affiché dans l'outil), pas la zone — une boutique modeste, même en
capitale, ne stocke pas d'objets chers ; garde le principe "un fonctionnement
qui marche partout pareil" (même axe que le Menu de Taverne) plutôt que de
faire cohabiter deux dimensions de filtrage. La zone reste un axe
d'ambiance narrative, inchangé.

**Contenu** : les 9 tables `objets-{type}` existaient déjà (créées lors de
V2-J7, 3 entrées chacune, sans prix ni palier) — complétées en place plutôt
que recréées : chaque entrée existante reclassée avec un `tier` et un
`price` plausibles, une entrée ajoutée par table pour couvrir les 3
paliers avec 2 entrées chacun (6 entrées/table au total, densité
provisoire — V2-J15 la portera à ~100).

**Critères**
- [x] "Un objet en vente" tire plusieurs objets (jusqu'à 4, `unique_draws`),
      cohérents avec le type choisi ET la richesse (jamais un objet
      réputée sous un plafond modeste ou correcte).
- [x] Vérifié en direct sur 2 types différents (Forgeron, Joaillier) et 2
      plafonds de richesse (Modeste : seulement les 2 objets modestes
      disponibles ; Correcte : mélange modeste+correcte, jamais réputée) —
      plus Réputée testée sur Forgeron : mélange des 3 paliers, confirme
      qu'un objet commun reste possible même au plafond le plus haut.

### V2-J11 — Générateur de Butin (nouvel outil) · `M` — fait

Nouvel outil "Butin" dans le registre, séparé d'Échoppe (décision ci-dessus
— intentions de génération différentes, pas de `promote` : un butin n'est
pas une entité, juste une liste à copier dans les notes de séance, même
discipline que "Noms"). Table construite à la main à partir des objets
magiques du SRD 2024 déjà importés (262 dans `data/srd/srd-2024.json`, pas
362 — le chiffre du SRD 2014, corrigé ici), regroupés par rareté
(`Magic-Items[].rarity.name`) plutôt qu'une table de trésor DMG recopiée
(non-OGL, cf. recherche externe ci-dessus). **Zéro changement de code** :
même mécanisme V2-J9quater que V2-J10, un seul axe "Rareté" (Commun/Peu
commun/Rare/Très rare/Légendaire — le vocabulaire officiel D&D, pas une
échelle inventée) en mode `"ceiling"`.

**Contenu** : 17 objets magiques réels choisis dans les 5 paliers propres
du SRD (`rarity.name` exactement "Common"/"Uncommon"/"Rare"/"Very
Rare"/"Legendary" — les entrées à rareté composée type "Uncommon (+1),
Rare (+2)..." exclues, pas assez propres pour un `tier` simple). Palier
Commun volontairement mince (1 seule entrée, "Potion d'escalade") : le SRD
2024 n'a qu'UN SEUL objet de rareté Commun — inventer des entrées
supplémentaires aurait menti sur la source. Chaque entrée porte une
référence (`TableEntry.refs`, `{kind:"rule", key: entry.index}`) vers sa
vraie fiche de règle SRD — vérifié directement en base (requête
service-role) que les 17 `entry_key` existent bien en `entry_type:
"magic_item"`, pas une supposition. Pas de `price` : les grilles de valeur
gp-par-rareté du DMG ne sont pas OGL (même recherche que ci-dessus), rien
à copier comme substitut sans le vérifier — décision volontaire, pas un
oubli.

**Critères**
- [x] Nouvel onglet "Butin" dans l'outil MJ Générateurs.
- [x] Au moins une table de butin fonctionnelle, organisée par rareté.
- [x] Contenu tiré des objets magiques SRD déjà en base, jamais d'une
      source tierce non vérifiée — chaque entrée référence sa fiche réelle,
      existence confirmée en base.
- [x] Vérifié en direct : plafond Commun (1 seul objet possible, "Potion
      d'escalade") et plafond Légendaire (mélange de plusieurs paliers en
      un seul tirage — Boule de cristal/très rare, Cape du bonimenteur/rare,
      Boule de cristal de vraie vision/légendaire — confirme qu'un objet
      commun reste possible même au plafond le plus haut).

### V2-J12 — Remise en forme de la fiche "Pièces de monnaie" · `S` — fait

La fiche officielle "Pièces de monnaie" (`standard-exchange-rates`, ruleset
officiel de base **2024 uniquement** — le 2014 n'est plus la cible d'aucun
nouveau travail de contenu, retour utilisateur) mélangeait le taux de
conversion des pièces (pc/pa/pe/po/pp) avec « Écuries et fourrage », une
règle sans rapport. En vérifiant le contenu réel (elle ne portait PAS
revente/objets magiques/gemmes/troc — souvenir approximatif), une vraie
règle officielle manquante a été trouvée juste à côté dans le SRD :
« Vente d'équipement » (page 95, jamais importée). Recentrée sur le seul
taux de conversion, remis en forme dans un vrai tableau croisé
pc/pa/pe/po/pp (`custom_table`) plutôt que la phrase de prose d'origine.

**Fait** — `scripts/write-commerce-2024.ts` (committé, `--write` pour
appliquer). Passe par `app.import_srd_entries` (même RPC que
`scripts/ingest-srd.ts`, seul chemin autorisé à modifier une entrée d'un
ruleset officiel — le trigger `entry_blocks_forbid_official_write` bloque
tout le reste). **Piège trouvé en vérifiant en direct** : une entrée peut
porter une surcharge de traduction par locale
(`ruleset_entry_translations.blocks`, SCHEMA.md §9.2) qui masque le bloc de
base à l'affichage — ici, une ancienne traduction française de la
description masquait totalement la correction du bloc de base tant qu'elle
n'était pas vidée elle aussi. Un simple redémarrage du serveur ne suffit
pas à révéler ce genre de décalage : seule une relecture directe en base
(`ruleset_entry_blocks` ET `ruleset_entry_translations`) l'a mis en évidence.

**Critères**
- [x] La fiche "Pièces de monnaie" ne contient plus que le taux de
      conversion, affiché en tableau lisible.
- [x] Aucune donnée perdue : "Écuries et fourrage" vérifiée présente dans
      "Commerce" (V2-J13) avant que la correction ne parte en base.

### V2-J13 — Nouvelle fiche "Commerce" · `S` — fait

Reçoit "Écuries et fourrage" (sorti de "Pièces de monnaie") et un bloc
"Revente" en 4 sous-parties (Armes/armures/équipement, Objets magiques,
Gemmes/bijoux/objets d'art, Troc). Même ruleset officiel de base 2024,
nouvelle entrée `entry_key: "commerce"`, `entry_type: "rule"`.

**Ajustement (4 septembre, retour utilisateur avec capture)** : le premier
jet ne portait que le paragraphe condensé "Vente d'équipement" du SRD 2024
(page 95). L'utilisateur a montré une version plus détaillée en 4
sous-parties — vérifiée : c'est le texte du **SRD 2014**
(`srd-5.1-fr.txt`, lignes 5398-5436, "Revente du trésor"), jamais présente
dans notre app avant ce ticket (confirmé par lecture directe en base avant/
après l'édition). Le 2024 condense la même règle sans jamais mentionner le
troc. Décision utilisateur : garder le découpage 2014 (plus clair à table),
reformulé — pas recopié — puisque la mécanique est identique entre les
deux éditions ici (seule la prose diffère).

**Fait** — même script que V2-J12 (`scripts/write-commerce-2024.ts`) : une
entrée officielle brand-new s'insère par simple `insert` (jamais bloqué par
le trigger, qui ne verrouille que `update`/`delete`), mais la même RPC est
utilisée pour les deux entrées en un seul appel cohérent.

**Critères**
- [x] Nouvelle fiche "Commerce" dans le ruleset officiel 2024, contenu
      complet et lisible.
- [x] "Pièces de monnaie" ne la référence pas en double — le contenu vit à
      un seul endroit (vérifié en direct sur les deux fiches après
      correction de la surcharge de traduction, voir V2-J12).

### V2-J14 — Nouvelle fiche "Train de vie" · `M` — fait

Contenu déjà présent en texte brut dans le dépôt
(`data/srd/fr-source/srd-5.2.1-fr.txt`, lignes ~9881-9995 — pages 107-108
du SRD 2024 officiel) : les 7 paliers de train de vie (mendiant → aristocratique),
la table "Repas, boisson et hébergement", la table "Employés", la table
"Services d'incantation". Jamais importé jusqu'ici (absent du JSON source
structuré, confirmé — seulement dans le texte PDF extrait). Nouvelle entrée
`entry_type: "rule"` du ruleset officiel 2024, blocs `custom_table` pour
chaque table + texte pour les paliers.

**Pourquoi ce ticket compte pour le générateur (V2-J8)** : les paliers de
richesse du générateur Taverne/Échoppe (Aléatoire/Modeste/Correcte/Réputée)
doivent rester cohérents avec les vrais paliers de train de vie du jeu
(mendiant/misérable/pauvre/modeste/confortable/riche/aristocratique) plutôt
que d'inventer une échelle parallèle sans rapport avec les règles. Cette
fiche sert donc de référence de prix pour écrire le contenu de V2-J8/V2-J9
(Menu de taverne à prix croissants, objets en vente par richesse) —
**dépendance de contenu, pas de code** : V2-J8/J9 peuvent démarrer avant,
mais leurs PRIX doivent être vérifiés contre cette fiche une fois écrite.

**Fait** — `scripts/write-lifestyle-expenses-2024.ts` (committé, `--write`
pour appliquer, même RPC `app.import_srd_entries` que V2-J12/J13). Entrée
`entry_key: "lifestyle-expenses"`, nom "Train de vie". Un bloc description
(les 7 paliers) + 3 blocs `custom_table` ("Repas, boisson et hébergement",
"Employés", "Services d'incantation"). Contenu vérifié mot pour mot contre
`data/srd/fr-source/srd-5.2.1-fr.txt` lignes 9906-9995 en l'écrivant, puis
revérifié directement en base après écriture (aucune surcharge de
traduction parasite cette fois — `ruleset_entry_translations.blocks` vide,
piège de V2-J12 non reproduit).

**Critères**
- [x] Nouvelle fiche "Train de vie" dans le ruleset officiel 2024, les 4
      tables/sections du SRD présentes et lisibles.
- [x] Les prix qu'elle porte sont ceux du SRD 2024 officiel, pas inventés.
- [ ] V2-J8/V2-J9, une fois écrits, citent ou réutilisent ces prix plutôt
      qu'une échelle inventée séparément (reste à faire quand ces tickets
      seront pris).

### V2-J15 — Enrichissement du contenu des tables (d100, variété, ton) · `L` — fait (5/5 sous-tickets)

À prendre **une fois tous les outils construits** (V2-J5 à V2-J11 fermés,
Taverne/PNJ/Noms/Échoppe/Butin tous en place — c'est fait). Enrichir le
contenu plutôt que la mécanique. Chaque table `random_table` de l'entité
"Générateurs de MJ" n'a aujourd'hui que 1 à 20 entrées (convention
délibérée de ce lot : « 2-3 exemples, l'auteur complète plus tard », jamais
pensée comme définitive). Deux symptômes concrets déjà observés en jouant
avec l'outil cette session : (1) un tirage simple retombe souvent sur le
même résultat qu'un tirage voisin (2-3 entrées seulement → coïncidence
fréquente) ; (2) un emplacement à tirage multiple avec `unique_draws` (ex.
Boissons, `count: 4`) est parfois forcé d'épuiser presque toute la table à
chaque tirage — zéro variété d'une partie à l'autre.

Absorbe V2-J5 (ci-dessus, abandonné) : porter chaque table à ~100 entrées
distinctes met `die: "d100"` de toute façon, pas la peine de le faire deux
fois.

**Ton** : l'auteur encourage l'humour dans le contenu ajouté — jeux de
mots, clins d'œil à la pop culture — mélangé au contenu plus classique
déjà en place plutôt qu'en remplacement systématique (une table de noms de
tavernes 100% blagues devient lassante à la table de jeu ; un mélange
garde la surprise). Choix au cas par cas en écrivant chaque table.

**Découpage** (inventaire réel au moment du découpage — 55 tables sur
l'entité, réparties par outil) : trop volumineux pour un seul ticket
exécuté d'un coup. Cinq sous-tickets par outil, pris un par un, jamais en
parallèle. Ordre choisi par tractabilité plutôt que par ordre alphabétique
des outils — les groupes les plus petits/bornés d'abord, les deux gros
groupes (Taverne, Échoppe — une vingtaine de tables chacun) en dernier.

- **V2-J15a — Noms** (4 tables : `noms-humains`, `noms-elfes`,
  `noms-nains`, `noms-halfelins`) · **fait** — le plus petit groupe, le
  contenu le plus simple à produire en volume (des noms, pas des
  paragraphes de flaveur), bon premier chantier pour roder la méthode à
  cette échelle. 100 noms distincts par culture (prénom + nom de famille,
  `die: "d100"`), générés par combinaison de deux bassins (~30 prénoms ×
  ~30 noms de famille par culture) avec dédoublonnage vérifié — mélange de
  noms classiques et de quelques jeux de mots par bassin de noms de
  famille (ex. "Roquefort", "Prêt-à-Boire" côté Humain ; "Six-Repas-par-
  Jour", "Bontrou" côté Halfelin), jamais 100% l'un ou l'autre. Vérifié en
  direct : tirage sur les 4 cultures, `d100` confirmé, aucun doublon
  (relecture directe de l'état en base après écriture, 100/100 uniques sur
  chaque table).
- **V2-J15b — Butin** (1 table : `butin-objets-magiques`) · **fait** —
  111 objets sur les ~245 à rareté propre du SRD 2024 (Commun 1/1 — tout
  ce qui existe ; Peu commun 31/73 ; Rare 34/86 ; Très rare 25/53 ;
  Légendaire 20/32), plutôt qu'un chiffre fixe comme discuté ci-dessus.
  Chaque entrée référence sa vraie fiche de règle (`TableEntry.refs`,
  `{kind:"rule", key: <index SRD>}`) — existence des 111 `entry_key`
  vérifiée directement en base (requête service-role) avant écriture, pas
  après coup. Toujours pas de `price` (grilles gp-par-rareté du DMG non
  OGL, décision confirmée en V2-J11). Vérifié en direct : plafond Commun
  (le seul objet possible), plafond Légendaire (mélange de plusieurs
  paliers sur les 111 entrées — Bouteille à efreet/très rare, Bandeau
  d'intelligence/peu commun, Armure d'écailles de dragon/très rare, dans
  un seul tirage).
- **V2-J15c — PNJ** (12 tables : noms, apparence, historique, personnalité
  ×5, quête ×2) · **fait** — 8 tables à 100 (noms, silhouettes,
  particularités, origines, tournants, aspirations, objectifs, récompenses),
  3 réduites à un total honnête plutôt que forcées à 100 (lignes rouges 97,
  limites 90, tics 90 — toutes trois amplement variées mais pas besoin de
  chiffre rond artificiel), et `registres-pnj` volontairement laissée à 34 :
  un registre de voix (« familier », « soutenu »...) sature bien avant 100,
  au-delà ce ne serait que des synonymes du même trait, même logique que le
  palier Commun de Butin (V2-J15b). `origines-pnj`/`tournants-pnj` et
  `registres-pnj`/`tics-pnj` conçues pour s'enchaîner grammaticalement dans
  leur gabarit respectif (`pnj-histoire`, `pnj-personnalite`) quelle que
  soit la combinaison tirée — vérifié en composant plusieurs tirages
  aléatoires, tous lisibles. **Bug trouvé et corrigé en cours de route** :
  5 entrées de `lignes-rouges-pnj` avaient une élision manquante (« ne
  abandonnera » au lieu de « n'abandonnera ») — détecté par une recherche
  ciblée sur le motif `ne` + voyelle en base, corrigé, revérifié.
- **V2-J15d — Taverne** (18 tables : ambiance/patrons/apparence/histoire/
  chambre/menu) · **fait** — 3 tables portées à 100 (noms de tavernes,
  liste directe pour garantir l'accord des articles français plutôt qu'une
  combinatoire risquée) ; le reste à un total honnête entre 48 et 88 selon
  la table (ambiance ×3, patrons ×3, apparence/histoire/chambre ×2 chacune).
  Les 5 tables du Menu (déjà fusionnées avec `tier`+`price` depuis
  V2-J9quater) portées de 6-15 à 24-30 entrées chacune, densité plus faible
  que les tables de texte pur — chaque plat exige un nom ET un prix
  cohérent et distinct au sein de son palier, plus coûteux à produire en
  volume qu'une phrase de flaveur. Prix vérifiés distincts par palier au
  sein de chaque table (contrôle en base après écriture, aucun doublon).
  Vérifié en direct : les 6 sections de Taverne tirées avec succès, Menu
  testé au plafond Réputée — clamp correct (Simple=palier correcte,
  Moyen=Cher=palier réputée), boissons entièrement issues du palier
  réputée, prix cohérents.
- **V2-J15e — Échoppe** (20 tables : ambiance/marchands/apparence/
  histoire/objets ×9) · **fait** — noms de boutiques à 100 (liste
  directe). Le reste des tables de texte entre 32 et 56 entrées selon la
  richesse réelle du sujet (même discipline que Taverne). Les 9 tables
  `objets-{type}` (déjà tier+price depuis V2-J10) triplées de 6 à 18
  entrées chacune (6 par palier), prix vérifiés distincts par palier au
  sein de chaque table. Vérifié en direct : Joaillier + Réputée + Capitale
  — les 5 sections tirées avec succès, "Un objet en vente" montre un vrai
  mélange de paliers (deux objets réputée à plusieurs centaines de pièces
  d'or, deux objets modeste à quelques pièces de cuivre dans le même
  tirage), confirmant qu'un objet modeste reste toujours possible même
  dans la boutique la plus huppée.

**Critères (communs à chaque sous-ticket) — tous les 5 sous-tickets fermés**
- [x] Chaque table du groupe a un `die` recalculé sur son nombre réel
      d'entrées, toutes distinctes (texte non dupliqué ; pour une table à
      prix, champ structuré `price` — V2-J9ter — strictement distinct au
      sein d'une même table). ~100 atteint là où le sujet le permettait
      réellement (les 4 tables de Noms, Noms PNJ, Noms de tavernes, Noms de
      boutiques, objectifs/récompenses de quête PNJ...) ; en dessous par
      choix honnête ailleurs (Butin plafonné par le SRD réel ; Registres
      PNJ à 34, un ton de voix sature vite ; Menu et objets d'échoppe
      limités par le coût de calibrer un prix distinct par entrée) —
      jamais un chiffre rond forcé au prix d'un contenu inventé ou dupliqué.
- [x] Un emplacement à tirage multiple (`count > 1`, `unique_draws`)
      concerné par ce groupe peut effectivement varier d'un tirage à
      l'autre — vérifié en direct sur le Menu de Taverne et les objets
      d'Échoppe, plus jamais forcé d'épuiser toute sa table.
- [x] Mélange constaté de ton classique et humoristique, pas 100% l'un ou
      l'autre (jeux de mots dans les noms de famille/tavernes/boutiques,
      clins d'œil ponctuels dans le reste du contenu).
- [x] Même discipline de vérification que le reste du lot : relecture de
      l'état réel en base après chaque table écrite, contrôle des
      doublons (texte et prix) — un vrai bug trouvé et corrigé en cours de
      route (5 élisions manquantes dans `lignes-rouges-pnj`, V2-J15c),
      jamais confiance à la seule réponse HTTP.

**Méthode** : un ticket à la fois, jamais tous en même temps. Contenu
toujours authored en direct sur l'entité "Générateurs de MJ" (jamais en dur
dans le code) — et **toujours revérifié en relisant l'état réel du bloc
après écriture** (une écriture dupliquée avec un `data.key` correct mais un
contenu resté par défaut s'est produite plusieurs fois cette session — ne
jamais faire confiance à la seule réponse HTTP de l'écriture). **Cause
identifiée en V2-J9** : `ensureGeneratorToolsEntity` (src/server/services/
entities.ts) n'était idempotent qu'en apparence — deux appels presque
simultanés (Fast Refresh + un onglet resté ouvert sur l'outil) peuvent lire
le même état avant d'écrire. Corrigé par un index unique en base
(`blocks_generator_section_key_uniq`, migration `20260904150000`), pas
seulement par convention applicative.
