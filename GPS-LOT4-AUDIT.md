# Lot 4 — audit GPS et UX Patron

## Constat terrain et limite de la preuve

BOUCHTA : ronde terminée à 20:10:47, suivi autorisé jusqu’à 22:10:47, dernière position à 20:10:47 et âge 674 secondes. Offline est cohérent ; la fenêtre autorise le suivi mais ne prouve pas une acquisition ni un envoi effectif. Aucun appareil ADB n’était connecté pendant cet audit. Sans traces du téléphone concerné, la cause exacte de cet incident physique reste non confirmée.

## Chaîne auditée

- **Agent** : `LiveGpsController` conserve le service après fin de ronde, appelle `end`, puis le service revalide la fenêtre auprès du serveur. Le passage en arrière-plan ne dispose pas du contrôleur ; logout/changement de compte le stoppe. Pas de collecte autorisée hors mission ni sans réseau validé. Le cycle natif est de 30 secondes, avec une limite d’envoi de 15 secondes. La prolongation reste bornée par la réponse serveur et une échéance monotone/alarme.
- **Défaut reproduit** : l’ancien service choisissait exclusivement `NETWORK_PROVIDER` dès qu’il était activé, même s’il ne fournissait aucun point. Il retirait les abonnements après 10 secondes. Le GPS n’était alors jamais sollicité ; même sans réseau, un premier point GPS après 10 secondes était perdu. Le backend peut néanmoins conserver la position du dernier scan, donnant l’impression que le suivi s’arrête au dernier checkpoint.
- **Correction Agent** : acquisition GPS et réseau dans une fenêtre bornée de 25 secondes ; point réseau de secours récent si aucun point précis n’arrive ; conservation du timestamp réel du point. Aucun allongement de l’autorisation de suivi. Reconnexion, fin de fenêtre et perte réseau conservent leurs limites.
- **Backend** : `POST /gps/heartbeat` revalide appareil, utilisateur, session, site et fenêtre post-ronde. Le stockage atomique garde une seule position, exige un `capturedAt` croissant, limite les mises à jour à une par 15 secondes, et accepte les positions de moins de 45 secondes. Budget de 12 heartbeats/minute par capacité, distinct du quota des scans. Les tests acceptent trois positions post-ronde successives espacées de 30 secondes. Aucun code serveur modifié.
- **Socket.IO** : `agent.location.updated` contient `{changed:true}` et non des coordonnées. Les candidats proviennent des rooms société/site/admin ; identité, permission et site sont revérifiés avant émission. Patron relit `/gps/live`, dont les permissions sont à nouveau vérifiées. Reconnexion et événements de ronde provoquent également cette lecture. Correction d’une invalidation reçue pendant une requête plus ancienne : une seconde lecture suit sa fin.
- **Patron** : snapshot REST dans React Query, clé société/utilisateur, filtre site sur les agents autorisés, injection des coordonnées dans WebView après son signal `ready`. L’ancien Leaflet recréait tous les marqueurs et recalait la caméra si la liste changeait. Il conserve maintenant les instances et applique `setLatLng`/`setStyle` au marqueur concerné. Une seule mise au cadre initiale ; zoom/pan conservés ensuite, recentrage explicite sur l’agent. Suppression du marqueur à expiration/disparition du snapshot.

## Preuve reproductible (données de test, pas une trace terrain)

| Position | capturedAt | Latitude | Longitude |
|---|---|---:|---:|
| 1 | 2026-09-17T20:10:47.000Z | 33.500 | -7.600 |
| 2 | 2026-09-17T20:11:17.000Z | 33.501 | -7.600 |
| 3 | 2026-09-17T20:11:47.000Z | 33.502 | -7.600 |

`__tests__/mapRuntime.test.ts` exécute le script livré à la WebView avec un adaptateur Leaflet instrumenté : un même marqueur reçoit les trois points, l’autre reste inchangé, la caméra n’est pas réinitialisée. `LiveAgentsMap.test.tsx` contrôle aussi les trois injections React → WebView et le rejeu après `ready`. Le test natif simule un fournisseur réseau silencieux et des points GPS post-ronde après 12 secondes d’acquisition. Le test backend vérifie stockage, ordre temporel, scope et notifications successives. Ces tests sont complémentaires ; ils ne constituent pas un test physique réseau de bout en bout.

