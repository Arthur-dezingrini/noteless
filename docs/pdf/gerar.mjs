// Gera os PDFs da documentação técnica a partir dos .md.
//
//   node docs/pdf/gerar.mjs
//
// Precisa do Google Chrome (ou CHROME=<caminho do executável>) e de internet:
// a página baixa marked, mermaid e a fonte da CDN e o Chrome imprime em PDF.
// Saída: docs/pdf/Noteless-documentacao-tecnica.pdf (tudo, com capa e
// sumário) e docs/pdf/separados/ (um PDF por documento).
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(AQUI, "../..");
const saida = AQUI;
const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: raiz, encoding: "utf8" }).trim();
const TEMP = mkdtempSync(join(tmpdir(), "noteless-pdf-"));
mkdirSync(join(saida, "separados"), { recursive: true });

const DOCS = [
  { key: "indice", arquivo: "docs/README.md", titulo: "Índice e mapa das evidências", pdf: "00-indice-e-evidencias.pdf" },
  { key: "instalacao", arquivo: "README.md", titulo: "Instalação, configuração e execução", pdf: "01-instalacao-e-execucao.pdf", h1: "Instalação, configuração e execução" },
  { key: "arquitetura", arquivo: "docs/arquitetura.md", titulo: "Arquitetura do software", pdf: "02-arquitetura.pdf" },
  { key: "modelo-de-dados", arquivo: "docs/modelo-de-dados.md", titulo: "Modelo de dados", pdf: "03-modelo-de-dados.pdf" },
  { key: "seguranca", arquivo: "docs/seguranca.md", titulo: "Segurança", pdf: "04-seguranca.pdf" },
  { key: "lgpd", arquivo: "docs/lgpd.md", titulo: "LGPD", pdf: "05-lgpd.pdf" },
  { key: "ia", arquivo: "docs/ia.md", titulo: "Uso de inteligência artificial", pdf: "06-uso-de-ia.pdf" },
  { key: "infraestrutura", arquivo: "docs/infraestrutura.md", titulo: "Infraestrutura", pdf: "07-infraestrutura.pdf" },
].map((d) => ({ ...d, md: readFileSync(join(raiz, d.arquivo), "utf8") }));

const LOGO = readFileSync(join(raiz, "apps/web/src/app/icon.svg"), "utf8");
const DATA = new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });

