import Cellule from './Cellule.jsx';
import { TYPES, lireProprietes, lireSchema } from './types.js';

// Affichée au-dessus du contenu d'une page qui est une ligne de base de données
export default function ProprietesLigne({ base, proprietes, onChange }) {
  const schema = lireSchema(base.schema);
  const valeurs = lireProprietes(proprietes);
  if (schema.colonnes.length === 0) return null;

  function majValeur(colId, valeur) {
    const suivantes = { ...valeurs };
    if (valeur === null || valeur === undefined) delete suivantes[colId]; else suivantes[colId] = valeur;
    onChange(JSON.stringify(suivantes));
  }

  return (
    <div className="proprietes-ligne">
      {schema.colonnes.map((c) => (
        <div key={c.id} className="propriete">
          <span className="propriete-nom"><span className="th-icone">{TYPES.find((t) => t.id === c.type)?.icone}</span> {c.nom}</span>
          <div className="propriete-valeur"><Cellule col={c} valeur={valeurs[c.id]} panneau onChange={(v) => majValeur(c.id, v)} /></div>
        </div>
      ))}
    </div>
  );
}
