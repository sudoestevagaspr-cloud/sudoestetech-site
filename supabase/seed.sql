-- =====================================================================
-- Dados de exemplo para o banco LOCAL (supabase db reset)
-- =====================================================================
-- Este arquivo não vai para o Supabase de verdade: o "supabase db push"
-- só aplica as migrations. No banco real, as cidades são cadastradas pelo
-- admin. Empresas e vagas abaixo são fictícias.
--
-- Os testes do site (tests/navegador) contam com estas vagas: ao mudar
-- algo aqui, rode "npm run test:e2e" de novo.

insert into public.cidades (nome, uf) values
  ('Francisco Beltrão', 'PR'),
  ('Pato Branco', 'PR'),
  ('Dois Vizinhos', 'PR');

-- Empresas sem login, como as das vagas curadas.
insert into public.empresas (id, nome_fantasia, site, linkedin, instagram, descricao) values
  ('00000000-0000-4000-8000-000000000001', 'Empresa Exemplo', 'https://exemplo.com.br', null, null,
   'Empresa fictícia para testar o site no computador.'),
  ('00000000-0000-4000-8000-000000000002', 'Cooperativa Exemplo', 'https://cooperativa.exemplo.com.br', null,
   'https://www.instagram.com/cooperativa.exemplo/',
   'Cooperativa fictícia com agências em toda a região.'),
  ('00000000-0000-4000-8000-000000000003', 'Agro Dados', null,
   'https://www.linkedin.com/company/agro-dados-exemplo/', null,
   'Startup fictícia de dados para o agronegócio.'),
  ('00000000-0000-4000-8000-000000000004', 'Software Sudoeste', 'https://software.exemplo.com.br', null, null, null);

-- Atalho para montar as vagas abaixo sem repetir as consultas das listas.
create function pg_temp.id_de(tabela text, slug_item text)
returns uuid
language plpgsql
as $$
declare
  resultado uuid;
begin
  execute format('select id from public.%I where slug = $1', tabela) into resultado using slug_item;
  if resultado is null then
    raise exception 'Item % não encontrado em %', slug_item, tabela;
  end if;
  return resultado;
end;
$$;

-- 1. Faixa salarial, híbrido, com área secundária.
insert into public.vagas (
  empresa_id, origem, cargo, area_principal_id, areas_secundarias, nivel_id, contrato_id,
  modalidade_id, cidade_id, atividades, requisitos, link_candidatura, encerra_em,
  salario_min, salario_max, beneficios, fonte, conferida_em
) values (
  '00000000-0000-4000-8000-000000000001', 'curada', 'Desenvolvedor Full Stack Pleno',
  pg_temp.id_de('areas', 'desenvolvimento'), array[pg_temp.id_de('areas', 'banco-de-dados')],
  pg_temp.id_de('niveis', 'pleno'), pg_temp.id_de('contratos', 'clt'),
  pg_temp.id_de('modalidades', 'hibrido'), pg_temp.id_de('cidades', 'pato-branco'),
  E'Desenvolver e manter sistemas web.\nParticipar das reuniões de planejamento.',
  'Experiência com TypeScript, React e PostgreSQL; Git no dia a dia',
  'https://exemplo.com.br/vagas/full-stack',
  (now() at time zone 'America/Sao_Paulo')::date + 30,
  5000, 7000, E'Vale-alimentação\nPlano de saúde', 'Site da empresa',
  (now() at time zone 'America/Sao_Paulo')::date
);

-- 2. Remota, salário a combinar.
insert into public.vagas (
  empresa_id, origem, cargo, area_principal_id, nivel_id, contrato_id,
  modalidade_id, cidade_id, atividades, requisitos, link_candidatura, encerra_em,
  salario_a_combinar, publicada_em
) values (
  '00000000-0000-4000-8000-000000000001', 'curada', 'Analista de Suporte Júnior',
  pg_temp.id_de('areas', 'suporte-tecnico-e-help-desk'), pg_temp.id_de('niveis', 'junior'),
  pg_temp.id_de('contratos', 'clt'), pg_temp.id_de('modalidades', 'remoto'),
  pg_temp.id_de('cidades', 'francisco-beltrao'),
  'Atender chamados de clientes por telefone e e-mail.',
  'Conhecimento em Windows e redes. Boa comunicação.',
  'https://exemplo.com.br/vagas/suporte',
  (now() at time zone 'America/Sao_Paulo')::date + 20,
  true, now() - interval '1 day'
);

-- 3. Estágio presencial, só salário mínimo, PcD, publicada há 10 dias (sem selo "Nova").
insert into public.vagas (
  empresa_id, origem, cargo, area_principal_id, nivel_id, contrato_id,
  modalidade_id, cidade_id, atividades, requisitos, link_candidatura, encerra_em,
  salario_min, pcd, publicada_em
) values (
  '00000000-0000-4000-8000-000000000002', 'curada', 'Estágio em Infraestrutura e Redes',
  pg_temp.id_de('areas', 'infraestrutura-e-redes'), pg_temp.id_de('niveis', 'estagio'),
  pg_temp.id_de('contratos', 'estagio-nao-obrigatorio'), pg_temp.id_de('modalidades', 'presencial'),
  pg_temp.id_de('cidades', 'francisco-beltrao'),
  'Apoiar a equipe de infraestrutura na manutenção da rede e dos servidores.',
  'Estar cursando Redes, Sistemas de Informação ou área afim.',
  'https://cooperativa.exemplo.com.br/trabalhe-conosco',
  (now() at time zone 'America/Sao_Paulo')::date + 15,
  1200, true, now() - interval '10 days'
);

