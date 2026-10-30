import Popover from './Popover.jsx';
import { COLONNE_NOM, OPERATEURS, colonnesFiltrables, nbFiltres, optionsDe, regleParDefaut, sansValeur } from './types.js';

// Plusieurs règles sur la même vue, combinées par « et » (toutes) ou « ou » (au moins une).
// Les règles sont enregistrées dans le schéma de la base : elles suivent la vue.
export default function Filtres({ schema, onChange }) {
  const regles = schema.filtres?.regles || [];
  const logique = schema.filtres?.logique || 'et';
  const colonnes = colonnesFiltrables(schema);
  const n = nbFiltres(schema);

  const enregistrer = (nouvelles, log = logique) => onChange({ logique: log, regles: nouvelles });
  const majRegle = (id, champs) => enregistrer(regles.map((r) => (r.id === id ? { ...r, ...champs } : r)));
  const colonneDe = (id) => (id === 'titre' ? COLONNE_NOM : schema.colonnes.find((c) => c.id === id));

  function changerColonne(regle, colId) {
    const col = colonneDe(colId);
    majRegle(regle.id, { col: colId, op: OPERATEURS[col.type][0][0], valeur: '' });
  }

  function champValeur(regle, col) {
    if (sansValeur(regle.op)) return null;
    if (col.type === 'select' || col.type === 'multiselect') {
      return (
        <select className="filtre-champ" value={regle.valeur ?? ''} onChange={(e) => majRegle(regle.id, { valeur: e.target.value })}>
          <option value="">— choisir —</option>
          {optionsDe(col).map((o) => <option key={o.id} value={o.id}>{o.nom}</option>)}
        </select>
      );
    }
    const type = col.type === 'date' ? 'date' : col.type === 'nombre' ? 'number' : 'text';
    return <input className="filtre-champ" type={type} value={regle.valeur ?? ''} placeholder="Valeur" onChange={(e) => majRegle(regle.id, { valeur: e.target.value })} />;
  }

  return (
    <Popover bouton={<>⏷ Filtres{n > 0 ? ` (${n})` : ''}</>} titre="Filtrer les lignes" actif={n > 0}>
      <div className="filtres">
        {regles.length === 0 && <p className="aide">Aucun filtre. Ajoute des règles pour ne voir que les lignes utiles.</p>}
        {regles.map((r, i) => {
          const col = colonneDe(r.col) ?? COLONNE_NOM;
          return (
            <div key={r.id} className="filtre-ligne">
              {i === 0 ? (
                <span className="filtre-lien">Où</span>
              ) : (
                <select className="filtre-lien" value={logique} onChange={(e) => enregistrer(regles, e.target.value)} title="Combiner les règles">
                  <option value="et">et</option>
                  <option value="ou">ou</option>
                </select>
              )}
              <select className="filtre-champ" value={r.col} onChange={(e) => changerColonne(r, e.target.value)}>
                {colonnes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
              <select className="filtre-champ" value={r.op} onChange={(e) => majRegle(r.id, { op: e.target.value })}>
                {OPERATEURS[col.type].map(([id, libelle]) => <option key={id} value={id}>{libelle}</option>)}
              </select>
              {champValeur(r, col)}
              <button className="filtre-suppr" title="Retirer ce filtre" onClick={() => enregistrer(regles.filter((x) => x.id !== r.id))}>×</button>
            </div>
          );
        })}
        <div className="filtres-pied">
          <button className="lien-bouton" onClick={() => enregistrer([...regles, regleParDefaut(schema)])}>+ Ajouter un filtre</button>
          {regles.length > 0 && <button className="lien-bouton" onClick={() => enregistrer([])}>Tout effacer</button>}
        </div>
      </div>
    </Popover>
  );
}
