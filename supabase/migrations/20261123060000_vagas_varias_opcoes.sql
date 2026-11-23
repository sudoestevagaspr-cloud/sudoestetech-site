-- =====================================================================
-- Vagas com mais de um nível, contrato ou modalidade, e vagas curadas sem
-- nível ou sem prazo informado (decisões do Luan, 23/11/2026)
-- =====================================================================
--
-- O que muda:
--
-- 1. Nível, contrato e modalidade viram listas (como as áreas
--    secundárias): uma vaga pode ser "Júnior ou Pleno", "CLT ou PJ",
--    "Presencial ou Híbrido". As colunas nivel_id, contrato_id e
--    modalidade_id dão lugar a niveis, contratos e modalidades.
--
-- 2. Contrato e modalidade: pelo menos um em qualquer vaga.
--    Nível: pelo menos um na vaga da empresa; a vaga curada pode ficar
--    sem nenhum, porque a fonte nem sempre informa.
--
-- 3. Prazo não informado (prazo_informado = false), só em vaga curada:
--    a vaga continua com uma data de encerramento, escolhida pelo admin,
--    e sai do ar nela como qualquer outra. O site só não mostra essa data;
--    mostra "Prazo não informado, candidate-se logo".
--
-- Vaga com alguma modalidade remota aparece no filtro de qualquer cidade
-- (aceita_remoto). Só a vaga em que todas as modalidades são remotas é
-- exibida como "Remoto — empresa de <cidade>" (somente_remoto).
--
-- De carona (passo 7): o link de uma vaga nova não repete a cidade quando
-- ela já está no nome da empresa ("Unimed Pato Branco").

-- ---------------------------------------------------------------------
-- 1. A vitrine usa as colunas antigas: sai agora e volta no fim (passo 6)
-- ---------------------------------------------------------------------
drop view public.vagas_publicas;

-- ---------------------------------------------------------------------
-- 2. Colunas novas, com os dados das antigas
-- ---------------------------------------------------------------------
alter table public.vagas
  add column niveis uuid[] not null default '{}',
  add column contratos uuid[] not null default '{}',
  add column modalidades uuid[] not null default '{}',
  add column prazo_informado boolean not null default true;

-- Copia o nível, o contrato e a modalidade de cada vaga já cadastrada.
-- Os gatilhos ficam desligados só nesta cópia: ela não muda nada que eles
-- confiram, e assim a cópia não mexe em "atualizado_em" nem avisa o site.
alter table public.vagas disable trigger user;
update public.vagas
   set niveis = array[nivel_id],
       contratos = array[contrato_id],
       modalidades = array[modalidade_id];
alter table public.vagas enable trigger user;

-- As colunas antigas saem (os índices delas saem junto).
alter table public.vagas
  drop column nivel_id,
  drop column contrato_id,
  drop column modalidade_id;

alter table public.vagas
  add constraint vagas_nivel_obrigatorio_fora_das_curadas
    check (origem = 'curada' or cardinality(niveis) > 0),
  add constraint vagas_contrato_obrigatorio check (cardinality(contratos) > 0),
  add constraint vagas_modalidade_obrigatoria check (cardinality(modalidades) > 0),
  add constraint vagas_prazo_obrigatorio_fora_das_curadas
    check (origem = 'curada' or prazo_informado);

create index vagas_niveis on public.vagas using gin (niveis);
create index vagas_contratos on public.vagas using gin (contratos);
create index vagas_modalidades on public.vagas using gin (modalidades);

comment on column public.vagas.niveis is
  'Níveis da vaga (ids de public.niveis). Pelo menos um na vaga da empresa; a curada pode ficar sem nenhum.';
comment on column public.vagas.contratos is
  'Tipos de contrato da vaga (ids de public.contratos). Pelo menos um.';
comment on column public.vagas.modalidades is
  'Modalidades da vaga (ids de public.modalidades). Pelo menos uma.';
comment on column public.vagas.prazo_informado is
  'false: a fonte não informou prazo (só em vaga curada). O site mostra "Prazo não informado" no lugar da data; '
  'a vaga sai do ar em encerra_em do mesmo jeito.';

