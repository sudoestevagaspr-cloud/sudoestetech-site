-- =====================================================================
-- Base: schema "privado", extensões e funções utilitárias
-- =====================================================================
--
-- Por que um schema "privado"?
-- O Supabase publica na API tudo o que está no schema "public". As funções
-- auxiliares usadas por gatilhos e políticas de segurança ficam em
-- "privado", que não é exposto: ninguém consegue chamá-las pela API.

create schema if not exists privado;
grant usage on schema privado to anon, authenticated, service_role;

-- unaccent: remove acentos ("Beltrão" -> "Beltrao"). Usado nos links das
-- vagas e na busca por texto.
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------
-- Texto
-- ---------------------------------------------------------------------

-- A função unaccent do PostgreSQL não é marcada como IMMUTABLE (o
-- dicionário pode mudar), e colunas geradas e índices exigem funções
-- IMMUTABLE. Este "embrulho" fixa o dicionário e resolve isso.
create or replace function privado.sem_acento(texto text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, texto)
$$;

-- Transforma um texto em um pedaço de link legível:
-- "Analista de TI Jr. — Pato Branco" -> "analista-de-ti-jr-pato-branco"
create or replace function privado.gerar_slug(texto text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(lower(privado.sem_acento(texto)), '[^a-z0-9]+', '-', 'g'))
$$;

-- Configuração de busca em português que também ignora acentos:
-- quem busca "tecnico" encontra "técnico".
create text search configuration public.portugues_sem_acento (copy = pg_catalog.portuguese);
alter text search configuration public.portugues_sem_acento
  alter mapping for hword, hword_part, word
  with extensions.unaccent, pg_catalog.portuguese_stem;

-- ---------------------------------------------------------------------
-- Datas
-- ---------------------------------------------------------------------

-- O servidor do Supabase roda em UTC. Às 22h de Brasília já é o dia
-- seguinte em UTC, então uma vaga que encerra "hoje" sairia do ar duas
-- horas antes. Toda regra de data usa o dia no horário de Brasília.
create or replace function privado.hoje()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;

-- ---------------------------------------------------------------------
-- CNPJ
-- ---------------------------------------------------------------------

-- Guarda o CNPJ só com letras e números, em maiúsculas:
-- "12.345.678/0001-95" -> "12345678000195"
create or replace function privado.normalizar_cnpj(cnpj text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select upper(regexp_replace(cnpj, '[^0-9A-Za-z]', '', 'g'))
$$;

-- Confere os dígitos verificadores do CNPJ. Aceita o formato numérico e o
-- novo formato alfanumérico da Receita (em uso desde julho de 2026), em
-- que cada caractere vale o código ASCII dele menos 48.
create or replace function privado.cnpj_valido(cnpj text)
returns boolean
language plpgsql
immutable
strict
parallel safe
set search_path = ''
as $$
declare
  pesos_dv1 constant int[] := array[5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  pesos_dv2 constant int[] := array[6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  valores int[];
  soma int;
  dv1 int;
  dv2 int;
begin
  if cnpj !~ '^[0-9A-Z]{12}[0-9]{2}$' then
    return false;
  end if;
  -- "00000000000000", "11111111111111"... passam na conta, mas não existem.
  if cnpj ~ '^(.)\1{13}$' then
    return false;
  end if;

  for i in 1..14 loop
    valores[i] := ascii(substr(cnpj, i, 1)) - 48;
  end loop;

  soma := 0;
  for i in 1..12 loop
    soma := soma + valores[i] * pesos_dv1[i];
  end loop;
  dv1 := case when soma % 11 < 2 then 0 else 11 - soma % 11 end;

  soma := dv1 * pesos_dv2[13];
  for i in 1..12 loop
    soma := soma + valores[i] * pesos_dv2[i];
  end loop;
  dv2 := case when soma % 11 < 2 then 0 else 11 - soma % 11 end;

  return valores[13] = dv1 and valores[14] = dv2;
end;
$$;

-- ---------------------------------------------------------------------
-- Gatilho genérico: mantém a coluna atualizado_em
-- ---------------------------------------------------------------------
create or replace function privado.definir_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;
