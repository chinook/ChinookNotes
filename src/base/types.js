// Bases de données : types de colonnes, schéma et valeurs

export const TYPES = [
  { id: 'texte', nom: 'Texte', icone: 'Aa' },
  { id: 'nombre', nom: 'Nombre', icone: '#' },
  { id: 'select', nom: 'Sélection', icone: '▾' },
  { id: 'multiselect', nom: 'Multi-sélection', icone: '☰' },
  { id: 'date', nom: 'Date', icone: '📅' },
  { id: 'case', nom: 'Case à cocher', icone: '☑' },
  { id: 'url', nom: 'Lien (URL)', icone: '🔗' },
];

// Couleurs des options : le fond est translucide pour rester lisible en thème clair comme sombre
export const COULEURS = [
  { id: 'gris', rgb: '120, 119, 116' },
  { id: 'brun', rgb: '159, 107, 83' },
  { id: 'orange', rgb: '217, 115, 13' },
  { id: 'jaune', rgb: '203, 145, 47' },
  { id: 'vert', rgb: '68, 131, 97' },
  { id: 'bleu', rgb: '51, 126, 169' },
  { id: 'violet', rgb: '144, 101, 176' },
  { id: 'rose', rgb: '193, 76, 138' },
  { id: 'rouge', rgb: '212, 76, 71' },
];

export const nouvelId = () => Math.random().toString(36).slice(2, 9);

export const option = (nom, couleur = 'gris') => ({ id: nouvelId(), nom, couleur });

export const styleOption = (opt) => {
  const rgb = COULEURS.find((c) => c.id === opt?.couleur)?.rgb ?? COULEURS[0].rgb;
  return { background: `rgba(${rgb}, 0.22)`, boxShadow: `inset 0 0 0 1px rgba(${rgb}, 0.35)` };
};

export function schemaVide() {
  return {
    colonnes: [
      { id: nouvelId(), nom: 'Statut', type: 'select', options: [option('À faire', 'gris'), option('En cours', 'bleu'), option('Terminé', 'vert')] },
      { id: nouvelId(), nom: 'Date', type: 'date' },
    ],
    vue: 'table',
    groupe: null,
    tris: [],
  };
}

// Les JSON viennent de la base de données : on tolère l'absence ou l'abîme.
// « tris » : les critères de tri par ordre de priorité, [{ id, col, sens }] (sens : 1 croissant, -1 décroissant).
// Un ancien schéma n'avait qu'un seul tri (« tri : { col, sens } ») : il devient le premier critère.
export function lireSchema(json) {
  let s = null;
  try { s = typeof json === 'string' ? JSON.parse(json) : json; } catch { /* schéma illisible : valeurs par défaut */ }
  const { tri, ...reste } = s && typeof s === 'object' ? s : {};
  const tris = Array.isArray(reste.tris) ? reste.tris : (tri?.col ? [{ id: 'tri-1', col: tri.col, sens: tri.sens === -1 ? -1 : 1 }] : []);
  return { colonnes: [], vue: 'table', groupe: null, ...reste, tris };
}

export function lireProprietes(json) {
  try {
    const p = typeof json === 'string' ? JSON.parse(json) : json;
    return p && typeof p === 'object' ? p : {};
  } catch {
    return {};
  }
}

export const optionsDe = (col) => col?.options ?? [];

const estVide = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

// Texte lisible d'une valeur (affichage, filtre, export)
export function texteValeur(col, v) {
  if (estVide(v)) return col.type === 'case' ? '☐' : '';
  switch (col.type) {
    case 'select': return optionsDe(col).find((o) => o.id === v)?.nom ?? '';
    case 'multiselect': return v.map((id) => optionsDe(col).find((o) => o.id === id)?.nom).filter(Boolean).join(', ');
    case 'case': return v ? '☑' : '☐';
    default: return String(v);
  }
}

// Valeur utilisée pour trier
function cleTri(col, v) {
  if (col.type === 'nombre') return estVide(v) ? null : Number(v);
  if (col.type === 'case') return v ? 1 : 0;
  if (col.type === 'select') return optionsDe(col).findIndex((o) => o.id === v); // ordre des options
  return estVide(v) ? null : texteValeur(col, v).toLowerCase();
}

