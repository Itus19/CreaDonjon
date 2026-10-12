-- Trouve le 12 octobre en ecrivant le test de V3-F3 : supprimer un monde qui
-- contient un bloc Image echouait.
--
-- `block_images.asset_id` est obligatoire depuis 20260902190005 (`set not
-- null`), mais sa cle etrangere, posee par 20260902190001 quand la colonne
-- etait encore facultative, dit `on delete set null`. Les deux se
-- contredisent : supprimer une image encore liee a un bloc tente de vider la
-- colonne, et la contrainte `not null` le refuse. Supprimer un monde efface
-- ses images en cascade, donc echouait des qu'un bloc Image existait
-- (« null value in column "asset_id" of relation "block_images" »).
--
-- Un lien de bloc Image sans image n'a pas de sens : il part avec elle.
do $$
declare
  v_nom text;
begin
  select c.conname into v_nom
  from pg_constraint c
  where c.conrelid = 'public.block_images'::regclass
    and c.contype = 'f'
    and c.confrelid = 'public.assets'::regclass;
  if v_nom is not null then
    execute format('alter table public.block_images drop constraint %I', v_nom);
  end if;
end;
$$;

alter table public.block_images
  add constraint block_images_asset_id_fkey
  foreign key (asset_id) references public.assets(id) on delete cascade;
