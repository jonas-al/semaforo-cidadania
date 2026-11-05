"use client";

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { buscarCor, cores, type Cor } from "./lib/cores";
import { afirmacoes, buscarAfirmacao, type Afirmacao } from "./lib/dados";
import {
  assinar,
  atualizar,
  definirDuracao,
  DURACAO_MAXIMA,
  estadoInicial,
  obterEstado,
  obterEstadoServidor,
  pararCronometro,
  reiniciar,
  type Estado,
} from "./lib/estado";
import { Bolinha, Semaforo } from "./semaforo";

const DURACAO_ANIMACAO = 1400;
const TEMPOS_PRONTOS = [60, 120, 180];

function afirmacoesDoFiltro(estado: Estado): Afirmacao[] {
  const ativas = new Set(estado.coresAtivas);
  return afirmacoes.filter((a) => ativas.has(a.cor));
}

function sortearUm<T>(lista: T[]): T {
  return lista[Math.floor(Math.random() * lista.length)];
}

function formatarHora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatarOrdem(ordem: number): string {
  return String(ordem).padStart(2, "0");
}

function movimentoReduzido(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function formatarTempo(segundos: number): string {
  const resto = String(segundos % 60).padStart(2, "0");
  return `${Math.floor(segundos / 60)}:${resto}`;
}

// Aceita minutos ("2") ou minutos:segundos ("1:30"). Null se for inválido.
function lerTempo(texto: string): number | null {
  const partes = texto.trim().match(/^(\d{1,2})(?::([0-5]\d))?$/);
  if (!partes) return null;
  const segundos = Number(partes[1]) * 60 + Number(partes[2] ?? 0);
  return segundos >= 1 && segundos <= DURACAO_MAXIMA ? segundos : null;
}

// --- Relógio ------------------------------------------------------------

function assinarRelogio(ouvinte: () => void) {
  const id = window.setInterval(ouvinte, 200);
  return () => window.clearInterval(id);
}

// Hora atual em passos de 200 ms, para o valor só mudar quando houver o que redesenhar.
function useAgora() {
  return useSyncExternalStore(
    assinarRelogio,
    () => Math.floor(Date.now() / 200) * 200,
    () => 0,
  );
}

// --- Tela cheia ---------------------------------------------------------

function assinarTelaCheia(ouvinte: () => void) {
  document.addEventListener("fullscreenchange", ouvinte);
  return () => document.removeEventListener("fullscreenchange", ouvinte);
}

function useTelaCheia() {
  return useSyncExternalStore(
    assinarTelaCheia,
    () => document.fullscreenElement !== null,
    () => false,
  );
}

function alternarTelaCheia() {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  } else {
    document.documentElement.requestFullscreen().catch(() => {});
  }
}

// --- Componente principal ------------------------------------------------

