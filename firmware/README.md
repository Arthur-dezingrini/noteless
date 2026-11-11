# Firmware — gravador de campo

Código do ESP32 que grava notas e manda para a api. Fora dos workspaces
npm; compila com `arduino-cli` (core `esp32:esp32`).

Placa usada: ESP32 DevKit 38 pinos, chip ESP32-D0WD-V3, USB CP2102, flash 4 MB.
**Grave sempre em 115200 baud** — esta placa tem cristal de 26 MHz e falha na
velocidade padrão (921600).

```bash
arduino-cli compile --fqbn esp32:esp32:esp32 firmware/teste
arduino-cli upload  --fqbn esp32:esp32:esp32:UploadSpeed=115200 -p /dev/ttyUSB0 firmware/teste
arduino-cli monitor -p /dev/ttyUSB0 -c baudrate=115200
```

No Linux, a porta precisa de permissão: `sudo usermod -aG dialout $USER` (e
sair/entrar da sessão).

- `teste/` — pisca o LED (GPIO2), mostra o chip e varre redes Wi-Fi. Se roda,
  placa, USB e rádio estão bons.
- `wifi/` — conecta no Wi-Fi de `segredos.h` e mostra o IP. A ESP32 só tem
  2,4 GHz: rede só em 5 GHz não aparece.
- `gravador/` — segure o botão (D18) para gravar no microfone I2S (INMP441,
  mesmas ligações do `microfone/`) e solte para parar (até 5 min). Clique
  (menos de 0,5 s) não grava.
  A gravação vai para o cartão microSD (mesmas ligações do `cartao/`) e entra
  na fila em `/fila`; com Wi-Fi, sobe sozinha para o Noteless como nota,
  da mais antiga para a mais nova, pela conta de `segredos.h` (copie de
  `segredos.example.h`, fica fora do git). Sem Wi-Fi, espera no cartão; o
  arquivo só é apagado depois que o Noteless confirma, e o que ele recusa vai
  para `/erro`. O relógio é acertado pela internet e a hora da gravação vai
  junto (`gravadoEm`); gravação feita antes do primeiro acerto só leva a hora
  se a placa não reiniciou até enviar — senão vale a hora da chegada.
  O Wi-Fi é escolhido pelo usuário, não fica no código: sem rede salva (ou com
  5 cliques seguidos no botão, o que reinicia a placa) ela abre a rede aberta
  "Noteless-XXXX"; no celular, conecte nela e escolha a rede na página que
  abrir (só 2,4 GHz; se ela não abrir sozinha, desligue os dados móveis e entre
  em http://192.168.4.1). Se não conectar, a página diz o motivo.
  `SERVIDOR_URL` é o Noteless publicado (https) ou, para testar com a api local
  (`npm run dev:hom`), o IP do notebook na mesma rede.
  LED: aceso fixo = tudo certo (Wi-Fi, login e cartão); apagado = algum
  problema — sem Wi-Fi, sem login ou cartão (ela tenta de novo sozinha; o
  monitor serial diz qual); respirando = botão apertado, gravando; piscando
  rápido = modo configuração do Wi-Fi.
- `microfone/` — teste do microfone I2S (INMP441: VDD 3V3, GND e L/R no GND,
  SCK D23, WS D22, SD D21): segura o botão, fala, solta; o áudio vem pela USB e
  `receber.py` salva como .wav. Diz em qual canal o microfone fala e avisa se
  ele estiver mudo (ligação errada ou sem solda).
- `cartao/` — teste do módulo microSD de 3,3 V (VCC na trilha +, GND na
  trilha −, CS D5, SCK TX2, MOSI RX2, MISO D4): monta o cartão, grava e lê
  256 KB e mede a velocidade. LED aceso = tudo certo; piscando rápido = erro,
  com o motivo no monitor serial. Se o cartão não responde, a placa fica
  tentando sem parar e o LED acende a cada resposta: aperte fio por fio, as
  soldas e o cartão olhando o LED para achar o mau contato; com 2 s
  respondendo firme, o teste continua. O cartão precisa estar em FAT32.
