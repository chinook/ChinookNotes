import { useState } from 'react';
import Table from './Table.jsx';
import Kanban from './Kanban.jsx';
import ColonneDialog from './ColonneDialog.jsx';
import Filtres from './Filtres.jsx';
import ColonnesVisibles from './ColonnesVisibles.jsx';
import { COLONNE_NOM, lireProprietes, lireSchema, lignesAffichees, nouvelId, versCsv } from './types.js';
import { actionCorbeille, actionCreation, actionModification, enregistrer } from '../historiqueActions.js';

// base : la page de type « base » ; lignes : ses pages enfants ; onChange : recharger la liste des pages
// onOuvrir : ouvrir une ligne en pleine page ; onApercu : l'ouvrir dans le volet de droite
export default function BaseView({ base, lignes, onChange, onOuvrir, onApercu }) {
  const schema = lireSchema(base.schema);
  const [filtre, setFiltre] = useState('');
  const [voirMasquees, setVoirMasquees] = useState(false);
  const [dialogue, setDialogue] = useState(null); // { colonne } : null = nouvelle colonne
  const [message, setMessage] = useState(null);

  const colonnesSelect = schema.colonnes.filter((c) => c.type === 'select');
  const groupeCol = colonnesSelect.find((c) => c.id === schema.groupe) ?? colonnesSelect[0] ?? null;
  const affichees = lignesAffichees(lignes, schema, filtre, { montrerMasquees: voirMasquees });
  const idsMasquees = (schema.lignesMasquees || []).filter((id) => lignes.some((l) => l.id === id));

  const afficherMessage = (texte) => { setMessage(texte); setTimeout(() => setMessage(null), 3500); };

  const actions = {
    ouvrir: (id) => (onApercu ? onApercu(id) : onOuvrir(id)),
    ouvrirPleine: onOuvrir,
    // Tri, filtres, colonnes, vue : tout le schéma est un seul JSON, donc annuler remet l'ancien
    async majSchema(s) {
      const avant = base.schema ?? null;
      const apres = JSON.stringify(s);
      await window.api.modifierPage(base.id, { schema: apres });
      if (avant !== apres) enregistrer(actionModification(base.id, 'réglages de la base', { schema: avant }, { schema: apres }));
      await onChange();
    },
    async creerLigne(valeurs) {
      const l = await window.api.creerPage(base.id, '');
      if (Object.keys(valeurs).length > 0) await window.api.modifierPage(l.id, { proprietes: JSON.stringify(valeurs) });
      enregistrer(actionCreation(l.id, 'nouvelle ligne'));
      await onChange();
    },
    async majLigne(ligne, champs) {
      const avant = Object.fromEntries(Object.keys(champs).map((k) => [k, ligne[k]]));
      await window.api.modifierPage(ligne.id, champs);
      enregistrer(actionModification(ligne.id, 'modification de ligne', avant, champs));
      await onChange();
    },
    async majValeur(ligne, colId, valeur) {
      const valeurs = { ...lireProprietes(ligne.proprietes) };
      if (valeur === null || valeur === undefined) delete valeurs[colId]; else valeurs[colId] = valeur;
      const avant = ligne.proprietes ?? '{}';
      const apres = JSON.stringify(valeurs);
      await window.api.modifierPage(ligne.id, { proprietes: apres });
      if (avant !== apres) enregistrer(actionModification(ligne.id, 'modification de cellule', { proprietes: avant }, { proprietes: apres }));
      await onChange();
    },
    async supprimerLigne(ligne) {
      // récupérable depuis la corbeille : pas de confirmation
      await window.api.mettreALaCorbeille(ligne.id);
      enregistrer(actionCorbeille(ligne.id, 'suppression de ligne'));
      await onChange();
    },
    async dupliquerLigne(ligne) {
      const copie = await window.api.dupliquerPage(ligne.id);
      enregistrer(actionCreation(copie.id, 'ligne dupliquée'));
      await onChange();
    },
    masquerLigne: (ligne) => actions.majSchema({ ...schema, lignesMasquees: [...new Set([...(schema.lignesMasquees || []), ligne.id])] }),
    afficherLigne: (ligne) => actions.majSchema({ ...schema, lignesMasquees: (schema.lignesMasquees || []).filter((id) => id !== ligne.id) }),
    async effacerCellule(ligne, colonne) {
      if (colonne.id === 'titre') await actions.majLigne(ligne, { titre: '' });
      else await actions.majValeur(ligne, colonne.id, null);
    },
    masquerColonne: (col) => actions.majSchema({ ...schema, masquees: [...new Set([...(schema.masquees || []), col.id])] }),
    async supprimerColonne(col) {
      if (!window.confirm(`Supprimer la colonne « ${col.nom} » ? Les valeurs saisies seront perdues.`)) return;
      await actions.majSchema({
        ...schema,
        colonnes: schema.colonnes.filter((x) => x.id !== col.id),
        groupe: schema.groupe === col.id ? null : schema.groupe,
        tris: (schema.tris || []).filter((t) => t.col !== col.id),
        masquees: (schema.masquees || []).filter((id) => id !== col.id),
        filtres: { ...schema.filtres, regles: (schema.filtres?.regles || []).filter((r) => r.col !== col.id) },
      });
    },
    nouvelleColonne: () => setDialogue({ colonne: null }),
    modifierColonne: (colonne) => setDialogue({ colonne }),

    // Clic droit : actions sur la ligne puis sur la colonne sous la souris
    async menu(ligne, colonne) {
      const estNom = colonne?.id === 'titre';
      const modele = [];
      if (ligne) {
        modele.push(
          { id: 'ouvrir', label: 'Ouvrir dans le volet' },
          { id: 'pleine', label: 'Ouvrir en pleine page' },
          { id: 'dupliquer-ligne', label: 'Dupliquer la ligne' },
          ligne.masquee ? { id: 'afficher-ligne', label: 'Afficher la ligne' } : { id: 'masquer-ligne', label: 'Masquer la ligne' },
          { id: 'effacer', label: 'Effacer la cellule', enabled: !!colonne },
          { id: 'supprimer-ligne', label: 'Supprimer la ligne' },
        );
      }
      if (colonne) {
        if (modele.length) modele.push({ type: 'separator' });
        modele.push(
          { id: 'tri-asc', label: `Trier « ${colonne.nom} » de A à Z` },
          { id: 'tri-desc', label: `Trier « ${colonne.nom} » de Z à A` },
          { id: 'tri-aucun', label: 'Retirer le tri', enabled: (schema.tris || []).some((t) => t.col === colonne.id) },
          { type: 'separator' },
          { id: 'masquer-colonne', label: 'Masquer la colonne', enabled: !estNom },
          { id: 'modifier-colonne', label: 'Modifier la colonne…', enabled: !estNom },
          { id: 'supprimer-colonne', label: 'Supprimer la colonne', enabled: !estNom },
        );
      }
      const choix = await window.api.menuContextuel(modele);
      if (choix === 'ouvrir') actions.ouvrir(ligne.id);
      else if (choix === 'pleine') onOuvrir(ligne.id);
      else if (choix === 'dupliquer-ligne') actions.dupliquerLigne(ligne);
      else if (choix === 'masquer-ligne') actions.masquerLigne(ligne);
      else if (choix === 'afficher-ligne') actions.afficherLigne(ligne);
      else if (choix === 'effacer') actions.effacerCellule(ligne, colonne);
      else if (choix === 'supprimer-ligne') actions.supprimerLigne(ligne);
      else if (choix === 'tri-asc') actions.majSchema({ ...schema, tris: [{ id: nouvelId(), col: colonne.id, sens: 1 }] });
      else if (choix === 'tri-desc') actions.majSchema({ ...schema, tris: [{ id: nouvelId(), col: colonne.id, sens: -1 }] });
      else if (choix === 'tri-aucun') actions.majSchema({ ...schema, tris: (schema.tris || []).filter((t) => t.col !== colonne.id) });
      else if (choix === 'masquer-colonne') actions.masquerColonne(colonne);
      else if (choix === 'modifier-colonne') setDialogue({ colonne });
      else if (choix === 'supprimer-colonne') actions.supprimerColonne(colonne);
    },
  };

  async function validerColonne(colonne) {
    const existe = schema.colonnes.some((c) => c.id === colonne.id);
    const colonnes = existe ? schema.colonnes.map((c) => (c.id === colonne.id ? colonne : c)) : [...schema.colonnes, colonne];
    await actions.majSchema({ ...schema, colonnes });
    setDialogue(null);
  }

  async function supprimerDepuisDialogue() {
    const colonne = dialogue.colonne;
    setDialogue(null);
    await actions.supprimerColonne(colonne);
  }

  // Ce qu'on voit (filtres appliqués, lignes masquées exclues) part en CSV, lisible dans Excel
  async function exporterCsv() {
    const dest = await window.api.choisirDestination({ mode: 'fichier', nom: `${(base.titre || 'base').replace(/[<>:"/\\|?*]/g, '')}.csv`, extension: 'csv' });
    if (!dest) return;
    await window.api.ecrireFichiers(dest.dossier, [{ chemin: dest.nom, texte: versCsv(schema, lignesAffichees(lignes, schema, filtre)) }]);
    afficherMessage(`✓ ${dest.nom} exporté`);
  }

  return (
    <div className="base">
      <div className="base-barre">
        <div className="base-vues">
          {[['table', '▦ Table'], ['kanban', '▥ Kanban']].map(([id, nom]) => (
            <button key={id} className={'base-vue' + (schema.vue === id ? ' actif' : '')} onClick={() => actions.majSchema({ ...schema, vue: id })}>{nom}</button>
          ))}
        </div>
        {schema.vue === 'kanban' && colonnesSelect.length > 1 && (
          <label className="base-groupe">
            Grouper par
            <select value={groupeCol?.id ?? ''} onChange={(e) => actions.majSchema({ ...schema, groupe: e.target.value })}>
              {colonnesSelect.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </label>
        )}
        <span style={{ flex: 1 }} />
        {message && <span className="aide">{message}</span>}
        <Filtres
          schema={schema}
          onChange={(filtres) => actions.majSchema({ ...schema, filtres })}
          onTris={(tris) => actions.majSchema({ ...schema, tris })}
        />
        <ColonnesVisibles schema={schema} onChange={(masquees) => actions.majSchema({ ...schema, masquees })} />
        {idsMasquees.length > 0 && (
          <button className={'base-outil' + (voirMasquees ? ' actif' : '')} onClick={() => setVoirMasquees((v) => !v)} title="Afficher temporairement les lignes masquées">
            🙈 {idsMasquees.length} ligne{idsMasquees.length > 1 ? 's' : ''} masquée{idsMasquees.length > 1 ? 's' : ''}
          </button>
        )}
        <button className="base-outil" onClick={exporterCsv} title="Exporter ce qui est affiché en CSV">⤓ CSV</button>
        <input className="champ base-filtre" value={filtre} placeholder="Rechercher…" onChange={(e) => setFiltre(e.target.value)} />
        <button className="primaire base-nouvelle" onClick={() => actions.creerLigne({})}>+ Nouvelle</button>
      </div>

      {schema.vue === 'table' && <Table schema={schema} lignes={affichees} actions={actions} />}

      {schema.vue === 'kanban' && (groupeCol ? (
        <Kanban schema={schema} lignes={affichees} groupeCol={groupeCol} actions={actions} />
      ) : (
        <div className="base-vide">
          <p>Le Kanban range les lignes selon une colonne de type « Sélection ».</p>
          <button onClick={actions.nouvelleColonne}>Ajouter une colonne</button>
        </div>
      ))}

      {lignes.length === 0 && <p className="aide base-aide">Aucune ligne pour l'instant. Chaque ligne est une page : tu peux l'ouvrir pour y écrire.</p>}
      {lignes.length > 0 && affichees.length === 0 && <p className="aide base-aide">Aucune ligne ne correspond aux filtres ou à la recherche.</p>}

      {dialogue && (
        <ColonneDialog
          colonne={dialogue.colonne}
          onValider={validerColonne}
          onSupprimer={supprimerDepuisDialogue}
          onFermer={() => setDialogue(null)}
        />
      )}
    </div>
  );
}
