import { z } from "zod";

/**
 * "Mudou alguma coisa?" — a tela pergunta de tempos em tempos e, se a versão
 * for outra, busca os dados de novo. Opaca: só serve para comparar com a
 * anterior. Muda com ocorrência nova, salva, descartada, restaurada,
 * encaminhada ou reescrita, e com aviso novo ou lido do usuário.
 */
export const novidadesSchema = z.object({ versao: z.string() });
export type Novidades = z.infer<typeof novidadesSchema>;
