import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

// Marque chaque lien « page:ID » avec l'icône de la page visée ; c'est le CSS qui l'affiche, à gauche du texte.
// `icone(id)` renvoie { emoji } ou { image } (image personnalisée), ou null si la page n'existe plus.
export const LiensPages = Extension.create({
  name: 'liensPages',

  addOptions() {
    return { icone: () => null };
  },

  addProseMirrorPlugins() {
    const { icone } = this.options;
    return [
      new Plugin({
        props: {
          decorations(state) {
            const decos = [];
            let precedent = null; // lien dont le début est déjà décoré (un lien peut couvrir plusieurs morceaux de texte)
            state.doc.descendants((node, pos) => {
              if (!node.isText) { precedent = null; return; }
              const lien = node.marks.find((m) => m.type.name === 'link' && m.attrs.href?.startsWith('page:'));
              if (!lien) { precedent = null; return; }
              if (lien.attrs.href !== precedent) {
                const ic = icone(Number(lien.attrs.href.slice(5)));
                if (ic?.image) {
                  decos.push(Decoration.inline(pos, pos + node.nodeSize, { class: 'lien-page lien-page-img', style: `--lien-img:url("${ic.image}")` }));
                } else if (ic?.emoji) {
                  decos.push(Decoration.inline(pos, pos + node.nodeSize, { class: 'lien-page', 'data-icone': ic.emoji }));
                }
              }
              precedent = lien.attrs.href;
            });
            return DecorationSet.create(state.doc, decos);
          },
        },
      }),
    ];
  },
});
