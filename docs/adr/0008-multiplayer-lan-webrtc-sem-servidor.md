# 0008. Multiplayer em rede local via WebRTC sem servidor

- Status: Aceita

## Contexto

O Tabuleiro do CEO é hospedado estaticamente no GitHub Pages, sem backend, banco de dados ou servidor WebSocket. Para permitir que 2 ou 3 participantes joguem em seus próprios dispositivos (smartphones, tablets ou computadores) na mesma rede local (Wi-Fi), era necessário um protocolo de rede que não dependesse de infraestrutura externa ou servidores de matchmaking.

## Decisão

Adotar WebRTC com `RTCDataChannel` puro e serverless, utilizando troca de convites via QR Code, link com hash na URL ou inserção manual de códigos compactados:

1. **Troca de sinalização (SDP) via QR Code e Links:**
   - O anfitrião gera um código de convite / oferta SDP (`CEO1P...`).
   - O jogo renderiza um **QR Code SVG puro** (gerado localmente em JavaScript sem bibliotecas externas, ISO/IEC 18004) e um link direto com `#hash` (`https://.../#CEO1P...`).
   - O convidado pode entrar escaneando o QR Code com a câmera do celular (que abre o link direto com o convite preenchido), usando o leitor de câmera integrado via `BarcodeDetector` / `getUserMedia`, ou colando o código/link manualmente. No mesmo navegador (ex: múltiplas abas de teste), a sincronização pode ocorrer automaticamente via `BroadcastChannel`.
   - Ao confirmar seu nome, o convidado gera a resposta SDP (`CEO1R...`), também disponível via QR Code e link. O anfitrião escaneia ou cola a confirmação para fechar o canal P2P.
2. **Minificação de SDP:** A sinalização WebRTC padrão possui de 800 a 1.200 caracteres com cabeçalhos repetitivos. Um algoritmo de minificação (`enxugarSdp` e `hidratarSdp`) extrai apenas os 5 atributos dinâmicos essenciais (`ufrag`, `pwd`, `fingerprint`, `setup` e candidatos UDP `typ host`). Com compressão `deflate-raw` e base64url, o payload cai para ~120–160 caracteres (redução de ~75%), gerando QR Codes de baixa densidade (versões 6 a 8, 41x41 a 49x49 módulos), de leitura instantânea até em câmeras de baixa resolução. Códigos legados sem minificação continuam 100% compatíveis.
3. **Anfitrião autoritativo:** O estado da partida e a máquina de estados (`reduzir`) rodam exclusivamente no dispositivo do anfitrião. Os convidados enviam intenções de ação (`{ tipo: 'acao', acao }`) e recebem os estados completos sincronizados.
4. **Escala e vagas:** Partidas suportam de 2 a 3 jogadores humanos (1 por aparelho). Não há bots na criação da sala.
5. **Resiliência a quedas:** O anfitrião envia pings periódicos a cada 2 segundos. Se um convidado ficar 8 segundos sem sinal, os demais são avisados; se completar 60 segundos de silêncio, seu slot é permanentemente assumido por um bot com o mesmo perfil técnico, garantindo que a partida não trave. Se o anfitrião desconectar, a sala é encerrada para todos.
6. **Modo espectador:** Quando não é a vez do jogador, a interface fica em modo espectador (textos em terceira pessoa, botões inativos/desabilitados), mantendo recursos de conveniência locais (como calculadora e cópia de tabelas) utilizáveis.
7. **Revanche sem renegociação:** Ao término da partida, o anfitrião pode disparar uma revanche que retorna todos ao lobby da sala reaproveitando os mesmos canais WebRTC abertos, sem exigir nova troca de códigos.

## Consequências

- **Fácil:** Preserva a arquitetura 100% estática do jogo no GitHub Pages, com custo zero de infraestrutura e zero dependências externas (sem pacotes npm adicionais).
- **Fácil:** Entrada rápida e moderna por QR Code ou link `#hash`, reduzindo drasticamente o atrito da troca de códigos.
- **Fácil:** A autoridade centralizada no anfitrião elimina qualquer risco de divergência ou dessincronização de estado entre os jogadores.
- **Fácil:** O piloto automático de bots permite que partidas continuem mesmo se a bateria de um participante acabar ou se ele se ausentar.
- **Difícil:** A confirmação de volta (resposta do convidado ao anfitrião) ainda exige um segundo escaneamento de QR Code ou envio de link/código de volta ao anfitrião quando jogado entre aparelhos diferentes.
- **Difícil:** Redes locais corporativas ou escolares com isolamento de clientes (AP Isolation / Guest Wi-Fi) bloqueiam conexões diretas P2P entre aparelhos; o jogo mitiga isso apresentando uma mensagem de diagnóstico após 15 segundos de espera na negociação.
- **Vigiar:** Modificações nas ações da máquina de estados devem garantir que apenas ações legítimas do jogador da vez sejam aceitas pelo anfitrião (`acaoPermitida`).
