# Bingo a Dois ❤️

Aplicação web de bingo privado para duas pessoas, com sorteio validado no servidor, chat em tempo real e videochamada WebRTC.

## Requisitos
- Node.js 18 ou superior
- npm (incluído com Node.js)
- Navegador moderno. Câmara/microfone requerem `localhost` ou HTTPS.

## Instalação e arranque local
1. Descompacta o ZIP.
2. Abre a pasta `bingo-a-dois` no terminal.
3. Instala dependências:
   ```bash
   npm install
   ```
4. Copia `.env.example` para `.env` e altera `HOST_PASSWORD` para uma palavra-passe tua. No Windows podes copiar o ficheiro pelo Explorador ou executar `copy .env.example .env` no CMD.
5. Arranca:
   ```bash
   npm start
   ```
6. Abre http://localhost:3000. Usa a palavra-passe para criar uma sala.
7. Para testar com duas pessoas, abre o convite numa janela anónima ou noutro dispositivo. Para testar em dois dispositivos na rede local, usa o endereço IP do computador anfitrião; a câmara/microfone só funcionam em HTTPS ou localhost, pelo que para esse teste é preferível publicar a aplicação.

## Publicar no GitHub pelo navegador
1. Vai a https://github.com/new e cria um repositório chamado `bingo-a-dois`.
2. Deixa-o como **Public** ou **Private**, conforme preferires, e cria-o sem README adicional.
3. Descompacta o ZIP no computador. Entra no repositório no GitHub e escolhe **Add file → Upload files**.
4. Abre a pasta descompactada e arrasta **o conteúdo** da pasta `bingo-a-dois` para a página do GitHub (incluindo `server.js`, `package.json`, `public/`, `.env.example` e `README.md`). Não carregues `node_modules` nem o ficheiro `.env` real.
5. Em baixo, escreve uma mensagem como `Adicionar aplicação Bingo a Dois` e clica **Commit changes**.

## Publicar no Render
1. Abre https://render.com e inicia sessão.
2. Clica **New + → Web Service** e liga a tua conta GitHub, se for pedido.
3. Seleciona o repositório `bingo-a-dois`.
4. Configura:
   - **Runtime / Language:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance type:** Free (se estiver disponível na tua conta)
5. Em **Environment Variables**, adiciona:
   - `HOST_PASSWORD` = uma palavra-passe forte, diferente da palavra-passe do GitHub
   - `PUBLIC_URL` = URL público que o Render atribuir, por exemplo `https://bingo-a-dois.onrender.com`
6. Clica **Create Web Service** e espera até o estado ficar **Live**. Abre a URL do serviço e testa criar uma sala.
7. Quando alterares ficheiros e fizeres commit no GitHub, o Render normalmente volta a publicar automaticamente.

## Testar com duas pessoas
1. Abre a URL publicada num navegador e cria uma sala com a palavra-passe de anfitrião.
2. Clica **Copiar convite** e envia o link para a segunda pessoa.
3. A segunda pessoa abre o link, escreve o nome e entra. Também pode introduzir o código no ecrã inicial.
4. O anfitrião tira bolas ou ativa o modo automático; ambos marcam os números e podem conversar no chat.
5. Clica **Iniciar chamada** para pedir acesso à câmara e ao microfone. O outro jogador deve também permitir o acesso quando o navegador pedir.

## Videochamada, STUN e TURN
A aplicação usa WebRTC e sinalização pelo Socket.IO. Inclui STUN público para ajudar os dispositivos a descobrir caminhos de rede. STUN não garante ligação em todas as redes: para redes empresariais, CGNAT ou firewalls restritivas, configura um serviço TURN fiável. No Render, adiciona `TURN_URL`, `TURN_USERNAME` e `TURN_CREDENTIAL` como variáveis de ambiente. Nunca coloques credenciais TURN ou a palavra-passe do anfitrião no frontend nem no GitHub.

## Segurança e limitações desta versão
- A palavra-passe do anfitrião é verificada no servidor; define `HOST_PASSWORD` antes de publicar.
- A lógica de sorteio e validação de bingo corre no servidor. As salas são mantidas em memória e expiram após inatividade/limite de vida; reiniciar o serviço apaga salas.
- O convite dá acesso à sala; partilha-o apenas com a pessoa pretendida.
- A versão inicial guarda o estado em memória, sem base de dados. O modo de 75 bolas tem cartela 5×5 com centro livre; no modo de 90 bolas, cada jogador recebe uma seleção de 15 números. A validação do modo de 90 é simplificada.
- Para produção, recomenda-se adicionar limitação de tentativas, sessões de anfitrião mais fortes, testes automatizados e um serviço TURN configurado.
