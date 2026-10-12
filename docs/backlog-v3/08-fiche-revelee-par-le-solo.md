# Lot Z — Ce que le mode solo a révélé sur la fiche

*Hors séquence, comme le lot R. Ces tickets ne construisent pas le solo : ils réparent des manques de la **fiche de personnage** que le solo a mis en évidence en la transposant dans une colonne de 300 px. Aucun n'a de dépendance vers les autres lots, et le lot D en suppose deux (voir V3-D5).*

**Un frère vit ailleurs.** `V2.1-26` — l'inspiration et les états, absents de la fiche — a été ouvert dans `docs/BACKLOG_V2.1.md` avant que ce lot existe. Il y reste plutôt que d'être déplacé : un ticket qui change de fichier perd son voisinage, et le sien est le bon (la fiche jouable est un chantier de la V2.1). Les deux se lisent ensemble.

*Partie du backlog V3. L'index, la feuille de route et la table de tous les tickets : [`docs/BACKLOG_V3.md`](../BACKLOG_V3.md). Le cadre commun (ce que S1 a changé, critères transverses) : [`00-cadre.md`](00-cadre.md).*

---

### ☐ V3-Z1 — L'âge du personnage, et l'identité à la création · `M` · sans modèle IA — **fait le 24 septembre, vérification en direct à faire**

**Modèle conseillé : Sonnet** — un champ optionnel et une étape d'assistant ; reste la vérification en direct.

Sous-tâches Haiku : aucune : il reste la vérification en direct de l'assistant, chez l'auteur (`docs/TESTS.md` §4, Fiche).

**Le constat, en deux temps.**

D'abord : **l'âge n'a aucun champ.** `zCharacterBlockData` porte l'espèce, l'historique, les classes, les caractéristiques, les choix, la méthode de PV, le portrait, le genre et les pronoms — pas l'âge. Un `grep -n "\bage\b"` sur `src/core/schemas/blocks/` ne remonte rien. Aujourd'hui il ne peut s'écrire que dans une entrée libre d'un bloc `infobox` : du texte que rien ne valide, que rien ne sait relire, et que l'écran solo ne peut afficher qu'en devinant le nom de l'entrée.

Ensuite, et c'est le vrai sujet : **l'assistant de création ne demande aucun trait d'identité.** Ses neuf étapes (`CharacterCreatorWizard.tsx`) sont Espèce, Classe, Caractéristiques, Points de vie, Historique, Équipement, Compétences, Sorts, Aperçu. Le genre et les pronoms **existent** dans le bloc depuis V1-C4 — mais ne se renseignent que plus tard, sur la fiche, dans la rangée d'identité de `CharacterSheetHeader`. On crée donc un personnage sans jamais pouvoir dire qui il est.

**Le précédent à suivre est déjà écrit.** `gender` et `pronouns` ont été ajoutés après coup au bloc `character`, en `.optional()` — jamais `.default()`, parce qu'un champ absent veut dire « on ne sait pas », ce qui n'est pas la même chose qu'une valeur neutre choisie. Le schéma est `.strict()`, donc un champ de plus se déclare explicitement ; les blocs écrits avant continuent de se valider tant que le champ est optionnel. L'âge suit exactement ce chemin.

**Une décision à prendre : champ typé ou entrée d'infobox ?** L'infobox est la maison des faits d'identité du wiki, et elle ne demande aucun schéma. Mais elle ne se relit pas : ni l'assistant, ni la fiche, ni l'écran solo ne peuvent s'appuyer dessus sans convention tacite sur le nom de l'entrée. **Recommandation : un champ typé optionnel** — et l'infobox reste libre de porter tout ce qui n'a pas de champ.

**Une seconde décision : un âge est-il un nombre ?** Un elfe de 127 ans est jeune, un dragon compte en siècles, et certaines tables écrivent « d'âge mûr ». Un entier oblige à choisir ; une chaîne courte n'interdit rien mais ne se compare pas. **Recommandation : un entier optionnel**, avec l'unité laissée au monde (le calendrier existe déjà) — et une table qui veut écrire « d'âge mûr » le fait dans son infobox, comme aujourd'hui.

- [x] `age` ajouté à `zCharacterBlockData` en `.optional()` — entier, `≥ 0`, jamais de valeur par défaut (ni dans l'assistant, ni dans `BLOCK_DEFAULTS`). Un bloc sans `age` se valide sans changement, et un test le verrouille. **Pas encore vérifié sur une fiche réelle** : la session cloud n'avait ni base ni Docker. À faire chez l'auteur — rouvrir une fiche existante, l'enregistrer, constater qu'elle passe.
- [x] Aucune migration SQL.
- [x] **Une étape « Identité » dans l'assistant de création**, en tête (`IdentityStep.tsx`) : âge, genre, pronoms. **Correction du constat** : le genre se saisissait déjà dans l'assistant, dans la rangée du nom — seuls les pronoms et l'âge manquaient. Le genre y quitte cette rangée pour rejoindre l'étape, où il retrouve les pronoms.
- [x] L'étape est **passable sans rien remplir** : « Suivant » n'y teste rien, et le schéma accepte les trois champs absents.
- [x] L'âge s'édite sur la fiche, dans la rangée d'identité de `CharacterSheetHeader`, après les pronoms. Un seul contrôle, `AgeInput`, partagé avec l'étape : un champ vidé écrit « on ne sait pas » (`undefined`), jamais `0`.
- [x] Il s'affiche dans la rangée d'identité de la fiche (donc aussi dans l'Aperçu de l'assistant, qui la réutilise) **et** dans la colonne solo, qui lit désormais le champ typé. L'entrée d'infobox « Âge » n'y sert plus que de repli pour les fiches écrites avant ce ticket.
- [x] `applyLevelUp` refuse une montée de niveau qui change l'âge, comme il refusait déjà le genre et les pronoms (`forbidden_field_change`).
- [ ] Hors périmètre, et dit comme tel : **proposer une fourchette d'âge d'après l'espèce**. Les entrées d'espèce ne portent pas cette donnée aujourd'hui, et l'ajouter au SRD importé est un autre chantier. À rouvrir si la saisie à l'aveugle gêne réellement.
- [x] `npm run typecheck && npm run lint && npm run test` passent (les tests d'intégration restent ignorés sans base locale, comme d'habitude).
- [ ] **Non testé à la main** : la barre d'étapes, la navigation Précédent/Suivant et l'Aperçu avec la nouvelle étape. Ce sont justement les quatre endroits qui « se testent à la main » d'après la ligne suivante.

**Pourquoi `M` et pas `S`** : le champ est trivial, l'étape d'assistant ne l'est pas. Ajouter une étape touche la barre de progression, la navigation, la reprise d'un brouillon, et l'aperçu final — quatre endroits qui se testent à la main.
