import Link from "next/link";
import { CardVaga } from "@/components/CardVaga";
import { Icone } from "@/components/Icone";
import { SITE } from "@/lib/config";
import { lerVagasNoAr } from "@/lib/dados";

const MAXIMO = 12;

// Vaga que saiu do ar (ou link errado em /vagas/...): aviso e as vagas
// abertas logo abaixo, sem os dados da vaga antiga (decisão 17).
export default async function VagaForaDoAr() {
  const { vagas } = await lerVagasNoAr();
  return (
    <div className="conteudo pb-8">
      <p className="mt-[18px] mb-3.5">
        <Link href="/" className="link-seta">
          <Icone nome="voltar" />
          Todas as vagas
        </Link>
      </p>
      <div className="cartao mb-8 max-w-[720px] px-5 py-[22px]" role="status">
        <h1 className="mb-2 text-lg font-extrabold text-white">Esta vaga não está mais no ar</h1>
        <p className="text-[15px] text-apoio">
          Ela saiu do ar porque o prazo acabou ou as inscrições foram encerradas.
          {vagas.length > 0 ? " Veja as vagas abertas agora:" : ""}
        </p>
      </div>

      {vagas.length === 0 ? (
        <p className="text-[15px] text-apoio">
          Nenhuma vaga aberta agora. As novas vagas também aparecem no{" "}
          <a href={SITE.instagram} target="_blank" rel="noopener noreferrer" className="font-bold">
            Instagram
          </a>
          .
        </p>
      ) : (
        <section aria-labelledby="titulo-abertas" className="flex flex-col gap-4">
          <h2 id="titulo-abertas" className="text-xl font-extrabold text-white">
            Vagas abertas
          </h2>
          <div className="grid gap-3.5 min-[700px]:grid-cols-2 min-[700px]:gap-6 lg:grid-cols-3">
            {vagas.slice(0, MAXIMO).map((vaga) => (
              <CardVaga key={vaga.id} vaga={vaga} titulo="h3" />
            ))}
          </div>
          {vagas.length > MAXIMO && (
            <Link href="/" className="link-seta self-start">
              Ver todas as {vagas.length} vagas
              <Icone nome="seta" />
            </Link>
          )}
        </section>
      )}
    </div>
  );
}
