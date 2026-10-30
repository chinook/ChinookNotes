import { useState } from 'react';

// Enregistre le contenu actuel d'une page comme modèle réutilisable
export default function SauverModele({ pageId, titreInitial, onFermer }) {
  const [nom, setNom] = useState(titreInitial || '');
  const [etat, setEtat] = useState('saisie');

  async function enregistrer() {
    if (!nom.trim()) return;
    setEtat('encours');
    const page = await window.api.lirePage(pageId);
    await window.api.creerModele({ nom: nom.trim(), icone: page.icone, couverture: page.couverture, contenu: page.contenu });
    setEtat('fait');
  }

  return (
    <div className="dialogue-fond" onMouseDown={onFermer}>
      <div className="dialogue" onMouseDown={(e) => e.stopPropagation()}>
        <strong>Enregistrer comme modèle</strong>
        {etat === 'fait' ? (
          <>
            <p>✓ Modèle « {nom.trim()} » enregistré. Il apparaît dans « Nouvelle page depuis un modèle ».</p>
            <div className="dialogue-boutons">
              <span style={{ flex: 1 }} />
              <button className="primaire" onClick={onFermer}>Fermer</button>
            </div>
          </>
        ) : (
          <>
            <input
              className="champ"
              autoFocus
              value={nom}
              placeholder="Nom du modèle"
              onChange={(e) => setNom(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') enregistrer(); if (e.key === 'Escape') onFermer(); }}
            />
            <p className="aide">Le contenu, l'icône et la couverture de la page sont copiés.</p>
            <div className="dialogue-boutons">
              <span style={{ flex: 1 }} />
              <button onClick={onFermer}>Annuler</button>
              <button className="primaire" onClick={enregistrer} disabled={!nom.trim() || etat === 'encours'}>Enregistrer</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
