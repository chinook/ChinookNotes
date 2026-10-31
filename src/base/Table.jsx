import { useState } from 'react';
import Cellule from './Cellule.jsx';
import { COLONNE_NOM, TYPES, trisApresClic, trisValides } from './types.js';

const LARGEUR_NOM = 260;
const LARGEUR_COLONNE = 170;
const LARGEUR_MIN = 70;

// lignes : lignes à afficher (avec .valeurs et .masquee) ; actions : voir BaseView
export default function Table({ schema, lignes, actions }) {
  const [titreEdite, setTitreEdite] = useState(null);  // { id, valeur }
  const [largeursLive, setLargeursLive] = useState({}); // largeurs pendant un glissement
  const [glisse, setGlisse] = useState(null);           // colonne en cours de déplacement
  const [survol, setSurvol] = useState(null);           // colonne survolée pendant le déplacement

  const masquees = new Set(schema.masquees || []);
  const visibles = schema.colonnes.filter((c) => !masquees.has(c.id));
  const largeur = (id) => largeursLive[id] ?? schema.largeurs?.[id] ?? (id === 'titre' ? LARGEUR_NOM : LARGEUR_COLONNE);
  const total = largeur('titre') + visibles.reduce((n, c) => n + largeur(c.id), 0) + 34 + 30;

  // Clic : trier cette colonne seule ; Maj + clic : l'ajouter aux critères de tri (voir le panneau « Filtres et tri »)
  const cycleTri = (col, e) => actions.majSchema({ ...schema, tris: trisApresClic(trisValides(schema), col, e.shiftKey) });

  // Le bord droit d'un en-tête se saisit pour changer la largeur de la colonne
  function redimensionner(e, id) {
    e.preventDefault();
    e.stopPropagation();
    const depart = e.clientX;
    const initiale = largeur(id);
    let derniere = initiale;
    const bouge = (ev) => {
      derniere = Math.max(LARGEUR_MIN, Math.round(initiale + (ev.clientX - depart)));
      setLargeursLive((l) => ({ ...l, [id]: derniere }));
    };
    const fin = () => {
      window.removeEventListener('mousemove', bouge);
      window.removeEventListener('mouseup', fin);
      document.body.classList.remove('redimensionnement');
      setLargeursLive({});
      if (derniere !== initiale) actions.majSchema({ ...schema, largeurs: { ...(schema.largeurs || {}), [id]: derniere } });
    };
    document.body.classList.add('redimensionnement');
    window.addEventListener('mousemove', bouge);
    window.addEventListener('mouseup', fin);
  }

  // Déplacer une colonne en la glissant sur une autre
  function deposer(cibleId) {
    const source = glisse;
    setGlisse(null);
    setSurvol(null);
    if (!source || source === cibleId) return;
    const colonnes = schema.colonnes.filter((c) => c.id !== source);
    const idx = colonnes.findIndex((c) => c.id === cibleId);
    colonnes.splice(idx, 0, schema.colonnes.find((c) => c.id === source));
    actions.majSchema({ ...schema, colonnes });
  }

  // Flèche du tri, suivie du rang quand il y a plusieurs critères (↑1, ↓2…)
  const tris = trisValides(schema);
  const flecheTri = (id) => {
    const i = tris.findIndex((t) => t.col === id);
    return i < 0 ? '' : ` ${tris[i].sens === 1 ? '↑' : '↓'}${tris.length > 1 ? i + 1 : ''}`;
  };
  const sommes = (c) => (c.type === 'nombre'
    ? lignes.reduce((n, l) => n + (typeof l.valeurs[c.id] === 'number' ? l.valeurs[c.id] : 0), 0)
    : null);

  const poignee = (id) => <span className="col-poignee" onMouseDown={(e) => redimensionner(e, id)} title="Glisser pour changer la largeur" />;

  return (
    <div className="base-table-zone">
      <table className="base-table" style={{ width: total }}>
        <colgroup>
          <col style={{ width: largeur('titre') }} />
          {visibles.map((c) => <col key={c.id} style={{ width: largeur(c.id) }} />)}
          <col style={{ width: 34 }} />
          <col style={{ width: 30 }} />
        </colgroup>
        <thead>
          <tr>
            <th className="th-titre" onContextMenu={(e) => { e.preventDefault(); actions.menu(null, COLONNE_NOM); }}>
              <div className="th-contenu">
                <button className="th-nom" onClick={(e) => cycleTri('titre', e)} title="Trier (Maj + clic : ajouter un niveau de tri)">
                  <span className="th-icone">Aa</span> Nom{flecheTri('titre')}
                </button>
              </div>
              {poignee('titre')}
            </th>
            {visibles.map((c) => (
              <th
                key={c.id}
                className={survol === c.id && glisse !== c.id ? 'cible-colonne' : ''}
                draggable
                onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', c.id); setGlisse(c.id); }}
                onDragOver={(e) => { if (glisse) { e.preventDefault(); if (survol !== c.id) setSurvol(c.id); } }}
                onDragLeave={() => setSurvol((s) => (s === c.id ? null : s))}
                onDrop={(e) => { e.preventDefault(); deposer(c.id); }}
                onDragEnd={() => { setGlisse(null); setSurvol(null); }}
                onContextMenu={(e) => { e.preventDefault(); actions.menu(null, c); }}
              >
                <div className="th-contenu">
                  <button className="th-nom" onClick={(e) => cycleTri(c.id, e)} title="Trier (Maj + clic : ajouter un niveau de tri ; glisser pour déplacer la colonne)">
                    <span className="th-icone">{TYPES.find((t) => t.id === c.type)?.icone}</span> {c.nom}{flecheTri(c.id)}
                  </button>
                  <button className="th-menu" onClick={() => actions.modifierColonne(c)} title="Modifier la colonne">⋯</button>
                </div>
                {poignee(c.id)}
              </th>
            ))}
            <th className="th-ajout"><button onClick={actions.nouvelleColonne} title="Ajouter une colonne">+</button></th>
            <th className="th-vide" />
          </tr>
        </thead>
        <tbody>
          {lignes.map((l) => (
            <tr key={l.id} className={l.masquee ? 'ligne-masquee' : ''}>
              <td className="td-titre" onContextMenu={(e) => { e.preventDefault(); actions.menu(l, COLONNE_NOM); }}>
                <input
                  className="cell-input cell-titre"
                  value={titreEdite?.id === l.id ? titreEdite.valeur : (l.titre || '')}
                  placeholder="Sans titre"
                  onFocus={() => setTitreEdite({ id: l.id, valeur: l.titre || '' })}
                  onChange={(e) => setTitreEdite({ id: l.id, valeur: e.target.value })}
                  onBlur={() => {
                    if (titreEdite && titreEdite.valeur !== (l.titre || '')) actions.majLigne(l, { titre: titreEdite.valeur });
                    setTitreEdite(null);
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                />
                <button className="ligne-ouvrir" onClick={() => actions.ouvrir(l.id)} title="Ouvrir la page dans un volet à droite">↗ Ouvrir</button>
              </td>
              {visibles.map((c) => (
                <td key={c.id} onContextMenu={(e) => { e.preventDefault(); actions.menu(l, c); }}>
                  <Cellule col={c} valeur={l.valeurs[c.id]} onChange={(v) => actions.majValeur(l, c.id, v)} />
                </td>
              ))}
              <td className="td-vide" />
              <td className="td-actions">
                <button className="ligne-suppr" onClick={() => actions.supprimerLigne(l)} title="Déplacer la ligne dans la corbeille">×</button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="pied-total">{lignes.length} ligne{lignes.length > 1 ? 's' : ''}</td>
            {visibles.map((c) => {
              const somme = sommes(c);
              return <td key={c.id} className="pied-total">{somme !== null ? `Σ ${Math.round(somme * 100) / 100}` : ''}</td>;
            })}
            <td className="pied-total" /><td className="pied-total" />
          </tr>
        </tfoot>
      </table>
      <button className="base-nouvelle-ligne" onClick={() => actions.creerLigne({})}>+ Nouvelle ligne</button>
    </div>
  );
}