export default function Sorteio() {
  const estado = useSyncExternalStore(
    assinar,
    obterEstado,
    obterEstadoServidor,
  );
  const telaCheia = useTelaCheia();
  const [sorteando, setSorteando] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const temporizadores = useRef<number[]>([]);

  useEffect(() => {
    const t = temporizadores.current;
    return () => t.forEach((id) => window.clearTimeout(id));
  }, []);

  const pronto = estado !== null;
  const e = estado ?? estadoInicial;

  const filtro = afirmacoesDoFiltro(e);
  const jaSorteadas = new Set(e.historico.map((r) => r.id));
  const restantes = filtro.filter((a) => !jaSorteadas.has(a.id));
  const sorteadasNoFiltro = filtro.length - restantes.length;
  const atual = e.atualId ? buscarAfirmacao(e.atualId) : undefined;
  const semCores = e.coresAtivas.length === 0;

  function limparTemporizadores() {
    temporizadores.current.forEach((id) => window.clearTimeout(id));
    temporizadores.current = [];
  }

  function registrar(escolhida: Afirmacao) {
    atualizar((s) => {
      // Proteção extra: nunca registrar a mesma afirmação duas vezes.
      if (s.historico.some((r) => r.id === escolhida.id)) return s;
      return {
        ...s,
        historico: [
          ...s.historico,
          {
            ordem: s.historico.length + 1,
            id: escolhida.id,
            horario: new Date().toISOString(),
          },
        ],
        atualId: escolhida.id,
        revelado: false,
        cronometroFim: Date.now() + s.duracaoSegundos * 1000,
      };
    });
  }

  function sortear() {
    if (sorteando || restantes.length === 0) return;
    const escolhida = sortearUm(restantes);
    pararCronometro();
    if (movimentoReduzido()) {
      registrar(escolhida);
      return;
    }

    setSorteando(true);
    const fim = window.setTimeout(() => {
      limparTemporizadores();
      setSorteando(false);
      registrar(escolhida);
    }, DURACAO_ANIMACAO);
    temporizadores.current.push(fim);
  }

  function revelar() {
    if (!atual || sorteando || e.revelado) return;
    atualizar((s) => ({ ...s, revelado: true, cronometroFim: null }));
  }

  function reabrir(id: string) {
    if (sorteando) return;
    atualizar((s) => ({
      ...s,
      atualId: id,
      revelado: true,
      cronometroFim: null,
    }));
  }

  function confirmarReinicio() {
    const total = e.historico.length;
    const mensagem =
      total === 0
        ? "Reiniciar o sorteio? Os filtros e o tempo também voltam ao padrão."
        : `Apagar o registro de ${total} ${total > 1 ? "afirmações sorteadas" : "afirmação sorteada"}, limpar os filtros e o tempo e reiniciar o sorteio?\n\nEssa ação não pode ser desfeita.`;
    if (!window.confirm(mensagem)) return;
    limparTemporizadores();
    setSorteando(false);
    reiniciar();
  }

  const aoTeclar = useEffectEvent((ev: KeyboardEvent) => {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (ev.key === "Escape") {
      // Primeiro fecha o alerta de tempo esgotado, que fica por cima de tudo.
      if (e.cronometroFim !== null && e.cronometroFim <= Date.now()) {
        pararCronometro();
        return;
      }
      setFiltrosAbertos(false);
      setHistoricoAberto(false);
      return;
    }
    // Segurar uma tecla não pode sortear várias afirmações em sequência.
    if (ev.repeat || ev.target instanceof HTMLInputElement) return;
    if (filtrosAbertos) return;
    switch (ev.key.toLowerCase()) {
      case "s":
        sortear();
        break;
      case " ":
      case "enter":
        // Com foco de teclado num botão, Espaço/Enter acionam esse botão.
        if (ev.target instanceof HTMLButtonElement) return;
        if (!historicoAberto) revelar();
        break;
      case "r":
        if (!historicoAberto) revelar();
        break;
      case "h":
        setHistoricoAberto((v) => !v);
        break;
      case "f":
        alternarTelaCheia();
        break;
      default:
        return;
    }
    ev.preventDefault();
  });

  useEffect(() => {
    const aoPressionar = (ev: KeyboardEvent) => aoTeclar(ev);
    // Tira o foco dos botões clicados com o mouse; senão, Espaço/Enter logo
    // depois de clicar em Sortear sortearia de novo em vez de revelar.
    const aoClicar = (ev: MouseEvent) => {
      const ativo = document.activeElement;
      if (ev.detail > 0 && ativo instanceof HTMLButtonElement) ativo.blur();
    };
    window.addEventListener("keydown", aoPressionar);
    window.addEventListener("click", aoClicar);
    return () => {
      window.removeEventListener("keydown", aoPressionar);
      window.removeEventListener("click", aoClicar);
    };
  }, []);

  const ordemAtual = atual
    ? e.historico.find((r) => r.id === atual.id)?.ordem
    : undefined;
  const anuncio =
    !atual || sorteando
      ? ""
      : e.revelado
        ? `Resposta: ${buscarCor(atual.cor).rotulo}. ${atual.explicacao}`
        : `Afirmação sorteada${ordemAtual !== undefined ? ` nº ${ordemAtual}` : ""}: ${atual.afirmacao}`;

  const rotuloSortear = !pronto
    ? "Sortear"
    : semCores
      ? "Nenhuma cor selecionada"
      : restantes.length > 0
        ? "Sortear"
        : filtro.length < afirmacoes.length
          ? "Todas as afirmações do filtro foram sorteadas"
          : "Todas as afirmações foram sorteadas";

  return (
    // No projetor (lg+), tudo cabe na altura da tela: os botões ficam sempre
    // visíveis e, se preciso, só a afirmação rola por dentro.
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      {/* Cabeçalho */}
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 sm:px-6">
        <h1 className="mr-auto text-3xl leading-none font-bold tracking-[0.04em] sm:text-4xl">
          Semáforo da Cidadania
        </h1>
        <div className="flex flex-wrap gap-2">
          <Pilula titulo="Afirmações sorteadas / total de afirmações no filtro atual">
            Afirmações: {pronto ? `${sorteadasNoFiltro}/${filtro.length}` : "–"}
          </Pilula>
        </div>
        <nav className="flex flex-wrap gap-2">
          <BotaoSecundario
            onClick={() => setFiltrosAbertos(true)}
            disabled={!pronto}
          >
            Filtros
            {pronto && e.coresAtivas.length < cores.length && (
              <span className="ml-2 rounded-full bg-ink px-2 text-sm text-on-tile">
                {e.coresAtivas.length}
              </span>
            )}
          </BotaoSecundario>
          <BotaoSecundario
            onClick={() => setHistoricoAberto((v) => !v)}
            ativo={historicoAberto}
            disabled={!pronto}
          >
            Histórico ({e.historico.length})
          </BotaoSecundario>
          <BotaoSecundario onClick={alternarTelaCheia}>
            {telaCheia ? "Sair da tela cheia" : "Tela cheia"}
          </BotaoSecundario>
          <BotaoSecundario onClick={confirmarReinicio} disabled={!pronto}>
            Reiniciar
          </BotaoSecundario>
        </nav>
      </header>

      <main className="flex min-h-0 w-full flex-1 flex-col gap-5 px-4 pb-6 sm:px-6">
        {!pronto ? (
          <Painel className="flex flex-1 items-center justify-center">
            <p className="text-2xl text-ink-muted">Carregando…</p>
          </Painel>
        ) : sorteando ? (
          <Animacao />
        ) : atual ? (
          <AfirmacaoExibida
            key={atual.id}
            afirmacao={atual}
            ordem={ordemAtual}
            revelado={e.revelado}
          />
        ) : (
          <TelaInicial
            restantes={restantes.length}
            semCores={semCores}
          />
        )}

        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          <Cronometro
            fim={e.cronometroFim}
            duracao={e.duracaoSegundos}
            desabilitado={!pronto}
          />
          <div className="flex flex-wrap items-center justify-center gap-3">
            <BotaoSortear
              onClick={sortear}
              disabled={!pronto || sorteando || restantes.length === 0}
            >
              {rotuloSortear}
            </BotaoSortear>
            <BotaoSecundario
              onClick={revelar}
              disabled={!pronto || sorteando || !atual || e.revelado}
              atalho="R"
              grande
            >
              Revelar
            </BotaoSecundario>
          </div>
        </div>
      </main>

      <p className="sr-only" aria-live="polite">
        {anuncio}
      </p>

      {historicoAberto && pronto && (
        <PainelHistorico
          estado={e}
          onReabrir={reabrir}
          onFechar={() => setHistoricoAberto(false)}
          bloqueado={sorteando}
        />
      )}

      {filtrosAbertos && pronto && (
        <PainelFiltros
          estado={e}
          onFechar={() => setFiltrosAbertos(false)}
        />
      )}

      {e.cronometroFim !== null && <AlertaTempo fim={e.cronometroFim} />}
    </div>
  );
}

