-- =====================================================================
-- Vagas
-- =====================================================================
--
-- Por que o status é um enum e as listas são tabelas?
-- Os cinco status mudam regras do sistema (o que aparece no site, o que
-- conta no limite), então só devem mudar junto com o código.

create type public.status_vaga as enum (
  'ativa',
  'encerrada_empresa',
  'expirada',
  'removida_admin',
  'suspensa'
);

create type public.origem_vaga as enum ('empresa', 'curada');

create table public.vagas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  origem public.origem_vaga not null,
  status public.status_vaga not null default 'ativa',
  slug text not null unique,

  -- Obrigatórios
  cargo text not null,
  area_principal_id uuid not null references public.areas (id),
  nivel_id uuid not null references public.niveis (id),
  contrato_id uuid not null references public.contratos (id),
  modalidade_id uuid not null references public.modalidades (id),
  cidade_id uuid not null references public.cidades (id),
  atividades text not null,
  requisitos text not null,
  link_candidatura text not null,
  encerra_em date not null,

  -- Opcionais
  areas_secundarias uuid[] not null default '{}',
  salario_min numeric(12, 2),
  salario_max numeric(12, 2),
  salario_a_combinar boolean not null default false,
  beneficios text,
  pcd boolean not null default false,
  como_se_candidatar text,
  observacao text,

  -- Só vagas curadas
  fonte text,
  conferida_em date,

  -- Automáticos
  publicada_em timestamptz not null default now(),
  ultima_confirmacao_em timestamptz not null default now(),
  saiu_do_ar_em timestamptz,
  busca tsvector,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint vagas_cargo_tamanho check (length(trim(cargo)) between 3 and 150),
  constraint vagas_atividades_preenchidas check (length(trim(atividades)) > 0),
  constraint vagas_requisitos_preenchidos check (length(trim(requisitos)) > 0),
  constraint vagas_link_valido check (link_candidatura ~* '^(https?://|mailto:)\S+$'),
  constraint vagas_ate_duas_areas_secundarias check (cardinality(areas_secundarias) <= 2),
  constraint vagas_secundaria_diferente_da_principal check (not (area_principal_id = any (areas_secundarias))),
  constraint vagas_salario_positivo check ((salario_min is null or salario_min > 0) and (salario_max is null or salario_max > 0)),
  constraint vagas_salario_faixa check (salario_min is null or salario_max is null or salario_min <= salario_max),
  constraint vagas_salario_a_combinar_sem_valor check (not salario_a_combinar or (salario_min is null and salario_max is null)),
  constraint vagas_curadoria_so_em_curadas check (origem = 'curada' or (fonte is null and conferida_em is null))
);

comment on table public.vagas is
  'Vagas. Nunca são apagadas: ao sair do ar, mudam de status e ficam para histórico e relatórios.';
comment on column public.vagas.slug is
  'Pedaço do link próprio da vaga (/vagas/<slug>). Gerado na publicação e fixo depois, para não quebrar links compartilhados.';
comment on column public.vagas.areas_secundarias is
  'Até duas áreas extras, só para a busca. Ficam numa lista na própria vaga para que vaga e áreas sejam gravadas juntas.';
comment on column public.vagas.encerra_em is
  'Último dia da vaga no ar (horário de Brasília). No máximo 90 dias depois da publicação.';
comment on column public.vagas.salario_a_combinar is
  'Salário tem três situações: faixa (mínimo e/ou máximo), "a combinar" ou não informado (tudo vazio). Valores mensais, em reais.';
comment on column public.vagas.ultima_confirmacao_em is
  'Última vez que a empresa (ou o admin, nas curadas) confirmou que a vaga continua aberta. Base da checagem de 30 dias.';
comment on column public.vagas.busca is
  'Texto de busca (cargo, empresa, requisitos e atividades), mantido pelo banco.';

