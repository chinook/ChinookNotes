import { analyserFichier, convertirCorps, creerResolveurLiens, separerEmoji } from './convertir.js';
import { estNatif, importerNatif } from './natif.js';

const norm = (s) => s.normalize('NFC').toLowerCase();

// Les pages sans parent d'abord (« Vue globale » en tête), puis les enfants, pour créer les parents avant eux
function ordonner(analyses, parentDe) {
  const racines = analyses
    .filter((a) => !parentDe(a))
    .sort((a, b) => Number(/vue_globale/i.test(b.nom)) - Number(/vue_globale/i.test(a.nom)) || a.nom.localeCompare(b.nom));
  const ordre = [...racines];
  const places = new Set(racines.map((a) => a.nom));
  let reste = analyses.filter((a) => !places.has(a.nom));
  while (reste.length) {
    const pret = reste.filter((a) => {
      const p = parentDe(a);
      return !p.nouveau || places.has(p.nom);
    });
    if (pret.length === 0) { ordre.push(...reste); break; }
    pret.sort((a, b) => a.nom.localeCompare(b.nom));
    for (const a of pret) { ordre.push(a); places.add(a.nom); }
    reste = reste.filter((a) => !places.has(a.nom));
  }
  return ordre;
}

// lot : { fichiers: [{nom, chemin, texte}], tables: [{nom, chemin, texte}], images: [{nom, dataUrl}] }
// Deux formats : la sauvegarde « FichiersMD » (en-tête « Exporté depuis Notion ») et l'export natif
// de Notion (noms de fichiers terminés par un identifiant de 32 caractères, CSV pour les bases).
export async function importerLot(lot, surProgres = () => {}) {
  const natifs = lot.fichiers.filter((f) => estNatif(f.nom));
  const classiques = lot.fichiers.filter((f) => !estNatif(f.nom));
  const total = { importees: 0, ignorees: 0, avertissements: [] };
  const cumuler = (r) => {
    total.importees += r.importees;
    total.ignorees += r.ignorees;
    total.avertissements.push(...r.avertissements);
  };
  if (classiques.length > 0) cumuler(await importerClassique({ ...lot, fichiers: classiques }, surProgres));
  if (natifs.length > 0) cumuler(await importerNatif(lot, natifs, surProgres));
  if (classiques.length === 0 && natifs.length === 0) total.avertissements.push('Aucun fichier .md trouvé dans ce dossier.');
  return total;
}

async function importerClassique(lot, surProgres) {
  const avertissements = [];
  const existantes = await window.api.listePages();
  const analyses = lot.fichiers
    .filter((f) => !/^readme\.md$/i.test(f.nom))
    .map((f) => analyserFichier(f.nom, f.texte));

  // Retrouver le parent d'une page à partir du titre écrit dans « Page parente »
  const parDuTitre = (titreParent) => {
    const cle = norm(titreParent);
    const nouveau = analyses.find((a) => norm(a.titre) === cle);
    if (nouveau) return { nouveau: true, nom: nouveau.nom };
    const ancien = existantes.find((p) => norm(separerEmoji(p.titre).titre) === cle);
    return ancien ? { nouveau: false, id: ancien.id } : null;
  };
  const parents = new Map();
  for (const a of analyses) {
    if (!a.parentTitre) continue;
    const p = parDuTitre(a.parentTitre);
    if (p) parents.set(a.nom, p);
    else avertissements.push(`${a.nom} : page parente « ${a.parentTitre} » introuvable, importée à la racine`);
  }

  const ordre = ordonner(analyses, (a) => parents.get(a.nom));
  const plan = ordre.map((a) => {
    const p = parents.get(a.nom);
    return {
      cle: a.nom,
      titre: a.titre,
      icone: a.icone,
      sourceId: a.sourceId,
      parentCle: p?.nouveau ? p.nom : null,
      parentId: p && !p.nouveau ? p.id : null,
    };
  });

  surProgres(`Création de ${plan.length} pages…`);
  const ids = await window.api.importerPages(plan);

  // Pour les liens : pages de cet import + pages déjà importées avant
  const nomParId = new Map(existantes.filter((p) => p.source_nom).map((p) => [p.id, p.source_nom]));
  const entrees = [
    ...existantes.filter((p) => p.source_nom).map((p) => ({ nom: p.source_nom, id: p.id, parentNom: nomParId.get(p.parent_id) ?? null })),
    ...ordre.map((a) => ({ nom: a.nom, id: ids[a.nom].id, parentNom: parents.get(a.nom)?.nom ?? nomParId.get(parents.get(a.nom)?.id) ?? null })),
  ];
  const resoudreLien = creerResolveurLiens(entrees);

  let importees = 0;
  let ignorees = 0;
  for (const a of ordre) {
    const { id, nouveau } = ids[a.nom];
    if (!nouveau) { ignorees++; continue; }
    surProgres(`Conversion : ${a.titre}`);
    const doc = convertirCorps(a.corps, {
      page: a.nom,
      depuis: entrees.find((e) => e.nom === a.nom),
      images: lot.images,
      resoudreLien,
      avertissements,
    });
    await window.api.modifierPage(id, { contenu: JSON.stringify(doc) });
    importees++;
  }

  return { importees, ignorees, avertissements };
}
