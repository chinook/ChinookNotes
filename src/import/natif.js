// Import d'un export « Markdown & CSV » natif de Notion : pages (hiérarchie par dossiers),
// bases de données (CSV + une page par ligne) et sous-pages de lignes.
import { convertirCorps, separerEmoji } from './convertir.js';
import { lireCsv } from './csv.js';
import { proprietesDeLigne, schemaDepuisCsv } from './schemaCsv.js';

const RE_HEX_MD = /\s([0-9a-f]{32})\.md$/i;
const RE_HEX_CSV = /\s([0-9a-f]{32})(_all)?\.csv$/i;
const norm = (s) => s.normalize('NFC').trim().toLowerCase();

// Notion n'encode pas toujours les parenthèses d'un nom de fichier dans un lien : « [A) x](A) x (y) 3ef0….md) »
// casse le Markdown. On encode les parenthèses entre « ]( » et « <identifiant>.md) ».
const reparerLiens = (texte) => texte.replace(/\]\(([^\n]*?[0-9a-f]{32}\.md)\)/g, (tout, cible) => `](${cible.replace(/\(/g, '%28').replace(/\)/g, '%29')})`);

export const estNatif = (nom) => RE_HEX_MD.test(nom);

function dossierDe(chemin) {
  const i = chemin.lastIndexOf('/');
  return i < 0 ? '' : chemin.slice(0, i);
}

// Une table par base de données ; le CSV « _all » (toutes les colonnes) l'emporte sur celui de la vue
function lireTables(tables) {
  const parHex = new Map();
  for (const t of tables) {
    const m = t.nom.match(RE_HEX_CSV);
    if (!m) continue;
    const [, hex, tout] = m;
    if (parHex.has(hex) && !tout) continue;
    parHex.set(hex, { hex, titre: t.nom.replace(RE_HEX_CSV, '').trim(), data: lireCsv(t.texte), complet: !!tout });
  }
  return [...parHex.values()].filter((t) => t.data.colonnes.length > 0);
}

function analyserPage(f) {
  const lignes = f.texte.replace(/^﻿/, '').split(/\r?\n/);
  let i = 0;
  while (i < lignes.length && !lignes[i].trim()) i++;
  let titre = f.nom.replace(RE_HEX_MD, '');
  if (lignes[i]?.startsWith('# ')) { titre = lignes[i].slice(2).trim(); i++; }
  return { ...f, hex: f.nom.match(RE_HEX_MD)[1], titreBrut: titre, apres: lignes.slice(i) };
}

// Notion écrit les propriétés d'une ligne en tête de page (« Clé: valeur »). Les valeurs viennent
// du CSV, qui est exact ; ici on ne fait que retirer ce bloc pour garder le contenu de la page.
function corpsDeLigne(apres, ligneCsv, colonnes, colonneTitre, avertir) {
  const cles = colonnes.filter((c) => c !== colonneTitre);
  const attendues = new Set(cles.filter((c) => ligneCsv[c] !== ''));
  let i = 0;
  let derniere = null;
  while (attendues.size > 0 && i < apres.length) {
    const m = apres[i].match(/^(.+?): ?(.*)$/);
    if (m && attendues.has(m[1])) { attendues.delete(m[1]); derniere = m[1]; }
    i++;
  }
  if (attendues.size > 0) avertir(`propriétés introuvables dans la page : ${[...attendues].join(', ')}`);
  // la dernière valeur peut tenir sur plusieurs lignes
  if (derniere) i += ligneCsv[derniere].split('\n').length - 1;
  // propriétés vides écrites quand même (« Clé: »)
  while (i < apres.length && (apres[i].trim() === '' || (/^(.+?):\s*$/.test(apres[i]) && cles.includes(apres[i].match(/^(.+?):/)[1])))) i++;
  return apres.slice(i).join('\n');
}

// Ligne de la forme « A) Titre » : la partie utile pour retrouver une page qui la mentionne
const motsCles = (titre) => norm(titre.replace(/^[A-Z0-9]\)\s*/, '').replace(/→/g, '->'));