create index vagas_empresa on public.vagas (empresa_id, status);
create index vagas_no_ar on public.vagas (status, encerra_em);
create index vagas_area_principal on public.vagas (area_principal_id);
create index vagas_nivel on public.vagas (nivel_id);
create index vagas_contrato on public.vagas (contrato_id);
create index vagas_modalidade on public.vagas (modalidade_id);
create index vagas_cidade on public.vagas (cidade_id);
create index vagas_areas_secundarias on public.vagas using gin (areas_secundarias);
create index vagas_busca on public.vagas using gin (busca);

alter table public.vagas enable row level security;

-- =====================================================================
-- Funções de apoio
-- =====================================================================

-- A vaga está no ar? Ativa, dentro do prazo e de uma empresa ativa.
-- A visão vagas_publicas usa exatamente as mesmas condições.
create or replace function privado.vaga_esta_no_ar(id_vaga uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.vagas v
      join public.empresas e on e.id = v.empresa_id
     where v.id = id_vaga
       and v.status = 'ativa'
       and v.encerra_em >= privado.hoje()
       and e.status = 'ativa'
  )
$$;

-- Gera o link da vaga a partir de cargo, empresa e cidade. Se já existir,
-- acrescenta -2, -3... SECURITY DEFINER porque precisa enxergar as vagas
-- de todas as empresas para não repetir um link.
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
  select privado.gerar_slug(concat_ws(' ', cargo, e.nome_fantasia, c.nome))
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

-- Texto de busca. Cargo e empresa pesam mais (A), depois requisitos (B),
-- onde costumam estar as tecnologias, e atividades (C).
create or replace function privado.calcular_busca_vaga(
  cargo text, id_empresa uuid, requisitos text, atividades text)
returns tsvector
language sql
stable
security definer
set search_path = ''
as $$
  select setweight(to_tsvector('public.portugues_sem_acento', coalesce(cargo, '')), 'A')
      || setweight(to_tsvector('public.portugues_sem_acento',
                               coalesce((select e.nome_fantasia from public.empresas e where e.id = id_empresa), '')), 'A')
      || setweight(to_tsvector('public.portugues_sem_acento', coalesce(requisitos, '')), 'B')
      || setweight(to_tsvector('public.portugues_sem_acento', coalesce(atividades, '')), 'C')
$$;

