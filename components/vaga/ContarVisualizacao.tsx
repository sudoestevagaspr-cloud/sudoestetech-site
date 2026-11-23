"use client";

// Conta uma visualização da vaga quando a página abre no navegador. A página
// vem pronta do cache, então a contagem precisa acontecer aqui, e não no servidor.

import { useEffect } from "react";
import { contarUmaVezPorDia } from "@/lib/api-navegador";

export function ContarVisualizacao({ idVaga }: { idVaga: string }) {
  useEffect(() => {
    void contarUmaVezPorDia(idVaga, "visualizacao");
  }, [idVaga]);
  return null;
}
