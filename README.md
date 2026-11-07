# Centrale Secours Suisse 🚒🚑🚓

Jeu web de gestion des secours en Suisse : tu revendiques un canton, tu construis
casernes, bases d'ambulances et postes de police, et tu réponds aux appels
118 · 144 · 117. Les véhicules roulent sur le **vrai réseau routier** (OpenStreetMap)
sur la **vraie carte nationale** swisstopo.

## Lancer le jeu

Le jeu est 100 % statique (HTML/CSS/JS, sans build) mais il doit être servi en HTTP
(ouvrir `index.html` directement en `file://` ne marche pas) :

```sh
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

ou `npx serve .` — ou activer GitHub Pages sur la branche.

Il faut une connexion internet : fond de carte swisstopo / OSM, Leaflet (unpkg) et
calcul d'itinéraires OSRM.

## Ce qui marche déjà

- Carte de Suisse avec les 26 cantons (frontières officielles OFS), survol + fiche canton
  (population, superficie, communes, difficulté, budget).
- **Revendiquer un canton** : la carte se centre dessus, le reste est grisé.
- Construction de bâtiments (clic sur la carte, uniquement dans ton canton, pas dans les lacs),
  nommés d'après la commune la plus proche (2 175 communes réelles).
- Achat de véhicules : tonne-pompe, camion-échelle, ambulance, SMUR, patrouille.
- Appels aléatoires dans la zone couverte par tes bâtiments, avec adresse (rue réelle + commune).
- Alarme avec proposition automatique des véhicules les plus proches, trajets animés sur les
  vraies routes (durée OSRM × 0.75 en urgence), travail sur place, retour en caserne.
- Horloge de jeu (pause, 1×, 3×, 10×, 30×), sauvegarde automatique dans le navigateur.
- Fonds de carte : carte nationale, carte grise, photo aérienne (swisstopo), OpenStreetMap.

## Structure

```
index.html
css/style.css
js/main.js       carte Leaflet, interface, boucle de jeu
js/game.js       règles : bâtiments, véhicules, types d'interventions, sauvegarde
js/cantons.js    métadonnées des cantons (numéros OFS)
js/geo.js        point-dans-polygone, surfaces, distances
js/routing.js    itinéraires OSRM (+ repli en ligne droite)
data/            cantons, lacs, pays (GeoJSON) et communes (JSON)
tools/build-geodata.mjs   régénère data/ depuis le paquet npm swiss-maps
```

## Sources & licences

- Frontières : Office fédéral de la statistique (OFS), GEOSTAT, via le paquet
  [swiss-maps](https://github.com/interactivethings/swiss-maps) (usage non commercial).
- Fonds de carte : © swisstopo, © contributeurs OpenStreetMap.
- Itinéraires : serveur de démo public [OSRM](https://project-osrm.org/) — limité à un usage
  raisonnable ; pour aller plus loin, héberger son propre OSRM avec l'extrait Suisse de
  Geofabrik et modifier `OSRM_URL` dans `js/routing.js`.
