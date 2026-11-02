import { useRef } from 'react';

function Bouton({ editor, titre, actif, onClick, children, desactive }) {
  return (
    <button
      type="button"
      className={'tb' + (actif ? ' actif' : '')}
      title={titre}
      disabled={desactive}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function styleBloc(editor) {
  for (const n of [1, 2, 3]) {
    if (editor.isActive('heading', { level: n })) return `h${n}`;
  }
  return 'p';
}

export default function Toolbar({ editor, onImages }) {
  const fichier = useRef(null);
  const chaine = () => editor.chain().focus();
  const dansTableau = editor.isActive('table');

  function changerStyle(valeur) {
    if (valeur === 'p') chaine().setParagraph().run();
    else chaine().setHeading({ level: Number(valeur[1]) }).run();
  }

  return (
    <div className="toolbar">
      <select value={styleBloc(editor)} onChange={(e) => changerStyle(e.target.value)} title="Style du bloc">
        <option value="p">Texte</option>
        <option value="h1">Titre 1</option>
        <option value="h2">Titre 2</option>
        <option value="h3">Titre 3</option>
      </select>

      <span className="sep" />
      <Bouton titre="Gras (Ctrl+B)" actif={editor.isActive('bold')} onClick={() => chaine().toggleBold().run()}><b>B</b></Bouton>
      <Bouton titre="Italique (Ctrl+I)" actif={editor.isActive('italic')} onClick={() => chaine().toggleItalic().run()}><i>I</i></Bouton>
      <Bouton titre="Souligné (Ctrl+U)" actif={editor.isActive('underline')} onClick={() => chaine().toggleUnderline().run()}><u>U</u></Bouton>
      <Bouton titre="Barré" actif={editor.isActive('strike')} onClick={() => chaine().toggleStrike().run()}><s>S</s></Bouton>
      <Bouton titre="Code en ligne" actif={editor.isActive('code')} onClick={() => chaine().toggleCode().run()}>{'</>'}</Bouton>

      <span className="sep" />
      <Bouton titre="Liste à puces" actif={editor.isActive('bulletList')} onClick={() => chaine().toggleBulletList().run()}>• Liste</Bouton>
      <Bouton titre="Liste numérotée" actif={editor.isActive('orderedList')} onClick={() => chaine().toggleOrderedList().run()}>1. Liste</Bouton>
      <Bouton titre="Liste de tâches" actif={editor.isActive('taskList')} onClick={() => chaine().toggleTaskList().run()}>☑ Tâches</Bouton>

      <span className="sep" />
      <Bouton titre="Citation" actif={editor.isActive('blockquote')} onClick={() => chaine().toggleBlockquote().run()}>❝ Citation</Bouton>
      <Bouton titre="Callout" actif={editor.isActive('callout')} onClick={() => chaine().basculerCallout().run()}>💡 Callout</Bouton>
      <Bouton titre="Section repliable" actif={editor.isActive('details')} onClick={() => chaine().setDetails().run()}>▸ Toggle</Bouton>
      <Bouton titre="Séparateur" onClick={() => chaine().setHorizontalRule().run()}>—</Bouton>

      <span className="sep" />
      <Bouton titre="Bloc de code" actif={editor.isActive('codeBlock')} onClick={() => chaine().toggleCodeBlock().run()}>{'{ } Code'}</Bouton>
      <Bouton titre="Tableau" onClick={() => chaine().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>▦ Tableau</Bouton>
      <Bouton titre="Image (ou coller / glisser)" onClick={() => fichier.current?.click()}>🖼 Image</Bouton>
      <Bouton titre="Équation en bloc" onClick={() => chaine().insertBlockMath({ latex: 'E = mc^2' }).run()}>∑ Équation</Bouton>
      <Bouton titre="Équation en ligne" onClick={() => chaine().insertInlineMath({ latex: 'x^2' }).run()}>∑ en ligne</Bouton>
      <input
        ref={fichier}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => { onImages([...e.target.files]); e.target.value = ''; }}
      />

      {dansTableau && (
        <>
          <span className="sep" />
          <Bouton titre="Ajouter une ligne" onClick={() => chaine().addRowAfter().run()}>+ ligne</Bouton>
          <Bouton titre="Ajouter une colonne" onClick={() => chaine().addColumnAfter().run()}>+ colonne</Bouton>
          <Bouton titre="Supprimer la ligne" onClick={() => chaine().deleteRow().run()}>− ligne</Bouton>
          <Bouton titre="Supprimer la colonne" onClick={() => chaine().deleteColumn().run()}>− colonne</Bouton>
          <Bouton titre="Ligne d'en-tête" onClick={() => chaine().toggleHeaderRow().run()}>En-tête</Bouton>
          <Bouton titre="Supprimer le tableau" onClick={() => chaine().deleteTable().run()}>🗑️ Tableau</Bouton>
        </>
      )}
    </div>
  );
}
