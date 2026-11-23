"use client";

// Compartilhar no WhatsApp e copiar o link da vaga.

import { useState } from "react";
import { Icone } from "../Icone";

export function Compartilhar({ url, texto }: { url: string; texto: string }) {
  const [estado, setEstado] = useState<"parado" | "copiado" | "falhou">("parado");

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setEstado("copiado");
    } catch {
      // Navegador sem permissão para a área de transferência: mostra o link
      // num campo para a pessoa copiar à mão.
      setEstado("falhou");
    }
  }

  // wa.me abre o WhatsApp com o texto pronto; a pessoa escolhe o contato.
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${texto}\n${url}`)}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 min-[700px]:flex-row">
        <a className="botao botao-contorno min-[700px]:flex-1" href={whatsapp} target="_blank" rel="noopener noreferrer">
          <Icone nome="compartilhar" className="size-[18px] text-ciano" />
          Compartilhar no WhatsApp
        </a>
        <button type="button" className="botao botao-contorno min-[700px]:flex-1" onClick={copiar}>
          <Icone nome="copiar" className="size-[18px] text-ciano" />
          {estado === "copiado" ? "Link copiado!" : "Copiar link"}
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {estado === "copiado" ? "Link da vaga copiado." : ""}
      </p>
      {estado === "falhou" && (
        <label className="flex flex-col gap-1.5 text-sm text-apoio">
          Não deu para copiar sozinho. Selecione o link abaixo e copie:
          <input className="campo px-3.5" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
        </label>
      )}
    </div>
  );
}