-- ---------------------------------------------------------------------
-- 3. Gatilho t10 (quem grava o quê e validações)
-- ---------------------------------------------------------------------
-- Igual ao da migration 20261123040300, com estas mudanças:
-- - as listas niveis, contratos e modalidades no lugar das colunas antigas,
--   inclusive na lista do que a empresa pode alterar (colunas_da_empresa);
-- - nível vazio só na vaga curada;
-- - a vaga da empresa sempre fica com prazo_informado = true, e a empresa
--   não muda isso depois (a coluna não está em colunas_da_empresa);
-- - as listas de ids ficam sempre em ordem (antes, as áreas secundárias
--   podiam mudar de ordem sozinhas e ser conferidas de novo à toa).
create or replace function privado.vagas_antes_de_gravar()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- Colunas que a empresa pode alterar numa vaga no ar.
  colunas_da_empresa constant text[] := array[
    'cargo', 'area_principal_id', 'areas_secundarias', 'niveis', 'contratos',
    'modalidades', 'cidade_id', 'atividades', 'requisitos', 'link_candidatura',
    'encerra_em', 'salario_min', 'salario_max', 'salario_a_combinar', 'beneficios',
    'pcd', 'como_se_candidatar', 'observacao', 'status', 'atualizado_em'];
  acesso_total constant boolean := privado.tem_acesso_total();
  hoje constant date := privado.hoje();
  novo boolean := tg_op = 'INSERT';
