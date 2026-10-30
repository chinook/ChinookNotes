const { app } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');

let db;

function ouvrirBase() {
    const chemin = path.join(app.getPath('userData'), 'notes.db');
    db = new Database(chemin);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    db.exec(`
        CREATE TABLE IF NOT EXISTS pages (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            parent_id  INTEGER,
            titre      TEXT NOT NULL DEFAULT '',
            icone      TEXT,
            couverture TEXT,
            contenu    TEXT NOT NULL DEFAULT '',
            position   INTEGER NOT NULL DEFAULT 0,
            favori     INTEGER NOT NULL DEFAULT 0,
            cree_le    TEXT NOT NULL,
            modifie_le TEXT NOT NULL,
            FOREIGN KEY (parent_id) REFERENCES pages(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_pages_parent ON pages(parent_id, position);

        CREATE TABLE IF NOT EXISTS modeles (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            nom        TEXT NOT NULL,
            icone      TEXT,
            couverture TEXT,
            contenu    TEXT NOT NULL DEFAULT '',
            cree_le    TEXT NOT NULL
        );
    `);

    // Colonnes ajoutées après la première version : bases déjà créées
    const colonnes = db.prepare('PRAGMA table_info(pages)').all().map(c => c.name);
    if (!colonnes.includes('source_id')) db.exec('ALTER TABLE pages ADD COLUMN source_id TEXT');
    if (!colonnes.includes('source_nom')) db.exec('ALTER TABLE pages ADD COLUMN source_nom TEXT');

    // Bases de données : une page de type « base » porte le schéma (colonnes, vue) ;
    // ses lignes sont des pages enfants, avec leurs valeurs dans « proprietes »
    if (!colonnes.includes('type')) db.exec("ALTER TABLE pages ADD COLUMN type TEXT NOT NULL DEFAULT 'page'");
    if (!colonnes.includes('schema')) db.exec('ALTER TABLE pages ADD COLUMN schema TEXT');
    if (!colonnes.includes('proprietes')) db.exec("ALTER TABLE pages ADD COLUMN proprietes TEXT NOT NULL DEFAULT '{}'");
    db.exec('CREATE INDEX IF NOT EXISTS idx_pages_source ON pages(source_id)');

    // Corbeille : une page supprimée garde ses données ; « corbeille_racine » est la page sur laquelle
    // on a cliqué (ses sous-pages partent avec elle et reviennent avec elle)
    if (!colonnes.includes('corbeille_le')) db.exec('ALTER TABLE pages ADD COLUMN corbeille_le TEXT');
    if (!colonnes.includes('corbeille_racine')) db.exec('ALTER TABLE pages ADD COLUMN corbeille_racine INTEGER');
    if (!colonnes.includes('modifie_par')) db.exec('ALTER TABLE pages ADD COLUMN modifie_par TEXT');

    db.exec(`
        CREATE TABLE IF NOT EXISTS reglages (
            cle    TEXT PRIMARY KEY,
            valeur TEXT
        );

        CREATE TABLE IF NOT EXISTS emojis (
            id      INTEGER PRIMARY KEY AUTOINCREMENT,
            nom     TEXT NOT NULL,
            image   TEXT NOT NULL,
            cree_le TEXT NOT NULL
        );
    `);

    // Base d'avant la recherche : le texte est calculé AVANT de créer les déclencheurs de l'index,
    // sinon ils retireraient de l'index des lignes qui n'y ont jamais été
    const texteAjoute = !colonnes.includes('texte');
    if (texteAjoute) {
        db.exec("ALTER TABLE pages ADD COLUMN texte TEXT NOT NULL DEFAULT ''");
        remplirTexte();
    }
    creerRecherche();
    if (texteAjoute) db.exec("INSERT INTO pages_fts(pages_fts) VALUES ('rebuild')");

    // Première ouverture : une page d'accueil pour ne pas démarrer sur un écran vide
    if (db.prepare('SELECT COUNT(*) AS n FROM pages').get().n === 0) {
        creerPage(null, 'Bienvenue', '👋');
    }
}

