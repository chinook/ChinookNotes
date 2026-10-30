import { useState } from 'react';
import { Pastille } from './Cellule.jsx';
import { TYPES, optionsDe, texteValeur } from './types.js';

// Les autres propriétés non vides, affichées sous le titre de la carte
function Proprietes({ schema, ligne, groupeCol }) {
  // les longs textes (description, solution…) restent dans la page de la ligne
  const court = (c) => {
    const t = texteValeur(c, ligne.valeurs[c.id]);
    return !['texte', 'url'].includes(c.type) || (t.length <= 40 && !t.includes('\n'));
  };
  const cachees = schema.masquees || [];
  const autres = schema.colonnes.filter((c) => c.id !== groupeCol.id && !cachees.includes(c.id) && texteValeur(c, ligne.valeurs[c.id]) !== '' && c.type !== 'case' && court(c));
  if (autres.length === 0) return null;
  return (
    <div className="carte-props">
      {autres.slice(0, 4).map((c) => {
        const v = ligne.valeurs[c.id];
        if (c.type === 'select') {
          const o = optionsDe(c).find((x) => x.id === v);
          return o && <Pastille key={c.id} opt={o} />;
        }
        if (c.type === 'multiselect') {
          return v.map((id) => { const o = optionsDe(c).find((x) => x.id === id); return o && <Pastille key={`${c.id}${id}`} opt={o} />; });
        }
        return <span key={c.id} className="carte-prop">{TYPES.find((t) => t.id === c.type)?.icone} {texteValeur(c, v)}</span>;
      })}
    </div>
  );
}

export default function Kanban({ schema, lignes, groupeCol, actions }) {
  const [glisse, setGlisse] = useState(null);   // id de la ligne en cours de déplacement
  const [survol, setSurvol] = useState(null);   // id de l'option survolée, ou '' pour « sans valeur »

  const colonnes = [
    ...optionsDe(groupeCol).map((o) => ({ cle: o.id, opt: o })),
    { cle: '', opt: null },
  ];
  const dans = (cle) => lignes.filter((l) => (l.valeurs[groupeCol.id] ?? '') === cle);

  function deposer(cle) {
    const ligne = lignes.find((l) => l.id === glisse);
    setGlisse(null);
    setSurvol(null);
    if (ligne && (ligne.valeurs[groupeCol.id] ?? '') !== cle) actions.majValeur(ligne, groupeCol.id, cle || null);
  }

  return (
    <div className="kanban">
      {colonnes.map(({ cle, opt }) => {
        const cartes = dans(cle);
        if (!opt && cartes.length === 0 && glisse == null) return null; // « sans valeur » seulement si utile
        return (
          <div
            key={cle || 'vide'}
            className={'kanban-colonne' + (survol === cle ? ' survol' : '')}
            onDragOver={(e) => { if (glisse != null) { e.preventDefault(); if (survol !== cle) setSurvol(cle); } }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setSurvol((s) => (s === cle ? null : s)); }}
            onDrop={(e) => { e.preventDefault(); deposer(cle); }}
          >
            <div className="kanban-entete">
              {opt ? <Pastille opt={opt} /> : <span className="cell-vide">Sans {groupeCol.nom.toLowerCase()}</span>}
              <span className="kanban-compte">{cartes.length}</span>
            </div>
            <div className="kanban-cartes">
              {cartes.map((l) => (
                <div
                  key={l.id}
                  className={'kanban-carte' + (glisse === l.id ? ' glisse' : '')}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(l.id)); setGlisse(l.id); }}
                  onDragEnd={() => { setGlisse(null); setSurvol(null); }}
                  onClick={() => actions.ouvrir(l.id)}
                  onContextMenu={(e) => { e.preventDefault(); actions.menu(l, null); }}
                >
                  <div className="carte-titre">{l.titre || 'Sans titre'}</div>
                  <Proprietes schema={schema} ligne={l} groupeCol={groupeCol} />
                </div>
              ))}
            </div>
            <button className="kanban-ajout" onClick={() => actions.creerLigne(cle ? { [groupeCol.id]: cle } : {})}>+ Nouvelle</button>
          </div>
        );
      })}
    </div>
  );
}
