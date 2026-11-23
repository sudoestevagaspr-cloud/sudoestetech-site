-- =====================================================================
-- Aviso ao site: o banco avisa a Cloudflare quando as vagas mudam
-- =====================================================================
--
-- Por que isso existe?
-- O site guarda as páginas prontas em cache na Cloudflare e não consulta
-- o banco a cada visita. Para uma mudança aparecer, alguém precisa avisar
-- o site que o cache ficou velho. Esse "alguém" é o próprio banco:
--
--   1. Uma vaga, empresa ou lista muda (qualquer INSERT/UPDATE/DELETE).
--   2. Um gatilho chama privado.avisar_site().
--   3. A extensão pg_net faz um POST em <site>/api/revalidar, com o
--      segredo no cabeçalho Authorization.
--   4. O site confere o segredo e descarta o cache. A próxima visita
--      monta as páginas de novo, já com os dados novos.
--
-- O pg_net só envia o pedido DEPOIS que a transação é confirmada (commit).
-- Se a gravação der erro e for desfeita, o site não é avisado à toa.
--
-- Uma vez por dia, à meia-noite de Brasília, o pg_cron avisa o site também:
-- é quando as vagas com prazo vencido saem do ar e o selo "Nova" some das
-- vagas com mais de 7 dias, sem nenhuma linha mudar no banco.
--
-- Onde ficam o endereço do site e o segredo?
-- No Vault do Supabase (cofre criptografado), nunca no código. Para
-- configurar, rode no SQL Editor (passo a passo em docs/fase-2-site.md):
--
--   select privado.configurar_aviso_ao_site('https://endereco-do-site');
--
-- A função guarda o endereço, cria o segredo na primeira vez e devolve o
-- segredo, que vai também na Cloudflare (REVALIDAR_SEGREDO). Para trocar o
-- endereço (por exemplo, quando o site passar para sudoestetech.com.br),
-- rode o mesmo comando com o endereço novo: o segredo continua o mesmo.
--
-- Enquanto o Vault não estiver configurado, o aviso simplesmente não é
-- enviado. Nada no banco deixa de funcionar por causa dele.
-- =====================================================================

-- pg_net: pedidos HTTP a partir do banco (funções no schema "net").
create extension if not exists pg_net with schema extensions;

-- pg_cron: tarefas agendadas (tabelas no schema "cron").
create extension if not exists pg_cron with schema pg_catalog;

