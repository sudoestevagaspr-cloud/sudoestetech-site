-- =====================================================================
-- Dados de exemplo para o banco LOCAL (supabase db reset)
-- =====================================================================
-- Este arquivo não vai para o Supabase de verdade: o "supabase db push"
-- só aplica as migrations. No banco real, as cidades são cadastradas pelo
-- admin.

insert into public.cidades (nome, uf) values
  ('Francisco Beltrão', 'PR'),
  ('Pato Branco', 'PR'),
  ('Dois Vizinhos', 'PR');

-- Uma empresa sem login, como as das vagas curadas.
insert into public.empresas (id, nome_fantasia, site, descricao) values
  ('00000000-0000-4000-8000-000000000001', 'Empresa Exemplo', 'https://exemplo.com.br',
   'Empresa fictícia para testar o site no computador.');

insert into public.vagas (
  empresa_id, origem, cargo, area_principal_id, areas_secundarias, nivel_id, contrato_id,
  modalidade_id, cidade_id, atividades, requisitos, link_candidatura, encerra_em,
  salario_min, salario_max, fonte, conferida_em
)
select
  '00000000-0000-4000-8000-000000000001',
  'curada',
  'Desenvolvedor Full Stack Pleno',
  (select id from public.areas where slug = 'desenvolvimento'),
  array[(select id from public.areas where slug = 'banco-de-dados')],
  (select id from public.niveis where slug = 'pleno'),
  (select id from public.contratos where slug = 'clt'),
  (select id from public.modalidades where slug = 'hibrido'),
  (select id from public.cidades where slug = 'pato-branco'),
  'Desenvolver e manter sistemas web.',
  'Experiência com TypeScript, React e PostgreSQL.',
  'https://exemplo.com.br/vagas/full-stack',
  (now() at time zone 'America/Sao_Paulo')::date + 30,
  5000, 7000,
  'Site da empresa',
  (now() at time zone 'America/Sao_Paulo')::date;

insert into public.vagas (
  empresa_id, origem, cargo, area_principal_id, nivel_id, contrato_id,
  modalidade_id, cidade_id, atividades, requisitos, link_candidatura, encerra_em,
  salario_a_combinar
)
select
  '00000000-0000-4000-8000-000000000001',
  'curada',
  'Analista de Suporte Júnior',
  (select id from public.areas where slug = 'suporte-tecnico-e-help-desk'),
  (select id from public.niveis where slug = 'junior'),
  (select id from public.contratos where slug = 'clt'),
  (select id from public.modalidades where slug = 'remoto'),
  (select id from public.cidades where slug = 'francisco-beltrao'),
  'Atender chamados de clientes por telefone e e-mail.',
  'Conhecimento em Windows e redes. Boa comunicação.',
  'https://exemplo.com.br/vagas/suporte',
  (now() at time zone 'America/Sao_Paulo')::date + 20,
  true;
