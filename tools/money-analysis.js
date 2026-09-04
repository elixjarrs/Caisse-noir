/* =============================================================================
 * CAISSE NOIRE — Analyse des flux d'argent pour concevoir la MONNAIE PHYSIQUE.
 * -----------------------------------------------------------------------------
 * Simule des milliers de parties (moteur headless) et mesure :
 *   1. la distribution des MONTANTS à payer/encaisser (liste de prix réelle) ;
 *   2. la distribution des SOLDES individuels et de l'argent total en circulation
 *      (→ combien de cartes-monnaie imprimer, taille de la banque) ;
 *   3. l'évaluation de plusieurs jeux de COUPURES (couverture + cartes par paiement) ;
 *   4. la « base-3 » : quel % des montants sont des multiples de 3, et ce que
 *      donneraient de petites retouches de règles pour des coupures propres.
 *
 * Usage :  node tools/money-analysis.js [nbPartiesParN]
 * ============================================================================= */
'use strict';
const CN = require('../src/engine.js');

const GAMES_PER_N = Math.max(50, parseInt(process.argv[2] || '2000', 10));
const NS = [2, 3, 4, 5, 6];

/* ------------------------------ collecte ---------------------------------- */
const payAmounts = {};      // montant -> occurrences (joueur -> banque)  [liste de prix]
const recvAmounts = {};     // montant -> occurrences (banque -> joueur)
const fineAmounts = {};     // saleSum nominal des amendes touchées
const balSamples = [];      // solde individuel échantillonné à chaque mouvement
let indivMax = 0;           // plus gros solde individuel jamais atteint
const gameTotMax = [];      // par partie : plus gros total d'argent en circulation (somme des soldes)
let nGames = 0, nActions = 0;

function bump(o, k) { o[k] = (o[k] || 0) + 1; }

for (const N of NS) {
  for (let g = 0; g < GAMES_PER_N; g++) {
    const st = CN.createGame({ nPlayers: N, seed: (777 + g * 2654435761 + N * 40503) >>> 0 });
    let guard = 0;
    // rejoue la partie en enregistrant, à chaque pas, le total d'argent en circulation
    let totMaxThisGame = 0;
    const snapTot = () => { const s = st.players.reduce((a, p) => a + p.money, 0); if (s > totMaxThisGame) totMaxThisGame = s; };
    snapTot();
    while (!st.over && guard++ < 4000) { CN.autoStep(st); snapTot(); }
    nGames++;
    // dépouille le ledger de la partie
    for (const e of st.ledger) {
      nActions++;
      if (e.bal != null) { balSamples.push(e.bal); if (e.bal > indivMax) indivMax = e.bal; }
      const amt = Math.abs(e.delta);
      if (e.type === 'fine_cash' || e.type === 'fine_votants') {
        const s = e.info && e.info.saleSum; if (s) bump(fineAmounts, s);
        if (e.type === 'fine_cash' && amt) bump(payAmounts, amt);
      } else if (e.delta < 0) {
        bump(payAmounts, amt);
      } else if (e.delta > 0 && e.type !== 'start') {
        bump(recvAmounts, amt);
      }
    }
    gameTotMax.push(totMaxThisGame);
  }
}

/* ------------------------------ utilitaires ------------------------------- */
function pct(o) {
  const tot = Object.values(o).reduce((a, b) => a + b, 0);
  return Object.keys(o).map(Number).sort((a, b) => a - b)
    .map(k => ({ amount: k, n: o[k], pct: +(100 * o[k] / tot).toFixed(1) }));
}
function quant(arr, q) { const a = arr.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(q * a.length))]; }
function fmtRow(rows) { return rows.map(r => `${r.amount}M€:${r.pct}%`).join('  '); }

// min cartes pour composer EXACTEMENT `amount` avec les coupures D (illimitées).
// Renvoie Infinity si non représentable exactement (ni par le payeur ni par la banque en rendu).
function minCards(amount, D) {
  const dp = new Array(amount + 1).fill(Infinity); dp[0] = 0;
  for (let a = 1; a <= amount; a++) for (const d of D) if (d <= a && dp[a - d] + 1 < dp[a]) dp[a] = dp[a - d] + 1;
  return dp[amount];
}
// évalue un jeu de coupures sur une distribution de montants {amount:occurrences}
function evalDenoms(D, dist) {
  let tot = 0, covered = 0, cardSum = 0;
  for (const k in dist) {
    const a = +k, n = dist[k]; tot += n;
    const mc = minCards(a, D);
    if (mc !== Infinity) { covered += n; cardSum += mc * n; }
  }
  return { D: D.join('/'), couverture: +(100 * covered / tot).toFixed(1), cartesMoy: covered ? +(cardSum / covered).toFixed(2) : null };
}

