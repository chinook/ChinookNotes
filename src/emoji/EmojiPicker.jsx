import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { EmojisContext } from './Icone.jsx';

const GROUPES = {
  0: 'Smileys et émotions', 1: 'Personnes et corps', 3: 'Animaux et nature', 4: 'Nourriture et boissons',
  5: 'Voyages et lieux', 6: 'Activités', 7: 'Objets', 8: 'Symboles',
}; // les drapeaux s'affichent comme de simples lettres sous Windows : on les laisse de côté
const CLE_RECENTS = 'emojis-recents';
const sansAccent = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function lireRecents() {
  try { return JSON.parse(localStorage.getItem(CLE_RECENTS)) || []; } catch { return []; }
}

function retenir(valeur) {
  try {
    const liste = [valeur, ...lireRecents().filter((v) => v !== valeur)].slice(0, 24);
    localStorage.setItem(CLE_RECENTS, JSON.stringify(liste));
  } catch { /* stockage indisponible : tant pis */ }
}

// Réduit l'image à 128 px (côté le plus grand) en gardant la transparence
function lireImage(fichier, max = 128) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(fichier);
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * ratio));
      canvas.height = Math.max(1, Math.round(img.height * ratio));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Image illisible : ${fichier.name}`)); };
    img.src = url;
  });
}

// valeur : icône actuelle ; onChoisir(valeur | null) ; onEmojisChange : recharger les emojis personnalisés
export default function EmojiPicker({ valeur, onChoisir, onFermer, onEmojisChange }) {
  const perso = useContext(EmojisContext);
  const [onglet, setOnglet] = useState('standard');
  const [requete, setRequete] = useState('');
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(null);
  const fichier = useRef(null);

  useEffect(() => {
    let annule = false;
    import('emojibase-data/fr/compact.json').then((m) => { if (!annule) setData(m.default); });
    return () => { annule = true; };
  }, []);

  const q = sansAccent(requete.trim());
  const standard = useMemo(() => {
    if (!data) return [];
    const emojis = data.filter((e) => GROUPES[e.group] !== undefined && e.unicode);
    return q ? emojis.filter((e) => sansAccent(`${e.label} ${(e.tags || []).join(' ')}`).includes(q)) : emojis;
  }, [data, q]);

  const parGroupe = useMemo(() => {
    const m = new Map();
    for (const e of standard) {
      if (!m.has(e.group)) m.set(e.group, []);
      m.get(e.group).push(e);
    }
    return [...m.entries()];
  }, [standard]);

  const images = Object.entries(perso)
    .map(([id, e]) => ({ id, ...e }))
    .filter((e) => !q || sansAccent(e.nom).includes(q));

  function choisir(v) {
    if (v) retenir(v);
    onChoisir(v);
  }

  async function importer(e) {
    const fichiers = [...e.target.files];
    e.target.value = '';
    setErreur(null);
    try {
      for (const f of fichiers) {
        const image = await lireImage(f);
        await window.api.creerEmoji({ nom: f.name.replace(/\.[^.]+$/, ''), image });
      }
      await onEmojisChange();
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function supprimer(ev, id, nom) {
    ev.stopPropagation();
    if (!window.confirm(`Supprimer l'emoji « ${nom} » ? Les pages qui l'utilisent retrouvent l'icône par défaut.`)) return;
    await window.api.supprimerEmoji(Number(id));
    await onEmojisChange();
  }

  const recents = lireRecents().filter((v) => !v.startsWith('emoji:') || perso[v.slice(6)]);

  return (
    <div className="dialogue-fond" onMouseDown={onFermer}>
      <div className="dialogue emoji-picker" onMouseDown={(e) => e.stopPropagation()}>
        <input
          className="champ"
          autoFocus
          value={requete}
          placeholder="Rechercher un emoji…"
          onChange={(e) => setRequete(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') onFermer(); }}
        />
        <div className="base-vues">
          <button className={'base-vue' + (onglet === 'standard' ? ' actif' : '')} onClick={() => setOnglet('standard')}>😀 Emojis</button>
          <button className={'base-vue' + (onglet === 'perso' ? ' actif' : '')} onClick={() => setOnglet('perso')}>🖼 Personnalisés ({Object.keys(perso).length})</button>
        </div>

        <div className="emoji-corps">
          {onglet === 'standard' && (
            <>
              {!q && recents.length > 0 && (
                <>
                  <div className="titre-section">Récents</div>
                  <div className="emoji-grille">
                    {recents.map((v) => (
                      <button key={v} className="emoji-case" onClick={() => choisir(v)}>
                        {v.startsWith('emoji:') ? <img className="emoji-img" src={perso[v.slice(6)].image} alt="" /> : v}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {!data && <p className="aide">Chargement des emojis…</p>}
              {parGroupe.map(([groupe, liste]) => (
                <div key={groupe}>
                  <div className="titre-section">{GROUPES[groupe]}</div>
                  <div className="emoji-grille">
                    {liste.map((e) => (
                      <button key={e.hexcode} className="emoji-case" title={e.label} onClick={() => choisir(e.unicode)}>{e.unicode}</button>
                    ))}
                  </div>
                </div>
              ))}
              {data && q && standard.length === 0 && <p className="aide">Aucun emoji ne correspond.</p>}
            </>
          )}

          {onglet === 'perso' && (
            <>
              <div className="emoji-grille">
                {images.map((e) => (
                  <button key={e.id} className="emoji-case emoji-perso" title={e.nom} onClick={() => choisir(`emoji:${e.id}`)}>
                    <img className="emoji-img" src={e.image} alt={e.nom} />
                    <span className="emoji-suppr" title="Supprimer" onClick={(ev) => supprimer(ev, e.id, e.nom)}>×</span>
                  </button>
                ))}
              </div>
              {images.length === 0 && (
                <p className="aide">
                  {Object.keys(perso).length === 0
                    ? 'Aucun emoji personnalisé. Importe des images (PNG, JPG, GIF, WebP) pour les utiliser comme icônes de page.'
                    : 'Aucun emoji ne correspond.'}
                </p>
              )}
              <button className="lien-bouton" onClick={() => fichier.current?.click()}>+ Importer des images…</button>
              <input ref={fichier} type="file" accept="image/*" multiple hidden onChange={importer} />
              {erreur && <p className="aide">{erreur}</p>}
            </>
          )}
        </div>

        <div className="dialogue-boutons">
          {valeur && <button onClick={() => choisir(null)}>Retirer l'icône</button>}
          <span style={{ flex: 1 }} />
          <button onClick={onFermer}>Fermer</button>
        </div>
      </div>
    </div>
  );
}
