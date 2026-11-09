# Sécurité d'ImageScreen

## Ce que fait l'application

| Domaine | Protection |
|---|---|
| **Comptes** | Aucun compte par défaut. Le 1er compte créé = administrateur ; inscriptions fermées ensuite (`ALLOW_REGISTRATION`). Mots de passe hachés (bcrypt, coût 12), 8 caractères minimum. |
| **Sessions** | Jeton JWT (HS256 uniquement), 7 jours. Le rôle et la validité sont relus en base à chaque requête ; changer son mot de passe **révoque** tous les anciens jetons. |
| **Secret JWT** | Généré aléatoirement au premier démarrage (`DATA_DIR/jwt.secret`, mode 600) ou fourni via `JWT_SECRET` (≥ 32 caractères). Aucune valeur par défaut. |
| **Force brute** | `express-rate-limit` : 10 échecs de connexion / 15 min / IP, limites sur l'inscription, les téléversements, les licences et l'API. |
| **Temps réel (Socket.IO)** | Les administrateurs doivent présenter leur JWT. Chaque TV possède un **secret d'appareil** (seul son hash est stocké) : connaître l'identifiant d'un écran ne permet plus de l'usurper. |
| **Téléversements** | Type détecté d'après le **contenu** (JPEG/PNG/WEBP/MP4), nom généré côté serveur, taille en pixels vérifiée avant décodage, servis avec `nosniff` + `CSP: sandbox`. |
| **En-têtes HTTP** | Helmet : CSP stricte (aucun hôte tiers), `X-Content-Type-Options`, etc. Le QR de couplage est généré localement. |
| **Base de données** | Valeurs toujours paramétrées ; noms de tables/colonnes validés par liste blanche ; identifiants aléatoires (CSPRNG). |
| **Applications natives** | `allowBackup=false`, débogage WebView désactivé, HTTP refusé pour les serveurs publics (autorisé seulement sur réseau local). |

## Recommandations de déploiement

- **Utilisez HTTPS** dès que le serveur est accessible depuis Internet (Caddy/Nginx devant l'app, avec `TRUST_PROXY=1`). En HTTP sur le réseau local, le mot de passe transite en clair.
- Restreignez `ALLOWED_ORIGINS` à votre domaine si vous n'utilisez pas les applications natives.
- Sauvegardez `DATA_DIR` (base, médias, `jwt.secret`).
- Gardez les dépendances à jour : `npm audit` dans `backend/` et `frontend/`.

## Limites connues

- **Un seul « magasin »** : tous les comptes voient les mêmes écrans, playlists et médias. Pour plusieurs clients, lancez **une instance par client**.
- Les fichiers `/uploads` sont **publics** (nécessaire pour les TV) : ne mettez pas de contenu confidentiel.
- Le jeton de session est stocké dans le `localStorage` du navigateur (nécessaire aux applications natives) ; la CSP stricte et la validation des fichiers limitent le risque XSS.
- Dépendances : Jimp 0.22 (décodage d'images) a des avis de gravité *modérée* sans correctif compatible ; le risque est réduit car seuls des fichiers déjà validés (JPEG/PNG) lui sont transmis. L'outil de build `@capacitor/cli` (APK) a des avis connus : il ne s'exécute que lors de la compilation, il n'est pas embarqué dans l'APK.
- L'APK fourni est signé avec une clé de **debug** (installation manuelle uniquement).

## Signaler une faille

Ouvrez une *issue* privée / contactez le propriétaire du dépôt sans publier les détails avant correction.
