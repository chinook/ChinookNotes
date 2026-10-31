import { useMemo, useRef, useState } from 'react';
import Icone from './emoji/Icone.jsx';
import { TYPE_PAGE } from './volets.js';

const DELAI_DEPLIAGE = 600;

// Haut du nœud : avant · bas : après · milieu : devient une sous-page
function zoneDe(e) {
  const r = e.currentTarget.getBoundingClientRect();
  const y = (e.clientY - r.top) / r.height;
  if (y < 0.28) return 'avant';
  if (y > 0.72) return 'apres';
  return 'dans';
}

function Noeud({ page, niveau, courante, ouverts, renommageId, onSelect, onBasculer, onCreer, onSupprimer, onMenuPage, onRenommer, dnd }) {
  const ouvert = ouverts.has(page.id);
  const aEnfants = page.enfants.length > 0;
  const cible = dnd.cible?.id === page.id ? dnd.cible.zone : null;
  const enRenommage = renommageId === page.id;

  const classes = ['noeud'];
  if (courante === page.id) classes.push('actif');
  if (dnd.glisse === page.id) classes.push('glisse');
  if (cible) classes.push('cible-' + cible);

  return (
    <div>
      <div
        className={classes.join(' ')}
        style={{ paddingLeft: 8 + niveau * 14 }}
        draggable={!enRenommage}
        onClick={() => onSelect(page.id)}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onMenuPage(page); }}
        onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(page.id)); e.dataTransfer.setData(TYPE_PAGE, String(page.id)); dnd.debut(page.id); }}
        onDragOver={(e) => dnd.survol(e, page, zoneDe(e), ouvert, aEnfants)}
        onDragLeave={() => dnd.quitte(page.id)}
        onDrop={(e) => dnd.depot(e, page.id, zoneDe(e))}
        onDragEnd={dnd.fin}
      >
        <button
          className={'fleche' + (aEnfants ? '' : ' invisible')}
          onClick={(e) => { e.stopPropagation(); onBasculer(page.id); }}
          aria-label={ouvert ? 'Replier' : 'Déplier'}
        >
          {ouvert ? '▾' : '▸'}
        </button>
        <Icone valeur={page.icone} defaut={page.type === 'base' ? '🗃️' : '📄'} className="icone" />
        {enRenommage ? (
          <input
            className="renommer"
            autoFocus
            defaultValue={page.titre}
            onClick={(e) => e.stopPropagation()}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => onRenommer(page.id, e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') { e.currentTarget.value = page.titre; e.currentTarget.blur(); }
            }}
          />
        ) : (
          <span className="nom">{page.titre || 'Sans titre'}</span>
        )}
        <span className="actions">
          {page.type !== 'base' && <button title="Ajouter une sous-page" onClick={(e) => { e.stopPropagation(); onCreer(page.id); }}>+</button>}
          <button title="Déplacer dans la corbeille" onClick={(e) => { e.stopPropagation(); onSupprimer(page.id); }}>×</button>
        </span>
      </div>
      {ouvert && page.enfants.map((e) => (
        <Noeud
          key={e.id}
          page={e}
          niveau={niveau + 1}
          courante={courante}
          ouverts={ouverts}
          renommageId={renommageId}
          onSelect={onSelect}
          onBasculer={onBasculer}
          onCreer={onCreer}
          onSupprimer={onSupprimer}
          onMenuPage={onMenuPage}
          onRenommer={onRenommer}
          dnd={dnd}
        />
      ))}
    </div>
  );
}