// --- Telas ---------------------------------------------------------------

// Semáforo à esquerda e o conteúdo à direita, como na tela principal.
function Palco({
  cor,
  semaforoClassName,
  className = "",
  children,
}: {
  cor: Cor | null;
  semaforoClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Painel className={`flex min-h-0 flex-1 flex-col overflow-y-auto ${className}`}>
      <div className="m-auto flex w-full max-w-6xl flex-col items-center gap-6 md:flex-row md:gap-10">
        <Semaforo cor={cor} className={semaforoClassName} />
        <div className="flex w-full min-w-0 flex-1 flex-col gap-4 xl:gap-5">
          {children}
        </div>
      </div>
    </Painel>
  );
}

function TelaInicial({
  restantes,
  semCores,
}: {
  restantes: number;
  semCores: boolean;
}) {
  const aviso = semCores
    ? "Nenhuma cor selecionada. Abra os filtros para escolher."
    : restantes === 0
      ? "Todas as afirmações do filtro atual já foram sorteadas. Reinicie o sorteio ou altere os filtros."
      : null;

  return (
    <Palco cor={null}>
      <p className="text-[clamp(1.375rem,min(2.8vw,5dvh),3.25rem)] leading-tight font-semibold">
        {aviso ? "Nada para sortear" : "Clique em Sortear"}
      </p>
      <p className="max-w-3xl text-xl leading-snug text-ink-muted sm:text-2xl">
        Sorteie uma afirmação, escolha uma cor do semáforo e revele a resposta.
      </p>
      {aviso && (
        <p className="max-w-3xl rounded-3xl border-[3px] border-ink px-6 py-4 text-xl font-semibold">
          {aviso}
        </p>
      )}
      <p className="text-base text-ink-muted">
        Atalhos: <Tecla>S</Tecla> sortear · <Tecla>R</Tecla>/
        <Tecla>Espaço</Tecla>/<Tecla>Enter</Tecla> revelar · <Tecla>H</Tecla>{" "}
        histórico · <Tecla>F</Tecla> tela cheia · <Tecla>Esc</Tecla> fecha
        painéis
      </p>
    </Palco>
  );
}

