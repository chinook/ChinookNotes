// Annuler / refaire (Ctrl + Z, Ctrl + Y) pour ce qui se fait en dehors de l'éditeur de texte : pages (créer, renommer,
// déplacer, corbeille), cellules et lignes des bases, réglages d'une base (tri, filtres, colonnes).
// Le texte d'une page garde son propre Ctrl + Z, dans l'éditeur.
//
// Une action = { libelle, annuler: async () => {}, refaire: async () => {} }.
// Elle est enregistrée APRÈS avoir réussi ; annuler() et refaire() appellent window.api directement, sans enregistrer.

const MAX_ACTIONS = 100;
const aAnnuler = [];
const aRefaire = [];

export function enregistrer(action) {
  aAnnuler.push(action);
  if (aAnnuler.length > MAX_ACTIONS) aAnnuler.shift();
  aRefaire.length = 0; // une nouvelle action efface ce qu'on pouvait encore refaire
}

// Retire une action de l'historique (annulée par un autre chemin, par exemple le bouton « Annuler » d'un message)
export function retirer(action) {
  const i = aAnnuler.lastIndexOf(action);
  if (i >= 0) aAnnuler.splice(i, 1);
}

async function executer(source, destination, sens) {
  const action = source.pop();
  if (!action) return null;
  try {
    await action[sens]();
  } catch {
    return { erreur: true, libelle: action.libelle }; // la page ou la ligne n'existe plus : l'action est abandonnée
  }
  destination.push(action);
  return { libelle: action.libelle };
}

// Renvoient null s'il n'y a rien à faire, { libelle } si c'est fait, { erreur: true, libelle } si c'était impossible
export const annuler = () => executer(aAnnuler, aRefaire, 'annuler');
export const refaire = () => executer(aRefaire, aAnnuler, 'refaire');

// Annule l'action seulement si c'est la dernière enregistrée ; renvoie false sinon
export async function annulerSiDerniere(action) {
  if (aAnnuler[aAnnuler.length - 1] !== action) return false;
  return !!(await annuler());
}

export const actionCreation = (id, libelle) => ({
  libelle,
  annuler: () => window.api.mettreALaCorbeille(id),
  refaire: () => window.api.restaurerPage(id),
});

export const actionCorbeille = (id, libelle) => ({
  libelle,
  annuler: () => window.api.restaurerPage(id),
  refaire: () => window.api.mettreALaCorbeille(id),
});

// Changement de champs d'une page (titre, icône, valeurs, schéma…) : avant et après sont des objets { champ: valeur }
export const actionModification = (id, libelle, avant, apres) => ({
  libelle,
  annuler: () => window.api.modifierPage(id, avant),
  refaire: () => window.api.modifierPage(id, apres),
});
