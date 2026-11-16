import { DIAS_AUDIO } from "@vocare/shared";

import { BRAND_NAME } from "@/lib/brand";

import { DocumentoLegal, Lista, Secao } from "./partes";

/** Política de Privacidade. Rascunho: um advogado revisa antes de entrar em vigor. */
export function Privacidade() {
  return (
    <DocumentoLegal titulo="Política de Privacidade">
      <p>
        Esta política explica quais dados o {BRAND_NAME} trata, para quê, com quem compartilha, por quanto tempo guarda e como você
        exerce os seus direitos, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).
      </p>

      <Secao titulo="Quem somos e quem decide sobre os dados">
        <p>
          O {BRAND_NAME} é um serviço de [RAZÃO SOCIAL], CNPJ [CNPJ], com sede em [ENDEREÇO] (&ldquo;nós&rdquo;).
        </p>
        <Lista>
          <li>Nos dados da sua conta (nome, e-mail e senha), somos o controlador.</li>
          <li>
            Nos dados que a empresa cliente registra no sistema (animais, lotes, produção, saúde animal e notas) e na voz de quem usa o
            gravador, a empresa cliente é a controladora. Nós tratamos esses dados em nome dela, como operador, seguindo as instruções
            dela.
          </li>
        </Lista>
      </Secao>

      <Secao titulo="Que dados tratamos">
        <Lista>
          <li>Conta: nome, e-mail, senha (guardada cifrada, nunca em texto), cargo e foto de perfil, se enviada.</li>
          <li>Empresa e vínculos: as empresas a que a pessoa está vinculada e o papel em cada uma.</li>
          <li>
            Voz e transcrição: o áudio das notas, o texto transcrito, o resumo e as sugestões da inteligência artificial, e quem conferiu
            cada nota.
          </li>
          <li>
            Registros da fazenda: animais, lotes, galpões, apontamentos de produção, pesagens, vacinas, tratamentos, consultas e
            prontuários.
          </li>
          <li>Gravador: número de série, estado (bateria, sinal, cartão), erros e horário do último contato.</li>
          <li>Registros de acesso: endereço IP, navegador, data e hora, e o aceite destes termos (versão, data e IP).</li>
        </Lista>
      </Secao>

      <Secao titulo="Para que usamos">
        <Lista>
          <li>Prestar o serviço contratado: transcrever, organizar e guardar os registros (execução de contrato).</li>
          <li>Manter o serviço seguro e funcionando, e avisar a nossa equipe quando algo falha (legítimo interesse).</li>
          <li>Guardar registros de acesso e responder a autoridades quando a lei exigir (obrigação legal).</li>
        </Lista>
        <p>Não vendemos dados, não usamos dados para publicidade e não montamos perfil de comportamento.</p>
      </Secao>

      <Secao titulo="Com quem compartilhamos">
        <p>Só com os fornecedores que fazem o serviço funcionar, cada um no seu papel:</p>
        <Lista>
          <li>Vercel: hospedagem do site e da api;</li>
          <li>Neon: banco de dados;</li>
          <li>OpenAI e Groq: transcrição do áudio;</li>
          <li>Anthropic: interpretação do texto pela inteligência artificial;</li>
          <li>Cloudflare: cópias de segurança, criptografadas;</li>
          <li>Resend: envio dos e-mails do sistema.</li>
        </Lista>
        <p>
          Esses fornecedores ficam fora do Brasil, principalmente nos Estados Unidos. A transferência internacional segue as garantias
          contratuais de proteção de dados de cada um. Também compartilhamos dados quando a lei ou uma autoridade exigir.
        </p>
      </Secao>

      <Secao titulo="Por quanto tempo guardamos">
        <Lista>
          <li>
            Áudio das notas: até {DIAS_AUDIO} dias depois de a nota ser confirmada ou descartada. Depois o áudio é apagado; a
            transcrição e os registros continuam.
          </li>
          <li>
            Cópias de segurança: as diárias ficam 30 dias, por isso um áudio já apagado ainda pode existir numa cópia por até 30 dias. As
            mensais ficam 12 meses e não levam áudio.
          </li>
          <li>Registros de acesso: pelo prazo que a lei exigir.</li>
          <li>
            Demais dados: enquanto a empresa cliente usar o serviço. Ao fim do contrato, os dados da empresa são devolvidos ou apagados
            como combinado com ela, guardando só o que a lei obriga.
          </li>
        </Lista>
      </Secao>

      <Secao titulo="Seus direitos">
        <p>
          Você pode pedir a confirmação de que tratamos seus dados, acesso, correção, anonimização, bloqueio ou eliminação do que for
          desnecessário, portabilidade, informação sobre com quem compartilhamos e a revogação do consentimento, quando for o caso.
          Também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
        </p>
        <p>
          Para pedir, escreva para [E-MAIL DE CONTATO]. Pedidos sobre dados da fazenda, inclusive a voz gravada no trabalho, são
          encaminhados à empresa responsável, que é quem decide sobre eles.
        </p>
      </Secao>

      <Secao titulo="Segurança">
        <p>
          A conexão é criptografada (HTTPS), a senha é guardada cifrada, cada empresa só vê os próprios dados e cada pessoa só faz o que o
          seu papel permite. As cópias de segurança são criptografadas e a restauração é conferida todo dia.
        </p>
      </Secao>

      <Secao titulo="Cookies">
        <p>
          Usamos só o cookie de sessão, necessário para você continuar conectado. Não usamos cookies de publicidade nem de rastreamento.
        </p>
      </Secao>

      <Secao titulo="Mudanças nesta política">
        <p>Quando este texto mudar, a versão muda e pedimos um novo aceite no próximo acesso.</p>
      </Secao>
    </DocumentoLegal>
  );
}
