"""Recebe pela USB a gravação do microfone.ino e salva como .wav.

    python3 -m venv .venv && .venv/bin/pip install pyserial
    .venv/bin/python firmware/microfone/receber.py [/dev/ttyUSB0] [saida.wav]

Espera até 5 minutos pela gravação (segure o botão, fale, solte). Salva o
áudio como veio e uma versão sem graves e com volume normalizado (_tratado).
"""
import struct
import sys
import time
import wave

import serial

porta = sys.argv[1] if len(sys.argv) > 1 else "/dev/ttyUSB0"
saida = sys.argv[2] if len(sys.argv) > 2 else "microfone.wav"
s = serial.Serial(porta, 115200, timeout=0.5)

taxa, n, inicio = 16000, None, time.time()
while n is None and time.time() - inicio < 300:
    linha = s.readline().decode(errors="replace").strip()
    if linha.startswith(("PRONTO", "AVISO", "ERRO", "INFO")):
        print(linha)
    if linha.startswith("INFO"):
        taxa = int(linha.split("taxa=")[1].split()[0])
    if linha.startswith("AUDIO "):
        n = int(linha.split()[1])
if n is None:
    sys.exit("Nenhuma gravação recebida.")

dados = b""
while len(dados) < 2 * n and time.time() - inicio < 360:
    dados += s.read(2 * n - len(dados))
x = list(struct.unpack(f"<{len(dados) // 2}h", dados))


def salvar(nome, amostras):
    with wave.open(nome, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(taxa)
        w.writeframes(struct.pack(f"<{len(amostras)}h", *amostras))


salvar(saida, x)
# Passa-alta de ~100 Hz (tira o nível contínuo e o ronco) e normaliza.
k, y, ant, tratado = 1 / (1 + 2 * 3.1416 * 100 / taxa), 0.0, float(x[0]), []
for v in x:
    y = k * (y + v - ant)
    ant = v
    tratado.append(y)
pico = max(abs(v) for v in tratado) or 1
salvar(saida.replace(".wav", "_tratado.wav"), [int(v * 30000 / pico) for v in tratado])
print(f"{len(x) / taxa:.1f} s salvos em {saida} (e _tratado)")
