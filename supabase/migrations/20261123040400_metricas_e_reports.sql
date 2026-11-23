-- =====================================================================
-- Métricas por vaga e reports de candidatos
-- =====================================================================

-- ---------------------------------------------------------------------
-- Métricas: uma linha por vaga por dia, com os totais somados
-- ---------------------------------------------------------------------
-- Guardar cada clique como uma linha encheria o banco gratuito rápido.
-- Somar por dia dá o mesmo gráfico para a empresa e ocupa muito menos.
create table public.metricas_vaga_dia (
  vaga_id uuid not null references public.vagas (id),
  dia date not null,
  visualizacoes integer not null default 0 check (visualizacoes >= 0),
  cliques_candidatura integer not null default 0 check (cliques_candidatura >= 0),
  primary key (vaga_id, dia)
);

comment on table public.metricas_vaga_dia is
  'Por vaga e por dia: quantos abriram os detalhes e quantos clicaram em "Candidatar-se". '
  'Não chamar de candidaturas: a candidatura acontece fora do site.';

alter table public.metricas_vaga_dia enable row level security;

-- ---------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------
create type public.motivo_report as enum (
  'golpe_ou_vaga_falsa',
  'vaga_ja_preenchida',
  'link_quebrado',
  'informacao_errada',
  'conteudo_discriminatorio',
  'outro'
);

create type public.status_report as enum ('pendente', 'procedente', 'improcedente');

-- O candidato não se identifica: o site não guarda dados de candidatos.
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  vaga_id uuid not null references public.vagas (id),
  motivo public.motivo_report not null,
  descricao text check (descricao is null or length(descricao) <= 1000),
  status public.status_report not null default 'pendente',
  avaliado_por uuid references public.usuarios (id) on delete set null,
  avaliado_em timestamptz,
  observacao_admin text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.reports is
  'Reports de vagas. Chegam primeiro ao admin; só um report procedente gera e-mail para a empresa.';

create index reports_vaga on public.reports (vaga_id);
create index reports_pendentes on public.reports (criado_em) where status = 'pendente';
create index reports_avaliado_por on public.reports (avaliado_por);

alter table public.reports enable row level security;
create trigger t90_atualizado_em before update on public.reports
  for each row execute function privado.definir_atualizado_em();
