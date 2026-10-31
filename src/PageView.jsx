import { useEffect, useRef, useState } from 'react';
import Editor from './editor/Editor.jsx';
import CouverturePicker from './CouverturePicker.jsx';
import SauverModele from './modeles/SauverModele.jsx';
import { styleCouverture } from './couverture.js';
import BaseView from './base/BaseView.jsx';
import ProprietesLigne from './base/ProprietesLigne.jsx';
import Icone from './emoji/Icone.jsx';
import EmojiPicker from './emoji/EmojiPicker.jsx';
import { lignesModification } from './menus.js';
import LargeurPage from './LargeurPage.jsx';

const DELAI_SAUVEGARDE = 500;

export default function PageView({ id, chemin, onSelect, onChange, onExporter, meta, lignes, baseParente, largeurEnregistree, onApercuLargeur, onAppliquerLargeur, onEmojisChange, onRetour, onAvance, peutRetour, peutAvance, onApercuLigne, apercu = false }) {
  const [page, setPage] = useState(null);
  const [couvertureOuverte, setCouvertureOuverte] = useState(false);
  const [modeleOuvert, setModeleOuvert] = useState(false);
  const [emojiOuvert, setEmojiOuvert] = useState(false);
  const minuterie = useRef(null);
  const enAttente = useRef({});

  useEffect(() => {
    let annule = false;
    window.api.lirePage(id).then((p) => { if (!annule) setPage(p); });
    return () => { annule = true; };
  }, [id]);

  // Sauvegarde ce qui reste à écrire quand on quitte la page
  useEffect(() => () => {
    clearTimeout(minuterie.current);
    if (Object.keys(enAttente.current).length > 0) {
      window.api.modifierPage(id, enAttente.current).then(onChange);
    }
  }, [id, onChange]);

  function modifier(champs) {
    setPage((p) => ({ ...p, ...champs }));
    enAttente.current = { ...enAttente.current, ...champs };
    clearTimeout(minuterie.current);
    minuterie.current = setTimeout(async () => {
      const a_ecrire = enAttente.current;
      enAttente.current = {};
      const maj = await window.api.modifierPage(id, a_ecrire);
      setPage((p) => (p ? { ...p, modifie_le: maj.modifie_le, modifie_par: maj.modifie_par } : p));
      if ('titre' in a_ecrire || 'icone' in a_ecrire || 'proprietes' in a_ecrire) onChange();
    }, DELAI_SAUVEGARDE);
  }

  // Le titre passe à la ligne : sa hauteur suit son contenu et sa largeur (volet, glissière de largeur…)
  const refTitre = useRef(null);
  useEffect(() => {
    const t = refTitre.current;
    if (!t) return undefined;
    const ajuster = () => { t.style.height = 'auto'; t.style.height = `${t.scrollHeight}px`; };
    ajuster();
    const observateur = new ResizeObserver(ajuster);
    observateur.observe(t);
    return () => observateur.disconnect();
  }, [page?.titre, !!page]);

  if (!page) return null;

  return (
    <div className="page">
      {!apercu && (
        <nav className="ariane">
          <span className="ariane-gauche">
            <button className="nav-bouton" onClick={onRetour} disabled={!peutRetour} title="Page précédente (bouton « précédent » de la souris, Alt + ←)">‹</button>
            <button className="nav-bouton" onClick={onAvance} disabled={!peutAvance} title="Page suivante (bouton « suivant » de la souris, Alt + →)">›</button>
            <span>
              {chemin.map((p, i) => (
                <span key={p.id}>
                  {i > 0 && ' / '}
                  <a onClick={() => onSelect(p.id)}>{p.titre || 'Sans titre'}</a>
                </span>
              ))}
            </span>
          </span>
          <span className="ariane-actions">
            <LargeurPage enregistree={largeurEnregistree} onApercu={onApercuLargeur} onAppliquer={onAppliquerLargeur} />
            <button className="ariane-action" onClick={() => setModeleOuvert(true)} title="Utiliser cette page comme modèle">📋 Enregistrer comme modèle</button>
            <button className="ariane-action" onClick={onExporter} title="Exporter en Markdown, HTML ou PDF">⤓ Exporter</button>
          </span>
        </nav>
      )}
      {page.couverture && (
        <div className="couverture" style={styleCouverture(page.couverture)}>
          <button onClick={() => setCouvertureOuverte(true)}>Changer la couverture</button>
          <button onClick={() => modifier({ couverture: null })}>Retirer</button>
        </div>
      )}
      <div className={'page-corps' + (page.couverture ? ' avec-couverture' : '') + (meta.type === 'base' ? ' large' : '') + (apercu ? ' en-volet' : '')}>
        {!page.couverture && (
          <div className="ajout-couverture">
            <button onClick={() => setCouvertureOuverte(true)}>🖼 Ajouter une couverture</button>
          </div>
        )}
        <button className="page-icone" onClick={() => setEmojiOuvert(true)} title="Changer l'icône">
          <Icone valeur={page.icone} defaut={meta.type === 'base' ? '🗃️' : '📄'} className={page.icone ? '' : 'icone-defaut'} />
        </button>
        <textarea
          className="page-titre"
          ref={refTitre}
          rows={1}
          value={page.titre}
          placeholder="Sans titre"
          onChange={(e) => modifier({ titre: e.target.value.replace(/\n/g, ' ') })}
          onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
        />
        {meta.type === 'base' ? (
          <BaseView base={meta} lignes={lignes} onChange={onChange} onOuvrir={onSelect} onApercu={onApercuLigne} />
        ) : (
          <>
            {baseParente && (
              <ProprietesLigne base={baseParente} proprietes={page.proprietes} onChange={(proprietes) => modifier({ proprietes })} />
            )}
            <Editor contenu={page.contenu} onChange={(contenu) => modifier({ contenu })} onNavigate={onSelect} chercher={!apercu} />
          </>
        )}
        {lignesModification(page).length > 0 && (
          <div className="derniere-modification">
            {lignesModification(page).join(' · ')}
          </div>
        )}
      </div>
      {emojiOuvert && (
        <EmojiPicker
          valeur={page.icone}
          onChoisir={(v) => { modifier({ icone: v }); setEmojiOuvert(false); }}
          onFermer={() => setEmojiOuvert(false)}
          onEmojisChange={onEmojisChange}
        />
      )}
      {couvertureOuverte && (
        <CouverturePicker
          courante={page.couverture}
          onChoisir={(c) => { modifier({ couverture: c }); setCouvertureOuverte(false); }}
          onFermer={() => setCouvertureOuverte(false)}
        />
      )}
      {modeleOuvert && <SauverModele pageId={id} titreInitial={page.titre} onFermer={() => setModeleOuvert(false)} />}
    </div>
  );
}