// sens : 1 croissant, -1 décroissant. Les valeurs vides restent toujours en dernier, dans les deux sens.
export function comparer(col, a, b, sens = 1) {
  const x = cleTri(col, a);
  const y = cleTri(col, b);
  const xVide = x === null || x === -1;
  const yVide = y === null || y === -1;
  if (xVide || yVide) return xVide === yVide ? 0 : xVide ? 1 : -1;
  return sens * (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'fr', { numeric: true }));
}

// Critères de tri encore valides (la colonne n'a pas été supprimée), par ordre de priorité
export function trisValides(schema) {
  return (schema.tris || []).filter((t) => t.col === 'titre' || schema.colonnes.some((c) => c.id === t.col));
}

function comparerSelon(tri, a, b, schema) {
  if (tri.col === 'titre') return comparer(COLONNE_NOM, a.titre, b.titre, tri.sens);
  const col = schema.colonnes.find((c) => c.id === tri.col);
  return col ? comparer(col, a.valeurs[col.id], b.valeurs[col.id], tri.sens) : 0;
}

// Clic sur un en-tête de colonne : croissant, puis décroissant, puis plus de tri.
// Sans « ajouter », ce tri remplace les autres ; avec « ajouter » (Maj + clic), il s'ajoute en dernier ou change à sa place.
export function trisApresClic(tris, col, ajouter) {
  const existant = tris.find((t) => t.col === col);
  if (ajouter) {
    if (!existant) return [...tris, { id: nouvelId(), col, sens: 1 }];
    if (existant.sens === 1) return tris.map((t) => (t.col === col ? { ...t, sens: -1 } : t));
    return tris.filter((t) => t.col !== col);
  }
  if (tris.length === 1 && existant) return existant.sens === 1 ? [{ ...existant, sens: -1 }] : [];
  return [{ id: nouvelId(), col, sens: 1 }];
}

// Lignes à afficher : filtres de la vue, lignes masquées, recherche rapide, puis tri.
// options.tout : ignore filtres et lignes masquées (exports) ; options.montrerMasquees : les garde (marquées « masquee »).
export function lignesAffichees(lignes, schema, filtre, options = {}) {
  const f = (filtre || '').trim().toLowerCase();
  const masquees = new Set(options.tout ? [] : (schema.lignesMasquees || []));
  let res = lignes.map((l) => ({ ...l, valeurs: lireProprietes(l.proprietes), masquee: masquees.has(l.id) }));
  if (!options.montrerMasquees) res = res.filter((l) => !l.masquee);
  if (!options.tout) res = appliquerFiltres(res, schema);
  if (f) {
    res = res.filter((l) => (l.titre || '').toLowerCase().includes(f)
      || schema.colonnes.some((c) => texteValeur(c, l.valeurs[c.id]).toLowerCase().includes(f)));
  }
  // Plusieurs critères : le premier tranche, le suivant départage les égalités, et ainsi de suite
  const tris = trisValides(schema);
  if (tris.length > 0) {
    res.sort((a, b) => {
      for (const t of tris) {
        const r = comparerSelon(t, a, b, schema);
        if (r !== 0) return r;
      }
      return 0;
    });
  }
  return res;
}

// ===== Filtres : plusieurs règles combinées par « et » / « ou » =====

export const COLONNE_NOM = { id: 'titre', nom: 'Nom', type: 'texte' };

