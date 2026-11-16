import { DIAS_AUDIO } from "@vocare/shared";

import { BRAND_NAME } from "@/lib/brand";

import { Lista, Secao, versaoPorExtenso } from "./partes";

/**
 * Folha para a fazenda entregar ou afixar para quem usa o gravador: o que é
 * gravado, para quê, quem ouve, por quanto tempo e a quem pedir. Cabe numa A4.
 */
export function AvisoGravador() {
  return (
    <article className="flex flex-col gap-5 text-base leading-relaxed text-ink-soft print:gap-3 print:text-[13px]">
      <header className="flex flex-col gap-1">
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-ink print:text-2xl">
          Aviso: este gravador grava a sua voz
        </h1>
        <p className="text-ink-muted">[NOME DA EMPRESA] usa o {BRAND_NAME} para registrar o trabalho do dia.</p>
      </header>

      <Secao titulo="O que é gravado">
        <p>Quando você grava uma nota, o gravador guarda o que você falou e manda pela internet para o {BRAND_NAME}.</p>
      </Secao>

      <Secao titulo="Para quê">
        <p>
          Para registrar o trabalho sem precisar escrever: mortalidade, ovos, ração, pesagens, vacinas e outras ocorrências do dia.
        </p>
      </Secao>

      <Secao titulo="Quem ouve e quem vê">
        <Lista>
          <li>A equipe da [NOME DA EMPRESA] que confere as notas.</li>
          <li>Os serviços que transformam o áudio em texto.</li>
        </Lista>
      </Secao>

      <Secao titulo="Por quanto tempo fica guardado">
        <p>
          O áudio é apagado {DIAS_AUDIO} dias depois de a nota ser conferida (ainda pode ficar até 30 dias numa cópia de segurança). O
          texto e os registros ficam.
        </p>
      </Secao>

      <Secao titulo="O que não é feito">
        <p>A gravação não é usada para outra coisa e não é vendida.</p>
      </Secao>

      <Secao titulo="Seus direitos">
        <p>
          Você pode pedir para ver, corrigir ou apagar os seus dados. Fale com a [NOME DA EMPRESA] ou escreva para [E-MAIL DE CONTATO].
        </p>
      </Secao>

      <p className="text-sm text-ink-muted">Versão de {versaoPorExtenso}</p>
    </article>
  );
}
