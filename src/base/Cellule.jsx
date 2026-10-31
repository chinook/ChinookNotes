import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

// Une pastille colorée : la valeur d'une option, avec une croix pour la retirer en multi-sélection
function Pastille({ opt, onRetirer }) {
  return (
    <span className="pastille" style={styleOption(opt)}>
      {opt.nom}
      {onRetirer && <button className="pastille-x" onClick={(e) => { e.stopPropagation(); onRetirer(); }} title="Retirer">×</button>}
    </span>
  );
}

// Liste des options d'une colonne : même style que les autres panneaux de l'app, au lieu de la liste native du système.
// Affichée par-dessus la page (position fixe) pour que le tableau ne la coupe pas. Clavier : ↑ ↓, Entrée, Échap.
// choisies : ids déjà choisis (null = « Aucune ») ; multiple : la liste reste ouverte pour cocher plusieurs options.
function MenuOptions({ ancre, options, choisies, multiple, onChoisir, onFermer }) {
  const menu = useRef(null);
  const entrees = multiple ? options : [{ id: null, nom: 'Aucune' }, ...options];
  const [survol, setSurvol] = useState(() => Math.max(0, entrees.findIndex((o) => choisies.includes(o.id))));

  const r = ancre.getBoundingClientRect();
  const hauteur = Math.min(280, entrees.length * 32 + 14);
  const enHaut = window.innerHeight - r.bottom < hauteur + 8 && r.top > window.innerHeight - r.bottom;
  const style = {
    left: Math.max(8, Math.min(r.left, window.innerWidth - 220)),
    minWidth: Math.max(r.width, 180),
    ...(enHaut ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
  };

  useEffect(() => {
    const dehors = (e) => { if (!menu.current?.contains(e.target) && !ancre.contains(e.target)) onFermer(); };
    const defile = (e) => { if (!menu.current?.contains(e.target)) onFermer(); };
    const touche = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onFermer(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setSurvol((i) => Math.min(entrees.length - 1, i + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSurvol((i) => Math.max(0, i - 1)); }
      else if (e.key === 'Enter' && entrees[survol]) { e.preventDefault(); onChoisir(entrees[survol].id); }
    };
    document.addEventListener('mousedown', dehors);
    document.addEventListener('keydown', touche);
    window.addEventListener('scroll', defile, true);
    window.addEventListener('resize', onFermer);
    return () => {
      document.removeEventListener('mousedown', dehors);
      document.removeEventListener('keydown', touche);
      window.removeEventListener('scroll', defile, true);
      window.removeEventListener('resize', onFermer);
    };
  });

  return createPortal(
    <div className="menu-options" ref={menu} style={style} role="listbox">
      {entrees.map((o, i) => (
        <button
          key={o.id ?? 'aucune'}
          role="option"
          aria-selected={choisies.includes(o.id)}
          className={'menu-option' + (i === survol ? ' actif' : '')}
          onMouseEnter={() => setSurvol(i)}
          onClick={() => onChoisir(o.id)}
        >
          {o.id === null ? <span className="cell-vide">— Aucune</span> : <Pastille opt={o} />}
          {choisies.includes(o.id) && <span className="coche">✓</span>}
        </button>
      ))}
    </div>,
    document.body,
  );
}

function CelluleSelection({ col, options, valeur, onChange }) {
  const [ouvert, setOuvert] = useState(false);
  const ancre = useRef(null);
  const choisie = options.find((o) => o.id === valeur);
  return (
    <>
      <div
        className="cell-select"
        ref={ancre}
        role="button"
        tabIndex={0}
        aria-label={col.nom}
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        onClick={() => setOuvert((o) => !o)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOuvert(true); } }}
      >
        {choisie ? <Pastille opt={choisie} /> : <span className="cell-vide">—</span>}
      </div>
      {ouvert && (
        <MenuOptions
          ancre={ancre.current}
          options={options}
          choisies={[valeur ?? null]}
          multiple={false}
          onChoisir={(id) => { onChange(id); setOuvert(false); }}
          onFermer={() => setOuvert(false)}
        />
      )}
    </>
  );
}

function CelluleMulti({ col, options, valeur, onChange }) {
  const [ouvert, setOuvert] = useState(false);
  const ancre = useRef(null);
  const choisies = Array.isArray(valeur) ? valeur : [];
  return (
    <>
      <div className="cell-multi" ref={ancre}>
        {choisies.map((id) => {
          const opt = options.find((o) => o.id === id);
          return opt && <Pastille key={id} opt={opt} onRetirer={() => onChange(choisies.filter((x) => x !== id))} />;
        })}
        {options.length > 0 && (
          <button className="cell-ajout" onClick={() => setOuvert((o) => !o)} aria-haspopup="listbox" aria-expanded={ouvert} title={`Ajouter à ${col.nom}`}>+</button>
        )}
      </div>
      {ouvert && (
        <MenuOptions
          ancre={ancre.current}
          options={options}
          choisies={choisies}
          multiple
          onChoisir={(id) => onChange(choisies.includes(id) ? choisies.filter((x) => x !== id) : [...choisies, id])}
          onFermer={() => setOuvert(false)}
        />
      )}
    </>
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
    case 'select':
      return <CelluleSelection col={col} options={options} valeur={valeur} onChange={onChange} />;
    case 'multiselect':
      return <CelluleMulti col={col} options={options} valeur={valeur} onChange={onChange} />;
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
