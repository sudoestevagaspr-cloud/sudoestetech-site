-- =====================================================================
-- Vitrine pública: as vagas que estão no ar, só com dados públicos
-- =====================================================================
--
-- É por aqui que o site público lê as vagas. O visitante não tem acesso
-- às tabelas vagas e empresas; só a esta visão.
--
-- Esta visão roda com as permissões de quem a criou (security_invoker =
-- false), DE PROPÓSITO. Ela mesma é a regra de acesso: só vagas no ar e
-- só colunas públicas. E-mail, telefone, CNPJ e dados de plano da empresa
-- não estão aqui, então não chegam ao visitante nem se ele montar a
-- consulta à mão.
--
-- O "Security Advisor" do Supabase mostra um aviso "Security Definer
-- View" para esta visão. É esperado: o aviso existe para visões criadas
-- assim sem querer. NÃO troque para security_invoker = true: o site
-- público pararia de mostrar as vagas.
--
-- "No ar" = status ativa, dentro do prazo (horário de Brasília) e de uma
-- empresa ativa. A função privado.vaga_esta_no_ar usa as mesmas condições.
--
-- Filtro de cidade (regra dos requisitos): vagas remotas aparecem em
-- qualquer cidade filtrada. No site, o filtro fica
--   cidade_slug = 'pato-branco' or modalidade_remota
-- e a vaga remota é exibida como "Remoto — empresa de <cidade_nome>".
--
-- Filtro de área: use todas_areas (principal + secundárias).

create view public.vagas_publicas
with (security_invoker = false)
as
select
  v.id,
  v.slug,
  v.cargo,

  v.empresa_id,
  e.nome_fantasia as empresa_nome,
  e.logo_path as empresa_logo_path,
  e.descricao as empresa_descricao,
  e.site as empresa_site,
  e.linkedin as empresa_linkedin,
  e.instagram as empresa_instagram,

  v.cidade_id,
  c.nome as cidade_nome,
  c.uf as cidade_uf,
  c.slug as cidade_slug,

  v.modalidade_id,
  m.nome as modalidade_nome,
  m.slug as modalidade_slug,
  m.remota as modalidade_remota,

  v.nivel_id,
  n.nome as nivel_nome,
  n.slug as nivel_slug,

  v.contrato_id,
  ct.nome as contrato_nome,
  ct.slug as contrato_slug,

  v.area_principal_id,
  a.nome as area_principal_nome,
  a.slug as area_principal_slug,
  v.areas_secundarias,
  array_prepend(v.area_principal_id, v.areas_secundarias) as todas_areas,

  v.atividades,
  v.requisitos,
  v.link_candidatura,
  v.como_se_candidatar,
  v.encerra_em,
  v.salario_min,
  v.salario_max,
  v.salario_a_combinar,
  v.beneficios,
  v.pcd,
  v.observacao,
  v.publicada_em,
  v.busca
from public.vagas v
join public.empresas e on e.id = v.empresa_id
join public.cidades c on c.id = v.cidade_id
join public.modalidades m on m.id = v.modalidade_id
join public.niveis n on n.id = v.nivel_id
join public.contratos ct on ct.id = v.contrato_id
join public.areas a on a.id = v.area_principal_id
where v.status = 'ativa'
  and v.encerra_em >= privado.hoje()
  and e.status = 'ativa';

comment on view public.vagas_publicas is
  'Vagas no ar, só com dados públicos. É a única forma de o visitante ler vagas.';

-- Só leitura, para todos.
revoke all on public.vagas_publicas from anon, authenticated;
grant select on public.vagas_publicas to anon, authenticated;
