-- =====================================================================
-- Empresas, pré-cadastros, usuários e limites
-- =====================================================================

create type public.status_empresa as enum ('ativa', 'suspensa', 'excluida');
create type public.status_pedido as enum ('pendente', 'aprovado', 'recusado');
create type public.papel_usuario as enum ('admin', 'empresa');

-- Plano dado a toda empresa nova (o marcado como padrão).
create or replace function privado.plano_padrao_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.planos where padrao limit 1
$$;

-- ---------------------------------------------------------------------
-- Empresas
-- ---------------------------------------------------------------------
-- Uma empresa pode ter login (veio de um pré-cadastro aprovado) ou não
-- (registro criado pelo admin para vagas curadas). Quando uma empresa sem
-- login pede acesso, basta ligar um usuário a ela: as vagas antigas
-- continuam ligadas ao mesmo registro.
create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  nome_fantasia text not null check (length(trim(nome_fantasia)) > 0),
  razao_social text,
  cnpj text,
  email_contato text,
  telefone text,
  descricao text,
  site text,
  linkedin text,
  instagram text,
  logo_path text,
  status public.status_empresa not null default 'ativa',
  plano_id uuid not null default privado.plano_padrao_id() references public.planos (id),
  limite_personalizado integer check (limite_personalizado >= 0),
  limite_valido_ate date,
  excluida_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint empresas_cnpj_valido check (cnpj is null or privado.cnpj_valido(cnpj)),
  constraint empresas_email_valido check (email_contato is null or email_contato ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint empresas_site_valido check (site is null or site ~* '^https?://'),
  constraint empresas_linkedin_valido check (linkedin is null or linkedin ~* '^https?://'),
  constraint empresas_instagram_valido check (instagram is null or instagram ~* '^https?://'),
  constraint empresas_validade_exige_limite check (limite_valido_ate is null or limite_personalizado is not null),
  -- O logo fica no Storage, numa pasta com o id da empresa: "<id>/logo.png".
  constraint empresas_logo_na_pasta_da_empresa check (logo_path is null or split_part(logo_path, '/', 1) = id::text)
);

comment on table public.empresas is
  'Empresas. Com login (pré-cadastro aprovado) ou sem login (criadas pelo admin para vagas curadas).';
comment on column public.empresas.cnpj is
  'Só letras e números. Opcional para empresas de vagas curadas; obrigatório para ter login.';
comment on column public.empresas.limite_personalizado is
  'Vazio: vale o limite do plano. Preenchido: a empresa pode ter até esse número de vagas no ar. '
  'Mude pela função definir_limite_personalizado, que registra o motivo no histórico.';
comment on column public.empresas.limite_valido_ate is
  'Último dia em que o limite personalizado vale. Vazio: vale sem prazo.';

-- Um CNPJ só pode estar em uma empresa ativa ou suspensa. Empresas
-- excluídas ficam de fora para não travar um recadastro no futuro.
create unique index empresas_cnpj_unico on public.empresas (cnpj) where status <> 'excluida';
create index empresas_plano on public.empresas (plano_id);

alter table public.empresas enable row level security;

-- ---------------------------------------------------------------------
-- Usuários (quem faz login)
-- ---------------------------------------------------------------------
-- Separado de empresas de propósito: hoje cada empresa tem um login, mas
-- no futuro poderá ter vários. Aí bastará remover o índice único abaixo.
create table public.usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  papel public.papel_usuario not null,
  empresa_id uuid references public.empresas (id),
  criado_em timestamptz not null default now(),

  constraint usuarios_empresa_conforme_papel check ((papel = 'empresa') = (empresa_id is not null))
);

comment on table public.usuarios is
  'Liga o login do Supabase Auth ao papel (admin ou empresa) e à empresa.';

-- v1: um único login por empresa.
create unique index usuarios_um_login_por_empresa on public.usuarios (empresa_id);

alter table public.usuarios enable row level security;

-- ---------------------------------------------------------------------
-- Pré-cadastros (fila de aprovação)
-- ---------------------------------------------------------------------
-- Ficam numa tabela própria, e não em empresas, por três motivos:
-- 1. o pré-cadastro é enviado por um visitante sem login, que assim só
--    consegue inserir nesta tabela, nunca em empresas;
-- 2. um pedido recusado fica guardado e a empresa pode tentar de novo
--    com o mesmo CNPJ;
-- 3. empresas fica só com empresas de verdade (aprovadas ou curadas).
create table public.pedidos_cadastro (
  id uuid primary key default gen_random_uuid(),
  cnpj text not null,
  razao_social text not null check (length(trim(razao_social)) > 0),
  nome_fantasia text not null check (length(trim(nome_fantasia)) > 0),
  email text,
  telefone text,
  termos_versao text not null check (length(trim(termos_versao)) > 0),
  termos_aceitos_em timestamptz not null default now(),
  status public.status_pedido not null default 'pendente',
  dados_receita jsonb,
  empresa_id uuid references public.empresas (id),
  avaliado_por uuid references public.usuarios (id) on delete set null,
  avaliado_em timestamptz,
  observacao_admin text,
  dados_apagados_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint pedidos_cnpj_valido check (privado.cnpj_valido(cnpj)),
  constraint pedidos_contato_obrigatorio check (dados_apagados_em is not null or (email is not null and telefone is not null)),
  constraint pedidos_email_valido check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint pedidos_aprovado_tem_empresa check (status <> 'aprovado' or empresa_id is not null)
);

