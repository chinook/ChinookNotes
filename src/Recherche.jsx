import { useEffect, useRef, useState } from 'react';
import Icone from './emoji/Icone.jsx';

const DELAI = 120;

// Les mots trouvés sont entourés des caractères de contrôle 1 et 2 par SQLite
function Extrait({ texte }) {
  const parties = texte.split(/(\u0001[^\u0002]*\u0002)/);
  return (
    <>
      {parties.map((p, i) => (p.startsWith('\u0001')
        ? <mark key={i}>{p.slice(1, -1)}</mark>
        : <span key={i}>{p}</span>))}
    </>
  );
}

export default function Recherche({ pages, onChoisir, onFermer }) {
  const [requete, setRequete] = useState('');
  const [resultats, setResultats] = useState([]);
  const [actif, setActif] = useState(0);
  const dernier = useRef(0);
  const liste = useRef(null);

  useEffect(() => {
    const numero = ++dernier.current;
    const minuterie = setTimeout(async () => {
      const r = requete.trim()
        ? await window.api.rechercher(requete)
        : await window.api.pagesRecentes();
      if (numero !== dernier.current) return; // une frappe plus récente a pris le relais
      setResultats(r);
      setActif(0);
    }, requete ? DELAI : 0);
    return () => clearTimeout(minuterie);
  }, [requete]);

  useEffect(() => {
    liste.current?.children[actif]?.scrollIntoView({ block: 'nearest' });
  }, [actif]);

  function chemin(page) {
    const res = [];
    let p = pages.find((x) => x.id === page.parent_id);
    while (p) {
      res.unshift(p.titre || 'Sans titre');
      p = pages.find((x) => x.id === p.parent_id);
    }
    return res.join(' / ');
  }

  function touche(e) {
    if (e.key === 'Escape') onFermer();
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActif((a) => Math.min(a + 1, resultats.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActif((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && resultats[actif]) onChoisir(resultats[actif].id);
  }

  return (
    <div className="dialogue-fond haut" onMouseDown={onFermer}>
      <div className="recherche" onMouseDown={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={requete}
          placeholder="Rechercher dans toutes les pages…"
          onChange={(e) => setRequete(e.target.value)}
          onKeyDown={touche}
        />
        {!requete.trim() && resultats.length > 0 && <div className="recherche-titre">Pages récentes</div>}
        <div className="recherche-liste" ref={liste}>
          {resultats.map((r, i) => (
            <div
              key={r.id}
              className={'resultat' + (i === actif ? ' actif' : '')}
              onMouseEnter={() => setActif(i)}
              onClick={() => onChoisir(r.id)}
            >
              <div className="resultat-titre">
                <Icone valeur={r.icone} className="icone" />
                <span>{r.titre || 'Sans titre'}</span>
                <span className="resultat-chemin">{chemin(r)}</span>
              </div>
              {r.extrait && <div className="resultat-extrait"><Extrait texte={r.extrait} /></div>}
            </div>
          ))}
          {requete.trim() && resultats.length === 0 && <div className="recherche-vide">Aucun résultat</div>}
        </div>
      </div>
    </div>
  );
}
