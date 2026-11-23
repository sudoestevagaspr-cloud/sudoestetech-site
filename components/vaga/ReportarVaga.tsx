"use client";

// "Reportar vaga": motivo de uma lista e um texto opcional (decisão 4).
// O report chega primeiro ao admin; só se for procedente a empresa é avisada.
// Não pede nome nem e-mail de quem reporta.

import { useId, useState } from "react";
import { LIMITE_DESCRICAO_REPORT, MOTIVOS_REPORT, enviarReport, type MotivoReport } from "@/lib/api-navegador";
import { Icone } from "../Icone";

type Estado = "preenchendo" | "enviando" | "enviado" | "erro";

export function ReportarVaga({ idVaga }: { idVaga: string }) {
  const [motivo, setMotivo] = useState<MotivoReport | "">("");
  const [descricao, setDescricao] = useState("");
  const [estado, setEstado] = useState<Estado>("preenchendo");
  const [avisoMotivo, setAvisoMotivo] = useState(false);
  const id = useId();

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!motivo) {
      setAvisoMotivo(true);
      return;
    }
    setEstado("enviando");
    try {
      await enviarReport(idVaga, motivo, descricao);
      setEstado("enviado");
    } catch {
      setEstado("erro");
    }
  }

  return (
    <details className="cartao group p-5">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-bold text-apoio hover:text-texto [&::-webkit-details-marker]:hidden">
        <Icone nome="bandeira" className="size-[18px] text-ciano" />
        Reportar vaga
        <span className="ml-auto text-ciano transition-transform group-open:rotate-90" aria-hidden="true">
          <Icone nome="seta" />
        </span>
      </summary>

      {estado === "enviado" ? (
        <p className="mt-4 text-[15px]" role="status">
          Obrigado! Vamos conferir esta vaga. Se o problema for confirmado, a empresa é avisada.
        </p>
      ) : (
        <form className="mt-4 flex flex-col gap-4" onSubmit={enviar} noValidate>
          <p className="text-sm text-apoio">
            Viu algo errado nesta vaga? Conte para a gente. Não pedimos seu nome nem seu e-mail.
          </p>
          <fieldset className="flex flex-col gap-2" aria-describedby={avisoMotivo ? `${id}-aviso` : undefined}>
            <legend className="mb-2 text-sm font-bold">Qual é o problema?</legend>
            {MOTIVOS_REPORT.map((m) => (
              <label key={m.valor} className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px]">
                <input
                  type="radio"
                  name={`${id}-motivo`}
                  value={m.valor}
                  checked={motivo === m.valor}
                  onChange={() => {
                    setMotivo(m.valor);
                    setAvisoMotivo(false);
                  }}
                  className="size-5 accent-ciano"
                />
                {m.nome}
              </label>
            ))}
            {avisoMotivo && (
              <p id={`${id}-aviso`} className="text-sm font-bold text-amarelo" role="alert">
                Escolha um motivo.
              </p>
            )}
          </fieldset>
          <label className="flex flex-col gap-1.5 text-sm font-bold">
            Quer explicar? (opcional)
            <textarea
              className="campo h-28 resize-y px-3.5 py-3 font-normal"
              maxLength={LIMITE_DESCRICAO_REPORT}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
            <span className="self-end text-xs font-normal text-apoio">
              {descricao.length}/{LIMITE_DESCRICAO_REPORT}
            </span>
          </label>
          {estado === "erro" && (
            <p className="text-sm font-bold text-amarelo" role="alert">
              Não conseguimos enviar agora. Confira sua internet e tente de novo em alguns minutos.
            </p>
          )}
          <button type="submit" className="botao botao-contorno self-start" disabled={estado === "enviando"}>
            {estado === "enviando" ? "Enviando…" : "Enviar report"}
          </button>
        </form>
      )}
    </details>
  );
}
