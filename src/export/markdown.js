// Document TipTap (JSON) → Markdown
//
// ctx.lien(id)          → chemin relatif de la page exportée, ou null si elle n'est pas dans l'export
// ctx.image(src, alt)   → chemin relatif de l'image (écrite à part si c'était une data URL)

const echapper = (t) => t.replace(/([\\`*_[\]<])/g, '\\$1');

function codeEnLigne(t) {
  const plusLong = Math.max(0, ...(t.match(/`+/g) || []).map((s) => s.length));
  const d = '`'.repeat(plusLong + 1);
  return /^`|`$/.test(t) ? `${d} ${t} ${d}` : `${d}${t}${d}`;
}

const encoderChemin = (c) => c.split('/').map((s) => encodeURIComponent(s)).join('/');
// une URL complète (http:, data:…) reste telle quelle ; un chemin relatif est encodé
const cheminSur = (c) => (/^[a-z][a-z0-9+.-]*:/i.test(c) ? c : encoderChemin(c));

// Les marques voisines identiques sont regroupées : « **a `b` c** » et non « **a **`b`** c** ».
// Ordre d'imbrication : lien, gras, italique, barré, souligné. Le code en ligne reste à l'intérieur.
const ORDRE = ['link', 'bold', 'italic', 'strike', 'underline'];
const memeMarque = (a, b) => a.type === b.type && JSON.stringify(a.attrs || {}) === JSON.stringify(b.attrs || {});

function marquer(m, interieur, ctx) {
  // Les espaces de bordure restent hors des marqueurs : « ** a** » n'est pas du gras
  const [, avant, coeur, apres] = interieur.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!coeur) return interieur;
  let t = coeur;
  if (m.type === 'bold') t = `**${t}**`;
  else if (m.type === 'italic') t = `*${t}*`;
  else if (m.type === 'strike') t = `~~${t}~~`;
  else if (m.type === 'underline') t = `<u>${t}</u>`;
  else if (m.type === 'link') {
    const href = m.attrs.href;
    if (href.startsWith('page:')) {
      const chemin = ctx.lien(Number(href.slice(5)));
      if (chemin != null) t = `[${t}](${encoderChemin(chemin)})`;
    } else {
      t = `[${t}](${href.replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29')})`;
    }
  }
  return avant + t + apres;
}

function envelopper(morceaux, ctx) {
  let sortie = '';
  let i = 0;
  while (i < morceaux.length) {
    const m = morceaux[i].marques[0];
    if (!m) { sortie += morceaux[i].s; i++; continue; }
    let j = i;
    while (j < morceaux.length && morceaux[j].marques[0] && memeMarque(morceaux[j].marques[0], m)) j++;
    const groupe = morceaux.slice(i, j).map((p) => ({ s: p.s, marques: p.marques.slice(1) }));
    sortie += marquer(m, envelopper(groupe, ctx), ctx);
    i = j;
  }
  return sortie;
}

function enLigne(noeuds = [], ctx) {
  const morceaux = [];
  for (const n of noeuds) {
    if (n.type === 'text') {
      const toutes = n.marks || [];
      const marques = toutes.filter((m) => m.type !== 'code')
        .sort((a, b) => ORDRE.indexOf(a.type) - ORDRE.indexOf(b.type));
      const code = toutes.some((m) => m.type === 'code');
      morceaux.push({ s: code ? codeEnLigne(n.text) : echapper(n.text), marques });
    } else if (n.type === 'hardBreak') {
      morceaux.push({ s: '  \n', marques: [] });
    } else if (n.type === 'inlineMath') {
      morceaux.push({ s: `$${n.attrs.latex}$`, marques: [] });
    }
  }
  return envelopper(morceaux, ctx);
}

const brut = (noeuds = []) => noeuds.map((n) => (n.type === 'text' ? n.text : brut(n.content))).join('');

// Début de ligne qui serait pris pour du Markdown (« # », « - », « 1. »…)
const protegerDebut = (s) => s.replace(/^(\s*)(#{1,6}\s|[-+>]\s|\d+[.)]\s)/, '$1\\$2');

const prefixer = (texte, premier, suite) => texte.split('\n')
  .map((l, i) => (i === 0 ? premier : (l ? suite : '')) + l).join('\n');

function blocs(noeuds = [], ctx) {
  const parts = [];
  for (const n of noeuds) {
    const s = bloc(n, ctx);
    if (s !== '') parts.push({ s, liste: /List$/.test(n.type) });
  }
  // une liste imbriquée se colle à l'élément qui la précède
  return parts.map((p, i) => (i === 0 ? '' : (p.liste ? '\n' : '\n\n')) + p.s).join('');
}

function bloc(n, ctx) {
  const c = n.content || [];
  switch (n.type) {
    case 'paragraph': return protegerDebut(enLigne(c, ctx));
    case 'heading': return `${'#'.repeat(n.attrs.level)} ${enLigne(c, ctx)}`;
    case 'bulletList': return c.map((li) => prefixer(blocs(li.content, ctx), '- ', '  ')).join('\n');
    case 'orderedList': {
      const debut = n.attrs?.start ?? 1;
      return c.map((li, i) => {
        const m = `${debut + i}. `;
        return prefixer(blocs(li.content, ctx), m, ' '.repeat(m.length));
      }).join('\n');
    }
    case 'taskList': return c.map((li) => prefixer(blocs(li.content, ctx), li.attrs?.checked ? '- [x] ' : '- [ ] ', '  ')).join('\n');
    case 'blockquote': return prefixer(blocs(c, ctx), '> ', '> ').replace(/\n(?=\n)/g, '\n>');
    case 'callout': {
      const interieur = `${n.attrs?.icone || '💡'} ${blocs(c, ctx)}`;
      return prefixer(interieur, '> ', '> ').replace(/\n(?=\n)/g, '\n>');
    }
    case 'codeBlock': {
      const code = brut(c);
      const plusLong = Math.max(2, ...(code.match(/`{3,}/g) || []).map((s) => s.length));
      const f = '`'.repeat(plusLong + 1);
      return `${f}${n.attrs?.language || ''}\n${code}\n${f}`;
    }
    case 'horizontalRule': return '---';
    case 'blockMath': return `$$\n${n.attrs.latex}\n$$`;
    case 'image': return `![${(n.attrs.alt || '').replace(/[[\]]/g, '')}](${cheminSur(ctx.image(n.attrs.src, n.attrs.alt))})`;
    case 'details': {
      const resume = c.find((x) => x.type === 'detailsSummary');
      const contenu = c.find((x) => x.type === 'detailsContent');
      return `<details>\n<summary>${brut(resume?.content)}</summary>\n\n${blocs(contenu?.content, ctx)}\n\n</details>`;
    }
    case 'table': return tableau(c, ctx);
    default: return blocs(c, ctx);
  }
}

function tableau(lignes, ctx) {
  const cellules = (tr) => (tr.content || []).map((td) => blocs(td.content, ctx)
    .replace(/\n+/g, '<br>').replace(/\|/g, '\\|'));
  const rangees = lignes.map(cellules);
  if (rangees.length === 0) return '';
  const n = Math.max(...rangees.map((r) => r.length));
  const complete = (r) => `| ${[...r, ...Array(n - r.length).fill('')].join(' | ')} |`;
  return [complete(rangees[0]), `| ${Array(n).fill('---').join(' | ')} |`, ...rangees.slice(1).map(complete)].join('\n');
}

export function docVersMarkdown(doc, ctx) {
  return blocs(doc.content, ctx);
}
