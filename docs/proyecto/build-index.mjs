// Genera docs/proyecto/index.html a partir de los .md de esta carpeta.
// Uso (desde la raíz del proyecto):  node docs/proyecto/build-index.mjs
// Los .md son la fuente de verdad; index.html los incrusta y los renderiza
// en el navegador con marked + mermaid (CDN), así que se abre con doble clic.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));

const files = ["README.md", ...readdirSync(DIR).filter((f) => /^\d\d-.*\.md$/.test(f)).sort()];

const docs = files.map((file) => {
  const md = readFileSync(join(DIR, file), "utf-8");
  const title = (md.match(/^#\s+(.+)$/m)?.[1] ?? file).trim();
  const num = file === "README.md" ? "00" : file.slice(0, 2);
  return { file, num, title, md };
});

// Evita que "</script>" dentro de un .md cierre el bloque JSON incrustado
const payload = JSON.stringify(docs).replace(/<\//g, "<\\/");

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DevAssistant · Documentación</title>
<meta name="description" content="Documentación completa de DevAssistant: negocio, arquitectura, flujos, datos, tools, catálogo de archivos, casos de uso, guía, reutilizables, seguridad y problemas conocidos.">
<style>
:root{
  --bg:#f7f8fb; --surface:#ffffff; --surface-2:#f0f2f7; --border:#e1e5ee;
  --text:#1b2030; --muted:#5d6577; --accent:#4f46e5; --accent-soft:#eceafe;
  --ok:#1f9d55; --warn:#d1495b; --code-bg:#f3f4f8;
  --shadow:0 1px 2px rgba(20,25,40,.05),0 4px 16px rgba(20,25,40,.06);
  --nav-w:270px;
  --font:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  --mono:ui-monospace,"Cascadia Code","SFMono-Regular",Consolas,monospace;
}
:root[data-theme="dark"]{
  --bg:#0f1218; --surface:#171b24; --surface-2:#1e2330; --border:#2a3040;
  --text:#e6e9f0; --muted:#9aa3b5; --accent:#8b85ff; --accent-soft:#25234a;
  --ok:#4ade80; --warn:#ff7a8a; --code-bg:#11141b;
  --shadow:0 1px 2px rgba(0,0,0,.3),0 4px 16px rgba(0,0,0,.25);
}
*{box-sizing:border-box}
html{scroll-padding-top:20px}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.65 var(--font)}
a{color:var(--accent)}
.layout{display:grid;grid-template-columns:var(--nav-w) minmax(0,1fr);min-height:100vh}
nav.side{position:sticky;top:0;height:100vh;overflow:auto;border-right:1px solid var(--border);background:var(--surface);padding:18px 12px}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:1.05rem;margin:0 6px 14px}
.brand .logo{width:34px;height:34px;border-radius:10px;background:var(--accent);color:#fff;display:grid;place-items:center;font-size:18px}
.search{width:100%;padding:8px 12px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--text);font:inherit;font-size:.9rem;margin-bottom:10px}
nav.side a{display:flex;gap:10px;align-items:baseline;padding:7px 10px;border-radius:9px;color:var(--muted);text-decoration:none;font-size:.9rem}
nav.side a:hover{background:var(--surface-2);color:var(--text)}
nav.side a.active{background:var(--accent-soft);color:var(--accent);font-weight:600}
nav.side .num{font-family:var(--mono);font-size:.75rem;opacity:.7;width:20px;flex:none}
nav.side .hits{margin-left:auto;font-size:.72rem;background:var(--accent-soft);color:var(--accent);border-radius:999px;padding:0 7px}
.side-foot{margin-top:14px;padding:10px;border-top:1px solid var(--border);font-size:.78rem;color:var(--muted)}
.side-foot button{width:100%;margin-bottom:8px;border:1px solid var(--border);background:var(--surface-2);color:var(--text);border-radius:9px;padding:6px;cursor:pointer;font:inherit}
main{padding:28px clamp(16px,4vw,56px) 80px;max-width:1100px;width:100%}
.doc h1{font-size:clamp(1.7rem,3.5vw,2.3rem);line-height:1.2;margin:0 0 .6em}
.doc h2{font-size:1.45rem;margin:2em 0 .6em;padding-top:.6em;border-top:1px solid var(--border)}
.doc h3{font-size:1.12rem;margin:1.6em 0 .5em}
.doc h1,.doc h2,.doc h3,.doc h4{position:relative}
.doc .anchor{opacity:0;margin-left:.35em;text-decoration:none;font-size:.8em}
.doc h2:hover .anchor,.doc h3:hover .anchor{opacity:.6}
.doc code{font-family:var(--mono);font-size:.86em;background:var(--code-bg);padding:.12em .4em;border-radius:6px}
.doc pre{font-family:var(--mono);font-size:13px;background:var(--code-bg);border:1px solid var(--border);border-radius:10px;padding:14px;overflow:auto}
.doc pre code{background:none;padding:0}
.doc blockquote{margin:1em 0;border-left:4px solid var(--accent);background:var(--accent-soft);padding:10px 16px;border-radius:10px}
.doc blockquote p{margin:.3em 0}
.doc table{border-collapse:collapse;width:100%;font-size:.9rem;display:block;overflow-x:auto;margin:1em 0}
.doc th,.doc td{text-align:left;padding:8px 12px;border:1px solid var(--border);vertical-align:top}
.doc th{background:var(--surface-2);font-weight:600}
.doc tr:nth-child(even) td{background:color-mix(in srgb,var(--surface-2) 45%,transparent)}
.doc img{max-width:100%}
.mermaid-box{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;overflow:auto;margin:1em 0;box-shadow:var(--shadow);text-align:center}
.mermaid-box svg{max-width:100%;height:auto}
.mermaid-err{color:var(--warn);font-size:.85rem;text-align:left}
.pager{display:flex;justify-content:space-between;gap:12px;margin-top:48px;border-top:1px solid var(--border);padding-top:18px}
.pager a{border:1px solid var(--border);background:var(--surface);border-radius:10px;padding:10px 14px;text-decoration:none;max-width:48%}
.pager small{display:block;color:var(--muted)}
mark{background:#fde68a;color:inherit;border-radius:3px}
.topbar{display:none}
.offline{border:1px solid var(--warn);color:var(--warn);border-radius:10px;padding:12px;margin-bottom:16px;display:none}
@media (max-width:900px){
  .layout{grid-template-columns:1fr}
  nav.side{position:fixed;inset:0 auto 0 0;width:280px;z-index:50;transform:translateX(-100%);transition:transform .2s;box-shadow:var(--shadow)}
  nav.side.open{transform:none}
  .topbar{display:flex;position:sticky;top:0;z-index:40;align-items:center;justify-content:space-between;padding:10px 16px;background:var(--surface);border-bottom:1px solid var(--border)}
}
</style>
</head>
<body>
<div class="topbar"><strong>🤖 DevAssistant</strong><button id="menuBtn">☰ Menú</button></div>
<div class="layout">
  <nav class="side" id="side">
    <div class="brand"><span class="logo">🤖</span>DevAssistant</div>
    <input class="search" id="search" type="search" placeholder="Buscar en la documentación…" aria-label="Buscar">
    <div id="nav"></div>
    <div class="side-foot">
      <button id="themeBtn">🌓 Cambiar tema</button>
      Generado desde los .md con <code>build-index.mjs</code>.<br>Requiere conexión para cargar marked y mermaid (CDN).
    </div>
  </nav>
  <main>
    <div class="offline" id="offline">No se pudieron cargar las librerías desde el CDN (¿sin conexión?). Abre los archivos <code>.md</code> directamente.</div>
    <article class="doc" id="doc"></article>
    <div class="pager" id="pager"></div>
  </main>
</div>
<script id="docs-data" type="application/json">${payload}</script>
<script src="https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"></script>
<script>
(function () {
  const DOCS = JSON.parse(document.getElementById("docs-data").textContent);
  const byFile = Object.fromEntries(DOCS.map((d) => [d.file, d]));
  const $doc = document.getElementById("doc");
  const $nav = document.getElementById("nav");
  const $pager = document.getElementById("pager");
  const $search = document.getElementById("search");
  const root = document.documentElement;

  if (!window.marked || !window.mermaid) {
    document.getElementById("offline").style.display = "block";
    return;
  }

  // ---- Tema ----
  const stored = localStorage.getItem("devassistant-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = stored || (prefersDark ? "dark" : "light");
  function initMermaid() {
    mermaid.initialize({ startOnLoad: false, securityLevel: "loose", theme: root.dataset.theme === "dark" ? "dark" : "default" });
  }
  initMermaid();
  document.getElementById("themeBtn").onclick = () => {
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem("devassistant-theme", root.dataset.theme);
    initMermaid();
    render(current, location.hash.split("#")[2]);
  };
  document.getElementById("menuBtn").onclick = () => document.getElementById("side").classList.toggle("open");

  // ---- Slugs estilo GitHub (para que los enlaces #ancla de los .md funcionen) ----
  function slugify(text) {
    return text.toLowerCase().replace(/[^\\p{L}\\p{N}\\p{M}\\s_-]/gu, "").replace(/\\s/g, "-");
  }
  let slugCounts = {};
  const renderer = new marked.Renderer();
  renderer.heading = function (text, level, raw) {
    let slug = slugify(raw);
    if (slugCounts[slug] !== undefined) { slugCounts[slug]++; slug += "-" + slugCounts[slug]; }
    else slugCounts[slug] = 0;
    return "<h" + level + ' id="' + slug + '">' + text + '<a class="anchor" href="#' + current + "#" + slug + '">#</a></h' + level + ">";
  };
  renderer.code = function (code, lang) {
    if (lang === "mermaid") return '<div class="mermaid-box"><pre class="mermaid">' + escapeHtml(code) + "</pre></div>";
    return '<pre><code class="language-' + (lang || "") + '">' + escapeHtml(code) + "</code></pre>";
  };
  marked.use({ renderer, gfm: true });
  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  // ---- Navegación ----
  function buildNav(filter) {
    const q = (filter || "").trim().toLowerCase();
    $nav.innerHTML = "";
    for (const d of DOCS) {
      const hits = q ? d.md.toLowerCase().split(q).length - 1 : 0;
      if (q && hits === 0) continue;
      const a = document.createElement("a");
      a.href = "#" + d.file;
      a.className = d.file === current ? "active" : "";
      const label = d.title.replace(/^\\d\\d\\s*·\\s*/, "").replace(/^📘\\s*/, "");
      a.innerHTML = '<span class="num">' + d.num + "</span><span>" + escapeHtml(label) + "</span>" + (q ? '<span class="hits">' + hits + "</span>" : "");
      $nav.appendChild(a);
    }
  }
  $search.addEventListener("input", () => { buildNav($search.value); highlight(); });

  function highlight() {
    const q = $search.value.trim();
    $doc.querySelectorAll("mark").forEach((m) => m.replaceWith(m.textContent));
    if (q.length < 2) return;
    const walker = document.createTreeWalker($doc, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => n.parentElement.closest(".mermaid-box, script") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const re = new RegExp(q.replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&"), "gi");
    let first = null;
    for (const n of nodes) {
      re.lastIndex = 0;
      if (!re.test(n.nodeValue)) continue;
      const span = document.createElement("span");
      span.innerHTML = escapeHtml(n.nodeValue).replace(re, (m) => "<mark>" + m + "</mark>");
      n.replaceWith(span);
      first = first || span.querySelector("mark");
    }
    if (first) first.scrollIntoView({ block: "center" });
  }

  // ---- Render ----
  let current = "README.md";
  async function render(file, anchor) {
    const d = byFile[file] || byFile["README.md"];
    current = d.file;
    slugCounts = {};
    $doc.innerHTML = marked.parse(d.md);

    // Enlaces entre documentos .md → navegación interna
    $doc.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href");
      const m = href.match(/^(?:\\.\\/)?((?:\\d\\d-[^#/]+|README)\\.md)(?:#(.*))?$/);
      if (m && byFile[m[1]]) a.setAttribute("href", "#" + m[1] + (m[2] ? "#" + m[2] : ""));
      else if (href.startsWith("#") && !href.includes(".md")) a.setAttribute("href", "#" + current + href);
      else if (/^https?:/.test(href)) a.target = "_blank";
    });

    // Diagramas
    const nodes = $doc.querySelectorAll("pre.mermaid");
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      try {
        const { svg } = await mermaid.render("mmd-" + Date.now() + "-" + i, el.textContent);
        el.outerHTML = svg;
      } catch (e) {
        el.outerHTML = '<div class="mermaid-err">⚠️ Error al renderizar el diagrama: ' + escapeHtml(String(e.message || e)) + "</div><pre>" + escapeHtml(el.textContent) + "</pre>";
      }
    }

    // Paginador
    const idx = DOCS.indexOf(d);
    const prev = DOCS[idx - 1], next = DOCS[idx + 1];
    $pager.innerHTML =
      (prev ? '<a href="#' + prev.file + '"><small>← Anterior</small>' + escapeHtml(prev.title) + "</a>" : "<span></span>") +
      (next ? '<a href="#' + next.file + '" style="text-align:right"><small>Siguiente →</small>' + escapeHtml(next.title) + "</a>" : "");

    buildNav($search.value);
    document.title = d.title + " · DevAssistant";
    document.getElementById("side").classList.remove("open");
    if (anchor) document.getElementById(decodeURIComponent(anchor))?.scrollIntoView();
    else window.scrollTo(0, 0);
    highlight();
  }

  function route() {
    const parts = location.hash.slice(1).split("#");
    render(decodeURIComponent(parts[0] || "README.md"), parts[1]);
  }
  window.addEventListener("hashchange", route);
  route();
})();
</script>
</body>
</html>
`;

writeFileSync(join(DIR, "index.html"), html, "utf-8");
console.log(`index.html generado con ${docs.length} documentos`);
