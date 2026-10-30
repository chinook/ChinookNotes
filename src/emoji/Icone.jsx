import { createContext, useContext } from 'react';

// Une icône de page est soit un emoji (texte), soit « emoji:<id> » : une image personnalisée
export const EmojisContext = createContext({});

export const estImagePerso = (valeur) => typeof valeur === 'string' && valeur.startsWith('emoji:');

export default function Icone({ valeur, defaut = '📄', className = '' }) {
  const images = useContext(EmojisContext);
  if (estImagePerso(valeur)) {
    const emoji = images[valeur.slice(6)];
    if (emoji) return <img className={`emoji-img ${className}`} src={emoji.image} alt={emoji.nom} title={emoji.nom} draggable={false} />;
    return <span className={className}>{defaut}</span>; // image supprimée depuis
  }
  return <span className={className}>{valeur || defaut}</span>;
}
