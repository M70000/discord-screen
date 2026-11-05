# 📡 Pacote de Relay para OBS Studio (Discord Screen Share)

Este pacote permite que você transmita a tela do seu jogo ou computador pelo **OBS Studio** com **1080p @ 60 FPS**, usando a aceleração da sua placa de vídeo (NVENC / AMD / Intel) e com **zero custos**, sem travamentos e sem precisar abrir janelas pretas de terminal.

---

## ⚡ Instalação em 3 Passos (Feita apenas uma vez)

### 1. Baixar os Executáveis
Dê um duplo clique no arquivo:
```text
install-relay.bat
```
Ele baixará automaticamente o `mediamtx.exe` e o `cloudflared.exe` diretamente dos lançamentos oficiais do GitHub para esta mesma pasta.

---

### 2. Adicionar o Script no OBS Studio
1. Abra o **OBS Studio**.
2. No menu superior, clique em **Ferramentas** > **Scripts**.
3. Na aba *Scripts*, clique no botão **`+`** (canto inferior esquerdo).
4. Selecione o arquivo **`obs-stream-sync.lua`** que está nesta pasta.
5. Nas opções que aparecerem na tela, preencha:
   - **URL do Bot:** O endereço do bot (ex: `http://localhost:3000` ou a URL do Render).
   - **Seu ID do Discord:** O seu ID de usuário do Discord (ex: `123456789012345678`).
   - **Chave Secreta:** A chave configurada no `.env` do bot (`OBS_WEBHOOK_SECRET`).
   - **Chave do Stream:** Deixe como `live`.

---

### 3. Configurar a Saída de Transmissão no OBS
1. No OBS, vá em **Configurações** > **Transmissão**.
2. Em **Serviço**, selecione: `Personalizado...`
3. Preencha:
   - **Servidor:** `rtmp://localhost:1935/live`
   - **Chave de transmissão:** `live`
4. Clique em **Aplicar** e depois **OK**.

---

## 🎮 Como Usar

1. No OBS Studio, configure a sua captura de tela ou jogo normalmente.
2. Clique no botão **"Iniciar Transmissão"**.
3. **Pronto!** 
   - O OBS iniciará a conexão local instantaneamente.
   - O script ligará o túnel público da Cloudflare em segundo plano (invisível).
   - O Bot anunciará a sua live automaticamente no canal **#telamento** do Discord, com botões para seus amigos assistirem em tela cheia ou Janela Flutuante (PiP).
   - Seu apelido no Discord receberá o sufixo `| 🔴 LIVE` enquanto você estiver na chamada.
4. Ao terminar, basta clicar em **"Parar Transmissão"** no OBS. Os processos em segundo plano serão encerrados automaticamente e seu apelido será restaurado.
