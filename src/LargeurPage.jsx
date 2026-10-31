import { useEffect, useRef, useState } from 'react';

export const LARGEUR_MIN = 30;
export const LARGEUR_MAX = 100;

// Bouton du haut de page : une glissière règle la largeur du contenu (en % de la zone d'affichage),
// l'aperçu est en direct, « Appliquer » enregistre pour toutes les pages.
// enregistree : pourcentage appliqué (ou null = largeur d'origine) ; onApercu(p | null) : aperçu en direct
export default function LargeurPage({ enregistree, onApercu, onAppliquer }) {
  const [ouvert, setOuvert] = useState(false);
  const [valeur, setValeur] = useState(enregistree ?? 60);
  const zone = useRef(null);

  function ouvrir() {
    // sans réglage enregistré, on part de la largeur réellement affichée
    if (enregistree == null) {
      const page = zone.current?.closest('.page'); // la page de ce volet, pas la première de l'écran
      const corps = page?.querySelector('.page-corps');
      if (corps && page) setValeur(Math.max(LARGEUR_MIN, Math.min(LARGEUR_MAX, Math.round((corps.offsetWidth / page.offsetWidth) * 100))));
    } else {
      setValeur(enregistree);
    }
    setOuvert(true);
  }

  function annuler() {
    setOuvert(false);
    onApercu(null); // retour à ce qui était enregistré
  }

  // un clic en dehors referme sans appliquer
  useEffect(() => {
    if (!ouvert) return undefined;
    const dehors = (e) => { if (zone.current && !zone.current.contains(e.target)) annuler(); };
    document.addEventListener('mousedown', dehors);
    return () => document.removeEventListener('mousedown', dehors);
  });

  function changer(v) {
    setValeur(v);
    onApercu(v);
  }

  return (
    <span className="largeur-zone" ref={zone}>
      <button
        className={'ariane-action' + (enregistree != null ? ' actif' : '')}
        onClick={() => (ouvert ? annuler() : ouvrir())}
        title="Largeur de la page"
      >
        ↔ Largeur : {enregistree != null ? `${enregistree} %` : 'normale'} ▾
      </button>
      {ouvert && (
        <div className="largeur-popover">
          <div className="largeur-titre">
            <span>Largeur de la page</span>
            <strong>{valeur} %</strong>
          </div>
          <input
            className="largeur-curseur"
            type="range"
            min={LARGEUR_MIN}
            max={LARGEUR_MAX}
            step={1}
            value={valeur}
            onChange={(e) => changer(Number(e.target.value))}
          />
          <div className="largeur-reperes"><span>{LARGEUR_MIN} %</span><span>100 %</span></div>
          <div className="largeur-boutons">
            <button onClick={() => { setOuvert(false); onAppliquer(null); }} title="Revenir à la largeur d'origine">Par défaut</button>
            <span style={{ flex: 1 }} />
            <button onClick={annuler}>Annuler</button>
            <button className="primaire" onClick={() => { setOuvert(false); onAppliquer(valeur); }}>Appliquer</button>
          </div>
        </div>
      )}
    </span>
  );
}
