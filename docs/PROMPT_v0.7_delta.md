<!-- markdownlint-disable -->
# Prompt v0.7 — mise à jour à coller dans Claude Code

> À coller par-dessus une implémentation v0.6 existante. La spec qui fait foi reste `docs/REGLES.md §16`.
> Résumé complet : `docs/PROMPT_CLAUDE_v0.6.md`.

```
MISE À JOUR v0.7 du jeu Caisse-noire (spec faisant foi : docs/REGLES.md §16).
Applique ces changements dans src/engine.js, puis propage à index.html + catalogue.html,
puis recalibre avec simulate(). Ne casse pas le déterminisme ni le secret des cartes.

1. DÉNONCIATION = pari sur UNE carte (plus le front entier).
   - Chaque front (Justice/Presse/Finances) est une PILE face cachée, ordre conservé.
   - Action { type:'PLAY_DENOUNCE', targetId, front } : on révèle la carte du DESSUS.
     • Sale  -> la cible perd son montant (3/6/9) ; carte défaussée. Si cash insuffisant,
       elle rend des votants de SON choix (~2 M€/voix) qui retournent au marché.
     • Leurre propre ou pile vide -> RATÉ : l'accusateur perd sa mise (2 M€) + amende 3 M€
       à la cible, et perd son action.
   - Effet voulu : les leurres empilés protègent les cartes du dessous -> parties plus
     longues, moins swingy. Plafond : 1 attaque subie par manche.

2. PARTI = FAMILLE INTERDITE SECRÈTE (remplace pouvoirs de parti + objectifs à points).
   - À la création, chaque joueur reçoit { forbiddenFamily } face caché, connu de lui seul.
   - Il ne peut JAMAIS acheter un bloc de cette famille. Aucun autre effet, aucun signal
     économique. publicState NE révèle PAS la famille interdite des autres.
   - Supprime tout ancien pouvoir de parti et toute carte objectif à +3 voix.

3. DÉBAUCHAGE / OPA = CARTES (vol de voix) ; la VICTIME choisit.
   - Joue la carte sur un rival ; c'est la cible qui désigne quel votant ISOLÉ (hors
     coalition complète) elle cède ; le bloc passe chez l'attaquant (voix + famille).
   - OPA = version plus chère / bloc de plus forte valeur.

4. INCOMPATIBILITÉS RENFORCÉES entre votants.
   - Liste de PAIRES exclusives (ne peut détenir les deux) : à l'achat, refuse un bloc
     incompatible avec un bloc déjà détenu. Étoffe la liste (Chasseurs×Animalistes,
     Patronat×CGT, Flics×Émeutiers, Bobos×Souverainistes...) pour ralentir la progression.

5. DECK VOTANTS ~64 BLOCS UNIQUES (≈ 8/famille, 8 familles).
   - Il faut CRÉER les blocs manquants (noms satiriques FR), tiers 4/2, 8/4, 12/6.
   - La plupart des familles ont au moins un gros bloc 12/6 ; quelques familles non (OK).

6. SEUIL = 70 − 6 × joueurs : 2j=58 · 3j=52 · 4j=46 · 5j=40 · 6j=34.
   - SEUIL(n) = 70 - 6*n. Départ 7 M€, revenu +3/tour, garde-fou ~40 manches.
   - Cible : ~40-50 tours totaux (manches × joueurs) ≈ 12-15 min.

7. FIN DE PARTIE : atteindre le seuil déclenche la MANCHE FINALE (tout le monde joue son
   tour), puis le PLUS DE VOIX gagne — même si renvoyé sous le seuil par une dénonciation
   de fin de manche. Ne fige pas la victoire dès que le seuil est touché.

8. RE-CALIBRAGE (ne pas deviner) : adapte simulate() + une IA qui respecte sa famille
   interdite + les incompatibilités, mélange financement propre/sale, et dénonce le meneur
   sur son front le plus chargé (1 carte). Confirme que 70−6N donne ~40-50 tours totaux et
   ≥90 % de victoires par le seuil. Reporte la valeur finale dans docs/REGLES.md §16.7 + README.

9. UI :
   - index.html : casier de financement en PILES par front, face cachée (les rivaux voient
     des dos + le total d'argent, pas le contenu) ; dénonciation = cible + front -> révèle la
     carte du dessus ; débauchage/OPA = la victime choisit le bloc ; famille interdite visible
     seulement par son propriétaire.
   - catalogue.html : reconstruis en v0.7 (réf. catalogue-v0.6.html) ; bac à sable seuil 70−6N.

10. CONFIDENTIALITÉ : publicState masque le CONTENU des cartes de financement (type + montant)
    ET la famille interdite ; n'expose que le total d'argent + le NOMBRE de cartes par front.
    Garde le seed secret, moteur déterministe.
```
