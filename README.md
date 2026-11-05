# Semáforo da Cidadania

Software para projetar em sala de aula: sorteia uma afirmação sobre o uso de IA, os alunos escolhem uma cor do semáforo (🟢 verde, 🟡 amarelo ou 🔴 vermelho) fora do sistema, levantando cartões ou a mão, e o professor revela a cor correta e a explicação.

Todo o conteúdo vem de `bloco_verde.md`, `bloco_amarelo.md` e `bloco_vemelho.md`, que geram [`afirmacoes.json`](afirmacoes.json).

## Como usar

```bash
npm install
npm run build
npm start        # http://localhost:3000
```

Para desenvolvimento: `npm run dev`.

Depois de carregada, a página funciona sem internet.

## Como editar as afirmações

Edite um dos três `.md` e rode `npm run gerar`. O `npm run build` e o `npm run dev` já fazem isso sozinhos ao iniciar (com o `dev` rodando, reinicie-o para ler a edição).

- **A cor vem do nome do arquivo**, não do texto.
- A primeira linha é o título do bloco. Cada afirmação começa com `1. ` ou só `. `, e a explicação, com `Explicação:`. Linhas `Classificação: ...` são ignoradas.
- **Acrescente afirmações novas no fim do arquivo.** O id (`VD-01`, `AM-01`, `VM-01`) vem da posição no arquivo e o histórico salvo depende dele: inserir ou apagar no meio muda os ids das afirmações seguintes.
- O script para com uma mensagem indicando o arquivo e a linha se encontrar uma afirmação sem texto ou sem explicação. No final, imprime quantas afirmações leu de cada cor.

## Funcionalidades

- **Sortear**: animação curta e exibição da afirmação.
- **A cor fica oculta até clicar em Revelar**: o semáforo fica apagado, e nem a cor nem a explicação estão na página antes disso.
- **Revelar**: acende só a luz correta e mostra o nome da cor e a explicação.
- Afirmações sorteadas não se repetem até reiniciar; contador `sorteadas/total` do filtro atual e mensagem quando acabarem.
- **Histórico** (fica oculto; abre pelo botão ou pela tecla `H`): ordem, id, cor, afirmação e horário de cada sorteio; clique para reabrir uma afirmação já revelada. A afirmação que está na tela e ainda não foi revelada aparece sem cor e sem id (o prefixo do id entrega a cor) e não pode ser reaberta.
- O histórico, a afirmação atual, o estado revelado/não revelado, os filtros e o cronômetro ficam salvos no `localStorage`, na chave `semaforo-cidadania:v1`, e sobrevivem a recarregar/fechar a página. Só são apagados por **Reiniciar** (com confirmação), que também volta o tempo para 1 min.
- **Filtros**: sortear só de algumas cores.
- **Cronômetro**: começa ao sortear a afirmação, com 1 min por padrão. Escolha 1, 2 ou 3 min ou digite outro tempo no campo ao lado (`2` para minutos, `1:30` para minutos e segundos, até 60 min). Trocar o tempo durante a contagem recomeça com o novo valor. Ao acabar, aparece o alerta **Tempo esgotado!**; clicar em **Revelar** antes disso para a contagem. A contagem continua depois de recarregar a página.
- **Tela cheia** e atalhos de teclado: `S` sortear · `R`/`Espaço`/`Enter` revelar · `H` histórico · `F` tela cheia · `Esc` fecha painéis.

## Código

- [`app/sorteio.tsx`](app/sorteio.tsx) – interface e lógica do sorteio.
- [`app/semaforo.tsx`](app/semaforo.tsx) – semáforo de 3 luzes (`Semaforo`) e bolinha colorida (`Bolinha`).
- [`app/lib/estado.ts`](app/lib/estado.ts) – estado persistido no `localStorage`, com validação do que foi salvo.
- [`app/lib/dados.ts`](app/lib/dados.ts) – leitura e tipos de `afirmacoes.json`.
- [`app/lib/cores.ts`](app/lib/cores.ts) – nome, rótulo e hex das 3 cores (fonte única).
- [`scripts/gerar-afirmacoes.mjs`](scripts/gerar-afirmacoes.mjs) – gera `afirmacoes.json` a partir dos `.md`.

O visual segue [`especificacao-design-sorteio-bingo.md`](especificacao-design-sorteio-bingo.md), trocando só as cores de destaque.
