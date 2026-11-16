import { BRAND_NAME } from "@/lib/brand";

import { DocumentoLegal, Lista, Secao } from "./partes";

/** Termos de Uso. Rascunho: um advogado revisa antes de entrar em vigor. */
export function Termos() {
  return (
    <DocumentoLegal titulo="Termos de Uso">
      <p>
        Estes termos valem entre [RAZÃO SOCIAL], CNPJ [CNPJ] (&ldquo;nós&rdquo;), e quem usa o {BRAND_NAME}: a empresa cliente e as
        pessoas que ela cadastra. Ao usar o sistema, você concorda com eles e com a Política de Privacidade.
      </p>

      <Secao titulo="O serviço">
        <p>
          O {BRAND_NAME} registra por voz o que acontece na fazenda. O áudio é transcrito, a inteligência artificial sugere o que
          registrar e uma pessoa confere e aprova antes de virar registro.
        </p>
      </Secao>

      <Secao titulo="Contas e papéis">
        <Lista>
          <li>Cada pessoa tem a sua conta, pessoal e intransferível, e cuida da própria senha.</li>
          <li>A empresa define quem é dono, administrador ou membro, e cada papel vê e faz só o que lhe cabe.</li>
          <li>
            A administração da plataforma, feita por nós, acessa as empresas para dar suporte, vincular pessoas e aprovar gravadores.
          </li>
        </Lista>
      </Secao>

      <Secao titulo="Notas e inteligência artificial">
        <p>
          A inteligência artificial pode ouvir ou interpretar errado. Por isso toda sugestão passa por uma pessoa antes de virar registro.
          O registro aprovado é responsabilidade da empresa.
        </p>
      </Secao>

      <Secao titulo="Gravador e a voz da equipe">
        <p>A empresa decide usar o gravador com a sua equipe. Cabe a ela:</p>
        <Lista>
          <li>
            informar a quem usa o gravador que a voz é gravada, para quê e por quanto tempo fica guardada (o aviso em /aviso-gravador
            serve para isso);
          </li>
          <li>ter base legal para esse tratamento;</li>
          <li>usar as gravações só para registrar o trabalho.</li>
        </Lista>
      </Secao>

      <Secao titulo="Uso aceitável">
        <p>
          Não use o {BRAND_NAME} para nada ilegal, não grave pessoas sem que elas saibam, não tente acessar dados de outras empresas e não
          tente sobrecarregar nem invadir o serviço.
        </p>
      </Secao>

      <Secao titulo="Dados da empresa">
        <p>
          Os dados registrados são da empresa. A pedido dela, entregamos uma cópia. Ao fim do contrato, os dados são devolvidos ou
          apagados como combinado, guardando só o que a lei obriga.
        </p>
      </Secao>

      <Secao titulo="Disponibilidade e cópias de segurança">
        <p>
          Trabalhamos para manter o serviço no ar e fazemos uma cópia de segurança do banco todo dia, mas não garantimos funcionamento sem
          nenhuma interrupção. Quando houver parada programada, avisamos antes sempre que possível.
        </p>
      </Secao>

      <Secao titulo="Limitação de responsabilidade">
        <p>
          Não respondemos por decisões tomadas com base em registro que não foi conferido, nem por falhas de internet, de energia ou de
          equipamento fora do nosso controle, nos limites da lei.
        </p>
      </Secao>

      <Secao titulo="Mudanças nos termos">
        <p>Quando estes termos mudarem, a versão muda e pedimos um novo aceite no próximo acesso.</p>
      </Secao>

      <Secao titulo="Foro">
        <p>Fica eleito o foro de [CIDADE/UF] para resolver qualquer questão sobre estes termos.</p>
      </Secao>
    </DocumentoLegal>
  );
}
