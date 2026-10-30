import { useEffect, useState } from 'react';
import { MODELES_BASES, MODELES_INTEGRES } from './integres.js';
import Icone from '../emoji/Icone.jsx';

const VIDE = { id: 'vide', nom: 'Page vide', description: 'Partir de zéro', icone: '📄', titrePage: '', contenu: { type: 'doc', content: [] } };

// pageCourante : { id, titre } ou null — permet de choisir entre la racine et une sous-page
export default function SelecteurModele({ pageCourante, parentInitial, onChoisir, onFermer }) {
  const [perso, setPerso] = useState([]);
  const [parentId, setParentId] = useState(parentInitial ?? null);

  const recharger = () => window.api.listeModeles().then(setPerso);
  useEffect(() => { recharger(); }, []);

  async function supprimer(e, modele) {
    e.stopPropagation();
    if (!window.confirm(`Supprimer le modèle « ${modele.nom} » ?`)) return;
    await window.api.supprimerModele(modele.id);
    recharger();
  }

  const carte = (m, perso = false) => (
    <div key={`${perso ? 'p' : 'i'}${m.id}`} className="carte-modele" onClick={() => onChoisir(m, parentId)}>
      <div className="carte-modele-icone"><Icone valeur={m.icone} /></div>
      <div className="carte-modele-nom">{m.nom}</div>
      {m.description && <div className="carte-modele-desc">{m.description}</div>}
      {perso && <button className="carte-modele-suppr" title="Supprimer ce modèle" onClick={(e) => supprimer(e, m)}>×</button>}
    </div>
  );

  return (
    <div className="dialogue-fond" onMouseDown={onFermer}>
      <div className="dialogue dialogue-modeles" onMouseDown={(e) => e.stopPropagation()}>
        <strong>Nouvelle page depuis un modèle</strong>

        {pageCourante && (
          <label className="emplacement">
            Emplacement
            <select value={parentId ?? ''} onChange={(e) => setParentId(e.target.value === '' ? null : Number(e.target.value))}>
              <option value="">À la racine</option>
              <option value={pageCourante.id}>Dans « {pageCourante.titre || 'Sans titre'} »</option>
            </select>
          </label>
        )}

        <div className="grille-modeles">
          {carte(VIDE)}
          {MODELES_INTEGRES.map((m) => carte(m))}
        </div>

        <div className="titre-section">Bases de données</div>
        <div className="grille-modeles">{MODELES_BASES.map((m) => carte(m))}</div>

        {perso.length > 0 && (
          <>
            <div className="titre-section">Mes modèles</div>
            <div className="grille-modeles">{perso.map((m) => carte({ ...m, titrePage: m.nom }, true))}</div>
          </>
        )}

        <p className="aide">Astuce : « Enregistrer comme modèle » sur une page crée un modèle à vous.</p>
        <div className="dialogue-boutons">
          <span style={{ flex: 1 }} />
          <button onClick={onFermer}>Annuler</button>
        </div>
      </div>
    </div>
  );
}
