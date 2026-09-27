# Firmware — gravador de campo

Código do ESP32 que grava ocorrências e manda para a api. Fora dos workspaces
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