## Diagnostic terrain disponible dans le futur APK Agent

Ouvrir « Diagnostic GPS » sous l’indication de localisation : service démarré/arrêté, étape, code HTTP, fournisseurs, trois derniers points envoyés avec heure de capture et heure de réponse serveur. Mémoire limitée à trois envois et effacée à l’arrêt du service ; aucun jeton ni stockage d’un trajet. Un HTTP 200 indique une réponse réussie, pas une preuve de mouvement physique ou d’acceptation d’un point éventuellement limité par le backend.

Les étapes sans coordonnées ni secrets sont également consultables avec `adb logcat -s ControndeLiveGps`. Sur le téléphone du cas terrain, comparer avant/après `LOCAL_ROUND_END`, `AUTHORIZED_POST_ROUND`, `ACQUIRING`, `NO_FRESH_FIX`, `POSITION_SENT`, `WAITING_NETWORK`, `HEARTBEAT_FAILED` ou `AUTHORIZATION_REFUSED`.

## Carte et UX

Satellite par défaut, Plan disponible sans nouvelle bibliothèque. Tuiles Esri World Imagery et OpenStreetMap, attribution visible, erreurs de fond explicites. Sources techniques : [Leaflet TileLayer et marqueurs](https://leafletjs.com/reference.html), [attribution Esri World Imagery](https://doc.arcgis.com/en/data-appliance/2022/maps/world-imagery.htm).

Fiche compacte au clic : agent, site, ronde, progression, dernier point, coordonnées, précision, heure, ancienneté, statut, fenêtre post-ronde et accès au détail de ronde lorsqu’un identifiant de ronde planifiée existe. Liste d’agents repliable pour privilégier la carte. Segments Liste/Carte ; KPI, activité, filtres et cartes compactés ; quatre onglets et fonctions existantes conservés. Vert Live/terminé, orange Stale/retard, rouge Offline/manqué, avec libellés textuels. L’âge continue d’avancer sans nouvel événement ; une position ancienne n’est pas affichée Live.

## Livraison

Aucun commit, push, déploiement ni APK final. Les changements natifs nécessitent un futur APK Agent ; les changements carte/UX un futur APK Patron. Aucun déploiement backend requis. Les changements préexistants du module rappels Agent sont conservés hors périmètre de cette correction.

## Résultats de validation

| Vérification | Résultat |
|---|---|
| Patron Jest complet | 114/114 |
| Agent Jest complet + reprise ciblée | 232/232 validés : 230 au premier passage, les 2 tests de navigation dépassant le délai passent en reprise isolée |
| Agent natif GPS | 20/20 : 11 règles de sécurité temporelle, 9 tests de service |
| Backend GPS ciblé | 20/20 |
| Backend complet + reprise ciblée | 531/531 validés après reprise : 529 au passage sur base neuve, puis la suite round-sessions passe 29/29 après son échec d’initialisation |
| Patron lint / typecheck | OK |
| Agent lint / typecheck | OK |
| Backend lint / typecheck / build | OK |
| Android Patron | `:app:assembleDevelopmentDebug` OK ; validation locale seulement |
| Diff whitespace | `git diff --check` OK dans les deux dépôts |
| Revue ciblée | Deux observations corrigées (fraîcheur du point de secours, diagnostic sur thread UI), puis aucune anomalie actionnable à la seconde revue |

Les suites backend et Agent n’ont donc pas été toutes vertes au premier passage. Une première base backend réutilisée contenait des données anciennes qui perturbaient un test de pagination ; une base neuve a été créée sans supprimer la précédente. Les reprises sont enregistrées séparément, sans suppression d’assertions ni changement de délai des tests.

Rapports locaux ignorés par Git dans `android/build` : `gps-patron-tests.json`, `gps-agent-tests.json`, `gps-agent-navigation-retry.json`, `gps-backend-tests.json`, `gps-backend-rounds-retry.json`, `gps-review-final.log`. Les rapports JUnit natifs sont dans le dossier `android/app/build/test-results/testDebugUnitTest` du projet Agent.
