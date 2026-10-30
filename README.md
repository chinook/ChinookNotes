# ChinookNotes

Application de bureau (Windows) pour la documentation du projet Chinook : pages imbriquées, éditeur à blocs,
bases de données (Table et Kanban), recherche plein texte, corbeille, exports Markdown / HTML / PDF et import d'exports Notion.

Electron + React + SQLite (`better-sqlite3`). Les données sont stockées localement dans `notes.db`
(dossier de données de l'application, `%APPDATA%\chinooknotes`).

## Démarrer

```bash
npm install
npm start
```

`npm run dev` lance l'interface avec rechargement à chaud.

## Créer l'installateur Windows

```bash
npm run build
```

L'installateur est écrit dans `release/`.

## Importer une documentation Notion

Bouton ⚙ Réglages → « Importer… », puis choisir un dossier contenant des exports Markdown de Notion (avec leurs `.csv` pour les bases).
