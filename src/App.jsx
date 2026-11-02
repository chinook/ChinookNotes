import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './Sidebar.jsx';
import PageView from './PageView.jsx';
import Recherche from './Recherche.jsx';
import ExportDialog from './ExportDialog.jsx';
import Bienvenue from './Bienvenue.jsx';
import Reglages from './Reglages.jsx';
import Profil from './Profil.jsx';
import Corbeille from './Corbeille.jsx';
import DeplacerDialog from './DeplacerDialog.jsx';
import ApercuPage from './ApercuPage.jsx';
import EmojiPicker from './emoji/EmojiPicker.jsx';
import SelecteurModele from './modeles/SelecteurModele.jsx';
import { EmojisContext } from './emoji/Icone.jsx';
import { instancier } from './modeles/integres.js';
import { importerLot } from './import/importer.js';
import { menuPage, menuSidebarVide } from './menus.js';
import { POLICES } from './polices.js';
import { PagesContext } from './pagesContext.js';
import { actionCorbeille, actionCreation, actionModification, annuler, annulerSiDerniere, enregistrer, refaire, retirer } from './historiqueActions.js';
import Volets from './Volets.jsx';
import Permissions from './Permissions.jsx';
import { peutGererMembres } from './permissions.js';
import { MAX_VOLETS, majTailles, nouveauVolet, remplacerVolet, retirerVolet, scinder, trouverVolet, volets } from './volets.js';

const LARGEUR_SIDEBAR_DEFAUT = 260;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;

// Les lignes d'une base de données sont des pages enfants, mais elles restent hors de la sidebar
function construireArbre(pages) {
  const bases = new Set(pages.filter((p) => p.type === 'base').map((p) => p.id));
  const enfants = new Map();
  for (const p of pages) {
    if (bases.has(p.parent_id)) continue;
    const cle = p.parent_id ?? null;
    if (!enfants.has(cle)) enfants.set(cle, []);
    enfants.get(cle).push(p);
  }
  const noeud = (p) => ({ ...p, enfants: (enfants.get(p.id) || []).map(noeud) });
  return (enfants.get(null) || []).map(noeud);
}

