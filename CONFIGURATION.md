# Configuration des environnements Patron

L'application utilise uniquement `react-native-config`. Les URLs d'API sont des
valeurs publiques ; les clés privées, jetons, mots de passe, fichiers de signature
et `google-services.json` ne doivent jamais être ajoutés aux fichiers `.env`.

## Fichiers

- `.env.development` : émulateur Android local, backend sur le port 3001.
- `.env.staging` : recette. La valeur `example.invalid` est volontairement
  inutilisable et doit être remplacée par la véritable URL de recette.
- `.env.production` : serveur de production.
- `.env.example` : exemple local sans secret.

Des valeurs locales sensibles éventuelles doivent être placées dans un fichier
`.env.*.local`, ignoré par Git, et injectées par le processus de build approprié.

Chaque fichier définit `APP_ENV` (`development`, `staging` ou `production`) et
`API_URL`. L'URL Socket.IO est automatiquement dérivée de `API_URL` en retirant
uniquement le suffixe final `/api`.

## Commandes Android

```text
npm run android:dev
npm run android:staging
npm run android:prod

npm run build:android:dev
npm run build:android:staging
npm run build:android:prod
```

`npm run android` reste disponible et lance l'environnement de développement.
Les variantes conservent l'identifiant Android historique afin de rester
compatibles avec la configuration Firebase existante. Elles ne doivent donc pas
être installées simultanément sur le même appareil.

## Vérification

Gradle affiche le fichier chargé au début du build. L'application refuse de
démarrer si `APP_ENV` ou `API_URL` est invalide. Un build staging ne peut pas
pointer vers l'hôte de production et un build production refuse les hôtes locaux
ou identifiés comme staging/recette.

Avant une recette réelle, remplacer l'hôte réservé `staging.example.invalid`
dans `.env.staging` par l'URL HTTPS fournie pour l'environnement de recette.
