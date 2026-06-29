<!-- markdownlint-disable -->
# v0.6 « corruption cachée » — Résumé + Prompt pour Claude Code

## 📋 Résumé lisible — tout ce qu'on ajoute / change (pour relecture rapide)

1. **Familles d'électeurs → voix bonus.** Chaque bloc appartient à une famille (8 familles). **3 blocs d'une même famille = +3 voix**, puis **+1 par bloc** supplémentaire. *(déjà acté)*
2. **Coalition complète = électorat fidèle → involable** (ne peut pas être volé). *(déjà acté)*
3. **Vol d'électorat** (transfert de voix, sur blocs **isolés** seulement) : **Débauchage** (2 M€ : −2/+2) et **OPA électorale** (4 M€ : −3/+3). *(déjà acté)*
4. **Corruption CACHÉE** : on joue le financement **face cachée**. Les autres voient l'argent monter, **pas** s'il est propre/sale ni sur quel front.
5. **Cartes de financement PROPRE** (Don/Meeting/Débat télévisé) : argent **sûr**, jamais dénonçable (rapporte moins). Elles servent aussi de **LEURRES** : posées face cachée sur un front pour que la taille des piles ne trahisse pas où on est sale.
6. **Dénonciation = perte d'ARGENT et c'est un PARI** : tu désignes un rival + **un** front. Touché → il perd le **total sale de CE front** (paie cash, sinon **rend des votants de SON choix → perd des voix** ; les blocs retournent au marché). **Raté → tu perds ta mise (2 M€) + une amende de diffamation de 3 M€ versée à la cible.**
7. **Frein anti-meneur auto-ciblant** : le meneur a tout converti en voix → il est cash-pauvre → quand on le dénonce il rend des votants → il perd des voix. Planquer du cash sale = double peine.
8. **Voix lues sur les cartes votant** (face visible). La piste de score devient une simple aide de lecture (facultative).
9. **Rôle SECRET par joueur = pouvoir + objectif** (2-en-1, face cachée). Objectif accompli → **+3 voix** (révélé à la fin).
10. **Seuil = 40 − 2 × joueurs** (36/34/32/30/28), calibré par simulation (~10 manches, 97-99 % par le seuil). À raffiner.

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
   a. FINANCEMENT face caché : deux familles de cartes posées face cachée dans le casier
      du joueur, indistinguables par les autres :
        - PROPRE (sûr) : Don légal +2, Meeting +3, Débat télévisé +4. Aucun front, non dénonçable.
        - SALE (corruption) : Petit pot-de-vin +3 (Justice), Faux militants +4 (Rue),
          Costards +6 (Presse), Emploi fictif +9 (Finances). Posée sur SON front.
   b. DÉNONCIATION = pari sur l'argent : action { type:'PLAY_DENOUNCE', targetId, front }.
        - Touché (la cible a ≥1 carte sale sur ce front) : elle perd, en argent, le TOTAL
          sale de ce front (toutes les cartes sales du front sautent) ; si son cash est
          insuffisant, elle paie le manque en RENDANT des votants de SON choix (≈ 2 M€/voix)
          qui RETOURNENT au marché (mets à jour ses familles/voix/coalitions).
        - Raté (front sans carte sale — que des leurres propres, ou vide) : l'accusateur perd
          sa mise (2 M€) ET paie une AMENDE de diffamation de 3 M€ à la cible, et perd son action.
        - Plafond : 1 attaque subie (dénonciation OU vol) par manche (attackedThisRound).
        - NB : le financement propre se pose AUSSI sur un front (leurre) → côté moteur, une
          carte de financement a { type:'propre'|'sale', front } ; seules les 'sale' font perdre
          de l'argent quand dénoncées. publicState ne révèle ni le type ni le montant, juste le
          NOMBRE de cartes par front.
   c. VOIX : player.voix = somme des votants + bonus de coalition + objectif (à la fin).
      Les votants restent "publics" ; garde une piste de score comme simple miroir.
   d. FAMILLES & COALITIONS : map bloc→famille (8 familles, §15.1/§16.6). 3 blocs d'une
      famille = +3 voix, +1 par bloc en plus. Coalition complète => blocs "fidèles" (involables).
   e. VOL : Débauchage (2 M€, −2/+2) et OPA (4 M€, −3/+3) en transfert de voix, cibles =
      blocs ISOLÉS (hors coalition complète) uniquement.
   f. RÔLES SECRETS : à la création, chaque joueur reçoit 1 rôle caché = { pouvoir, objectif }.
      Pouvoir = l'asymétrie de parti (réutilise les 6 partis existants, musclés). Objectif =
      condition (ex. fini sans carte sale en Justice ; détient les Retraités ; a une coalition
      complète…) → +3 voix à la fin si remplie. publicState NE révèle PAS le rôle des autres.
   g. DÉFENSES : Protection (5 M€, bouclier de front), Blanchiment (3 M€, rend une carte sale
      "propre"), Élément de langage (réactif, annule une dénonciation).
   h. SEUIL : seuil(N) = 40 − 2*N. Garde-fou 16 manches, départ 7 M€, revenu +3.
   i. CONFIDENTIALITÉ : publicState(state, playerId) doit masquer aux autres le CONTENU des
      cartes de financement (propre/sale + front) — on n'expose que le total d'argent et le
      NOMBRE de cartes par front (face cachée). Garde le seed secret, le moteur déterministe.

2) RE-CALIBRAGE (NE PAS deviner) : adapte simulate() + une IA qui (i) vise une famille pour
   compléter des coalitions, (ii) mélange financement propre/sale, (iii) dénonce le meneur
   sur son front le plus chargé. Trouve le seuil par N donnant ~10-12 manches et ≥90 % de
   victoires par le seuil. Point de départ 40 − 2N. Reporte la valeur trouvée dans
   docs/REGLES.md (§16.7) et README.

3) UI :
   - catalogue.html : ajoute les cartes financement propre, les 2 cartes de vol, montre la
     famille sur chaque votant ; mets à jour le bac à sable (nouveau seuil).
   - index.html : casier de financement FACE CACHÉE (les rivaux voient un dos + le total
     d'argent, pas le contenu) ; dénonciation = choisir cible + front (pari) ; coalitions/
     fidèles affichés ; rôle secret affiché seulement à son propriétaire.

4) TESTS : `node src/engine.js` sort le rapport d'équilibrage recalibré ; vérifie qu'aucune
   main/role adverse ne fuit dans publicState ; une partie solo va jusqu'à la victoire.

CONTRAINTES : ne casse pas le déterminisme ; respecte le secret des cartes de financement et
des rôles ; garde la lisibilité (≤ 12 manches). Les 6 partis, les 42 blocs uniques et le
marché tournant ~8 restent la base.
```
