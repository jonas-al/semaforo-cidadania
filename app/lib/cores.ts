// Fonte única das cores do semáforo.

export type Cor = "verde" | "amarelo" | "vermelho";

export type InfoCor = {
  nome: Cor;
  rotulo: string;
  hex: string;
};

export const cores: InfoCor[] = [
  { nome: "verde", rotulo: "Verde", hex: "#16A34A" },
  { nome: "amarelo", rotulo: "Amarelo", hex: "#EAB308" },
  { nome: "vermelho", rotulo: "Vermelho", hex: "#DC2626" },
];

export const APAGADO = "#3F3F46";

const coresPorNome = new Map(cores.map((c) => [c.nome, c]));

export function buscarCor(nome: Cor): InfoCor {
  return coresPorNome.get(nome)!;
}
