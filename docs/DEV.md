# Caisse Noire — Brief de dev : beta multijoueur en ligne (minimale)

> **À donner tel quel à Claude Code.** Objectif : pouvoir tester le jeu **avec quelques amis en ligne**,
> le plus simplement possible. On se fiche **volontairement** de l'anti-triche, de la montée en charge,
> de l'auth et de la sécurité. On veut juste : *créer une partie → partager un lien → jouer ensemble*.

---

## 0. Contexte du repo (déjà fait — NE PAS réécrire)

- `src/engine.js` = **moteur de règles complet, headless, déterministe** (RNG seedée). C'est la **source de vérité**. Ne pas dupliquer ni réimplémenter les règles. API exportée :
  - `createGame({ nPlayers, partyIds?, seed? }) -> state`
  - `legalActions(state, playerId) -> [action]`
  - `applyAction(state, playerId, action) -> { ok, error?, state }` *(mute l'état)*
  - `publicState(state, playerId) -> vue filtrée` *(masque les mains des autres : seulement `handCount`)*
  - `botChooseAction(state, playerId) -> action`
  - `playOutTurn(state, playerId)` *(joue tout le tour d'un joueur via l'IA)*
  - `seuil(nPlayers)`, `simulate(...)`, et les constantes (`PARTIES`, `VOTANTS`, …)
  - Types d'actions : `BUY_VOTANT`, `PLAY_FINANCE`, `PLAY_PROTECT`, `PLAY_BLANCH`, `PLAY_DENOUNCE`, `PLAY_COUP`, `RECYCLE`, `END_TURN` (détail en tête de `engine.js`).
- `index.html` = démo locale jouable (UI + IA). **Sert de référence visuelle** : on réutilise son rendu (plateau, marché, main, journal) pour le client réseau.
- `docs/REGLES.md` = règles complètes du jeu.

---

## 1. Architecture (la plus simple qui marche)

```
Navigateur (hôte)  ─┐
Navigateur (pote)  ─┼── WebSocket ──►  UN serveur Node  ──►  src/engine.js (état autoritatif par room)
Navigateur (pote)  ─┘
```

- **Un seul process Node** sert à la fois le client statique (HTTP) et les WebSockets.
- **Le serveur tient l'état** de chaque partie en mémoire (une `Map<roomCode, room>`). Pas de base de données.
- **Pourquoi un serveur est obligatoire** (même sans souci de triche) : le jeu a des **cartes cachées** ; il faut un « croupier » qui mélange et distribue en secret. Le client ne reçoit **jamais** l'état complet, seulement `publicState(state, sonId)`.
- Déterminisme : le **seed reste côté serveur** (ne jamais l'envoyer au client).

---

## 2. Stack & arborescence cible

- **Node ≥ 18**, deux dépendances max : [`ws`](https://www.npmjs.com/package/ws) (WebSocket) et éventuellement [`express`](https://www.npmjs.com/package/express) (sinon le `http` natif suffit).
- Pas de bundler, pas de framework front. Vanilla JS, comme `index.html`.

```
/
├── src/engine.js          (existant — règles)
├── server.js              (À CRÉER — serveur HTTP + WebSocket + rooms)
├── public/
│   ├── index.html         (À CRÉER — client réseau, dérivé de la démo /index.html)
│   └── app.js             (À CRÉER — logique client : connexion WS, rendu publicState, envoi actions)
├── package.json           (mettre à jour : "start": "node server.js", deps ws/express)
└── docs/DEV.md            (ce fichier)
```

> Garder l'`index.html` de démo à la racine (mode solo hors-ligne, utile). Le client **réseau** va dans `public/`.

---

## 3. Le flux « lien d'une partie »

1. L'hôte ouvre le site → bouton **« Créer une partie »** → le serveur crée une room avec un **code court** (4–5 lettres/chiffres, ex. `PXR7`) et un **seed aléatoire secret**.
2. L'hôte est redirigé / voit une URL à partager : `https://<app>.onrender.com/?room=PXR7`.
3. Les potes ouvrent le lien → écran de **salon (lobby)** : ils saisissent un pseudo, choisissent un **parti** (parmi les 6, voir `PARTIES`), puis « Prêt ».
4. Quand 2 à 6 joueurs sont prêts, l'**hôte clique « Démarrer »** → le serveur appelle `createGame({ nPlayers, partyIds, seed })` et diffuse le premier `publicState`.
5. Les sièges **non remplis** peuvent être confiés à des **bots** (`botChooseAction`) si l'hôte veut compléter une partie.

---

## 4. Serveur (`server.js`) — responsabilités

Structure d'une room en mémoire :

```js
room = {
  code,
  seed,                 // secret, jamais envoyé au client
  hostConnId,
  status: 'lobby' | 'playing' | 'over',
  seats: [              // 1 entrée par siège
    { playerId, name, partyId, connId|null, isBot, ready, connected }
  ],
  state: null,          // l'état du moteur une fois la partie lancée
  turnTimer: null,
}
```

Boucle de jeu côté serveur :

1. Reçoit un message client `{ kind:'action', action }`.
2. Vérifie que l'expéditeur est bien le joueur courant (sinon ignore/erreur).
3. `applyAction(room.state, playerId, action)` ; si `ok`, **diffuse à chaque siège** son `publicState(room.state, seatPlayerId)` + le journal.
4. **Avance automatiquement les tours « non-humains »** : tant que le joueur courant est un **bot** ou un **siège déconnecté**, appeler `playOutTurn(state, currentId)` puis re-broadcaster. (Petit délai ~600 ms entre actions pour que ce soit lisible — réutilise l'idée du « mode Regarder » de la démo.)
5. **Minuteur de tour** : si un humain ne joue pas en `N` secondes (ex. 60 s), le serveur joue son tour à sa place via `botChooseAction`/`END_TURN`. Ça évite qu'un joueur AFK gèle la partie.

> **Simplification clé (assumée) :** l'« Élément de langage » reste **automatique** (le moteur le joue tout seul si la cible l'a en main — c'est toujours le bon choix de l'utiliser quand on est dénoncé). On **n'implémente PAS** de fenêtre de réaction minutée pour la beta : ça supprime le seul morceau « temps réel » compliqué. À ajouter plus tard si on veut le bluff de la rétention.

---

## 5. Protocole de messages (JSON sur WebSocket)

**Client → Serveur :**

```jsonc
{ "kind": "createRoom", "name": "EJ" }
{ "kind": "joinRoom",   "room": "PXR7", "name": "Marco" }
{ "kind": "chooseParty","partyId": "vague" }
{ "kind": "ready",      "value": true }
{ "kind": "addBot" }                          // hôte : ajoute un siège bot
{ "kind": "start" }                           // hôte uniquement
{ "kind": "action",     "action": { "type": "BUY_VOTANT", "marketIndex": 3 } }
{ "kind": "rejoin",     "room": "PXR7", "token": "..." }   // reconnexion
{ "kind": "chat",       "text": "je te file 3 M€ si tu tapes Marco" }  // négo libre = chat
```

**Serveur → Client :**

```jsonc
{ "kind": "joined",  "room": "PXR7", "youAreSeat": 1, "token": "...", "lobby": { ...sièges... } }
{ "kind": "lobby",   "seats": [ ... ], "canStart": true }
{ "kind": "state",   "view": { /* publicState(state, ceJoueur) */ }, "yourTurn": true,
                      "legal": [ /* legalActions, pour activer/désactiver les boutons */ ] }
{ "kind": "chat",    "from": "Marco", "text": "..." }
{ "kind": "error",   "message": "pas ton tour" }
{ "kind": "over",    "winner": 2, "reason": "seuil" }
```

> La **négociation libre** des règles = simple **chat texte** : les joueurs s'arrangent à la parole, aucune transaction à coder (la trahison fait partie du jeu). Les échanges d'argent/cartes contractuels = plus tard.

---

## 6. Gestion des déconnexions (minimal mais nécessaire)

- À la connexion, le serveur renvoie un **token** (id de session). Le client le garde (variable / `sessionStorage`).
- Si un joueur recharge / coupe : il renvoie `{ kind:'rejoin', room, token }` → le serveur le rebranche à son siège et lui renvoie le `state` courant.
- Pendant qu'un siège est déconnecté et que c'est son tour : le **minuteur** le joue en bot pour ne pas bloquer.

---

## 7. Client réseau (`public/index.html` + `public/app.js`)

- **Repartir du rendu de la démo `index.html`** (le visuel plateau/marché/main/journal/dos de cartes est déjà fait et joli).
- **Retirer** : le moteur local, les bots locaux, l'ordonnanceur temporisé. Le client ne calcule plus rien : il **reçoit `view` et l'affiche**.
- **Brancher** : sur clic (acheter un votant, jouer une carte, dénoncer, recycler, finir le tour), envoyer `{ kind:'action', action:{...} }`. Utiliser le tableau `legal` reçu pour n'activer que les actions permises (et éviter les allers-retours d'erreur).
- Écrans : **Accueil** (Créer / Rejoindre via champ code) → **Lobby** (pseudo, choix du parti, prêt, bouton Démarrer pour l'hôte, + bouton « Ajouter un bot ») → **Partie** (le plateau) → **Fin**.
- Le lien partagé `?room=CODE` pré-remplit l'écran « Rejoindre ».
- **Chat** : une simple zone texte (négociation libre).

---

## 8. Déploiement sur Render (gratuit, lien permanent)

1. `package.json` : `"start": "node server.js"`, `"engines": { "node": ">=18" }`, deps `ws` (+ `express` si utilisé).
2. Le serveur **doit écouter `process.env.PORT`** (Render fournit le port) et servir les fichiers statiques de `public/`.
3. Pousser le repo sur GitHub.
4. Sur [render.com](https://render.com) → **New → Web Service** → connecter le repo → Render détecte Node → Build : `npm install`, Start : `npm start` → Create.
5. Render donne une URL `https://caisse-noire-xxxx.onrender.com`. **C'est le lien à partager.**
6. *(Note plan gratuit : le service « s'endort » après inactivité ; le premier accès met ~30 s à réveiller. Sans importance pour des sessions entre potes.)*

> Le WebSocket marche sur la même URL/port que le HTTP (Render gère le `wss://` automatiquement). Côté client, ouvrir la socket sur `wss://<host>` (même origine).

---

## 9. Critères d'acceptation (definition of done)

- [ ] Depuis deux navigateurs différents (ou deux machines), on peut **créer une room, partager le lien, rejoindre, choisir un parti, démarrer**.
- [ ] Chaque joueur **ne voit que sa main** ; les autres ne montrent qu'un **nombre** de cartes (vérifier dans l'onglet réseau qu'aucun `state` complet ni `seed` ne fuit).
- [ ] Acheter un votant, se financer, **dénoncer un rival**, protéger, blanchir, recycler, finir son tour → tout passe par le serveur et se reflète chez tous.
- [ ] On peut **compléter une partie avec des bots** (sièges vides).
- [ ] Un joueur qui recharge la page **retrouve sa partie** (rejoin par token).
- [ ] Une partie va jusqu'à la **victoire au seuil** et l'affiche à tous.
- [ ] Déployé sur Render, jouable à 3–6 potes depuis chez eux.

---

## 10. Hors périmètre (à NE PAS faire pour cette beta)

- Anti-triche fort, chiffrement, comptes/auth, classements, persistance en base, scaling multi-instances.
- Fenêtre de réaction interactive pour l'« Élément de langage » (auto pour l'instant).
- Échanges d'argent/cartes contractuels (la négo reste au chat).
- Mobile-first / responsive avancé (un layout correct desktop suffit).

> Règle d'or : **ne touche pas à `src/engine.js`** (les valeurs sont calibrées par simulation). Tu ne fais qu'ajouter la couche réseau + un client qui parle au moteur.
