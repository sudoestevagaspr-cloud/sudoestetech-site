import { SITE } from "@/lib/config";

export function Rodape() {
  return (
    <footer className="mt-auto border-t border-borda">
      <div className="conteudo flex flex-col gap-2.5 pt-6 pb-8 text-sm text-apoio lg:flex-row lg:items-start lg:justify-between lg:gap-8">
        <div className="flex max-w-[720px] flex-col gap-2.5">
          <p>
            Não somos agência de empregos e não recebemos currículos. A candidatura é feita no link
            de cada empresa: confira sempre as informações na fonte.
          </p>
          <p>
            Tem vaga de TI? Envie pelo{" "}
            <a className="font-bold" href={SITE.formularioEmpresas} target="_blank" rel="noopener noreferrer">
              formulário
            </a>
            , pelo{" "}
            <a className="font-bold" href={SITE.direct} target="_blank" rel="noopener noreferrer">
              Direct
            </a>{" "}
            ou pelo e-mail{" "}
            <a className="font-bold break-words" href={`mailto:${SITE.email}`}>
              {SITE.email}
            </a>
          </p>
        </div>
        <p>
          {SITE.nome} ·{" "}
          <a className="font-bold" href={SITE.instagram} target="_blank" rel="noopener noreferrer">
            {SITE.perfil}
          </a>
        </p>
      </div>
    </footer>
  );
}
