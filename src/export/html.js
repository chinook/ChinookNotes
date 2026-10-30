// Document TipTap (JSON) → HTML autonome (code coloré, équations en MathML, liens entre pages)
import { generateHTML } from '@tiptap/html';
import { createLowlight, common } from 'lowlight';
import katex from 'katex';
import { creerExtensions } from '../editor/extensions.js';
import { cssCouverture } from '../couverture.js';

const extensions = creerExtensions({ onMathClick: () => {} });
const lowlight = createLowlight(common);

const echapperHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Arbre de lowlight (hast) → HTML
function hastVersHtml(n) {
  if (n.type === 'text') return echapperHtml(n.value);
  const interieur = (n.children || []).map(hastVersHtml).join('');
  if (n.type === 'element') {
    const classes = (n.properties?.className || []).join(' ');
    return classes ? `<span class="${classes}">${interieur}</span>` : interieur;
  }
  return interieur;
}

function colorer(code, langue) {
  try {
    if (langue && lowlight.registered(langue)) return hastVersHtml(lowlight.highlight(langue, code));
  } catch { /* langue inconnue : texte brut */ }
  return echapperHtml(code);
}

// ctx.lien(id) → href de la page exportée, ou null
export function docVersHtml(doc, ctx) {
  const html = generateHTML(doc, extensions);
  const racine = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;

  for (const code of racine.querySelectorAll('pre code')) {
    const langue = [...code.classList].find((c) => c.startsWith('language-'))?.slice(9);
    code.innerHTML = colorer(code.textContent, langue);
  }

  for (const el of racine.querySelectorAll('[data-type="inline-math"], [data-type="block-math"]')) {
    const bloc = el.getAttribute('data-type') === 'block-math';
    const mathml = katex.renderToString(el.getAttribute('data-latex') || '', { output: 'mathml', throwOnError: false, displayMode: bloc });
    const rendu = document.createElement(bloc ? 'div' : 'span');
    rendu.className = bloc ? 'math-bloc' : 'math';
    rendu.innerHTML = mathml;
    el.replaceWith(rendu);
  }

  for (const a of racine.querySelectorAll('a[href^="page:"]')) {
    const href = ctx.lien(Number(a.getAttribute('href').slice(5)));
    if (href == null) a.replaceWith(...a.childNodes);
    else a.setAttribute('href', href);
  }

  // Les « toggles » de l'éditeur deviennent des <details> natifs
  for (const d of racine.querySelectorAll('div[data-type="details"]')) {
    const natif = document.createElement('details');
    natif.open = true;
    const resume = document.createElement('summary');
    resume.innerHTML = d.querySelector('[data-type="detailsSummary"]')?.innerHTML ?? '';
    natif.append(resume);
    const contenu = d.querySelector('[data-type="detailsContent"]');
    if (contenu) natif.insertAdjacentHTML('beforeend', contenu.innerHTML);
    d.replaceWith(natif);
  }

  return racine.innerHTML;
}

const STYLE = `
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font: 14px/1.6 -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; color: #37352f; max-width: 820px; margin: 0 auto; padding: 24px; }
  h1, h2, h3, h4 { line-height: 1.25; break-after: avoid; }
  h1 { font-size: 1.9em; margin: 1.2em 0 .4em; } h2 { font-size: 1.5em; margin: 1.1em 0 .3em; } h3 { font-size: 1.2em; margin: 1em 0 .3em; }
  p { margin: .5em 0; }
  a { color: #2383e2; }
  hr { border: none; border-top: 1px solid #e9e9e7; margin: 1.2em 0; }
  code { background: #ebeae6; border-radius: 4px; padding: 1px 5px; font: .88em Consolas, 'Courier New', monospace; }
  pre { background: #f7f6f3; border: 1px solid #e9e9e7; border-radius: 6px; padding: 10px 14px; white-space: pre-wrap; overflow-wrap: anywhere; break-inside: avoid-page; }
  pre code { background: none; padding: 0; font-size: 12px; line-height: 1.5; }
  .hljs-comment, .hljs-quote { color: #8a8f98; font-style: italic; }
  .hljs-keyword, .hljs-selector-tag, .hljs-built_in, .hljs-type { color: #c0392b; }
  .hljs-string, .hljs-title, .hljs-attr { color: #1a7f5a; }
  .hljs-number, .hljs-literal, .hljs-meta { color: #b9770e; }
  .hljs-function, .hljs-name { color: #2471a3; }
  blockquote { margin: .6em 0; padding-left: 14px; border-left: 3px solid #37352f; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; margin: .8em 0; }
  tr { break-inside: avoid; }
  th, td { border: 1px solid #e0dfdb; padding: 5px 9px; vertical-align: top; overflow-wrap: anywhere; }
  th { background: #f7f6f3; text-align: left; }
  td p, th p { margin: 0; }
  img { max-width: 100%; height: auto; }
  img.emoji-export { width: 1em; height: 1em; vertical-align: -0.12em; }
  ul[data-type="taskList"] { list-style: none; padding-left: .4em; }
  ul[data-type="taskList"] li { display: flex; gap: 8px; }
  ul[data-type="taskList"] li > div { flex: 1; }
  ul, ol { padding-left: 1.6em; margin: .4em 0; }
  div[data-callout] { position: relative; background: #f7f6f3; border: 1px solid #e9e9e7; border-radius: 6px; padding: 10px 14px 10px 42px; margin: .7em 0; break-inside: avoid-page; }
  div[data-callout]::before { content: attr(data-icone); position: absolute; left: 13px; top: 10px; }
  details { margin: .5em 0; } summary { cursor: pointer; font-weight: 500; }
  .math-bloc { text-align: center; margin: .8em 0; }
  .page-export { margin-bottom: 2.5em; }
  .page-export + .page-export { break-before: page; }
  .page-export > h1.titre-page { margin-top: 0; font-size: 2.1em; }
  .couverture-export { height: 150px; border-radius: 6px; margin-bottom: 18px; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
`;

// sections : [{ id, titre, icone, couverture, html }]. Plusieurs sections = un document pour tout l'export (PDF).
export function documentHtml(titre, sections) {
  const corps = sections.map((s) => `
<section class="page-export" id="p-${s.id}">
  ${cssCouverture(s.couverture) ? `<div class="couverture-export" style='${cssCouverture(s.couverture).replace(/'/g, '%27')}'></div>` : ''}
  <h1 class="titre-page">${s.iconeHtml ? `${s.iconeHtml} ` : s.icone && !s.icone.startsWith('emoji:') ? `${echapperHtml(s.icone)} ` : ''}${echapperHtml(s.titre || 'Sans titre')}</h1>
  ${s.html}
</section>`).join('\n');
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${echapperHtml(titre)}</title>
<style>${STYLE}</style>
</head>
<body>
${corps}
</body>
</html>
`;
}
