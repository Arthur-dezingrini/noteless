import { type CampoCorrigivel, type Sexo } from "@vocare/shared";

export type AnimalRef = { id: string; nome: string; numero: string | null; sexo: Sexo | null };
export type GrupoRef = { id: string; nome: string; animais: number };

export type GalpaoRef = { id: string; nome: string };
export type LoteRef = { id: string; codigo: string; ativo: boolean };
export type ProdutoRef = { id: string; nome: string; unidade: string };
export type LocalRef = { id: string; nome: string };

/** Animais, grupos, galpões, lotes, produtos e locais do estoque da conta, para dar nome aos alvos. */
export type Cadastro = {
  animais: Map<string, AnimalRef>;
  grupos: Map<string, GrupoRef>;
  galpoes: Map<string, GalpaoRef>;
  lotes: Map<string, LoteRef>;
  produtos: Map<string, ProdutoRef>;
  locais: Map<string, LocalRef>;
};
export type Correcao = Partial<Record<CampoCorrigivel, unknown>>;