// Index plein texte (FTS5) sur le titre et le texte brut des pages.
// Sans accents ni majuscules : « telemetrie » trouve « Télémétrie ».
function creerRecherche() {
    db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts USING fts5(
            titre, texte,
            content='pages', content_rowid='id',
            tokenize='unicode61 remove_diacritics 2'
        );

        CREATE TRIGGER IF NOT EXISTS pages_ai AFTER INSERT ON pages BEGIN
            INSERT INTO pages_fts(rowid, titre, texte) VALUES (new.id, new.titre, new.texte);
        END;
        CREATE TRIGGER IF NOT EXISTS pages_ad AFTER DELETE ON pages BEGIN
            INSERT INTO pages_fts(pages_fts, rowid, titre, texte) VALUES ('delete', old.id, old.titre, old.texte);
        END;
        CREATE TRIGGER IF NOT EXISTS pages_au AFTER UPDATE OF titre, texte ON pages BEGIN
            INSERT INTO pages_fts(pages_fts, rowid, titre, texte) VALUES ('delete', old.id, old.titre, old.texte);
            INSERT INTO pages_fts(rowid, titre, texte) VALUES (new.id, new.titre, new.texte);
        END;
    `);
}

function remplirTexte() {
    const maj = db.prepare('UPDATE pages SET texte = ? WHERE id = ?');
    db.transaction(() => {
        for (const p of db.prepare('SELECT id, contenu FROM pages').all()) maj.run(texteDe(p.contenu), p.id);
    })();
}

// Le contenu est un document TipTap en JSON : on en extrait le texte, bloc par bloc
function texteDe(contenu) {
    if (!contenu) return '';
    let doc;
    try { doc = JSON.parse(contenu); } catch { return contenu; }
    const morceaux = [];
    const parcourir = (n) => {
        if (n.type === 'text') { morceaux.push(n.text); return; }
        if (n.attrs?.latex) morceaux.push(n.attrs.latex + ' ');
        (n.content || []).forEach(parcourir);
        morceaux.push('\n');
    };
    parcourir(doc);
    return morceaux.join('');
}

function maintenant() {
    return new Date().toISOString();
}

// Toutes les pages sans le contenu : suffisant pour dessiner l'arborescence
function listePages() {
    return db.prepare(`
        SELECT id, parent_id, titre, icone, position, favori, source_id, source_nom, type, schema, proprietes,
               modifie_le, modifie_par
        FROM pages
        WHERE corbeille_le IS NULL
        ORDER BY position, id
    `).all();
}

function pagesRecentes(limite = 10) {
    return db.prepare(`
        SELECT id, parent_id, titre, icone FROM pages
        WHERE corbeille_le IS NULL
        ORDER BY modifie_le DESC, id DESC LIMIT ?
    `).all(limite);
}

// Chaque mot devient un préfixe : « sensor » trouve « SensorData ».
// Dans les extraits, les caractères de contrôle 1 et 2 entourent les mots trouvés.
function rechercher(requete, limite = 30) {
    const mots = (requete || '').split(/\s+/).map(m => m.replace(/"/g, '')).filter(Boolean);
    if (mots.length === 0) return [];
    const match = mots.map(m => `"${m}"*`).join(' ');
    return db.prepare(`
        SELECT p.id, p.parent_id, p.titre, p.icone,
               snippet(pages_fts, 1, char(1), char(2), '…', 16) AS extrait
        FROM pages_fts
        JOIN pages p ON p.id = pages_fts.rowid
        WHERE pages_fts MATCH ? AND p.corbeille_le IS NULL
        ORDER BY bm25(pages_fts, 10.0, 1.0)
        LIMIT ?
    `).all(match, limite);
}

function lirePage(id) {
    return db.prepare('SELECT * FROM pages WHERE id = ?').get(id);
}

function creerPage(parentId, titre = '', icone = null) {
    const position = db.prepare(`
        SELECT COALESCE(MAX(position) + 1, 0) AS p FROM pages WHERE parent_id IS ?
    `).get(parentId ?? null).p;
    const t = maintenant();
    const info = db.prepare(`
        INSERT INTO pages (parent_id, titre, icone, position, cree_le, modifie_le, modifie_par)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(parentId ?? null, titre, icone, position, t, t, reglage('auteur'));
    return lirePage(info.lastInsertRowid);
}

