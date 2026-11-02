import { useEffect, useState } from 'react';
import Icone from './emoji/Icone.jsx';

const formaterDate = (iso) => new Date(iso).toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' });

// onChange : recharger la liste des pages après une restauration
export default function Corbeille({ onChange, onFermer }) {
  const [elements, setElements] = useState(null);

  const charger = () => window.api.listeCorbeille().then(setElements);
  useEffect(() => { charger(); }, []);

  async function restaurer(e) {
    await window.api.restaurerPage(e.id);
    await charger();
    onChange(e.id);
  }

  async function supprimer(e) {
    if (!window.confirm(`Supprimer définitivement « ${e.titre || 'Sans titre'} » ? Cette action est irréversible.`)) return;
    await window.api.supprimerPage(e.id);
    charger();
  }

  async function vider() {
    if (!window.confirm('Vider la corbeille ? Les pages seront supprimées définitivement.')) return;
    await window.api.viderCorbeille();
    charger();
  }

  return (
    <div className="dialogue-fond" onMouseDown={onFermer}>
      <div className="dialogue dialogue-modeles" onMouseDown={(e) => e.stopPropagation()}>
        <strong>🗑️ Corbeille</strong>
        {elements === null ? null : elements.length === 0 ? (
          <p className="aide">La corbeille est vide.</p>
        ) : (
          <div className="corbeille-liste">
            {elements.map((e) => (
              <div key={e.id} className="corbeille-ligne">
                <Icone valeur={e.icone} defaut={e.type === 'base' ? '🗃️' : '📄'} className="icone" />
                <div className="corbeille-nom">
                  <div>{e.titre || 'Sans titre'}</div>
                  <div className="aide">
                    Supprimée le {formaterDate(e.corbeille_le)}
                    {e.sous_pages > 0 && ` · avec ${e.sous_pages} sous-page${e.sous_pages > 1 ? 's' : ''}`}
                  </div>
                </div>
                <button onClick={() => restaurer(e)}>↩ Restaurer</button>
                <button onClick={() => supprimer(e)} title="Supprimer définitivement">🗑️</button>
              </div>
            ))}
          </div>
        )}
        <div className="dialogue-boutons">
          {elements?.length > 0 && <button onClick={vider}>Vider la corbeille</button>}
          <span style={{ flex: 1 }} />
          <button className="primaire" onClick={onFermer}>Fermer</button>
        </div>
      </div>
    </div>
  );
}
