// Volets : plusieurs pages affichées côte à côte ou l'une sous l'autre, comme les groupes d'éditeurs de VS Code.
// La disposition est un arbre :
//   volet     { type: 'volet', id, pageId }
//   scission  { type: 'scission', id, sens: 'ligne' | 'colonne', enfants: [...], tailles: [...] }
// « ligne » met les enfants côte à côte, « colonne » les met l'un sous l'autre ; les tailles sont des proportions.

export const TYPE_PAGE = 'application/x-chinook-page'; // type de données d'une page glissée depuis la barre latérale
export const MAX_VOLETS = 4;

let compteur = 0;
const nouvelId = (prefixe) => `${prefixe}${++compteur}`;

export const nouveauVolet = (pageId = null) => ({ type: 'volet', id: nouvelId('v'), pageId });

export function volets(noeud, res = []) {
  if (noeud.type === 'volet') res.push(noeud);
  else noeud.enfants.forEach((e) => volets(e, res));
  return res;
}

export const trouverVolet = (racine, id) => volets(racine).find((v) => v.id === id) ?? null;

// Remplace un volet par ce que renvoie fn(volet)
export function remplacerVolet(noeud, id, fn) {
  if (noeud.type === 'volet') return noeud.id === id ? fn(noeud) : noeud;
  let change = false;
  const enfants = noeud.enfants.map((e) => {
    const r = remplacerVolet(e, id, fn);
    if (r !== e) change = true;
    return r;
  });
  return change ? { ...noeud, enfants } : noeud;
}

// Coupe un volet en deux : zone = 'gauche' | 'droite' | 'haut' | 'bas', le nouveau volet prend la moitié du côté visé.
// Si la scission qui le contient va déjà dans ce sens, le nouveau volet s'ajoute à côté plutôt que de s'imbriquer.
export function scinder(racine, voletId, zone, nouveau) {
  const sens = zone === 'gauche' || zone === 'droite' ? 'ligne' : 'colonne';
  const avant = zone === 'gauche' || zone === 'haut';

  const aCote = (noeud) => {
    if (noeud.type === 'volet') return null;
    const i = noeud.enfants.findIndex((e) => e.type === 'volet' && e.id === voletId);
    if (i >= 0 && noeud.sens === sens) {
      const enfants = [...noeud.enfants];
      enfants.splice(avant ? i : i + 1, 0, nouveau);
      const tailles = [...noeud.tailles];
      tailles.splice(i, 1, tailles[i] / 2, tailles[i] / 2);
      return { ...noeud, enfants, tailles };
    }
    let change = false;
    const enfants = noeud.enfants.map((e) => {
      const r = aCote(e);
      if (r) change = true;
      return r ?? e;
    });
    return change ? { ...noeud, enfants } : null;
  };

  return aCote(racine) ?? remplacerVolet(racine, voletId, (v) => ({
    type: 'scission',
    id: nouvelId('s'),
    sens,
    enfants: avant ? [nouveau, v] : [v, nouveau],
    tailles: [0.5, 0.5],
  }));
}

// Retire un volet ; une scission qui n'a plus qu'un enfant disparaît. Renvoie null s'il ne reste rien.
export function retirerVolet(noeud, id) {
  if (noeud.type === 'volet') return noeud.id === id ? null : noeud;
  const enfants = [];
  const tailles = [];
  noeud.enfants.forEach((e, i) => {
    const r = retirerVolet(e, id);
    if (r) { enfants.push(r); tailles.push(noeud.tailles[i]); }
  });
  if (enfants.length === 0) return null;
  if (enfants.length === 1) return enfants[0];
  const somme = tailles.reduce((a, b) => a + b, 0);
  return { ...noeud, enfants, tailles: tailles.map((t) => t / somme) };
}

export function majTailles(noeud, scissionId, tailles) {
  if (noeud.type === 'volet') return noeud;
  if (noeud.id === scissionId) return { ...noeud, tailles };
  return { ...noeud, enfants: noeud.enfants.map((e) => majTailles(e, scissionId, tailles)) };
}
