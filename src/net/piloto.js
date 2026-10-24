// Piloto automático dos bots do multiplayer (docs/adr/0008). No solo, a pessoa clica para ver a jogada do rival;
// em rede ninguém deve clicar por um bot, então o dono da sala avança as etapas dele com esta função.
// Também termina a jogada de quem caiu no meio de uma etapa, porque o bot assume de onde a pessoa parou.

import { jogadorAtual, ehBot } from '../engine/state.js';
import { reduzir } from '../engine/machine.js';

// Fases em que a pessoa já escolheu parte da decisão (`INFORMAR_VALOR`, `ESCOLHER_JUSTIFICATIVA` e `ESCOLHER_CONFIANCA`):
// o bot refaz a decisão inteira a partir da métrica.
// Se o jogador da vez é um bot, devolve o estado depois de ele dar o próximo passo; senão (ou se nada avança), `null`.
// Cobre qualquer fase em que uma vaga pode ter virado bot, para a partida nunca travar.
export function avancarBot(estado) {
  if (!estado || estado.fase === 'FIM_DE_JOGO' || !ehBot(jogadorAtual(estado))) return null;
  const passo = (e, tipo) => {
    const novo = reduzir(e, { tipo });
    return novo === e ? null : novo;
  };
  switch (estado.fase) {
    case 'ROLAR_DADO':
      return passo(estado, 'ROLAR');
    case 'ESCOLHER_METRICA':
      return passo(estado, 'DECIDIR_BOT');
    case 'INFORMAR_VALOR':
    case 'ESCOLHER_JUSTIFICATIVA':
    case 'ESCOLHER_CONFIANCA': {
      const refeito = structuredClone(estado);
      refeito.fase = 'ESCOLHER_METRICA';
      return passo(refeito, 'DECIDIR_BOT');
    }
    case 'MOSTRAR_EVENTO': {
      const ev = estado.eventoAtual;
      if (ev?.decisao === 'trocando') return passo(estado, 'MANTER');
      if (ev?.decisao === 'escolhendo') {
        const recusado = structuredClone(estado);
        recusado.eventoAtual.decisao = null;
        return passo(recusado, 'RECUSAR');
      }
      return passo(estado, ev?.cartas && ev.decisao === null ? 'RECUSAR' : 'CONTINUAR');
    }
    case 'MOSTRAR_MERCADO': // seguir sem escolher vale como recusar
    case 'MOSTRAR_RESULTADO':
    case 'MOSTRAR_BALANCO':
      return passo(estado, 'CONTINUAR');
    default:
      return null;
  }
}

// Joga todos os passos seguidos de bots até a vez de uma pessoa (ou o fim). Sem pausas: serve a testes e à simulação.
// `limite` evita laço infinito se alguma fase deixar de avançar.
export function avancarBotsAteUmaPessoa(estado, limite = 500) {
  let atual = estado;
  for (let i = 0; i < limite; i++) {
    const proximo = avancarBot(atual);
    if (!proximo) return atual;
    atual = proximo;
  }
  throw new Error('Os bots não pararam de jogar: alguma fase não avança');
}