// Animação neutra: o semáforo fica apagado para não sugerir resposta.
function Animacao() {
  return (
    <Palco cor={null} semaforoClassName="animate-balanco">
      <p className="text-[clamp(1.375rem,min(2.8vw,5dvh),3.25rem)] leading-tight font-semibold text-ink-muted">
        Sorteando…
      </p>
    </Palco>
  );
}

// O id carrega o prefixo da cor, então não aparece aqui. Antes de revelar,
// nem a cor nem a explicação entram no DOM.
function AfirmacaoExibida({
  afirmacao,
  ordem,
  revelado,
}: {
  afirmacao: Afirmacao;
  ordem?: number;
  revelado: boolean;
}) {
  return (
    <Palco cor={revelado ? afirmacao.cor : null} className="animate-pulo">
      {ordem !== undefined && (
        <div>
          <Pilula>Nº {formatarOrdem(ordem)}</Pilula>
        </div>
      )}

      <p className="text-[clamp(1.375rem,min(2.8vw,5dvh),3.25rem)] leading-tight font-semibold">
        “{afirmacao.afirmacao}”
      </p>

      {revelado && (
        <div className="animate-surgir flex flex-col gap-2 rounded-2xl bg-app px-5 py-3 xl:gap-3 xl:py-4">
          <p className="flex items-center gap-3 text-[clamp(1.375rem,min(2.6vw,4.5dvh),2.75rem)] leading-none font-bold tracking-[0.08em] uppercase">
            <Bolinha cor={afirmacao.cor} className="size-[1em]" />
            {buscarCor(afirmacao.cor).rotulo}
          </p>
          <p className="text-[clamp(1.0625rem,min(1.9vw,3.4dvh),2rem)] leading-snug">
            {afirmacao.explicacao}
          </p>
        </div>
      )}
    </Palco>
  );
}