// Page de type « base » : le schéma est un JSON { colonnes, vue, groupe, tri }
function creerBase(parentId, titre, icone, schema) {
    const page = creerPage(parentId, titre, icone);
    db.prepare("UPDATE pages SET type = 'base', schema = ? WHERE id = ?").run(schema, page.id);
    return lirePage(page.id);
}

const CHAMPS_MODIFIABLES = ['titre', 'icone', 'couverture', 'contenu', 'favori', 'schema', 'proprietes'];

function modifierPage(id, champs) {
    const cles = Object.keys(champs).filter(c => CHAMPS_MODIFIABLES.includes(c));
    if (cles.length === 0) return lirePage(id);
    const valeurs = { ...champs };
    if (cles.includes('contenu')) {
        cles.push('texte');
        valeurs.texte = texteDe(champs.contenu);
    }
    const sets = cles.map(c => `${c} = ?`).join(', ');
    db.prepare(`UPDATE pages SET ${sets}, modifie_le = ?, modifie_par = ? WHERE id = ?`)
        .run(...cles.map(c => valeurs[c]), maintenant(), reglage('auteur'), id);
    return lirePage(id);
}

// Réglages de l'application (nom de l'auteur, largeur des pages…) : de simples paires clé / valeur
function reglage(cle, defaut = null) {
    const ligne = db.prepare('SELECT valeur FROM reglages WHERE cle = ?').get(cle);
    return ligne ? ligne.valeur : defaut;
}

function ecrireReglage(cle, valeur) {
    db.prepare(`
        INSERT INTO reglages (cle, valeur) VALUES (?, ?)
        ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur
    `).run(cle, valeur === null || valeur === undefined ? null : String(valeur));
    return tousReglages();
}

function tousReglages() {
    return Object.fromEntries(db.prepare('SELECT cle, valeur FROM reglages').all().map(r => [r.cle, r.valeur]));
}

// Un parent ne peut pas devenir enfant de sa propre descendance
function estDescendant(id, candidatId) {
    let courant = candidatId;
    while (courant != null) {
        if (courant === id) return true;
        courant = db.prepare('SELECT parent_id FROM pages WHERE id = ?').get(courant)?.parent_id;
    }
    return false;
}

function deplacerPage(id, nouveauParentId, position) {
    const parent = nouveauParentId ?? null;
    if (parent !== null && estDescendant(id, parent)) {
        throw new Error('Impossible de déplacer une page dans elle-même.');
    }
    if (parent !== null && lirePage(parent)?.type === 'base') {
        throw new Error('Impossible de déplacer une page dans une base de données.');
    }
    placerPage(id, parent, position);
}

// Met la page à la place voulue parmi ses frères, sans contrôle : réservé aux copies, qui restent
// dans leur base de données (la règle « rien dans une base » ne vaut que pour un déplacement de l'utilisateur)
function placerPage(id, parent, position) {
    db.transaction(() => {
        const freres = db.prepare(`
            SELECT id FROM pages WHERE parent_id IS ? AND id != ? AND corbeille_le IS NULL ORDER BY position, id
        `).all(parent, id).map(r => r.id);
        const index = Math.max(0, Math.min(position ?? freres.length, freres.length));
        freres.splice(index, 0, id);
        db.prepare('UPDATE pages SET parent_id = ? WHERE id = ?').run(parent, id);
        const maj = db.prepare('UPDATE pages SET position = ? WHERE id = ?');
        freres.forEach((fid, i) => maj.run(i, fid));
    })();
}

// Les sous-pages partent avec elle grâce au ON DELETE CASCADE
function supprimerPage(id) {
    db.prepare('DELETE FROM pages WHERE id = ?').run(id);
}

