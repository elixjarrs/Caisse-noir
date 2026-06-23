<!-- markdownlint-disable -->

# 🗳️ Caisse Noire

> **Jeu de cartes satirique de corruption électorale — 2 à 6 joueurs.**
> Tu diriges un parti en campagne : finance-toi par la corruption pour acheter des voix, mais chaque combine peut être dénoncée. Premier au seuil de voix → élection gagnée.

**Statut : prototype jouable (beta locale).** Démo HTML autonome, équilibrage calibré par simulation (≥ 90 % des parties se finissent par le seuil de 2 à 6 joueurs).

---

## ▶️ Jouer

Ouvre **`index.html`** dans un navigateur (c'est la page d'accueil = le jeu, donc la racine de ton URL déployée). C'est **la table** : un plateau rendu comme en physique, branché sur le moteur de règles (`src/engine.js`). Deux modes :

- **🎲 Solo** — une partie 2–6 joueurs contre l'IA, tout de suite.
- **🌐 En ligne avec tes potes** — un crée une table et partage le **code à 4 lettres** ; les autres rejoignent ; les sièges vides sont tenus par l'IA. Sync temps réel **sans serveur à héberger** (Supabase Realtime), une seule partie à la fois, **hôte autoritatif**.

Sur la table tu retrouves l'expérience physique : **pioches visibles** (Les Combines, la défausse, la pioche de votants), **marché tournant** de ~8 votants (clic pour acheter, conflits dures/molles signalés), **ta zone** (argent, piste de score, casier 4 fronts avec piles de corruption + boucliers, votants achetés face visible, main de 5), les **rivaux autour de la table**, et un **journal** qui raconte chaque dénonciation. Premier au seuil (30 − N) gagne.

> **Jouer en ligne maintenant :** il faut une URL publique (le `localhost` ne suffit pas pour tes potes). Déploie les fichiers statiques (tout le dossier : `index.html` + `src/engine.js`) sur **Vercel**, **GitHub Pages** ou **Netlify**, partage l'URL, chacun l'ouvre, un crée la table, les autres entrent le code. Le temps réel fonctionne depuis n'importe quelle origine. La racine `/` ouvre directement le jeu.

`catalogue.html` reste disponible pour le **🃏 Catalogue** des 146 cartes et le **📊 bac à sable d'équilibrage** (Monte Carlo).

> ⚠️ **Beta sans serveur** : l'état complet de la partie transite par le service temps réel, donc la **confidentialité des mains** (le bluff « Élément de langage ») n'est pas cryptographiquement garantie. Suffisant entre potes ; la version « sérieuse » (serveur autoritatif qui ne diffuse que `publicState` par joueur) est décrite dans `docs/DEV.md`.

## 🌐 Beta en ligne

La démo est un site **statique** (un seul fichier), donc déployable en 2 minutes :

- **GitHub Pages** : pousser ce repo → Settings → Pages → branche `main` / dossier racine.
- **Netlify / Vercel** : glisser-déposer le dossier, ou connecter le repo.

*(URL de la beta à ajouter ici une fois déployée.)*

## 📦 Contenu du repo

