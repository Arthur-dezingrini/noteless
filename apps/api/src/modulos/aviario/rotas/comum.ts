import type { Papel } from "@vocare/shared";

import { noDia } from "../../../base/datas";

export const PODE_SALVAR: Papel[] = ["owner", "admin"];
export const SEM_ACESSO = "Sem acesso a esta organização.";

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
/** "AAAA-MM-DD" que existe no calendário (31/02 não passa). */
export const dataReal = (d: string) => DATA_ISO.test(d) && noDia(d, 0) === d;
