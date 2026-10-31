import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import 'katex/dist/katex.min.css';
import { creerExtensions, lireContenu } from './extensions.js';
import { cleRecherche } from './rechercheDansPage.js';
import Toolbar from './Toolbar.jsx';
import { executerAction, executerEdition, trouverBloc } from './blocs.js';
import BulleSelection from './BulleSelection.jsx';
import { menuEditeur } from '../menus.js';
import { EmojisContext, estImagePerso } from '../emoji/Icone.jsx';
import { PagesContext } from '../pagesContext.js';
import Sommaire from './Sommaire.jsx';

// Titres et sous-titres de la page, dans l'ordre : le sommaire s'en sert
function listerTitres(doc) {
  const titres = [];
  doc.descendants((n, pos) => {
    if (n.type.name === 'heading' && n.textContent.trim()) titres.push({ pos, level: n.attrs.level, texte: n.textContent.trim() });
  });
  return titres;
}

// Le conteneur qui défile autour d'un élément (le volet), pour suivre la section affichée
function trouverDefilement(el) {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if (o === 'auto' || o === 'scroll') return p;
  }
  return null;
}

function lireImage(fichier) {
  return new Promise((resolve) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(lecteur.result);
    lecteur.readAsDataURL(fichier);
  });
}

export default function Editor({ contenu, onChange, onNavigate, chercher = false, sommaire = false }) {
  const [mathEdition, setMathEdition] = useState(null);
  const [titreActif, setTitreActif] = useState(0);
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const editeurRef = useRef(null);
  const champRechercheRef = useRef(null);
  const pages = useContext(PagesContext);
  const emojis = useContext(EmojisContext);

  // Icône affichée à gauche d'un lien vers une page ; relue à chaque rendu pour suivre les changements d'icône
  const iconeLienRef = useRef(null);
  iconeLienRef.current = (id) => {
    const p = pages[id];
    if (!p) return null;
    if (estImagePerso(p.icone)) {
      const image = emojis[p.icone.slice(6)]?.image;
      if (image) return { image };
    }
    return { emoji: (!estImagePerso(p.icone) && p.icone) || (p.type === 'base' ? '🗃️' : '📄') };
  };

  const extensions = useMemo(
    () => creerExtensions({
      onMathClick: (type, latex, pos) => setMathEdition({ type, latex, pos }),
      iconeLien: (id) => iconeLienRef.current(id),
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

  const recherche = useEditorState({
    editor,
    selector: ({ editor: e }) => (e ? cleRecherche.getState(e.state) : null),
  });

  const titres = useEditorState({
    editor,
    selector: ({ editor: e }) => (e ? listerTitres(e.state.doc) : []),
  });

  // Section affichée : le dernier titre déjà passé en haut du volet (sous la barre collée)
  useEffect(() => {
    if (!editor || !sommaire) return undefined;
    const zone = trouverDefilement(editor.view.dom);
    if (!zone) return undefined;
    let image = 0;
    const calculer = () => {
      image = 0;
      const limite = zone.getBoundingClientRect().top + 90;
      let courant = 0;
      titres.forEach((t, i) => {
        try {
          const el = editor.view.nodeDOM(t.pos);
          if (el?.getBoundingClientRect && el.getBoundingClientRect().top <= limite) courant = i;
        } catch { /* le document a changé entre-temps : le prochain calcul corrigera */ }
      });
      setTitreActif(courant);
    };
    const surDefile = () => { if (!image) image = requestAnimationFrame(calculer); };
    calculer();
    zone.addEventListener('scroll', surDefile, { passive: true });
    window.addEventListener('resize', surDefile);
    return () => {
      cancelAnimationFrame(image);
      zone.removeEventListener('scroll', surDefile);
      window.removeEventListener('resize', surDefile);
    };
  }, [editor, titres, sommaire]);

  function allerAuTitre(pos) {
    editor.view.nodeDOM(pos)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Un lien dont l'icône ou la page a changé se redessine par une transaction sans effet sur le contenu
  useEffect(() => {
    editor?.view.dispatch(editor.state.tr.setMeta('liensPages', true));
  }, [editor, pages, emojis]);

  function ouvrirRecherche() {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    const choisi = empty ? '' : editor.state.doc.textBetween(from, to, ' ');
    setRechercheOuverte(true);
    if (choisi && choisi.length <= 80) chercherMot(choisi);
    requestAnimationFrame(() => { champRechercheRef.current?.focus(); champRechercheRef.current?.select(); });
  }

  function chercherMot(mot) {
    editor.view.dispatch(editor.state.tr.setMeta(cleRecherche, { requete: mot }));
  }

  function fermerRecherche() {
    chercherMot('');
    setRechercheOuverte(false);
    editor.commands.focus();
  }

  function occurrenceSuivante(sens) {
    const { trouves, index } = cleRecherche.getState(editor.state);
    if (trouves.length === 0) return;
    editor.view.dispatch(editor.state.tr.setMeta(cleRecherche, { index: index + sens }));
  }

  // Ctrl+F (ou Cmd+F) ouvre la recherche dans la page, où que soit le curseur
  useEffect(() => {
    if (!chercher) return undefined;
    const surTouche = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        ouvrirRecherche();
      }
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  });

  // L'occurrence courante reste visible
  useEffect(() => {
    if (!rechercheOuverte) return;
    editor?.view.dom.querySelector('.recherche-courant')?.scrollIntoView({ block: 'center' });
  }, [rechercheOuverte, recherche?.requete, recherche?.index]);

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
    const choix = await window.api.menuContextuel(menuEditeur(bloc, {
      aSelection: !editor.state.selection.empty,
      formats: {
        gras: editor.isActive('bold'),
        italique: editor.isActive('italic'),
        souligne: editor.isActive('underline'),
        barre: editor.isActive('strike'),
        code: editor.isActive('code'),
      },
      dansTableau: editor.isActive('table'),
    }));
    if (!choix) return;
    if (choix === 'ins-image') choisirImages();
    else if (!executerEdition(editor, choix) && bloc) executerAction(editor, choix, bloc);
  }

  // « Insérer → Image… » du clic droit : le même choix de fichiers que le bouton de la barre d'outils
  function choisirImages() {
    const champ = document.createElement('input');
    champ.type = 'file';
    champ.accept = 'image/*';
    champ.multiple = true;
    champ.onchange = () => insererImages([...champ.files]);
    champ.click();
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
      {sommaire && titres.length >= 2 && <Sommaire titres={titres} actif={titreActif} onAller={allerAuTitre} />}
      {rechercheOuverte && (
        <div className="barre-recherche">
          <input
            ref={champRechercheRef}
            value={recherche.requete}
            placeholder="Chercher dans la page"
            onChange={(e) => chercherMot(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); occurrenceSuivante(e.shiftKey ? -1 : 1); }
              if (e.key === 'Escape') { e.preventDefault(); fermerRecherche(); }
            }}
          />
          <span className="recherche-compte">
            {recherche.requete ? (recherche.trouves.length ? `${recherche.index + 1} / ${recherche.trouves.length}` : '0 résultat') : ''}
          </span>
          <button onClick={() => occurrenceSuivante(-1)} title="Précédent (Maj + Entrée)">↑</button>
          <button onClick={() => occurrenceSuivante(1)} title="Suivant (Entrée)">↓</button>
          <button onClick={fermerRecherche} title="Fermer (Échap)">✕</button>
        </div>
      )}
      <BulleSelection editor={editor} />
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