const CSS = `
@page { size: A4; margin: 20mm 17mm 20mm 17mm;
  @top-left { content: "Noteless · Documentação técnica"; font: 500 8pt Figtree, sans-serif; color: #6b7280; }
  @top-right { content: "${DATA}"; font: 500 8pt Figtree, sans-serif; color: #6b7280; }
  @bottom-right { content: counter(page) " / " counter(pages); font: 500 8pt Figtree, sans-serif; color: #6b7280; } }
@page capa { margin: 0; @top-left { content: none } @top-right { content: none } @bottom-right { content: none } }
:root { --marca: #0e8a4b; --marca-tinta: #0a6e3b; --marca-suave: #e3efe6; --texto: #1f2937; --fraco: #6b7280; --linha: #e5e7eb; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Figtree, "Noto Sans", sans-serif; font-size: 9.6pt; line-height: 1.5; color: var(--texto); margin: 0; }
h1 { font-size: 21pt; line-height: 1.15; margin: 0 0 4mm; color: #111827; letter-spacing: -0.01em; }
h1::after { content: ""; display: block; width: 18mm; height: 1.2mm; background: var(--marca); border-radius: 1mm; margin-top: 3mm; }
h2 { font-size: 13.5pt; margin: 7mm 0 2.5mm; color: #111827; break-after: avoid; padding-bottom: 1mm; border-bottom: 0.3mm solid var(--linha); }
h3 { font-size: 11pt; margin: 5mm 0 2mm; color: #111827; break-after: avoid; }
h4 { font-size: 10pt; margin: 4mm 0 1.5mm; break-after: avoid; }
p, ul, ol { margin: 0 0 2.6mm; }
ul, ol { padding-left: 5.5mm; }
li { margin: 0.6mm 0; }
a { color: var(--marca-tinta); text-decoration: none; }
strong { color: #111827; }
blockquote { margin: 0 0 4mm; padding: 2.5mm 4mm; background: var(--marca-suave); border-left: 1.2mm solid var(--marca); border-radius: 1mm; color: #374151; }
blockquote p:last-child { margin: 0; }
code { font-family: "DejaVu Sans Mono", monospace; font-size: 8.2pt; background: #f3f4f6; padding: 0.1mm 0.6mm; border-radius: 0.8mm; overflow-wrap: anywhere; }
pre { background: #f6f8f7; border: 0.3mm solid var(--linha); border-radius: 1.5mm; padding: 3mm 3.5mm; white-space: pre-wrap; break-inside: avoid; margin: 0 0 3mm; }
pre code { background: none; padding: 0; font-size: 8pt; }
table { width: 100%; border-collapse: collapse; margin: 0 0 3.5mm; font-size: 8.4pt; line-height: 1.38; }
thead { display: table-header-group; }
th { text-align: left; background: var(--marca-suave); color: #064e2b; font-weight: 600; }
th, td { padding: 1.4mm 2mm; border-bottom: 0.3mm solid var(--linha); vertical-align: top; }
tr { break-inside: avoid; }
.diagrama { margin: 2mm 0 4mm; text-align: center; break-inside: avoid; }
.diagrama svg { max-width: 100% !important; height: auto; max-height: 225mm; }
p:has(+ pre), p:has(+ .diagrama), h3 + p:has(+ .diagrama) { break-after: avoid; }
@page paisagem { size: A4 landscape; }
.paisagem { page: paisagem; }
.paisagem .diagrama svg { max-height: 148mm; }
.capitulo { break-before: page; }
.capitulo:first-of-type { break-before: auto; }
/* capa */
.capa { page: capa; height: 297mm; display: flex; flex-direction: column; justify-content: space-between; padding: 26mm 22mm 20mm;
  background: linear-gradient(160deg, #f4faf6 0%, #e3efe6 55%, #cfe6d7 100%); break-after: page; }
.capa .marca { display: flex; align-items: center; gap: 4mm; font-size: 20pt; font-weight: 700; color: #0f172a; }
.capa .marca svg { width: 15mm; height: 15mm; }
.capa h1.titulo { font-size: 38pt; margin: 0 0 5mm; }
.capa h1.titulo::after { width: 26mm; height: 1.6mm; margin-top: 6mm; }
.capa .sub { font-size: 13pt; color: #374151; max-width: 140mm; }
.capa .meta { font-size: 9.5pt; color: #4b5563; line-height: 1.7; }
.sumario { break-after: page; }
.sumario ol { list-style: none; padding: 0; counter-reset: cap; }
.sumario > ol > li { counter-increment: cap; margin: 0 0 3.2mm; }
.sumario > ol > li > a { font-weight: 600; font-size: 11pt; color: #111827; }
.sumario > ol > li > a::before { content: counter(cap) ". "; color: var(--marca); }
.sumario ol ol { padding-left: 6mm; margin-top: 1mm; columns: 2; column-gap: 8mm; }
.sumario ol ol li { font-size: 8.8pt; margin: 0.4mm 0; break-inside: avoid; }
.sumario ol ol a { color: #374151; }
.semlink { color: inherit; }
`;