// Crée les pages d'un import, parents avant enfants. Une page déjà importée
// (même identifiant Notion) n'est pas recréée : on garde ce que l'utilisateur a pu modifier.
function importerPages(liste) {
    const ids = {};
    const trouver = db.prepare('SELECT id FROM pages WHERE source_id = ? AND corbeille_le IS NULL');
    const marquer = db.prepare('UPDATE pages SET source_id = ?, source_nom = ? WHERE id = ?');
    db.transaction(() => {
        for (const p of liste) {
            const existant = p.sourceId ? trouver.get(p.sourceId) : null;
            if (existant) {
                ids[p.cle] = { id: existant.id, nouveau: false };
                continue;
            }
            const parent = p.parentCle ? ids[p.parentCle].id : (p.parentId ?? null);
            const page = p.type === 'base'
                ? creerBase(parent, p.titre, p.icone, p.schema)
                : creerPage(parent, p.titre, p.icone);
            if (p.proprietes) db.prepare('UPDATE pages SET proprietes = ? WHERE id = ?').run(p.proprietes, page.id);
            marquer.run(p.sourceId ?? null, p.cle, page.id);
            ids[p.cle] = { id: page.id, nouveau: true };
        }
    })();
    return ids;
}

// La page et toutes ses sous-pages
function idsSousArbre(id) {
    return db.prepare(`
        WITH RECURSIVE s(id) AS (
            SELECT ? UNION ALL SELECT p.id FROM pages p JOIN s ON p.parent_id = s.id
        )
        SELECT id FROM s
    `).all(id).map(r => r.id);
}

// Corbeille : rien n'est effacé. La page et ses sous-pages disparaissent de l'arborescence,
// de la recherche et des exports jusqu'à leur restauration.
function mettreALaCorbeille(id) {
    const maj = db.prepare('UPDATE pages SET corbeille_le = ?, corbeille_racine = ? WHERE id = ? AND corbeille_le IS NULL');
    const t = maintenant();
    db.transaction(() => idsSousArbre(id).forEach(pid => maj.run(t, id, pid)))();
}

function listeCorbeille() {
    return db.prepare(`
        SELECT p.id, p.titre, p.icone, p.type, p.corbeille_le,
               (SELECT COUNT(*) FROM pages c WHERE c.corbeille_racine = p.id) - 1 AS sous_pages
        FROM pages p
        WHERE p.corbeille_racine = p.id
        ORDER BY p.corbeille_le DESC
    `).all();
}

function restaurerPage(id) {
    db.transaction(() => {
        db.prepare('UPDATE pages SET corbeille_le = NULL, corbeille_racine = NULL WHERE corbeille_racine = ?').run(id);
        // son parent est peut-être encore dans la corbeille : elle revient alors à la racine
        const page = lirePage(id);
        if (page?.parent_id != null && lirePage(page.parent_id)?.corbeille_le) {
            db.prepare('UPDATE pages SET parent_id = NULL WHERE id = ?').run(id);
        }
    })();
}

function viderCorbeille() {
    db.prepare('DELETE FROM pages WHERE id IN (SELECT id FROM pages WHERE corbeille_racine = id)').run();
}

