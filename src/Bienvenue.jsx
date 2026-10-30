import { useState } from 'react';

// Premier lancement : on demande son nom (il signe les modifications des pages)
export default function Bienvenue({ onEnregistrer }) {
  const [nom, setNom] = useState('');
  const valider = () => onEnregistrer({ auteur: nom.trim() || null, auteurDemande: '1' });

  return (
    <div className="dialogue-fond">
      <div className="dialogue dialogue-large">
        <strong>Bienvenue dans ChinookNotes</strong>
        <label className="reglage">
          <span>Comment t'appelles-tu ?</span>
          <input
            className="champ"
            autoFocus
            value={nom}
            placeholder="Ex. : Simon"
            onChange={(e) => setNom(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') valider(); }}
          />
          <span className="aide">Ton nom signe tes modifications : « Dernière modification par … ». Tu pourras le changer dans ton profil.</span>
        </label>
        <div className="dialogue-boutons">
          <button onClick={() => onEnregistrer({ auteurDemande: '1' })}>Plus tard</button>
          <span style={{ flex: 1 }} />
          <button className="primaire" onClick={valider}>Commencer</button>
        </div>
      </div>
    </div>
  );
}
