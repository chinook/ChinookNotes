import { useEffect, useState } from 'react';
import Icone from './emoji/Icone.jsx';
import EmojiPicker from './emoji/EmojiPicker.jsx';

const formaterDate = (iso) => new Date(iso).toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' });

// Nom, avatar et activité. enregistrer({ auteur, avatar }) écrit les réglages.
export default function Profil({ reglages, onEnregistrer, onOuvrirPage, onEmojisChange, onFermer }) {
  const [nom, setNom] = useState(reglages.auteur ?? '');
  const [avatar, setAvatar] = useState(reglages.avatar ?? null);
  const [choixAvatar, setChoixAvatar] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => { window.api.statsProfil().then(setStats); }, []);

  const chiffre = (valeur, libelle) => (
    <div className="stat">
      <div className="stat-valeur">{valeur}</div>
      <div className="stat-libelle">{libelle}</div>
    </div>
  );

  return (
    <div className="dialogue-fond" onMouseDown={onFermer}>
      <div className="dialogue dialogue-modeles profil" onMouseDown={(e) => e.stopPropagation()}>
        <div className="profil-entete">
          <button className="profil-avatar" onClick={() => setChoixAvatar(true)} title="Changer l'avatar">
            <Icone valeur={avatar} defaut="👤" />
          </button>
          <div className="profil-identite">
            <input
              className="champ"
              value={nom}
              placeholder="Ton nom"
              onChange={(e) => setNom(e.target.value)}
            />
            <span className="aide">Ce nom signe tes modifications.</span>
          </div>
        </div>

        <div className="titre-section">Activité</div>
        {stats && (
          <div className="stats">
            {chiffre(stats.pages, 'pages')}
            {chiffre(stats.bases, stats.bases > 1 ? 'bases' : 'base')}
            {chiffre(stats.lignes, 'lignes de bases')}
            {chiffre(stats.creeesSemaine, 'créées (7 jours)')}
            {chiffre(stats.modifieesAujourdhui, 'modifiées aujourd\'hui')}
            {chiffre(stats.corbeille, 'dans la corbeille')}
          </div>
        )}

        <div className="titre-section">Dernières modifications</div>
        <div className="corbeille-liste">
          {stats?.recentes.map((p) => (
            <button key={p.id} className="corbeille-ligne profil-recente" onClick={() => { onFermer(); onOuvrirPage(p.id); }}>
              <Icone valeur={p.icone} className="icone" />
              <span className="corbeille-nom">
                <span>{p.titre || 'Sans titre'}</span>
              </span>
              <span className="aide">{p.modifie_par ? `${p.modifie_par} · ` : ''}{formaterDate(p.modifie_le)}</span>
            </button>
          ))}
        </div>

        <div className="dialogue-boutons">
          <span style={{ flex: 1 }} />
          <button onClick={onFermer}>Annuler</button>
          <button className="primaire" onClick={() => onEnregistrer({ auteur: nom.trim() || null, avatar })}>Enregistrer</button>
        </div>

        {choixAvatar && (
          <EmojiPicker
            valeur={avatar}
            onChoisir={(v) => { setAvatar(v); setChoixAvatar(false); }}
            onFermer={() => setChoixAvatar(false)}
            onEmojisChange={onEmojisChange}
          />
        )}
      </div>
    </div>
  );
}
