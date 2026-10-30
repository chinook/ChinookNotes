import { nouvelId, option, schemaVide } from '../base/types.js';

// Modèles de pages intégrés. Les textes « {{date}} » sont remplacés à la création de la page.

const texte = (t) => (t ? [{ type: 'text', text: t }] : undefined);
const para = (t = '') => ({ type: 'paragraph', content: texte(t) });
const titre = (niveau, t) => ({ type: 'heading', attrs: { level: niveau }, content: texte(t) });
const puces = (...items) => ({ type: 'bulletList', content: items.map((t) => ({ type: 'listItem', content: [para(t)] })) });
const numerotee = (...items) => ({ type: 'orderedList', attrs: { start: 1 }, content: items.map((t) => ({ type: 'listItem', content: [para(t)] })) });
const taches = (...items) => ({ type: 'taskList', content: items.map((t) => ({ type: 'taskItem', attrs: { checked: false }, content: [para(t)] })) });
const callout = (icone, ...paras) => ({ type: 'callout', attrs: { icone }, content: paras.map((t) => para(t)) });
const code = (langue, t) => ({ type: 'codeBlock', attrs: { language: langue }, content: texte(t) });
const separateur = () => ({ type: 'horizontalRule' });
const tableau = (entetes, ...lignes) => ({
  type: 'table',
  content: [
    { type: 'tableRow', content: entetes.map((t) => ({ type: 'tableHeader', content: [para(t)] })) },
    ...lignes.map((l) => ({ type: 'tableRow', content: l.map((t) => ({ type: 'tableCell', content: [para(t)] })) })),
  ],
});
const doc = (...blocs) => ({ type: 'doc', content: blocs });

export const MODELES_INTEGRES = [
  {
    id: 'reunion',
    nom: 'Compte rendu de réunion',
    description: 'Ordre du jour, décisions et tâches à répartir',
    icone: '📝',
    titrePage: 'Réunion du {{date}}',
    contenu: doc(
      callout('👥', 'Participants : ', 'Date : {{date}}'),
      titre(2, 'Ordre du jour'),
      numerotee('', '', ''),
      titre(2, 'Discussions'),
      puces(''),
      titre(2, 'Décisions'),
      puces(''),
      titre(2, 'Tâches'),
      taches('Responsable — tâche — échéance'),
    ),
  },
  {
    id: 'code',
    nom: 'Documentation d\'un fichier de code',
    description: 'Rôle, fonctions, extraits commentés et pièges',
    icone: '📄',
    titrePage: 'Nom_du_fichier',
    contenu: doc(
      callout('📊', 'Origine du code : à compléter (écrit à la main / généré par CubeMX).'),
      titre(2, 'Rôle général'),
      para('Que fait ce fichier, et pourquoi existe-t-il ? Une ou deux phrases pour quelqu\'un qui arrive dans le projet.'),
      titre(2, 'Vue d\'ensemble des fonctions'),
      tableau(['Fonction', 'Rôle', 'Appelée par'], ['', '', ''], ['', '', '']),
      titre(2, 'Extraits commentés'),
      code('c', '// Colle ici un extrait du code, puis explique-le dessous.'),
      titre(2, 'Pièges et points d\'attention'),
      callout('⚠️', ''),
      separateur(),
      para('Dernière vérification : {{date}}'),
    ),
  },
  {
    id: 'pcb',
    nom: 'Fiche de PCB',
    description: 'Microcontrôleur, brochage, bus CAN et fichiers',
    icone: '🔌',
    titrePage: 'Nom de la carte',
    contenu: doc(
      callout('🔌', 'Rôle de la carte : à compléter.'),
      para('Microcontrôleur : '),
      titre(2, 'Vue d\'ensemble des fichiers'),
      tableau(['Fichier', 'Rôle'], ['main.c', ''], ['state_machine.c', '']),
      titre(2, 'Brochage'),
      tableau(['Broche', 'Fonction', 'Notes'], ['', '', ''], ['', '', '']),
      titre(2, 'Communication CAN'),
      tableau(['ID', 'Sens', 'Contenu'], ['', 'Envoi', ''], ['', 'Réception', '']),
      titre(2, 'Points à surveiller'),
      puces(''),
    ),
  },
  {
    id: 'bug',
    nom: 'Rapport de bug',
    description: 'Symptôme, reproduction, cause, solution et vérification',
    icone: '🐞',
    titrePage: 'Titre du bug',
    contenu: doc(
      callout('🐞', 'Statut : ouvert — Signalé le {{date}}'),
      titre(2, 'Symptôme'),
      para(''),
      titre(2, 'Comment le reproduire'),
      numerotee('', '', ''),
      titre(2, 'Cause'),
      para(''),
      titre(2, 'Solution retenue'),
      para(''),
      titre(2, 'Vérification'),
      taches('Testé sur le banc', 'Testé sur le véhicule', 'Documentation mise à jour'),
    ),
  },
  {
    id: 'essai',
    nom: 'Journal d\'essai',
    description: 'Conditions, mesures, observations et suites d\'un essai',
    icone: '🏁',
    titrePage: 'Essai du {{date}}',
    contenu: doc(
      callout('🏁', 'Date : {{date}}', 'Lieu : '),
      titre(2, 'Conditions'),
      tableau(['Paramètre', 'Valeur'], ['Vent (m/s)', ''], ['Température (°C)', ''], ['Pilote', ''], ['Version du code', '']),
      titre(2, 'Déroulement'),
      puces(''),
      titre(2, 'Observations'),
      puces(''),
      titre(2, 'Problèmes rencontrés'),
      puces(''),
      titre(2, 'Suites à donner'),
      taches(''),
    ),
  },
  {
    id: 'taches',
    nom: 'Liste de tâches',
    description: 'À faire, en cours, terminé',
    icone: '✅',
    titrePage: 'Tâches',
    contenu: doc(
      titre(2, 'À faire'),
      taches('', ''),
      titre(2, 'En cours'),
      taches(''),
      titre(2, 'Terminé'),
      taches(''),
    ),
  },
];

