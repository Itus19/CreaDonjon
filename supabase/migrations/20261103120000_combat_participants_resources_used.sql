-- V3.1-129 (ADR 0060, reçu de V3.1-79) : l'état des ressources d'une INSTANCE
-- de combat — d'abord la recharge d'une capacité de créature (« Souffle
-- empoisonné (recharge 5–6) »), prête ou dépensée.
--
-- Même forme que `state.resources` d'un personnage : clé de la ressource ->
-- usages consommés (1 = dépensée). Le bloc de la créature reste un modèle :
-- l'état vit ici, une ligne par instance (chaque « Gobelin » a le sien).
--
-- RLS inchangée : `combat_participants_admin` (20261010120000) réserve déjà
-- lecture et écriture au MJ du combat ; une colonne de plus n'y change rien.

alter table combat_participants
  add column resources_used jsonb not null default '{}'::jsonb;

alter table combat_participants
  add constraint combat_participants_resources_used_object
  check (jsonb_typeof(resources_used) = 'object');
