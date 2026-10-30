import Popover from './Popover.jsx';
import { TYPES } from './types.js';

// Afficher / masquer des colonnes pour ne garder que les utiles (la colonne Nom reste toujours visible)
export default function ColonnesVisibles({ schema, onChange }) {
  const masquees = new Set(schema.masquees || []);
  const nbMasquees = schema.colonnes.filter((c) => masquees.has(c.id)).length;

  const basculer = (id) => {
    const suivantes = new Set(masquees);
    suivantes.has(id) ? suivantes.delete(id) : suivantes.add(id);
    onChange([...suivantes]);
  };

  return (
    <Popover bouton={<>👁 Colonnes{nbMasquees > 0 ? ` (${nbMasquees} masquée${nbMasquees > 1 ? 's' : ''})` : ''}</>} titre="Afficher ou masquer des colonnes" actif={nbMasquees > 0}>
      <div className="filtres">
        <label className="colonne-visible desactive"><input type="checkbox" checked disabled /> <span className="th-icone">Aa</span> Nom</label>
        {schema.colonnes.map((c) => (
          <label key={c.id} className="colonne-visible">
            <input type="checkbox" checked={!masquees.has(c.id)} onChange={() => basculer(c.id)} />
            <span className="th-icone">{TYPES.find((t) => t.id === c.type)?.icone}</span> {c.nom}
          </label>
        ))}
        <div className="filtres-pied">
          <button className="lien-bouton" onClick={() => onChange([])} disabled={nbMasquees === 0}>Tout afficher</button>
          <button className="lien-bouton" onClick={() => onChange(schema.colonnes.map((c) => c.id))}>Tout masquer</button>
        </div>
      </div>
    </Popover>
  );
}
