// Lê os três .md da raiz e gera afirmacoes.json. A cor vem do nome do arquivo.
//
// Formato aceito em cada .md:
//   - a primeira linha com texto é o título do bloco e é ignorada;
//   - uma afirmação começa com `1. ` ou só `. ` (o número é opcional);
//   - a explicação começa com `Explicação:` (com ou sem acento, com ou sem
//     espaço antes dos dois-pontos);
//   - linhas `Classificação: ...` e linhas em branco são ignoradas;
//   - qualquer outra linha continua o campo anterior.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");

const blocos = [
  { cor: "verde", prefixo: "VD", arquivos: ["bloco_verde.md"] },
  { cor: "amarelo", prefixo: "AM", arquivos: ["bloco_amarelo.md"] },
  {
    cor: "vermelho",
    prefixo: "VM",
    // "vemelho" é o nome atual do arquivo; o nome correto também é aceito.
    arquivos: ["bloco_vemelho.md", "bloco_vermelho.md"],
  },
];

const RE_AFIRMACAO = /^\s*(?:\d+\s*[.)]|\.)(?:\s+|$|(?=["“”]))(.*)$/;
const RE_EXPLICACAO = /^\s*explica[çc][ãa]o\s*:\s*(.*)$/i;
const RE_CLASSIFICACAO = /^\s*classifica[çc][ãa]o\s*:/i;

class ErroDeFormato extends Error {}

function limpar(texto) {
  return texto.replace(/\s+/g, " ").trim();
}

// As aspas da fonte são irregulares (faltam ou mudam de tipo); a tela coloca as suas.
function tirarAspas(texto) {
  return texto.replace(/^["“”]+/, "").replace(/["“”]+$/, "").trim();
}

function lerBloco(arquivo, conteudo) {
  const linhas = conteudo.replace(/^﻿/, "").normalize("NFC").split(/\r?\n/);
  const itens = [];
  let tituloLido = false;
  let atual = null;

  linhas.forEach((linha, i) => {
    const onde = `${arquivo}:${i + 1}`;
    if (linha.trim() === "" || RE_CLASSIFICACAO.test(linha)) return;

    if (!tituloLido) {
      tituloLido = true;
      return;
    }

    const afirmacao = linha.match(RE_AFIRMACAO);
    if (afirmacao) {
      atual = { linha: i + 1, afirmacao: afirmacao[1], explicacao: null };
      itens.push(atual);
      return;
    }

    if (!atual) {
      throw new ErroDeFormato(
        `${onde}: esperava o início de uma afirmação (ex.: \`1. "..."\`), mas encontrei: ${linha.trim()}`,
      );
    }

    const explicacao = linha.match(RE_EXPLICACAO);
    if (explicacao) {
      if (atual.explicacao !== null) {
        throw new ErroDeFormato(
          `${onde}: a afirmação da linha ${atual.linha} já tem explicação. Faltou o início (\`N. \`) de uma nova afirmação?`,
        );
      }
      atual.explicacao = explicacao[1];
      return;
    }

    if (atual.explicacao === null) atual.afirmacao += ` ${linha}`;
    else atual.explicacao += ` ${linha}`;
  });

  if (itens.length === 0) {
    throw new ErroDeFormato(`${arquivo}: nenhuma afirmação encontrada.`);
  }

  return itens.map((item) => {
    const afirmacao = tirarAspas(limpar(item.afirmacao));
    const explicacao = limpar(item.explicacao ?? "");
    if (!afirmacao) {
      throw new ErroDeFormato(`${arquivo}:${item.linha}: afirmação sem texto.`);
    }
    if (!explicacao) {
      throw new ErroDeFormato(
        `${arquivo}:${item.linha}: afirmação sem explicação ("${afirmacao}").`,
      );
    }
    return { afirmacao, explicacao };
  });
}

function acharArquivo({ cor, arquivos }) {
  const nome = arquivos.find((a) => existsSync(join(raiz, a)));
  if (!nome) {
    throw new ErroDeFormato(
      `Arquivo do bloco ${cor} não encontrado. Esperado na raiz: ${arquivos.join(" ou ")}.`,
    );
  }
  return nome;
}

try {
  const afirmacoes = [];
  const contagem = [];

  for (const bloco of blocos) {
    const arquivo = acharArquivo(bloco);
    const itens = lerBloco(arquivo, readFileSync(join(raiz, arquivo), "utf8"));
    itens.forEach((item, i) => {
      afirmacoes.push({
        id: `${bloco.prefixo}-${String(i + 1).padStart(2, "0")}`,
        cor: bloco.cor,
        ...item,
      });
    });
    contagem.push(`${bloco.cor}: ${itens.length}`);
  }

  writeFileSync(
    join(raiz, "afirmacoes.json"),
    `${JSON.stringify(afirmacoes, null, 2)}\n`,
  );
  console.log(
    `afirmacoes.json gerado. ${contagem.join(" · ")} · total: ${afirmacoes.length}`,
  );
} catch (erro) {
  if (!(erro instanceof ErroDeFormato)) throw erro;
  console.error(`Erro ao gerar afirmacoes.json: ${erro.message}`);
  process.exit(1);
}
