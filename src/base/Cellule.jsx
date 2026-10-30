import { useEffect, useState } from 'react';
import { optionsDe, styleOption } from './types.js';

// Champ texte qui n'enregistre qu'en quittant le champ ou avec Entrée
function ChampTexte({ valeur, onChange, type = 'text', placeholder, large }) {
  const [brouillon, setBrouillon] = useState(valeur ?? '');
  useEffect(() => { setBrouillon(valeur ?? ''); }, [valeur]);
  const valider = () => { if (brouillon !== (valeur ?? '')) onChange(brouillon); };
  // texte long (panneau d'une ligne) : plusieurs lignes, Entrée va à la ligne
  if (large) {
    return (
      <textarea
        className="cell-input cell-area"
        value={brouillon}
        placeholder={placeholder}
        onChange={(e) => setBrouillon(e.target.value)}
        onBlur={valider}
        onKeyDown={(e) => { if (e.key === 'Escape') { setBrouillon(valeur ?? ''); e.currentTarget.blur(); } }}
      />
    );
  }
  return (
    <input
      className="cell-input"
      type={type}
      value={brouillon}
      placeholder={placeholder}
      onChange={(e) => setBrouillon(e.target.value)}
      onBlur={valider}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setBrouillon(valeur ?? ''); e.currentTarget.blur(); } }}
    />
  );
}

// Une pastille colorée ; le <select> natif, transparent, se superpose pour choisir
function Pastille({ opt, onRetirer }) {
  return (
    <span className="pastille" style={styleOption(opt)}>
      {opt.nom}
      {onRetirer && <button className="pastille-x" onClick={(e) => { e.stopPropagation(); onRetirer(); }} title="Retirer">×</button>}
    </span>
  );
}

// panneau : affichée dans la page d'une ligne (assez de place pour du texte long)
export default function Cellule({ col, valeur, onChange, panneau = false }) {
  const options = optionsDe(col);

  switch (col.type) {
    case 'nombre':
      return (
        <ChampTexte
          valeur={valeur}
          placeholder="—"
          onChange={(t) => onChange(t.trim() === '' ? null : (Number.isNaN(Number(t.replace(',', '.'))) ? valeur : Number(t.replace(',', '.'))))}
        />
      );
    case 'date':
      return <input className="cell-input" type="date" value={valeur ?? ''} onChange={(e) => onChange(e.target.value || null)} />;
    case 'case':
      return <input className="cell-case" type="checkbox" checked={!!valeur} onChange={(e) => onChange(e.target.checked)} />;
    case 'select': {
      const choisie = options.find((o) => o.id === valeur);
      return (
        <div className="cell-select">
          {choisie ? <Pastille opt={choisie} /> : <span className="cell-vide">—</span>}
          <select value={valeur ?? ''} onChange={(e) => onChange(e.target.value || null)} aria-label={col.nom}>
            <option value="">—</option>
            {options.map((o) => <option key={o.id} value={o.id}>{o.nom}</option>)}
          </select>
        </div>
      );
    }
    case 'multiselect': {
      const choisies = Array.isArray(valeur) ? valeur : [];
      const restantes = options.filter((o) => !choisies.includes(o.id));
      return (
        <div className="cell-multi">
          {choisies.map((id) => {
            const opt = options.find((o) => o.id === id);
            return opt && <Pastille key={id} opt={opt} onRetirer={() => onChange(choisies.filter((x) => x !== id))} />;
          })}
          {restantes.length > 0 && (
            <span className="cell-ajout">
              +
              <select value="" onChange={(e) => e.target.value && onChange([...choisies, e.target.value])} aria-label={`Ajouter à ${col.nom}`}>
                <option value="">+</option>
                {restantes.map((o) => <option key={o.id} value={o.id}>{o.nom}</option>)}
              </select>
            </span>
          )}
        </div>
      );
    }
    case 'url':
      return <ChampTexte valeur={valeur} placeholder="https://…" onChange={(t) => onChange(t.trim() || null)} />;
    default:
      // un texte sur plusieurs lignes ne se modifie pas dans une cellule de table : il y perdrait ses sauts de ligne
      if (!panneau && typeof valeur === 'string' && valeur.includes('\n')) {
        return <div className="cell-lecture" title="Texte long : à modifier dans la page de la ligne">{valeur.split('\n')[0]}</div>;
      }
      return <ChampTexte valeur={valeur} placeholder="Vide" large={panneau} onChange={(t) => onChange(t || null)} />;
  }
}

export { Pastille };
