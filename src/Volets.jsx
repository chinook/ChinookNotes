import { Fragment, useContext, useEffect, useState } from 'react';
import Icone from './emoji/Icone.jsx';
import { PagesContext } from './pagesContext.js';
import { TYPE_PAGE } from './volets.js';

// Zone visée par une page glissée : près d'un bord, elle coupe le volet de ce côté ; au milieu, elle le remplace
function zoneDe(e) {
  const r = e.currentTarget.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width;
  const y = (e.clientY - r.top) / r.height;
  const [zone, distance] = Object.entries({ gauche: x, droite: 1 - x, haut: y, bas: 1 - y }).sort((a, b) => a[1] - b[1])[0];
  return distance > 0.3 ? 'centre' : zone;
}

const estPage = (e) => Array.from(e.dataTransfer?.types ?? []).includes(TYPE_PAGE);

function Feuille({ volet, seul, actif, glisse, cible, setCible, rendre, onActiver, onFermer, onDepot }) {
  const pages = useContext(PagesContext);
  const meta = pages[volet.pageId];

  return (
    <div
      className={'volet' + (actif ? ' actif' : '')}
      onMouseDownCapture={() => onActiver(volet.id)}
      onFocusCapture={() => onActiver(volet.id)}
    >
      {!seul && (
        <div className="volet-entete">
          <Icone valeur={meta?.icone} defaut={meta?.type === 'base' ? '🗃️' : '📄'} className="icone" />
          <span className="volet-titre">{meta?.titre || 'Sans titre'}</span>
          <button className="volet-fermer" onClick={() => onFermer(volet.id)} title="Fermer ce volet">✕</button>
        </div>
      )}
      <div className="volet-corps">{rendre(volet, actif)}</div>
      {glisse && (
        <div
          className="volet-depot"
          onDragOver={(e) => {
            if (!estPage(e)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const zone = zoneDe(e);
            setCible((c) => (c?.voletId === volet.id && c.zone === zone ? c : { voletId: volet.id, zone }));
          }}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget)) return;
            setCible((c) => (c?.voletId === volet.id ? null : c));
          }}
          onDrop={(e) => {
            if (!estPage(e)) return;
            e.preventDefault();
            const pageId = Number(e.dataTransfer.getData(TYPE_PAGE));
            const zone = zoneDe(e);
            setCible(null);
            onDepot(volet.id, zone, pageId);
          }}
        >
          {cible?.voletId === volet.id && <div className={'volet-depot-zone ' + cible.zone} />}
        </div>
      )}
    </div>
  );
}

function Scission({ scission, rendreNoeud, onTailles }) {
  const enColonne = scission.sens === 'colonne';

  // Le séparateur se saisit à la souris ; les tailles sont retenues au relâchement
  function redimensionner(e, i) {
    e.preventDefault();
    const cellules = e.currentTarget.parentElement.querySelectorAll(':scope > .scission-cellule');
    const a = cellules[i - 1];
    const b = cellules[i];
    const tailleA = enColonne ? a.offsetHeight : a.offsetWidth;
    const total = tailleA + (enColonne ? b.offsetHeight : b.offsetWidth);
    const somme = scission.tailles[i - 1] + scission.tailles[i];
    const depart = enColonne ? e.clientY : e.clientX;
    let part = scission.tailles[i - 1] / somme;
    const classe = enColonne ? 'redimensionnement-v' : 'redimensionnement';
    const bouge = (ev) => {
      part = Math.max(0.15, Math.min(0.85, (tailleA + (enColonne ? ev.clientY : ev.clientX) - depart) / total));
      a.style.flexGrow = part * somme;
      b.style.flexGrow = (1 - part) * somme;
    };
    const fin = () => {
      window.removeEventListener('mousemove', bouge);
      window.removeEventListener('mouseup', fin);
      document.body.classList.remove(classe);
      const tailles = [...scission.tailles];
      tailles[i - 1] = part * somme;
      tailles[i] = (1 - part) * somme;
      onTailles(scission.id, tailles);
    };
    document.body.classList.add(classe);
    window.addEventListener('mousemove', bouge);
    window.addEventListener('mouseup', fin);
  }

  return (
    <div className={'scission ' + scission.sens}>
      {scission.enfants.map((enfant, i) => (
        <Fragment key={enfant.id}>
          {i > 0 && <div className="separateur" onMouseDown={(e) => redimensionner(e, i)} />}
          <div className="scission-cellule" style={{ flex: `${scission.tailles[i]} 1 0` }}>{rendreNoeud(enfant)}</div>
        </Fragment>
      ))}
    </div>
  );
}

// Toute la zone de contenu : une page seule (comme avant) ou plusieurs volets. Une page glissée depuis la barre
// latérale peut être déposée près d'un bord d'un volet pour le couper, ou au milieu pour remplacer sa page.
export default function Volets({ disposition, actifId, rendre, onActiver, onFermer, onDepot, onTailles }) {
  const [glisse, setGlisse] = useState(false);
  const [cible, setCible] = useState(null);
  const seul = disposition.type === 'volet';

  useEffect(() => {
    // l'affichage des zones de dépôt est repoussé : changer le DOM dans « dragstart » peut annuler le glisser
    const debut = (e) => { if (estPage(e)) setTimeout(() => setGlisse(true), 0); };
    const fin = () => { setGlisse(false); setCible(null); };
    window.addEventListener('dragstart', debut);
    window.addEventListener('dragend', fin);
    window.addEventListener('drop', fin);
    return () => {
      window.removeEventListener('dragstart', debut);
      window.removeEventListener('dragend', fin);
      window.removeEventListener('drop', fin);
    };
  }, []);

  const rendreNoeud = (noeud) => (noeud.type === 'volet' ? (
    <Feuille
      volet={noeud}
      seul={seul}
      actif={noeud.id === actifId}
      glisse={glisse}
      cible={cible}
      setCible={setCible}
      rendre={rendre}
      onActiver={onActiver}
      onFermer={onFermer}
      onDepot={onDepot}
    />
  ) : (
    <Scission scission={noeud} rendreNoeud={rendreNoeud} onTailles={onTailles} />
  ));

  return rendreNoeud(disposition);
}