// --- Cronômetro ----------------------------------------------------------

// Fica em componentes próprios para só eles redesenharem a cada passo do relógio.
function Cronometro({
  fim,
  duracao,
  desabilitado,
}: {
  fim: number | null;
  duracao: number;
  desabilitado: boolean;
}) {
  const [texto, setTexto] = useState("");
  const [invalido, setInvalido] = useState(false);
  const campo = useRef<HTMLInputElement>(null);

  function aplicarTexto() {
    if (texto.trim() === "") {
      setInvalido(false);
      return;
    }
    const segundos = lerTempo(texto);
    setInvalido(segundos === null);
    if (segundos === null) return;
    definirDuracao(segundos);
    setTexto("");
  }

  const personalizado = !TEMPOS_PRONTOS.includes(duracao);

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Mostrador fim={fim} duracao={duracao} />
      {TEMPOS_PRONTOS.map((segundos) => (
        <BotaoSecundario
          key={segundos}
          onClick={() => definirDuracao(segundos)}
          ativo={duracao === segundos}
          disabled={desabilitado}
        >
          {segundos / 60} min
        </BotaoSecundario>
      ))}
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          campo.current?.blur();
        }}
      >
        <input
          ref={campo}
          type="text"
          autoComplete="off"
          value={texto}
          onChange={(ev) => {
            setTexto(ev.target.value);
            setInvalido(false);
          }}
          onBlur={aplicarTexto}
          disabled={desabilitado}
          aria-label="Outro tempo, em minutos ou minutos:segundos, por exemplo 1:30"
          aria-invalid={invalido}
          title={
            invalido
              ? "Use minutos ou minutos:segundos, de 0:01 a 60:00"
              : "Digite os minutos ou minutos:segundos, por exemplo 1:30"
          }
          placeholder={personalizado ? formatarTempo(duracao) : "Outro"}
          className={`min-h-11 w-20 rounded-full border-2 bg-surface px-3 text-center text-base font-semibold tabular-nums ${
            personalizado ? "placeholder:text-ink" : "placeholder:text-ink-muted"
          } ${invalido ? "border-dashed border-[#DC2626]" : "border-ink"}`}
        />
      </form>
    </div>
  );
}

function Mostrador({ fim, duracao }: { fim: number | null; duracao: number }) {
  const agora = useAgora();
  const restante =
    fim === null ? duracao : Math.max(0, Math.ceil((fim - agora) / 1000));
  return (
    <span
      role="timer"
      aria-label="Tempo restante"
      className="min-w-24 text-center text-4xl leading-none font-bold tabular-nums"
    >
      {formatarTempo(restante)}
    </span>
  );
}

function AlertaTempo({ fim }: { fim: number }) {
  const agora = useAgora();
  if (agora < fim) return null;
  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-ink/70 p-4"
      onClick={pararCronometro}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="titulo-tempo"
        className="animate-pulo flex flex-col items-center gap-6 rounded-3xl border-[3px] border-ink bg-surface px-10 py-8 text-center"
        onClick={(ev) => ev.stopPropagation()}
      >
        <h2
          id="titulo-tempo"
          className="text-[clamp(2.5rem,min(7vw,12dvh),5.5rem)] leading-none font-bold"
        >
          Tempo esgotado!
        </h2>
        <p className="text-2xl text-ink-muted">
          Pressione <Tecla>R</Tecla> para revelar a resposta.
        </p>
        <BotaoSortear onClick={pararCronometro} compacto>
          Fechar
        </BotaoSortear>
      </div>
    </div>
  );
}

// --- Painéis -------------------------------------------------------------

