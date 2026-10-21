// mulberry32. O estado é um inteiro de 32 bits, então cabe no estado do jogo
// e a partida inteira é reproduzível a partir da seed.

export function proximo(estado) {
  const s = (estado + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s];
}

export function criarRng(seed) {
  let estado = seed >>> 0;
  const rng = {
    get estado() {
      return estado;
    },
    prox() {
      const [v, s] = proximo(estado);
      estado = s;
      return v;
    },
    entre(min, max) {
      return min + rng.prox() * (max - min);
    },
    inteiro(min, max) {
      return min + Math.floor(rng.prox() * (max - min + 1));
    },
    normal(media = 0, dp = 1) {
      const u = 1 - rng.prox();
      const v = rng.prox();
      return media + dp * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    embaralhar(lista) {
      const a = [...lista];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng.prox() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
  };
  return rng;
}
