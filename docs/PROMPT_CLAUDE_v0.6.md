<!-- markdownlint-disable -->
# v0.7 « corruption cachée » — Résumé + Prompt pour Claude Code

> Évolution de la v0.6. Changements v0.7 : dénonciation sur **1 carte** (pas le front entier) · parti = **famille interdite secrète** (remplace pouvoirs + objectifs) · **débauchage/OPA = cartes, la victime choisit** · **incompatibilités renforcées** · **deck ~64 blocs** · **seuil = 70 − 6N** pour une partie ~15 min.

## 📋 Résumé lisible — tout ce qu'on ajoute / change (pour relecture rapide)

1. **Familles d'électeurs → voix bonus.** Chaque bloc appartient à une famille (8 familles). **3 blocs d'une même famille = +3 voix**, puis **+1 par bloc** supplémentaire. *(déjà acté)*
2. **Coalition complète = électorat fidèle → involable** (ne peut pas être volé). *(déjà acté)*
3. **Vol d'électorat** (transfert de voix, sur blocs **isolés** seulement) : **Débauchage** (2 M€ : −2/+2) et **OPA électorale** (4 M€ : −3/+3). *(déjà acté)*
4. **Corruption CACHÉE** : on joue le financement **face cachée**. Les autres voient l'argent monter, **pas** s'il est propre/sale ni sur quel front.
5. **Cartes de financement PROPRE** (Don/Meeting/Débat télévisé) : argent **sûr**, jamais dénonçable (rapporte moins). Elles servent aussi de **LEURRES** : posées face cachée sur un front pour que la taille des piles ne trahisse pas où on est sale.
6. **Dénonciation = perte d'ARGENT et c'est un PARI sur UNE carte** : tu désignes un rival + **un** front, on révèle **la carte du dessus** de la pile. Sale → il perd **ce montant** (3/6/9 ; cash, sinon **rend des votants de SON choix → perd des voix** ; blocs au marché). **Raté** (leurre/vide) → tu perds ta mise (2 M€) + amende 3 M€ à la cible. *(v0.7 : une carte, plus le front entier → parties plus longues, leurres plus forts.)*
7. **Frein anti-meneur auto-ciblant** : le meneur a tout converti en voix → il est cash-pauvre → quand on le dénonce il rend des votants → il perd des voix. Planquer du cash sale = double peine.
8. **Voix lues sur les cartes votant** (face visible). La piste de score devient une simple aide de lecture (facultative).
9. **Parti = FAMILLE INTERDITE SECRÈTE** (face cachée, connue du seul joueur) : une famille d'électeurs qu'il ne peut jamais acheter. Remplace les pouvoirs visibles ET les objectifs à points (asymétrie 100 % cachée, aucun signal économique).
10. **Seuil = 70 − 6 × joueurs** (58/52/46/40/34), calibré par simulation v0.7 (~100 % par le seuil, ~39-48 tours ≈ 12-14 min). À raffiner avec `simulate()`.
11. **3 fronts seulement** : Justice · Presse · Finances. **Montants multiples de 3** : sale 3/6/9 (mêmes sur chaque front), propre 3/6 (plafond 6).
12. **Fin de partie** : franchir le seuil déclenche la **manche finale** (tout le monde joue) ; le **plus de voix gagne**, même si renvoyé sous le seuil.
13. **Deck votants ~64 blocs uniques** (≈ 8/famille ; la plupart des familles ont un gros 12/6, quelques-unes non) — nécessaire pour tenir ~15 min.
14. **Incompatibilités renforcées** : nombreuses **paires de votants exclusives** (ne peut pas détenir les deux) → progression plus lente.
15. **Débauchage / OPA = cartes** ; **la victime choisit** le votant isolé cédé.

Spec complète et faisant foi : **`docs/REGLES.md` §16**.

---

## 🤖 Prompt à coller dans Claude Code

