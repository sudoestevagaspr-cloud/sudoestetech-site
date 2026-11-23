-- =====================================================================
-- Listas fixas (mantidas pelo admin) e planos
-- =====================================================================
--
-- Por que tabelas, e não tipos fixos (enum) do PostgreSQL?
-- O admin precisa editar estas listas pelo painel. Um enum só muda com
-- uma nova migration. Os itens nunca são apagados, só desativados
-- (ativo = false), para não quebrar vagas antigas que apontam para eles.
--
-- O slug é gerado pelo banco a partir do nome e serve para os filtros na
-- URL (ex.: /vagas?cidade=pato-branco).
--
-- O RLS é ligado logo ao criar cada tabela: sem nenhuma política, ninguém
-- acessa nada pela API. As políticas ficam na migration de segurança.

-- ---------------------------------------------------------------------
-- Planos
-- ---------------------------------------------------------------------
create table public.planos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (length(trim(nome)) > 0),
  limite_vagas_ativas integer not null check (limite_vagas_ativas >= 0),
  padrao boolean not null default false,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.planos is
  'Planos das empresas. Planos pagos no futuro serão só novas linhas aqui, sem mudar código.';
comment on column public.planos.limite_vagas_ativas is
  'Quantas vagas a empresa pode ter no ar ao mesmo tempo. Vagas curadas pelo admin não contam.';
comment on column public.planos.padrao is
  'Plano dado a toda empresa nova. Só um plano pode ser o padrão.';

-- Garante que exista no máximo um plano padrão.
create unique index planos_um_unico_padrao on public.planos (padrao) where padrao;

alter table public.planos enable row level security;
create trigger t90_atualizado_em before update on public.planos
  for each row execute function privado.definir_atualizado_em();

-- ---------------------------------------------------------------------
-- Cidades
-- ---------------------------------------------------------------------
create table public.cidades (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  uf text not null default 'PR' check (uf ~ '^[A-Z]{2}$'),
  slug text not null generated always as (privado.gerar_slug(nome)) stored unique,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (nome, uf)
);

comment on table public.cidades is 'Cidades das vagas, cadastradas pelo admin.';

alter table public.cidades enable row level security;
create trigger t90_atualizado_em before update on public.cidades
  for each row execute function privado.definir_atualizado_em();

-- ---------------------------------------------------------------------
-- Áreas
-- ---------------------------------------------------------------------
create table public.areas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (length(trim(nome)) > 0),
  slug text not null generated always as (privado.gerar_slug(nome)) stored unique,
  ordem integer not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.areas is
  'Áreas de TI. Cada vaga tem uma área principal e até duas secundárias.';

alter table public.areas enable row level security;
create trigger t90_atualizado_em before update on public.areas
  for each row execute function privado.definir_atualizado_em();

-- ---------------------------------------------------------------------
-- Níveis
-- ---------------------------------------------------------------------
create table public.niveis (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (length(trim(nome)) > 0),
  slug text not null generated always as (privado.gerar_slug(nome)) stored unique,
  ordem integer not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.niveis enable row level security;
create trigger t90_atualizado_em before update on public.niveis
  for each row execute function privado.definir_atualizado_em();

-- ---------------------------------------------------------------------
-- Contratos
-- ---------------------------------------------------------------------
create table public.contratos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (length(trim(nome)) > 0),
  slug text not null generated always as (privado.gerar_slug(nome)) stored unique,
  ordem integer not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.contratos enable row level security;
create trigger t90_atualizado_em before update on public.contratos
  for each row execute function privado.definir_atualizado_em();

-- ---------------------------------------------------------------------
-- Modalidades
-- ---------------------------------------------------------------------
create table public.modalidades (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (length(trim(nome)) > 0),
  slug text not null generated always as (privado.gerar_slug(nome)) stored unique,
  remota boolean not null default false,
  ordem integer not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on column public.modalidades.remota is
  'Vaga remota aparece em qualquer cidade filtrada e é exibida como "Remoto — empresa de [cidade]". '
  'É uma coluna própria, e não o nome, para que renomear a modalidade não quebre essa regra.';

alter table public.modalidades enable row level security;
create trigger t90_atualizado_em before update on public.modalidades
  for each row execute function privado.definir_atualizado_em();

-- ---------------------------------------------------------------------
-- Dados iniciais (definidos nos requisitos)
-- ---------------------------------------------------------------------
-- Ficam numa migration, e não no seed.sql, porque o seed só roda no banco
-- local. Estas listas precisam existir também no Supabase de verdade.

insert into public.planos (nome, limite_vagas_ativas, padrao) values
  ('Gratuito', 2, true);

insert into public.contratos (nome, ordem) values
  ('CLT', 1),
  ('PJ', 2),
  ('Estágio obrigatório', 3),
  ('Estágio não obrigatório', 4),
  ('Temporário', 5);

insert into public.niveis (nome, ordem) values
  ('Estágio', 1),
  ('Trainee', 2),
  ('Júnior', 3),
  ('Pleno', 4),
  ('Sênior', 5),
  ('Especialista', 6);

insert into public.modalidades (nome, remota, ordem) values
  ('Presencial', false, 1),
  ('Híbrido', false, 2),
  ('Remoto', true, 3);

insert into public.areas (nome, ordem) values
  ('Suporte técnico e help desk', 1),
  ('Infraestrutura e redes', 2),
  ('Cloud e DevOps', 3),
  ('Desenvolvimento', 4),
  ('Dados e BI', 5),
  ('Inteligência artificial', 6),
  ('Segurança da informação', 7),
  ('Qualidade e testes (QA)', 8),
  ('Implantação e consultoria de sistemas', 9),
  ('Produto e gestão', 10),
  ('UX/UI design', 11),
  ('Banco de dados', 12),
  ('Automação e RPA', 13),
  ('Comercial e pré-venda técnica', 14);