/* -------------------------------- rapport --------------------------------- */
const L = console.log;
L(`\n================  CAISSE NOIRE — ANALYSE MONNAIE  ================`);
L(`Parties simulées : ${nGames}  (N=${NS.join(',')} × ${GAMES_PER_N})   mouvements d'argent : ${nActions}`);

L(`\n--- 1. LISTE DE PRIX : montants à PAYER (joueur → banque) ---`);
const payRows = pct(payAmounts);
L('  ' + fmtRow(payRows));
L(`  (achats votants 4/8/12 · protéger 5 · blanchir 3 · dénoncer 2 · amendes = variables)`);

L(`\n--- 2. montants ENCAISSÉS (banque → joueur) ---`);
L('  ' + fmtRow(pct(recvAmounts)));

L(`\n--- 3. AMENDES touchées (somme sale du front dénoncé) ---`);
const fr = pct(fineAmounts);
L('  ' + (fr.length ? fmtRow(fr) : '(aucune)'));

L(`\n--- 4. SOLDES ---`);
L(`  solde individuel :  médiane ${quant(balSamples, .5)}   p90 ${quant(balSamples, .9)}   p99 ${quant(balSamples, .99)}   max ${indivMax}  M€`);
L(`  argent TOTAL en circulation (somme des soldes, pic/partie) :  médiane ${quant(gameTotMax, .5)}   p90 ${quant(gameTotMax, .9)}   p99 ${quant(gameTotMax, .99)}   max ${Math.max(...gameTotMax)}  M€`);

L(`\n--- 5. BASE 3 (règles ACTUELLES) ---`);
const allPay = { ...payAmounts }; for (const k in fineAmounts) allPay[k] = (allPay[k] || 0) + fineAmounts[k];
const totPay = Object.values(allPay).reduce((a, b) => a + b, 0);
const mult3 = Object.keys(allPay).filter(k => +k % 3 === 0).reduce((a, k) => a + allPay[k], 0);
L(`  ${(100 * mult3 / totPay).toFixed(1)}% du VOLUME de paiements est déjà multiple de 3.`);
L(`  Ce qui casse la base-3 : dénoncer=2, protéger=5, dotation de départ=7 (achats 4/8 aussi).`);

L(`\n--- 6. ÉVALUATION DE COUPURES (sur la liste de prix réelle, amendes incluses) ---`);
const dist = allPay;
const candidates = [[1], [1, 5], [1, 2, 5], [1, 2, 5, 10], [1, 3], [1, 3, 9], [1, 4, 12], [2, 5], [3, 9], [3, 6, 12]];
L(`  ${'coupures'.padEnd(14)} ${'couverture'.padEnd(11)} cartes/paiement (exact)`);
for (const D of candidates) { const r = evalDenoms(D, dist); L(`  ${r.D.padEnd(14)} ${(r.couverture + '%').padEnd(11)} ${r.cartesMoy == null ? '—' : r.cartesMoy}`); }

L(`\n--- 7. SCÉNARIO « BASE-3 PROPRE » (retouche de règles) ---`);
L(`  Si dénoncer 2→3, protéger 5→6, départ 7→6, et achats 4/8/12 → 3/6/12 (ou 3/9/… au choix),`);
L(`  alors 100% des montants deviennent multiples de 3 → coupures [3,9] suffisent (couverture 100%).`);
L(`  Cartes pour un solde médian (${quant(balSamples, .5)}M€) avec [3,9] : ${minCards(Math.round(quant(balSamples, .5) / 3) * 3, [3, 9])} ; p99 (${quant(balSamples, .99)}M€) : ~${minCards(Math.round(quant(balSamples, .99) / 3) * 3, [3, 9])}.`);
L(`================================================================\n`);
