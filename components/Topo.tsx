import Link from "next/link";
import { SITE } from "@/lib/config";
import { Icone } from "./Icone";

export function Topo() {
  return (
    <header className="border-b border-borda">
      <div className="conteudo flex items-center justify-between gap-3 py-3.5">
        <Link href="/" className="flex items-center gap-3 text-inherit no-underline hover:text-inherit">
          <img src="/img/logo.svg" alt="" width={40} height={40} className="size-10" />
          <span>
            <span className="block text-base leading-tight font-extrabold text-white">{SITE.nome}</span>
            <span className="block text-xs font-medium text-apoio">{SITE.perfil}</span>
          </span>
        </Link>
        <nav aria-label="Links" className="flex items-center gap-6">
          <a
            className="link-seta hidden text-texto hover:text-ciano min-[700px]:inline-flex"
            href={SITE.formularioEmpresas}
            target="_blank"
            rel="noopener noreferrer"
          >
            Tem vaga? Envie aqui
          </a>
          <a className="link-seta" href={SITE.instagram} target="_blank" rel="noopener noreferrer">
            Instagram
            <Icone nome="externo" />
          </a>
        </nav>
      </div>
    </header>
  );
}
