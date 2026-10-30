// Déduit le schéma d'une base de données (colonnes typées) à partir d'un export CSV de Notion.
// Le CSV ne contient pas les types : on les devine d'après les valeurs.
import { nouvelId } from '../base/types.js';

const ORDRE_STATUTS = ['à faire', 'en cours', 'à tester', 'terminé', 'désuet'];
const COULEUR_STATUT = { 'à faire': 'gris', 'en cours': 'bleu', 'à tester': 'jaune', 'terminé': 'vert', 'désuet': 'rouge' };
const COULEURS_NUMEROTEES = ['vert', 'bleu', 'jaune', 'orange', 'rouge', 'violet']; // « 1 - … » → « 6 - … »
const COULEURS_CYCLE = ['bleu', 'vert', 'orange', 'violet', 'rose', 'jaune', 'brun'];

const minuscule = (s) => s.toLowerCase();
const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;

function typeDe(valeurs, nbLignes) {
  if (valeurs.length === 0) return 'texte';
  if (valeurs.every((v) => RE_DATE.test(v))) return 'date';
  if (valeurs.every((v) => /^-?\d+([.,]\d+)?$/.test(v.trim()))) return 'nombre';
  if (valeurs.every((v) => /^https?:\/\//.test(v))) return 'url';
  const distinctes = new Set(valeurs);
  const courtes = valeurs.every((v) => v.length <= 40 && !v.includes('\n') && !v.includes(','));
  // peu de valeurs différentes et répétées : c'est une liste d'options
  if (courtes && distinctes.size <= 8 && distinctes.size <= Math.max(2, nbLignes / 3)) return 'select';
  return 'texte';
}

function optionsDe(valeurs, nomColonne) {
  const noms = [...new Set(valeurs)];
  const connus = noms.every((n) => ORDRE_STATUTS.includes(minuscule(n)));
  noms.sort((a, b) => (connus
    ? ORDRE_STATUTS.indexOf(minuscule(a)) - ORDRE_STATUTS.indexOf(minuscule(b))
    : a.localeCompare(b, 'fr', { numeric: true })));
  return noms.map((nom, i) => {
    const num = nom.match(/^(\d)\b/);
    const couleur = connus ? COULEUR_STATUT[minuscule(nom)]
      : num ? COULEURS_NUMEROTEES[(Number(num[1]) - 1) % COULEURS_NUMEROTEES.length]
        : COULEURS_CYCLE[i % COULEURS_CYCLE.length];
    return { id: nouvelId(), nom, couleur };
  });
}

// colonneTitre : la colonne qui sert de titre aux lignes (elle ne devient pas une propriété)
export function schemaDepuisCsv({ colonnes, lignes }, colonneTitre) {
  const defs = colonnes.filter((c) => c !== colonneTitre).map((nom) => {
    const valeurs = lignes.map((l) => l[nom]).filter((v) => v !== '');
    const type = typeDe(valeurs, lignes.length);
    return { id: nouvelId(), nom, type, ...(type === 'select' ? { options: optionsDe(valeurs, nom) } : {}) };
  });

  // Tri par défaut : une colonne « Statut » sert au Kanban, une colonne numérotée (difficulté) au tri
  const statut = defs.find((c) => c.type === 'select' && c.options.some((o) => ORDRE_STATUTS.includes(minuscule(o.nom))));
  const numerotee = defs.find((c) => c.type === 'select' && c.options.every((o) => /^\d\b/.test(o.nom)));
  return {
    colonnes: defs,
    vue: 'table',
    groupe: statut?.id ?? null,
    tri: numerotee ? { col: numerotee.id, sens: 1 } : null,
  };
}

// Valeurs d'une ligne du CSV → propriétés de la page (les select stockent l'identifiant de l'option)
export function proprietesDeLigne(ligne, schema) {
  const props = {};
  for (const col of schema.colonnes) {
    const v = ligne[col.nom];
    if (v === undefined || v === '') continue;
    if (col.type === 'select') props[col.id] = col.options.find((o) => o.nom === v)?.id;
    else if (col.type === 'nombre') props[col.id] = Number(v.replace(',', '.'));
    else props[col.id] = v;
    if (props[col.id] === undefined) delete props[col.id];
  }
  return props;
}
