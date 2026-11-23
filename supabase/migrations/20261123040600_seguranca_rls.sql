-- =====================================================================
-- Segurança: permissões e políticas de Row Level Security (RLS)
-- =====================================================================
--
-- Como funciona:
-- O site conversa com o banco usando uma chave pública, que qualquer
-- pessoa consegue ver no navegador. Quem protege os dados não é a chave,
-- é o banco. São duas camadas:
--
-- 1. Permissões (GRANT): o que cada papel pode fazer em cada tabela.
--    anon = visitante sem login; authenticated = qualquer usuário logado
--    (empresa ou admin).
-- 2. Políticas de RLS: quais LINHAS cada um enxerga ou altera. O RLS foi
--    ligado ao criar cada tabela; sem política, ninguém acessa nada.
--
-- Nas políticas, as funções aparecem como (select privado.funcao()). O
-- "select" faz o PostgreSQL calcular o valor uma vez por consulta, e não
-- uma vez por linha.

-- Começa do zero: o Supabase dá todas as permissões a anon e authenticated
-- por padrão. Abaixo, cada papel recebe só o que precisa.
revoke all on all tables in schema public from anon, authenticated;

-- =====================================================================
-- Listas fixas: todos leem; só o admin cadastra e altera; ninguém apaga
-- =====================================================================
-- Todos leem todos os itens, inclusive os desativados: uma vaga antiga
-- pode apontar para um item desativado e precisa continuar mostrando o nome.

grant select on public.cidades, public.areas, public.niveis, public.contratos, public.modalidades
  to anon, authenticated;
grant insert, update on public.cidades, public.areas, public.niveis, public.contratos, public.modalidades
  to authenticated;

create policy "Todos leem as cidades" on public.cidades
  for select to anon, authenticated using (true);
create policy "Admin cadastra cidades" on public.cidades
  for insert to authenticated with check ((select privado.eh_admin()));
create policy "Admin altera cidades" on public.cidades
  for update to authenticated using ((select privado.eh_admin())) with check ((select privado.eh_admin()));

create policy "Todos leem as áreas" on public.areas
  for select to anon, authenticated using (true);
create policy "Admin cadastra áreas" on public.areas
  for insert to authenticated with check ((select privado.eh_admin()));
create policy "Admin altera áreas" on public.areas
  for update to authenticated using ((select privado.eh_admin())) with check ((select privado.eh_admin()));

create policy "Todos leem os níveis" on public.niveis
  for select to anon, authenticated using (true);
create policy "Admin cadastra níveis" on public.niveis
  for insert to authenticated with check ((select privado.eh_admin()));
create policy "Admin altera níveis" on public.niveis
  for update to authenticated using ((select privado.eh_admin())) with check ((select privado.eh_admin()));

create policy "Todos leem os contratos" on public.contratos
  for select to anon, authenticated using (true);
create policy "Admin cadastra contratos" on public.contratos
  for insert to authenticated with check ((select privado.eh_admin()));
create policy "Admin altera contratos" on public.contratos
  for update to authenticated using ((select privado.eh_admin())) with check ((select privado.eh_admin()));

create policy "Todos leem as modalidades" on public.modalidades
  for select to anon, authenticated using (true);
create policy "Admin cadastra modalidades" on public.modalidades
  for insert to authenticated with check ((select privado.eh_admin()));
create policy "Admin altera modalidades" on public.modalidades
  for update to authenticated using ((select privado.eh_admin())) with check ((select privado.eh_admin()));

-- =====================================================================
-- Planos: só o admin vê e mantém
-- =====================================================================
-- A empresa nunca vê planos nem preços; o limite dela é calculado pelo banco.
grant select, insert, update on public.planos to authenticated;

create policy "Admin vê os planos" on public.planos
  for select to authenticated using ((select privado.eh_admin()));
create policy "Admin cadastra planos" on public.planos
  for insert to authenticated with check ((select privado.eh_admin()));
create policy "Admin altera planos" on public.planos
  for update to authenticated using ((select privado.eh_admin())) with check ((select privado.eh_admin()));

-- =====================================================================
-- Empresas: cada empresa vê e edita só a própria; o admin vê todas
-- =====================================================================
-- O visitante não lê esta tabela. Nome, logo, site e descrição chegam ao
-- site pela visão vagas_publicas, que não tem e-mail nem telefone.
-- Quais colunas a empresa pode alterar é controlado pelo gatilho
-- privado.empresas_antes_de_gravar.
grant select, insert, update on public.empresas to authenticated;

create policy "Empresa vê a própria empresa; admin vê todas" on public.empresas
  for select to authenticated
  using (id = (select privado.minha_empresa_id()) or (select privado.eh_admin()));
create policy "Admin cadastra empresas" on public.empresas
  for insert to authenticated with check ((select privado.eh_admin()));
create policy "Empresa edita a própria empresa; admin edita todas" on public.empresas
  for update to authenticated
  using (id = (select privado.minha_empresa_id()) or (select privado.eh_admin()))
  with check (id = (select privado.minha_empresa_id()) or (select privado.eh_admin()));

