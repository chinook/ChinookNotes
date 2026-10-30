import { marked } from 'marked';
import { generateJSON } from '@tiptap/html';
import { creerExtensions } from '../editor/extensions.js';

const extensions = creerExtensions({ onMathClick: () => {} });

// Notion n'exporte pas les images avec leur nom : seul l'identifiant du fichier
// apparaît dans la balise <image>. On les relie aux PNG fournis avec la sauvegarde.
const IMAGES_NOTION = {
  '574c85c5-9ebc-4a23-83d1-f6ab103cabab': 'boutons_volant_img.png',
  '196d6a24-f379-4667-a3cf-60211c3185c7': 'volant_competition_img.png',
  '67175e20-61ac-4a2b-bae5-558ae55d0d25': 'volant_tests_img.png',
};

const RE_EMOJI_DEBUT = /^(?:[0-9#*]️?⃣|\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|⃣)*)\s*/u;

export function separerEmoji(titre) {
  const m = titre.match(RE_EMOJI_DEBUT);
  if (!m) return { icone: null, titre: titre.trim() };
  return { icone: m[0].trim(), titre: titre.slice(m[0].length).trim() };
}

// Lit l'en-tête ajouté par l'export : titre, bloc « Exporté depuis Notion » (source, page parente)
export function analyserFichier(nom, texte) {
  const lignes = texte.replace(/^﻿/, '').split(/\r?\n/);
  let i = 0;
  while (i < lignes.length && !lignes[i].trim()) i++;

  let titreBrut = nom.replace(/\.md$/i, '');
  if (lignes[i]?.startsWith('# ')) {
    titreBrut = lignes[i].slice(2).trim();
    i++;
  }
  while (i < lignes.length && !lignes[i].trim()) i++;

  let sourceId = null;
  let parentTitre = null;
  if (lignes[i]?.startsWith('> Exporté depuis Notion')) {
    const bloc = [];
    while (i < lignes.length && lignes[i].startsWith('>')) bloc.push(lignes[i++]);
    const entete = bloc.join(' ');
    sourceId = entete.match(/Source : \S*?([0-9a-f]{32})(?:\s|$)/)?.[1] ?? null;
    parentTitre = entete.match(/Page parente : (.+?)\s*·/)?.[1]?.trim() ?? null;
  }

  const { icone, titre } = separerEmoji(titreBrut);
  return { nom, titre, icone, sourceId, parentTitre, corps: lignes.slice(i).join('\n') };
}

const norm = (s) => s.normalize('NFC').toLowerCase();

// Un lien vers « 01_Main.md » doit retrouver « 01_Main_02.md » dans la même carte
export function creerResolveurLiens(entrees) {
  const parNom = new Map(entrees.map((e) => [norm(e.nom), e]));
  return function resoudre(href, depuis) {
    let cible = href.split('#')[0];
    try { cible = decodeURIComponent(cible); } catch { /* garde tel quel */ }
    const base = norm(cible.split('/').pop());
    if (!base.endsWith('.md')) return null;

    const exact = parNom.get(base);
    if (exact) return exact.id;

    const racine = base.replace(/\.md$/, '');
    const carte = depuis.parentNom ?? depuis.nom;
    const candidats = entrees.filter((e) => {
      const n = norm(e.nom).replace(/\.md$/, '');
      return (n === racine || new RegExp(`^${racine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_\\d+$`).test(n))
        && (e.parentNom === carte || e.nom === carte);
    });
    return candidats[0]?.id ?? null;
  };
}

function trouverImage(ctx, source) {
  const id = source.match(/notion-file-block:\/\/[^/]+\/([0-9a-f-]{36})/)?.[1];
  const nom = IMAGES_NOTION[id];
  if (nom) return ctx.images.find((img) => img.nom === nom) ?? null;
  const base = decodeURIComponent(source.split('?')[0].split('/').pop() || '');
  return ctx.images.find((img) => img.nom === base) ?? null;
}

// Markdown de Notion → HTML. Les <callout> et <quote> contiennent du Markdown :
// on les repère ligne par ligne (hors blocs de code), puis on convertit leur intérieur.
function mdVersHtml(texte, ctx) {
  const lignes = texte.split('\n');
  const html = [];
  let md = [];
  const viderMd = () => {
    if (md.length) html.push(marked.parse(md.join('\n'), { async: false }));
    md = [];
  };

  let dansCode = false;
  for (let i = 0; i < lignes.length; i++) {
    const ligne = lignes[i];
    if (/^\s*(```|~~~)/.test(ligne)) dansCode = !dansCode;
    if (dansCode) { md.push(ligne); continue; }

    const ouvre = ligne.match(/^<(callout|quote|aside)(\s[^>]*)?>\s*$/);
    if (ouvre) {
      const [, type, attrs = ''] = ouvre;
      const interieur = [];
      let code = false;
      i++;
      for (; i < lignes.length; i++) {
        if (/^\s*(```|~~~)/.test(lignes[i])) code = !code;
        if (!code && lignes[i].trim() === `</${type}>`) break;
        interieur.push(lignes[i]);
      }
      viderMd();
      // <aside> (export natif) : l'icône est le premier caractère du texte
      let iconeAside = null;
      if (type === 'aside') {
        const premiere = interieur.findIndex((l) => l.trim());
        if (premiere >= 0) {
          const { icone, titre: reste } = separerEmoji(interieur[premiere].trim());
          if (icone) { iconeAside = icone; interieur[premiere] = reste; }
        }
      }
      const contenu = mdVersHtml(interieur.join('\n'), ctx);
      if (type === 'quote') {
        html.push(`<blockquote>${contenu}</blockquote>`);
      } else {
        const icone = iconeAside || attrs.match(/icon="([^"]*)"/)?.[1] || '💡';
        html.push(`<div data-callout data-icone="${icone}">${contenu}</div>`);
      }
      continue;
    }

    const image = ligne.match(/^\s*<image\s+source="([^"]*)"[^>]*\/?>\s*$/);
    if (image) {
      viderMd();
      const img = trouverImage(ctx, image[1]);
      if (img) {
        html.push(`<img src="${img.dataUrl}" alt="${img.nom}">`);
      } else {
        ctx.avertissements.push(`${ctx.page} : image introuvable (${image[1].slice(0, 60)}…)`);
        html.push('<p>⚠️ Image manquante</p>');
      }
      continue;
    }
    md.push(ligne);
  }
  viderMd();
  return html.join('\n');
}