```
Repo Caisse-noir. Architecture : src/engine.js (moteur de règles, source de vérité,
déterministe) ; index.html (table jouable solo + en ligne) ; catalogue.html (catalogue
+ bac à sable d'équilibrage). LIS docs/REGLES.md §16 — c'est la spec qui FAIT FOI.

OBJECTIF : faire évoluer le jeu vers le MODÈLE v0.6 « corruption cachée » décrit en §16.
C'est une refonte du cœur (corruption cachée + dénonciation qui frappe l'argent), pas un
patch. Implémente d'abord dans src/engine.js, puis propage à l'UI, puis recalibre.

1) ENGINE (src/engine.js) — refonte v0.6 :
   a. FINANCEMENT face caché : cartes posées face cachée sur un front, indistinguables par
      les autres. MONTANTS VARIÉS QUI SE CHEVAUCHENT entre fronts (pour qu'on ne puisse pas
      déduire le montant depuis le front ni l'inverse) :
        - IL Y A 3 FRONTS : Justice, Presse, Finances (la Rue a été retirée).
          TOUS LES MONTANTS SONT DES MULTIPLES DE 3 (3/6/9).
        - SALE (corruption), montant = gain = malus si dénoncé (100 %), posée sur SON front.
          MÊMES MONTANTS (3/6/9) sur chaque front pour bloquer toute déduction :
            Justice : Petit pot-de-vin 3, Trafic d'influence 6, Caisse noire judiciaire 9
            Presse : Petits cadeaux 3, Ménage médiatique 6, Voyage offert 9
            Finances : Note de frais 3, Rétrocommission 6, Évasion fiscale 9
        - PROPRE (sûr, jamais dénonçable, sert de LEURRE) posée sur un front au choix.
          PLAFONNE À 6 (le 9 est réservé au sale = prime du risque) :
            Don 3, Cotisations 3, Meeting payant 6, Subvention européenne 6
        - RATIO : ~2 cartes SALES pour 1 PROPRE — règle le bluff.
   b. DÉNONCIATION = pari sur l'argent, sur UNE carte : action { type:'PLAY_DENOUNCE', targetId, front }.
        - Chaque front est une PILE (ordre d'empilement conservé). On révèle la carte du DESSUS.
        - Touché (carte du dessus = sale) : la cible perd son MONTANT (3/6/9), la carte est
          défaussée ; si son cash est insuffisant, elle paie le manque en RENDANT des votants
          de SON choix (≈ 2 M€/voix) qui RETOURNENT au marché (maj familles/voix/coalitions).
        - Raté (carte du dessus = leurre propre, ou front vide) : l'accusateur perd sa mise
          (2 M€) ET paie une AMENDE de 3 M€ à la cible, et perd son action.
        - IMPORTANT (v0.7) : on ne fait plus sauter tout le front — UNE carte. Les leurres
          empilés PROTÈGENT les cartes sales du dessous → parties plus longues, moins swingy.
        - Plafond : 1 attaque subie (dénonciation OU vol) par manche (attackedThisRound).
        - NB : le financement propre se pose AUSSI sur un front (leurre) → côté moteur, une
          carte de financement a { type:'propre'|'sale', front } ; seules les 'sale' font perdre
          de l'argent quand dénoncées. publicState ne révèle ni le type ni le montant, juste le
          NOMBRE de cartes par front.
   c. VOIX : player.voix = somme des votants + bonus de coalition.
      Les votants restent "publics" ; garde une piste de score comme simple miroir.
   d. FAMILLES, COALITIONS & INCOMPATIBILITÉS : map bloc→famille (8 familles, §15.1/§16.6).
      3 blocs d'une famille = +3 voix, +1 par bloc en plus. Coalition complète => blocs
      "fidèles" (involables). DECK ~64 blocs uniques (≈8/famille ; la plupart des familles ont
      un gros 12/6, quelques-unes non). INCOMPATIBILITÉS : liste de PAIRES de votants exclusives
      (ne peut détenir les deux) — à l'achat, refuse un bloc incompatible avec un bloc détenu.
      Étoffe la liste (Chasseurs×Animalistes, Patronat×CGT, Flics×Émeutiers…) pour ralentir.
   e. VOL = CARTES : Débauchage et OPA (transfert de voix). La VICTIME choisit quel votant
      ISOLÉ (hors coalition complète) elle cède ; le bloc passe chez l'attaquant (voix + famille
      transférées). OPA = version plus chère / bloc de plus forte valeur.
   f. PARTI = FAMILLE INTERDITE SECRÈTE : à la création, chaque joueur reçoit 1 carte Parti
      cachée = { forbiddenFamily }. Il ne peut jamais acheter de bloc de cette famille. AUCUN
      autre effet (pas de pouvoir économique). publicState NE révèle PAS la famille interdite
      des autres. Supprime les anciens pouvoirs de parti ET les objectifs à points.
   g. DÉFENSES : Protection (5 M€, bouclier de front ; 3 fronts -> 3 protections), Blanchiment (3 M€, rend une carte sale
      "propre"), Élément de langage (réactif, annule une dénonciation).
   h. SEUIL : seuil(N) = 70 - 6*N (2j 58 · 3j 52 · 4j 46 · 5j 40 · 6j 34). Garde-fou ~40 manches,
      départ 7 M€, revenu +3. Cible : ~40-50 tours totaux (manches*joueurs) ≈ 12-15 min.
   h2. FIN DE PARTIE : quand un joueur atteint le seuil, on TERMINE la manche en cours,
       puis le PLUS DE VOIX gagne — même s'il est repassé sous le seuil (dénonciation de fin
       de manche). Ne fige pas la victoire dès que le seuil est touché.
   i. CONFIDENTIALITÉ : publicState(state, playerId) doit masquer aux autres le CONTENU des
      cartes de financement (propre/sale + montant) ET la FAMILLE INTERDITE de chaque joueur —
      on n'expose que le total d'argent et le NOMBRE de cartes par front (face cachée, ordre de
      pile conservé côté serveur). Garde le seed secret, le moteur déterministe.

2) RE-CALIBRAGE (NE PAS deviner) : adapte simulate() + une IA qui (i) vise une famille pour
   compléter des coalitions en respectant sa famille interdite + les incompatibilités,
   (ii) mélange financement propre/sale, (iii) dénonce le meneur sur son front le plus chargé
   (révèle 1 carte). Trouve le seuil par N donnant ~40-50 tours totaux (manches*joueurs) et
   ≥90 % de victoires par le seuil. Point de départ 70 − 6N. Reporte la valeur trouvée dans
   docs/REGLES.md (§16.7) et README.

3) UI :
   - catalogue.html : RECONSTRUIS le catalogue jouable sur le modèle v0.7 (l'actuel est encore
     en v0.5). Référence de contenu/visuel = catalogue-v0.6.html (galerie lecture seule déjà
     mise à jour v0.7 : votants par famille, corruption 3 fronts × 3/6/9, financement propre,
     vol-cartes, défenses, coups, PARTIS = famille interdite secrète). Mets à jour le bac à
     sable avec le seuil 70−6N.
   - index.html : casier de financement FACE CACHÉE en PILES par front (les rivaux voient des
     dos + le total d'argent, pas le contenu) ; dénonciation = choisir cible + front → révèle
     la carte du dessus (pari) ; débauchage/OPA = la victime choisit le bloc cédé ; coalitions/
     fidèles affichés ; famille interdite affichée seulement à son propriétaire.

4) TESTS : `node src/engine.js` sort le rapport d'équilibrage recalibré ; vérifie qu'aucune
   main / famille interdite adverse ne fuit dans publicState ; une partie solo va jusqu'à la victoire.

CONTRAINTES : ne casse pas le déterminisme ; respecte le secret des cartes de financement et
de la famille interdite ; cible ~40-50 tours totaux (~15 min). Le deck passe à ~64 blocs uniques
(≈8/famille) — il faut CRÉER les blocs manquants (noms satiriques FR) ; marché tournant ~8.
```
