// Réglages : liste des sections à gauche, options de la section choisie à droite
import { useState } from 'react';
import { POLICES } from './polices.js';
import { MOD } from './plateforme.js';
import { ROLES, peutGererMembres } from './permissions.js';
import Raccourcis from './Raccourcis.jsx';

export default function Reglages({ theme, police, onPolice, zoom, onTheme, onZoomInitial, onLargeurSidebarInitiale, onImporter, onExporterTout, onCorbeille, onModeles, role, onRole, onPermissions, onFermer }) {
  const ouvrir = (action) => () => { onFermer(); action(); };

  const sections = [
    { id: 'apparence', nom: 'Apparence' },
    { id: 'outils', nom: 'Outils' },
    { id: 'raccourcis', nom: 'Raccourcis clavier' },
    ...(peutGererMembres(role) ? [{ id: 'administration', nom: 'Administration' }] : []),
    { id: 'test', nom: 'Test (sans serveur)' },
  ];
  const [choisie, setChoisie] = useState('apparence');
  // Si la section n'existe plus (le rôle simulé a changé), on revient à la première
  const actif = sections.find((s) => s.id === choisie) || sections[0];

  return (
    <div className="dialogue-fond" onMouseDown={onFermer}>
      <div className="dialogue reglages" onMouseDown={(e) => e.stopPropagation()}>
        <nav className="reglages-menu">
          <strong className="reglages-titre">Réglages</strong>
          {sections.map((s) => (
            <button key={s.id} className={s.id === actif.id ? 'actif' : ''} onClick={() => setChoisie(s.id)}>
              {s.nom}
            </button>
          ))}
        </nav>

        <div className="reglages-contenu">
          <div className="reglages-entete">
            <strong>{actif.nom}</strong>
            <button className="reglages-fermer" onClick={onFermer} title="Fermer (Échap)">✕</button>
          </div>

          <div className="reglages-corps">
            {actif.id === 'apparence' && (
              <>
                <div className="reglage-ligne">
                  <span>Thème</span>
                  <button onClick={onTheme}>{theme === 'clair' ? 'Passer au thème sombre' : 'Passer au thème clair'}</button>
                </div>
                <div className="reglage-ligne">
                  <span>Police</span>
                  <select value={police} onChange={(e) => onPolice(e.target.value)}>
                    {POLICES.map((p) => <option key={p.id} value={p.id} style={{ fontFamily: p.css }}>{p.nom}</option>)}
                  </select>
                </div>
                <div className="reglage-ligne">
                  <span>Zoom de l'application : {Math.round(zoom * 100)} % <span className="aide">({MOD} + molette)</span></span>
                  <button onClick={onZoomInitial} disabled={Math.abs(zoom - 1) < 0.01}>Réinitialiser</button>
                </div>
                <div className="reglage-ligne">
                  <span>Largeur de la barre latérale <span className="aide">(glisse son bord)</span></span>
                  <button onClick={onLargeurSidebarInitiale}>Réinitialiser</button>
                </div>
              </>
            )}

            {actif.id === 'outils' && (
              <>
                <div className="reglage-ligne">
                  <span>Nouvelle page depuis un modèle</span>
                  <button onClick={ouvrir(onModeles)}>Ouvrir…</button>
                </div>
                <div className="reglage-ligne">
                  <span>Importer des fichiers Markdown (export Notion)</span>
                  <button onClick={ouvrir(onImporter)}>Importer…</button>
                </div>
                <div className="reglage-ligne">
                  <span>Exporter toutes les pages (Markdown, HTML ou PDF)</span>
                  <button onClick={ouvrir(onExporterTout)}>Exporter…</button>
                </div>
                <div className="reglage-ligne">
                  <span>Corbeille</span>
                  <button onClick={ouvrir(onCorbeille)}>Ouvrir…</button>
                </div>
              </>
            )}

            {actif.id === 'raccourcis' && <Raccourcis />}

            {actif.id === 'administration' && (
              <div className="reglage-ligne">
                <span>Permissions des membres</span>
                <button onClick={ouvrir(onPermissions)}>Ouvrir…</button>
              </div>
            )}

            {actif.id === 'test' && (
              <div className="reglage-ligne">
                <span>Mon rôle <span className="aide">(simulation : l'administration n'apparaît que pour un administrateur ou le propriétaire)</span></span>
                <select value={role} onChange={(e) => onRole(e.target.value)}>
                  {ROLES.map((r) => <option key={r.id} value={r.id}>{r.nom}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
