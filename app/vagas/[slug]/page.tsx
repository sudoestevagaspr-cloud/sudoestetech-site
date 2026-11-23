import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icone } from "@/components/Icone";
import { LogoEmpresa } from "@/components/LogoEmpresa";
import { BotaoCandidatar } from "@/components/vaga/BotaoCandidatar";
import { Compartilhar } from "@/components/vaga/Compartilhar";
import { ContarVisualizacao } from "@/components/vaga/ContarVisualizacao";
import { ReportarVaga } from "@/components/vaga/ReportarVaga";
import { Passos, TextoEmItens } from "@/components/vaga/TextoEmItens";
import { SITE, urlDoSite } from "@/lib/config";
import { lerVaga } from "@/lib/dados";
import { formatarData, diaEmBrasilia } from "@/lib/datas";
import { jsonParaScript, vagaParaGoogle } from "@/lib/google";
import { resumir } from "@/lib/texto";
import type { VagaCompleta } from "@/lib/vagas";

// Nenhuma vaga é montada no build: cada página é montada na primeira visita
// e guardada em cache até o banco avisar que algo mudou.
export const revalidate = false;
export const dynamicParams = true;
export async function generateStaticParams() {
  return [];
}

function tituloDaVaga(vaga: VagaCompleta): string {
  return `${vaga.cargo} · ${vaga.empresaNome}`;
}

/** Texto da prévia: cidade, nível, contrato e prazo (decisão do plano: cidade e nível na descrição). */
function descricaoDaVaga(vaga: VagaCompleta): string {
  const partes = [vaga.local, vaga.nivelNome, vaga.contratoNome];
  if (!vaga.remota) partes.push(vaga.modalidadeNome);
  const salario = vaga.salario ? ` ${vaga.salario}.` : "";
  return resumir(`${partes.join(" · ")}.${salario} Inscrições até ${formatarData(vaga.encerraEm)}.`, 200);
}

export async function generateMetadata({ params }: PageProps<"/vagas/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const vaga = await lerVaga(slug);
  if (!vaga) {
    return { title: "Vaga fora do ar", robots: { index: false, follow: true } };
  }
  const titulo = tituloDaVaga(vaga);
  const descricao = descricaoDaVaga(vaga);
  const endereco = `/vagas/${vaga.slug}`;
  return {
    title: titulo,
    description: descricao,
    alternates: { canonical: endereco },
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: SITE.nome,
      title: titulo,
      description: descricao,
      url: endereco,
    },
    twitter: { card: "summary_large_image", title: titulo, description: descricao },
  };
}