function pagina({ titulo, docs, consolidado }) {
  const dados = JSON.stringify({ docs: docs.map(({ key, arquivo, md, h1 }) => ({ key, arquivo, md, h1 })), todos: DOCS.map(({ key, arquivo }) => ({ key, arquivo })), consolidado }).replace(/</g, "\\u003c");
  const capa = consolidado
    ? `<section class="capa">
        <div class="marca">${LOGO}<span>Noteless</span></div>
        <div>
          <h1 class="titulo">Documentação técnica</h1>
          <p class="sub">Gestão de pecuária e atendimento veterinário com registro por voz: arquitetura, modelo de dados, segurança, LGPD, uso de IA e infraestrutura.</p>
        </div>
        <div class="meta">Versão de ${DATA}<br/>Código de referência: repositório VOCare, branch <code>main</code>, commit <code>${commit}</code><br/>Demonstração: https://vocare-iota.vercel.app</div>
      </section>
      <section class="sumario"><h1>Sumário</h1><ol id="sumario"></ol></section>`
    : "";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${titulo}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body>${capa}<main id="conteudo"></main>
<script src="https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mermaid@11.6.0/dist/mermaid.min.js"></script>
<script>
const D = ${dados};
const slug = (t) => t.trim().toLowerCase().replace(/[^\\p{L}\\p{N}\\- _]/gu, "").replace(/ /g, "-");
const caminho = (base, rel) => { const p = base.split("/").slice(0, -1); for (const s of rel.split("/")) { if (s === "..") p.pop(); else if (s && s !== ".") p.push(s); } return p.join("/"); };
(async () => {
  const main = document.getElementById("conteudo");
  for (const d of D.docs) {
    const sec = document.createElement("section");
    sec.className = "capitulo"; sec.id = d.key;
    sec.innerHTML = marked.parse(d.md, { gfm: true });
    if (d.h1) { const h = sec.querySelector("h1"); if (h) h.textContent = d.h1; }
    sec.querySelectorAll("h1,h2,h3,h4").forEach((h) => { h.id = (D.consolidado ? d.key + "--" : "") + slug(h.textContent); });
    sec.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href");
      if (/^https?:/.test(href)) return;
      const [arq, ancora] = href.split("#");
      const alvo = arq ? D.todos.find((t) => t.arquivo === caminho(d.arquivo, arq)) : d;
      const dentro = alvo && (D.consolidado || alvo.key === d.key);
      if (dentro) a.setAttribute("href", "#" + (ancora ? (D.consolidado ? alvo.key + "--" : "") + decodeURIComponent(ancora) : (D.consolidado ? alvo.key : "")));
      else { const s = document.createElement("span"); s.className = "semlink"; s.innerHTML = a.innerHTML; a.replaceWith(s); }
    });
    sec.querySelectorAll("pre > code.language-mermaid").forEach((c) => {
      const div = document.createElement("div");
      if (/^\\s*erDiagram/.test(c.textContent)) { div.className = "diagrama er"; div.dataset.src = c.textContent; }
      else { div.className = "diagrama mermaid"; div.textContent = c.textContent; }
      c.parentElement.replaceWith(div);
    });
    main.appendChild(sec);
  }
  const sum = document.getElementById("sumario");
  if (sum) for (const sec of main.querySelectorAll("section.capitulo")) {
    const h1 = sec.querySelector("h1"); const li = document.createElement("li");
    li.innerHTML = '<a href="#' + sec.id + '"></a><ol></ol>'; li.firstChild.textContent = h1.textContent;
    for (const h2 of sec.querySelectorAll("h2")) { const s = document.createElement("li"); s.innerHTML = '<a href="#' + h2.id + '"></a>'; s.firstChild.textContent = h2.textContent; li.lastChild.appendChild(s); }
    sum.appendChild(li);
  }
  await document.fonts.ready;
  const BASE = { startOnLoad: false, theme: "neutral", fontFamily: "Figtree, sans-serif", securityLevel: "strict" };
  mermaid.initialize(BASE);
  await mermaid.run({ querySelector: ".mermaid" });
  // Diagrama ER: letra maior e menos espaço entre as tabelas; desenha nas
  // duas direções e fica com o que sai maior na página. Página deitada só
  // quando ganha bem (> 15%).
  mermaid.initialize({ ...BASE, er: { nodeSpacing: 20, rankSpacing: 30 }, themeVariables: { fontSize: "28px" } });
  const mm = (x) => x * 96 / 25.4;
  let n = 0;
  for (const div of document.querySelectorAll(".diagrama.er")) {
    let em_pe = null, deitada = null;
    for (const dir of ["TB", "LR"]) {
      const { svg } = await mermaid.render("er" + n++, div.dataset.src.replace(/erDiagram\\n/, "erDiagram\\n    direction " + dir + "\\n"));
      const [, , w, h] = svg.match(/viewBox="([^"]+)"/)[1].trim().split(/[\\s,]+/).map(Number);
      const a = Math.min(mm(176) / w, mm(225) / h), b = Math.min(mm(263) / w, mm(148) / h);
      if (!em_pe || a > em_pe.escala) em_pe = { escala: a, svg };
      if (!deitada || b > deitada.escala) deitada = { escala: b, svg };
    }
    const usa = deitada.escala > em_pe.escala * 1.15 ? deitada : em_pe;
    div.innerHTML = usa.svg;
    if (usa === deitada) {
      const caixa = document.createElement("div"); caixa.className = "paisagem";
      const titulo = div.previousElementSibling;
      div.replaceWith(caixa);
      if (titulo && /^H[1-4]$/.test(titulo.tagName)) caixa.appendChild(titulo);
      caixa.appendChild(div);
    }
  }
  document.body.dataset.pronto = "1";
})();
</script></body></html>`;
}

function imprimir(html, pdf) {
  const arq = join(TEMP, html.nome);
  writeFileSync(arq, html.conteudo);
  execFileSync(process.env.CHROME ?? "google-chrome", [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", `--user-data-dir=${join(TEMP, "perfil")}`,
    "--no-pdf-header-footer", "--run-all-compositor-stages-before-draw", "--virtual-time-budget=40000",
    `--print-to-pdf=${pdf}`, `file://${arq}`,
  ], { stdio: "pipe" });
  console.log("ok", pdf.slice(raiz.length + 1));
}

imprimir({ nome: "consolidado.html", conteudo: pagina({ titulo: "Noteless — Documentação técnica", docs: DOCS, consolidado: true }) }, join(saida, "Noteless-documentacao-tecnica.pdf"));
for (const d of DOCS) imprimir({ nome: d.key + ".html", conteudo: pagina({ titulo: `Noteless — ${d.titulo}`, docs: [d], consolidado: false }) }, join(saida, "separados", d.pdf));
rmSync(TEMP, { recursive: true, force: true });