// Liens vers d'autres pages → « page:ID » ; images relatives → images fournies
function reparerHtml(html, ctx) {
  html = html.replace(/<a href="([^"]*)"([^>]*)>([\s\S]*?)<\/a>/g, (tout, href, reste, texte) => {
    if (/^(https?:|mailto:|#)/i.test(href)) {
      // un lien web vers une page Notion déjà importée devient un lien interne
      const idNotion = ctx.resoudreNotion?.(decodeEntites(href));
      return idNotion != null ? `<a href="page:${idNotion}">${texte}</a>` : tout;
    }
    const id = ctx.resoudreLien(decodeEntites(href), ctx.depuis);
    if (id == null) {
      ctx.avertissements.push(`${ctx.page} : lien non résolu vers « ${decodeEntites(href)} »`);
      return texte;
    }
    return `<a href="page:${id}">${texte}</a>`;
  });
  html = html.replace(/<img src="(?!data:|https?:)([^"]*)"([^>]*)>/g, (tout, src) => {
    const img = trouverImage(ctx, decodeEntites(src));
    if (img) return `<img src="${img.dataUrl}" alt="${img.nom}">`;
    ctx.avertissements.push(`${ctx.page} : image introuvable (${src})`);
    return '<p>⚠️ Image manquante</p>';
  });
  return html;
}

function decodeEntites(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

// ctx : { page, depuis, images, resoudreLien, avertissements }
export function convertirCorps(corps, ctx) {
  const html = reparerHtml(mdVersHtml(corps, ctx), ctx);
  return generateJSON(html, extensions);
}
