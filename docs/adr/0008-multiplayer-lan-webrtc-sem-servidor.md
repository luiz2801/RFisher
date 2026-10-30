# 0008. Multiplayer em rede local via WebRTC sem servidor

- Status: Aceita

## Contexto

O Tabuleiro do CEO é hospedado estaticamente no GitHub Pages, sem backend, banco de dados ou servidor WebSocket. Para permitir que 2 ou 3 participantes joguem em seus próprios dispositivos (smartphones, tablets ou computadores) na mesma rede local (Wi-Fi), era necessário um protocolo de rede que não dependesse de infraestrutura externa ou servidores de matchmaking.

## Decisão

Adotar WebRTC com `RTCDataChannel` puro e serverless, utilizando troca manual de códigos compactados com minificação de SDP:

1. **Troca manual de sinalização (SDP):** O convidado gera um código de pedido (oferta SDP compactada com `deflate-raw` e codificada em base64url sob o prefixo `CEO1P.`). O anfitrião cola o pedido e gera um código de resposta (`CEO1R.`). Quando o convidado cola a resposta, o canal de dados abre diretamente entre os aparelhos, sem passar por servidor STUN/TURN ou intermediários na nuvem.
2. **Minificação de SDP:** A sinalização WebRTC padrão possui de 800 a 1.200 caracteres com cabeçalhos repetitivos. Um algoritmo de minificação (`enxugarSdp` e `hidratarSdp`) extrai apenas os 5 atributos dinâmicos essenciais (`ufrag`, `pwd`, `fingerprint`, `setup` e candidatos UDP `typ host`). Com compressão `deflate-raw` e base64url, o código cai de ~600 para apenas **~120–160 caracteres** (redução de ~75%), facilitando enormemente o compartilhamento e colagem manual via WhatsApp, Telegram ou e-mail. Códigos legados sem minificação continuam 100% compatíveis.
3. **Anfitrião autoritativo:** O estado da partida e a máquina de estados (`reduzir`) rodam exclusivamente no dispositivo do anfitrião. Os convidados enviam intenções de ação (`{ tipo: 'acao', acao }`) e recebem os estados completos sincronizados.
4. **Escala e vagas:** Partidas suportam de 2 a 3 jogadores humanos (1 por aparelho). Não há bots na criação da sala.
5. **Resiliência a quedas:** O anfitrião envia pings periódicos a cada 2 segundos. Se um convidado ficar 8 segundos sem sinal, os demais são avisados; se completar 60 segundos de silêncio, seu slot é permanentemente assumido por um bot com o mesmo perfil técnico, garantindo que a partida não trave. Se o anfitrião desconectar, a sala é encerrada para todos.
6. **Modo espectador:** Quando não é a vez do jogador, a interface fica em modo espectador (textos em terceira pessoa, botões inativos/desabilitados), mantendo recursos de conveniência locais (como calculadora e cópia de tabelas) utilizáveis.
7. **Revanche sem renegociação:** Ao término da partida, o anfitrião pode disparar uma revanche que retorna todos ao lobby da sala reaproveitando os mesmos canais WebRTC abertos, sem exigir nova troca de códigos.
8. **Transporte Híbrido com Fallback Automático:** A camada de transporte tenta estabelecer conexão P2P direta via WebRTC (`RTCDataChannel`) com auxílio de servidores STUN públicos (`stun.l.google.com:19302`) para desmascarar IPs protegidos por mDNS em navegadores mobile. Caso o tráfego UDP direto seja impedido por firewalls ou isolamento da rede, o sistema comuta silenciosamente em até 3,5 segundos para um canal de revezamento (via servidor de desenvolvimento `scripts/server.mjs` em rede local ou canal público em nuvem no GitHub Pages), garantindo conectividade sem interrupções.

## Consequências

- **Fácil:** Preserva a arquitetura 100% estática do jogo no GitHub Pages, com custo zero de infraestrutura e zero dependências externas.
- **Fácil:** Códigos muito menores (~120–160 caracteres), muito mais leves e fáceis de copiar e colar.
- **Fácil:** A autoridade centralizada no anfitrião elimina qualquer risco de divergência ou dessincronização de estado entre os jogadores.
- **Fácil:** O piloto automático de bots permite que partidas continuem mesmo se a bateria de um participante acabar ou se ele se ausentar.
- **Fácil:** O fallback de revezamento transparente contorna bloqueios de portas dinâmicas UDP em redes restritas sem exigir intervenção do jogador.
- **Difícil:** A entrada inicial na sala no modo manual exige que os jogadores copiem e colem dois blocos curtos de texto (pedido e resposta) através de um mensageiro ou e-mail.
- **Difícil:** Redes locais corporativas ou escolares com isolamento de clientes (AP Isolation / Guest Wi-Fi) bloqueiam conexões diretas P2P entre aparelhos; o transporte híbrido resolve isso usando o canal de revezamento.
- **Operação / Firewall em Linux (UFW):** Em sistemas Linux com UFW ativo, portas UDP dinâmicas de entrada costumam ser bloqueadas por padrão (`[UFW BLOCK]`). Embora o fallback via servidor local resolva isso automaticamente, o anfitrião que desejar permitir P2P direto na rede local pode liberar a sub-rede:
  ```bash
  sudo ufw allow from 192.168.0.0/16
  ```
- **Vigiar:** Modificações nas ações da máquina de estados devem garantir que apenas ações legítimas do jogador da vez sejam aceitas pelo anfitrião (`acaoPermitida`).
