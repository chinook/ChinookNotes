const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const db = require('./db');

function createWindow() {
  const win = new BrowserWindow({
    width: 1400, height: 900,
    show: false,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Boutons « précédent » / « suivant » de la souris (Windows) : on les relaie à l'interface
  win.on('app-command', (event, commande) => {
    if (commande === 'browser-backward') win.webContents.send('nav', 'retour');
    if (commande === 'browser-forward') win.webContents.send('nav', 'avance');
  });

  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
  });

  if (process.env.NOTES_DEV) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

ipcMain.handle('pages:liste', () => db.listePages());
ipcMain.handle('modeles:liste', () => db.listeModeles());
ipcMain.handle('modeles:creer', (event, modele) => db.creerModele(modele));
ipcMain.handle('modeles:supprimer', (event, id) => db.supprimerModele(id));
ipcMain.handle('pages:recentes', () => db.pagesRecentes());
ipcMain.handle('pages:rechercher', (event, requete) => db.rechercher(requete));
ipcMain.handle('pages:lire', (event, id) => db.lirePage(id));
ipcMain.handle('pages:creer', (event, parentId, titre) => db.creerPage(parentId, titre));
ipcMain.handle('pages:creer-base', (event, parentId, titre, icone, schema) => db.creerBase(parentId, titre, icone, schema));
ipcMain.handle('pages:modifier', (event, id, champs) => db.modifierPage(id, champs));
ipcMain.handle('pages:deplacer', (event, id, parentId, position) => db.deplacerPage(id, parentId, position));
ipcMain.handle('pages:supprimer', (event, id) => db.supprimerPage(id));
ipcMain.handle('pages:corbeille', (event, id) => db.mettreALaCorbeille(id));
ipcMain.handle('pages:corbeille-liste', () => db.listeCorbeille());
ipcMain.handle('pages:restaurer', (event, id) => db.restaurerPage(id));
ipcMain.handle('pages:vider-corbeille', () => db.viderCorbeille());
ipcMain.handle('pages:dupliquer', (event, id, parentId) => db.dupliquerPage(id, parentId));
ipcMain.handle('profil:stats', () => db.statsProfil());
ipcMain.handle('reglages:lire', () => db.tousReglages());
ipcMain.handle('reglages:ecrire', (event, cle, valeur) => db.ecrireReglage(cle, valeur));
ipcMain.handle('emojis:liste', () => db.listeEmojis());
ipcMain.handle('emojis:creer', (event, emoji) => db.creerEmoji(emoji));
ipcMain.handle('emojis:supprimer', (event, id) => db.supprimerEmoji(id));

// Menu contextuel natif. modele : [{ id, label, enabled?, role?, submenu?, type?: 'separator' }].
// Une entrée avec « role » (couper, copier, coller…) est exécutée par le système sur la zone de saisie ;
// les autres répondent avec leur « id » (null si le menu est fermé sans choix).
ipcMain.handle('menu:popup', (event, modele) => new Promise((resolve) => {
  let fini = false;
  const finir = (valeur) => { if (!fini) { fini = true; resolve(valeur); } };
  const convertir = (entrees) => entrees.map((e) => {
    if (e.type === 'separator') return { type: 'separator' };
    const item = { label: e.label, enabled: e.enabled !== false };
    if (e.role) item.role = e.role;
    if (e.submenu) item.submenu = convertir(e.submenu);
    else if (!e.role) item.click = () => finir(e.id);
    return item;
  });
  Menu.buildFromTemplate(convertir(modele)).popup({
    window: BrowserWindow.fromWebContents(event.sender),
    callback: () => setTimeout(() => finir(null), 50),
  });
}));

const EXT_IMAGES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' };

const relatif = (base, chemin) => path.relative(base, chemin).split(path.sep).join('/');

// Lit récursivement les .md, les .csv (bases de données) et les images d'un dossier d'export (Notion ou sauvegarde)
function lireDossierImport(dossier) {
  const fichiers = [];
  const tables = [];
  const images = [];
  const parcourir = (dir) => {
    for (const entree of fs.readdirSync(dir, { withFileTypes: true })) {
      const chemin = path.join(dir, entree.name);
      if (entree.isDirectory()) { parcourir(chemin); continue; }
      const ext = path.extname(entree.name).toLowerCase();
      if (ext === '.md') {
        fichiers.push({ nom: entree.name, chemin: relatif(dossier, chemin), texte: fs.readFileSync(chemin, 'utf8').replace(/^\uFEFF/, '') });
      } else if (ext === '.csv') {
        tables.push({ nom: entree.name, chemin: relatif(dossier, chemin), texte: fs.readFileSync(chemin, 'utf8') });
      } else if (EXT_IMAGES[ext]) {
        const data = fs.readFileSync(chemin).toString('base64');
        images.push({ nom: entree.name, dataUrl: `data:${EXT_IMAGES[ext]};base64,${data}` });
      }
    }
  };
  parcourir(dossier);
  fichiers.sort((a, b) => a.nom.localeCompare(b.nom));
  return { fichiers, tables, images };
}

ipcMain.handle('import:lire-dossier', async (event) => {
  const choix = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
    title: 'Dossier à importer (fichiers .md)',
    properties: ['openDirectory'],
  });
  if (choix.canceled || choix.filePaths.length === 0) return null;
  return lireDossierImport(choix.filePaths[0]);
});
ipcMain.handle('import:pages', (event, liste) => db.importerPages(liste));

// Export : l'interface prépare le contenu, le processus principal choisit l'emplacement et écrit
ipcMain.handle('export:choisir', async (event, { mode, nom, extension }) => {
  const fenetre = BrowserWindow.fromWebContents(event.sender);
  if (mode === 'dossier') {
    const choix = await dialog.showOpenDialog(fenetre, {
      title: 'Dossier où exporter',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (choix.canceled || choix.filePaths.length === 0) return null;
    return { dossier: choix.filePaths[0].replace(/\\/g, '/') };
  }
  const choix = await dialog.showSaveDialog(fenetre, {
    title: 'Exporter',
    defaultPath: nom,
    filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
  });
  if (choix.canceled || !choix.filePath) return null;
  return {
    chemin: choix.filePath,
    dossier: path.dirname(choix.filePath).replace(/\\/g, '/'),
    nom: path.basename(choix.filePath),
  };
});

ipcMain.handle('export:ecrire', (event, racine, fichiers) => {
  const base = path.resolve(racine);
  for (const f of fichiers) {
    const destination = path.resolve(base, f.chemin);
    // un chemin ne doit jamais sortir du dossier d'export
    if (destination !== base && !destination.startsWith(base + path.sep)) {
      throw new Error(`Chemin refusé : ${f.chemin}`);
    }
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, f.base64 !== undefined ? Buffer.from(f.base64, 'base64') : f.texte);
  }
  return fichiers.length;
});

ipcMain.handle('export:pdf', async (event, html, chemin) => {
  const temporaire = path.join(os.tmpdir(), `chinooknotes-export-${Date.now()}.html`);
  fs.writeFileSync(temporaire, html);
  const fenetre = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } });
  try {
    await fenetre.loadFile(temporaire);
    const pdf = await fenetre.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#787774"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    });
    fs.writeFileSync(chemin, pdf);
  } finally {
    fenetre.destroy();
    fs.rmSync(temporaire, { force: true });
  }
});

ipcMain.handle('export:afficher', (event, chemin) => shell.showItemInFolder(path.normalize(chemin)));

app.whenReady().then(() => {
  db.ouvrirBase();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
