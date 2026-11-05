import dados from "@/afirmacoes.json";
import type { Cor } from "./cores";

export type Afirmacao = {
  id: string;
  cor: Cor;
  afirmacao: string;
  explicacao: string;
};

export const afirmacoes = dados as Afirmacao[];

const afirmacoesPorId = new Map(afirmacoes.map((a) => [a.id, a]));

export function buscarAfirmacao(id: string): Afirmacao | undefined {
  return afirmacoesPorId.get(id);
}
