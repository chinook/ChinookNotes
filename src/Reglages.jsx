// Réglages : apparence et outils (ce qui se trouvait en bas de la barre latérale)
export default function Reglages({ theme, zoom, onTheme, onZoomInitial, onLargeurSidebarInitiale, onImporter, onCorbeille, onModeles, onFermer }) {
  const ouvrir = (action) => () => { onFermer(); action(); };

  return (
    <div className="dialogue-fond" onMouseDown={onFermer}>
      <div className="dialogue dialogue-large" onMouseDown={(e) => e.stopPropagation()}>
        <strong>⚙ Réglages</strong>

        <div className="titre-section">Apparence</div>
        <div className="reglage-ligne">
          <span>Thème</span>
          <button onClick={onTheme}>{theme === 'clair' ? '🌙 Passer au thème sombre' : '☀️ Passer au thème clair'}</button>
        </div>
        <div className="reglage-ligne">
          <span>Zoom de l'application : {Math.round(zoom * 100)} % <span className="aide">(Ctrl + molette)</span></span>
          <button onClick={onZoomInitial} disabled={Math.abs(zoom - 1) < 0.01}>Réinitialiser</button>
        </div>
        <div className="reglage-ligne">
          <span>Largeur de la barre latérale <span className="aide">(glisse son bord)</span></span>
          <button onClick={onLargeurSidebarInitiale}>Réinitialiser</button>
        </div>

        <div className="titre-section">Outils</div>
        <div className="reglage-ligne">
          <span>📋 Nouvelle page depuis un modèle</span>
          <button onClick={ouvrir(onModeles)}>Ouvrir…</button>
        </div>
        <div className="reglage-ligne">
          <span>📥 Importer des fichiers Markdown (export Notion)</span>
          <button onClick={ouvrir(onImporter)}>Importer…</button>
        </div>
        <div className="reglage-ligne">
          <span>🗑 Corbeille</span>
          <button onClick={ouvrir(onCorbeille)}>Ouvrir…</button>
        </div>

        <div className="dialogue-boutons">
          <span style={{ flex: 1 }} />
          <button className="primaire" onClick={onFermer}>Fermer</button>
        </div>
      </div>
    </div>
  );
}