const OPS_TEXTE = [['contient', 'contient'], ['ne-contient-pas', 'ne contient pas'], ['est', 'est'], ['vide', 'est vide'], ['non-vide', "n'est pas vide"]];
export const OPERATEURS = {
  texte: OPS_TEXTE,
  url: OPS_TEXTE,
  nombre: [['=', '='], ['!=', '≠'], ['>', '>'], ['>=', '≥'], ['<', '<'], ['<=', '≤'], ['vide', 'est vide'], ['non-vide', "n'est pas vide"]],
  select: [['est', 'est'], ['n-est-pas', "n'est pas"], ['vide', 'est vide'], ['non-vide', "n'est pas vide"]],
  multiselect: [['contient', 'contient'], ['ne-contient-pas', 'ne contient pas'], ['vide', 'est vide'], ['non-vide', "n'est pas vide"]],
  date: [['est', 'est le'], ['avant', 'avant le'], ['apres', 'après le'], ['vide', 'est vide'], ['non-vide', "n'est pas vide"]],
  case: [['coche', 'est cochée'], ['decoche', "n'est pas cochée"]],
};

export const sansValeur = (op) => ['vide', 'non-vide', 'coche', 'decoche'].includes(op);

export function colonnesFiltrables(schema) {
  return [COLONNE_NOM, ...schema.colonnes];
}

export function regleParDefaut(schema) {
  const col = colonnesFiltrables(schema)[0];
  return { id: nouvelId(), col: col.id, op: OPERATEURS[col.type][0][0], valeur: '' };
}

// Une règle sans valeur (encore en cours de saisie) ne filtre rien
function regleComplete(r) {
  return sansValeur(r.op) || (r.valeur !== '' && r.valeur !== undefined && r.valeur !== null);
}

function evaluerRegle(ligne, regle, schema) {
  const col = regle.col === 'titre' ? COLONNE_NOM : schema.colonnes.find((c) => c.id === regle.col);
  if (!col) return true; // colonne supprimée depuis : la règle est ignorée
  const v = regle.col === 'titre' ? ligne.titre : ligne.valeurs[col.id];
  const vide = estVide(v);
  const cible = regle.valeur;
  switch (regle.op) {
    case 'vide': return vide;
    case 'non-vide': return !vide;
    case 'coche': return !!v;
    case 'decoche': return !v;
    case 'contient':
      return col.type === 'multiselect' ? Array.isArray(v) && v.includes(cible) : String(v ?? '').toLowerCase().includes(String(cible).toLowerCase());
    case 'ne-contient-pas':
      return col.type === 'multiselect' ? !(Array.isArray(v) && v.includes(cible)) : !String(v ?? '').toLowerCase().includes(String(cible).toLowerCase());
    case 'est':
      return col.type === 'texte' || col.type === 'url' ? String(v ?? '').toLowerCase() === String(cible).toLowerCase() : v === cible;
    case 'n-est-pas': return v !== cible;
    case '=': return !vide && Number(v) === Number(cible);
    case '!=': return vide || Number(v) !== Number(cible);
    case '>': return !vide && Number(v) > Number(cible);
    case '>=': return !vide && Number(v) >= Number(cible);
    case '<': return !vide && Number(v) < Number(cible);
    case '<=': return !vide && Number(v) <= Number(cible);
    case 'avant': return !vide && String(v) < String(cible);
    case 'apres': return !vide && String(v) > String(cible);
    default: return true;
  }
}

export function appliquerFiltres(lignes, schema) {
  const regles = (schema.filtres?.regles || []).filter(regleComplete);
  if (regles.length === 0) return lignes;
  const ou = schema.filtres.logique === 'ou';
  return lignes.filter((l) => (ou ? regles.some((r) => evaluerRegle(l, r, schema)) : regles.every((r) => evaluerRegle(l, r, schema))));
}

export const nbFiltres = (schema) => (schema.filtres?.regles || []).filter(regleComplete).length;

// Texte lisible d'une valeur pour un export CSV
export function valeurCsv(col, v) {
  return col.type === 'case' ? (v ? 'oui' : 'non') : texteValeur(col, v);
}

export function versCsv(schema, lignes) {
  const echapper = (t) => `"${String(t ?? '').replace(/"/g, '""')}"`;
  const entete = ['Nom', ...schema.colonnes.map((c) => c.nom)].map(echapper).join(',');
  const corps = lignes.map((l) => [l.titre || '', ...schema.colonnes.map((c) => valeurCsv(c, l.valeurs[c.id]))].map(echapper).join(','));
  return `﻿${[entete, ...corps].join('\r\n')}\r\n`;
}
