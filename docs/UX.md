<!-- markdownlint-disable -->
# Caisse Noire — UX & versions (jeu physique + en ligne)

> Compilation de tout ce qu'on a dit sur (A) l'expérience du **jeu de plateau physique** et (B) la **version en ligne**.
> Les règles qui font foi restent `docs/REGLES.md §16` (modèle v0.7). Le brief technique complet de l'online est `docs/DEV.md`.

---

# PARTIE A — UX du jeu physique

## A1. Ce qu'il y a sur la table (matériel & zones)

Setup volontairement **épuré**. Au centre, partagé par tous :

- **Le marché tournant de Votants** : la pioche de blocs uniques est mélangée, on en révèle **~6 à 8 face visible** dans un présentoir. Ce sont les seuls blocs achetables à l'instant T ; dès qu'un est acheté, on le **remplace** par le suivant. (On n'étale jamais les ~64 blocs : lisibilité + tension — *le bloc convoité peut partir avant ton tour*.)
- **La pioche « Les Combines »** (cartes action : financements, attaques, défenses, coups), face cachée, dos uniforme — scindable en 2-3 piles identiques autour de la table pour l'accès. Défausse commune à côté (remélangée quand la pioche est vide).
- **Une piste de score commune** graduée de 0 au seuil, avec **un pion/meeple par joueur**. Aide de lecture de la course. *(En v0.7 les voix se lisent aussi directement sur les votants posés ; la piste reste le miroir pratique.)*

Devant **chaque joueur** (sa zone) :

- **Une roulette d'argent** (0 → 80 M€, au million) — remplace les billets, argent **visible** de tous.
- **Le casier de corruption = 3 fronts** (Justice · Presse · Finances) où l'on **empile les financements FACE CACHÉE**. Les autres voient des dos ; ils ne savent pas si c'est sale ou un leurre propre.
- **Les Votants achetés, FACE VISIBLE** — c'est le score, lisible par tous.
- **La main de 5 cartes** (cachée).
- **La carte Parti** (famille interdite), **face cachée devant soi** — l'asymétrie secrète.
- Aides de jeu : table des **incompatibilités**, fronts ↔ protections, rappel de la boucle.

## A2. Anatomie des cartes (ce qu'on voit dessus)

- **Votant** : nom satirique + **famille** + **coût (M€)** + **voix**. Chaque bloc est **unique**. Texte très court (voix bien lisibles). Paliers ≈ 2 M€/voix : Petit 4/2 · Moyen 8/4 · Gros 12/6.
- **Financement** : **Sale** (3 / 6 / 9 M€, dénonçable, malus = le montant) ou **Propre / leurre** (3 / 6 M€, sûr, jamais dénonçable). Joué **face cachée** sur un front. ~2 sales pour 1 propre.
- **Attaques** : **Dénonciation** (2 M€), **Débauchage** (carte, vol de voix), **OPA électorale** (carte, vol renforcé).
- **Défenses** : **Protection** (5 M€, bouclier permanent d'un front — Juge acheté / Médias corrompus / Compte offshore), **Blanchiment** (3 M€, rend une carte sale propre), **Élément de langage** (réaction : annule une dénonciation).
- **Coups tactiques** : Remise de campagne, Incohérence, Promesse intenable, Renvoi d'ascenseur…
- **Parti** : un nom + **une famille interdite** (au dos-révélé). Style visé pour toutes les cartes : **1 phrase de règle + 1 phrase drôle**.

## A3. Le tour de jeu (déroulé physique)

1. **Revenu** : tu montes ta roulette de **+3 M€** (automatique, pas une carte).
2. **2 actions**, au choix :
   - **Acheter un Votant** au marché → baisse ta roulette du coût, **pose le bloc face visible**, avance ton pion des voix (−1 si coalition molle). On révèle un nouveau bloc à la place.
   - **Se financer** → **pose une carte face cachée** sur un front, monte ta roulette (personne ne sait si tu es sale ou si c'est un leurre).
   - **Attaquer** : Dénoncer (2 M€) / Débaucher / OPA.
   - **Se défendre** : Protéger (5 M€) / Blanchir (3 M€).
   - **Coup tactique**, ou **Recycler** (défausser 1-2 cartes et repiocher — pari, la pioche est aveugle).
3. **Élément de langage** : se joue **en réaction**, hors de ton tour, quand on te dénonce.
4. **Négociation libre** à tout moment (pactes, pots-de-vin, trahisons — à la parole).
5. **Fin de tour** : complète ta main à **5**.
6. **Jeton premier joueur** : tourne à chaque manche (équité).
7. Un pion atteint le **seuil (70 − nb de joueurs)** → **on termine la manche en cours**, puis le **plus de voix gagne** (même s'il est redescendu sous le seuil par une dénonciation de fin de manche).

## A4. Les gestes clés (UX des interactions cachées)

Le cœur sensoriel du jeu, c'est **l'information cachée tactile** :

- **Se financer** = poser un **dos** sur un front. Toute la table voit ton argent grimper et ta pile épaissir, **sans savoir** si tu fraudes ou si tu bluffes avec des leurres.
- **Dénoncer** = **pari** : tu désignes un rival **+ un de ses 3 fronts**, et on résout selon le modèle de règle en vigueur (voir l'encadré ⚠️ ci-dessous). Touché → la cible **perd de l'argent** ; si elle est à sec (tout converti en voix), elle **rend des votants de son choix** → elle **perd des voix** (le frein se cible tout seul sur le meneur). Raté → l'accusateur paie sa mise **+ 3 M€ d'amende** à la cible.
- **Débaucher / OPA** = tu joues la carte, mais **c'est la VICTIME qui choisit** quel votant **isolé** elle te cède (un bloc en coalition complète est involable).
- **Famille interdite** = tu ne peux jamais acheter cette famille ; les autres **devinent** la tienne à ta façon de jouer.

> ⚠️ **Point de règle à trancher (dénonciation).** Deux versions coexistent dans le repo :
> - **§16.1 + prompt v0.7 + catalogue** : on révèle **UNE carte** (le dessus de la pile du front) ; les autres voient **le nombre** de cartes par front. → parties plus longues, leurres qui protègent les cartes du dessous.
> - **§16.4 (version actuelle du fichier)** : casier **totalement invisible** (on ne voit même pas le nombre), pari **à l'aveugle**, et si touché la cible perd la **somme de TOUT le front**.
> Dis-moi laquelle est la bonne et j'aligne les 4 documents.

## A5. Principes UX retenus (le « pourquoi »)

- **Le score est lisible en permanence** (piste + votants face visible) → la course est claire → **le meneur est une cible évidente** pour les dénonciations. C'est le frein anti-runaway rendu visible.
- **Marché tournant ~8** (et pas ~64 étalés) : lisibilité + tension du bloc qui file.
- **Roulette d'argent** au lieu de billets : moins de manip, argent public.
- **Corruption cachée** (piles de dos) : la couche bluff/psychologique façon *Coup / Sheriff of Nottingham*.
- **Cartes courtes** : 1 phrase de règle + 1 phrase drôle ; on raccourcit surtout les votants (les voix doivent sauter aux yeux).
- **Incompatibilités** (dures interdites / molles −1 voix) : forcent une **identité de parti cohérente** ; overreach possible mais dénonçable.
- **Setup épuré** : le seul « luxe » ajouté est la piste de score, justement pour la lisibilité de la course.

---

# PARTIE B — La version en ligne

Objectif affiché : **jouer entre potes en ligne, le plus simplement possible** — *créer une partie → partager un lien → jouer ensemble*. On se fiche volontairement (pour la beta) de l'anti-triche, de l'auth, du scaling.

## B1. Deux pistes discutées (choix à faire)

| | **Piste « rapide, sans serveur »** (README) | **Piste « propre »** (DEV.md — recommandée) |
|---|---|---|
| Techno | **Supabase Realtime** | **Node + `ws`** (WebSocket) |
| Hébergement | **Statique** (Vercel / GitHub Pages / Netlify) | **Un service Node** (Render) |
| Autorité | **Hôte autoritatif** (un navigateur) | **Serveur autoritatif** (« croupier ») |
| Cartes cachées | ⚠️ **Non garanties** : l'état complet transite par le canal temps réel (suffisant entre potes de confiance) | ✅ **Vraiment cachées** : le serveur ne diffuse que `publicState(state, joueur)` |
| Effort | Très faible, déploiement 2 min | Un `server.js` + un client réseau |

> Comme le jeu repose sur du **bluff (cartes de financement cachées + famille interdite)**, la piste **Node/serveur est la bonne** pour un vrai secret. La piste Supabase reste un dépannage ultra-rapide pour tester la boucle entre gens de confiance.

## B2. Le flux « lien de partie » (commun aux deux pistes)

1. L'hôte ouvre le site → **« Créer une partie »** → un **code court** (ex. `PXR7`) + un **seed secret**.
2. Il partage l'URL : `https://<app>/?room=PXR7`.
3. Les potes ouvrent le lien → **lobby** : pseudo, **choix d'un parti** (parmi les 6), « Prêt ».
4. À 2-6 joueurs prêts, **l'hôte clique « Démarrer »** → `createGame({ nPlayers, partyIds, seed })` → premier `publicState` diffusé.
5. Les **sièges vides** peuvent être tenus par des **bots** (`botChooseAction`).

## B3. Architecture serveur (piste propre)

```
Navigateur (hôte) ─┐
Navigateur (pote) ─┼── WebSocket ──► UN process Node ──► src/engine.js (état autoritatif par room)
Navigateur (pote) ─┘
```

- **Un seul process** sert le client statique (HTTP) **et** les WebSockets. État des parties **en mémoire** (`Map<roomCode, room>`), pas de base de données.
- **Pourquoi un serveur est obligatoire** (même sans souci de triche) : il faut un **croupier** qui mélange/distribue en secret. Le client ne reçoit **jamais** l'état complet ni le **seed** — seulement `publicState(state, sonId)` (les mains adverses = juste un **nombre** de cartes).
- **Boucle serveur** : reçoit `{kind:'action', action}` → vérifie que c'est bien le joueur courant → `applyAction` → **rediffuse à chaque siège** son `publicState` + le journal. Avance seul les tours **bots / déconnectés** (`playOutTurn`, ~600 ms entre actions pour la lisibilité). **Minuteur AFK** : si un humain ne joue pas en ~60 s, le serveur joue son tour (bot / END_TURN).
- **Simplification assumée** : l'**Élément de langage** reste **automatique** (le moteur le joue si la cible l'a) — pas de fenêtre de réaction minutée pour la beta (le seul vrai morceau « temps réel » compliqué, repoussé).
- **Déconnexions** : à la connexion le serveur renvoie un **token** ; `{kind:'rejoin', room, token}` rebranche le joueur à son siège avec l'état courant.
- **Négociation** = simple **chat texte** (aucune transaction à coder ; la trahison fait partie du jeu).

**Protocole (JSON sur WebSocket), résumé** — Client→Serveur : `createRoom` · `joinRoom` · `chooseParty` · `ready` · `addBot` · `start` · `action` · `rejoin` · `chat`. Serveur→Client : `joined` · `lobby` · `state` (avec `view`, `yourTurn`, `legal`) · `chat` · `error` · `over`.

## B4. Client réseau (l'UI en ligne)

- **Repartir du rendu de la démo `index.html`** (le visuel plateau / marché / main / journal / dos de cartes est déjà fait).
- **Retirer** : le moteur local, les bots locaux, l'ordonnanceur. Le client **ne calcule plus rien** : il **reçoit `view` et l'affiche**.
- **Brancher** : au clic (acheter, financer, dénoncer, recycler, finir le tour), envoyer `{kind:'action', action}`. Utiliser le tableau `legal` reçu pour **n'activer que les boutons permis**.
- **Écrans** : Accueil (Créer / Rejoindre via code) → Lobby (pseudo, parti, prêt, Démarrer, « Ajouter un bot ») → Partie (le plateau) → Fin. Le lien `?room=CODE` pré-remplit « Rejoindre ». **Chat** = zone texte (négo libre).

## B5. Déploiement

- **Piste Node → Render** (gratuit, lien permanent) : `package.json` avec `"start":"node server.js"`, écouter `process.env.PORT`, servir `public/`. New → Web Service → connecter le repo → `npm install` / `npm start`. Render donne l'URL `wss://` automatiquement (même origine). *(Plan gratuit : le service s'endort après inactivité, ~30 s au réveil — sans importance entre potes.)*
- **Piste Supabase → statique** : pousser les fichiers sur Vercel / GitHub Pages / Netlify, partager l'URL, chacun ouvre, un crée la table, les autres entrent le code.

## B6. Definition of done (beta) & hors périmètre

**Fait quand** : depuis 2 machines on peut créer une room, partager le lien, rejoindre, choisir un parti, démarrer ; chacun **ne voit que sa main** (vérifier qu'aucun `state` complet ni `seed` ne fuit) ; toutes les actions passent par le serveur et se reflètent chez tous ; on peut compléter avec des **bots** ; un joueur qui **recharge** retrouve sa partie ; une partie va **jusqu'au seuil** et l'affiche ; **déployé** et jouable à 3-6.

**Hors périmètre (beta)** : anti-triche fort / chiffrement / comptes / persistance / scaling ; fenêtre de réaction interactive pour l'Élément de langage ; échanges d'argent-cartes contractuels (négo au chat) ; responsive mobile avancé.

> **Règle d'or dev** : ne pas toucher à `src/engine.js` (valeurs calibrées par simulation) — on n'ajoute que la couche réseau + un client qui parle au moteur.

---

## Incohérences repérées à trancher

1. **Dénonciation** : « 1 carte + nombre de cartes visible » (§16.1, prompt, catalogue) **vs** « tout le front, casier totalement invisible, à l'aveugle » (§16.4 actuel). → à unifier.
   **✅ TRANCHÉ (juillet 2026, décision EJ)** : c'est la version **§16.4** qui fait foi — casier **totalement invisible** (ni contenu ni nombre de cartes), dénonciation **à l'aveugle**, touché = la cible perd **tout le sale du front**. C'est ce qui est implémenté (moteur + UI) ; les mentions « 1 carte » ailleurs sont historiques.
2. **Online** : Supabase sans serveur (README) **vs** Node serveur (DEV.md). → choisir (Node recommandé pour le vrai secret des cartes).
   **✅ TRANCHÉ pour la beta** : on reste sur **Supabase hôte-autoritatif** (déployé, ça marche entre potes). La piste **Node/Render reste la cible** quand on voudra un vrai secret cryptographique des mains — brief prêt dans `DEV.md`.

## ⚠️ Valeurs périmées dans ce doc (l'implémentation v0.7 fait foi)

- **Seuil = 45 voix FIXE** pour 2→6 joueurs (calibré par simulation) — pas « 70 − joueurs » (§A3).
- **Incompatibilités = paires EXCLUSIVES** (achat refusé, pas de « molle −1 voix »).
- **Lobby en ligne : pas de choix de parti** — la famille interdite est tirée au sort et secrète (§16.5).
- **UX appliquée (build table-v1)** : table plein écran sans scroll (zooms partout), main en éventail, cartes papier (titre + illustration par type + règle + phrase drôle), thème feutre/bois sobre, piste-réglette, journal en panneau + zoom.
