import { describe, expect, it } from "vitest";
import { iniciais, itens, normalizar, resumir } from "@/lib/texto";

describe("normalizar (base da busca)", () => {
  it("tira acentos, deixa em minúsculas e junta espaços", () => {
    expect(normalizar("  Técnico   em INFORMÁTICA ")).toBe("tecnico em informatica");
    expect(normalizar("Francisco Beltrão")).toBe("francisco beltrao");
  });

  it("aceita vazio", () => {
    expect(normalizar(null)).toBe("");
    expect(normalizar(undefined)).toBe("");
  });
});

describe("iniciais (quadrado no lugar do logo)", () => {
  it("uma palavra: as duas primeiras letras", () => {
    expect(iniciais("Unimed")).toBe("UN");
  });

  it("várias palavras: a primeira letra das duas primeiras", () => {
    expect(iniciais("Empresa Exemplo")).toBe("EE");
    expect(iniciais("Agro Dados Sistemas")).toBe("AD");
  });

  it("ignora 'de', 'da', 'Ltda' e pontuação", () => {
    expect(iniciais("Cooperativa de Crédito")).toBe("CC");
    expect(iniciais("Sistemas Ltda.")).toBe("SI");
    expect(iniciais("A & B Software")).toBe("BS");
  });

  it("nome sem letras vira '?'", () => {
    expect(iniciais("—")).toBe("?");
  });
});

describe("itens (listas de atividades e requisitos)", () => {
  it("separa por linha e por ponto e vírgula, tirando marcadores", () => {
    expect(itens("Windows; Redes\n- Inglês\n• Git\n1. Linux\n2) SQL")).toEqual([
      "Windows",
      "Redes",
      "Inglês",
      "Git",
      "Linux",
      "SQL",
    ]);
  });

  it("ignora linhas vazias", () => {
    expect(itens("\n\n Python \n\n")).toEqual(["Python"]);
    expect(itens(null)).toEqual([]);
  });

  it("não confunde número no meio do texto com marcador", () => {
    expect(itens("Experiência de 2 anos")).toEqual(["Experiência de 2 anos"]);
  });
});

describe("resumir", () => {
  it("não corta texto curto", () => {
    expect(resumir("Vaga de TI", 50)).toBe("Vaga de TI");
  });

  it("corta no fim de uma palavra e põe reticências", () => {
    expect(resumir("Desenvolver e manter sistemas web da empresa", 25)).toBe("Desenvolver e manter…");
  });
});
