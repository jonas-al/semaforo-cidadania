import { APAGADO, buscarCor, type Cor } from "./lib/cores";

// Ordem de um semáforo real, de cima para baixo.
const LUZES: Cor[] = ["vermelho", "amarelo", "verde"];

// `cor` só deve ser informada depois de revelar: com `null`, nada no DOM
// (estilo, classe ou rótulo) diferencia uma afirmação da outra.
export function Semaforo({
  cor,
  className = "",
}: {
  cor: Cor | null;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={
        cor ? `Semáforo com a luz ${buscarCor(cor).rotulo} acesa` : "Semáforo apagado"
      }
      className={`flex shrink-0 flex-col gap-[calc(var(--luz)*0.16)] rounded-[calc(var(--luz)*0.42)] bg-ink p-[calc(var(--luz)*0.2)] [--luz:clamp(48px,min(16dvh,14vw),136px)] ${className}`}
    >
      {LUZES.map((nome) => {
        const hex = buscarCor(nome).hex;
        const acesa = nome === cor;
        return (
          <span
            key={nome}
            className="block size-(--luz) rounded-full transition-[background-color,box-shadow] duration-300"
            style={{
              backgroundColor: acesa ? hex : APAGADO,
              boxShadow: acesa
                ? `0 0 calc(var(--luz) * 0.5) calc(var(--luz) * 0.08) ${hex}`
                : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

// Bolinha colorida; com `null`, fica apagada (cor ainda não revelada).
export function Bolinha({
  cor,
  className = "",
}: {
  cor: Cor | null;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full border-2 border-ink ${className}`}
      style={{ backgroundColor: cor ? buscarCor(cor).hex : APAGADO }}
    />
  );
}
