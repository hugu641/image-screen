# ImageScreen - Solution d'Affichage Dynamique Professionnelle

ImageScreen est une application web complète d'affichage dynamique conçue pour diffuser de manière fluide et en temps réel des photos et des vidéos de réalisations sur un ou plusieurs écrans (télévisions connectées via navigateur, Fire TV Stick, Android TV, Smart TV, ou mini-PC en mode kiosque) depuis un serveur local (Windows, Linux, NAS, etc.).

---

## 🚀 Fonctionnalités Clés

*   **Administration SaaS Moderne** : Dashboard fluide avec thématique sombre premium, cartes statistiques et journal d'activité en temps réel.
*   **Médiathèque Intelligente** : Upload multiple (Drag & Drop), recherche, renommage, suppression et **compression automatique** des images (redimensionnement FHD et optimisation qualité 80% via Jimp) pour préserver le stockage et le réseau.
*   **Gestion des Playlists** : Création, édition, duplication de boucles de diffusion. Paramétrage des durées individuelles, lecture aléatoire ou en boucle, et transitions fluides (**Fondu, Zoom, Slide**). Réorganisation des diapos par drag and drop ou boutons.
*   **Pilotage des Écrans en Temps Réel** : Auto-détection des nouveaux écrans sur le réseau local, couplage sécurisé par code à 6 caractères (ex: `A7K9P2`), renommage, affectation instantanée de playlist et commande de synchronisation forcée via **Socket.IO**.
*   **Cache Local et Mode Hors Ligne** : Les écrans TV téléchargent les médias en arrière-plan et les stockent via l'API **Cache Storage** du navigateur. En cas de perte réseau, l'écran continue de diffuser en boucle à partir du cache local avec une mention discrète "Mode hors ligne".
*   **Aperçu en Direct** : Suivi en temps réel de la diapositive en cours de diffusion sur chaque écran depuis l'administration.

---

## 🛠️ Technologies Utilisées

### Backend
*   **Node.js** & **Express** (Serveur REST API)
*   **Socket.IO** (Websockets pour la communication bidirectionnelle instantanée)
*   **SQLite** via `sqlite3` (Base de données locale légère et rapide sans configuration)
*   **Jimp** (Traitement d'images pur JavaScript, garantissant une compatibilité 100% sans compilation native C++ sous Windows/NAS)

### Frontend
*   **React** (Interface utilisateur SPA)
*   **Tailwind CSS** (Design moderne, responsive et Dark Mode)
*   **Socket.IO Client** (Synchronisation en direct)

---

## 📦 Installation et Démarrage Rapide

### Prérequis
*   Avoir [Node.js](https://nodejs.org/) installé (version 18 ou supérieure recommandée).

### Démarrage Automatique (Recommandé)

#### Sur Windows
Double-cliquez simplement sur le script :
👉 **`start-production.bat`** (situé à la racine)
Le script installera les dépendances manquantes, compilera l'application React et démarrera le serveur local.

#### Sur Linux / macOS / NAS
Ouvrez votre terminal dans le dossier du projet et exécutez :
```bash
chmod +x start-production.sh
./start-production.sh
```

---

### Démarrage Manuel

1.  **Installer les dépendances** à la racine :
    ```bash
    npm run install-all
    ```
2.  **Compiler le frontend** pour la production :
    ```bash
    npm run build
    ```
3.  **(Optionnel) Configurer** : copiez `backend/.env.example` en `backend/.env`. Aucun secret à écrire : un secret de session aléatoire est généré automatiquement.
4.  **Lancer le serveur** :
    ```bash
    npm run backend
    ```

Le serveur écoute sur le port **5000**.
*   **Administration** : `http://localhost:5000` (ou `http://[ADRESSE_IP_SERVEUR]:5000` depuis un autre PC).
*   **Écran TV** : `http://[ADRESSE_IP_SERVEUR]:5000/tv` (depuis le navigateur de votre TV/Fire Stick).

---

## 🔑 Premier compte (administrateur)

Il n'y a **aucun compte ni mot de passe par défaut**. Au premier démarrage, ouvrez l'administration :
la page de connexion propose **« Créer le compte administrateur »**. Le premier compte créé devient
administrateur ; ensuite **les inscriptions sont fermées** (variable `ALLOW_REGISTRATION=true` pour les rouvrir).

> 🔒 Mot de passe : 8 caractères minimum. Si vous mettez à jour une ancienne installation qui utilisait
> `admin@magasin.local / admin123` ou `hugu@imagescreen.local / 1234`, ces comptes sont conservés mais
> **un changement de mot de passe est exigé** à la prochaine connexion.

Voir aussi [`SECURITY.md`](SECURITY.md).

---

## 📺 Comment Connecter et Associer une Télévision

1.  Allumez votre télévision (ou un appareil connecté sur le même réseau local) et ouvrez son navigateur web sur l'adresse :
    `http://[ADRESSE_IP_SERVEUR]:5000/tv` (Ex: `http://192.168.1.50:5000/tv`).
2.  L'écran affichera un code de couplage unique à 6 caractères (ex: `A7K9P2`).
3.  Connectez-vous à l'administration sur votre PC (`http://localhost:5000`).
4.  Une alerte s'affiche en haut du tableau de bord : **"Nouveau(x) écran(s) détecté(s)"**.
5.  Cliquez sur **Associer**, donnez un nom à l'écran (ex: "TV Atelier" ou "TV Hall d'entrée") et affectez-lui une playlist de diffusion.
6.  **Instantane** : L'écran de la télévision se met à jour sans rechargement de page et commence à diffuser le contenu.

---

## 📴 Fonctionnement Hors Ligne (Cache Local)

Chaque écran connecté dispose d'un système intelligent de sauvegarde locale :
1.  Dès qu'une playlist est affectée à l'écran, le navigateur TV télécharge les fichiers images et vidéos et les enregistre dans le cache du navigateur (`Cache Storage`).
2.  La structure de la playlist (ordre, transitions, durées) est sauvegardée dans le `localStorage` de l'écran.
3.  Si le réseau local ou le serveur tombe en panne :
    *   L'écran détecte la perte de connexion.
    *   Un petit indicateur discret **"Mode hors ligne"** s'affiche dans le coin inférieur gauche.
    *   La lecture se poursuit indéfiniment en boucle à partir des fichiers mis en cache.
    *   Une fois la connexion rétablie, l'écran reprend sa synchronisation normale avec le serveur.
