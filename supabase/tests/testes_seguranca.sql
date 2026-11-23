-- =====================================================================
-- Testes de segurança e regras do banco (Fase 1)
-- =====================================================================
--
-- Como rodar no Supabase: abra o SQL Editor, cole este arquivo inteiro e
-- clique em "Run". O resultado é uma tabela com um teste por linha. A
-- primeira linha é o resumo.
--
-- Como rodar no banco local: npm run db:test
--
-- O que o script faz: cria duas empresas de teste (A e B), uma empresa
-- curada, um admin e um visitante, e "entra" como cada um deles para
-- conferir o que cada um consegue ou não fazer. No final, desfaz tudo:
-- nenhum dado de teste fica no banco.
--
-- Como ele "entra" como alguém: igual ao Supabase faz em cada requisição
-- do site. Troca o papel do PostgreSQL (anon ou authenticated) e preenche
-- o token (request.jwt.claims) com o id do usuário.
-- =====================================================================

create or replace function pg_temp.resultado(teste text, passou boolean, detalhe text default null)
returns jsonb
language sql
as $$
  select jsonb_build_object('teste', teste, 'passou', coalesce(passou, false), 'detalhe', detalhe)
$$;

-- Entra como visitante sem login.
create or replace function pg_temp.como_visitante()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
end;
$$;

-- Entra como um usuário logado. aal2 = passou pela verificação em duas etapas.
create or replace function pg_temp.como_usuario(usuario uuid, nivel_login text default 'aal1')
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', usuario, 'role', 'authenticated', 'aal', nivel_login)::text, true);
end;
$$;

-- Volta a ser o próprio banco (sem travas), para preparar e conferir dados.
create or replace function pg_temp.como_sistema()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Executa um comando e devolve a mensagem de erro (ou null se deu certo).
create or replace function pg_temp.erro(comando text)
returns text
language plpgsql
as $$
begin
  execute comando;
  return null;
exception when others then
  return sqlerrm;
end;
$$;

-- Executa um comando e devolve quantas linhas ele alterou.
create or replace function pg_temp.linhas(comando text)
returns integer
language plpgsql
as $$
declare
  n integer;
begin
  execute comando;
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function pg_temp.rodar_testes()
returns table (numero integer, teste text, resultado text, detalhe text)
language plpgsql
as $$
declare
  r jsonb := '[]';
  hoje constant date := privado.hoje();
  mensagem_limite_2 constant text :=
    'Você atingiu o limite de 2 vagas ativas. Para anunciar mais vagas, entre em contato pelo e-mail sudoestevagaspr@gmail.com.';

  admin_id uuid := gen_random_uuid();
  usuario_a uuid := gen_random_uuid();
  usuario_b uuid := gen_random_uuid();
  usuario_sem_cadastro uuid := gen_random_uuid();
  empresa_a uuid := gen_random_uuid();
  empresa_b uuid := gen_random_uuid();
  empresa_curada uuid := gen_random_uuid();

  cidade_um uuid;
  cidade_dois uuid;
  area1 uuid;
  area2 uuid;
  area3 uuid;
  area4 uuid;
  nivel1 uuid;
  contrato1 uuid;
  presencial uuid;
  remoto uuid;

  base_vaga jsonb;
  resp jsonb;
  vaga_a1 uuid;
  vaga_a2 uuid;
  vaga_a3 uuid;
  vaga_a4 uuid;
  vaga_a5 uuid;
  vaga_curada_a uuid;
  vaga_b1 uuid;
  slug_antes text;
  n bigint;
  n2 bigint;
  msg text;
  msg2 text;
  txt text;