-- Quantas vagas da empresa contam no limite agora: publicadas pela
-- empresa (curadas não contam), ativas e dentro do prazo.
create or replace function privado.vagas_que_contam_no_limite(id_empresa uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
    from public.vagas
   where empresa_id = id_empresa
     and origem = 'empresa'
     and status = 'ativa'
     and encerra_em >= privado.hoje()
$$;

-- =====================================================================
-- Gatilhos de vagas
-- =====================================================================

-- t10: quem pode gravar o quê, validações e campos automáticos.
create or replace function privado.vagas_antes_de_gravar()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- Colunas que a empresa pode alterar numa vaga no ar.
  colunas_da_empresa constant text[] := array[
    'cargo', 'area_principal_id', 'areas_secundarias', 'nivel_id', 'contrato_id',
    'modalidade_id', 'cidade_id', 'atividades', 'requisitos', 'link_candidatura',
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
  new.areas_secundarias := array(
    select distinct a from unnest(coalesce(new.areas_secundarias, '{}')) as a where a is not null);

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
  if (novo or new.nivel_id is distinct from old.nivel_id)
     and not exists (select 1 from public.niveis where id = new.nivel_id and ativo) then
    raise exception 'Nível inválido ou desativado.';
  end if;
  if (novo or new.contrato_id is distinct from old.contrato_id)
     and not exists (select 1 from public.contratos where id = new.contrato_id and ativo) then
    raise exception 'Contrato inválido ou desativado.';
  end if;
  if (novo or new.modalidade_id is distinct from old.modalidade_id)
     and not exists (select 1 from public.modalidades where id = new.modalidade_id and ativo) then
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

create trigger t10_antes_de_gravar before insert or update on public.vagas
  for each row execute function privado.vagas_antes_de_gravar();

-- t20: limite de vagas no ar.
-- É a última barreira: vale para qualquer caminho (site, API, SQL). A
-- função publicar_vaga usa o erro ST001 para registrar a tentativa e
-- devolver a mensagem para a tela.
create or replace function privado.vagas_checar_limite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  hoje constant date := privado.hoje();
  conta_agora constant boolean :=
    new.status = 'ativa' and new.origem = 'empresa' and new.encerra_em >= hoje;
  ja_contava boolean := false;
  limite integer;
begin
  if tg_op = 'UPDATE' then
    ja_contava := old.status = 'ativa' and old.origem = 'empresa' and old.encerra_em >= hoje;
  end if;

  if not conta_agora or ja_contava then
    return new;
  end if;

  -- Trava a linha da empresa até o fim da transação. Assim, duas
  -- publicações ao mesmo tempo não passam juntas do limite.
  perform 1 from public.empresas where id = new.empresa_id for update;

  limite := privado.limite_efetivo(new.empresa_id);
  if privado.vagas_que_contam_no_limite(new.empresa_id) >= limite then
    raise exception '%', privado.mensagem_limite(limite) using errcode = 'ST001';
  end if;

  return new;
end;
$$;

create trigger t20_checar_limite before insert or update on public.vagas
  for each row execute function privado.vagas_checar_limite();

-- =====================================================================
-- Efeitos de mudanças na empresa sobre as vagas
-- =====================================================================

-- Suspensão, reativação e exclusão de empresa.
create or replace function privado.empresas_status_alterado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  hoje constant date := privado.hoje();
  vagas_livres integer;
begin
  if new.status is not distinct from old.status then
    return null;
  end if;

  -- Suspensa ou excluída: todas as vagas saem do ar na hora.
  if new.status in ('suspensa', 'excluida') then
    update public.vagas
       set status = case
                      when encerra_em < hoje then 'expirada'::public.status_vaga
                      when new.status = 'suspensa' then 'suspensa'::public.status_vaga
                      else 'encerrada_empresa'::public.status_vaga
                    end
     where empresa_id = new.id
       and status = 'ativa';
  end if;

  -- Excluída (LGPD): apaga o contato dos pré-cadastros e remove o login.
  if new.status = 'excluida' then
    update public.pedidos_cadastro
       set email = null,
           telefone = null,
           dados_apagados_em = now()
     where (empresa_id = new.id or cnpj = old.cnpj)
       and dados_apagados_em is null;

    delete from auth.users
     where id in (select u.id from public.usuarios u where u.empresa_id = new.id);
  end if;

  -- Reativada: vagas no prazo voltam ao ar, até o limite da empresa
  -- (as mais antigas primeiro). Vagas curadas voltam todas, porque não
  -- contam no limite. As que passaram do prazo viram "expirada".
  if old.status = 'suspensa' and new.status = 'ativa' then
    update public.vagas
       set status = 'expirada'
     where empresa_id = new.id
       and status = 'suspensa'
       and encerra_em < hoje;

    update public.vagas
       set status = 'ativa'
     where empresa_id = new.id
       and status = 'suspensa'
       and origem = 'curada';

    vagas_livres := privado.limite_efetivo(new.id) - privado.vagas_que_contam_no_limite(new.id);

    update public.vagas v
       set status = 'ativa'
      from (
        select id, row_number() over (order by publicada_em, id) as posicao
          from public.vagas
         where empresa_id = new.id
           and status = 'suspensa'
           and origem = 'empresa'
      ) as fila
     where v.id = fila.id
       and fila.posicao <= vagas_livres;
  end if;

  return null;
end;
$$;

create trigger t30_status_alterado after update of status on public.empresas
  for each row execute function privado.empresas_status_alterado();

-- Se o admin renomear a empresa, atualiza o texto de busca das vagas dela.
-- (O link das vagas não muda: fica fixo depois de publicado.)
create or replace function privado.empresas_nome_alterado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.nome_fantasia is distinct from old.nome_fantasia then
    update public.vagas
       set busca = privado.calcular_busca_vaga(cargo, empresa_id, requisitos, atividades)
     where empresa_id = new.id;
  end if;
  return null;
end;
$$;

create trigger t50_nome_alterado after update of nome_fantasia on public.empresas
  for each row execute function privado.empresas_nome_alterado();
