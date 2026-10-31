import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const cleRecherche = new PluginKey('rechercheDansPage');

// Sans accents ni majuscules, caractère par caractère : la longueur ne change pas, donc les positions restent justes
const normaliser = (texte) => Array.from(texte, (c) => {
  const n = c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return n.length === c.length ? n : c;
}).join('');

function trouver(doc, requete) {
  const q = normaliser(requete);
  const trouves = [];
  if (!q) return trouves;
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    const texte = normaliser(node.textBetween(0, node.content.size, '\n', '￼'));
    if (texte.length === node.content.size) {
      for (let i = texte.indexOf(q); i !== -1; i = texte.indexOf(q, i + q.length)) {
        trouves.push({ from: pos + 1 + i, to: pos + 1 + i + q.length });
      }
    }
    return false;
  });
  return trouves;
}

// Ctrl+F : surligne les occurrences d'un mot dans la page ; l'interface vit dans Editor.jsx
export const RechercheDansPage = Extension.create({
  name: 'rechercheDansPage',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: cleRecherche,
        state: {
          init: () => ({ requete: '', index: 0, trouves: [] }),
          apply(tr, prec, ancien, nouvel) {
            const meta = tr.getMeta(cleRecherche);
            if (!meta && !tr.docChanged) return prec;
            let { requete, index } = prec;
            if (meta && 'requete' in meta) { requete = meta.requete; index = 0; }
            if (meta && 'index' in meta) index = meta.index;
            const trouves = trouver(nouvel.doc, requete);
            return { requete, index: trouves.length ? ((index % trouves.length) + trouves.length) % trouves.length : 0, trouves };
          },
        },
        props: {
          decorations(state) {
            const { trouves, index } = cleRecherche.getState(state);
            return DecorationSet.create(
              state.doc,
              trouves.map((t, i) => Decoration.inline(t.from, t.to, { class: i === index ? 'recherche-courant' : 'recherche-trouve' })),
            );
          },
        },
      }),
    ];
  },
});
