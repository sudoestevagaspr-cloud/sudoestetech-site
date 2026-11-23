"use client";

// Aparece se o site não conseguir montar uma página (ex.: Supabase fora do ar).
// A cópia guardada em cache continua sendo entregue enquanto existir; este
// aviso só aparece quando não há cópia e o banco não respondeu.

import { SITE } from "@/lib/config";
import { Icone } from "@/components/Icone";

export default function Erro({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="conteudo">
      <div className="cartao my-8 max-w-[720px] px-5 py-[22px]" role="alert">
        <h1 className="mb-2 text-lg font-extrabold text-white">Não conseguimos carregar as vagas</h1>
        <p className="mb-3 text-[15px] text-apoio">
          Pode ser a sua conexão ou uma instabilidade do nosso lado. Tente de novo em alguns minutos.
          Enquanto isso, as vagas também estão no Instagram.
        </p>
        <div className="flex flex-wrap gap-x-6">
          <button type="button" className="link-seta text-ciano hover:text-ciano-claro" onClick={() => retry()}>
            Tentar de novo
          </button>
          <a className="link-seta" href={SITE.instagram} target="_blank" rel="noopener noreferrer">
            Ver as vagas no Instagram
            <Icone nome="externo" />
          </a>
        </div>
      </div>
    </div>
  );
}
