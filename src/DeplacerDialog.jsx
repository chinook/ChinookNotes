import { useMemo, useState } from 'react';
import Icone from './emoji/Icone.jsx';

// Choisir le nouveau parent d'une page. arbre : pages imbriquées (voir construireArbre dans App.jsx).
export default function DeplacerDialog({ arbre, page, onChoisir, onFermer }) {
  const [requete, setRequete] = useState('');

  // La page elle-même, ses sous-pages et les bases (qui n'accueillent que leurs lignes) sont exclues
  const lignes = useMemo(() => {
    const res = [];
    const parcourir = (liste, niveau, parentValide) => {
      for (const p of liste) {
        if (p.id === page.id) continue;
        if (p.type !== 'base') res.push({ page: p, niveau });
        parcourir(p.enfants, niveau + 1);
      }
    };
    parcourir(arbre, 0);
    const q = requete.trim().toLowerCase();
    return q ? res.filter((l) => (l.page.titre || '').toLowerCase().includes(q)) : res;
  }, [arbre, page.id, requete]);

  return (
    <div className="dialogue-fond" onMouseDown={onFermer}>
      <div className="dialogue emoji-picker" onMouseDown={(e) => e.stopPropagation()}>
        <strong>Déplacer « {page.titre || 'Sans titre'} » vers…</strong>
        <input
          className="champ"
          autoFocus
          value={requete}
          placeholder="Rechercher une page…"
          onChange={(e) => setRequete(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') onFermer(); }}
        />
        <div className="emoji-corps">
          {!requete && (
            <button className="deplacer-ligne" onClick={() => onChoisir(null)}>
              <span className="icone">🏠</span> À la racine
            </button>
          )}
          {lignes.map(({ page: p, niveau }) => (
            <button
              key={p.id}
              className="deplacer-ligne"
              style={{ paddingLeft: 8 + (requete ? 0 : niveau * 16) }}
              disabled={p.id === page.parent_id}
              title={p.id === page.parent_id ? 'Déjà sous cette page' : 'Devenir une sous-page de celle-ci'}
              onClick={() => onChoisir(p.id)}
            >
              <Icone valeur={p.icone} className="icone" /> {p.titre || 'Sans titre'}
            </button>
          ))}
          {lignes.length === 0 && requete && <p className="aide">Aucune page ne correspond.</p>}
        </div>
        <div className="dialogue-boutons">
          <span style={{ flex: 1 }} />
          <button onClick={onFermer}>Annuler</button>
        </div>
      </div>
    </div>
  );
}
