import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import 'katex/dist/katex.min.css';
import { creerExtensions, lireContenu } from './extensions.js';
import Toolbar from './Toolbar.jsx';
import { executerAction, trouverBloc } from './blocs.js';
import { menuEditeur } from '../menus.js';

function lireImage(fichier) {
  return new Promise((resolve) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(lecteur.result);
    lecteur.readAsDataURL(fichier);
  });
}

export default function Editor({ contenu, onChange, onNavigate }) {
  const [mathEdition, setMathEdition] = useState(null);
  const editeurRef = useRef(null);

  const extensions = useMemo(
    () => creerExtensions({
      onMathClick: (type, latex, pos) => setMathEdition({ type, latex, pos }),
    }),
    [],
  );

  async function insererImages(fichiers) {
    for (const f of fichiers) {
      const src = await lireImage(f);
      editeurRef.current?.chain().focus().setImage({ src, alt: f.name }).run();
    }
  }

  const editor = useEditor({
    extensions,
    content: lireContenu(contenu),
    onUpdate: ({ editor: e }) => onChange(JSON.stringify(e.getJSON())),
    editorProps: {
      handlePaste: (view, event) => {
        const images = [...(event.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
        if (images.length === 0) return false;
        insererImages(images);
        return true;
      },
      handleDrop: (view, event) => {
        const images = [...(event.dataTransfer?.files || [])].filter((f) => f.type.startsWith('image/'));
        if (images.length === 0) return false;
        event.preventDefault();
        insererImages(images);
        return true;
      },
    },
  });

  useEffect(() => { editeurRef.current = editor; }, [editor]);

  // Redessine la barre d'outils quand la sélection change
  useEditorState({
    editor,
    selector: ({ editor: e }) => e?.state.selection,
  });

  if (!editor) return null;

  // Lien vers une autre page (page:ID) ou vers le web
  function ouvrirLien(e) {
    const lien = e.target.closest?.('a[href]');
    if (!lien) return;
    e.preventDefault();
    const href = lien.getAttribute('href');
    if (href.startsWith('page:')) onNavigate(Number(href.slice(5)));
  }

  // Clic droit : couper / copier / coller, puis des actions sur le bloc sous le curseur
  async function menuContextuel(e) {
    e.preventDefault();
    const { from, to } = editor.state.selection;
    const hit = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
    // un clic droit en dehors de la sélection déplace le curseur à cet endroit
    if (hit && (hit.pos < from || hit.pos > to)) {
      try { editor.chain().focus().setTextSelection(hit.pos).run(); } catch { /* nœud sans texte : on garde la sélection */ }
    }
    const bloc = trouverBloc(editor, e.clientX, e.clientY);
    const choix = await window.api.menuContextuel(menuEditeur(bloc, { aSelection: !editor.state.selection.empty }));
    if (choix && bloc) executerAction(editor, choix, bloc);
  }

  function validerMath(latex) {
    const { type, pos } = mathEdition;
    const chaine = editor.chain().focus();
    if (type === 'block') chaine.updateBlockMath({ latex, pos }).run();
    else chaine.updateInlineMath({ latex, pos }).run();
    setMathEdition(null);
  }

  function supprimerMath() {
    const { type, pos } = mathEdition;
    const chaine = editor.chain().focus();
    if (type === 'block') chaine.deleteBlockMath({ pos }).run();
    else chaine.deleteInlineMath({ pos }).run();
    setMathEdition(null);
  }

  return (
    <div className="editeur">
      <Toolbar editor={editor} onImages={insererImages} />
      <div onClick={ouvrirLien} onContextMenu={menuContextuel}>
        <EditorContent editor={editor} className="editeur-contenu" />
      </div>
      {mathEdition && (
        <DialogueMath
          initial={mathEdition.latex}
          onValider={validerMath}
          onSupprimer={supprimerMath}
          onAnnuler={() => setMathEdition(null)}
        />
      )}
    </div>
  );
}

function DialogueMath({ initial, onValider, onSupprimer, onAnnuler }) {
  const [latex, setLatex] = useState(initial);
  return (
    <div className="dialogue-fond" onMouseDown={onAnnuler}>
      <div className="dialogue" onMouseDown={(e) => e.stopPropagation()}>
        <label>Équation (LaTeX)</label>
        <textarea
          autoFocus
          value={latex}
          onChange={(e) => setLatex(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onAnnuler();
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onValider(latex);
          }}
        />
        <div className="dialogue-boutons">
          <button onClick={onSupprimer}>Supprimer</button>
          <span style={{ flex: 1 }} />
          <button onClick={onAnnuler}>Annuler</button>
          <button className="primaire" onClick={() => onValider(latex)}>OK</button>
        </div>
      </div>
    </div>
  );
}