function PainelHistorico({
  estado,
  onReabrir,
  onFechar,
  bloqueado,
}: {
  estado: Estado;
  onReabrir: (id: string) => void;
  onFechar: () => void;
  bloqueado: boolean;
}) {
  const lista = [...estado.historico].reverse();
  return (
    <div className="fixed inset-0 z-10 flex justify-end bg-ink/50" onClick={onFechar}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-historico"
        className="flex h-full w-full max-w-md flex-col border-l-[3px] border-ink bg-surface"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b-[3px] border-ink px-6 py-4">
          <h2 id="titulo-historico" className="text-2xl font-bold">
            Afirmações sorteadas ({estado.historico.length})
          </h2>
          <BotaoFechar onClick={onFechar} rotulo="Fechar histórico" />
        </div>
        {lista.length === 0 ? (
          <p className="p-6 text-lg text-ink-muted">
            Nenhuma afirmação sorteada ainda.
          </p>
        ) : (
          <ul className="flex-1 overflow-y-auto">
            {lista.map((r) => {
              const afirmacao = buscarAfirmacao(r.id);
              if (!afirmacao) return null;
              const ativo = r.id === estado.atualId;
              // A afirmação na tela ainda sem resposta não pode ser entregue
              // pelo histórico: a cor e o id (que tem o prefixo da cor) ficam
              // ocultos, e clicar nela não a revela.
              const oculta = ativo && !estado.revelado;
              return (
                <li key={r.id} className="border-b-2 border-app">
                  <button
                    type="button"
                    onClick={() => onReabrir(r.id)}
                    disabled={bloqueado || oculta}
                    className={`flex w-full gap-4 px-6 py-4 text-left transition enabled:hover:bg-app disabled:opacity-60 ${
                      ativo ? "bg-app" : ""
                    }`}
                    title={
                      oculta
                        ? "Afirmação atual: use Revelar na tela principal"
                        : "Reabrir esta afirmação"
                    }
                  >
                    <Bolinha
                      cor={oculta ? null : afirmacao.cor}
                      className="mt-0.5 size-8"
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex items-baseline gap-2 text-base">
                        <span className="font-bold tabular-nums">
                          Nº {formatarOrdem(r.ordem)}
                        </span>
                        {!oculta && (
                          <span className="text-ink-muted">{r.id}</span>
                        )}
                        <span className="ml-auto text-ink-muted tabular-nums">
                          {formatarHora(r.horario)}
                        </span>
                      </span>
                      <span className="font-semibold">
                        {oculta
                          ? "Ainda não revelada"
                          : buscarCor(afirmacao.cor).rotulo}
                      </span>
                      <span className="line-clamp-2 text-ink-muted">
                        {afirmacao.afirmacao}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
    </div>
  );
}

function PainelFiltros({
  estado,
  onFechar,
}: {
  estado: Estado;
  onFechar: () => void;
}) {
  const ativas = new Set(estado.coresAtivas);

  function alternarCor(nome: Cor) {
    atualizar((s) => ({
      ...s,
      coresAtivas: s.coresAtivas.includes(nome)
        ? s.coresAtivas.filter((c) => c !== nome)
        : [...s.coresAtivas, nome],
    }));
  }

  function definirTodas(marcar: boolean) {
    atualizar((s) => ({
      ...s,
      coresAtivas: marcar ? cores.map((c) => c.nome) : [],
    }));
  }

  return (
    <div
      className="fixed inset-0 z-10 flex items-center justify-center bg-ink/50 p-4"
      onClick={onFechar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-filtros"
        className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-3xl border-[3px] border-ink bg-surface"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b-[3px] border-ink px-6 py-4">
          <h2 id="titulo-filtros" className="text-2xl font-bold">
            Filtros do sorteio
          </h2>
          <BotaoFechar onClick={onFechar} rotulo="Fechar filtros" />
        </div>
        <div className="flex flex-col gap-6 overflow-y-auto px-6 py-5">
          <section>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h3 className="mr-auto text-lg font-semibold">
                Sortear somente destas cores
              </h3>
              <BotaoSecundario onClick={() => definirTodas(true)}>
                Marcar todas
              </BotaoSecundario>
              <BotaoSecundario onClick={() => definirTodas(false)}>
                Desmarcar todas
              </BotaoSecundario>
            </div>
            <ul className="grid gap-2">
              {cores.map((cor) => {
                const daCor = afirmacoes.filter((a) => a.cor === cor.nome);
                return (
                  <li key={cor.nome}>
                    <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl bg-app px-4 py-2.5 text-lg">
                      <input
                        type="checkbox"
                        checked={ativas.has(cor.nome)}
                        onChange={() => alternarCor(cor.nome)}
                        className="size-5 shrink-0 accent-ink"
                      />
                      <Bolinha cor={cor.nome} className="size-8" />
                      <span className="mr-auto leading-tight">
                        {cor.rotulo}
                      </span>
                      {/* Só o total: mostrar quantas restam revelaria as cores sorteadas. */}
                      <span
                        className="text-base text-ink-muted tabular-nums"
                        title="Total de afirmações da cor"
                      >
                        {daCor.length}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
        <div className="flex justify-end border-t-[3px] border-ink px-6 py-4">
          <BotaoSortear onClick={onFechar} compacto>
            Concluir
          </BotaoSortear>
        </div>
      </div>
    </div>
  );
}

// --- Elementos básicos ---------------------------------------------------

function Painel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-3xl border-[3px] border-ink bg-surface p-6 ${className}`}
    >
      {children}
    </section>
  );
}

function Pilula({
  children,
  titulo,
}: {
  children: ReactNode;
  titulo?: string;
}) {
  return (
    <span
      className="inline-block rounded-full border-2 border-ink bg-surface px-3.5 py-2 leading-none font-semibold tabular-nums"
      title={titulo}
    >
      {children}
    </span>
  );
}

function BotaoSortear({
  children,
  onClick,
  disabled,
  compacto,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  compacto?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      // Borda inferior sólida (sem desfoque) dá volume de botão físico;
      // ao pressionar, o botão "afunda" sobre ela.
      className={`flex items-center gap-3 rounded-full bg-ink font-semibold text-on-tile transition-[transform,box-shadow,background-color] duration-100 enabled:hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-40 ${
        compacto
          ? "min-h-11 px-6 text-lg shadow-[0_4px_0_var(--ink-muted)] enabled:active:translate-y-1 enabled:active:shadow-none"
          : "min-h-14 px-6 py-2 text-xl shadow-[0_6px_0_var(--ink-muted)] enabled:hover:-translate-y-0.5 enabled:hover:shadow-[0_8px_0_var(--ink-muted)] enabled:active:translate-y-1.5 enabled:active:shadow-none xl:px-8"
      }`}
    >
      {!compacto && <IconeDado className="size-[1.2em] shrink-0" />}
      <span>{children}</span>
      {!compacto && !disabled && (
        <span className="hidden sm:contents">
          <Tecla>S</Tecla>
        </span>
      )}
    </button>
  );
}

function IconeDado({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01" strokeWidth="3" />
    </svg>
  );
}

function BotaoSecundario({
  children,
  onClick,
  disabled,
  ativo,
  atalho,
  grande,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  ativo?: boolean;
  atalho?: string;
  grande?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={ativo}
      className={`flex items-center gap-3 rounded-full border-2 border-ink font-semibold transition enabled:active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
        ativo
          ? "bg-ink text-on-tile"
          : "bg-surface text-ink enabled:hover:bg-app"
      } ${grande ? "min-h-14 px-6 text-xl xl:px-8" : "min-h-11 px-4 text-base"}`}
    >
      <span>{children}</span>
      {atalho && (
        <span className="hidden sm:contents">
          <Tecla>{atalho}</Tecla>
        </span>
      )}
    </button>
  );
}

function BotaoFechar({
  onClick,
  rotulo,
}: {
  onClick: () => void;
  rotulo: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={rotulo}
      className="flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-ink text-2xl leading-none hover:bg-app"
    >
      ×
    </button>
  );
}

function Tecla({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-md border-2 border-current px-1.5 py-0.5 text-sm leading-none font-semibold opacity-70">
      {children}
    </kbd>
  );
}
