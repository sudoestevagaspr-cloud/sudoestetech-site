"use client";

// Lista de vagas com busca, filtros e ordenação, tudo no navegador.
//
// O servidor manda todas as vagas no ar de uma vez (já guardadas em cache na
// Cloudflare). Filtrar aqui é instantâneo e não consulta o banco a cada
// letra digitada. A busca e os filtros vão para o endereço da página
// (ex.: /?cidade=pato-branco&nivel=junior), para dar para mandar uma busca
// pronta no WhatsApp.

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { SITE } from "@/lib/config";
import {
  FILTROS_VAZIOS,
  ORDENS,
  filtrar,
  lerDoEndereco,
  ordenar,
  paraEndereco,
  type Filtros,
  type OpcoesDeFiltro,
  type Ordem,
  type VagaCard,
} from "@/lib/vagas";
import { CardVaga } from "./CardVaga";
import { Icone } from "./Icone";

type CampoDeFiltro = "cidade" | "modalidade" | "nivel" | "area";

const CAMPOS: { campo: CampoDeFiltro; rotulo: string; todas: string; opcoes: keyof OpcoesDeFiltro }[] = [
  { campo: "cidade", rotulo: "Cidade", todas: "Todas as cidades", opcoes: "cidades" },
  { campo: "modalidade", rotulo: "Modalidade", todas: "Todas as modalidades", opcoes: "modalidades" },
  { campo: "nivel", rotulo: "Nível", todas: "Todos os níveis", opcoes: "niveis" },
  { campo: "area", rotulo: "Área", todas: "Todas as áreas", opcoes: "areas" },
];

