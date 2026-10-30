import { useEffect } from 'react';
import PageView from './PageView.jsx';

// Volet de droite (« side peek ») : la page d'une ligne de base, sans quitter le tableau.
// Le bord gauche se saisit pour changer sa largeur.
export default function ApercuPage({ id, pages, largeur, onLargeurFin, onChange, onEmojisChange, onOuvrirPage, onFermer }) {
  const meta = pages.find((p) => p.id === id);
  const baseParente = pages.find((p) => p.id === meta?.parent_id && p.type === 'base') ?? null;

  // Échap referme le volet
  useEffect(() => {
    const touche = (e) => { if (e.key === 'Escape' && !document.querySelector('.dialogue-fond')) onFermer(); };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, [onFermer]);

  function redimensionner(e) {
    e.preventDefault();
    const volet = e.currentTarget.parentElement;
    let derniere = volet.offsetWidth;
    const bouge = (ev) => {
      derniere = Math.max(320, Math.min(window.innerWidth - 300, window.innerWidth - ev.clientX));
      volet.style.width = `${derniere}px`;
    };
    const fin = () => {
      window.removeEventListener('mousemove', bouge);
      window.removeEventListener('mouseup', fin);
      document.body.classList.remove('redimensionnement');
      onLargeurFin(derniere);
    };
    document.body.classList.add('redimensionnement');
    window.addEventListener('mousemove', bouge);
    window.addEventListener('mouseup', fin);
  }

  if (!meta) return null;

  return (
    <aside className="apercu" style={{ width: largeur }}>
      <div className="apercu-poignee" onMouseDown={redimensionner} title="Glisser pour changer la largeur" />
      <div className="apercu-entete">
        <button onClick={() => onOuvrirPage(id)} title="Ouvrir cette page en plein écran">↗ Ouvrir en pleine page</button>
        <span style={{ flex: 1 }} />
        <button onClick={onFermer} title="Fermer (Échap)">✕</button>
      </div>
      <div className="apercu-corps">
        <PageView
          id={id}
          chemin={[]}
          meta={meta}
          lignes={[]}
          baseParente={baseParente}
          onSelect={onOuvrirPage}
          onChange={onChange}
          onEmojisChange={onEmojisChange}
          apercu
        />
      </div>
    </aside>
  );
}
