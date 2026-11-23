"use client";

// Botão "Candidatar-se": abre o link da empresa (ou o e-mail, se o link for
// mailto:) e conta o clique, uma vez por dia por navegador. A candidatura
// acontece fora do site; aqui só contamos quantas pessoas clicaram.

import { contarUmaVezPorDia } from "@/lib/api-navegador";
import { Icone } from "../Icone";

export function BotaoCandidatar({
  idVaga,
  link,
  className = "",
}: {
  idVaga: string;
  link: string;
  className?: string;
}) {
  // O banco só aceita https://, http:// e mailto: (decisão 14). Conferir de
  // novo aqui impede que um link estranho vire código na página.
  const ehEmail = /^mailto:/i.test(link);
  if (!ehEmail && !/^https?:\/\//i.test(link)) return null;

  const contar = () => void contarUmaVezPorDia(idVaga, "clique_candidatura");

  return (
    <a
      href={link}
      className={`botao botao-cheio ${className}`}
      {...(ehEmail ? {} : { target: "_blank", rel: "noopener noreferrer" })}
      onClick={contar}
      // Clique com o botão do meio (abrir em nova aba) também conta.
      onAuxClick={(e) => {
        if (e.button === 1) contar();
      }}
    >
      {ehEmail ? "Candidatar-se por e-mail" : "Candidatar-se"}
      <Icone nome={ehEmail ? "email" : "externo"} className="size-[18px]" />
    </a>
  );
}
