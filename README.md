# SpeedType — PWA hors ligne

SpeedType est un jeu de vitesse de frappe autonome, sans bibliothèque, police distante, API ni backend. Le projet est un site statique installable (PWA) et fonctionne après son premier chargement réussi sans connexion Internet.

## Contenu

- `index.html`, `styles.css`, `app.js` : application de frappe responsive, française et accessible.
- `manifest.json` : métadonnées installables, mode autonome, icônes standard et maskable.
- `service-worker.js` : pré-cache des fichiers essentiels, stratégie réseau d’abord pour la navigation, cache des ressources, version des caches, nettoyage des anciennes versions et notification de mise à jour choisie par le joueur.
- `icons/` : PNG 192 × 192, 512 × 512 et 180 × 180 pour l’écran d’accueil Apple.
- `offline.html` : solution de repli hors connexion.
- `tests/` : script de vérification statique.

Records et préférence de durée sont stockés dans `localStorage` (`speedtype.records.v1`, `speedtype.preferences.v1`). Une mise à jour du cache ne supprime ni ne modifie ces clés.

## Lancer en local

Un service worker nécessite HTTPS, sauf sur `localhost` / `127.0.0.1`. Depuis ce dossier :

```bash
python3 -m http.server 8000 --bind 0.0.0.0
```

Ouvrir `http://localhost:8000`. L’ouverture directe en `file://` ne permet pas le service worker ni l’installation.

## Déploiement HTTPS statique

Le dossier peut être déployé tel quel sur GitHub Pages, Vercel, Netlify ou tout hébergement statique HTTPS. Aucun serveur applicatif ou base de données n’est requis. Les fichiers PWA doivent rester accessibles sous le même chemin et le serveur ne doit pas bloquer `service-worker.js`.

### GitHub Pages

1. Pousser le contenu de ce dossier dans un dépôt.
2. Activer **Settings → Pages** et sélectionner la branche/dossier de publication.
3. Ouvrir l’URL HTTPS publiée, attendre le chargement complet au moins une fois, puis vérifier l’installation et le mode hors ligne.

Les chemins sont relatifs (`./`) et supportent donc aussi un déploiement sous un sous-chemin GitHub Pages.

### Vercel

Importer le dépôt ou exécuter `vercel --prod` depuis le dossier. Il n’y a pas de commande de build : publier les fichiers statiques tels quels.

## Installation et expérience hors ligne

- **Android, Chrome/Edge desktop** : le bouton « Installer SpeedType » apparaît uniquement si le navigateur envoie `beforeinstallprompt`. Sinon, l’interface indique les options du menu navigateur.
- **iPhone/iPad** : aucune fausse installation automatique. L’aide Safari détaille Partager → Sur l’écran d’accueil → Ajouter.
- **Ordinateur** : l’aide indique aussi l’installation depuis le menu Chrome/Edge et Safari macOS.
- La première visite doit se faire en ligne afin de mettre en cache les ressources. Recharger une fois si le service worker vient juste de s’installer.
- Quand une nouvelle version est publiée, incrémenter `CACHE_VERSION` dans `service-worker.js`. La bannière « Mettre à jour » déclenche l’activation et le rechargement uniquement au clic. Les records restent dans `localStorage`.

## Vérifications

Vérification statique :

```bash
node tests/check-pwa.js
```

Vérification réelle sur une URL HTTPS (Chrome/Edge, Android, Safari iOS et ordinateur) :

1. DevTools → Application → Manifest : pas d’erreur, icônes 192/512 détectées.
2. Application → Service Workers : `service-worker.js` actif et contrôleur sur la page.
3. Utiliser le navigateur pour installer; ouvrir depuis l’icône et vérifier le mode autonome.
4. Laisser charger complètement, passer en mode avion et démarrer un test.
5. Terminer un test, fermer/réouvrir l’app, confirmer que le record et la durée choisie subsistent.
6. Publier une version de test avec `CACHE_VERSION` incrémenté, observer la bannière puis mettre à jour; vérifier que les données locales sont intactes.
7. Vérifier les mises en page étroite (téléphone), moyenne (tablette) et large (bureau).

La prévisualisation d’un sandbox peut ne pas fournir HTTPS; dans ce cas le navigateur désactive certaines capacités PWA. Faire les tests définitifs après déploiement HTTPS.