export default function Sidebar({ arbre, courante, ouverts, largeur, avatar, renommageId, onSelect, onBasculer, onCreer, onSupprimer, onRechercher, onDeplacer, onDeplacerRacine, onMenuPage, onMenuVide, onRenommer, onProfil, onReglages, onLargeur, onLargeurFin, onCacher }) {
  const [glisse, setGlisse] = useState(null);
  const [cible, setCible] = useState(null);
  const minuterie = useRef(null);

  // Le bord droit de la barre se saisit à la souris (curseur « ↔ ») ; la largeur est retenue au relâchement
  function demarrerRedimensionnement(e) {
    e.preventDefault();
    let derniere = largeur;
    const bouge = (ev) => { derniere = Math.max(180, Math.min(520, ev.clientX)); onLargeur(derniere); };
    const fin = () => {
      window.removeEventListener('mousemove', bouge);
      window.removeEventListener('mouseup', fin);
      document.body.classList.remove('redimensionnement');
      onLargeurFin(derniere);
    };
    document.body.classList.add('redimensionnement');
    window.addEventListener('mousemove', bouge);
    window.addEventListener('mouseup', fin);
  }

  // parent de chaque page : sert à interdire de déposer une page dans sa propre descendance
  const parents = useMemo(() => {
    const m = new Map();
    const parcourir = (liste, parent) => liste.forEach((p) => { m.set(p.id, parent); parcourir(p.enfants, p.id); });
    parcourir(arbre, null);
    return m;
  }, [arbre]);

  const estBase = (id) => {
    const cherche = (liste) => liste.some((p) => (p.id === id ? p.type === 'base' : cherche(p.enfants)));
    return cherche(arbre);
  };

  const dansLuiMeme = (id, cibleId) => {
    for (let c = cibleId; c != null; c = parents.get(c)) if (c === id) return true;
    return false;
  };

  const annulerDepliage = () => { clearTimeout(minuterie.current); minuterie.current = null; };

  const dnd = {
    glisse,
    cible,
    debut: (id) => setGlisse(id),
    fin: () => { annulerDepliage(); setGlisse(null); setCible(null); },
    survol: (e, page, zone, ouvert, aEnfants) => {
      if (glisse == null || dansLuiMeme(glisse, page.id)) return; // dépôt refusé
      if (page.type === 'base' && zone === 'dans') return;          // une base n'accueille que ses lignes
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      if (cible?.id !== page.id || cible.zone !== zone) setCible({ id: page.id, zone });
      // Rester sur une page repliée la déplie, pour pouvoir viser ses sous-pages
      if (zone === 'dans' && aEnfants && !ouvert) {
        if (!minuterie.current) minuterie.current = setTimeout(() => { minuterie.current = null; onBasculer(page.id); }, DELAI_DEPLIAGE);
      } else {
        annulerDepliage();
      }
    },
    quitte: (id) => { annulerDepliage(); setCible((c) => (c?.id === id ? null : c)); },
    depot: (e, id, zone) => {
      if (glisse == null || dansLuiMeme(glisse, id)) return;
      if (zone === 'dans' && estBase(id)) return;
      e.preventDefault();
      e.stopPropagation();
      const deplace = glisse;
      dnd.fin();
      onDeplacer(deplace, id, zone);
    },
  };

  // Déposer dans le vide sous l'arbre : la page passe à la racine, en dernier
  const survolVide = (e) => {
    if (glisse == null || e.target !== e.currentTarget) return;
    e.preventDefault();
    setCible({ id: 'racine', zone: 'dans' });
  };
  const depotVide = (e) => {
    if (glisse == null || e.target !== e.currentTarget) return;
    e.preventDefault();
    const deplace = glisse;
    dnd.fin();
    onDeplacerRacine(deplace);
  };

  return (
    <aside className="sidebar" style={{ width: largeur }}>
      <div className="sidebar-poignee" onMouseDown={demarrerRedimensionnement} onDoubleClick={() => onLargeurFin(null)} title="Glisser pour changer la largeur (double-clic : largeur d'origine)" />
      <div className="sidebar-titre">
        <span>ChinookNotes</span>
        <button className="sidebar-cacher" onClick={onCacher} title="Cacher la barre latérale (Ctrl + \)">«</button>
      </div>
      <button className="sidebar-recherche" onClick={onRechercher}>
        <span>🔍 Rechercher</span>
        <kbd>Ctrl K</kbd>
      </button>
      <div
        className={'arbre' + (cible?.id === 'racine' ? ' cible-racine' : '')}
        onDragOver={survolVide}
        onContextMenu={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); onMenuVide(); } }}
        onDragLeave={(e) => { if (e.target === e.currentTarget) setCible(null); }}
        onDrop={depotVide}
      >
        {arbre.map((p) => (
          <Noeud
            key={p.id}
            page={p}
            niveau={0}
            courante={courante}
            ouverts={ouverts}
            renommageId={renommageId}
            onSelect={onSelect}
            onBasculer={onBasculer}
            onCreer={onCreer}
            onSupprimer={onSupprimer}
            onMenuPage={onMenuPage}
            onRenommer={onRenommer}
            dnd={dnd}
          />
        ))}
      </div>
      <div className="sidebar-pied">
        <button onClick={() => onCreer(null)}>+ Nouvelle page</button>
        <span className="pied-icones">
          <button className="pied-profil" onClick={onProfil} title="Profil"><Icone valeur={avatar} defaut="👤" /></button>
          <button onClick={onReglages} title="Réglages">⚙</button>
        </span>
      </div>
    </aside>
  );
}
