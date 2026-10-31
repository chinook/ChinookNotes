import Popover from './Popover.jsx';
import { COLONNE_NOM, OPERATEURS, colonnesFiltrables, nbFiltres, nouvelId, optionsDe, regleParDefaut, sansValeur, trisValides } from './types.js';

// Deux sections dans le même panneau :
// - Filtres : plusieurs règles combinées par « et » (toutes) ou « ou » (au moins une) ;
// - Tri : plusieurs critères par ordre de priorité, chacun croissant ou décroissant.
// Tout est enregistré dans le schéma de la base : filtres et tris suivent la vue.
export default function Filtres({ schema, onChange, onTris }) {
  const regles = schema.filtres?.regles || [];
  const logique = schema.filtres?.logique || 'et';
  const colonnes = colonnesFiltrables(schema);
  const n = nbFiltres(schema);
  const tris = trisValides(schema);
  const total = n + tris.length;

  const majTri = (id, champs) => onTris(tris.map((t) => (t.id === id ? { ...t, ...champs } : t)));
  const deplacerTri = (i, sens) => {
    const copie = [...tris];
    [copie[i], copie[i + sens]] = [copie[i + sens], copie[i]];
    onTris(copie);
  };
  const colonnesLibres = colonnes.filter((c) => !tris.some((t) => t.col === c.id));

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
    <Popover bouton={<>⏷ Filtres et tri{total > 0 ? ` (${total})` : ''}</>} titre="Filtrer et trier les lignes" actif={total > 0}>
      <div className="filtres">
        <div className="titre-section">Filtres</div>
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
          {regles.length > 0 && <button className="lien-bouton" onClick={() => enregistrer([])}>Effacer les filtres</button>}
        </div>

        <div className="titre-section filtres-sep">Tri</div>
        {tris.length === 0 && <p className="aide">Aucun tri. Ajoute un critère pour ordonner les lignes.</p>}
        {tris.length > 1 && <p className="aide">Les lignes suivent le 1er critère ; en cas d'égalité, le 2e, et ainsi de suite. Les flèches changent la priorité.</p>}
        {tris.map((t, i) => (
          <div key={t.id} className="filtre-ligne">
            <span className="filtre-lien tri-rang" title={`Priorité ${i + 1}`}>{i === 0 ? 'Trier' : 'puis'}</span>
            <select className="filtre-champ" value={t.col} onChange={(e) => majTri(t.id, { col: e.target.value })}>
              {colonnes.filter((c) => c.id === t.col || !tris.some((x) => x.col === c.id)).map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
            <select className="filtre-champ tri-sens" value={t.sens} onChange={(e) => majTri(t.id, { sens: Number(e.target.value) })}>
              <option value={1}>↑ Croissant</option>
              <option value={-1}>↓ Décroissant</option>
            </select>
            <button className="filtre-suppr" disabled={i === 0} title="Priorité plus haute" onClick={() => deplacerTri(i, -1)}>▲</button>
            <button className="filtre-suppr" disabled={i === tris.length - 1} title="Priorité plus basse" onClick={() => deplacerTri(i, 1)}>▼</button>
            <button className="filtre-suppr" title="Retirer ce tri" onClick={() => onTris(tris.filter((x) => x.id !== t.id))}>×</button>
          </div>
        ))}
        <div className="filtres-pied">
          <button className="lien-bouton" disabled={colonnesLibres.length === 0} onClick={() => onTris([...tris, { id: nouvelId(), col: colonnesLibres[0].id, sens: 1 }])}>+ Ajouter un tri</button>
          {tris.length > 0 && <button className="lien-bouton" onClick={() => onTris([])}>Effacer les tris</button>}
        </div>
      </div>
    </Popover>
  );
}
