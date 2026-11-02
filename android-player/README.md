# ImageScreen TV — APK pour Android TV / Fire TV

Enveloppe [Capacitor](https://capacitorjs.com) autour de la page `/tv` du frontend :
plein écran, écran toujours allumé, vidéos en lecture automatique, relance au démarrage.

## Obtenir l'APK (sans rien installer)

1. Sur GitHub : **Actions → « Build Android TV player (APK) » → Run workflow**.
2. Une fois terminé, téléchargez l'artefact **ImageScreen-TV-apk**.
3. Pour une version publique : `git tag player-v1.0.0 && git push --tags` ; l'APK est ajouté aux *Releases*.

## Compiler soi-même

Prérequis : Node 20+, JDK 17, Android SDK (`ANDROID_HOME`).

```bash
npm install --prefix ../frontend --legacy-peer-deps
npm install
npm run sync          # build du frontend en mode TV + cap sync
cd android && ./gradlew assembleDebug
# APK : android/app/build/outputs/apk/debug/app-debug.apk
```

## Installer sur la TV

- **Fire TV Stick** : *Paramètres → Ma Fire TV → Options pour les développeurs → Applications de sources inconnues*,
  puis installez avec l'application **Downloader** (collez l'URL de l'APK) ou `adb install ImageScreen-TV.apk`.
- **Android TV** : activez les sources inconnues, puis `adb connect <ip-tv>` et `adb install ImageScreen-TV.apk`.

## Premier lancement

1. L'app demande l'**adresse du serveur** (ex. `192.168.1.50:5000` ou `image-screen.app`).
2. Elle affiche ensuite le **code de couplage** à 6 caractères.
3. Dans l'administration, associez l'écran avec ce code.

L'adresse est mémorisée ; pour en changer, effacez les données de l'app (Paramètres Android → Applications).

## Limites connues

- L'APK « debug » est signé avec une clé de débogage : parfait pour installer à la main, pas pour le Play Store.
- Le lancement automatique au démarrage peut être bloqué par Android 10+ sur certains appareils
  (activez « Affichage par-dessus d'autres apps » pour ImageScreen TV).
- Le serveur peut être en HTTP sur le réseau local (autorisé), mais préférez HTTPS en ligne.
