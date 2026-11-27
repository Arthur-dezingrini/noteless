import type { ModuloMenu } from "@/lib/menu-tipos";

/** Insumos (ração, vacinas, medicamentos, material): saldo por local, livro de movimentos e compras. */
export const menu: ModuloMenu = {
  id: "estoque",
  rotulo: "Estoque",
  telas: [
    { id: "estoque.saldo", rotulo: "Saldo", href: "/estoque" },
    { id: "estoque.movimentos", rotulo: "Movimentos", href: "/estoque/movimentos" },
    { id: "estoque.entradas", rotulo: "Entradas", href: "/estoque/entradas" },
    { id: "estoque.inventario", rotulo: "Inventário", href: "/estoque/inventario" },
    { id: "estoque.produtos", rotulo: "Produtos", href: "/estoque/produtos" },
    { id: "estoque.locais", rotulo: "Locais", href: "/estoque/locais" },
    { id: "estoque.fornecedores", rotulo: "Fornecedores", href: "/estoque/fornecedores" },
  ],
};