-- ---------------------------------------------------------------------
-- Nomes dos segredos no Vault
-- ---------------------------------------------------------------------
-- aviso_site_endereco: começo do endereço do site, sem barra no fim
--                      (ex.: https://sudoestetech-site.nome.workers.dev)
-- aviso_site_segredo:  mesmo valor do REVALIDAR_SEGREDO da Cloudflare

-- ---------------------------------------------------------------------
-- Configuração (só pelo SQL Editor)
-- ---------------------------------------------------------------------
-- O segundo parâmetro é opcional: serve para usar um segredo que você já
-- tem (por exemplo, o do arquivo .env.local no computador). Sem ele, o
-- segredo é criado na primeira vez e mantido nas seguintes.
create or replace function privado.configurar_aviso_ao_site(endereco text, segredo_informado text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  limpo text := rtrim(btrim(coalesce(endereco, '')), '/');
  id_endereco uuid;
  id_segredo uuid;
  segredo text;
begin
  if limpo !~ '^https?://[^/[:space:]]+$' then
    raise exception 'Endereço inválido: "%". Use só o começo do endereço do site, como https://sudoestetech-site.seu-nome.workers.dev (sem nada depois do .dev).', endereco;
  end if;
  if segredo_informado is not null and length(segredo_informado) < 32 then
    raise exception 'O segredo precisa ter pelo menos 32 caracteres.';
  end if;

  select id into id_endereco from vault.secrets where name = 'aviso_site_endereco';
  if id_endereco is null then
    perform vault.create_secret(limpo, 'aviso_site_endereco',
                                'Endereço do site que o banco avisa quando as vagas mudam');
  else
    perform vault.update_secret(id_endereco, limpo);
  end if;

  select id, decrypted_secret into id_segredo, segredo
    from vault.decrypted_secrets where name = 'aviso_site_segredo';
  if segredo_informado is not null then
    segredo := segredo_informado;
  elsif segredo is null then
    -- 32 bytes aleatórios = 64 letras e números. Ninguém adivinha.
    segredo := encode(extensions.gen_random_bytes(32), 'hex');
  end if;
  if id_segredo is null then
    perform vault.create_secret(segredo, 'aviso_site_segredo',
                                'Mesmo valor do segredo REVALIDAR_SEGREDO na Cloudflare');
  else
    perform vault.update_secret(id_segredo, segredo);
  end if;

  return segredo;
end;
$$;

comment on function privado.configurar_aviso_ao_site(text, text) is
  'Guarda no Vault o endereço do site e devolve o segredo para colar na Cloudflare (REVALIDAR_SEGREDO).';

-- ---------------------------------------------------------------------
-- O aviso
-- ---------------------------------------------------------------------
-- Devolve o número do pedido no pg_net (para conferir a resposta em
-- net._http_response) ou null quando não avisou.
create or replace function privado.avisar_site()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  endereco text;
  segredo text;
begin
  select decrypted_secret into endereco from vault.decrypted_secrets where name = 'aviso_site_endereco';
  select decrypted_secret into segredo from vault.decrypted_secrets where name = 'aviso_site_segredo';
  if endereco is null or segredo is null then
    return null;
  end if;

  return net.http_post(
    url := endereco || '/api/revalidar',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || segredo
    ),
    timeout_milliseconds := 10000
  );
exception when others then
  -- O aviso nunca pode impedir que uma vaga seja gravada. Se algo falhar
  -- aqui, a gravação segue e o problema fica no log do banco.
  raise warning 'Não foi possível avisar o site: %', sqlerrm;
  return null;
end;
$$;

comment on function privado.avisar_site() is
  'Pede ao site para descartar o cache das páginas (POST em /api/revalidar).';

-- Gatilho: um aviso por transação. Suspender uma empresa, por exemplo,
-- muda a empresa e todas as vagas dela; um aviso só já basta, porque o site
-- relê tudo depois do commit.
create or replace function privado.t95_avisar_site()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('privado.site_avisado', true), '') <> 'sim' then
    perform set_config('privado.site_avisado', 'sim', true);
    perform privado.avisar_site();
  end if;
  return null;
end;
$$;

-- "for each statement": roda uma vez por comando, e não uma vez por linha.
-- Tabelas que aparecem no site: as vagas e tudo o que a vitrine mostra.
create trigger t95_avisar_site after insert or update or delete on public.vagas
  for each statement execute function privado.t95_avisar_site();
create trigger t95_avisar_site after insert or update or delete on public.empresas
  for each statement execute function privado.t95_avisar_site();
create trigger t95_avisar_site after insert or update or delete on public.cidades
  for each statement execute function privado.t95_avisar_site();
create trigger t95_avisar_site after insert or update or delete on public.areas
  for each statement execute function privado.t95_avisar_site();
create trigger t95_avisar_site after insert or update or delete on public.niveis
  for each statement execute function privado.t95_avisar_site();
create trigger t95_avisar_site after insert or update or delete on public.modalidades
  for each statement execute function privado.t95_avisar_site();
create trigger t95_avisar_site after insert or update or delete on public.contratos
  for each statement execute function privado.t95_avisar_site();

-- Ninguém chama essas funções pela API nem pelo login da empresa: só o
-- próprio banco (gatilhos e pg_cron) e o SQL Editor.
revoke all on function privado.configurar_aviso_ao_site(text, text) from public, anon, authenticated, service_role;
revoke all on function privado.avisar_site() from public, anon, authenticated, service_role;
revoke all on function privado.t95_avisar_site() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- Meia-noite de Brasília = 03:00 em UTC (o pg_cron usa UTC). O Brasil
-- não tem horário de verão desde 2019.
-- ---------------------------------------------------------------------
select cron.schedule('avisar-site-meia-noite', '0 3 * * *', 'select privado.avisar_site()');
