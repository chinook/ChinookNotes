import { useEffect, useState } from 'react';
import { useEditorState } from '@tiptap/react';
import { NodeSelection } from '@tiptap/pm/state';
import { MOD } from '../plateforme.js';

function Bouton({ titre, actif, onClick, children }) {
  return (
    <button type="button" className={'tb' + (actif ? ' actif' : '')} title={titre} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      {children}
    </button>
  );
}

// Petite barre d'outils flottante au-dessus du texte sélectionné : mise en forme et type de bloc.
// Elle attend que la souris soit relâchée, pour ne pas gêner pendant qu'on sélectionne.
export default function BulleSelection({ editor }) {
  const [souris, setSouris] = useState(false);

  useEffect(() => {
    const dom = editor.view.dom;
    const enfoncee = () => setSouris(true);
    const relachee = () => setSouris(false);
    dom.addEventListener('mousedown', enfoncee);
    window.addEventListener('mouseup', relachee);
    return () => {
      dom.removeEventListener('mousedown', enfoncee);
      window.removeEventListener('mouseup', relachee);
    };
  }, [editor]);

  const etat = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const { selection } = e.state;
      return {
        visible: !selection.empty && !(selection instanceof NodeSelection) && e.isFocused && e.isEditable && !e.isActive('codeBlock'),
        from: selection.from,
        to: selection.to,
        gras: e.isActive('bold'),
        italique: e.isActive('italic'),
        souligne: e.isActive('underline'),
        barre: e.isActive('strike'),
        code: e.isActive('code'),
        h1: e.isActive('heading', { level: 1 }),
        h2: e.isActive('heading', { level: 2 }),
        h3: e.isActive('heading', { level: 3 }),
        puces: e.isActive('bulletList'),
        numerotee: e.isActive('orderedList'),
        taches: e.isActive('taskList'),
        citation: e.isActive('blockquote'),
        callout: e.isActive('callout'),
        toggle: e.isActive('details'),
      };
    },
  });

  if (!etat.visible || souris) return null;

  let debut;
  let fin;
  try {
    debut = editor.view.coordsAtPos(etat.from);
    fin = editor.view.coordsAtPos(etat.to);
  } catch {
    return null;
  }
  const haut = Math.min(debut.top, fin.top);
  const enDessous = haut < 60; // pas de place au-dessus : sous la sélection
  const style = {
    left: Math.max(240, Math.min((debut.left + fin.right) / 2, window.innerWidth - 240)),
    top: enDessous ? Math.max(debut.bottom, fin.bottom) + 8 : haut - 8,
    transform: enDessous ? 'translateX(-50%)' : 'translate(-50%, -100%)',
  };

  const c = () => editor.chain().focus();
  return (
    <div className="bulle-selection" style={style} onMouseDown={(e) => e.preventDefault()}>
      <Bouton titre={`Gras (${MOD}+B)`} actif={etat.gras} onClick={() => c().toggleBold().run()}><b>B</b></Bouton>
      <Bouton titre={`Italique (${MOD}+I)`} actif={etat.italique} onClick={() => c().toggleItalic().run()}><i>I</i></Bouton>
      <Bouton titre={`Souligné (${MOD}+U)`} actif={etat.souligne} onClick={() => c().toggleUnderline().run()}><u>U</u></Bouton>
      <Bouton titre="Barré" actif={etat.barre} onClick={() => c().toggleStrike().run()}><s>S</s></Bouton>
      <Bouton titre="Code en ligne" actif={etat.code} onClick={() => c().toggleCode().run()}>{'</>'}</Bouton>
      <span className="sep" />
      <Bouton titre="Texte normal" onClick={() => c().setParagraph().run()}>T</Bouton>
      <Bouton titre="Titre 1" actif={etat.h1} onClick={() => c().toggleHeading({ level: 1 }).run()}>H1</Bouton>
      <Bouton titre="Titre 2" actif={etat.h2} onClick={() => c().toggleHeading({ level: 2 }).run()}>H2</Bouton>
      <Bouton titre="Titre 3" actif={etat.h3} onClick={() => c().toggleHeading({ level: 3 }).run()}>H3</Bouton>
      <span className="sep" />
      <Bouton titre="Liste à puces" actif={etat.puces} onClick={() => c().toggleBulletList().run()}>•</Bouton>
      <Bouton titre="Liste numérotée" actif={etat.numerotee} onClick={() => c().toggleOrderedList().run()}>1.</Bouton>
      <Bouton titre="Liste de tâches" actif={etat.taches} onClick={() => c().toggleTaskList().run()}>☑</Bouton>
      <Bouton titre="Citation" actif={etat.citation} onClick={() => c().toggleBlockquote().run()}>❝</Bouton>
      <Bouton titre="Callout" actif={etat.callout} onClick={() => c().basculerCallout().run()}>💡</Bouton>
      <Bouton titre="Section repliable (toggle)" actif={etat.toggle} onClick={() => c().setDetails().run()}>▸</Bouton>
      <Bouton titre="Bloc de code" onClick={() => c().toggleCodeBlock().run()}>{'{ }'}</Bouton>
    </div>
  );
}
