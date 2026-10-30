import { useState } from 'react';
import { COULEURS, TYPES, nouvelId, option, styleOption } from './types.js';

// Création (colonne = null) ou modification d'une colonne
export default function ColonneDialog({ colonne, onValider, onSupprimer, onFermer }) {
  const [nom, setNom] = useState(colonne?.nom ?? '');
  const [type, setType] = useState(colonne?.type ?? 'texte');
  const [options, setOptions] = useState(colonne?.options ?? []);
  const aDesOptions = type === 'select' || type === 'multiselect';

  const majOption = (id, champs) => setOptions((o) => o.map((x) => (x.id === id ? { ...x, ...champs } : x)));
  const suivante = (couleur) => COULEURS[(COULEURS.findIndex((c) => c.id === couleur) + 1) % COULEURS.length].id;

  function valider() {
    if (!nom.trim()) return;
    const propre = options.filter((o) => o.nom.trim());
    onValider({
      id: colonne?.id ?? nouvelId(),
      nom: nom.trim(),
      type,
      ...(aDesOptions ? { options: propre } : {}),
    });
  }

  return (
    <div className="dialogue-fond" onMouseDown={onFermer}>
      <div className="dialogue dialogue-large" onMouseDown={(e) => e.stopPropagation()}>
        <strong>{colonne ? 'Modifier la colonne' : 'Nouvelle colonne'}</strong>
        <input
          className="champ"
          autoFocus
          value={nom}
          placeholder="Nom de la colonne"
          onChange={(e) => setNom(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !aDesOptions) valider(); if (e.key === 'Escape') onFermer(); }}
        />
        <label className="emplacement">
          Type
          <select value={type} disabled={!!colonne} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => <option key={t.id} value={t.id}>{t.icone} {t.nom}</option>)}
          </select>
          {colonne && <span className="aide">Le type ne se change pas après la création.</span>}
        </label>

        {aDesOptions && (
          <div className="options-editeur">
            <div className="titre-section">Options</div>
            {options.map((o) => (
              <div key={o.id} className="option-ligne">
                <button
                  className="option-couleur"
                  style={styleOption(o)}
                  title="Changer la couleur"
                  onClick={() => majOption(o.id, { couleur: suivante(o.couleur) })}
                />
                <input className="champ" value={o.nom} placeholder="Nom de l'option" onChange={(e) => majOption(o.id, { nom: e.target.value })} />
                <button className="option-suppr" title="Retirer l'option" onClick={() => setOptions((x) => x.filter((y) => y.id !== o.id))}>×</button>
              </div>
            ))}
            <button className="lien-bouton" onClick={() => setOptions((x) => [...x, option('', COULEURS[x.length % COULEURS.length].id)])}>+ Ajouter une option</button>
          </div>
        )}

        <div className="dialogue-boutons">
          {colonne && <button onClick={onSupprimer}>Supprimer la colonne</button>}
          <span style={{ flex: 1 }} />
          <button onClick={onFermer}>Annuler</button>
          <button className="primaire" onClick={valider} disabled={!nom.trim()}>{colonne ? 'Enregistrer' : 'Ajouter'}</button>
        </div>
      </div>
    </div>
  );
}