comment on table public.pedidos_cadastro is
  'Pré-cadastros enviados pelas empresas. Ao aprovar, o admin cria (ou liga) o registro em empresas.';
comment on column public.pedidos_cadastro.dados_receita is
  'Resposta da BrasilAPI (razão social e situação na Receita). Preenchida pelo sistema, nunca pela empresa.';
comment on column public.pedidos_cadastro.termos_versao is
  'Versão dos termos de uso e da política de privacidade aceita no envio.';

-- Só um pedido pendente por CNPJ. Pedidos recusados não contam, então a
-- empresa recusada pode enviar um novo.
create unique index pedidos_um_pendente_por_cnpj on public.pedidos_cadastro (cnpj) where status = 'pendente';
create index pedidos_empresa on public.pedidos_cadastro (empresa_id);
create index pedidos_avaliado_por on public.pedidos_cadastro (avaliado_por);

alter table public.pedidos_cadastro enable row level security;

-- ---------------------------------------------------------------------
-- Histórico de limites personalizados
-- ---------------------------------------------------------------------
-- Preenchido automaticamente por um gatilho sempre que o limite
-- personalizado de uma empresa muda. Ninguém edita nem apaga.
create table public.liberacoes_limite (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  limite integer,
  valido_ate date,
  motivo text not null,
  liberado_por uuid references public.usuarios (id) on delete set null,
  criado_em timestamptz not null default now()
);

comment on table public.liberacoes_limite is
  'Histórico das liberações de limite: quem, quando, limite, validade e motivo. Limite vazio = liberação removida.';

create index liberacoes_empresa on public.liberacoes_limite (empresa_id, criado_em desc);
create index liberacoes_liberado_por on public.liberacoes_limite (liberado_por);

alter table public.liberacoes_limite enable row level security;

-- ---------------------------------------------------------------------
-- Cada vez que uma empresa tentou publicar além do limite
-- ---------------------------------------------------------------------
create table public.limite_atingido (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  limite integer not null,
  ocorrido_em timestamptz not null default now()
);

comment on table public.limite_atingido is
  'Uma linha por tentativa de publicar além do limite. Serve para o admin saber quem quer anunciar mais.';

create index limite_atingido_empresa on public.limite_atingido (empresa_id, ocorrido_em desc);

alter table public.limite_atingido enable row level security;

-- =====================================================================
-- Funções de apoio às regras de acesso
-- =====================================================================
-- São SECURITY DEFINER: rodam com a permissão de quem as criou, e não de
-- quem chamou. Sem isso, uma política em "usuarios" que consulta
-- "usuarios" chamaria a si mesma sem fim.

-- O usuário logado é o admin e passou pela verificação em duas etapas?
-- (aal2 = "authenticator assurance level 2", marcado pelo Supabase Auth no
-- token quando o login usou o segundo fator.)
create or replace function privado.eh_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
     and exists (
       select 1
         from public.usuarios u
        where u.id = (select auth.uid())
          and u.papel = 'admin'
     )
$$;

-- Empresa do usuário logado, só se ela estiver ativa. Empresa suspensa
-- ou excluída devolve vazio, e todas as políticas da empresa falham:
-- é assim que o login dela fica bloqueado dentro do banco.
create or replace function privado.minha_empresa_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.empresa_id
    from public.usuarios u
    join public.empresas e on e.id = u.empresa_id
   where u.id = (select auth.uid())
     and u.papel = 'empresa'
     and e.status = 'ativa'
$$;

-- Usada pelos gatilhos para saber se quem está gravando pode tudo: o
-- admin, o servidor com a chave secreta (service_role), o SQL Editor do
-- Supabase ou uma função do próprio banco. Só "anon" (visitante) e
-- "authenticated" (empresa logada) passam pelas travas.
create or replace function privado.tem_acesso_total()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user not in ('anon', 'authenticated') or privado.eh_admin()
$$;

-- Usada dentro das funções SECURITY DEFINER, onde current_user é sempre o
-- dono da função. Olha o papel que veio no token: sem token (SQL Editor,
-- tarefas agendadas) ou com a chave secreta do servidor.
create or replace function privado.chamada_de_sistema()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select auth.jwt()) ->> 'role', '') not in ('anon', 'authenticated')
$$;

