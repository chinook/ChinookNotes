import { useState } from 'react';

// Petites barres au bord droit de la page : une par titre, plus longue pour un titre que pour un sous-titre.
// Au survol, la liste des titres s'affiche (comme la minimap de VS Code) ; cliquer va au titre.
// titres : [{ pos, level, texte }] ; actif : indice du titre de la section affichée.
export default function Sommaire({ titres, actif, onAller }) {
  const [survol, setSurvol] = useState(false);
  const hauteur = Math.max(5, Math.min(12, Math.floor(260 / titres.length))); // se resserre quand il y a beaucoup de titres
  const niveau = (t) => Math.min(t.level, 4);

  return (
    <div className="sommaire" onMouseEnter={() => setSurvol(true)} onMouseLeave={() => setSurvol(false)}>
      {survol && (
        <div className="sommaire-liste">
          {titres.map((t, i) => (
            <button
              key={t.pos}
              className={`sommaire-titre niveau-${niveau(t)}` + (i === actif ? ' actif' : '')}
              onClick={() => onAller(t.pos)}
              title={t.texte}
            >
              {t.texte}
            </button>
          ))}
        </div>
      )}
      <div className="sommaire-barres">
        {titres.map((t, i) => (
          <button
            key={t.pos}
            className={`sommaire-barre niveau-${niveau(t)}` + (i === actif ? ' actif' : '')}
            style={{ height: hauteur }}
            onClick={() => onAller(t.pos)}
            aria-label={t.texte}
          >
            <span />
          </button>
        ))}
      </div>
    </div>
  );
}