// Copie de la page et de ses sous-pages (lignes d'une base comprises), juste après l'originale.
// parentId : où placer la copie (par défaut, à côté de l'originale).
function dupliquerPage(id, parentId) {
    const source = lirePage(id);
    const aCote = parentId === undefined;
    const parent = aCote ? source.parent_id : parentId;
    const auteur = reglage('auteur');
    const insertion = db.prepare(`
        INSERT INTO pages (parent_id, titre, icone, couverture, contenu, position, cree_le, modifie_le,
                           type, schema, proprietes, texte, modifie_par)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const copier = (srcId, parentCopie, suffixe) => {
        const s = lirePage(srcId);
        const position = db.prepare('SELECT COALESCE(MAX(position) + 1, 0) AS p FROM pages WHERE parent_id IS ?').get(parentCopie ?? null).p;
        const t = maintenant();
        const nid = insertion.run(parentCopie ?? null, s.titre + suffixe, s.icone, s.couverture, s.contenu, position, t, t,
            s.type, s.schema, s.proprietes, s.texte, auteur).lastInsertRowid;
        const enfants = db.prepare('SELECT id FROM pages WHERE parent_id = ? AND corbeille_le IS NULL ORDER BY position, id').all(srcId);
        for (const e of enfants) copier(e.id, nid, '');
        return nid;
    };
    const nid = db.transaction(() => copier(id, parent, ' (copie)'))();
    if (aCote) {
        const freres = db.prepare('SELECT id FROM pages WHERE parent_id IS ? AND id != ? AND corbeille_le IS NULL ORDER BY position, id')
            .all(parent ?? null, nid).map(r => r.id);
        placerPage(nid, parent, freres.indexOf(id) + 1);
    }
    return lirePage(nid);
}

// Activité affichée dans le profil. Les lignes d'une base de données sont comptées à part.
function statsProfil() {
    const debutJour = new Date(); debutJour.setHours(0, 0, 0, 0);
    const debutSemaine = new Date(debutJour); debutSemaine.setDate(debutSemaine.getDate() - 6);
    const un = (sql, ...params) => db.prepare(sql).get(...params).n;
    const horsLignes = "corbeille_le IS NULL AND type = 'page' AND (parent_id IS NULL OR parent_id NOT IN (SELECT id FROM pages WHERE type = 'base'))";
    return {
        pages: un(`SELECT COUNT(*) AS n FROM pages WHERE ${horsLignes}`),
        bases: un("SELECT COUNT(*) AS n FROM pages WHERE type = 'base' AND corbeille_le IS NULL"),
        lignes: un("SELECT COUNT(*) AS n FROM pages WHERE corbeille_le IS NULL AND parent_id IN (SELECT id FROM pages WHERE type = 'base')"),
        creeesSemaine: un('SELECT COUNT(*) AS n FROM pages WHERE corbeille_le IS NULL AND cree_le >= ?', debutSemaine.toISOString()),
        modifieesAujourdhui: un('SELECT COUNT(*) AS n FROM pages WHERE corbeille_le IS NULL AND modifie_le >= ?', debutJour.toISOString()),
        corbeille: un('SELECT COUNT(*) AS n FROM pages WHERE corbeille_racine = id'),
        recentes: db.prepare(`
            SELECT id, titre, icone, modifie_le, modifie_par FROM pages
            WHERE corbeille_le IS NULL ORDER BY modifie_le DESC, id DESC LIMIT 8
        `).all(),
    };
}

// Emojis personnalisés : des images (petites) qu'on peut choisir comme icône de page
function listeEmojis() {
    return db.prepare('SELECT id, nom, image FROM emojis ORDER BY nom COLLATE NOCASE').all();
}

function creerEmoji({ nom, image }) {
    const info = db.prepare('INSERT INTO emojis (nom, image, cree_le) VALUES (?, ?, ?)').run(nom, image, maintenant());
    return db.prepare('SELECT id, nom, image FROM emojis WHERE id = ?').get(info.lastInsertRowid);
}

function supprimerEmoji(id) {
    db.prepare('DELETE FROM emojis WHERE id = ?').run(id);
}

// Modèles de pages créés par l'utilisateur (les modèles intégrés vivent dans l'interface)
function listeModeles() {
    return db.prepare('SELECT id, nom, icone, couverture, contenu FROM modeles ORDER BY nom COLLATE NOCASE').all();
}

function creerModele({ nom, icone, couverture, contenu }) {
    const info = db.prepare(`
        INSERT INTO modeles (nom, icone, couverture, contenu, cree_le) VALUES (?, ?, ?, ?, ?)
    `).run(nom, icone ?? null, couverture ?? null, contenu ?? '', maintenant());
    return db.prepare('SELECT id, nom, icone, couverture, contenu FROM modeles WHERE id = ?').get(info.lastInsertRowid);
}

function supprimerModele(id) {
    db.prepare('DELETE FROM modeles WHERE id = ?').run(id);
}

module.exports = {
    ouvrirBase,
    listePages,
    lirePage,
    pagesRecentes,
    rechercher,
    creerPage,
    creerBase,
    modifierPage,
    deplacerPage,
    supprimerPage,
    importerPages,
    reglage,
    ecrireReglage,
    tousReglages,
    mettreALaCorbeille,
    listeCorbeille,
    restaurerPage,
    viderCorbeille,
    dupliquerPage,
    statsProfil,
    listeEmojis,
    creerEmoji,
    supprimerEmoji,
    listeModeles,
    creerModele,
    supprimerModele,
};