-- Limite que vale hoje para a empresa: o personalizado, se existir e não
-- tiver vencido; senão, o do plano.
create or replace function privado.limite_efetivo(id_empresa uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
           when e.limite_personalizado is not null
            and (e.limite_valido_ate is null or e.limite_valido_ate >= privado.hoje())
           then e.limite_personalizado
           else p.limite_vagas_ativas
         end
    from public.empresas e
    join public.planos p on p.id = e.plano_id
   where e.id = id_empresa
$$;

-- Mensagem exata dos requisitos, com o limite da empresa.
create or replace function privado.mensagem_limite(limite integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select format(
    'Você atingiu o limite de %s. Para anunciar mais vagas, entre em contato pelo e-mail sudoestevagaspr@gmail.com.',
    case when limite = 1 then '1 vaga ativa' else limite || ' vagas ativas' end
  )
$$;

-- =====================================================================
-- Gatilhos de empresas
-- =====================================================================
-- Os gatilhos rodam em ordem alfabética do nome, por isso o número no
-- começo (t10, t20...).

-- Normaliza dados, trava as colunas que só o admin altera e apaga os
-- dados pessoais quando a conta é excluída.
--
-- Por que um gatilho, e não permissão por coluna (GRANT UPDATE (coluna))?
-- O admin e as empresas usam o mesmo papel do PostgreSQL ("authenticated").
-- A permissão por coluna não consegue separar os dois; o gatilho consegue.
create or replace function privado.empresas_antes_de_gravar()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- Colunas que a própria empresa pode alterar. Uma coluna nova fica
  -- travada até alguém incluí-la aqui de propósito.
  colunas_da_empresa constant text[] := array[
    'descricao', 'site', 'linkedin', 'instagram', 'telefone', 'logo_path', 'atualizado_em'];
begin
  new.nome_fantasia := trim(new.nome_fantasia);
  new.cnpj := nullif(privado.normalizar_cnpj(new.cnpj), '');
  new.email_contato := nullif(lower(trim(new.email_contato)), '');

  if tg_op = 'UPDATE' then
    if not privado.tem_acesso_total()
       and (to_jsonb(new) - colunas_da_empresa) is distinct from (to_jsonb(old) - colunas_da_empresa) then
      raise exception 'A empresa só pode alterar logo, descrição, site, redes sociais e telefone.'
        using errcode = '42501',
              hint = 'CNPJ, razão social e os demais dados só o administrador altera.';
    end if;

    if old.status = 'excluida' and new.status <> 'excluida' then
      raise exception 'Uma empresa excluída não pode ser reativada.';
    end if;

    -- LGPD: ao excluir a conta, apaga o contato e o perfil. O nome fica,
    -- para o histórico das vagas antigas.
    if new.status = 'excluida' and old.status <> 'excluida' then
      new.email_contato := null;
      new.telefone := null;
      new.descricao := null;
      new.site := null;
      new.linkedin := null;
      new.instagram := null;
      new.logo_path := null;
      new.excluida_em := now();
    end if;
  end if;

  return new;
end;
$$;

create trigger t10_antes_de_gravar before insert or update on public.empresas
  for each row execute function privado.empresas_antes_de_gravar();
create trigger t90_atualizado_em before update on public.empresas
  for each row execute function privado.definir_atualizado_em();

-- Registra no histórico toda mudança de limite personalizado. O motivo
-- vem da função definir_limite_personalizado; se alguém mudar direto na
-- tabela (pelo Table Editor, por exemplo), fica registrado mesmo assim.
create or replace function privado.empresas_registrar_liberacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.limite_personalizado is null and new.limite_valido_ate is null then
    return null;
  end if;
  if tg_op = 'UPDATE'
     and new.limite_personalizado is not distinct from old.limite_personalizado
     and new.limite_valido_ate is not distinct from old.limite_valido_ate then
    return null;
  end if;

  insert into public.liberacoes_limite (empresa_id, limite, valido_ate, motivo, liberado_por)
  values (
    new.id,
    new.limite_personalizado,
    new.limite_valido_ate,
    coalesce(nullif(current_setting('sudoeste.motivo_limite', true), ''),
             'Alterado direto no banco, sem motivo informado'),
    (select u.id from public.usuarios u where u.id = (select auth.uid()))
  );
  return null;
end;
$$;

create trigger t40_registrar_liberacao after insert or update of limite_personalizado, limite_valido_ate
  on public.empresas
  for each row execute function privado.empresas_registrar_liberacao();

-- ---------------------------------------------------------------------
-- Gatilhos de pré-cadastros
-- ---------------------------------------------------------------------
create or replace function privado.pedidos_antes_de_gravar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.cnpj := privado.normalizar_cnpj(new.cnpj);
  new.email := nullif(lower(trim(new.email)), '');
  new.razao_social := trim(new.razao_social);
  new.nome_fantasia := trim(new.nome_fantasia);
  return new;
end;
$$;

create trigger t10_antes_de_gravar before insert or update on public.pedidos_cadastro
  for each row execute function privado.pedidos_antes_de_gravar();
create trigger t90_atualizado_em before update on public.pedidos_cadastro
  for each row execute function privado.definir_atualizado_em();
