<!-- markdownlint-disable -->
# Exemple de partie v0.6 (4 joueurs) — pour juger l'équilibre
*Généré par la simulation `sim6_game.js`. Modèle : corruption cachée, dénonciation = pari sur l'argent, frein auto, familles, seuil 40−2N. Les infos cachées (objectifs/financement sale) sont révélées ici pour la lecture.*

```
🗳️  PARTIE À 4 — seuil = 32 voix.  Partis : La Meute · La Lumière · Le Cartel · La Vague
   (objectifs secrets / familles préférées masqués aux joueurs ; révélés ici pour la lecture)
   • La Meute vise discrètement la famille « Public ».
   • La Lumière vise discrètement la famille « Précaires ».
   • Le Cartel vise discrètement la famille « Mobilité ».
   • La Vague vise discrètement la famille « Précaires ».

── Manche 1 ───────────────────────────
   La Meute        | achète Soignants (+4v) ; se finance (sale +9M€, caché)  →  4 voix, 11 M€
   La Lumière      | achète Étudiants (+2v) ; achète Néoruraux (+2v)  →  4 voix, 2 M€
   Le Cartel       | achète Routiers (+4v) ; se finance (sale +9M€, caché)  →  4 voix, 11 M€
   La Vague        | achète Survivalistes (+2v) ; se finance (sale +6M€, caché)  →  2 voix, 12 M€
   ── classement : La Meute 4 · La Lumière 4 · Le Cartel 4 · La Vague 2

── Manche 2 ───────────────────────────
   La Lumière      | se finance (sale +6M€, caché) ; achète Maçons (+4v)  →  8 voix, 3 M€
   Le Cartel       | achète Retraités (+7v) ; se finance (sale +9M€, caché)  →  11 voix, 10 M€
   La Vague        | achète LGBT (+6v) ; se finance (sale +9M€, caché)  →  8 voix, 12 M€
   La Meute        | achète Profs (+4v) ; achète Crypto (+2v)  →  10 voix, 2 M€
   ── classement : Le Cartel 11 · La Meute 10 · La Lumière 8 · La Vague 8

── Manche 3 ───────────────────────────
   Le Cartel       | blanchit (Finances) ; achète Militaires (+4v)  →  15 voix, 2 M€
   La Vague        | achète Pétrole (+6v) ; se finance (sale +9M€, caché)  →  14 voix, 12 M€
   La Meute        | achète Influenceurs (+2v) ; se finance (sale +9M€, caché)  →  12 voix, 10 M€
   La Lumière      | se finance (sale +6M€, caché) ; achète Banquiers (+6v)  →  14 voix, 0 M€
   ── classement : Le Cartel 15 · La Lumière 14 · La Vague 14 · La Meute 12

── Manche 4 ───────────────────────────
   La Vague        | achète Patronat (+6v) ; blanchit (Justice)  →  20 voix, 0 M€
      🔥 La Meute dénonce La Vague sur Presse → SCANDALE ! −6 M€ (et 6 voix rendues en votants !).
   La Meute        | dénonce La Vague (touché −6M€/-6v) ; achète Rentiers (+4v)  →  16 voix, 3 M€
   La Lumière      | se finance (sale +9M€, caché) ; achète Fonctionnaires (+6v)  →  20 voix, 0 M€
      🗣️ Le Cartel dénonce La Lumière sur Finances → RATÉ (leurres) : −5 M€, La Lumière touche 3 M€ de dédommagement.
   Le Cartel       | dénonce La Lumière (raté) ; se finance (sale +9M€, caché)  →  15 voix, 9 M€
   ── classement : La Lumière 20 · La Meute 16 · Le Cartel 15 · La Vague 14

── Manche 5 ───────────────────────────
      🗣️ La Meute dénonce La Lumière sur Finances → RATÉ (leurres) : −5 M€, La Lumière touche 3 M€ de dédommagement.
   La Meute        | dénonce La Lumière (raté) ; se finance (sale +9M€, caché)  →  16 voix, 10 M€
   La Lumière      | blanchit (Finances) ; blanchit (Justice)  →  20 voix, 3 M€
      🔥 Le Cartel dénonce La Lumière sur Presse → SCANDALE ! −6 M€ (et 6 voix rendues en votants !).
   Le Cartel       | dénonce La Lumière (touché −6M€/-6v) ; achète Diaspora (+4v)  →  19 voix, 2 M€
   La Vague        | se finance (sale +9M€, caché) ; achète Intermittents (+2v)  →  16 voix, 8 M€
   ── classement : Le Cartel 19 · La Meute 16 · La Vague 16 · La Lumière 14

── Manche 6 ───────────────────────────
   La Lumière      | se finance (sale +9M€, caché) ; achète Startuppers (+4v)  →  18 voix, 4 M€
   Le Cartel       | achète Animalistes (+2v) ; se finance (sale +9M€, caché)  →  21 voix, 10 M€
      🔥 La Vague dénonce Le Cartel sur Justice → SCANDALE ! −9 M€.
   La Vague        | dénonce Le Cartel (touché −9M€) ; achète Ubers (+2v)  →  18 voix, 5 M€
   La Meute        | achète Pharma (+6v) ; se finance (sale +9M€, caché)  →  22 voix, 10 M€
   ── classement : La Meute 22 · Le Cartel 21 · La Lumière 18 · La Vague 18

── Manche 7 ───────────────────────────
   Le Cartel       | achète Bobos (+2v) ; se finance (sale +9M€, caché)  →  23 voix, 9 M€
      🔥 La Vague dénonce Le Cartel sur Justice → SCANDALE ! −9 M€.
   La Vague        | dénonce Le Cartel (touché −9M€) ; se finance (sale +6M€, caché)  →  18 voix, 12 M€
   La Meute        | achète CGT (+6v +COALITION Public (+3 voix!)) ; se finance (sale +9M€, caché)  →  31 voix, 10 M€
   La Lumière      | achète Libertariens (+2v) ; se finance (sale +9M€, caché)  →  20 voix, 12 M€
   ── classement : La Meute 31 · Le Cartel 23 · La Lumière 20 · La Vague 18

── Manche 8 ───────────────────────────
      🔥 La Vague dénonce La Meute sur Presse → SCANDALE ! −27 M€ (et 12 voix rendues en votants !).
   La Vague        | dénonce La Meute (touché −27M€/-12v) ; achète Héritiers (+4v)  →  22 voix, 5 M€
      🔥 La Meute dénonce Le Cartel sur Finances → SCANDALE ! −9 M€ (et 7 voix rendues en votants !).
   La Meute        | se finance (sale +9M€, caché) ; dénonce Le Cartel (touché −9M€/-7v)  →  19 voix, 10 M€
      🔥 La Lumière dénonce La Vague sur Finances → SCANDALE ! −9 M€ (et 6 voix rendues en votants !).
   La Lumière      | dénonce La Vague (touché −9M€/-6v) ; achète Flics (+4v)  →  24 voix, 5 M€
   Le Cartel       | se finance (sale +9M€, caché) ; achète Taxis (+4v)  →  20 voix, 4 M€
   ── classement : La Lumière 24 · Le Cartel 20 · La Meute 19 · La Vague 16

── Manche 9 ───────────────────────────
   La Meute        | achète Souverainistes (+6v) ; se finance (sale +9M€, caché)  →  25 voix, 10 M€
      🔥 La Lumière dénonce La Meute sur Finances → SCANDALE ! −18 M€ (et 6 voix rendues en votants !).
   La Lumière      | dénonce La Meute (touché −18M€/-6v) ; achète Gamers (+2v +COALITION Tech (+3 voix!))  →  29 voix, 2 M€
      🔥 Le Cartel dénonce La Lumière sur Justice → SCANDALE ! −9 M€ (et 6 voix rendues en votants !).
   Le Cartel       | dénonce La Lumière (touché −9M€/-6v) ; achète Éveillés (+2v +COALITION Ecolo (+3 voix!))  →  25 voix, 1 M€
      🗣️ La Vague dénonce Le Cartel sur Justice → RATÉ (leurres) : −5 M€, Le Cartel touche 3 M€ de dédommagement.
   La Vague        | se finance (sale +9M€, caché) ; dénonce Le Cartel (raté)  →  16 voix, 7 M€
   ── classement : Le Cartel 25 · La Lumière 23 · La Meute 19 · La Vague 16

── Manche 10 ───────────────────────────
   La Lumière      | se finance (sale +9M€, caché) ; achète Promoteurs (+6v)  →  29 voix, 0 M€
      🔥 Le Cartel dénonce La Lumière sur Presse → SCANDALE ! −9 M€ (et 6 voix rendues en votants !).
   Le Cartel       | dénonce La Lumière (touché −9M€/-6v) ; blanchit (Justice)  →  25 voix, 2 M€
   La Vague        | achète Chômeurs (+4v +COALITION Précaires (+3 voix!)) ; se finance (sale +9M€, caché)  →  23 voix, 11 M€
   La Meute        | se finance (sale +9M€, caché) ; achète Chasseurs (+4v)  →  23 voix, 4 M€
   ── classement : Le Cartel 25 · La Meute 23 · La Lumière 23 · La Vague 23

── Manche 11 ───────────────────────────
   Le Cartel       | achète Antivax (+2v) ; se finance (sale +9M€, caché)  →  27 voix, 10 M€
      🔥 La Vague dénonce Le Cartel sur Justice → SCANDALE ! −9 M€.
   La Vague        | dénonce Le Cartel (touché −9M€) ; achète Agriculteurs (+4v)  →  27 voix, 4 M€
   La Meute        | achète Complotistes (+2v) ; se finance (sale +9M€, caché)  →  25 voix, 12 M€
   La Lumière      | se finance (sale +9M€, caché) ; achète Motards (+4v)  →  27 voix, 4 M€
   ── classement : La Lumière 27 · Le Cartel 27 · La Vague 27 · La Meute 25

── Manche 12 ───────────────────────────
      🔥 La Vague dénonce La Lumière sur Justice → SCANDALE ! −9 M€ (et 4 voix rendues en votants !).
   La Vague        | dénonce La Lumière (touché −9M€/-4v) ; achète Masculinistes (+2v)  →  29 voix, 1 M€
      🔥 La Meute dénonce La Vague sur Presse → SCANDALE ! −24 M€ (et 14 voix rendues en votants !).
   La Meute        | dénonce La Vague (touché −24M€/-14v) ; achète Retraités (+7v)  →  32 voix, 0 M€
   La Lumière      | se finance (sale +9M€, caché) ; achète Intégristes (+6v)  →  29 voix, 0 M€
      🔥 Le Cartel dénonce La Meute sur Justice → SCANDALE ! −18 M€ (et 11 voix rendues en votants !).
   Le Cartel       | se finance (sale +6M€, caché) ; dénonce La Meute (touché −18M€/-11v)  →  27 voix, 8 M€
   ── classement : La Lumière 29 · Le Cartel 27 · La Meute 21 · La Vague 15

🏆  La Lumière REMPORTE l'élection avec 29 voix (fin par seuil, manche 12).
   Final : La Lumière 29v/0M€ · Le Cartel 27v/8M€ · La Meute 21v/0M€ · La Vague 15v/0M€
```
