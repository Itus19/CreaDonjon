# Orientation — Application locale et IA locale

**Version :** 0.1 — 12 août 2026
**Statut :** orientation prise, décisions techniques ouvertes
**Rôle :** dire ce que la cible locale change *maintenant*, et ce qu'il ne faut surtout pas casser d'ici là

---

## 0. L'information

L'application visera à terme un fonctionnement **local**, avec un **modèle local** — configurable dans l'application ou via Ollama ou LM Studio.

Ce n'est pas un détail de déploiement. C'est un changement d'hypothèse qui touche l'économie du produit, la conception du mode solo, et deux ou trois décisions déjà prises.

---

## 1. La bonne nouvelle : l'architecture actuelle vous protège

Trois disciplines suivies depuis la Phase 0 rendent ce pivot abordable :

| Discipline | Ce qu'elle vous vaut ici |
|---|---|
| `src/core/**` sans dépendance framework ni réseau | le moteur de règles, les formules, la visibilité, la fiche dérivée **fonctionnent tels quels**, en local comme hébergé |
| Les requêtes Supabase confinées à `src/server/repos/**` | changer de base se joue dans un seul dossier, pas dans quinze composants |
| PostgreSQL standard, pas d'extension exotique | la même base tourne en local ; `pgvector` est disponible partout |

Cette contrainte ESLint qui semblait abstraite en Phase 0 est ce qui vous évite aujourd'hui une réécriture. C'est le genre de retour sur investissement qu'on ne voit qu'après coup.

---

## 2. Ce que ça change immédiatement

### 2.1 L'ordre des lots

Détaillé dans `BACKLOG_V1.md` §5. En résumé : la raison de faire l'IA tôt était de mesurer le coût d'un appel avant de concevoir le solo. Avec un modèle local, le coût marginal devient l'électricité et l'attente. L'argument tombe, l'IA passe en dernier.

### 2.2 La dimension des embeddings

**Décision qui devient urgente.** Le schéma fige `vector(1024)`, choisi pour Voyage. Un modèle d'embedding local n'a pas la même dimension.

Ordres de grandeur courants, **à vérifier au moment du choix** — ces modèles bougent vite :

| Modèle local usuel | Dimension |
|---|---|
| `nomic-embed-text` | 768 |
| `mxbai-embed-large` | 1024 |
| `all-minilm` | 384 |

**Recommandation : retenir un modèle à 1024 dimensions**, ce qui laisse le schéma inchangé et garde la compatibilité avec un fournisseur distant si vous offrez aussi une version hébergée. La colonne `embedding_model` permet la cohabitation le temps d'une migration.

À trancher **avant la première indexation**, pas après. C'est la seule décision de ce document qui coûte cher si on la prend trop tard.

### 2.3 La section coûts du PDD

`PDD.md` §32 suppose une facturation à l'appel. Elle reste valable **si** vous proposez aussi une version hébergée ; sinon elle devient un tableau de latences plutôt que de coûts. À ne pas supprimer : tant que les deux options sont ouvertes, les deux économies existent.

---

## 3. Une seule interface, trois adaptateurs

À écrire au lot F, mais à concevoir maintenant pour ne pas se retrouver avec des appels d'API disséminés.

```ts
// src/server/ai/provider.ts
interface AiProvider {
  complete(req: CompletionRequest): Promise<CompletionResult>;
  embed(texts: string[]): Promise<number[][]>;
  capabilities(): { toolCalls: boolean; contextWindow: number; embedDim: number };
}
```

Trois implémentations, mais **deux seulement à écrire** : Ollama et LM Studio exposent tous deux un point d'accès compatible OpenAI, donc un adaptateur générique les couvre. Le troisième est l'API distante.

`capabilities()` n'est pas décoratif : c'est ce qui permet à l'application de désactiver proprement une fonction qu'un modèle donné ne sait pas faire, plutôt que d'échouer à l'usage.

**Le choix du modèle est un réglage du monde ou de l'utilisateur**, pas une constante. C'est aussi ce qui permet d'utiliser un petit modèle rapide pour les résumés et un plus gros pour la narration.

---

## 4. Un modèle local échoue plus souvent. Concevoir pour ça.

Point à énoncer franchement : un modèle de 7 à 13 milliards de paramètres tournant sur une machine personnelle **ne tient pas la sortie structurée** aussi bien qu'une API. Appels d'outils malformés, JSON invalide, champs inventés, instructions oubliées au bout de quelques milliers de tokens.

Trois conséquences de conception, toutes déjà à moitié en place :

**La chaîne proposition → Zod → validation métier → application devient encore plus justifiée.** Elle était une précaution ; elle devient le mécanisme central. Un modèle qui produit un identifiant inventé voit sa proposition rejetée, l'utilisateur voit un message clair, rien n'est corrompu.

