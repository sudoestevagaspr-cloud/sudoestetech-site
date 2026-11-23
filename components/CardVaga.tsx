import Link from "next/link";
import type { VagaCard } from "@/lib/vagas";
import { Icone } from "./Icone";
import { LogoEmpresa } from "./LogoEmpresa";

// Card de uma vaga na lista. Os links não fazem "prefetch": sem isso, cada
// card visível pediria a página da vaga ao servidor antes do clique, gastando
// requisições do plano gratuito da Cloudflare à toa.
export function CardVaga({ vaga, titulo = "h2" }: { vaga: VagaCard; titulo?: "h2" | "h3" }) {
  const Titulo = titulo;
  const link = `/vagas/${vaga.slug}`;
  return (
    <article className="cartao flex flex-col gap-3 p-[18px]" data-vaga={vaga.slug}>
      <div className="flex min-h-6 items-center justify-between gap-2">
        <span className="text-xs font-extrabold tracking-[2px] text-ciano uppercase">{vaga.areaPrincipalNome}</span>
        {vaga.nova && <span className="selo-nova">Nova</span>}
      </div>

      <div className="flex items-start gap-3">
        <LogoEmpresa logoUrl={vaga.logoUrl} iniciais={vaga.iniciais} />
        <div className="flex min-w-0 flex-col gap-1">
          <Titulo className="text-[19px] leading-tight font-extrabold text-white">
            <Link href={link} prefetch={false} className="text-inherit no-underline hover:text-ciano-claro">
              {vaga.cargo}
            </Link>
          </Titulo>
          <span className="text-sm font-medium text-apoio">{vaga.empresaNome}</span>
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

      <p className="text-[15px] leading-snug font-extrabold text-amarelo">{vaga.destaque}</p>
      {vaga.prazo && <p className="-mt-1.5 text-[13px] font-semibold">{vaga.prazo}</p>}

      <div className="mt-auto flex items-center justify-end border-t border-borda pt-2.5">
        <Link
          href={link}
          prefetch={false}
          className="link-seta"
          aria-label={`Ver detalhes: ${vaga.cargo}, ${vaga.empresaNome}`}
        >
          Ver detalhes
          <Icone nome="seta" />
        </Link>
      </div>
    </article>
  );
}
