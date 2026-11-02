// Rôles des membres du club. Sans serveur, le rôle de l'utilisateur est simulé (Réglages → « Test ») ;
// plus tard, il viendra du serveur et sera vérifié là-bas : l'interface ne fait que montrer ou cacher.

export const ROLES = [
  { id: 'lecteur', nom: 'Lecteur', description: 'Lit toutes les pages, cherche et exporte. Ne peut rien modifier.' },
  { id: 'modificateur', nom: 'Modificateur', description: 'En plus : crée, modifie, déplace et met des pages à la corbeille.' },
  { id: 'admin', nom: 'Administrateur', description: 'En plus : gère les membres et leurs rôles, vide la corbeille, importe.' },
  { id: 'proprietaire', nom: 'Propriétaire', description: "Tous les droits. Ne peut être ni retiré ni modifié par un administrateur." },
];

export const nomRole = (id) => ROLES.find((r) => r.id === id)?.nom ?? id;

export const peutGererMembres = (role) => role === 'admin' || role === 'proprietaire';

// Rôles qu'on peut donner à un membre. Le propriétaire règle tout le monde sauf lui-même ;
// un administrateur règle seulement les lecteurs et les modificateurs (jamais un autre administrateur ni le propriétaire).
export function rolesAssignables(monRole, membre) {
  if (membre.estMoi || membre.role === 'proprietaire') return [];
  if (monRole === 'proprietaire') return ['lecteur', 'modificateur', 'admin'];
  if (monRole === 'admin' && membre.role !== 'admin') return ['lecteur', 'modificateur'];
  return [];
}