| Fichier | Rôle |
|---|---|
| `src/engine.js` | **Moteur de jeu headless** : toutes les règles + valeurs calibrées, déterministe (RNG seedée), sans dépendance ni DOM. **Point de départ du dev.** |
| `index.html` | **La table** (page d'accueil) — jeu jouable solo + en ligne (Supabase Realtime), façon plateau physique, branché sur `src/engine.js`. |
| `catalogue.html` | Démo historique + 🃏 catalogue des cartes + 📊 bac à sable d'équilibrage (logique autonome) |
| `vercel.json` | Config de déploiement statique (Vercel). |
| `README.md` | Règles complètes + infos projet (ce fichier) |
| `docs/REGLES.md` | Design doc vivant (mêmes règles, espace de travail) |
| `docs/DEV.md` | **Brief technique** pour coder la beta multijoueur en ligne (à donner à Claude Code) |

## 🛠️ Développer (moteur `src/engine.js`)

Le moteur est la **source de vérité** des règles : il encode les 42 votants, les 104 Combines, les incompatibilités, l'économie et la condition de victoire (seuil = 30 − joueurs), et il est **déterministe** (passe un `seed`) pour qu'un serveur soit autoritatif.

```js
const G = require('./src/engine.js');
let state = G.createGame({ nPlayers: 4, seed: 123 });   // état autoritatif
G.applyAction(state, playerId, action);                 // valide + applique une action
const view = G.publicState(state, playerId);            // état filtré (mains adverses cachées)
G.botChooseAction(state, playerId);                     // IA pour sièges vides
G.simulate(6, 2000);                                    // bac à sable d'équilibrage
```

`node src/engine.js` lance un mini-rapport d'équilibrage (2→6 joueurs).

**Pour le multijoueur en ligne**, le moteur est pensé client-serveur : le serveur tient `state`, valide chaque action via `applyAction`, et diffuse `publicState(state, playerId)` à chaque joueur (qui ne voit que sa main, le compte des autres). Les sièges vides se remplissent avec `botChooseAction`. Reste à écrire : couche réseau (WebSocket), lobby/parties, et une UI (réutilisable depuis `index.html`).

## 🗺️ Prochaines étapes (les « choses sérieuses »)

- [ ] Déployer la beta statique (GitHub Pages / Netlify) et fixer l'URL.
- [ ] **Multijoueur en ligne (beta)** : serveur Node + WebSocket autour de `src/engine.js`, lien de partie par code, déploiement Render. → **Brief prêt : `docs/DEV.md`.**
- [ ] Direction artistique des cartes (visuel, gabarit imprimable).
- [ ] **Références historiques** sur les cartes (costards = Fillon, argent étranger = Sarkozy/Kadhafi, emplois fictifs = assistants parlementaires…).
- [ ] Variante « caisse noire » (argent caché) à tester.
- [ ] Tests utilisateurs sur table + en ligne.

> © 2026 — Tous droits réservés. Licence à définir.

---

# 📜 Règles du jeu
## 1. Le pitch

Chacun dirige un **parti politique en campagne électorale**. Tout le monde se finance **illégalement** pour acheter des voix — pots-de-vin, argent étranger, emplois fictifs, cadeaux déguisés.

Inspiration : la galerie des scandales réels, en mode satirique — les **costards** offerts (Fillon), le **financement étranger** d'une campagne (Sarkozy / Kadhafi), les **emplois fictifs** sur fonds publics (Le Pen / fonds européens).

---

## 2. Condition de victoire

> **Le premier parti à atteindre le seuil de voix remporte l'élection.**
> **Seuil = 30 − nombre de joueurs** (les votants sont des blocs **uniques** : plus on est nombreux, plus l'électorat se partage) :

| Joueurs | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|
| **Seuil** | **28** | **27** | **26** | **25** | **24** |

- **L'argent n'est pas un but**, c'est le carburant : on **convertit sans cesse l'argent en voix**. Le plus riche ne gagne pas — le plus de voix gagne.
- **Garde-fou anti-partie-infinie** : si le marché des votants s'épuise (ou **16 manches** atteintes), le joueur avec le **plus de voix** l'emporte. *(En pratique ~95–100 % des parties se finissent par le seuil, pas par le garde-fou.)*
- **Manche finale équitable** : dès qu'un joueur atteint le seuil, on **termine la manche en cours** avant de comparer ; le plus de voix gagne.
- **Départage** : à égalité de voix, le plus d'argent restant.

Pourquoi un seuil plutôt que des tours fixes : celui qui approche du seuil devient la **cible** des dénonciations → il recule → la course respire. La dénonciation est le frein naturel anti-leader (plafonné à **un scandale subi par manche**, voir §6).

---

## 3. La boucle de jeu

```
Main de 5 cartes (tirées de la PIOCHE COMMUNE)  +  revenu auto +3 M€/tour (roulette d'argent)
                          ↓
Se financer (carte Corruption)  →  +Argent (tu montes ta roulette), et tu STOCKES la carte sale
                          ↓          devant toi (pile par front) — chaque carte a un MALUS imprimé
   Dépenser l'argent  →  acheter des Votants (face VISIBLE) = des voix
                          ↓          → tu AVANCES ton pion sur la PISTE DE SCORE (0–28)
   ... ou jouer des cartes : Protéger un front (5 M€) / Blanchir une carte (3 M€) /
                             Coup tactique / Dénoncer un rival (2 M€) / Recycler sa main
                          ↓
   Dénonciation sur un front NON protégé → fait sauter UNE carte sale → la cible perd des voix
                          ↓          → elle RECULE son pion (sauf « Élément de langage » qui annule)
        Premier pion au seuil (30 − nb de joueurs) → élection gagnée
```

Décalage central : tes **Votants achetés sont visibles**, et tes **cartes de corruption sont stockées devant toi** (on voit combien tu en as par front, sans voir lesquelles). La dénonciation fait éclater l'une d'elles. Le **score de chacun est lisible en permanence sur la piste commune** — c'est ce qui rend la course (et donc la dénonciation du meneur) immédiatement claire.

---

## 4. Les paquets de cartes

**A. La pioche commune « Les Combines » — UN seul paquet de 104 cartes, face cachée, pour toute la table.** Plus de paquet par joueur : tout le monde puise dans la même source (rareté + compétition). On peut la **scinder en 2-3 piles identiques** posées autour de la table pour l'accès. Composition (voir §4 bis pour le détail) :

| Catégorie | Copies | Rôle |
|---|---|---|
| **Corruption** (4 types) | 42 | +argent, carte sale stockée devant toi (malus imprimé) |
| **Dénonciation** | 22 | 2 M€ : fait sauter 1 carte sale d'un rival |
| **Protection** (4 fronts) | 16 | 5 M€ : bouclier permanent sur un front |
| **Blanchiment** | 10 | 3 M€ : nettoie 1 de tes cartes sales |
| **Coups tactiques** (5 types) | 14 | Remise, Incohérence, Promesse, Élément de langage, Renvoi |
| **Total** | **104** | |

**Cartes en main :** **main de 5**, complétée à 5 en fin de tour. Une de tes 2 actions peut être **Recycler** : défausser 1 ou 2 cartes et repiocher (contre une main morte) — mais la pioche est **aveugle**, c'est un pari, pas un dig garanti. Quand la pioche est vide, on remélange la défausse commune.

**B. Le marché des Votants — un présentoir TOURNANT (pas un étal géant).** Les 42 blocs uniques ne sont **pas tous étalés** : seules **~6 à 8 cartes votants sont visibles à l'achat** à tout moment, alimentées par une pioche de votants. Quand un bloc est acheté, on le remplace aussitôt par la carte suivante. Voir §5.

**C. L'argent — une roulette par joueur.** Chaque joueur a sa **roulette/molette d'argent individuelle, graduée de 0 à 80 M€** (incrément au million). L'argent reste **visible** de tous, et **+3 M€/tour** de revenu automatique (pas une carte → tu n'es jamais totalement bloqué). Plus de billets à compter ni à rendre. *(Variante « caisse noire » cachée à tester plus tard.)*

**D. La piste de score — commune, 0 à 28, un pion par joueur.** On **ne compte pas** les voix en additionnant les cartes (un votant vaut 2, 4, 6 ou 7, et une coalition molle retire −1 : le calcul mental permanent serait lourd). À la place, une **bande numérotée de 0 à 28** avec un **meeple par joueur** : tu **avances** ton pion à l'achat d'un votant, tu le **recules** quand on te dénonce. Lecture instantanée de la course (voir §5 et §7).

---

## 4 bis. Composition détaillée de la pioche commune (104 cartes)

**Corruption (42)** — tu encaisses l'argent, tu poses la carte sur son front, malus imprimé = voix perdues si dénoncée :

| Carte | Argent | Front | Si dénoncé | Copies |
|---|---|---|---|---|
| Petit pot-de-vin | +3 M€ | Justice | −1 voix | 12 |
| Faux militants | +4 M€ | Rue | −2 voix | 10 |
| Costards & cadeaux | +6 M€ | Presse | −3 voix | 10 |
| Emploi fictif | +9 M€ | Finances | −4 voix | 10 |

**Dénonciation (22)** — 2 M€, fait sauter la plus grosse carte sale du front visé.
**Protection (16)** — Juge acheté / Médias corrompus / Opinion achetée / Compte offshore (×4 chacune), 5 M€, bouclier permanent.
**Blanchiment (10)** — 3 M€, nettoie une de tes cartes sales.
**Coups tactiques (14)** :
- *Remise de campagne* ×3 — prochain votant −3 M€.
- *Incohérence* ×3 — prends un bloc incompatible sans perte de voix, mais +1 carte sale (Rue).
- *Promesse intenable* ×3 — +3 voix tout de suite, mais +1 carte sale (Rue).
- *Élément de langage* ×3 — **réaction** : annule une dénonciation lancée contre toi.
- *Renvoi d'ascenseur* ×2 — un service rendu : +3 M€ et pioche 1 (en vrai : un pacte d'échange entre deux joueurs).