begin
  -- 1. Quem grava ------------------------------------------------------
  if novo then
    if acesso_total then
      -- Admin cadastrando: por padrão é vaga curada.
      new.origem := coalesce(new.origem, 'curada');
    else
      -- Empresa cadastrando: o banco decide empresa, origem e status, não
      -- importa o que tenha vindo do navegador.
      new.empresa_id := privado.minha_empresa_id();
      if new.empresa_id is null then
        raise exception 'Sua empresa não está ativa no sistema.' using errcode = '42501';
      end if;
      new.origem := 'empresa';
      new.status := 'ativa';
      new.fonte := null;
      new.conferida_em := null;
      new.prazo_informado := true;
      new.publicada_em := now();
      new.ultima_confirmacao_em := now();
      new.saiu_do_ar_em := null;
      new.criado_em := now();
      new.slug := null;
    end if;
  elsif not acesso_total then
    if old.status <> 'ativa' or old.encerra_em < hoje then
      raise exception 'Esta vaga já saiu do ar e não pode mais ser alterada.'
        using errcode = '42501',
              hint = 'Para anunciar de novo, duplique a vaga e publique uma nova.';
    end if;
    if (to_jsonb(new) - colunas_da_empresa) is distinct from (to_jsonb(old) - colunas_da_empresa) then
      raise exception 'A empresa não pode alterar este dado da vaga.' using errcode = '42501';
    end if;
    if new.status not in ('ativa', 'encerrada_empresa') then
      raise exception 'A empresa só pode encerrar a vaga.' using errcode = '42501';
    end if;
  end if;

  -- 2. Limpeza ---------------------------------------------------------
  new.cargo := trim(new.cargo);
  -- Listas de ids: sem vazios nem repetidos, sempre na mesma ordem (assim
  -- uma lista que não mudou continua igual e não é conferida de novo).
  new.areas_secundarias := array(
    select distinct a from unnest(coalesce(new.areas_secundarias, '{}')) as a where a is not null order by a);
  new.niveis := array(
    select distinct a from unnest(coalesce(new.niveis, '{}')) as a where a is not null order by a);
  new.contratos := array(
    select distinct a from unnest(coalesce(new.contratos, '{}')) as a where a is not null order by a);
  new.modalidades := array(
    select distinct a from unnest(coalesce(new.modalidades, '{}')) as a where a is not null order by a);

  -- 3. Listas: só itens ativos em vagas novas ou campos alterados -------
  if (novo or new.area_principal_id is distinct from old.area_principal_id)
     and not exists (select 1 from public.areas where id = new.area_principal_id and ativo) then
    raise exception 'Área principal inválida ou desativada.';
  end if;
  if (novo or new.areas_secundarias is distinct from old.areas_secundarias)
     and exists (
       select 1 from unnest(new.areas_secundarias) as a
        where not exists (select 1 from public.areas where id = a and ativo)) then
    raise exception 'Área secundária inválida ou desativada.';
  end if;
  if cardinality(new.areas_secundarias) > 2 then
    raise exception 'A vaga pode ter no máximo 2 áreas secundárias.';
  end if;
  if new.area_principal_id = any (new.areas_secundarias) then
    raise exception 'A área secundária não pode ser igual à área principal.';
  end if;
  -- Nível: a vaga curada pode ficar sem nenhum (a fonte nem sempre informa);
  -- a vaga da empresa precisa de pelo menos um.
  if cardinality(new.niveis) = 0 and new.origem is distinct from 'curada' then
    raise exception 'Informe pelo menos um nível.';
  end if;
  if (novo or new.niveis is distinct from old.niveis)
     and exists (
       select 1 from unnest(new.niveis) as a
        where not exists (select 1 from public.niveis where id = a and ativo)) then
    raise exception 'Nível inválido ou desativado.';
  end if;
  if cardinality(new.contratos) = 0 then
    raise exception 'Informe pelo menos um contrato.';
  end if;
  if (novo or new.contratos is distinct from old.contratos)
     and exists (
       select 1 from unnest(new.contratos) as a
        where not exists (select 1 from public.contratos where id = a and ativo)) then
    raise exception 'Contrato inválido ou desativado.';
  end if;
  if cardinality(new.modalidades) = 0 then
    raise exception 'Informe pelo menos uma modalidade.';
  end if;
  if (novo or new.modalidades is distinct from old.modalidades)
     and exists (
       select 1 from unnest(new.modalidades) as a
        where not exists (select 1 from public.modalidades where id = a and ativo)) then
    raise exception 'Modalidade inválida ou desativada.';
  end if;
  if (novo or new.cidade_id is distinct from old.cidade_id)
     and not exists (select 1 from public.cidades where id = new.cidade_id and ativo) then
    raise exception 'Cidade inválida ou desativada.';
  end if;

  -- 4. Data de encerramento ---------------------------------------------
  if new.status = 'ativa' and new.encerra_em < hoje
     and (novo or new.encerra_em is distinct from old.encerra_em or old.status <> 'ativa') then
    raise exception 'A data de encerramento não pode estar no passado.';
  end if;
  if (novo or new.encerra_em is distinct from old.encerra_em)
     and new.encerra_em > (new.publicada_em at time zone 'America/Sao_Paulo')::date + 90 then
    raise exception 'A data de encerramento pode ser no máximo 90 dias depois da publicação.';
  end if;

  -- 5. Campos automáticos ------------------------------------------------
  if novo and new.slug is null then
    new.slug := privado.gerar_slug_vaga(new.cargo, new.empresa_id, new.cidade_id);
  end if;

  if new.status = 'ativa' then
    new.saiu_do_ar_em := null;
  elsif novo or old.status = 'ativa' then
    new.saiu_do_ar_em := now();
  end if;

  new.busca := privado.calcular_busca_vaga(new.cargo, new.empresa_id, new.requisitos, new.atividades);

  if not novo then
    new.atualizado_em := now();
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. publicar_vaga
-- ---------------------------------------------------------------------
-- Igual à da migration 20261123040500, com as listas novas e o
-- prazo_informado (o admin vai usar no painel; para a empresa, o gatilho
-- força true). No JSON: "niveis": ["<id>", ...], e o mesmo para
-- "contratos" e "modalidades".
create or replace function public.publicar_vaga(dados jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v public.vagas;
  nova public.vagas;
begin
  -- Converte o JSON recebido numa linha de vaga. Chaves desconhecidas são
  -- ignoradas; empresa, origem e status de uma empresa são decididos pelo
  -- gatilho, não pelo que veio do navegador.
  v := jsonb_populate_record(null::public.vagas, dados);

  begin
    insert into public.vagas (
      empresa_id, origem, cargo, area_principal_id, areas_secundarias, niveis,
      contratos, modalidades, cidade_id, atividades, requisitos, link_candidatura,
      encerra_em, prazo_informado, salario_min, salario_max, salario_a_combinar, beneficios, pcd,
      como_se_candidatar, observacao, fonte, conferida_em
    ) values (
      v.empresa_id, v.origem, v.cargo, v.area_principal_id, coalesce(v.areas_secundarias, '{}'),
      coalesce(v.niveis, '{}'), coalesce(v.contratos, '{}'), coalesce(v.modalidades, '{}'),
      v.cidade_id, v.atividades, v.requisitos, v.link_candidatura,
      v.encerra_em, coalesce(v.prazo_informado, true), v.salario_min, v.salario_max,
      coalesce(v.salario_a_combinar, false), v.beneficios,
      coalesce(v.pcd, false), v.como_se_candidatar, v.observacao, v.fonte, v.conferida_em
    )
    returning * into nova;
  exception
    when sqlstate 'ST001' then
      perform privado.registrar_limite_atingido(coalesce(privado.minha_empresa_id(), v.empresa_id));
      return jsonb_build_object('ok', false, 'codigo', 'limite_atingido', 'mensagem', sqlerrm);
  end;

  return jsonb_build_object('ok', true, 'id', nova.id, 'slug', nova.slug);
end;
$$;

revoke execute on function public.publicar_vaga(jsonb) from public, anon;
grant execute on function public.publicar_vaga(jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5. (sem mudanças nas outras funções: nenhuma usava as colunas antigas)
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 6. Vitrine pública, de volta
-- ---------------------------------------------------------------------
-- Mesma regra da migration 20261123040700: só vagas no ar e só colunas
-- públicas, com security_invoker = false DE PROPÓSITO (a visão é a regra
-- de acesso; não troque para true, ou o site para de mostrar as vagas).
--
-- Nível, contrato e modalidade vêm em listas (ids, nomes e slugs), na
-- ordem das listas fixas. No site:
--   filtro de cidade: cidade_slug = 'pato-branco' or aceita_remoto
--   filtro de nível: 'junior' = any (niveis_slugs)  (o mesmo para modalidade)
--   "Remoto — empresa de <cidade_nome>": quando somente_remoto
create view public.vagas_publicas
with (security_invoker = false)
as
select
  v.id,
  v.slug,
  v.cargo,

  v.empresa_id,
  e.nome_fantasia as empresa_nome,
  e.logo_path as empresa_logo_path,
  e.descricao as empresa_descricao,
  e.site as empresa_site,
  e.linkedin as empresa_linkedin,
  e.instagram as empresa_instagram,

  v.cidade_id,
  c.nome as cidade_nome,
  c.uf as cidade_uf,
  c.slug as cidade_slug,

  v.modalidades,
  array(select m.nome from public.modalidades m where m.id = any (v.modalidades) order by m.ordem, m.nome)
    as modalidades_nomes,
  array(select m.slug from public.modalidades m where m.id = any (v.modalidades) order by m.ordem, m.nome)
    as modalidades_slugs,
  exists (select 1 from public.modalidades m where m.id = any (v.modalidades) and m.remota)
    as aceita_remoto,
  not exists (select 1 from public.modalidades m where m.id = any (v.modalidades) and not m.remota)
    as somente_remoto,

  v.niveis,
  array(select n.nome from public.niveis n where n.id = any (v.niveis) order by n.ordem, n.nome)
    as niveis_nomes,
  array(select n.slug from public.niveis n where n.id = any (v.niveis) order by n.ordem, n.nome)
    as niveis_slugs,

  v.contratos,
  array(select ct.nome from public.contratos ct where ct.id = any (v.contratos) order by ct.ordem, ct.nome)
    as contratos_nomes,
  array(select ct.slug from public.contratos ct where ct.id = any (v.contratos) order by ct.ordem, ct.nome)
    as contratos_slugs,

  v.area_principal_id,
  a.nome as area_principal_nome,
  a.slug as area_principal_slug,
  v.areas_secundarias,
  array_prepend(v.area_principal_id, v.areas_secundarias) as todas_areas,

  v.atividades,
  v.requisitos,
  v.link_candidatura,
  v.como_se_candidatar,
  v.encerra_em,
  v.prazo_informado,
  v.salario_min,
  v.salario_max,
  v.salario_a_combinar,
  v.beneficios,
  v.pcd,
  v.observacao,
  v.publicada_em,
  v.busca
from public.vagas v
join public.empresas e on e.id = v.empresa_id
join public.cidades c on c.id = v.cidade_id
join public.areas a on a.id = v.area_principal_id
where v.status = 'ativa'
  and v.encerra_em >= privado.hoje()
  and e.status = 'ativa';

comment on view public.vagas_publicas is
  'Vagas no ar, só com dados públicos. É a única forma de o visitante ler vagas.';

-- As mesmas permissões de antes: só leitura, para todos e para o servidor.
revoke all on public.vagas_publicas from anon, authenticated, service_role;
grant select on public.vagas_publicas to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 7. Link da vaga sem repetir a cidade
-- ---------------------------------------------------------------------
-- Igual à da migration 20261123040300, com uma mudança: quando o nome da
-- empresa já tem o nome da cidade ("Unimed Pato Branco"), a cidade não
-- entra de novo. Fica /vagas/analista-de-ti-jr-unimed-pato-branco, como no
-- exemplo dos requisitos, e não ...-unimed-pato-branco-pato-branco.
-- Vale só para vagas novas: o link de uma vaga publicada não muda (decisão 7).
create or replace function privado.gerar_slug_vaga(cargo text, id_empresa uuid, id_cidade uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text;
  candidato text;
  n integer := 1;
begin
  -- O '-' nas pontas compara palavras inteiras: a cidade "Ampére" não é
  -- confundida com uma empresa chamada "Amperex".
  select privado.gerar_slug(concat_ws(' ', cargo, e.nome_fantasia,
           case when '-' || privado.gerar_slug(e.nome_fantasia) || '-' like '%-' || c.slug || '-%'
                then null
                else c.nome
           end))
    into base
    from public.empresas e, public.cidades c
   where e.id = id_empresa
     and c.id = id_cidade;

  base := trim(both '-' from left(coalesce(nullif(base, ''), 'vaga'), 90));
  candidato := base;
  while exists (select 1 from public.vagas where slug = candidato) loop
    n := n + 1;
    candidato := base || '-' || n;
  end loop;
  return candidato;
end;
$$;