-- =====================================================================
-- Pré-cadastros: qualquer pessoa envia; só o admin lê e avalia
-- =====================================================================
-- O visitante só consegue preencher estas colunas. Status, dados da
-- Receita e avaliação ficam de fora, então ele não consegue, por exemplo,
-- mandar um pedido já "aprovado".
grant insert (cnpj, razao_social, nome_fantasia, email, telefone, termos_versao)
  on public.pedidos_cadastro to anon, authenticated;
grant select, update on public.pedidos_cadastro to authenticated;

create policy "Qualquer pessoa envia pré-cadastro" on public.pedidos_cadastro
  for insert to anon, authenticated
  with check (status = 'pendente' and empresa_id is null and avaliado_por is null);
create policy "Admin vê os pré-cadastros" on public.pedidos_cadastro
  for select to authenticated using ((select privado.eh_admin()));
create policy "Admin avalia pré-cadastros" on public.pedidos_cadastro
  for update to authenticated using ((select privado.eh_admin())) with check ((select privado.eh_admin()));

-- =====================================================================
-- Usuários: cada um vê o próprio cadastro; só o admin cria e altera
-- =====================================================================
-- Assim nenhuma empresa consegue se promover a admin ou se ligar a outra
-- empresa.
grant select, insert, update, delete on public.usuarios to authenticated;

create policy "Usuário vê o próprio cadastro; admin vê todos" on public.usuarios
  for select to authenticated
  using (id = (select auth.uid()) or (select privado.eh_admin()));
create policy "Admin cria usuários" on public.usuarios
  for insert to authenticated with check ((select privado.eh_admin()));
create policy "Admin altera usuários" on public.usuarios
  for update to authenticated using ((select privado.eh_admin())) with check ((select privado.eh_admin()));
create policy "Admin remove usuários" on public.usuarios
  for delete to authenticated using ((select privado.eh_admin()));

-- =====================================================================
-- Vagas: cada empresa vê, cria e edita só as próprias; o admin, todas
-- =====================================================================
-- Ninguém tem permissão de apagar (DELETE): vagas ficam para o histórico.
-- O visitante não lê esta tabela; ele vê as vagas no ar pela visão
-- vagas_publicas. O que a empresa pode alterar (e o limite de vagas) é
-- controlado pelos gatilhos da tabela.
grant select, insert, update on public.vagas to authenticated;

create policy "Empresa vê as próprias vagas; admin vê todas" on public.vagas
  for select to authenticated
  using (empresa_id = (select privado.minha_empresa_id()) or (select privado.eh_admin()));
create policy "Empresa cria vagas para si; admin cria para qualquer empresa" on public.vagas
  for insert to authenticated
  with check (empresa_id = (select privado.minha_empresa_id()) or (select privado.eh_admin()));
create policy "Empresa edita as próprias vagas; admin edita todas" on public.vagas
  for update to authenticated
  using (empresa_id = (select privado.minha_empresa_id()) or (select privado.eh_admin()))
  with check (empresa_id = (select privado.minha_empresa_id()) or (select privado.eh_admin()));

-- =====================================================================
-- Métricas: a empresa vê as das próprias vagas; o admin vê todas
-- =====================================================================
-- Ninguém grava direto: só pela função registrar_metrica.
grant select on public.metricas_vaga_dia to authenticated;

create policy "Empresa vê métricas das próprias vagas; admin vê todas" on public.metricas_vaga_dia
  for select to authenticated
  using (
    (select privado.eh_admin())
    or exists (
      select 1
        from public.vagas v
       where v.id = metricas_vaga_dia.vaga_id
         and v.empresa_id = (select privado.minha_empresa_id())
    )
  );

-- =====================================================================
-- Reports: qualquer pessoa reporta uma vaga no ar; só o admin lê e avalia
-- =====================================================================
grant insert (vaga_id, motivo, descricao) on public.reports to anon, authenticated;
grant select, update on public.reports to authenticated;

create policy "Qualquer pessoa reporta uma vaga no ar" on public.reports
  for insert to anon, authenticated
  with check (status = 'pendente' and privado.vaga_esta_no_ar(vaga_id));
create policy "Admin vê os reports" on public.reports
  for select to authenticated using ((select privado.eh_admin()));
create policy "Admin avalia reports" on public.reports
  for update to authenticated using ((select privado.eh_admin())) with check ((select privado.eh_admin()));

-- =====================================================================
-- Histórico de limites e tentativas além do limite: só o admin vê
-- =====================================================================
-- São gravados só por gatilhos e funções do banco; ninguém edita nem apaga.
grant select on public.liberacoes_limite, public.limite_atingido to authenticated;

create policy "Admin vê o histórico de liberações" on public.liberacoes_limite
  for select to authenticated using ((select privado.eh_admin()));
create policy "Admin vê as tentativas além do limite" on public.limite_atingido
  for select to authenticated using ((select privado.eh_admin()));