---

## 5. Les Votants (cartes à la Monopoly)

Cartes **face visible**, chacune **UNIQUE** (un seul exemplaire par bloc). **42 blocs**, 3 paliers (≈ **2 M€ / voix**), **pool total = 161 voix**. Qui prend un bloc le prive aux autres.

**Marché tournant :** on ne pose pas les 42 cartes sur la table. La pioche de votants est mélangée, et on en révèle **~6 à 8 face visible** : ce sont les seuls blocs achetables à l'instant T. Dès qu'un bloc est acheté, on **le remplace par la carte suivante** de la pioche. Avantage double : l'étal reste lisible (~8 cartes au lieu de 42), et ça ajoute de la tension — *le bloc que tu convoitais peut partir avant ton tour*. Aucune valeur du jeu ne change : les 42 blocs existent toujours, ils **défilent** simplement.

**Achat → piste de score :** quand tu achètes un bloc, tu paies son coût (roulette) et tu **avances ton pion du nombre de voix indiqué** sur la piste commune (en retirant **−1** si c'est une coalition molle). Tu n'additionnes jamais des cartes : ton score est ton pion.

| Palier | Coût | Voix | Blocs (15 petits) |
|---|---|---|---|
| Petits | 4 M€ | 2 | influenceurs, étudiants, animalistes, anti-vax, gamers, bobos, complotistes, **masculinistes**, **intermittents**, **VTC/Ubers**, **Les Éveillés**, **crypto-bros**, **survivalistes**, **néo-ruraux**, **libertariens** |
| Moyens | 8 M€ | 4 | policiers, agriculteurs, taxis, francs-maçons, chasseurs, soignants, profs, diaspora, **militaires**, **chômeurs**, **rentiers**, **héritiers**, **routiers**, **motards**, **start-uppers**, **pêcheurs** |
| Gros | 12 M€ | 6 | patronat, **CGT** *(ex-Syndicats)*, intégristes, fonctionnaires, lobby pétrolier, souverainistes, LGBT, **banquiers**, **promoteurs**, **lobby pharma** |
| Énorme | 13 M€ | 7 | retraités *(le bloc qui décide tout)* |

**Incompatibilités — 2 niveaux (clé satirique) :**

- **DURES (interdites)** *(seule « Incohérence » passe outre)* : Intégristes ✗ LGBT · Patronat ✗ CGT.
- **MOLLES (−1 voix)** : Ubers✗Taxis · Masculinistes✗Éveillés · Éveillés✗Souverainistes · Pharma✗Anti-vax · Crypto✗Banquiers · Libertariens✗{Fonctionnaires, CGT} · Animalistes✗{Chasseurs, Pétrole, Agriculteurs} · Bobos✗{Chasseurs, Pétrole, Motards} · Pêcheurs✗{Animalistes, Bobos} · Souverainistes✗Diaspora · Anti-vax✗Soignants · Flics✗Complotistes · Complotistes✗Profs · Intégristes✗Influenceurs · Patronat✗{Fonctionnaires, Chômeurs} · {Rentiers, Héritiers, Banquiers, Start-uppers}✗CGT · Retraités✗Étudiants · Militaires✗Intermittents · Promoteurs✗Néo-ruraux · Survivalistes✗Éveillés.

→ Ça force chaque parti à une **identité cohérente** sans tout interdire : tu peux **overreach** pour plus de voix, mais ta coalition bancale devient un angle d'attaque. La carte **Incohérence** assume le grand écart (full voix) au prix d'une **dette d'hypocrisie** dénonçable sur la Rue.

---

## 6. Les fronts, la dénonciation, les défenses

Tu peux être attaqué sur **4 fronts**, et tu ne peux pas tous les protéger (4 × 5 M€ = 20 M€).

| Front | Comment on dénonce | Protection (5 M€) | Carte corruption (malus) |
|---|---|---|---|
| **Justice** | Enquête judiciaire | Juge acheté | Petit pot-de-vin (−1) |
| **Rue / Peuple** | Indignation populaire | Opinion achetée | Faux militants (−2) |
| **Presse / Médias** | Scandale dans les journaux | Médias corrompus | Costards & cadeaux (−3) |
| **Finances** | Audit / contrôle des comptes | Compte offshore | Emploi fictif (−4) |

**Dénoncer** (carte Action, **coûte 2 M€ à l'accusateur**, contre un rival, sur un front précis) :
- **Front protégé** (ou sans carte sale) → **impossible** sur ce front.
- **Front non protégé avec une carte sale** → sa **plus grosse carte de ce front saute** : la cible perd les **voix imprimées** dessus. La carte est défaussée (le scandale est consommé).
- **Un seul scandale subi par manche** : une fois éclaboussé, tu es tranquille jusqu'à la manche suivante. *(La presse ne sort pas dix affaires sur la même tête le même jour — et ça empêche de matraquer le meneur à plusieurs.)*

**Trois défenses, distinctes :**
- **Protection (5 M€)** — bouclier **permanent** sur un front : plus aucune dénonciation n'y passe. Couvre toutes tes cartes de ce front, mais cher (en amont).
- **Blanchiment (3 M€)** — chirurgical : **nettoie une seule carte sale** (n'importe quel front). Tu gardes l'argent, la carte devient propre. Parfait pour effacer ta plus grosse bombe avant qu'on te la sorte (en amont).
- **Élément de langage** — **réactif** : tu le joues *au moment où on te dénonce* pour **annuler le scandale**. C'est ce qui garde du bluff : l'attaquant ne sait jamais si tu l'as en main.

**Règle d'or :** la dénonciation frappe la cible en **VOIX, jamais en argent**. **L'attaquant paie** (2 M€) mais ne gagne pas de voix : son intérêt est de **freiner le meneur**. Chaque euro d'attaque = un votant qu'il n'achète pas.

---

## 7. Tour de jeu

1. **Revenu** : chacun monte sa **roulette de +3 M€** automatiquement (pas une carte).
2. **Actions — 2 par tour**, au choix :
   - **Acheter un Votant** (parmi les ~8 visibles du marché tournant) → tu baisses ta roulette du coût, et tu **avances ton pion** du nombre de voix (−1 si coalition molle). On révèle un nouveau bloc à la place.
   - **Jouer une carte** : Corruption (montes ta roulette) / Dénoncer 2 M€ (la cible **recule son pion**) / Protéger 5 M€ / Blanchir 3 M€ / Coup tactique.
   - **Recycler** : défausser 1-2 cartes et repiocher.
3. **Élément de langage** : se joue *en réaction* hors de ton tour, quand on te dénonce (annule le recul du pion).
4. **Négociation libre** à tout moment (pactes, pots-de-vin entre joueurs).
5. **Fin de tour** : tu complètes ta main à **5 cartes** depuis la pioche commune.
6. **Jeton premier joueur** : il tourne à chaque manche (équité).
7. Un pion atteint le **seuil (30−N)** sur la piste → on finit la manche → fin. Sinon, manche suivante.

> *Événements (bandeau commun) : module optionnel, retiré de cette version pour garder le modèle propre. On pourra le réintégrer comme couche de saveur (crise éco, débat télévisé…) sans toucher aux maths.*

---

## 8. Économie (v0.3 — pioche commune, calibrée)

> Échelle en **M€**. But : jouer **propre** ne suffit pas ; la corruption booste la puissance d'achat mais expose.

**Cadre :** seuil **30 − nb de joueurs** (28→24). Départ **7 M€**/joueur. Revenu **+3 M€/tour auto**. Main **5**. Garde-fou **16 manches**.

**Corruption — tu stockes la carte, malus imprimé = voix perdues si dénoncée :**

| Carte | Argent | Front | Si dénoncé |
|---|---|---|---|
| Petit pot-de-vin | +3 M€ | Justice | −1 voix |
| Faux militants | +4 M€ | Rue | −2 voix |
| Costards & cadeaux | +6 M€ | Presse | −3 voix |
| Emploi fictif | +9 M€ | Finances | −4 voix |

**Votants : ≈ 2 M€ / voix** (Petit 4/2, Moyen 8/4, Gros 12/6, Retraités 13/7).
**Dénoncer : 2 M€** · **Protéger : 5 M€** / front · **Blanchir : 3 M€** / carte.

**Repères :** atteindre le seuil coûte ≈ **45–55 M€**, alors que le revenu légal sur ~11 manches ≈ **40 M€** : jouer propre **plafonne** juste en dessous → il **faut** un peu de corruption pour passer le seuil, mais chaque carte sale stockée est un angle d'attaque, et chaque attaque coûte de l'argent qu'on ne met pas dans les voix.

---

## 9. Matériel (proto papier)

Setup volontairement **épuré** :

- **La pioche commune « Les Combines »** : 104 cartes, face cachée, dos uniforme (à scinder en 2-3 piles identiques autour de la table).
- **Le marché de Votants** : pioche de 42 blocs uniques, dont **~6 à 8 visibles** dans un présentoir **tournant** (pas un étal de 42).
- **Une roulette d'argent par joueur** (0 → 80 M€, incrément au million). Remplace les billets ; argent visible.
- **Une piste de score commune** graduée **0 à 28**, avec **un meeple/pion par joueur**. *(Seul composant ajouté au setup épuré — il protège la lisibilité de la course, voir §11.)*
- **Une zone « casier » 4 fronts** devant chaque joueur (un simple tapis, ou rien) pour empiler les cartes corruption par front.
- Aides de jeu : tableau fronts ↔ protections, table d'incompatibilités (dures/molles), rappel de la boucle.

---

## 10. Équilibrage 2–6 joueurs (vérifié par simulation)

Les votants étant des **blocs uniques** (pool fixe de 161 voix), l'électorat se partage entre les partis : plus on est nombreux, moins chacun peut amasser. Le **seuil baisse donc avec la table : 30 − N**. La dénonciation reste rare (gated par la pioche) et contrable (Élément de langage). Garde-fous : jeton premier joueur tournant, **1 scandale subi par manche**, et l'épuisement du marché. Résultats sur 1 500–3 000 parties/config :

| Joueurs | Seuil | Durée moyenne | Victoires par le seuil | Équité entre sièges |
|---|---|---|---|---|
| 2 | 28 | ~12 manches | ~94 % | écart ~2 pts |
| 3 | 27 | ~12 manches | ~99 % | écart ~2 pts |
| 4 | 26 | ~11 manches | ~100 % | écart ~2 pts |
| 5 | 25 | ~10 manches | ~100 % | écart ~3 pts |
| 6 | 24 | ~9–10 manches | ~91 % | écart ~5 pts |

*(Re-testable en direct dans l'onglet « Équilibrage » de la démo.)*

---

## 11. Décisions tranchées (anciens TODO)

- [x] **Pioche commune** : oui — un paquet unique « Les Combines » de **104 cartes** alimente toute la table (rareté + compétition).
- [x] **Main de 5** + **Recycler** (1 action pour défausser 1-2 et repiocher). Revenu **+3 auto**.
- [x] **Seuil** : **30 − nombre de joueurs** (28/27/26/25/24). Baisse avec la table car les votants sont des blocs uniques (pool fixe).
- [x] **Modèle de dénonciation** : corruption **stockée à malus imprimé** ; dénoncer fait sauter **une carte** ; **1 scandale subi par manche**.
- [x] **Défenses** : **Protection** (5 M€), **Blanchiment** (3 M€), **Élément de langage** (réactif, annule un scandale).
- [x] **Dénoncer = 2 M€** (l'accusateur ne gagne pas de voix).
- [x] **Incompatibilités** : 2 dures (Intégristes✗LGBT, Patronat✗CGT) + ~28 molles (−1 voix) + carte **Incohérence**.
- [x] **Rôles asymétriques** : **6 partis**.
- [x] **Tester 2–6 joueurs** : fait par simulation (§10).
- [x] **Matérialisation de l'argent** : **roulette individuelle 0–80 M€** par joueur (remplace les billets, argent visible).
- [x] **Matérialisation des voix** : **piste de score commune 0–28 + 1 meeple/joueur** (on n'additionne pas les cartes). *Composant non négociable : la dénonciation du meneur exige un score lisible en permanence ; sans piste, le frein anti-leader se grippe.*
- [x] **Encombrement du marché** : **présentoir tournant ~8 cartes** au lieu d'étaler les 42 (ne réduit pas les blocs, ne change aucune valeur).
- [x] **« Les Combines »** : pioche commune 104 cartes face cachée — inchangée.
- [ ] **Vérifier le plafond de 80 M€ de la roulette en test** (une partie coûte ~45–55 M€ ; un joueur qui accumule avant de convertir peut s'en approcher — si on bute sur 80, c'est un signal d'alarme économique).
- [ ] **Titre définitif** (toujours ouvert).
- [ ] **2 joueurs** : jouable mais pâle — viser **3–6** comme expérience de référence, 2 en variante.
- [ ] **Argent caché ou visible** : visible pour l'instant ; tester la « caisse noire » cachée.
- [ ] **Réintégrer les Événements** comme couche de saveur optionnelle.
- [ ] **Références historiques** sur les cartes (costards=Fillon, argent étranger=Sarkozy/Kadhafi, emploi fictif=assistants…).
- [ ] **Équilibrer finement les 6 rôles de partis** entre eux.

---

## 13. Les 6 partis (rôles asymétriques)

| Parti | Type | Force | Bloc interdit |
|---|---|---|---|
| **La Meute** | médiatique | 1ʳᵉ protection Presse gratuite | — (fragile en Justice) |
| **La Lumière** | religieux | Intégristes +1 voix | Communauté LGBT |
| **Le Cartel** | patronal | +1 M€ de revenu / tour | CGT |
| **La Vague** | populiste | Dénonciation à moitié prix (1 M€) | — |
| **Les Verts pâles** | écolo | Animalistes & Bobos −2 M€ | Lobby pétrolier |
| **La Forteresse** | souverainiste | Costards & cadeaux +2 M€ | Diaspora |

---

## 14. Mise à jour du 22 juin — ce qui a changé / ce qui n'a pas bougé

**Ce qui a changé (matérialisation seulement) :**
- L'argent passe des **billets** à une **roulette individuelle (0–80 M€)** par joueur — §4C, §9.
- Les voix se lisent désormais sur une **piste de score commune (0–28) avec un meeple par joueur**, au lieu de compter les cartes — §4D, §5, §7, §9.
- Le marché de votants devient un **présentoir tournant (~8 cartes visibles)** au lieu d'étaler les 42 — §4B, §5, §9.
- La boucle (§3) et le tour de jeu (§7) mentionnent désormais **avancer / reculer son pion** à l'achat et à la dénonciation.

**Ce qui n'a PAS bougé (économie calibrée intacte) :**
- Aucune valeur chiffrée modifiée : coûts des votants (4/8/12/13), voix (2/4/6/7), malus de corruption (−1/−2/−3/−4), prix des actions (dénoncer 2, protéger 5, blanchir 3), départ 7 M€, revenu +3/tour, seuil **30 − N**, main de 5.
- Les 42 blocs uniques, les 104 « Combines », les incompatibilités et l'équilibrage par simulation restent identiques.
- « Les Combines » (pioche commune face cachée) : inchangée.
