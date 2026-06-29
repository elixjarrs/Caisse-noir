<!-- markdownlint-disable -->
# Proposition v0.6 — « La caisse (vraiment) noire » : corruption cachée + dénonciation à l'argent + rôles secrets
*27 juin 2026 · proposition de refonte (à prototyper en branche parallèle, PAS un patch incrémental). Idée originale : EJ.*

## L'idée maîtresse
On rend **la corruption invisible**. Tout le monde voit l'argent d'un joueur monter, mais **personne ne sait s'il s'est enrichi proprement ou par la fraude, ni sur quel front**. La dénonciation devient un **pari** (« je parie que tu as fraudé sur les Finances ! ») qui frappe l'**argent**, plus les voix. C'est la couche de bluff social qui manquait.

---

## Liste des changements

### 1. La corruption devient CACHÉE (face cachée)
- Les cartes de financement se jouent **face cachée** dans ton casier. Les autres voient juste : ton argent monte + une carte posée. Ils ne savent **ni si c'est sale, ni sur quel front**.
- On ajoute des **cartes de financement PROPRE** (« Débat télévisé », « Meeting de campagne », « Don légal ») qui rapportent de l'argent **sans aucun risque** de dénonciation. Elles brouillent la lecture : impossible de savoir si la carte posée est un don légal ou un pot-de-vin.
- **Remplace** : les piles de corruption visibles par front (à malus imprimé en voix).

### 2. La dénonciation frappe l'ARGENT (plus les voix)
- Tu désignes une cible **et un front** (Justice / Presse / Rue / Finances) — c'est un pari. On révèle la/les carte(s) de ce front :
  - **Touché** (carte sale sur ce front) → la cible **perd de l'argent** (malus imprimé en M€), la carte saute (scandale consommé).
  - **Raté** (front propre / aucune carte sale là) → **échec**, l'accusateur perd sa mise (et c'est tout le sel : tu peux te planter).
- **Si la cible ne peut pas payer en cash**, elle paie en **rendant des cartes votant** (à hauteur de la dette) → ces blocs **retournent dans la pioche/le marché** (et peuvent être rachetés plus tard).
- **Remplace** : la dénonciation qui faisait perdre des voix.

### 3. Plus de compteur de voix : on lit les cartes
- Les **votants restent face visible** devant chaque joueur. Les voix = la **somme de tes cartes votant**, lisible par tous.
- La piste de score 0-28 saute (ou devient optionnelle). *(⚠️ voir « à trancher » : je pousserais pour en garder une version légère, sinon on ne voit plus qui mène d'un coup d'œil — or c'est ce qui déclenche les dénonciations au bon moment.)*
- **Remplace/ajuste** : la piste de score commune.

### 4. Rôles SECRETS = pouvoir + objectif (2-en-1)
- En début de partie, chaque joueur reçoit **1 carte Rôle face cachée** (distribution aléatoire). Elle donne **à la fois** :
  - un **pouvoir** unique (l'asymétrie de parti, version musclée),
  - un **objectif secret** (+voix bonus s'il est accompli, révélé à la fin).
- **Remplace/fusionne** : le choix de parti ouvert **+** les cartes Objectif secret séparées. Une pierre deux coups, et une 2ᵉ couche de mystère (« quel est son rôle ? »).

### 5. Plus d'immunité pour les thésauriseurs de cash sale
- L'immunité « électorat fidèle » protège tes **votants** du vol, mais **pas ton argent** : le cash sale est toujours dénonçable.
- Un joueur qui **accumule de l'argent par corruption sans acheter de voix** n'a pas de cartes votant → **aucune protection**, totalement exposé. → on est forcé de convertir l'argent en voix (la boucle du jeu) au lieu de planquer du cash.

### 6. Recyclage des blocs
- Les votants rendus (paiement de dénonciation) **reviennent au marché** → le pool de blocs n'est plus strictement fini, il tourne. (Effet de bord à surveiller en simu : ça pourrait desserrer la contrainte à 6 joueurs.)

---

## Ce que ça apporte (le « pourquoi c'est mieux »)
- **La couche bluff/info cachée** que tout le monde réclamait (Coup, Sheriff) — sans ajouter de procédure lourde.
- **La dénonciation devient un pari risqué** : tu peux te tromper de front et te ridiculiser → tension réelle.
- **Vrai dilemme argent** : prendre de l'argent sale (plus, mais dénonçable) ou propre (moins, mais sûr).
- **Rôles 2-en-1** : énorme rejouabilité (pouvoir + objectif) dans une seule carte cachée.
- **Boucle plus saine** : planquer du cash = se rendre vulnérable → on convertit en voix.

## À trancher (décisions de design)
1. **Garder une piste de score légère** ou tout lire sur les cartes ? *(reco : garder une piste, la lisibilité de la course est vitale pour le frein social.)*
2. **Ratio financement propre / sale** dans la pioche → c'est lui qui règle le niveau de bluff (trop de propre = on s'en fiche, trop de sale = tout le monde est coupable).
3. **Dénonciation ratée** : l'accusateur perd juste sa mise, ou subit une pénalité (amende de diffamation) ?
4. **Combien d'argent on perd** quand on est dénoncé (malus imprimé en M€ par carte sale) ?
5. **Protection / Blanchiment / Élément de langage** : à ré-adapter (protéger un front = dénonciation auto-ratée ; blanchir = rendre une carte sale « propre » ; élément de langage = annuler une dénonciation).

## ⚠️ Le vrai risque à régler : est-ce que ça freine encore le meneur ?
Si la dénonciation ne coûte que de l'**argent**, un meneur **riche en cash** ne perd pas de voix → il peut s'échapper (les voix sont dans ses cartes, à l'abri tant qu'il peut payer). Le frein ne mord vraiment que sur les joueurs **cash-pauvres** (qui doivent rendre des votants). **Pistes** : malus en argent assez gros pour faire mal, ou la dénonciation force *aussi* un petit recul de voix, ou un plafond de cash. **À calibrer absolument en simulation.**

## Verdict
C'est une **vraie refonte** (le frein, l'info cachée, la lecture de la victoire changent), pas un ajout. Je la traiterais comme une **branche v0.6 à prototyper à part**, pas un patch sur la base calibrée. Sur le fond : j'adore la corruption cachée + la dénonciation-pari + le rôle 2-en-1. Je résisterais juste à supprimer totalement la piste de score, et il faut régler le « frein anti-meneur » ci-dessus avant de s'engager.
