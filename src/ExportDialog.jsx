import { useState } from 'react';
import { exporter } from './export/exporter.js';

const FORMATS = [
  { id: 'md', nom: 'Markdown', aide: 'Fichier .md lisible partout' },
  { id: 'html', nom: 'HTML', aide: 'Page web autonome, code coloré' },
  { id: 'pdf', nom: 'PDF', aide: 'Document à imprimer ou partager' },
];

function compterDescendants(pages, id) {
  const enfants = pages.filter((p) => p.parent_id === id);
  return enfants.reduce((n, e) => n + compterDescendants(pages, e.id), enfants.length);
}

export default function ExportDialog({ pages, pageId, onFermer }) {
  const page = pages.find((p) => p.id === pageId);
  const nbSous = compterDescendants(pages, pageId);
  const [format, setFormat] = useState('md');
  const [sousPages, setSousPages] = useState(nbSous > 0);
  const [etat, setEtat] = useState({ phase: 'choix' });

  async function lancer() {
    setEtat({ phase: 'encours' });
    try {
      const resultat = await exporter({ id: pageId, format, sousPages, pages });
      if (resultat === null) setEtat({ phase: 'choix' }); // destination annulée
      else setEtat({ phase: 'termine', ...resultat });
    } catch (e) {
      setEtat({ phase: 'erreur', message: String(e?.message || e) });
    }
  }

  return (
    <div className="dialogue-fond" onMouseDown={etat.phase === 'encours' ? undefined : onFermer}>
      <div className="dialogue dialogue-large" onMouseDown={(e) => e.stopPropagation()}>
        <strong>Exporter « {page?.titre || 'Sans titre'} »</strong>

        {(etat.phase === 'choix' || etat.phase === 'encours') && (
          <>
            <div className="formats">
              {FORMATS.map((f) => (
                <label key={f.id} className={'format' + (format === f.id ? ' actif' : '')}>
                  <input type="radio" name="format" checked={format === f.id} onChange={() => setFormat(f.id)} />
                  <span className="format-nom">{f.nom}</span>
                  <span className="format-aide">{f.aide}</span>
                </label>
              ))}
            </div>
            <label className={'case' + (nbSous === 0 ? ' desactive' : '')}>
              <input
                type="checkbox"
                checked={sousPages && nbSous > 0}
                disabled={nbSous === 0}
                onChange={(e) => setSousPages(e.target.checked)}
              />
              {nbSous === 0
                ? 'Inclure les sous-pages (cette page n\'en a pas)'
                : `Inclure les ${nbSous} sous-page(s)`}
            </label>
            {sousPages && nbSous > 0 && (
              <p className="aide">
                {format === 'pdf'
                  ? 'Un seul PDF, une page de titre par section.'
                  : 'Un dossier avec un fichier par page ; les liens entre pages restent valides.'}
              </p>
            )}
            <div className="dialogue-boutons">
              <span style={{ flex: 1 }} />
              <button onClick={onFermer} disabled={etat.phase === 'encours'}>Annuler</button>
              <button className="primaire" onClick={lancer} disabled={etat.phase === 'encours'}>
                {etat.phase === 'encours' ? 'Export…' : 'Exporter'}
              </button>
            </div>
          </>
        )}

        {etat.phase === 'termine' && (
          <>
            <p>✓ {etat.fichiers} fichier(s) exporté(s).</p>
            <p className="aide chemin">{etat.emplacement}</p>
            <div className="dialogue-boutons">
              <button onClick={() => window.api.afficherDansDossier(etat.emplacement)}>Afficher dans le dossier</button>
              <span style={{ flex: 1 }} />
              <button className="primaire" onClick={onFermer}>Fermer</button>
            </div>
          </>
        )}

        {etat.phase === 'erreur' && (
          <>
            <p>Erreur : {etat.message}</p>
            <div className="dialogue-boutons">
              <span style={{ flex: 1 }} />
              <button className="primaire" onClick={onFermer}>Fermer</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
