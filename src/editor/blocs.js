// Blocs ciblés par le clic droit dans l'éditeur : retrouver le bloc sous le curseur, puis agir dessus.

// Un bloc qui en contient d'autres : un clic dans son texte désigne le bloc entier
const CONTENEURS = new Set(['listItem', 'taskItem', 'callout', 'blockquote', 'details', 'table']);
const FEUILLES = new Set(['paragraph', 'heading', 'codeBlock', 'image', 'horizontalRule', 'blockMath']);
const TRANSFORMABLES = new Set(['paragraph', 'heading', 'listItem', 'taskItem']);

// Retourne { type, node, from, to, position, transformable } ou null
export function trouverBloc(editor, left, top) {
  const { view, state } = editor;
  const hit = view.posAtCoords({ left, top });
  if (!hit) return null;
  const doc = state.doc;

  // image, séparateur ou équation : le nœud lui-même
  if (hit.inside >= 0) {
    const n = doc.nodeAt(hit.inside);
    if (n && n.isAtom && !n.isText && FEUILLES.has(n.type.name)) {
      return { type: n.type.name, node: n, from: hit.inside, to: hit.inside + n.nodeSize, position: hit.pos, transformable: false };
    }
  }

  const $pos = doc.resolve(hit.pos);
  let choisi = null;
  for (let d = $pos.depth; d >= 1 && !choisi; d--) {
    if (CONTENEURS.has($pos.node(d).type.name)) choisi = d;
  }
  for (let d = $pos.depth; d >= 1 && !choisi; d--) {
    if (FEUILLES.has($pos.node(d).type.name)) choisi = d;
  }
  if (!choisi) return null;
  const node = $pos.node(choisi);
  return {
    type: node.type.name,
    node,
    from: $pos.before(choisi),
    to: $pos.after(choisi),
    position: hit.pos,
    transformable: TRANSFORMABLES.has(node.type.name),
  };
}

// Une liste ou un tableau ne peut pas rester vide : si le bloc est le seul enfant de son parent,
// on supprime aussi le parent.
function supprimerBloc(editor, bloc) {
  let { from, to } = bloc;
  const doc = editor.state.doc;
  const $from = doc.resolve(from);
  for (let d = $from.depth; d > 0 && $from.node(d).childCount === 1; d--) {
    from = $from.before(d);
    to = $from.after(d);
  }
  if (from <= 0 && to >= doc.content.size) editor.chain().focus().clearContent(true).run();
  else editor.chain().focus().deleteRange({ from, to }).run();
}

// 25 %, 50 % ou 100 % de la largeur d'origine de l'image (celle du fichier, en pixels)
function redimensionnerImage(editor, bloc, pourcent) {
  const img = editor.view.nodeDOM(bloc.from);
  const origine = img?.naturalWidth || bloc.node.attrs.width;
  if (!origine) return;
  editor.chain().focus().setNodeSelection(bloc.from)
    .updateAttributes('image', { width: Math.round((origine * pourcent) / 100), height: null }).run();
}

const TRANSFORMER = {
  texte: (c) => c,
  h1: (c) => c.setHeading({ level: 1 }),
  h2: (c) => c.setHeading({ level: 2 }),
  h3: (c) => c.setHeading({ level: 3 }),
  puces: (c) => c.toggleBulletList(),
  numerotee: (c) => c.toggleOrderedList(),
  taches: (c) => c.toggleTaskList(),
  citation: (c) => c.toggleBlockquote(),
  callout: (c) => c.basculerCallout(),
  code: (c) => c.setCodeBlock(),
};

export function executerAction(editor, choix, bloc) {
  if (choix === 'dupliquer-bloc') {
    editor.chain().focus().insertContentAt(bloc.to, bloc.node.toJSON()).run();
  } else if (choix === 'supprimer-bloc') {
    supprimerBloc(editor, bloc);
  } else if (choix?.startsWith('img-')) {
    redimensionnerImage(editor, bloc, Number(choix.slice(4)));
  } else if (TRANSFORMER[choix]) {
    // on repart d'un paragraphe simple (hors liste, citation…) avant d'appliquer le nouveau type
    editor.chain().focus().setTextSelection(bloc.position).run();
    TRANSFORMER[choix](editor.chain().focus().clearNodes()).run();
  }
}
