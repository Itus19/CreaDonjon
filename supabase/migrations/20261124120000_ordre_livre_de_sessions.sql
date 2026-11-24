-- AG-13 — Le MJ range à la main les pages du Livre de sessions ; le
-- sommaire et le wiki public suivent entities.display_order (colonne
-- existante, V2-G9 : plus grand = plus haut). Aucun changement de schéma.
--
-- Données seulement : jusqu'ici le Livre se triait par date de rendu
-- décroissante, brouillons en tête. On recopie cet ordre dans
-- display_order pour qu'il ne bouge pas au déploiement. Rejouable sans
-- dommage tant que personne n'a encore rangé le Livre à la main.
with rangees as (
  select j.entity_id,
         row_number() over (partition by c.world_id order by j.written_at asc nulls last, e.created_at asc) as rang
  from session_journal_entries j
  join campaigns c on c.id = j.campaign_id
  join entities e on e.id = j.entity_id
  where j.entity_id is not null
)
update entities e
set display_order = rangees.rang * 1000
from rangees
where e.id = rangees.entity_id;
