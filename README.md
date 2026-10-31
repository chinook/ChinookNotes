# ChinookNotes

**ChinookNotes est l'outil de documentation du club Chinook (ÉTS).** Il sert à garder au même endroit tout ce que
l'équipe a besoin de savoir sur le véhicule : comment fonctionnent les cartes électroniques, le code embarqué, les
identifiants CAN, la télémétrie, les données de course, les bugs rencontrés et leurs correctifs. Les nouveaux membres
y trouvent un guide pour comprendre le projet, et l'équipe y garde une mémoire qui survit d'une année à l'autre.

C'est une application de bureau (Windows) dans l'esprit de Notion, mais qui fonctionne hors ligne : les notes sont
rangées dans un fichier sur l'ordinateur, sans compte ni serveur.

## Fonctionnalités

- **Pages imbriquées** : une arborescence dans la barre latérale, avec glisser-déposer pour réorganiser, icônes et couvertures.
- **Éditeur à blocs** : titres, listes, tâches, citations, callouts, blocs repliables, tableaux, code coloré, images, équations (LaTeX).
- **Bases de données** : tableaux et vues Kanban dont les lignes sont des pages.
- **Plusieurs pages à l'écran** : glisser une page de la barre latérale vers le bord d'un volet pour l'ouvrir à côté (gauche, droite, haut, bas), comme dans VS Code. Les séparateurs se déplacent, jusqu'à 4 volets.
- **Liens entre pages** affichés avec l'icône de la page visée.
- **Recherche** : plein texte dans toutes les pages (Ctrl + K) et recherche d'un mot dans la page ouverte (Ctrl + F).
- **Modèles de pages**, **corbeille** avec restauration, **historique** précédent / suivant (boutons de la souris, Alt + flèches).
- **Export** en Markdown, HTML ou PDF, et **import** d'exports Notion.
- **Apparence** : thème clair ou sombre, choix de la police, zoom (Ctrl + molette), largeur des pages réglable.

## Technologies

Electron + React + TipTap (éditeur) + SQLite (`better-sqlite3`).

## Où sont les données

Les notes sont stockées localement dans `notes.db`, dans le dossier de données de l'application
(`%APPDATA%\chinooknotes`). Ce fichier n'est pas dans le dépôt : **chaque installation a sa propre base**, et
récupérer le code depuis GitHub donne une application vide. Pensez à sauvegarder ce fichier si les notes comptent.

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
