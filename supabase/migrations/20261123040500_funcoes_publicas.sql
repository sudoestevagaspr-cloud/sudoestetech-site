-- =====================================================================
-- Funções que o site chama pela API (supabase.rpc('nome', {...}))
-- =====================================================================
--
-- O Supabase deixa qualquer função do schema public executável por
-- visitantes e usuários logados. Por isso cada função abaixo diz
-- explicitamente quem pode chamá-la.

-- ---------------------------------------------------------------------
-- publicar_vaga: a empresa (ou o admin) publica uma vaga
-- ---------------------------------------------------------------------
-- Por que uma função, se a empresa também pode inserir direto na tabela?
-- O gatilho do limite barra a publicação com um erro, e um erro desfaz
-- tudo o que a operação fez, inclusive o registro de "bateu no limite".
-- Esta função captura esse erro, registra a tentativa e devolve a
-- mensagem para a tela. O gatilho continua valendo para qualquer outro
-- caminho.
--
-- SECURITY INVOKER: roda com as permissões de quem chamou, então o RLS
-- e os gatilhos valem normalmente aqui dentro.
--
-- Uso no site:
--   const { data } = await supabase.rpc('publicar_vaga', { dados: { cargo: '...', ... } })
--   data = { ok: true, id, slug }  ou  { ok: false, codigo: 'limite_atingido', mensagem }

create or replace function privado.registrar_limite_atingido(id_empresa uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.limite_atingido (empresa_id, limite)
  select id_empresa, privado.limite_efetivo(id_empresa)
   where id_empresa is not null
$$;

create or replace function public.publicar_vaga(dados jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v public.vagas;
  nova public.vagas;
begin
  -- Converte o JSON recebido numa linha de vaga. Chaves desconhecidas são
  -- ignoradas; empresa, origem e status de uma empresa são decididos pelo
  -- gatilho, não pelo que veio do navegador.
  v := jsonb_populate_record(null::public.vagas, dados);

  begin
    insert into public.vagas (
      empresa_id, origem, cargo, area_principal_id, areas_secundarias, nivel_id,
      contrato_id, modalidade_id, cidade_id, atividades, requisitos, link_candidatura,
      encerra_em, salario_min, salario_max, salario_a_combinar, beneficios, pcd,
      como_se_candidatar, observacao, fonte, conferida_em
    ) values (
      v.empresa_id, v.origem, v.cargo, v.area_principal_id, coalesce(v.areas_secundarias, '{}'), v.nivel_id,
      v.contrato_id, v.modalidade_id, v.cidade_id, v.atividades, v.requisitos, v.link_candidatura,
      v.encerra_em, v.salario_min, v.salario_max, coalesce(v.salario_a_combinar, false), v.beneficios,
      coalesce(v.pcd, false), v.como_se_candidatar, v.observacao, v.fonte, v.conferida_em
    )
    returning * into nova;
  exception
    when sqlstate 'ST001' then
      perform privado.registrar_limite_atingido(coalesce(privado.minha_empresa_id(), v.empresa_id));
      return jsonb_build_object('ok', false, 'codigo', 'limite_atingido', 'mensagem', sqlerrm);
  end;

  return jsonb_build_object('ok', true, 'id', nova.id, 'slug', nova.slug);
end;
$$;

revoke execute on function public.publicar_vaga(jsonb) from public, anon;
grant execute on function public.publicar_vaga(jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- definir_limite_personalizado: o admin libera mais vagas para uma empresa
-- ---------------------------------------------------------------------
-- novo_limite vazio remove a liberação (volta a valer o limite do plano).
-- Tudo fica no histórico (liberacoes_limite), com o motivo.
create or replace function public.definir_limite_personalizado(
  id_empresa uuid,
  novo_limite integer,
  valido_ate date default null,
  motivo text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (privado.eh_admin() or privado.chamada_de_sistema()) then
    raise exception 'Só o administrador pode liberar vagas para uma empresa.' using errcode = '42501';
  end if;
  if coalesce(trim(motivo), '') = '' then
    raise exception 'Informe o motivo (ex.: "acordo por e-mail", "cortesia").';
  end if;
  if novo_limite is null and valido_ate is not null then
    raise exception 'Para definir uma validade, informe também o limite.';
  end if;
  if valido_ate < privado.hoje() then
    raise exception 'A validade não pode estar no passado.';
  end if;

  -- O gatilho de histórico lê o motivo desta configuração temporária,
  -- que só existe até o fim da transação.
  perform set_config('sudoeste.motivo_limite', trim(motivo), true);

  update public.empresas
     set limite_personalizado = novo_limite,
         limite_valido_ate = valido_ate
   where id = id_empresa;

  if not found then
    raise exception 'Empresa não encontrada.';
  end if;

  perform set_config('sudoeste.motivo_limite', '', true);
end;
$$;

revoke execute on function public.definir_limite_personalizado(uuid, integer, date, text) from public, anon;
grant execute on function public.definir_limite_personalizado(uuid, integer, date, text) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- excluir_conta_empresa: exclusão de conta pedida pela empresa (LGPD)
-- ---------------------------------------------------------------------
-- Pode ser chamada pela própria empresa ou pelo admin. Apaga e-mail,
-- telefone e perfil, tira as vagas do ar e remove o login. As vagas
-- antigas ficam no histórico só com o nome da empresa.
-- O arquivo do logo é apagado pelo site, pela API do Storage (o Supabase
-- não deixa apagar arquivos direto pelo banco).
create or replace function public.excluir_conta_empresa(id_empresa uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (privado.eh_admin()
          or privado.chamada_de_sistema()
          or id_empresa = privado.minha_empresa_id()) then
    raise exception 'Você não tem permissão para excluir esta empresa.' using errcode = '42501';
  end if;

  update public.empresas
     set status = 'excluida'
   where id = id_empresa
     and status <> 'excluida';

  if not found then
    raise exception 'Empresa não encontrada ou já excluída.';
  end if;
end;
$$;

revoke execute on function public.excluir_conta_empresa(uuid) from public, anon;
grant execute on function public.excluir_conta_empresa(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- registrar_metrica: soma +1 em visualizações ou cliques da vaga no dia
-- ---------------------------------------------------------------------
-- Chamada pela página da vaga, por qualquer visitante. O visitante não
-- grava na tabela de métricas: só pode chamar esta função, que só soma 1
-- e só para vagas no ar.
--   tipo: 'visualizacao' (abriu os detalhes) ou 'clique_candidatura'
create or replace function public.registrar_metrica(id_vaga uuid, tipo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tipo is null or tipo not in ('visualizacao', 'clique_candidatura') then
    raise exception 'Tipo de métrica inválido: use visualizacao ou clique_candidatura.' using errcode = '22023';
  end if;

  if not privado.vaga_esta_no_ar(id_vaga) then
    return;
  end if;

  insert into public.metricas_vaga_dia as m (vaga_id, dia, visualizacoes, cliques_candidatura)
  values (
    id_vaga,
    privado.hoje(),
    case when tipo = 'visualizacao' then 1 else 0 end,
    case when tipo = 'clique_candidatura' then 1 else 0 end
  )
  on conflict on constraint metricas_vaga_dia_pkey do update
    set visualizacoes = m.visualizacoes + excluded.visualizacoes,
        cliques_candidatura = m.cliques_candidatura + excluded.cliques_candidatura;
end;
$$;

revoke execute on function public.registrar_metrica(uuid, text) from public;
grant execute on function public.registrar_metrica(uuid, text) to anon, authenticated, service_role;
