import type { Metadata } from "next";
import Link from "next/link";
import { Icone } from "@/components/Icone";

export const metadata: Metadata = {
  title: "Página não encontrada",
};

export default function PaginaNaoEncontrada() {
  return (
    <div className="conteudo">
      <p className="mt-[18px] mb-3.5">
        <Link href="/" className="link-seta">
          <Icone nome="voltar" />
          Todas as vagas
        </Link>
      </p>
      <div className="cartao mb-8 max-w-[720px] px-5 py-[22px]" role="status">
        <h1 className="mb-2 text-lg font-extrabold text-white">Página não encontrada</h1>
        <p className="mb-3 text-[15px] text-apoio">
          Este endereço não existe no site. Pode ter sido digitado errado ou a página mudou de lugar.
          As vagas abertas estão na página inicial.
        </p>
        <Link href="/" className="link-seta">
          Ver as vagas abertas
          <Icone nome="seta" />
        </Link>
      </div>
    </div>
  );
}
