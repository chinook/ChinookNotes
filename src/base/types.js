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
    tri: null,
  };
}

// Les JSON viennent de la base de données : on tolère l'absence ou l'abîme
export function lireSchema(json) {
  try {
    const s = typeof json === 'string' ? JSON.parse(json) : json;
    return { colonnes: [], vue: 'table', groupe: null, tri: null, ...(s || {}) };
  } catch {
    return { colonnes: [], vue: 'table', groupe: null, tri: null };
  }
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

export function comparer(col, a, b) {
  const x = cleTri(col, a);
  const y = cleTri(col, b);
  if (x === null || x === -1) return y === null || y === -1 ? 0 : 1;   // les vides en dernier
  if (y === null || y === -1) return -1;
  return typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'fr', { numeric: true });
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
  const tri = schema.tri;
  if (tri) {
    const col = schema.colonnes.find((c) => c.id === tri.col);
    res.sort((a, b) => tri.sens * (tri.col === 'titre'
      ? (a.titre || '').localeCompare(b.titre || '', 'fr', { numeric: true })
      : (col ? comparer(col, a.valeurs[col.id], b.valeurs[col.id]) : 0)));
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