begin
  begin
    -- =================================================================
    -- Preparação (como sistema)
    -- =================================================================
    perform pg_temp.como_sistema();

    select string_agg(c.relname, ', ' order by c.relname) into txt
      from pg_class c
      join pg_namespace s on s.oid = c.relnamespace
     where s.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
    r := r || pg_temp.resultado('Toda tabela do schema public tem RLS ligado', txt is null,
                                'Tabelas sem RLS: ' || txt);

    -- Pega itens ativos das listas pela ordem, para o teste não depender
    -- dos nomes (o admin pode renomear).
    select id into area1 from public.areas where ativo order by ordem, nome offset 0 limit 1;
    select id into area2 from public.areas where ativo order by ordem, nome offset 1 limit 1;
    select id into area3 from public.areas where ativo order by ordem, nome offset 2 limit 1;
    select id into area4 from public.areas where ativo order by ordem, nome offset 3 limit 1;
    select id into nivel1 from public.niveis where ativo order by ordem, nome limit 1;
    select id into contrato1 from public.contratos where ativo order by ordem, nome limit 1;
    select id into presencial from public.modalidades where ativo and not remota order by ordem, nome limit 1;
    select id into remoto from public.modalidades where ativo and remota order by ordem, nome limit 1;

    insert into public.cidades (nome) values ('Cidade Teste Um') returning id into cidade_um;
    insert into public.cidades (nome) values ('Cidade Teste Dois') returning id into cidade_dois;

    insert into auth.users (id, email) values
      (admin_id, 'admin@teste.invalid'),
      (usuario_a, 'empresa-a@teste.invalid'),
      (usuario_b, 'empresa-b@teste.invalid'),
      (usuario_sem_cadastro, 'sem-cadastro@teste.invalid');

    insert into public.empresas (id, nome_fantasia, razao_social, cnpj, email_contato, telefone) values
      (empresa_a, 'Empresa Teste A', 'EMPRESA TESTE A LTDA', '11.222.333/0001-81', 'contato@a.teste.invalid', '46 99999-0001'),
      (empresa_b, 'Empresa Teste B', 'EMPRESA TESTE B LTDA', '11.444.777/0001-61', 'contato@b.teste.invalid', '46 99999-0002'),
      (empresa_curada, 'Empresa Curada Teste', null, null, null, null);

    insert into public.usuarios (id, papel, empresa_id) values
      (admin_id, 'admin', null),
      (usuario_a, 'empresa', empresa_a),
      (usuario_b, 'empresa', empresa_b);

    base_vaga := jsonb_build_object(
      'cargo', 'Analista de TI Jr',
      'area_principal_id', area1,
      'nivel_id', nivel1,
      'contrato_id', contrato1,
      'modalidade_id', presencial,
      'cidade_id', cidade_um,
      'atividades', 'Atender usuários e manter a rede.',
      'requisitos', 'Conhecimento em redes, SQL e Python.',
      'link_candidatura', 'https://exemplo.com.br/vaga',
      'encerra_em', hoje + 30);

    -- =================================================================
    -- Visitante
    -- =================================================================
    perform pg_temp.como_visitante();

    select count(*) into n from public.areas;
    r := r || pg_temp.resultado('Visitante lê as listas fixas', n > 0, n || ' áreas');

    msg := pg_temp.erro('insert into public.areas (nome) values (''Área criada por visitante'')');
    r := r || pg_temp.resultado('Visitante não cadastra itens nas listas', msg is not null, msg);

    txt := null;
    foreach msg2 in array array['empresas', 'vagas', 'planos', 'usuarios', 'pedidos_cadastro',
                                'reports', 'metricas_vaga_dia', 'liberacoes_limite', 'limite_atingido'] loop
      if pg_temp.erro(format('select count(*) from public.%I', msg2)) is null then
        txt := concat_ws(', ', txt, msg2);
      end if;
    end loop;
    r := r || pg_temp.resultado('Visitante não lê nenhuma tabela interna (empresas, vagas, planos, usuários...)',
                                txt is null, 'Conseguiu ler: ' || txt);

    -- =================================================================
    -- Empresa A publica vagas
    -- =================================================================
    perform pg_temp.como_usuario(usuario_a);

    resp := public.publicar_vaga(base_vaga);
    vaga_a1 := (resp ->> 'id')::uuid;
    r := r || pg_temp.resultado('Empresa publica uma vaga, que vai ao ar sem aprovação',
                                (resp ->> 'ok')::boolean, resp::text);

    r := r || pg_temp.resultado('O banco gera o link legível da vaga (cargo + empresa + cidade)',
                                resp ->> 'slug' = 'analista-de-ti-jr-empresa-teste-a-cidade-teste-um', resp ->> 'slug');

    resp := public.publicar_vaga(base_vaga || jsonb_build_object(
      'cargo', 'Desenvolvedor Python', 'empresa_id', empresa_b, 'origem', 'curada', 'fonte', 'inventada'));
    vaga_a2 := (resp ->> 'id')::uuid;
    perform pg_temp.como_sistema();
    r := r || pg_temp.resultado('Empresa não consegue publicar em nome de outra (o banco usa a empresa do login)',
                                coalesce((select v.empresa_id = empresa_a and v.origem = 'empresa' and v.fonte is null
                                            from public.vagas v where v.id = vaga_a2), false), resp::text);

    perform pg_temp.como_usuario(usuario_a);
    resp := public.publicar_vaga(base_vaga || '{"cargo": "Terceira vaga"}');
    r := r || pg_temp.resultado('Plano gratuito: a 3ª vaga no ar é barrada com a mensagem combinada',
                                (resp ->> 'ok')::boolean = false and resp ->> 'mensagem' = mensagem_limite_2,
                                resp ->> 'mensagem');

    perform pg_temp.como_sistema();
    select count(*) into n from public.limite_atingido where empresa_id = empresa_a;
    r := r || pg_temp.resultado('A tentativa além do limite fica registrada', n = 1, n || ' registro(s)');

    perform pg_temp.como_usuario(usuario_a);
    msg := pg_temp.erro(format(
      'insert into public.vagas (cargo, area_principal_id, nivel_id, contrato_id, modalidade_id, cidade_id, '
      'atividades, requisitos, link_candidatura, encerra_em) values (%L, %L, %L, %L, %L, %L, %L, %L, %L, %L)',
      'Vaga direta na tabela', area1, nivel1, contrato1, presencial, cidade_um, 'x', 'y', 'https://exemplo.com.br', hoje + 10));
    r := r || pg_temp.resultado('Inserir direto na tabela, sem a função, também respeita o limite',
                                msg = mensagem_limite_2, msg);

    -- Uma vaga curada pelo admin para a empresa A (não conta no limite).
    perform pg_temp.como_sistema();
    insert into public.vagas (empresa_id, origem, cargo, area_principal_id, nivel_id, contrato_id,
                              modalidade_id, cidade_id, atividades, requisitos, link_candidatura, encerra_em, fonte)
    values (empresa_a, 'curada', 'Vaga curada da A', area1, nivel1, contrato1, presencial, cidade_um,
            'x', 'y', 'https://exemplo.com.br', hoje + 15, 'LinkedIn')
    returning id into vaga_curada_a;

    -- =================================================================
    -- Empresa A encerra e edita vagas
    -- =================================================================
    perform pg_temp.como_usuario(usuario_a);
    n := pg_temp.linhas(format('update public.vagas set status = ''encerrada_empresa'' where id = %L', vaga_a1));
    perform pg_temp.como_sistema();
    select count(*) into n2 from public.vagas
     where id = vaga_a1 and status = 'encerrada_empresa' and saiu_do_ar_em is not null;
    r := r || pg_temp.resultado('Empresa encerra a própria vaga a qualquer momento', n = 1 and n2 = 1);

    perform pg_temp.como_visitante();
    select count(*) into n from public.vagas_publicas where id = vaga_a1;
    select count(*) into n2 from public.vagas_publicas where id = vaga_a2;
    r := r || pg_temp.resultado('Vaga encerrada sai da vitrine; as outras continuam', n = 0 and n2 = 1);

    perform pg_temp.como_usuario(usuario_a);
    msg := pg_temp.erro(format('update public.vagas set status = ''ativa'' where id = %L', vaga_a1));
    msg2 := pg_temp.erro(format('update public.vagas set cargo = ''Outro cargo'' where id = %L', vaga_a1));
    r := r || pg_temp.resultado('Vaga encerrada não pode ser reaberta nem editada',
                                msg is not null and msg2 is not null, msg);

    resp := public.publicar_vaga(base_vaga || '{"cargo": "Vaga depois de encerrar"}');
    vaga_a3 := (resp ->> 'id')::uuid;
    r := r || pg_temp.resultado('Encerrar uma vaga libera espaço, e a vaga curada não conta no limite',
                                (resp ->> 'ok')::boolean, resp::text);

    msg := pg_temp.erro(format('update public.vagas set status = ''removida_admin'' where id = %L', vaga_a2));
    r := r || pg_temp.resultado('Empresa não muda o status para removida ou expirada', msg is not null, msg);

    select slug into slug_antes from public.vagas where id = vaga_a2;
    msg := pg_temp.erro(format('update public.vagas set slug = ''outro-link'' where id = %L', vaga_a2));
    msg2 := pg_temp.erro(format('update public.vagas set publicada_em = now() - interval ''1 day'' where id = %L', vaga_a2));
    r := r || pg_temp.resultado('Empresa não altera o link nem a data de publicação', msg is not null and msg2 is not null, msg);

    n := pg_temp.linhas(format(
      'update public.vagas set cargo = ''Desenvolvedor Python Pleno'', requisitos = ''Python, Django e Power BI'' where id = %L',
      vaga_a2));
    select count(*) into n2 from public.vagas where id = vaga_a2 and slug = slug_antes and cargo = 'Desenvolvedor Python Pleno';
    r := r || pg_temp.resultado('Empresa edita a própria vaga, e o link continua o mesmo', n = 1 and n2 = 1);

    perform pg_temp.como_visitante();
    select count(*) into n from public.vagas_publicas
     where id = vaga_a2 and busca @@ websearch_to_tsquery('public.portugues_sem_acento', 'django');
    select count(*) into n2 from public.vagas_publicas
     where id = vaga_a2 and busca @@ websearch_to_tsquery('public.portugues_sem_acento', 'empresa teste');
    r := r || pg_temp.resultado('A busca por texto encontra tecnologia e nome da empresa', n = 1 and n2 = 1);

    -- =================================================================
    -- Empresa A e os próprios dados
    -- =================================================================
    perform pg_temp.como_usuario(usuario_a);
    select count(*) into n from public.empresas;
    r := r || pg_temp.resultado('Empresa vê só a própria empresa', n = 1, n || ' empresa(s) visível(is)');

    n := pg_temp.linhas(format(
      'update public.empresas set descricao = ''Nova descrição'', telefone = ''46 3333-0000'', '
      'site = ''https://a.teste.invalid'' where id = %L', empresa_a));
    r := r || pg_temp.resultado('Empresa altera descrição, site e telefone da própria empresa', n = 1);

    msg := pg_temp.erro(format('update public.empresas set cnpj = ''11444777000161'' where id = %L', empresa_a));
    msg2 := pg_temp.erro(format('update public.empresas set razao_social = ''OUTRA RAZAO'' where id = %L', empresa_a));
    r := r || pg_temp.resultado('Empresa não altera CNPJ nem razão social', msg is not null and msg2 is not null, msg);

    msg := pg_temp.erro(format('update public.empresas set limite_personalizado = 50 where id = %L', empresa_a));
    msg2 := pg_temp.erro(format('update public.empresas set status = ''suspensa'' where id = %L', empresa_a));
    r := r || pg_temp.resultado('Empresa não altera o próprio limite nem o status', msg is not null and msg2 is not null, msg);

    msg := pg_temp.erro(format('update public.empresas set logo_path = %L where id = %L', empresa_b || '/logo.png', empresa_a));
    r := r || pg_temp.resultado('O logo da empresa só pode apontar para a pasta dela', msg is not null, msg);

    select count(*) into n from public.planos;
    r := r || pg_temp.resultado('Empresa não vê planos', n = 0);

    n := pg_temp.linhas(format('update public.usuarios set papel = ''admin'', empresa_id = null where id = %L', usuario_a));
    perform pg_temp.como_sistema();
    select count(*) into n2 from public.usuarios where id = usuario_a and papel = 'empresa';
    r := r || pg_temp.resultado('Empresa não se promove a admin', n = 0 and n2 = 1);

    perform pg_temp.como_usuario(usuario_a);
    msg := pg_temp.erro(format('select public.definir_limite_personalizado(%L, 10, null, ''quero mais'')', empresa_a));
    r := r || pg_temp.resultado('Empresa não libera mais vagas para si mesma', msg is not null, msg);

    msg := pg_temp.erro('insert into public.cidades (nome) values (''Cidade criada por empresa'')');
    r := r || pg_temp.resultado('Empresa não cadastra itens nas listas', msg is not null, msg);

    -- =================================================================
    -- Empresa B tentando mexer nas coisas da A
    -- =================================================================
    perform pg_temp.como_usuario(usuario_b);

    select count(*) into n from public.vagas where empresa_id = empresa_a;
    select count(*) into n2 from public.vagas where id = vaga_a1;
    r := r || pg_temp.resultado('Empresa B não vê nenhuma vaga da A (nem as encerradas)', n = 0 and n2 = 0);

    n := pg_temp.linhas(format('update public.vagas set cargo = ''Invadido'' where id = %L', vaga_a2));
    n2 := pg_temp.linhas(format('update public.vagas set status = ''encerrada_empresa'' where id = %L', vaga_a2));
    r := r || pg_temp.resultado('Empresa B não edita nem encerra vaga da A', n = 0 and n2 = 0);

    select count(*) into n from public.empresas where id = empresa_a;
    n2 := pg_temp.linhas(format('update public.empresas set descricao = ''Invadido'' where id = %L', empresa_a));
    r := r || pg_temp.resultado('Empresa B não vê nem edita os dados da A', n = 0 and n2 = 0);

    msg := pg_temp.erro(format('select public.excluir_conta_empresa(%L)', empresa_a));
    r := r || pg_temp.resultado('Empresa B não exclui a conta da A', msg is not null, msg);

    msg := pg_temp.erro(format('delete from public.vagas where id = %L', vaga_a2));
    perform pg_temp.como_usuario(admin_id, 'aal2');
    msg2 := pg_temp.erro(format('delete from public.vagas where id = %L', vaga_a2));
    r := r || pg_temp.resultado('Ninguém apaga vagas, nem o admin (ficam para o histórico)',
                                msg is not null and msg2 is not null, msg2);

    -- =================================================================
    -- Validações (empresa B, que ainda não tem vagas)
    -- =================================================================
    perform pg_temp.como_usuario(usuario_b);

    msg := pg_temp.erro(format('select public.publicar_vaga(%L::jsonb)',
                               base_vaga || jsonb_build_object('encerra_em', hoje - 1)));
    r := r || pg_temp.resultado('Data de encerramento no passado é recusada', msg is not null, msg);

    msg := pg_temp.erro(format('select public.publicar_vaga(%L::jsonb)',
                               base_vaga || jsonb_build_object('encerra_em', hoje + 91)));
    msg2 := pg_temp.erro(format('select public.publicar_vaga(%L::jsonb)',
                                base_vaga || jsonb_build_object('cargo', 'Vaga de 90 dias', 'encerra_em', hoje + 90)));
    r := r || pg_temp.resultado('Data de encerramento: até 90 dias depois da publicação',
                                msg is not null and msg2 is null, msg);

    msg := pg_temp.erro(format('select public.publicar_vaga(%L::jsonb)',
                               base_vaga || jsonb_build_object('areas_secundarias', jsonb_build_array(area2, area3, area4))));
    r := r || pg_temp.resultado('No máximo 2 áreas secundárias', msg is not null, msg);

    msg := pg_temp.erro(format('select public.publicar_vaga(%L::jsonb)',
                               base_vaga || jsonb_build_object('areas_secundarias', jsonb_build_array(area1))));
    r := r || pg_temp.resultado('Área secundária igual à principal é recusada', msg is not null, msg);

    msg := pg_temp.erro(format('select public.publicar_vaga(%L::jsonb)',
                               base_vaga || '{"salario_a_combinar": true, "salario_min": 3000}'));
    msg2 := pg_temp.erro(format('select public.publicar_vaga(%L::jsonb)',
                                base_vaga || '{"salario_min": 5000, "salario_max": 3000}'));
    r := r || pg_temp.resultado('Salário: "a combinar" sem valor, e mínimo não maior que o máximo',
                                msg is not null and msg2 is not null, msg2);

    msg := pg_temp.erro(format('select public.publicar_vaga(%L::jsonb)',
                               base_vaga || '{"link_candidatura": "mande o currículo no whats"}'));
    r := r || pg_temp.resultado('Link de candidatura precisa ser um link (https:// ou mailto:)', msg is not null, msg);

    perform pg_temp.como_sistema();
    update public.areas set ativo = false where id = area4;
    perform pg_temp.como_usuario(usuario_b);
    msg := pg_temp.erro(format('select public.publicar_vaga(%L::jsonb)',
                               base_vaga || jsonb_build_object('area_principal_id', area4)));
    perform pg_temp.como_sistema();
    update public.areas set ativo = true where id = area4;
    r := r || pg_temp.resultado('Item desativado de uma lista não pode ser usado em vaga nova', msg is not null, msg);

    perform pg_temp.como_usuario(usuario_b);
    resp := public.publicar_vaga(base_vaga || jsonb_build_object(
      'cargo', 'Desenvolvedor Remoto', 'modalidade_id', remoto, 'cidade_id', cidade_dois,
      'areas_secundarias', jsonb_build_array(area2, area3), 'salario_min', 4000, 'salario_max', 6000));
    vaga_b1 := (resp ->> 'id')::uuid;
    r := r || pg_temp.resultado('Vaga com áreas secundárias e faixa salarial é aceita', (resp ->> 'ok')::boolean, resp::text);

    -- =================================================================
    -- Vitrine pública
    -- =================================================================
    perform pg_temp.como_visitante();

    select count(*) into n from public.vagas_publicas where empresa_id in (empresa_a, empresa_b);
    r := r || pg_temp.resultado('Visitante vê na vitrine só as vagas no ar', n = 5, n || ' vaga(s) (esperado: 5)');

    select string_agg(column_name, ', ') into txt
      from information_schema.columns
     where table_schema = 'public' and table_name = 'vagas_publicas'
       and column_name in ('email_contato', 'telefone', 'cnpj', 'razao_social', 'plano_id',
                           'limite_personalizado', 'fonte', 'status');
    r := r || pg_temp.resultado('A vitrine não tem e-mail, telefone, CNPJ nem dados internos', txt is null,
                                'Colunas indevidas: ' || txt);

    select count(*) into n from public.vagas_publicas
     where id = vaga_b1 and (cidade_id = cidade_um or modalidade_remota);
    r := r || pg_temp.resultado('Vaga remota aparece no filtro de qualquer cidade', n = 1);

    select count(*) into n from public.vagas_publicas
     where todas_areas @> array[area3] and id = vaga_b1;
    r := r || pg_temp.resultado('O filtro de área considera as áreas secundárias', n = 1);

    -- Simula a passagem do tempo: a vaga A3 venceu ontem. O gatilho que
    -- recusa datas no passado é desligado só para esta preparação.
    perform pg_temp.como_sistema();
    alter table public.vagas disable trigger t10_antes_de_gravar;
    update public.vagas set encerra_em = hoje - 1 where id = vaga_a3;
    alter table public.vagas enable trigger t10_antes_de_gravar;

    perform pg_temp.como_visitante();
    select count(*) into n from public.vagas_publicas where id = vaga_a3;
    r := r || pg_temp.resultado('Vaga com prazo vencido some da vitrine na hora, antes de qualquer tarefa agendada', n = 0);

    -- =================================================================
    -- Métricas
    -- =================================================================
    perform pg_temp.como_visitante();
    perform public.registrar_metrica(vaga_a2, 'visualizacao');
    perform public.registrar_metrica(vaga_a2, 'visualizacao');
    perform public.registrar_metrica(vaga_a2, 'clique_candidatura');
    perform public.registrar_metrica(vaga_a1, 'visualizacao');

    perform pg_temp.como_sistema();
    select count(*) into n from public.metricas_vaga_dia
     where vaga_id = vaga_a2 and dia = hoje and visualizacoes = 2 and cliques_candidatura = 1;
    select count(*) into n2 from public.metricas_vaga_dia where vaga_id = vaga_a1;
    r := r || pg_temp.resultado('Visualizações e cliques são somados por vaga por dia; vaga fora do ar não conta',
                                n = 1 and n2 = 0);

    perform pg_temp.como_visitante();
    msg := pg_temp.erro(format(
      'insert into public.metricas_vaga_dia (vaga_id, dia, visualizacoes) values (%L, %L, 1000)', vaga_a2, hoje));
    r := r || pg_temp.resultado('Visitante não grava direto na tabela de métricas', msg is not null, msg);

    perform pg_temp.como_usuario(usuario_a);
    select count(*) into n from public.metricas_vaga_dia where vaga_id = vaga_a2;
    perform pg_temp.como_usuario(usuario_b);
    select count(*) into n2 from public.metricas_vaga_dia where vaga_id = vaga_a2;
    r := r || pg_temp.resultado('Empresa A vê as métricas das próprias vagas; B não vê', n = 1 and n2 = 0);

    -- =================================================================
    -- Reports
    -- =================================================================
    perform pg_temp.como_visitante();
    msg := pg_temp.erro(format(
      'insert into public.reports (vaga_id, motivo, descricao) values (%L, ''link_quebrado'', ''O link não abre'')', vaga_a2));
    r := r || pg_temp.resultado('Visitante reporta uma vaga no ar', msg is null, msg);

    msg := pg_temp.erro(format('insert into public.reports (vaga_id, motivo) values (%L, ''outro'')', vaga_a1));
    r := r || pg_temp.resultado('Visitante não reporta vaga fora do ar', msg is not null, msg);

    msg := pg_temp.erro(format(
      'insert into public.reports (vaga_id, motivo, status) values (%L, ''outro'', ''procedente'')', vaga_a2));
    r := r || pg_temp.resultado('Visitante não cria report já marcado como procedente', msg is not null, msg);

    perform pg_temp.como_usuario(usuario_a);
    select count(*) into n from public.reports;
    perform pg_temp.como_usuario(admin_id, 'aal2');
    select count(*) into n2 from public.reports where vaga_id = vaga_a2;
    r := r || pg_temp.resultado('Só o admin lê os reports (a empresa não)', n = 0 and n2 = 1);

    -- =================================================================
    -- Pré-cadastro
    -- =================================================================
    perform pg_temp.como_visitante();
    msg := pg_temp.erro(
      'insert into public.pedidos_cadastro (cnpj, razao_social, nome_fantasia, email, telefone, termos_versao) '
      'values (''12.ABC.345/01DE-35'', ''NOVA EMPRESA LTDA'', ''Nova Empresa'', ''Contato@Nova.teste.invalid'', '
      '''46 98888-0000'', ''2026-11'')');
    r := r || pg_temp.resultado('Visitante envia pré-cadastro (aceita o novo CNPJ alfanumérico)', msg is null, msg);

    msg := pg_temp.erro(
      'insert into public.pedidos_cadastro (cnpj, razao_social, nome_fantasia, email, telefone, termos_versao) '
      'values (''11.222.333/0001-00'', ''X LTDA'', ''X'', ''x@x.teste.invalid'', ''46 98888-0000'', ''2026-11'')');
    r := r || pg_temp.resultado('CNPJ com dígito verificador errado é recusado', msg is not null, msg);

    msg := pg_temp.erro(
      'insert into public.pedidos_cadastro (cnpj, razao_social, nome_fantasia, email, telefone, termos_versao, status) '
      'values (''11.444.777/0001-61'', ''X LTDA'', ''X'', ''x@x.teste.invalid'', ''46 98888-0000'', ''2026-11'', ''aprovado'')');
    r := r || pg_temp.resultado('Visitante não envia pré-cadastro já aprovado', msg is not null, msg);

    msg := pg_temp.erro(
      'insert into public.pedidos_cadastro (cnpj, razao_social, nome_fantasia, email, telefone, termos_versao) '
      'values (''12ABC34501DE35'', ''NOVA EMPRESA LTDA'', ''Nova Empresa'', ''y@nova.teste.invalid'', ''46 98888-0000'', ''2026-11'')');
    r := r || pg_temp.resultado('Só um pré-cadastro pendente por CNPJ', msg is not null, msg);

    perform pg_temp.como_usuario(admin_id, 'aal2');
    n := pg_temp.linhas('update public.pedidos_cadastro set status = ''recusado'' where cnpj = ''12ABC34501DE35''');
    perform pg_temp.como_visitante();
    msg := pg_temp.erro(
      'insert into public.pedidos_cadastro (cnpj, razao_social, nome_fantasia, email, telefone, termos_versao) '
      'values (''12ABC34501DE35'', ''NOVA EMPRESA LTDA'', ''Nova Empresa'', ''y@nova.teste.invalid'', ''46 98888-0000'', ''2026-11'')');
    r := r || pg_temp.resultado('Empresa recusada pode enviar um novo pré-cadastro', n = 1 and msg is null, msg);

    perform pg_temp.como_usuario(usuario_a);
    select count(*) into n from public.pedidos_cadastro;
    perform pg_temp.como_usuario(admin_id, 'aal2');
    select count(*) into n2 from public.pedidos_cadastro where cnpj = '12ABC34501DE35';
    r := r || pg_temp.resultado('Só o admin lê os pré-cadastros', n = 0 and n2 = 2);

    perform pg_temp.como_sistema();
    select count(*) into n from public.pedidos_cadastro
     where cnpj = '12ABC34501DE35' and email = 'contato@nova.teste.invalid';
    r := r || pg_temp.resultado('CNPJ e e-mail do pré-cadastro são guardados padronizados', n = 1);

    -- =================================================================
    -- Admin e verificação em duas etapas
    -- =================================================================
    perform pg_temp.como_usuario(admin_id, 'aal1');
    select count(*) into n from public.empresas;
    msg := pg_temp.erro('insert into public.cidades (nome) values (''Cidade sem 2 etapas'')');
    r := r || pg_temp.resultado('Admin sem a verificação em duas etapas não tem acesso de admin',
                                n = 0 and msg is not null, msg);

    perform pg_temp.como_usuario(admin_id, 'aal2');
    select count(*) into n from public.empresas where id in (empresa_a, empresa_b, empresa_curada);
    select count(*) into n2 from public.vagas where empresa_id in (empresa_a, empresa_b);
    r := r || pg_temp.resultado('Admin com duas etapas vê todas as empresas e todas as vagas', n = 3 and n2 = 6,
                                n || ' empresas, ' || n2 || ' vagas (esperado: 3 e 6)');

    msg := pg_temp.erro('insert into public.cidades (nome) values (''Cidade Teste Tres'')');
    r := r || pg_temp.resultado('Admin com duas etapas cadastra itens nas listas', msg is null, msg);

    -- =================================================================
    -- Limite personalizado
    -- =================================================================
    -- Agora a A tem 1 vaga contando no limite (a A2; a A3 venceu).
    perform pg_temp.como_usuario(usuario_a);
    resp := public.publicar_vaga(base_vaga || '{"cargo": "Quarta vaga da A"}');
    vaga_a4 := (resp ->> 'id')::uuid;
    resp := public.publicar_vaga(base_vaga || '{"cargo": "Quinta vaga da A"}');
    r := r || pg_temp.resultado('Vaga vencida deixa de contar no limite', vaga_a4 is not null and (resp ->> 'ok')::boolean = false,
                                resp ->> 'mensagem');

    perform pg_temp.como_usuario(admin_id, 'aal2');
    msg := pg_temp.erro(format('select public.definir_limite_personalizado(%L, 5, null, '' '')', empresa_a));
    r := r || pg_temp.resultado('Liberação sem motivo é recusada', msg is not null, msg);

    perform public.definir_limite_personalizado(empresa_a, 3, hoje + 30, 'acordo por e-mail');
    perform pg_temp.como_usuario(usuario_a);
    resp := public.publicar_vaga(base_vaga || '{"cargo": "Quinta vaga da A"}');
    vaga_a5 := (resp ->> 'id')::uuid;
    r := r || pg_temp.resultado('Com limite personalizado, a empresa publica além do plano, sem mudar de plano',
                                (resp ->> 'ok')::boolean, resp::text);

    resp := public.publicar_vaga(base_vaga || '{"cargo": "Sexta vaga da A"}');
    r := r || pg_temp.resultado('A mensagem de limite mostra o limite da empresa',
                                resp ->> 'mensagem' like 'Você atingiu o limite de 3 vagas ativas.%', resp ->> 'mensagem');

    perform pg_temp.como_sistema();
    select count(*) into n from public.liberacoes_limite
     where empresa_id = empresa_a and limite = 3 and valido_ate = hoje + 30
       and motivo = 'acordo por e-mail' and liberado_por = admin_id;
    r := r || pg_temp.resultado('A liberação fica no histórico: quem, quando, limite, validade e motivo', n = 1);

    -- A liberação vence (mudança direta no banco, que também vai para o histórico).
    update public.empresas set limite_valido_ate = hoje - 1 where id = empresa_a;
    select count(*) into n from public.liberacoes_limite where empresa_id = empresa_a;

    perform pg_temp.como_visitante();
    select count(*) into n2 from public.vagas_publicas where id in (vaga_a2, vaga_a4, vaga_a5);
    perform pg_temp.como_usuario(usuario_a);
    resp := public.publicar_vaga(base_vaga || '{"cargo": "Vaga depois de vencer"}');
    r := r || pg_temp.resultado('Liberação vencida: as vagas no ar continuam, novas ficam barradas pelo limite do plano',
                                n = 2 and n2 = 3 and resp ->> 'mensagem' = mensagem_limite_2,
                                n2 || ' vagas no ar; ' || coalesce(resp ->> 'mensagem', resp::text));

    -- =================================================================
    -- Suspensão e reativação
    -- =================================================================
    -- Dentro do teste tudo acontece no mesmo instante; aqui as vagas ganham
    -- datas de publicação diferentes para conferir a ordem na reativação.
    perform pg_temp.como_sistema();
    update public.vagas set publicada_em = now() - interval '3 days' where id = vaga_a2;
    update public.vagas set publicada_em = now() - interval '2 days' where id = vaga_a4;
    update public.vagas set publicada_em = now() - interval '1 day' where id = vaga_a5;

    perform pg_temp.como_usuario(admin_id, 'aal2');
    update public.empresas set status = 'suspensa' where id = empresa_a;

    perform pg_temp.como_visitante();
    select count(*) into n from public.vagas_publicas where empresa_id = empresa_a;
    r := r || pg_temp.resultado('Suspender a empresa tira todas as vagas dela do ar na hora', n = 0, n || ' vaga(s) no ar');

    perform pg_temp.como_usuario(usuario_a);
    select count(*) into n from public.vagas;
    select count(*) into n2 from public.empresas;
    msg := pg_temp.erro(format('select public.publicar_vaga(%L::jsonb)', base_vaga));
    r := r || pg_temp.resultado('Empresa suspensa não vê nem publica nada (login bloqueado no banco)',
                                n = 0 and n2 = 0 and msg is not null, msg);

    perform pg_temp.como_usuario(admin_id, 'aal2');
    update public.empresas set status = 'ativa' where id = empresa_a;

    perform pg_temp.como_sistema();
    select count(*) filter (where origem = 'empresa' and status = 'ativa'),
           count(*) filter (where id in (vaga_a2, vaga_a4) and status = 'ativa')
             + count(*) filter (where id = vaga_a5 and status = 'suspensa')
             + count(*) filter (where id = vaga_curada_a and status = 'ativa')
             + count(*) filter (where id = vaga_a3 and status = 'expirada')
      into n, n2
      from public.vagas where empresa_id = empresa_a;
    r := r || pg_temp.resultado(
      'Ao reativar, voltam ao ar as vagas no prazo que cabem no limite (as mais antigas primeiro)',
      n = 2 and n2 = 5, n || ' vagas da empresa no ar; ' || n2 || ' de 5 status conferidos');

    -- =================================================================
    -- Usuário logado sem cadastro
    -- =================================================================
    perform pg_temp.como_usuario(usuario_sem_cadastro);
    select count(*) into n from public.vagas;
    select count(*) into n2 from public.empresas;
    msg := pg_temp.erro(format('select public.publicar_vaga(%L::jsonb)', base_vaga));
    r := r || pg_temp.resultado('Usuário logado que não é empresa nem admin não vê nem publica nada',
                                n = 0 and n2 = 0 and msg is not null, msg);

    -- =================================================================
    -- Logos no Storage
    -- =================================================================
    perform pg_temp.como_usuario(usuario_a);
    msg := pg_temp.erro(format('insert into storage.objects (bucket_id, name) values (''logos'', %L)', empresa_a || '/logo.png'));
    msg2 := pg_temp.erro(format('insert into storage.objects (bucket_id, name) values (''logos'', %L)', empresa_b || '/logo.png'));
    r := r || pg_temp.resultado('Empresa envia logo só na própria pasta do Storage', msg is null and msg2 is not null,
                                coalesce(msg, msg2));

    -- =================================================================
    -- Exclusão de conta (LGPD)
    -- =================================================================
    perform pg_temp.como_usuario(usuario_b);
    perform public.excluir_conta_empresa(empresa_b);

    perform pg_temp.como_sistema();
    select count(*) into n from public.empresas
     where id = empresa_b and status = 'excluida' and email_contato is null and telefone is null
       and nome_fantasia = 'Empresa Teste B';
    select count(*) filter (where status = 'encerrada_empresa'), count(*) filter (where status = 'ativa')
      into n2, msg
      from public.vagas
     where empresa_id = empresa_b;
    r := r || pg_temp.resultado('Excluir a conta apaga e-mail e telefone e tira as vagas do ar; o nome fica no histórico',
                                n = 1 and n2 = 2 and msg = '0', n2 || ' vagas encerradas, ' || msg || ' ainda no ar');

    select count(*) into n from public.usuarios where id = usuario_b;
    select count(*) into n2 from auth.users where id = usuario_b;
    r := r || pg_temp.resultado('Excluir a conta remove o login', n = 0 and n2 = 0);

    -- Fim: desfaz tudo o que os testes fizeram.
    raise exception using errcode = 'TT000';
  exception
    when sqlstate 'TT000' then
      null;
    when others then
      get stacked diagnostics txt = pg_exception_context;
      r := r || pg_temp.resultado('Erro inesperado: os testes pararam no meio', false, sqlerrm || ' | ' || txt);
  end;

  return query
    with lista as (
      select (t.ordem)::integer as numero, t.item
        from jsonb_array_elements(r) with ordinality as t(item, ordem)
    )
    select 0,
           format('RESUMO: %s de %s testes passaram',
                  count(*) filter (where (item ->> 'passou')::boolean), count(*)),
           case when bool_and((item ->> 'passou')::boolean) then 'ok' else 'FALHOU' end,
           null::text
      from lista
    union all
    select lista.numero,
           item ->> 'teste',
           case when (item ->> 'passou')::boolean then 'ok' else 'FALHOU' end,
           case when (item ->> 'passou')::boolean then null else item ->> 'detalhe' end
      from lista
    order by 1;
end;
$$;

select * from pg_temp.rodar_testes();