**Aucune fonction essentielle ne doit dépendre du succès d'un appel.** Créer une règle se fait à la main ; l'assistant pré-remplit. Écrire une fiche se fait à la main ; l'assistant complète. Générer un nom tire sur une table ; l'IA n'intervient que pour la prose. C'est déjà l'ordre des lots D et E — et c'est maintenant une exigence, plus un confort.

**Prévoir la dégradation, pas seulement l'erreur.** Deux tentatives, puis on rend la main avec le formulaire vide et un message honnête : « le modèle n'a pas produit une structure valide ». Pas de troisième essai silencieux, pas de repli sur du texte libre non validé.

En mode solo, cela signifie qu'un tour raté doit être **rejouable sans perte** — le journal en ajout seul le permet déjà.

---

## 4.5 Un cas d'usage qui exige le local

Argument identifié le 12 août, et c'est le plus fort en faveur de cette orientation.

Une personne qui saisit dans son monde des règles issues d'ouvrages qu'elle possède (`specs/ruleset-personnel.md`) peut vouloir se faire aider : coller le texte, laisser l'assistant en proposer la structure.

**Avec un fournisseur distant, ce texte quitte la machine** et transite chez un tiers, avec ses conditions d'utilisation. Avec Ollama ou LM Studio, il ne sort jamais.

Conséquence de conception : le collage assisté sur du contenu d'ouvrage n'est proposé **que** si un fournisseur local est actif. Avec un fournisseur distant, la fonction reste disponible pour les règles maison, avec un avertissement explicite.

`capabilities()` doit donc exposer aussi `isLocal: boolean` — ce n'est pas une capacité technique mais une propriété de confidentialité, et c'est elle qui conditionne l'accès à cette fonction.

---

## 5. Ce qu'il ne faut pas casser d'ici là

Cinq règles, à ajouter à `CLAUDE.md`.

1. **Aucune fonctionnalité propre à Supabase hébergé** en dehors de ce qui est remplaçable : pas d'Edge Functions, pas de dépendance au temps réel pour une fonction essentielle.
2. **Le SQL reste dans `src/server/repos/**`.** C'est la condition de tout le reste.
3. **Aucune extension Postgres exotique.** `pgcrypto`, `pg_trgm`, `unaccent`, `vector` sont disponibles partout. Rien d'autre sans ADR.
4. **Le stockage de fichiers passe par une interface**, pas par un appel direct à Supabase Storage dans un composant. En local, ce sera le système de fichiers.
5. **Aucun appel d'IA hors de `src/server/ai/`.** Un `fetch` vers un modèle dans un composant est une dette qu'on paiera trois fois.

---

## 6. Questions ouvertes — à trancher avant la V3, pas maintenant

Ce sont de vraies bifurcations. Y répondre trop tôt figerait des choix sans information.

**Local seul, ou local d'abord avec synchronisation ?** C'est la question qui commande toutes les autres. Une application purement locale simplifie énormément — la RLS devient presque décorative, les liens de partage n'ont plus de serveur pour les servir. Mais vos campagnes multi-joueurs et le compagnon PJ supposent un serveur quelque part. L'hypothèse la plus probable : **local pour le travail solo et la préparation, hébergé pour jouer à plusieurs**, avec les mêmes données et un mécanisme de synchronisation. C'est aussi la plus exigeante.

**Quelle base en local ?** Postgres embarqué, Postgres installé par l'utilisateur, ou une variante WASM du type PGlite — dont la prise en charge de `pgvector` et des fonctions `security definer` est à vérifier avant d'en dépendre. Le point de vigilance : vos politiques RLS et vos fonctions `security definer` sont du Postgres authentique. Une base qui ne les gère pas obligerait à remonter toute l'autorisation dans la couche service.

**Quel enrobage ?** Tauri, Electron, ou simplement un serveur local lancé par l'utilisateur. Le troisième est le moins impressionnant et de loin le moins coûteux.

**Que devient le partage ?** Un lien public suppose une machine allumée et joignable. Options : export statique d'un monde, service d'hébergement optionnel, ou aucun partage en mode local.

Chacune mérite un ADR le moment venu. Aucune ne bloque les lots D et E.

---

## 7. Ce que je recommande

**Ne construisez rien pour le local maintenant.** Les cinq règles du §5 suffisent à garder la porte ouverte, et elles ne coûtent rien puisque quatre sur cinq sont déjà en vigueur.

La seule chose à décider tôt est **la dimension des embeddings** — et la retenir à 1024 vous permet précisément de ne pas décider du reste.

Le reste se tranchera quand vous saurez, en ayant fait tourner un modèle local sur vos propres données, ce qu'il sait réellement faire. Cette information vaut plus que n'importe quelle projection faite aujourd'hui.