export default async function PaginaDaVaga({ params }: PageProps<"/vagas/[slug]">) {
  const { slug } = await params;
  const vaga = await lerVaga(slug);
  if (!vaga) notFound();

  const url = `${urlDoSite()}/vagas/${vaga.slug}`;
  const publicadaEm = formatarData(diaEmBrasilia(vaga.publicadaEm));
  const encerraEm = formatarData(vaga.encerraEm);
  const linkSeguro = (link: string | null) => (link && /^https?:\/\//i.test(link) ? link : null);
  const redes = [
    { nome: "Site", link: linkSeguro(vaga.empresa.site) },
    { nome: "LinkedIn", link: linkSeguro(vaga.empresa.linkedin) },
    { nome: "Instagram", link: linkSeguro(vaga.empresa.instagram) },
  ].filter((r): r is { nome: string; link: string } => r.link !== null);

  return (
    <div className="conteudo pb-8">
      <p className="mt-[18px] mb-3.5">
        <Link href="/" className="link-seta">
          <Icone nome="voltar" />
          Todas as vagas
        </Link>
      </p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-8">
        <article className="cartao flex flex-col gap-3.5 px-5 py-[22px] min-[700px]:p-8">
          <div className="flex min-h-6 items-center justify-between gap-2">
            <span className="text-xs font-extrabold tracking-[2px] text-ciano uppercase">{vaga.areaPrincipalNome}</span>
            {vaga.nova && <span className="selo-nova">Nova</span>}
          </div>

          <div className="flex items-start gap-4">
            <LogoEmpresa logoUrl={vaga.logoUrl} iniciais={vaga.iniciais} tamanho={64} />
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="text-[26px] leading-tight font-extrabold text-white min-[700px]:text-[30px]">{vaga.cargo}</h1>
              <p className="font-medium text-apoio">{vaga.empresaNome}</p>
            </div>
          </div>

          <ul className="flex flex-wrap gap-2" aria-label="Detalhes da vaga">
            <li className="chip">
              <Icone nome="local" className="size-3.5 text-ciano" />
              {vaga.local}
            </li>
            {!vaga.remota && <li className="chip">{vaga.modalidadeNome}</li>}
            <li className="chip">{vaga.nivelNome}</li>
            <li className="chip">{vaga.contratoNome}</li>
            {vaga.pcd && <li className="chip">Também para PcD</li>}
          </ul>

          <p className="text-[17px] leading-snug font-extrabold text-amarelo">{vaga.destaque}</p>
          {vaga.prazo && <p className="-mt-1.5 text-sm font-semibold">{vaga.prazo}</p>}

          <BotaoCandidatar idVaga={vaga.id} link={vaga.linkCandidatura} className="min-[700px]:self-start" />

          {vaga.observacao && <p className="text-[15px] whitespace-pre-line text-apoio">{vaga.observacao}</p>}

          <hr className="my-1 border-borda" />

          <section className="mt-2 flex flex-col gap-2.5">
            <h2 className="titulo-secao">O que você vai fazer</h2>
            <TextoEmItens texto={vaga.atividades} />
          </section>
          <section className="mt-2 flex flex-col gap-2.5">
            <h2 className="titulo-secao">Requisitos</h2>
            <TextoEmItens texto={vaga.requisitos} />
          </section>
          {vaga.beneficios && (
            <section className="mt-2 flex flex-col gap-2.5">
              <h2 className="titulo-secao">Benefícios</h2>
              <TextoEmItens texto={vaga.beneficios} />
            </section>
          )}
          {vaga.comoSeCandidatar && (
            <section className="mt-2 flex flex-col gap-2.5">
              <h2 className="titulo-secao">Como se candidatar</h2>
              <Passos texto={vaga.comoSeCandidatar} />
            </section>
          )}

          <div className="mt-1.5 flex flex-col gap-3">
            <BotaoCandidatar idVaga={vaga.id} link={vaga.linkCandidatura} />
            {/^mailto:/i.test(vaga.linkCandidatura) && (
              <p className="text-sm text-apoio">
                O botão abre o seu aplicativo de e-mail. Endereço:{" "}
                <span className="font-bold text-texto">{vaga.linkCandidatura.replace(/^mailto:/i, "").split("?")[0]}</span>
              </p>
            )}
            <Compartilhar url={url} texto={`${tituloDaVaga(vaga)} (${vaga.local})\nVaga de TI no Sudoeste do PR:`} />
          </div>

          <p className="text-[13px] text-apoio">
            Publicada em {publicadaEm} · Inscrições até {encerraEm}
          </p>
        </article>

        <aside className="flex flex-col gap-4" aria-label="Sobre a empresa e report">
          <section className="cartao flex flex-col gap-3 p-5" aria-labelledby="titulo-empresa">
            <h2 id="titulo-empresa" className="titulo-secao">
              Sobre a empresa
            </h2>
            <div className="flex items-center gap-3">
              <LogoEmpresa logoUrl={vaga.logoUrl} iniciais={vaga.iniciais} />
              <p className="font-extrabold text-white">{vaga.empresaNome}</p>
            </div>
            {vaga.empresa.descricao && (
              <p className="text-[15px] whitespace-pre-line text-apoio">{vaga.empresa.descricao}</p>
            )}
            {redes.length > 0 && (
              <ul className="flex flex-wrap gap-x-5">
                {redes.map((r) => (
                  <li key={r.nome}>
                    <a className="link-seta" href={r.link} target="_blank" rel="noopener noreferrer">
                      {r.nome}
                      <Icone nome="externo" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <ReportarVaga idVaga={vaga.id} />
        </aside>
      </div>

      <ContarVisualizacao idVaga={vaga.id} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonParaScript(vagaParaGoogle(vaga, url)) }}
      />
    </div>
  );
}
