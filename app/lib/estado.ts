import { cores, type Cor } from "./cores";
import { buscarAfirmacao } from "./dados";

// Registro de uma afirmação sorteada na sessão. Cor e texto vêm de afirmacoes.json.
export type Registro = {
  ordem: number;
  id: string;
  horario: string; // ISO 8601
};

export type Estado = {
  historico: Registro[];
  atualId: string | null;
  revelado: boolean;
  coresAtivas: Cor[];
  duracaoSegundos: number;
  // Instante (ms) em que o tempo acaba; null com o cronômetro parado. Salvar o
  // fim, e não o tempo restante, faz a contagem sobreviver a recarregar a página.
  cronometroFim: number | null;
};

export const DURACAO_MAXIMA = 60 * 60;

const CHAVE = "semaforo-cidadania:v1";

export const estadoInicial: Estado = {
  historico: [],
  atualId: null,
  revelado: false,
  coresAtivas: cores.map((c) => c.nome),
  duracaoSegundos: 60,
  cronometroFim: null,
};

const ouvintes = new Set<() => void>();

// Cópia em memória, usada se o localStorage estiver indisponível.
let memoria: Estado = estadoInicial;
let brutoEmCache: string | null = null;
let estadoEmCache: Estado = estadoInicial;

function lerBruto(): string | null {
  try {
    return window.localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

// Descarta registros malformados, repetidos ou de ids que não existem mais.
function validarHistorico(valor: unknown): Registro[] {
  if (!Array.isArray(valor)) return [];
  const validos: Registro[] = [];
  const vistos = new Set<string>();
  for (const r of valor as (Partial<Registro> | null)[]) {
    if (typeof r?.id !== "string" || typeof r.horario !== "string") continue;
    if (Number.isNaN(Date.parse(r.horario))) continue;
    if (!buscarAfirmacao(r.id) || vistos.has(r.id)) continue;
    vistos.add(r.id);
    validos.push({ ordem: validos.length + 1, id: r.id, horario: r.horario });
  }
  return validos;
}

function validarCores(valor: unknown): Cor[] {
  if (!Array.isArray(valor)) return estadoInicial.coresAtivas;
  return cores.map((c) => c.nome).filter((nome) => valor.includes(nome));
}

function validarDuracao(valor: unknown): number {
  return Number.isInteger(valor) &&
    (valor as number) >= 1 &&
    (valor as number) <= DURACAO_MAXIMA
    ? (valor as number)
    : estadoInicial.duracaoSegundos;
}

function interpretar(bruto: string): Estado {
  try {
    const salvo = JSON.parse(bruto) as Partial<Estado>;
    const historico = validarHistorico(salvo.historico);
    const atualId = historico.some((r) => r.id === salvo.atualId)
      ? salvo.atualId!
      : null;
    const revelado = atualId !== null && salvo.revelado === true;
    return {
      historico,
      atualId,
      revelado,
      coresAtivas: validarCores(salvo.coresAtivas),
      duracaoSegundos: validarDuracao(salvo.duracaoSegundos),
      cronometroFim:
        atualId !== null && !revelado && Number.isFinite(salvo.cronometroFim)
          ? salvo.cronometroFim!
          : null,
    };
  } catch {
    return estadoInicial;
  }
}

export function obterEstado(): Estado {
  const bruto = lerBruto();
  if (bruto === null) return memoria;
  if (bruto !== brutoEmCache) {
    brutoEmCache = bruto;
    estadoEmCache = interpretar(bruto);
  }
  return estadoEmCache;
}

export function obterEstadoServidor(): Estado | null {
  return null;
}

export function assinar(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  // Mantém abas diferentes sincronizadas.
  const aoMudarStorage = (e: StorageEvent) => {
    if (e.key === CHAVE || e.key === null) ouvinte();
  };
  window.addEventListener("storage", aoMudarStorage);
  return () => {
    ouvintes.delete(ouvinte);
    window.removeEventListener("storage", aoMudarStorage);
  };
}

export function atualizar(mudanca: (e: Estado) => Estado): void {
  const novo = mudanca(obterEstado());
  memoria = novo;
  const bruto = JSON.stringify(novo);
  try {
    window.localStorage.setItem(CHAVE, bruto);
    brutoEmCache = bruto;
    estadoEmCache = novo;
  } catch {
    // Sem localStorage: segue apenas em memória.
  }
  ouvintes.forEach((o) => o());
}

export function definirDuracao(segundos: number): void {
  atualizar((e) => {
    // Com a contagem em andamento, recomeça com o novo tempo.
    const contando = e.cronometroFim !== null && e.cronometroFim > Date.now();
    return {
      ...e,
      duracaoSegundos: segundos,
      cronometroFim: contando ? Date.now() + segundos * 1000 : e.cronometroFim,
    };
  });
}

export function pararCronometro(): void {
  atualizar((e) => ({ ...e, cronometroFim: null }));
}

export function reiniciar(): void {
  atualizar(() => estadoInicial);
}