export default function App() {
  const [pages, setPages] = useState([]);
  const [disposition, setDisposition] = useState(() => nouveauVolet(null)); // arbre des volets (voir volets.js)
  const [voletActifId, setVoletActifId] = useState(null);                    // null : le premier volet
  const [ouverts, setOuverts] = useState(() => new Set());
  const [importEtat, setImportEtat] = useState(null);
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const [exportId, setExportId] = useState(null);
  const [selecteurOuvert, setSelecteurOuvert] = useState(false);
  const [reglages, setReglages] = useState(null);          // null tant qu'ils ne sont pas chargés
  const [reglagesOuverts, setReglagesOuverts] = useState(false);
  const [profilOuvert, setProfilOuvert] = useState(false);
  const [corbeilleOuverte, setCorbeilleOuverte] = useState(false);
  const [permissionsOuvertes, setPermissionsOuvertes] = useState(false);
  const [emojis, setEmojis] = useState({});
  const [toast, setToast] = useState(null);                // { id, message, action: { label, fn } }
  const [renommageId, setRenommageId] = useState(null);
  const [iconePageId, setIconePageId] = useState(null);    // page dont on change l'icône (clic droit)
  const [deplacerId, setDeplacerId] = useState(null);      // page à déplacer (clic droit)
  const [apercuId, setApercuId] = useState(null);          // ligne de base affichée dans le volet de droite
  const [pageCopiee, setPageCopiee] = useState(null);      // id de la page mise de côté par « Copier »
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'clair');
  const [police, setPolice] = useState(() => localStorage.getItem('police') || 'sora');
  const [versionVues, setVersionVues] = useState(0);     // change après un annuler / refaire : les pages ouvertes se rechargent
  const [sidebarCachee, setSidebarCachee] = useState(() => localStorage.getItem('sidebarCachee') === '1');
  const [zoom, setZoom] = useState(1);
  const [zoomAffiche, setZoomAffiche] = useState(null);    // petit indicateur « Zoom : 110 % »
  const [largeurSidebar, setLargeurSidebar] = useState(LARGEUR_SIDEBAR_DEFAUT);
  const [apercuLargeur, setApercuLargeur] = useState(undefined); // pourcentage testé avec la glissière (undefined : aucun)
  const [historique, setHistorique] = useState({ pile: [], index: -1 });
  const dernierNav = useRef(0);

  // ---------- Volets : plusieurs pages côte à côte. « courante » est la page du volet actif,
  // donc la navigation (choisir, historique, corbeille…) agit sur le volet où se trouve l'utilisateur.
  const dispositionRef = useRef(disposition);
  const voletActifRef = useRef(null);
  const actifId = trouverVolet(disposition, voletActifId) ? voletActifId : volets(disposition)[0].id;
  voletActifRef.current = actifId;
  const courante = trouverVolet(disposition, actifId)?.pageId ?? null;

  // Le ref est mis à jour tout de suite : plusieurs changements dans le même événement partent de la bonne disposition
  const majDisposition = useCallback((arbre) => {
    dispositionRef.current = arbre;
    setDisposition(arbre);
  }, []);

  const activerVolet = useCallback((id) => {
    if (voletActifRef.current === id) return;
    voletActifRef.current = id;
    setVoletActifId(id);
    setApercuId(null);
  }, []);

  // Affiche une page dans le volet actif ; si elle est déjà ouverte dans un autre volet, on passe à celui-là
  const setCourante = useCallback((valeur) => {
    const d = dispositionRef.current;
    const actif = trouverVolet(d, voletActifRef.current) ?? volets(d)[0];
    const pageId = typeof valeur === 'function' ? valeur(actif.pageId) : valeur;
    const ailleurs = pageId != null ? volets(d).find((v) => v.pageId === pageId && v.id !== actif.id) : null;
    if (ailleurs) { activerVolet(ailleurs.id); return; }
    if (pageId !== actif.pageId) majDisposition(remplacerVolet(d, actif.id, (v) => ({ ...v, pageId })));
  }, [activerVolet, majDisposition]);

  function fermerVolet(id) {
    const apres = retirerVolet(dispositionRef.current, id);
    if (!apres) return;
    majDisposition(apres);
    if (voletActifRef.current === id) activerVolet(volets(apres)[0].id);
  }

  // Page glissée depuis la barre latérale : près d'un bord, elle coupe le volet ; au milieu, elle le remplace
  function deposerPage(voletId, zone, pageId) {
    if (!pagesRef.current.some((p) => p.id === pageId)) return;
    const d = dispositionRef.current;
    const dejaOuverte = volets(d).find((v) => v.pageId === pageId);
    if (zone === 'centre') {
      activerVolet(dejaOuverte && dejaOuverte.id !== voletId ? dejaOuverte.id : voletId);
      choisir(pageId);
      return;
    }
    if (dejaOuverte) { activerVolet(dejaOuverte.id); return; }
    if (volets(d).length >= MAX_VOLETS) {
      setToast({ id: Date.now(), message: `${MAX_VOLETS} volets au maximum : ferme-en un avant d'en ouvrir un autre` });
      return;
    }
    const nouveau = nouveauVolet(pageId);
    majDisposition(scinder(d, voletId, zone, nouveau));
    activerVolet(nouveau.id);
    choisir(pageId);
  }

  // Une page supprimée ou mise à la corbeille depuis ailleurs ferme son volet
  useEffect(() => {
    if (pages.length === 0) return;
    const orphelins = volets(dispositionRef.current).filter((v) => v.pageId != null && !pages.some((p) => p.id === v.pageId));
    if (orphelins.length === 0) return;
    let arbre = dispositionRef.current;
    for (const o of orphelins) {
      const sans = volets(arbre).length > 1 ? retirerVolet(arbre, o.id) : null;
      arbre = sans ?? remplacerVolet(arbre, o.id, (v) => ({ ...v, pageId: pages[0].id }));
    }
    majDisposition(arbre);
    if (!trouverVolet(arbre, voletActifRef.current)) activerVolet(volets(arbre)[0].id);
  }, [pages, majDisposition, activerVolet]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('sidebarCachee', sidebarCachee ? '1' : '0');
  }, [sidebarCachee]);

  // Ctrl+\ cache ou montre la barre latérale, où que soit le curseur
  useEffect(() => {
    const surTouche = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key === '\\') {
        e.preventDefault();
        setSidebarCachee((c) => !c);
      }
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, []);

  const pagesParId = useMemo(() => Object.fromEntries(pages.map((p) => [p.id, { icone: p.icone, type: p.type, titre: p.titre }])), [pages]);

  useEffect(() => {
    document.documentElement.style.setProperty('--police', (POLICES.find((p) => p.id === police) || POLICES[0]).css);
    localStorage.setItem('police', police);
  }, [police]);

  // Largeur des pages : pourcentage de la zone d'affichage. Sans réglage, la largeur d'origine s'applique.
  const largeurEnregistree = reglages?.largeurPage ? Number(reglages.largeurPage) : (reglages?.pleineLargeur === '1' ? 100 : null);
  const largeurActive = apercuLargeur !== undefined ? apercuLargeur : largeurEnregistree;
  useEffect(() => {
    const racine = document.documentElement;
    if (largeurActive == null) racine.style.removeProperty('--largeur-page');
    else racine.style.setProperty('--largeur-page', `${largeurActive}%`);
  }, [largeurActive]);

  // Ctrl+K (ou Cmd+K) ouvre la recherche, où que soit le curseur
  useEffect(() => {
    const surTouche = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setRechercheOuverte((o) => !o);
      }
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, []);

  const recharger = useCallback(async () => {
    const liste = await window.api.listePages();
    setPages(liste);
    return liste;
  }, []);

  const chargerEmojis = useCallback(async () => {
    const liste = await window.api.listeEmojis();
    setEmojis(Object.fromEntries(liste.map((e) => [e.id, { nom: e.nom, image: e.image }])));
  }, []);

  useEffect(() => {
    recharger().then((liste) => {
      if (liste.length > 0) {
        setCourante((c) => c ?? liste[0].id);
        setHistorique((h) => (h.pile.length === 0 ? { pile: [liste[0].id], index: 0 } : h));
      }
    });
    window.api.lireReglages().then((r) => {
      setReglages(r);
      if (r.largeurSidebar) setLargeurSidebar(Number(r.largeurSidebar));
      if (r.zoom) { const z = Number(r.zoom); setZoom(z); window.api.definirZoom(z); }
    });
    chargerEmojis();
  }, [recharger, chargerEmojis]);

  // Ctrl+Z annule la dernière action (page, ligne, cellule, réglage de base) ; Ctrl+Y ou Ctrl+Maj+Z la refait.
  // Dans un champ de saisie ou dans l'éditeur, Ctrl+Z annule la frappe en cours : on ne s'en mêle pas.
  useEffect(() => {
    let enCours = false;
    const surTouche = async (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      const defaire = k === 'z' && !e.shiftKey;
      if (!defaire && !(k === 'y' || (k === 'z' && e.shiftKey))) return;
      if (e.target.closest?.('input, textarea, select, [contenteditable="true"], [contenteditable=""]')) return;
      if (document.querySelector('.dialogue-fond')) return;
      e.preventDefault();
      if (enCours) return;
      enCours = true;
      try {
        const r = await (defaire ? annuler() : refaire());
        if (!r) {
          setToast({ id: Date.now(), message: defaire ? 'Rien à annuler' : 'Rien à refaire' });
          return;
        }
        await recharger();
        setVersionVues((v) => v + 1);
        setToast({
          id: Date.now(),
          message: r.erreur ? `Impossible de ${defaire ? 'annuler' : 'refaire'} : ${r.libelle}` : `${defaire ? '↩ Annulé' : '↪ Refait'} : ${r.libelle}`,
        });
      } finally {
        enCours = false;
      }
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [recharger]);

  // Message en bas de l'écran, avec une action facultative (« Annuler »)
  useEffect(() => {
    if (!toast) return undefined;
    const minuterie = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(minuterie);
  }, [toast]);

  const arbre = useMemo(() => construireArbre(pages), [pages]);
  const pageCourante = pages.find((p) => p.id === courante) || null;

  // Chemin d'une page, de la racine jusqu'à elle (fil d'Ariane)
  function cheminDe(page) {
    const res = [];
    let p = page;
    while (p) {
      res.unshift(p);
      p = pages.find((x) => x.id === p.parent_id);
    }
    return res;
  }

  // Le contenu d'un volet : la page, ou l'invitation à en créer une quand il n'y en a aucune
  function rendrePage(volet, actif) {
    const meta = pages.find((p) => p.id === volet.pageId);
    if (!meta) {
      return (
        <div className="vide">
          <p>Aucune page.</p>
          <button onClick={() => creer(null)}>Créer une page</button>
        </div>
      );
    }
    return (
      <PageView
        key={`${meta.id}:${versionVues}`}
        id={meta.id}
        actif={actif}
        chemin={cheminDe(meta)}
        onSelect={choisir}
        onChange={recharger}
        meta={meta}
        lignes={pages.filter((p) => p.parent_id === meta.id)}
        baseParente={pages.find((p) => p.id === meta.parent_id && p.type === 'base') ?? null}
        onExporter={() => setExportId(meta.id)}
        largeurEnregistree={largeurEnregistree}
        onApercuLargeur={(p) => setApercuLargeur(p === null ? undefined : p)}
        onAppliquerLargeur={async (p) => { setApercuLargeur(undefined); await enregistrerReglages({ largeurPage: p, pleineLargeur: null }); }}
        onEmojisChange={chargerEmojis}
        onRetour={() => naviguer('retour')}
        onAvance={() => naviguer('avance')}
        peutRetour={peutRetour}
        peutAvance={peutAvance}
        onApercuLigne={setApercuId}
      />
    );
  }

  // ---------- Réglages

  async function enregistrerReglages(valeurs) {
    let derniers = reglages;
    for (const [cle, valeur] of Object.entries(valeurs)) derniers = await window.api.ecrireReglage(cle, valeur);
    setReglages(derniers);
    return derniers;
  }

  async function enregistrerProfil(valeurs) {
    await enregistrerReglages(valeurs);
    setProfilOuvert(false);
  }

  // ---------- Zoom de toute l'interface : Ctrl + molette
  const zoomRef = useRef(1);
  zoomRef.current = zoom;
  const minuterieZoom = useRef(null);

  const appliquerZoom = useCallback((valeur) => {
    const z = Math.round(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, valeur)) * 100) / 100;
    setZoom(z);
    window.api.definirZoom(z);
    setZoomAffiche(Math.round(z * 100));
    clearTimeout(minuterieZoom.current);
    minuterieZoom.current = setTimeout(() => {
      setZoomAffiche(null);
      window.api.ecrireReglage('zoom', z).then((r) => setReglages(r));
    }, 900);
  }, []);

  useEffect(() => {
    const molette = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      appliquerZoom(zoomRef.current + (e.deltaY < 0 ? 0.1 : -0.1));
    };
    const clavier = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      if (e.key === '0') { e.preventDefault(); appliquerZoom(1); }
    };
    window.addEventListener('wheel', molette, { passive: false });
    window.addEventListener('keydown', clavier);
    return () => { window.removeEventListener('wheel', molette); window.removeEventListener('keydown', clavier); };
  }, [appliquerZoom]);

  // ---------- Historique : boutons précédent / suivant de la souris, Alt + flèches

  const peutRetour = historique.index > 0;
  const peutAvance = historique.index < historique.pile.length - 1;

  const naviguer = useCallback((sens) => {
    setHistorique((h) => {
      let i = h.index;
      const pas = sens === 'retour' ? -1 : 1;
      // on saute les pages qui n'existent plus (corbeille)
      do { i += pas; } while (i >= 0 && i < h.pile.length && !pagesRef.current.some((p) => p.id === h.pile[i]));
      if (i < 0 || i >= h.pile.length) return h;
      setCourante(h.pile[i]);
      return { ...h, index: i };
    });
  }, []);
  const pagesRef = useRef(pages);
  pagesRef.current = pages;

  useEffect(() => {
    // le système (Windows) et le navigateur peuvent annoncer le même appui : on n'en garde qu'un
    const unSeul = (sens) => {
      const t = Date.now();
      if (t - dernierNav.current < 350) return;
      dernierNav.current = t;
      naviguer(sens);
    };
    const souris = (e) => {
      if (e.button === 3) { e.preventDefault(); unSeul('retour'); }
      if (e.button === 4) { e.preventDefault(); unSeul('avance'); }
    };
    const clavier = (e) => {
      if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); unSeul('retour'); }
      if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); unSeul('avance'); }
    };
    window.addEventListener('mouseup', souris);
    window.addEventListener('keydown', clavier);
    window.api.surNavigation(unSeul);
    return () => { window.removeEventListener('mouseup', souris); window.removeEventListener('keydown', clavier); };
  }, [naviguer]);

  // ---------- Pages

  async function creer(parentId) {
    const page = await window.api.creerPage(parentId, '');
    enregistrer(actionCreation(page.id, 'nouvelle page'));
    await recharger();
    if (parentId != null) setOuverts((o) => new Set(o).add(parentId));
    choisir(page.id);
  }

  async function creerDepuisModele(modele, parentId) {
    let page;
    if (modele.base) {
      page = await window.api.creerBase(parentId, modele.base.titrePage, modele.icone, JSON.stringify(modele.base.schema()));
    } else {
      const { titre, icone, couverture, contenu } = instancier(modele);
      page = await window.api.creerPage(parentId, titre);
      await window.api.modifierPage(page.id, { icone, couverture, contenu });
    }
    setSelecteurOuvert(false);
    enregistrer(actionCreation(page.id, 'nouvelle page'));
    await recharger();
    if (parentId != null) setOuverts((o) => new Set(o).add(parentId));
    choisir(page.id);
  }

  // Suppression récupérable : la page et ses sous-pages vont dans la corbeille
  async function mettreALaCorbeille(id) {
    const page = pages.find((p) => p.id === id);
    await window.api.mettreALaCorbeille(id);
    const action = actionCorbeille(id, `« ${page?.titre || 'Sans titre'} » mise à la corbeille`);
    enregistrer(action);
    const liste = await recharger();
    if (!liste.some((p) => p.id === courante)) {
      setCourante((liste.find((p) => p.id === page?.parent_id) ?? liste[0])?.id ?? null);
    }
    setToast({
      id: Date.now(),
      message: `« ${page?.titre || 'Sans titre'} » déplacée dans la corbeille`,
      action: {
        label: 'Annuler',
        fn: async () => {
          // passe par l'historique pour que Ctrl + Z ne la restaure pas une seconde fois
          if (!(await annulerSiDerniere(action))) { await window.api.restaurerPage(id); retirer(action); }
          await recharger();
          setCourante(id);
          setToast(null);
        },
      },
    });
  }

  async function dupliquer(id, parentId) {
    const copie = await window.api.dupliquerPage(id, parentId);
    enregistrer(actionCreation(copie.id, 'page dupliquée'));
    await recharger();
    if (parentId != null) setOuverts((o) => new Set(o).add(parentId));
    choisir(copie.id);
  }

  async function renommer(id, titre) {
    setRenommageId(null);
    const page = pages.find((p) => p.id === id);
    if (page && page.titre !== titre) {
      await window.api.modifierPage(id, { titre });
      enregistrer(actionModification(id, 'nouveau nom de page', { titre: page.titre }, { titre }));
      await recharger();
    }
  }

  // Une page de plus, au même niveau que celle-ci (juste après)
  async function creerACote(page) {
    const nouvelle = await window.api.creerPage(page.parent_id ?? null, '');
    const freres = (await window.api.listePages()).filter((p) => (p.parent_id ?? null) === (page.parent_id ?? null) && p.id !== nouvelle.id);
    await window.api.deplacerPage(nouvelle.id, page.parent_id ?? null, freres.findIndex((p) => p.id === page.id) + 1);
    enregistrer(actionCreation(nouvelle.id, 'nouvelle page'));
    await recharger();
    choisir(nouvelle.id);
  }

  // Déplace une page en retenant son ancien emplacement, pour pouvoir annuler
  async function deplacerAnnulable(id, parentId, position) {
    const page = pages.find((p) => p.id === id);
    const ancienParent = page?.parent_id ?? null;
    const ancienRang = pages.filter((p) => (p.parent_id ?? null) === ancienParent).findIndex((p) => p.id === id);
    await window.api.deplacerPage(id, parentId, position);
    enregistrer({
      libelle: 'déplacement de page',
      annuler: () => window.api.deplacerPage(id, ancienParent, ancienRang),
      refaire: () => window.api.deplacerPage(id, parentId, position),
    });
  }

  // Monter / descendre d'un cran parmi les pages de même niveau
  async function decaler(page, sens) {
    const freres = pages.filter((p) => (p.parent_id ?? null) === (page.parent_id ?? null) && p.id !== page.id);
    const actuelle = pages.filter((p) => (p.parent_id ?? null) === (page.parent_id ?? null)).findIndex((p) => p.id === page.id);
    const cible = actuelle + sens;
    if (cible < 0 || cible > freres.length) return;
    await deplacerAnnulable(page.id, page.parent_id ?? null, cible);
    await recharger();
  }

  async function deplacerVers(page, parentId) {
    setDeplacerId(null);
    try {
      await deplacerAnnulable(page.id, parentId, null);
    } catch (e) {
      window.alert(String(e?.message || e));
      return;
    }
    if (parentId != null) setOuverts((o) => new Set(o).add(parentId));
    await recharger();
  }

  // Menu du clic droit sur une page de la sidebar
  async function ouvrirMenuPage(page) {
    const freres = pages.filter((p) => (p.parent_id ?? null) === (page.parent_id ?? null));
    const choix = await window.api.menuContextuel(menuPage(page, { pageCopiee, rang: freres.findIndex((p) => p.id === page.id), nbFreres: freres.length }));
    if (choix === 'ouvrir') choisir(page.id);
    else if (choix === 'renommer') setRenommageId(page.id);
    else if (choix === 'icone') setIconePageId(page.id);
    else if (choix === 'sous-page') creer(page.id);
    else if (choix === 'a-cote') creerACote(page);
    else if (choix === 'deplacer') setDeplacerId(page.id);
    else if (choix === 'monter') decaler(page, -1);
    else if (choix === 'descendre') decaler(page, 1);
    else if (choix === 'dupliquer') dupliquer(page.id);
    else if (choix === 'copier') {
      setPageCopiee(page.id);
      setToast({ id: Date.now(), message: `« ${page.titre || 'Sans titre'} » copiée : clic droit sur une page, « Coller comme sous-page »` });
    } else if (choix === 'coller') dupliquer(pageCopiee, page.id);
    else if (choix === 'exporter') setExportId(page.id);
    else if (choix === 'corbeille') mettreALaCorbeille(page.id);
  }

  async function ouvrirMenuSidebarVide() {
    const choix = await window.api.menuContextuel(menuSidebarVide({ pageCopiee }));
    if (choix === 'nouvelle') creer(null);
    else if (choix === 'coller-racine') dupliquer(pageCopiee, null);
    else if (choix === 'corbeille-ouvrir') setCorbeilleOuverte(true);
  }

  // Affiche la page, déplie ses parents dans la sidebar et l'ajoute à l'historique
  function choisir(id, { historique: garder = true } = {}) {
    setCourante(id);
    setApercuId(null);
    if (garder) {
      setHistorique((h) => {
        if (h.pile[h.index] === id) return h;
        const pile = [...h.pile.slice(0, h.index + 1), id];
        return { pile, index: pile.length - 1 };
      });
    }
    setOuverts((o) => {
      const n = new Set(o);
      let p = pages.find((x) => x.id === id);
      while (p && p.parent_id != null) { n.add(p.parent_id); p = pages.find((x) => x.id === p.parent_id); }
      return n;
    });
  }

  async function importer() {
    const lot = await window.api.lireDossierImport();
    if (!lot) return;
    setImportEtat({ phase: 'encours', message: `${lot.fichiers.length} fichiers lus…` });
    try {
      const rapport = await importerLot(lot, (message) => setImportEtat({ phase: 'encours', message }));
      await recharger();
      setImportEtat({ phase: 'termine', rapport });
    } catch (e) {
      setImportEtat({ phase: 'erreur', message: String(e?.message || e) });
    }
  }

  // zone : 'avant' / 'apres' la page cible (même parent) ou 'dans' (devient sa dernière sous-page)
  async function deplacer(id, cibleId, zone) {
    const cible = pages.find((p) => p.id === cibleId);
    if (!cible || id === cibleId) return;
    let parentId = cibleId;
    let position = null;
    if (zone !== 'dans') {
      parentId = cible.parent_id ?? null;
      const freres = pages.filter((p) => (p.parent_id ?? null) === parentId && p.id !== id);
      const i = freres.findIndex((p) => p.id === cibleId);
      position = zone === 'avant' ? i : i + 1;
    }
    try {
      await deplacerAnnulable(id, parentId, position);
    } catch (e) {
      window.alert(String(e?.message || e));
      return;
    }
    if (parentId != null) setOuverts((o) => new Set(o).add(parentId));
    await recharger();
  }

  async function deplacerRacine(id) {
    await deplacerAnnulable(id, null, null);
    await recharger();
  }

  function basculer(id) {
    setOuverts((o) => {
      const n = new Set(o);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  // Premier lancement : on demande son nom à l'utilisateur (pour « Dernière modification par … »)
  const demanderNom = reglages && !reglages.auteur && !reglages.auteurDemande;
  // Rôle de l'utilisateur : simulé tant qu'il n'y a pas de serveur. Sans réglage, on est propriétaire de ses propres notes.
  const role = reglages?.roleSimule || 'proprietaire';
  const aucunServeur = () => setToast({ id: Date.now(), message: "Aucun serveur n'est connecté : rien n'a été modifié" });
  const pagePourIcone = pages.find((p) => p.id === iconePageId);
  const pagePourDeplacer = pages.find((p) => p.id === deplacerId);

  return (
    <EmojisContext.Provider value={emojis}>
    <PagesContext.Provider value={pagesParId}>
    <div className="app">
      {sidebarCachee && (
        <div className="rail">
          <button className="rail-afficher" onClick={() => setSidebarCachee(false)} title="Afficher la barre latérale (Ctrl + \)">»</button>
        </div>
      )}
      {!sidebarCachee && <Sidebar
        arbre={arbre}
        courante={courante}
        ouverts={ouverts}
        largeur={largeurSidebar}
        avatar={reglages?.avatar ?? null}
        renommageId={renommageId}
        onSelect={choisir}
        onBasculer={basculer}
        onCreer={creer}
        onSupprimer={mettreALaCorbeille}
        onRechercher={() => setRechercheOuverte(true)}
        onDeplacer={deplacer}
        onDeplacerRacine={deplacerRacine}
        onMenuPage={ouvrirMenuPage}
        onMenuVide={ouvrirMenuSidebarVide}
        onRenommer={renommer}
        onProfil={() => setProfilOuvert(true)}
        onReglages={() => setReglagesOuverts(true)}
        onCacher={() => setSidebarCachee(true)}
        onLargeur={setLargeurSidebar}
        onLargeurFin={(px) => {
          const largeur = px ?? LARGEUR_SIDEBAR_DEFAUT;
          setLargeurSidebar(largeur);
          enregistrerReglages({ largeurSidebar: px == null ? null : Math.round(largeur) });
        }}
      />}
      <main className="contenu">
        <Volets
          disposition={disposition}
          actifId={actifId}
          rendre={rendrePage}
          onActiver={activerVolet}
          onFermer={fermerVolet}
          onDepot={deposerPage}
          onTailles={(id, tailles) => majDisposition(majTailles(dispositionRef.current, id, tailles))}
        />
      </main>
      {apercuId != null && pages.some((p) => p.id === apercuId) && (
        <ApercuPage
          key={`${apercuId}:${versionVues}`}
          id={apercuId}
          pages={pages}
          largeur={Number(reglages?.largeurApercu) || 520}
          onLargeurFin={(px) => enregistrerReglages({ largeurApercu: Math.round(px) })}
          onChange={recharger}
          onEmojisChange={chargerEmojis}
          onOuvrirPage={(id) => { setApercuId(null); choisir(id); }}
          onFermer={() => setApercuId(null)}
        />
      )}
      {rechercheOuverte && (
        <Recherche
          pages={pages}
          onFermer={() => setRechercheOuverte(false)}
          onChoisir={(id) => { setRechercheOuverte(false); choisir(id); }}
        />
      )}
      {selecteurOuvert && (
        <SelecteurModele
          pageCourante={pageCourante && pageCourante.type !== 'base' && !pages.some((p) => p.id === pageCourante.parent_id && p.type === 'base') ? { id: pageCourante.id, titre: pageCourante.titre } : null}
          parentInitial={null}
          onChoisir={creerDepuisModele}
          onFermer={() => setSelecteurOuvert(false)}
        />
      )}
      {exportId != null && <ExportDialog pages={pages} pageId={exportId} onFermer={() => setExportId(null)} />}
      {importEtat && <RapportImport etat={importEtat} onFermer={() => setImportEtat(null)} />}
      {corbeilleOuverte && (
        <Corbeille
          onChange={async (id) => { await recharger(); choisir(id); }}
          onFermer={() => { setCorbeilleOuverte(false); recharger(); }}
        />
      )}
      {demanderNom && <Bienvenue onEnregistrer={enregistrerReglages} />}
      {reglagesOuverts && (
        <Reglages
          theme={theme}
          police={police}
          onPolice={setPolice}
          zoom={zoom}
          onTheme={() => setTheme(theme === 'clair' ? 'sombre' : 'clair')}
          onZoomInitial={() => appliquerZoom(1)}
          onLargeurSidebarInitiale={() => { setLargeurSidebar(LARGEUR_SIDEBAR_DEFAUT); enregistrerReglages({ largeurSidebar: null }); }}
          onImporter={importer}
          onCorbeille={() => setCorbeilleOuverte(true)}
          onModeles={() => setSelecteurOuvert(true)}
          role={role}
          onRole={(r) => enregistrerReglages({ roleSimule: r })}
          onPermissions={() => setPermissionsOuvertes(true)}
          onFermer={() => setReglagesOuverts(false)}
        />
      )}
      {permissionsOuvertes && peutGererMembres(role) && (
        <Permissions
          moi={role}
          membres={[]}
          serveurConnecte={false}
          roleParDefaut={reglages?.roleParDefaut || 'lecteur'}
          onRoleParDefaut={(r) => enregistrerReglages({ roleParDefaut: r })}
          onChangerRole={aucunServeur}
          onRetirer={aucunServeur}
          onFermer={() => setPermissionsOuvertes(false)}
        />
      )}
      {profilOuvert && reglages && (
        <Profil
          reglages={reglages}
          onEnregistrer={enregistrerProfil}
          onOuvrirPage={choisir}
          onEmojisChange={chargerEmojis}
          onFermer={() => setProfilOuvert(false)}
        />
      )}
      {pagePourIcone && (
        <EmojiPicker
          valeur={pagePourIcone.icone}
          onChoisir={async (v) => {
            setIconePageId(null);
            const avant = pagePourIcone.icone ?? null;
            await window.api.modifierPage(pagePourIcone.id, { icone: v });
            enregistrer(actionModification(pagePourIcone.id, "nouvelle icône de page", { icone: avant }, { icone: v }));
            await recharger();
          }}
          onFermer={() => setIconePageId(null)}
          onEmojisChange={chargerEmojis}
        />
      )}
      {pagePourDeplacer && (
        <DeplacerDialog
          arbre={arbre}
          page={pagePourDeplacer}
          onChoisir={(parentId) => deplacerVers(pagePourDeplacer, parentId)}
          onFermer={() => setDeplacerId(null)}
        />
      )}
      {zoomAffiche != null && <div className="zoom-indicateur">Zoom : {zoomAffiche} %</div>}
      {toast && (
        <div className="toast" key={toast.id}>
          <span>{toast.message}</span>
          {toast.action && <button onClick={toast.action.fn}>{toast.action.label}</button>}
          <button className="toast-fermer" onClick={() => setToast(null)} title="Fermer">×</button>
        </div>
      )}
    </div>
    </PagesContext.Provider>
    </EmojisContext.Provider>
  );
}

function RapportImport({ etat, onFermer }) {
  const { phase, message, rapport } = etat;
  return (
    <div className="dialogue-fond">
      <div className="dialogue dialogue-large">
        <strong>Import</strong>
        {phase === 'encours' && <p>{message}</p>}
        {phase === 'erreur' && <p>Erreur : {message}</p>}
        {phase === 'termine' && (
          <>
            <p>
              {rapport.importees} page(s) importée(s)
              {rapport.ignorees > 0 && `, ${rapport.ignorees} déjà présente(s) (laissées telles quelles)`}.
            </p>
            {rapport.avertissements.length > 0 && (
              <>
                <p>{rapport.avertissements.length} avertissement(s) :</p>
                <ul className="avertissements">
                  {rapport.avertissements.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </>
            )}
          </>
        )}
        {phase !== 'encours' && (
          <div className="dialogue-boutons">
            <span style={{ flex: 1 }} />
            <button className="primaire" onClick={onFermer}>Fermer</button>
          </div>
        )}
      </div>
    </div>
  );
}
