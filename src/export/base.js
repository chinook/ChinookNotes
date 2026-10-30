import { lignesAffichees, lireSchema, texteValeur } from '../base/types.js';

// Une base de données s'exporte comme un tableau : Nom + une colonne par propriété.
// Le nom de chaque ligne est un lien vers sa page (résolu comme les autres liens entre pages).
export function docDeBase(base, lignes) {
  const schema = lireSchema(base.schema);
  const paragraphe = (t, marks) => ({
    type: 'paragraph',
    content: t ? [{ type: 'text', text: t, ...(marks ? { marks } : {}) }] : undefined,
  });

  const entetes = ['Nom', ...schema.colonnes.map((c) => c.nom)];
  const rangees = lignesAffichees(lignes, schema, '', { tout: true }).map((l) => ({
    type: 'tableRow',
    content: [
      { type: 'tableCell', content: [paragraphe(l.titre || 'Sans titre', [{ type: 'link', attrs: { href: `page:${l.id}` } }])] },
      ...schema.colonnes.map((c) => ({ type: 'tableCell', content: [paragraphe(texteValeur(c, l.valeurs[c.id]))] })),
    ],
  }));

  return {
    type: 'doc',
    content: [{
      type: 'table',
      content: [
        { type: 'tableRow', content: entetes.map((t) => ({ type: 'tableHeader', content: [paragraphe(t)] })) },
        ...rangees,
      ],
    }],
  };
}