export async function importerNatif(lot, fichiersNatifs, surProgres) {
  const avertissements = [];
  const tables = lireTables(lot.tables || []);
  const pages = fichiersNatifs.map(analyserPage);
  const parHex = new Map(pages.map((p) => [p.hex, p]));
  const parNom = new Map(pages.map((p) => [p.nom, p]));

  // 1. Qui est une ligne de base, une base, une page ?
  const bases = tables.map((t) => ({ ...t, cle: `base:${t.hex}`, colonneTitre: t.data.colonnes[0] }));
  const lignes = new Map(); // nom de fichier → { base, ligne }
  for (const b of bases) {
    const parTitre = new Map(b.data.lignes.map((l) => [norm(l[b.colonneTitre]), l]));
    for (const p of pages) {
      const l = parTitre.get(norm(p.titreBrut));
      if (l && p.hex !== b.hex && !lignes.has(p.nom)) lignes.set(p.nom, { base: b, ligne: l });
    }
  }
  const pagesBase = new Map(bases.filter((b) => parHex.has(b.hex)).map((b) => [b.hex, parHex.get(b.hex)])); // page « façade » de la base
  const ordinaires = pages.filter((p) => !lignes.has(p.nom) && !pagesBase.has(p.hex));

  // 2. Parent de chaque page ordinaire : dossier, sinon page qui la mentionne
  const pageParNomDossier = (dossier) => {
    const nomDossier = dossier.slice(dossier.lastIndexOf('/') + 1);
    const dessus = dossierDe(dossier);
    return pages.find((p) => dossierDe(p.chemin) === dessus && norm(p.nom.replace(RE_HEX_MD, '')) === norm(nomDossier));
  };
  const parents = new Map(); // nom de fichier → { type: 'page'|'base', cle }
  const versParent = (q) => (lignes.has(q.nom) ? { page: q.nom } : pagesBase.has(q.hex) ? { base: q.hex } : { page: q.nom });
  // Un export à plat perd les dossiers, mais une page « index » liste ses sous-pages : [titre](Titre%20<id>.md)
  const liensSortants = new Map(pages.map((p) => [p.hex, [...p.apres.join('\n').matchAll(/([0-9a-f]{32})\.md\)/g)].map((m) => m[1])]));
  const ordreFrere = new Map(); // nom de fichier → rang dans la liste de son parent
  for (const p of ordinaires) {
    const dossier = dossierDe(p.chemin);
    const dossierParent = dossier ? pageParNomDossier(dossier) : null;
    if (dossierParent) {
      parents.set(p.nom, versParent(dossierParent));
      continue;
    }
    // la page qui liste celle-ci (l'index le plus fourni si plusieurs la citent)
    const citeurs = pages.filter((q) => q !== p && liensSortants.get(q.hex).includes(p.hex) && !liensSortants.get(p.hex).includes(q.hex));
    if (citeurs.length > 0) {
      const index = citeurs.reduce((a, b) => (liensSortants.get(b.hex).length > liensSortants.get(a.hex).length ? b : a));
      parents.set(p.nom, versParent(index));
      ordreFrere.set(p.nom, liensSortants.get(index.hex).indexOf(p.hex));
      continue;
    }
    // export à plat : on cherche la ligne ou la page qui cite ce titre
    const cherche = motsCles(p.titreBrut);
    const citent = pages.filter((q) => q !== p && norm(q.apres.join('\n') + (lignes.has(q.nom) ? '\n' + Object.values(lignes.get(q.nom).ligne).join('\n') : '')).replace(/→/g, '->').includes(cherche));
    if (citent.length === 1) parents.set(p.nom, { page: citent[0].nom });
    else if (dossier === '' && citent.length > 1) avertissements.push(`${p.nom} : citée par plusieurs pages, importée à la racine`);
  }

  // 3. Plan de création (parents avant enfants)
  const plan = [];
  const ajouter = (e) => plan.push(e);
  const idsBases = new Map();
  for (const b of bases) {
    const facade = pagesBase.get(b.hex);
    const { icone, titre } = separerEmoji(facade ? facade.titreBrut : b.titre);
    const schema = schemaDepuisCsv(b.data, b.colonneTitre);
    idsBases.set(b.hex, { ...b, schema, cle: b.cle });
    ajouter({ cle: b.cle, titre, icone: icone ?? null, sourceId: b.hex, type: 'base', schema: JSON.stringify(schema), parentCle: null, parentId: null });
  }
  for (const [nom, { base, ligne }] of lignes) {
    const { schema } = idsBases.get(base.hex);
    ajouter({
      cle: nom, titre: ligne[base.colonneTitre], icone: null, sourceId: parNom.get(nom).hex,
      parentCle: base.cle, parentId: null, proprietes: JSON.stringify(proprietesDeLigne(ligne, schema)),
    });
  }
  // pages ordinaires : on place d'abord celles dont le parent est déjà dans le plan
  const places = new Set(plan.map((e) => e.cle));
  let reste = [...ordinaires];
  while (reste.length) {
    const pretes = reste.filter((p) => {
      const par = parents.get(p.nom);
      return !par || par.base || places.has(par.page);
    });
    if (pretes.length === 0) { for (const p of reste) avertissements.push(`${p.nom} : parent introuvable (cycle ?)`); break; }
    pretes.sort((a, b) => (ordreFrere.get(a.nom) ?? 1e9) - (ordreFrere.get(b.nom) ?? 1e9)); // ordre de la liste du parent
    for (const p of pretes) {
      const par = parents.get(p.nom);
      const { icone, titre } = separerEmoji(p.titreBrut);
      ajouter({
        cle: p.nom, titre, icone, sourceId: p.hex,
        parentCle: par?.base ? `base:${par.base}` : par?.page ?? null, parentId: null,
      });
      places.add(p.nom);
    }
    reste = reste.filter((p) => !places.has(p.nom));
  }

  surProgres(`Création de ${plan.length} pages…`);
  const ids = await window.api.importerPages(plan);

  // 4. Contenu des pages
  // identifiant Notion → page, y compris les pages importées lors d'un import précédent
  const idParHex = new Map((await window.api.listePages()).filter((p) => p.source_id).map((p) => [p.source_id, p.id]));
  for (const p of pages) if (ids[p.nom]) idParHex.set(p.hex, ids[p.nom].id);
  for (const b of bases) if (ids[b.cle]) idParHex.set(b.hex, ids[b.cle].id);
  const resoudreLien = (href) => {
    const m = href.match(/([0-9a-f]{32})\.md$/i);
    return m ? idParHex.get(m[1]) ?? null : null;
  };
  // lien web vers une page Notion déjà importée : « https://app.notion.com/p/Titre-<id>?pvs=21 »
  const resoudreNotion = (href) => {
    const m = href.match(/notion\.(?:so|com)\/.*?([0-9a-f]{32})(?:[?#].*)?$/i);
    return m ? idParHex.get(m[1]) ?? null : null;
  };

  // sous-pages d'une ligne : la sidebar ne montre pas les lignes, on ajoute donc une liste de liens dans la page
  const sousPagesDe = new Map();
  for (const p of ordinaires) {
    const par = parents.get(p.nom);
    if (par?.page && lignes.has(par.page)) {
      if (!sousPagesDe.has(par.page)) sousPagesDe.set(par.page, []);
      sousPagesDe.get(par.page).push(p);
    }
  }

  let importees = 0;
  let ignorees = 0;
  for (const p of pages) {
    const entree = ids[p.nom];
    if (!entree) continue; // façade d'une base : remplacée par la base elle-même
    if (!entree.nouveau) { ignorees++; continue; }
    surProgres(`Conversion : ${p.titreBrut}`);
    let corps;
    const info = lignes.get(p.nom);
    if (info) {
      corps = corpsDeLigne(p.apres, info.ligne, info.base.data.colonnes, info.base.colonneTitre, (m) => avertissements.push(`${p.nom} : ${m}`));
    } else {
      corps = p.apres.join('\n');
    }
    corps = reparerLiens(corps);
    // seulement les sous-pages que la page ne cite pas déjà dans son texte
    const enfants = (sousPagesDe.get(p.nom) || []).filter((e) => !corps.includes(e.hex));
    if (enfants.length > 0) {
      // encodeURIComponent laisse passer les parenthèses, qui fermeraient le lien Markdown
      const cible = (nom) => encodeURIComponent(nom).replace(/[()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
      corps += `\n\n## Sous-pages\n\n${enfants.map((e) => `- [${e.titreBrut.replace(/[[\]]/g, '')}](${cible(e.nom)})`).join('\n')}\n`;
    }
    const doc = convertirCorps(corps, {
      page: p.nom, depuis: { nom: p.nom }, images: lot.images, resoudreLien, resoudreNotion, avertissements,
    });
    await window.api.modifierPage(entree.id, { contenu: JSON.stringify(doc) });
    importees++;
  }
  for (const b of bases) {
    if (ids[b.cle]?.nouveau) importees++; else if (ids[b.cle]) ignorees++;
  }
  return { importees, ignorees, avertissements };
}
