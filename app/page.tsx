import { Chamada } from "@/components/Chamada";
import { ListaDeVagas } from "@/components/ListaDeVagas";
import { lerVagasNoAr } from "@/lib/dados";

// Página guardada em cache (ISR): só é montada de novo quando o banco avisa
// que algo mudou (veja app/api/revalidar/route.ts).
export const revalidate = false;

export default async function Inicio() {
  const { vagas, opcoes } = await lerVagasNoAr();
  const total = vagas.length;

  return (
    <>
      <section className="conteudo flex flex-col gap-3 pt-7 pb-5 lg:pt-14 lg:pb-7">
        <span className="sobretitulo">Sudoeste do Paraná</span>
        <h1 className="text-[28px] leading-[1.15] font-extrabold text-white min-[700px]:text-[40px] lg:max-w-[900px] lg:text-[56px]">
          Vagas de TI em Francisco Beltrão, Pato Branco e região
        </h1>
        <p className="text-sm text-apoio lg:text-base">
          <strong className="font-bold text-texto">
            {total === 0 ? "Nenhuma vaga aberta" : total === 1 ? "1 vaga aberta" : `${total} vagas abertas`}
          </strong>
        </p>
      </section>
      <ListaDeVagas vagas={vagas} opcoes={opcoes} />
      <Chamada />
    </>
  );
}