export function ListaDeVagas({ vagas, opcoes }: { vagas: VagaCard[]; opcoes: OpcoesDeFiltro }) {
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS);
  const [ordem, setOrdem] = useState<Ordem>("recentes");
  const [painelAberto, setPainelAberto] = useState(false);
  const campoBusca = useRef<HTMLInputElement>(null);
  const id = useId();

  // Ao abrir a página, aplica a busca e os filtros que vieram no endereço.
  // Valores que não existem mais nas opções (ex.: cidade sem vaga) são ignorados.
  useEffect(() => {
    const doEndereco = lerDoEndereco(new URLSearchParams(window.location.search));
    const validos = { ...doEndereco.filtros };
    for (const { campo, opcoes: lista } of CAMPOS) {
      if (validos[campo] && !opcoes[lista].some((o) => o.slug === validos[campo])) validos[campo] = "";
    }
    // Sincroniza o estado com o endereço só depois de montar, para o HTML do
    // servidor (sem filtros) e o primeiro desenho no navegador serem iguais.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFiltros(validos);
    setOrdem(doEndereco.ordem);
  }, [opcoes]);

  function atualizar(novosFiltros: Filtros, novaOrdem: Ordem) {
    setFiltros(novosFiltros);
    setOrdem(novaOrdem);
    // Troca o endereço sem recarregar a página nem criar um "voltar" por letra.
    window.history.replaceState(null, "", window.location.pathname + paraEndereco(novosFiltros, novaOrdem));
  }

  const visiveis = useMemo(() => ordenar(filtrar(vagas, filtros), ordem), [vagas, filtros, ordem]);
  const filtrosAtivos = CAMPOS.filter(({ campo }) => filtros[campo]).length;
  const filtrando = filtrosAtivos > 0 || filtros.q.trim() !== "";

  return (
    <section className="conteudo pb-2" aria-label="Vagas abertas">
      <form
        role="search"
        onSubmit={(e) => {
          // Enter no teclado do celular fecha o teclado em vez de recarregar a página.
          e.preventDefault();
          campoBusca.current?.blur();
        }}
        className="flex flex-col gap-3 lg:grid lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start lg:gap-x-8"
      >
        {/* Busca e ordenação */}
        <div className="flex flex-col gap-3 lg:col-start-2 lg:flex-row">
          <div className="relative lg:flex-1">
            <label htmlFor={`${id}-busca`} className="sr-only">
              Buscar vagas
            </label>
            <Icone
              nome="busca"
              className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-apoio"
            />
            <input
              ref={campoBusca}
              id={`${id}-busca`}
              type="search"
              className="campo pr-3.5 pl-11"
              placeholder="Cargo, empresa ou tecnologia"
              autoComplete="off"
              enterKeyHint="search"
              value={filtros.q}
              onChange={(e) => atualizar({ ...filtros, q: e.target.value }, ordem)}
            />
          </div>
          <div className="flex gap-2 lg:w-60 lg:flex-none">
            <button
              type="button"
              className="campo inline-flex w-auto flex-none items-center gap-2 px-4 font-bold hover:border-ciano lg:hidden"
              aria-expanded={painelAberto}
              aria-controls={`${id}-filtros`}
              onClick={() => setPainelAberto((aberto) => !aberto)}
            >
              <Icone nome="filtros" className="size-[18px] text-ciano" />
              Filtros
              {filtrosAtivos > 0 && (
                <span className="rounded-full bg-ciano px-2 text-sm font-extrabold text-fundo">
                  {filtrosAtivos}
                  <span className="sr-only"> ativos</span>
                </span>
              )}
            </button>
            <label htmlFor={`${id}-ordem`} className="sr-only">
              Ordenar vagas
            </label>
            <select
              id={`${id}-ordem`}
              className="campo min-w-0 flex-1"
              value={ordem}
              onChange={(e) => atualizar(filtros, e.target.value as Ordem)}
            >
              {ORDENS.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filtros: recolhidos num botão no celular, sempre visíveis no computador */}
        <fieldset
          id={`${id}-filtros`}
          className={`${painelAberto ? "grid" : "hidden"} cartao gap-3 p-4 sm:grid-cols-2 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:grid lg:grid-cols-1 lg:p-5`}
        >
          <legend className="sr-only">Filtros</legend>
          <p className="hidden text-base font-extrabold text-white lg:block">Filtros</p>
          {CAMPOS.map(({ campo, rotulo, todas, opcoes: lista }) => (
            <div key={campo} className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-${campo}`} className="text-sm font-bold text-apoio">
                {rotulo}
              </label>
              <select
                id={`${id}-${campo}`}
                className="campo"
                value={filtros[campo]}
                onChange={(e) => atualizar({ ...filtros, [campo]: e.target.value }, ordem)}
              >
                <option value="">{todas}</option>
                {opcoes[lista].map((o) => (
                  <option key={o.slug} value={o.slug}>
                    {o.nome}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {filtros.cidade && (
            <p className="text-[13px] text-apoio sm:col-span-2 lg:col-span-1">
              Vagas remotas aparecem em qualquer cidade.
            </p>
          )}
          {filtrando && (
            <button
              type="button"
              className="link-seta justify-self-start sm:col-span-2 lg:col-span-1"
              onClick={() => atualizar(FILTROS_VAZIOS, ordem)}
            >
              Limpar busca e filtros
            </button>
          )}
        </fieldset>

        {/* Resultado */}
        <div className="flex flex-col gap-3.5 lg:col-start-2">
          <p className="text-[13px] text-apoio empty:hidden" aria-live="polite">
            {filtrando && vagas.length > 0
              ? `${visiveis.length} ${visiveis.length === 1 ? "vaga encontrada" : "vagas encontradas"}`
              : ""}
          </p>

          {vagas.length === 0 ? (
            <Aviso titulo="Nenhuma vaga aberta agora">
              Assim que aparecer vaga de TI na região, ela entra aqui e no nosso Instagram. Ative as
              notificações por lá para não perder.
            </Aviso>
          ) : visiveis.length === 0 ? (
            <Aviso titulo="Nenhuma vaga com esses filtros">
              Tente outra palavra, outra cidade ou{" "}
              <button
                type="button"
                className="font-bold text-ciano underline hover:text-ciano-claro"
                onClick={() => atualizar(FILTROS_VAZIOS, ordem)}
              >
                limpe a busca e os filtros
              </button>
              .
            </Aviso>
          ) : (
            <div className="grid gap-3.5 min-[700px]:grid-cols-2 min-[700px]:gap-6">
              {visiveis.map((vaga) => (
                <CardVaga key={vaga.id} vaga={vaga} />
              ))}
            </div>
          )}
        </div>
      </form>
    </section>
  );
}

function Aviso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="cartao px-5 py-[22px]" role="status">
      <h2 className="mb-2 text-lg font-extrabold text-white">{titulo}</h2>
      <p className="mb-3 text-[15px] text-apoio">{children}</p>
      <a className="link-seta" href={SITE.instagram} target="_blank" rel="noopener noreferrer">
        Ver as vagas no Instagram
        <Icone nome="externo" />
      </a>
    </div>
  );
}
