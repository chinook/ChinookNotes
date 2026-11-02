import { useEffect, useRef, useState } from 'react';
import logo from '../build/icon.png';

const MENUS = [
  { nom: 'Fichier', entrees: [{ label: 'Quitter', action: 'quitter' }] },
  {
    nom: 'Édition',
    entrees: [
      { label: 'Couper', action: 'couper' },
      { label: 'Copier', action: 'copier' },
      { label: 'Coller', action: 'coller' },
      { label: 'Tout sélectionner', action: 'tout-selectionner' },
    ],
  },
  {
    nom: 'Affichage',
    entrees: [
      { label: 'Recharger', action: 'recharger' },
      { label: 'Plein écran', action: 'plein-ecran' },
      { label: 'Outils de développement', action: 'outils' },
    ],
  },
];

// Barre du haut de la fenêtre : titre + menus aux couleurs du thème.
// Les boutons réduire / agrandir / fermer sont ceux de Windows (colorés par le processus principal).
export default function BarreTitre({ theme }) {
  const [ouvert, setOuvert] = useState(null);
  const racine = useRef(null);

  useEffect(() => {
    document.documentElement.dataset.plateforme = window.api.plateforme;
    window.api.themeFenetre(theme);
  }, [theme]);

  useEffect(() => {
    if (ouvert === null) return undefined;
    const ferme = (e) => { if (!racine.current?.contains(e.target)) setOuvert(null); };
    window.addEventListener('mousedown', ferme);
    return () => window.removeEventListener('mousedown', ferme);
  }, [ouvert]);

  function lancer(action) {
    setOuvert(null);
    window.api.actionFenetre(action);
  }

  // Mac : barre de titre et menu natifs
  if (window.api.plateforme === 'darwin') return null;

  return (
    <div className="barre-titre" ref={racine}>
      <img className="barre-titre-logo" src={logo} alt="ChinookNotes" draggable="false" />
      <nav className="barre-menus">
        {MENUS.map((m) => (
          <div key={m.nom} className="barre-menu">
            <button
              className={ouvert === m.nom ? 'actif' : ''}
              onClick={() => setOuvert(ouvert === m.nom ? null : m.nom)}
              onMouseEnter={() => { if (ouvert !== null) setOuvert(m.nom); }}
            >{m.nom}</button>
            {ouvert === m.nom && (
              <div className="barre-menu-liste">
                {m.entrees.map((e) => (
                  <button key={e.action} onClick={() => lancer(e.action)}>{e.label}</button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
    </div>
  );
}
