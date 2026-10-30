// Lecture d'un CSV (RFC 4180) : champs entre guillemets, guillemets doublés, sauts de ligne dans un champ.
// Retourne { colonnes: [nom…], lignes: [{ nom: valeur }…] }
export function lireCsv(texte) {
  const t = texte.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const rangees = [];
  let champ = '';
  let rangee = [];
  let guillemets = false;

  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (guillemets) {
      if (c === '"' && t[i + 1] === '"') { champ += '"'; i++; }
      else if (c === '"') guillemets = false;
      else champ += c;
    } else if (c === '"') {
      guillemets = true;
    } else if (c === ',') {
      rangee.push(champ); champ = '';
    } else if (c === '\n') {
      rangee.push(champ); champ = '';
      rangees.push(rangee); rangee = [];
    } else {
      champ += c;
    }
  }
  if (champ !== '' || rangee.length > 0) { rangee.push(champ); rangees.push(rangee); }

  const [entete = [], ...corps] = rangees.filter((r) => r.length > 1 || r[0] !== '');
  return {
    colonnes: entete,
    lignes: corps.map((r) => Object.fromEntries(entete.map((nom, i) => [nom, r[i] ?? '']))),
  };
}
