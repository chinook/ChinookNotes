// Modèles des menus contextuels (le menu lui-même est natif : voir « menu:popup » dans main.js)

const formaterDate = (iso) => new Date(iso).toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'short' });

// « Dernière modification par Simon » + la date : les deux lignes d'information d'une page
export function lignesModification(page) {
  if (!page?.modifie_le) return [];
  return [
    page.modifie_par ? `Dernière modification par ${page.modifie_par}` : 'Dernière modification',
    formaterDate(page.modifie_le),
  ];
}

const separateur = { type: 'separator' };

// pageCopiee : la page mise de côté par « Copier » (ou null) ; rang / nbFreres : place parmi les pages de même niveau
export function menuPage(page, { pageCopiee, rang = 0, nbFreres = 1 }) {
  const estBase = page.type === 'base';
  return [
    { id: 'ouvrir', label: 'Ouvrir' },
    { id: 'renommer', label: 'Renommer' },
    { id: 'icone', label: "Changer l'icône…" },
    separateur,
    { id: 'sous-page', label: 'Ajouter une sous-page', enabled: !estBase },
    { id: 'a-cote', label: 'Ajouter une page à la suite' },
    separateur,
    { id: 'deplacer', label: 'Déplacer vers…' },
    { id: 'monter', label: 'Monter', enabled: rang > 0 },
    { id: 'descendre', label: 'Descendre', enabled: rang < nbFreres - 1 },
    separateur,
    { id: 'dupliquer', label: 'Dupliquer' },
    { id: 'copier', label: 'Copier' },
    { id: 'coller', label: 'Coller comme sous-page', enabled: !!pageCopiee && !estBase },
    { id: 'exporter', label: 'Exporter…' },
    { id: 'corbeille', label: 'Déplacer dans la corbeille' },
    separateur,
    ...lignesModification(page).map((label) => ({ label, enabled: false })),
  ];
}

export function menuSidebarVide({ pageCopiee }) {
  return [
    { id: 'nouvelle', label: 'Nouvelle page' },
    { id: 'coller-racine', label: 'Coller à la racine', enabled: !!pageCopiee },
    separateur,
    { id: 'corbeille-ouvrir', label: 'Ouvrir la corbeille' },
  ];
}

// Transformations d'un bloc de texte (menu « Transformer en »)
export const TRANSFORMATIONS = [
  { id: 'texte', label: 'Texte' },
  { id: 'h1', label: 'Titre 1' },
  { id: 'h2', label: 'Titre 2' },
  { id: 'h3', label: 'Titre 3' },
  { id: 'puces', label: 'Liste à puces' },
  { id: 'numerotee', label: 'Liste numérotée' },
  { id: 'taches', label: 'Liste de tâches' },
  { id: 'citation', label: 'Citation' },
  { id: 'callout', label: 'Callout' },
  { id: 'code', label: 'Bloc de code' },
];

const NOMS_BLOCS = {
  paragraph: 'le paragraphe', heading: 'le titre', bulletList: 'la liste', orderedList: 'la liste', taskList: 'la liste',
  listItem: 'l\'élément de liste', taskItem: 'la tâche', blockquote: 'la citation', callout: 'le callout',
  codeBlock: 'le bloc de code', table: 'le tableau', image: 'l\'image', horizontalRule: 'le séparateur',
  details: 'le toggle', blockMath: 'l\'équation',
};

// bloc : { type } (voir trouverBloc dans Editor.jsx) ou null ; aSelection : du texte est sélectionné
export function menuEditeur(bloc, { aSelection }) {
  const nom = bloc ? NOMS_BLOCS[bloc.type] ?? 'le bloc' : null;
  return [
    { label: 'Annuler', role: 'undo' },
    { label: 'Rétablir', role: 'redo' },
    separateur,
    { label: 'Couper', role: 'cut', enabled: aSelection },
    { label: 'Copier', role: 'copy', enabled: aSelection },
    { label: 'Coller', role: 'paste' },
    { label: 'Coller sans mise en forme', role: 'pasteAndMatchStyle' },
    { label: 'Tout sélectionner', role: 'selectAll' },
    ...(bloc ? [
      separateur,
      { id: 'dupliquer-bloc', label: `Dupliquer ${nom}` },
      { id: 'supprimer-bloc', label: `Supprimer ${nom}` },
      ...(bloc.transformable ? [{ label: 'Transformer en', submenu: TRANSFORMATIONS }] : []),
      ...(bloc.type === 'image' ? [{
        label: "Taille de l'image",
        submenu: [
          { id: 'img-25', label: "25 % de la taille d'origine" },
          { id: 'img-50', label: "50 % de la taille d'origine" },
          { id: 'img-100', label: "100 % (taille d'origine)" },
        ],
      }] : []),
    ] : []),
  ];
}
