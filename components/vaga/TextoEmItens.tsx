import { itens } from "@/lib/texto";

// Um texto da vaga como parágrafo (um item) ou lista (vários itens).
// Os itens são separados por linha ou por ";" no cadastro.
export function TextoEmItens({ texto }: { texto: string | null }) {
  const lista = itens(texto);
  if (lista.length === 0) return null;
  if (lista.length === 1) return <p>{lista[0]}</p>;
  return (
    <ul className="topicos">
      {lista.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

// "Como se candidatar": passos numerados quando houver mais de um.
export function Passos({ texto }: { texto: string | null }) {
  const lista = itens(texto);
  if (lista.length === 0) return null;
  if (lista.length === 1) return <p>{lista[0]}</p>;
  return (
    <ol className="passos">
      {lista.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ol>
  );
}