// Bases de données prêtes à l'emploi : schema() renvoie un schéma neuf (identifiants uniques)
const col = (nom, type, options) => ({ id: nouvelId(), nom, type, ...(options ? { options } : {}) });

export const MODELES_BASES = [
  {
    id: 'base-vide',
    nom: 'Base de données',
    description: 'Table et Kanban, avec Statut et Date',
    icone: '🗃️',
    base: { titrePage: 'Nouvelle base de données', schema: () => schemaVide() },
  },
  {
    id: 'base-bugs',
    nom: 'Suivi de bugs',
    description: 'Statut, priorité, carte concernée, date',
    icone: '🐞',
    base: {
      titrePage: 'Bugs, Erreurs & Fixes',
      schema: () => ({
        colonnes: [
          col('Statut', 'select', [option('Ouvert', 'rouge'), option('En cours', 'bleu'), option('Corrigé', 'vert')]),
          col('Priorité', 'select', [option('Haute', 'rouge'), option('Moyenne', 'jaune'), option('Basse', 'gris')]),
          col('Carte', 'select', [option('Mario', 'rouge'), option('Volant', 'jaune'), option('DriveMotor', 'bleu'), option('Backplane', 'vert')]),
          col('Découvert le', 'date'),
        ],
        vue: 'kanban', groupe: null, tri: null,
      }),
    },
  },
  {
    id: 'base-taches',
    nom: 'Tâches',
    description: 'Statut, responsable, échéance',
    icone: '✅',
    base: {
      titrePage: 'Tâches futures',
      schema: () => ({
        colonnes: [
          col('Statut', 'select', [option('À faire', 'gris'), option('En cours', 'bleu'), option('Terminé', 'vert')]),
          col('Responsable', 'texte'),
          col('Échéance', 'date'),
          col('Fait', 'case'),
        ],
        vue: 'table', groupe: null, tri: { col: 'titre', sens: 1 },
      }),
    },
  },
];

const aujourdhui = () => new Date().toLocaleDateString('fr-CA'); // AAAA-MM-JJ, comme dans tes pages

// Remplace {{date}} dans le titre et dans tous les textes du contenu
export function instancier(modele) {
  const remplacer = (t) => t.replace(/\{\{date\}\}/g, aujourdhui());
  const parcourir = (n) => {
    if (typeof n.text === 'string') return { ...n, text: remplacer(n.text) };
    return n.content ? { ...n, content: n.content.map(parcourir) } : n;
  };
  const contenu = typeof modele.contenu === 'string'
    ? (modele.contenu ? JSON.parse(modele.contenu) : { type: 'doc', content: [] })
    : modele.contenu;
  return {
    titre: remplacer(modele.titrePage ?? modele.nom ?? ''),
    icone: modele.icone ?? null,
    couverture: modele.couverture ?? null,
    contenu: JSON.stringify(parcourir(contenu)),
  };
}
