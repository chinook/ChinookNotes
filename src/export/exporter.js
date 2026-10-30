import { lireContenu } from '../editor/extensions.js';
import { docVersMarkdown } from './markdown.js';
import { docVersHtml, documentHtml } from './html.js';
import { docDeBase } from './base.js';

const nomSur = (t) => (t || 'Sans titre')
  .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim().replace(/\s+/g, '_').replace(/\.+$/, '').slice(0, 80) || 'Sans_titre';
const pad = (n) => String(n).padStart(2, '0');
const encoderChemin = (c) => c.split('/').map(encodeURIComponent).join('/');

const dirDe = (chemin) => (chemin.includes('/') ? chemin.slice(0, chemin.lastIndexOf('/')) : '');

// Chemin de « vers » vu depuis le dossier « depuisDossier » (chemins relatifs à la racine de l'export)
function relatif(depuisDossier, vers) {
  const a = depuisDossier ? depuisDossier.split('/') : [];
  const b = vers.split('/');
  let i = 0;
  while (i < a.length && i < b.length - 1 && a[i] === b[i]) i++;
  return [...Array(a.length - i).fill('..'), ...b.slice(i)].join('/');
}

const EXT_IMAGE = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg' };

function sousArbre(pages, id, avecSousPages) {
  const noeud = (p) => ({
    page: p,
    enfants: avecSousPages ? pages.filter((x) => x.parent_id === p.id).map(noeud) : [],
  });
  return noeud(pages.find((p) => p.id === id));
}

// Une page qui a des sous-pages devient un dossier : « 02_Titre/00_Titre.md » + ses enfants.
// La page exportée elle-même est à la racine de l'export.
function placer(noeud, dossier, prefixe, ext, plat, estRacine) {
  const nom = nomSur(noeud.page.titre);
  plat.push(noeud);
  if (estRacine) {
    noeud.chemin = `00_${nom}.${ext}`;
    noeud.enfants.forEach((e, i) => placer(e, '', `${pad(i + 1)}_`, ext, plat, false));
  } else if (noeud.enfants.length) {
    const d = dossier ? `${dossier}/${prefixe}${nom}` : `${prefixe}${nom}`;
    noeud.chemin = `${d}/00_${nom}.${ext}`;
    noeud.enfants.forEach((e, i) => placer(e, d, `${pad(i + 1)}_`, ext, plat, false));
  } else {
    noeud.chemin = `${dossier ? `${dossier}/` : ''}${prefixe}${nom}.${ext}`;
  }
}

// format : 'md' | 'html' | 'pdf' ; pages : liste à plat de l'application
// Retourne null si l'utilisateur annule, sinon { fichiers, emplacement }
export async function exporter({ id, format, sousPages, pages }) {
  const racine = pages.find((p) => p.id === id);
  const arbre = sousArbre(pages, id, sousPages);
  const plusieurs = arbre.enfants.length > 0;
  const nom = nomSur(racine.titre);

  // 1. Où écrire
  let dest;
  if (format === 'pdf' || !plusieurs) {
    dest = await window.api.choisirDestination({ mode: 'fichier', nom: `${nom}.${format}`, extension: format });
  } else {
    dest = await window.api.choisirDestination({ mode: 'dossier' });
  }
  if (!dest) return null;

  // 2. Lire le contenu de toutes les pages
  const plat = [];
  placer(arbre, '', '', format, plat, true);
  const docs = new Map();
  const couvertures = new Map();
  for (const n of plat) {
    const page = await window.api.lirePage(n.page.id);
    docs.set(n.page.id, n.page.type === 'base'
      ? docDeBase(n.page, pages.filter((p) => p.parent_id === n.page.id))
      : lireContenu(page.contenu) ?? { type: 'doc', content: [] });
    couvertures.set(n.page.id, page.couverture);
  }
  const parId = new Map(plat.map((n) => [n.page.id, n]));
  // Les icônes personnalisées sont des images : en HTML / PDF on les intègre, en Markdown on les omet
  const emojis = Object.fromEntries((await window.api.listeEmojis()).map((e) => [e.id, e]));
  const iconePerso = (ic) => (ic?.startsWith('emoji:') ? emojis[ic.slice(6)] : null);
  const iconeHtml = (ic) => { const e = iconePerso(ic); return e ? `<img class="emoji-export" src="${e.image}" alt="">` : null; };
  const iconeTexte = (ic) => (ic && !ic.startsWith('emoji:') ? ic : '');
  const titreDe = (n) => `${iconeTexte(n.page.icone) ? `${iconeTexte(n.page.icone)} ` : ''}${n.page.titre || 'Sans titre'}`;

  // PDF : un seul document, avec des ancres pour les liens entre pages
  if (format === 'pdf') {
    const sections = plat.map((n) => ({
      id: n.page.id,
      titre: n.page.titre,
      icone: n.page.icone,
      iconeHtml: iconeHtml(n.page.icone),
      couverture: couvertures.get(n.page.id),
      html: docVersHtml(docs.get(n.page.id), { lien: (pid) => (parId.has(pid) ? `#p-${pid}` : null) }),
    }));
    await window.api.exporterPdf(documentHtml(racine.titre || 'Sans titre', sections), dest.chemin);
    return { fichiers: 1, emplacement: dest.chemin };
  }

  // 3. Markdown / HTML : un fichier par page
  let dossierRacine = dest.dossier;
  if (plusieurs) dossierRacine = `${dest.dossier}/${nom}`;
  else parId.get(id).chemin = dest.nom;               // le nom choisi dans la boîte de dialogue

  const dossierImages = plusieurs ? 'images' : `${dest.nom.replace(/\.[^.]+$/, '')}_images`;
  const images = new Map();                            // data URL → chemin dans l'export
  const fichiers = [];

  for (const n of plat) {
    const dossier = dirDe(n.chemin);
    const ctx = {
      lien: (pid) => {
        const cible = parId.get(pid);
        return cible && cible !== n ? relatif(dossier, cible.chemin) : null;
      },
      image: (src) => {
        const m = src.match(/^data:(image\/[\w+.-]+);base64,(.*)$/s);
        if (!m) return src;
        if (!images.has(src)) {
          const chemin = `${dossierImages}/image-${images.size + 1}.${EXT_IMAGE[m[1]] || 'png'}`;
          images.set(src, chemin);
          fichiers.push({ chemin, base64: m[2] });
        }
        return relatif(dossier, images.get(src));
      },
    };

    let texte;
    if (format === 'md') {
      const corps = docVersMarkdown(docs.get(n.page.id), ctx);
      texte = `# ${titreDe(n)}\n\n${corps}\n`;
    } else {
      const ctxHtml = { lien: (pid) => { const c = ctx.lien(pid); return c == null ? null : encoderChemin(c); } };
      texte = documentHtml(n.page.titre || 'Sans titre', [{
        id: n.page.id, titre: n.page.titre, icone: n.page.icone, iconeHtml: iconeHtml(n.page.icone), couverture: couvertures.get(n.page.id), html: docVersHtml(docs.get(n.page.id), ctxHtml),
      }]);
    }
    fichiers.push({ chemin: n.chemin, texte });
  }

  await window.api.ecrireFichiers(dossierRacine, fichiers);
  return { fichiers: fichiers.length, emplacement: plusieurs ? dossierRacine : `${dest.dossier}/${dest.nom}` };
}
