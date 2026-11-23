"use client";

// Contador de visitas do site com o GoatCounter (decisão 19), como no site
// antigo: só números (quantas vezes cada página foi vista), sem cookies, sem
// IP e sem saber quem é a pessoa. As métricas de cada vaga ficam no banco.
//
// Só conta no domínio principal (sudoestetech.com.br): visitas no endereço
// de teste da Cloudflare e no computador não entram na conta.

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { SITE } from "@/lib/config";

type GoatCounter = { no_onload?: boolean; count?: (dados: { path: string }) => void };

declare global {
  interface Window {
    goatcounter?: GoatCounter;
  }
}

// Versão fixa do script com "integrity": se alguém alterar o arquivo no
// servidor do GoatCounter, o navegador se recusa a rodá-lo.
const SCRIPT = "https://gc.zgo.at/count.v4.js";
const INTEGRIDADE = "sha384-nRw6qfbWyJha9LhsOtSb2YJDyZdKvvCFh0fJYlkquSFjUxp9FVNugbfy8q1jdxI+";

let carregando: Promise<void> | null = null;

function carregarScript(endereco: string): Promise<void> {
  carregando ??= new Promise((pronto, falhou) => {
    // no_onload: a página diz o que contar, inclusive nas trocas de página
    // feitas sem recarregar (links internos do Next.js).
    window.goatcounter = { no_onload: true };
    const s = document.createElement("script");
    s.async = true;
    s.src = SCRIPT;
    s.integrity = INTEGRIDADE;
    s.crossOrigin = "anonymous";
    s.dataset.goatcounter = endereco;
    s.onload = () => pronto();
    s.onerror = () => falhou(new Error("GoatCounter não carregou"));
    document.head.appendChild(s);
  });
  return carregando;
}

export function Contador() {
  const caminho = usePathname();

  useEffect(() => {
    if (window.location.hostname !== SITE.dominioPrincipal) return;
    carregarScript(`https://${SITE.goatcounter}.goatcounter.com/count`)
      .then(() => window.goatcounter?.count?.({ path: caminho }))
      .catch(() => {
        // O contador nunca quebra o site.
      });
  }, [caminho]);

  return null;
}
