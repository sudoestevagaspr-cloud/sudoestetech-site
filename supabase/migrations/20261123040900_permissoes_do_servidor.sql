-- =====================================================================
-- Permissões do servidor (service_role) e das tabelas criadas no futuro
-- =====================================================================
--
-- Por que este arquivo existe: o projeto no Supabase foi criado com a opção
-- "Automatically expose new tables" desligada (padrão dos projetos novos
-- desde 30/05/2026). Com ela desligada, as tabelas do schema public não
-- ganham nenhuma permissão automática para anon, authenticated e service_role.
--
-- anon e authenticated já recebem as permissões uma a uma em
-- 20261123040600_seguranca_rls.sql. Faltava o service_role, o papel da chave
-- secreta que só o servidor do site usa (nas próximas fases: aprovar empresa,
-- links de confirmação dos e-mails). Ele ignora o RLS, mas o RLS só é olhado
-- depois do GRANT: sem GRANT, o banco recusa antes ("permission denied").
--
-- Este arquivo também deixa o banco local igual ao de produção. No banco
-- local essa opção não existe e tudo é liberado por padrão, o que esconderia
-- um GRANT esquecido. Por isso ele tira tudo e dá só o necessário.
-- =====================================================================

-- 1. Tabelas criadas daqui para frente não ganham permissão sozinhas.
--    Toda tabela nova precisa de GRANT explícito, como as desta fase.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;

-- 2. O servidor tem o mesmo acesso do admin e também não apaga nada.
revoke all on all tables in schema public from service_role;

-- Listas fixas, planos, empresas, pedidos de cadastro, vagas e reports: ler, criar e alterar.
grant select, insert, update on
  public.cidades, public.areas, public.niveis, public.contratos, public.modalidades,
  public.planos, public.empresas, public.pedidos_cadastro, public.vagas, public.reports
  to service_role;

-- Logins: o servidor liga e desliga o login de uma empresa.
grant select, insert, update, delete on public.usuarios to service_role;

-- Métricas e históricos: só o próprio banco escreve neles (por funções e gatilhos).
grant select on public.metricas_vaga_dia, public.liberacoes_limite, public.limite_atingido
  to service_role;

-- Vitrine pública.
grant select on public.vagas_publicas to service_role;
