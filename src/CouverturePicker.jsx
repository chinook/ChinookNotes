import { useRef, useState } from 'react';
import { DEGRADES, lireImageCouverture, styleCouverture } from './couverture.js';

export default function CouverturePicker({ courante, onChoisir, onFermer }) {
  const fichier = useRef(null);
  const [erreur, setErreur] = useState(null);

  async function importer(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      onChoisir(await lireImageCouverture(f));
    } catch (err) {
      setErreur(err.message);
    }
  }

  return (
    <div className="dialogue-fond" onMouseDown={onFermer}>
      <div className="dialogue dialogue-large" onMouseDown={(e) => e.stopPropagation()}>
        <strong>Couverture</strong>
        <div className="degrades">
          {DEGRADES.map((d) => (
            <button
              key={d.id}
              className={'degrade' + (courante === `grad:${d.id}` ? ' actif' : '')}
              style={styleCouverture(`grad:${d.id}`)}
              title={d.id}
              onClick={() => onChoisir(`grad:${d.id}`)}
            />
          ))}
        </div>
        <div className="dialogue-boutons">
          <button onClick={() => fichier.current?.click()}>🖼 Choisir une image…</button>
          {courante && <button onClick={() => onChoisir(null)}>Retirer la couverture</button>}
          <span style={{ flex: 1 }} />
          <button onClick={onFermer}>Fermer</button>
        </div>
        {erreur && <p className="aide">{erreur}</p>}
        <input ref={fichier} type="file" accept="image/*" hidden onChange={importer} />
      </div>
    </div>
  );
}