-- 4. Sênior PJ, só salário máximo, duas áreas secundárias, passos e observação.
insert into public.vagas (
  empresa_id, origem, cargo, area_principal_id, areas_secundarias, nivel_id, contrato_id,
  modalidade_id, cidade_id, atividades, requisitos, link_candidatura, encerra_em,
  salario_max, beneficios, como_se_candidatar, observacao, publicada_em
) values (
  '00000000-0000-4000-8000-000000000003', 'curada', 'Cientista de Dados Sênior',
  pg_temp.id_de('areas', 'dados-e-bi'),
  array[pg_temp.id_de('areas', 'inteligencia-artificial'), pg_temp.id_de('areas', 'cloud-e-devops')],
  pg_temp.id_de('niveis', 'senior'), pg_temp.id_de('contratos', 'pj'),
  pg_temp.id_de('modalidades', 'presencial'), pg_temp.id_de('cidades', 'dois-vizinhos'),
  E'- Criar modelos de previsão de safra\n- Montar painéis para os clientes',
  E'- Python e SQL avançados\n- Experiência com aprendizado de máquina',
  'https://agro.exemplo.com.br/vagas/cientista-de-dados',
  (now() at time zone 'America/Sao_Paulo')::date + 45,
  12000, 'Horário flexível',
  E'Clique em Candidatar-se;Preencha o formulário da empresa;Anexe seu currículo em PDF',
  'Vaga com possibilidade de viagens a campo uma vez por mês.',
  now() - interval '3 days'
);

-- 5. Remota sem salário (o destaque amarelo vira "Inscrições até").
insert into public.vagas (
  empresa_id, origem, cargo, area_principal_id, nivel_id, contrato_id,
  modalidade_id, cidade_id, atividades, requisitos, link_candidatura, encerra_em, publicada_em
) values (
  '00000000-0000-4000-8000-000000000004', 'curada', 'Analista de Segurança da Informação Pleno',
  pg_temp.id_de('areas', 'seguranca-da-informacao'), pg_temp.id_de('niveis', 'pleno'),
  pg_temp.id_de('contratos', 'clt'), pg_temp.id_de('modalidades', 'remoto'),
  pg_temp.id_de('cidades', 'pato-branco'),
  'Monitorar incidentes e cuidar das políticas de acesso.',
  'Conhecimento em firewall, SIEM e LGPD.',
  'https://software.exemplo.com.br/carreiras/seguranca',
  (now() at time zone 'America/Sao_Paulo')::date + 10,
  now() - interval '12 days'
);

-- 6. Candidatura por e-mail (link mailto:).
insert into public.vagas (
  empresa_id, origem, cargo, area_principal_id, nivel_id, contrato_id,
  modalidade_id, cidade_id, atividades, requisitos, link_candidatura, encerra_em, publicada_em
) values (
  '00000000-0000-4000-8000-000000000004', 'curada', 'Analista de Testes (QA) Júnior',
  pg_temp.id_de('areas', 'qualidade-e-testes-qa'), pg_temp.id_de('niveis', 'junior'),
  pg_temp.id_de('contratos', 'clt'), pg_temp.id_de('modalidades', 'hibrido'),
  pg_temp.id_de('cidades', 'pato-branco'),
  'Escrever e rodar testes dos sistemas da empresa.',
  'Noções de testes automatizados.',
  'mailto:vagas@software.exemplo.com.br?subject=Vaga%20QA',
  (now() at time zone 'America/Sao_Paulo')::date + 5,
  now() - interval '2 days'
);

-- 7. Vaga que saiu do ar (encerrada pela empresa): o link mostra o aviso
-- "Esta vaga não está mais no ar".
insert into public.vagas (
  empresa_id, origem, status, slug, cargo, area_principal_id, nivel_id, contrato_id,
  modalidade_id, cidade_id, atividades, requisitos, link_candidatura, encerra_em
) values (
  '00000000-0000-4000-8000-000000000001', 'curada', 'encerrada_empresa',
  'desenvolvedor-mobile-empresa-exemplo-pato-branco', 'Desenvolvedor Mobile',
  pg_temp.id_de('areas', 'desenvolvimento'), pg_temp.id_de('niveis', 'pleno'),
  pg_temp.id_de('contratos', 'clt'), pg_temp.id_de('modalidades', 'presencial'),
  pg_temp.id_de('cidades', 'pato-branco'),
  'Desenvolver aplicativos.', 'Flutter.',
  'https://exemplo.com.br/vagas/mobile',
  (now() at time zone 'America/Sao_Paulo')::date + 10
);
