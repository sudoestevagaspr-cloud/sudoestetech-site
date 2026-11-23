import { SITE } from "@/lib/config";

// Chamada para empresas no fim da lista. Até a Fase 3 leva ao formulário do
// Google, ao Direct e ao e-mail, como no site antigo (decisão 18).
export function Chamada() {
  return (
    <div className="conteudo">
      <section
        aria-labelledby="titulo-chamada"
        className="cartao mt-6 mb-8 flex flex-col gap-3.5 p-[22px] min-[700px]:flex-row min-[700px]:items-center min-[700px]:justify-between min-[700px]:px-8 min-[700px]:py-7"
      >
        <div>
          <h2 id="titulo-chamada" className="mb-1.5 text-[19px] font-extrabold text-white">
            Tem vaga de TI na região?
          </h2>
          <p className="text-[15px] text-apoio">
            Preencha o formulário com os dados da vaga. Se preferir, mande pelo{" "}
            <a className="font-bold" href={SITE.direct} target="_blank" rel="noopener noreferrer">
              Direct do Instagram
            </a>{" "}
            ou para{" "}
            <a className="font-bold break-words" href={`mailto:${SITE.email}`}>
              {SITE.email}
            </a>
            .
          </p>
        </div>
        <a
          className="botao botao-cheio flex-none"
          href={SITE.formularioEmpresas}
          target="_blank"
          rel="noopener noreferrer"
        >
          Enviar vaga
        </a>
      </section>
    </div>
  );
}
