// O áudio espera aqui entre a captura (gravador.ino, tarefaCaptura) e o loop,
// que o grava no cartão: ~1 s de folga para quando o cartão demora.
//
// Mora na IRAM que sobra do programa (~33 KB), que só aceita acesso de 32 bits
// e por isso não serve para mais ninguém. Na memória comum, estes 32 KB ficavam
// presos mesmo sem gravar, e faltava memória no envio: com a conexão segura
// aberta, o Wi-Fi não tinha onde guardar nem o que chegava, e a placa ficava
// surda (nem ping) até o envio desistir (2026-11-24).
#pragma once

#include <esp_heap_caps.h>
#include <esp_memory_utils.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>

// Um só escreve (a captura) e um só lê (o loop).
class BufferAudio {
 public:
  bool criar() {
    // O que sobra de IRAM diminui quando o firmware cresce: pede de 30 KB para baixo.
    for (size_t kb = 30; kb >= 16 && !mem; kb -= 2) {
      void *p = heap_caps_malloc(kb * 1024, MALLOC_CAP_32BIT | MALLOC_CAP_INTERNAL);
      if (p && esp_ptr_in_iram(p)) usar(p, kb);
      else heap_caps_free(p);
    }
    // Sem IRAM que chegue: 16 KB da memória comum (0,5 s).
    if (!mem) usar(heap_caps_malloc(16 * 1024, MALLOC_CAP_8BIT), 16);
    chegou = xSemaphoreCreateBinary();
    return mem && chegou;
  }

  bool naIram() const { return esp_ptr_in_iram((const void *)mem); }
  size_t capacidade() const { return cap; }  // em amostras

  // Só a captura chama. Nunca espera; devolve quantas amostras couberam.
  size_t por(const int16_t *a, size_t n) {
    uint32_t e = escrita;
    uint32_t livres = (__atomic_load_n(&leitura, __ATOMIC_ACQUIRE) + cap - e - 1) % cap;
    if (n > livres) n = livres;
    for (size_t i = 0; i < n; i++) {
      // Duas amostras por palavra, sempre lida e escrita inteira.
      uint32_t p = mem[e >> 1];
      uint32_t v = (uint16_t)a[i];
      mem[e >> 1] = (e & 1) ? (p & 0x0000FFFFu) | (v << 16) : (p & 0xFFFF0000u) | v;
      if (++e == cap) e = 0;
    }
    __atomic_store_n(&escrita, e, __ATOMIC_RELEASE);
    xSemaphoreGive(chegou);
    return n;
  }

  // Só o loop chama. Espera juntar 32 ms de áudio (ou o prazo) e devolve quantas
  // amostras leu: o loop acorda a cada 32 ms para ver o botão.
  size_t tirar(int16_t *a, size_t maximo, uint32_t prazoMs) {
    uint32_t inicio = millis();
    while (esperando() < 512) {
      uint32_t foi = millis() - inicio;
      if (foi >= prazoMs) break;
      xSemaphoreTake(chegou, pdMS_TO_TICKS(prazoMs - foi));
    }
    size_t n = esperando();
    if (n > maximo) n = maximo;
    uint32_t l = leitura;
    for (size_t i = 0; i < n; i++) {
      uint32_t p = mem[l >> 1];
      a[i] = (int16_t)(uint16_t)((l & 1) ? p >> 16 : p);
      if (++l == cap) l = 0;
    }
    __atomic_store_n(&leitura, l, __ATOMIC_RELEASE);
    return n;
  }

  // Só o loop chama: joga fora o que estiver esperando.
  void zerar() { __atomic_store_n(&leitura, __atomic_load_n(&escrita, __ATOMIC_ACQUIRE), __ATOMIC_RELEASE); }

 private:
  // volatile: sem ele o compilador troca os laços por memcpy, que lê bytes soltos.
  volatile uint32_t *mem = nullptr;
  uint32_t cap = 0;  // em amostras
  uint32_t escrita = 0, leitura = 0;
  SemaphoreHandle_t chegou = nullptr;

  void usar(void *p, size_t kb) {
    mem = (volatile uint32_t *)p;
    cap = p ? kb * 1024 / sizeof(int16_t) : 0;
  }
  size_t esperando() const { return (__atomic_load_n(&escrita, __ATOMIC_ACQUIRE) + cap - leitura) % cap; }
};
