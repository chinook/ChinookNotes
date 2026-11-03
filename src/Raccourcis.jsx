// Liste des raccourcis clavier, pour Windows et pour Mac
const SECTIONS = [
  {
    titre: 'Application',
    lignes: [
      ['Rechercher une page', 'Ctrl + K', '⌘ K'],
      ['Rechercher dans la page', 'Ctrl + F', '⌘ F'],
      ['Cacher / montrer la barre latérale', 'Ctrl + \\', '⌘ \\'],
      ['Annuler la dernière action (page, ligne, cellule…)', 'Ctrl + Z', '⌘ Z'],
      ['Refaire', 'Ctrl + Y ou Ctrl + Maj + Z', '⌘ Maj + Z'],
      ['Page précédente / suivante', 'Alt + ← / →  (ou boutons latéraux de la souris)', '⌥ ← / →  ou  ⌘ [ / ⌘ ]'],
      ['Zoom de l\'application', 'Ctrl + molette', '⌘ + molette'],
      ['Zoom : revenir à 100 %', 'Ctrl + 0', '⌘ 0'],
      ['Fermer la fenêtre ouverte (boîte de dialogue, aperçu, recherche)', 'Échap', 'Échap'],
    ],
  },
  {
    titre: 'Édition du texte',
    lignes: [
      ['Gras', 'Ctrl + B', '⌘ B'],
      ['Italique', 'Ctrl + I', '⌘ I'],
      ['Souligné', 'Ctrl + U', '⌘ U'],
      ['Barré', 'Ctrl + Maj + S', '⌘ Maj + S'],
      ['Code (en ligne)', 'Ctrl + E', '⌘ E'],
      ['Titre 1 à 6', 'Ctrl + Alt + 1 à 6', '⌘ ⌥ 1 à 6'],
      ['Liste à puces', 'Ctrl + Maj + 8', '⌘ Maj + 8'],
      ['Liste numérotée', 'Ctrl + Maj + 7', '⌘ Maj + 7'],
      ['Liste de tâches', 'Ctrl + Maj + 9', '⌘ Maj + 9'],
      ['Citation', 'Ctrl + Maj + B', '⌘ Maj + B'],
      ['Bloc de code', 'Ctrl + Alt + C', '⌘ ⌥ C'],
      ['Saut de ligne dans un paragraphe', 'Maj + Entrée', 'Maj + Entrée'],
      ['Tout sélectionner', 'Ctrl + A', '⌘ A'],
      ['Couper / Copier / Coller', 'Ctrl + X / C / V', '⌘ X / C / V'],
      ['Valider une formule LaTeX', 'Ctrl + Entrée', '⌘ Entrée'],
    ],
  },
  {
    titre: 'Écrire en Markdown (tape puis espace)',
    lignes: [
      ['Titre', '# , ## , ### ', '# , ## , ### '],
      ['Liste à puces', '- ou * ', '- ou * '],
      ['Liste numérotée', '1. ', '1. '],
      ['Liste de tâches', '[ ] ', '[ ] '],
      ['Citation', '> ', '> '],
      ['Bloc de code', '``` ', '``` '],
    ],
  },
];

// Contenu de l'onglet « Raccourcis » des Réglages
export default function Raccourcis() {
  return (
    <div className="raccourcis">
      {SECTIONS.map((s) => (
        <section key={s.titre}>
          <div className="titre-section">{s.titre}</div>
          <table>
            <thead>
              <tr><th>Action</th><th>Windows</th><th>Mac</th></tr>
            </thead>
            <tbody>
              {s.lignes.map(([action, win, mac]) => (
                <tr key={action}>
                  <td>{action}</td>
                  <td><kbd>{win}</kbd></td>
                  <td><kbd>{mac}</kbd></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
