import { useEffect, useRef, useState } from 'react';

// Un bouton d'outil qui ouvre un petit panneau flottant ; un clic en dehors le referme
export default function Popover({ bouton, titre, actif = false, children }) {
  const [ouvert, setOuvert] = useState(false);
  const zone = useRef(null);

  useEffect(() => {
    if (!ouvert) return undefined;
    const dehors = (e) => { if (zone.current && !zone.current.contains(e.target)) setOuvert(false); };
    const echap = (e) => { if (e.key === 'Escape') setOuvert(false); };
    document.addEventListener('mousedown', dehors);
    document.addEventListener('keydown', echap);
    return () => { document.removeEventListener('mousedown', dehors); document.removeEventListener('keydown', echap); };
  }, [ouvert]);

  return (
    <span className="popover-zone" ref={zone}>
      <button className={'base-outil' + (actif || ouvert ? ' actif' : '')} title={titre} onClick={() => setOuvert((o) => !o)}>{bouton}</button>
      {ouvert && <div className="popover">{children}</div>}
    </span>
  );
}
