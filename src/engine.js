/* =============================================================================
 * CAISSE NOIRE — Moteur de jeu v0.7 « corruption cachée » (headless, source de vérité)
 * -----------------------------------------------------------------------------
 * - Aucune dépendance, aucun DOM. Node ET navigateur. Déterministe (RNG seedée).
 * - État 100% sérialisable en JSON (pas de Set/Map) => sync réseau facile.
 *
 * MODÈLE v0.7 (règles : ../docs/REGLES.md §16, fait foi) — évolution de la v0.6 :
 *   1. DÉNONCIATION = pari sur un FRONT ENTIER : chaque front est une pile face cachée. On désigne
 *      un front ; la cible perd la SOMME de TOUTES ses cartes sales de ce front (cash, sinon rend
 *      des votants). Si le front n'a QUE du propre / est vide / protégé → RATÉ : l'accusateur perd
 *      sa mise (2) + amende 3 à la cible. Les leurres propres appâtent donc un ratage (bluff).
 *   2. PARTI = FAMILLE INTERDITE SECRÈTE : chaque joueur a une famille qu'il ne peut jamais
 *      acheter, connue de lui seul. Aucun autre effet (remplace pouvoirs + objectifs à points).
 *   3. DÉBAUCHAGE / OPA = CARTES : la VICTIME choisit quel votant ISOLÉ elle cède ; le bloc
 *      (voix + famille) passe chez l'attaquant. OPA = bloc de plus forte valeur.
 *   4. INCOMPATIBILITÉS renforcées : paires exclusives (on ne peut pas détenir les deux).
 *   5. DECK VOTANTS ~64 blocs uniques (8 familles × 8), tiers 4/2, 8/4, 12/6.
 *   6. SEUIL = 45 voix (fixe, tous N ; calibré ~14-15 manches). Garde-fou 40 manches.
 *   7. FIN : atteindre le seuil verrouille la manche finale ; le plus de voix gagne.
 *  10. CONFIDENTIALITÉ : publicState masque le contenu du financement ET la famille interdite ;
 *      n'expose que l'argent + le NOMBRE de cartes par front.
 *
 * ACTIONS : BUY_VOTANT · PLAY_FINANCE · PLAY_FINANCE_CLEAN{front?} · PLAY_PROTECT · PLAY_BLANCH ·
 *   PLAY_DENOUNCE{targetId,front} · PLAY_STEAL{targetId} · PLAY_COUP · RECYCLE · END_TURN
 *   PAY_DEBT{votantIndexes} (réaction du dénoncé) · CEDE_BLOC{bloc} (réaction de la victime d'un vol)
 * ============================================================================= */

'use strict';

/* ----------------------------- CONFIG (à calibrer) ------------------------- */
const CONFIG = {
  start: 7, income: 3, hand: 5, actions: 2,
  protectCost: 5, blanchCost: 3, denounceCost: 2, amende: 3,
  guardrail: 40,
};
// Seuil FIXE = 45 voix pour tous les N (choix EJ). Vérifié par simulate() : ~14-15 manches et
// 100% de victoires par le seuil pour N=2..6 (le nb de manches reste ~constant quel que soit N,
// chaque joueur joue ~autant de tours). Passe à 40 pour des parties un cran plus rapides.
const SEUIL_VOIX = 45;
function seuil(_nPlayers) { return SEUIL_VOIX; }
function marketVisibleFor(_n) { return 8; }

const FRONTS = ['Justice', 'Presse', 'Finances'];

/* ------------------------- VOTANTS : 8 familles × 8 (64) ------------------- */
/* [nom, blocKey, tier]  — tier P=Petit(4/2) M=Moyen(8/4) G=Gros(12/6) */
const FAMILY_DEF = {
  'Le Capital': [
    ['Le Patronat','Patronat','G'],['Les Banquiers','Banquiers','G'],['Les Retraités','Retraités','M'],
    ['Les Rentiers','Rentiers','M'],['Les Héritiers','Héritiers','M'],['Les Promoteurs','Promoteurs','P'],
    ['Les Actionnaires','Actionnaires','P'],['Le Lobby du luxe','Luxe','P'],
  ],
  'Le Bloc Public': [
    ['La CGT','CGT','G'],['Les Fonctionnaires','Fonctionnaires','G'],['Les Soignants','Soignants','M'],
    ['Les Profs','Profs','M'],['Les Cheminots','Cheminots','M'],['Les Postiers','Postiers','P'],
    ['Les Territoriaux','Territoriaux','P'],['Les Bibliothécaires','Bibliothecaires','P'],
  ],
  "L'Ordre & le Terroir": [
    ["Le Lobby agroalimentaire",'Agroalim','G'],['Les Militaires','Militaires','G'],['Les Policiers','Flics','M'],
    ['Les Chasseurs','Chasseurs','M'],['Les Éleveurs','Eleveurs','M'],['Les Gendarmes','Gendarmes','P'],
    ['Les Pêcheurs','Pecheurs','P'],['Les Viticulteurs','Viticulteurs','P'],
  ],
  'La Start-up Nation': [
    ['La Big Tech','BigTech','G'],['Les Start-uppers','Startuppers','M'],['Les Traders','Traders','M'],
    ['Les Youtubeurs','Youtubeurs','M'],['Les Crypto-bros','Crypto','P'],['Les Influenceurs','Influenceurs','P'],
    ['Les Libertariens','Libertariens','P'],['Les Gamers','Gamers','P'],
  ],
  "L'Écolo-Bobo": [
    ['Les ONG vertes','ONG','M'],['Les Décroissants','Decroissants','M'],['Les Néo-ruraux','Neoruraux','M'],
    ['Les Animalistes','Animalistes','P'],['Les Bobos urbains','Bobos','P'],['Les Éveillés','Eveilles','P'],
    ['Les Cyclistes','Cyclistes','P'],['Les Vegans','Vegans','P'],
  ],
  "L'Identité": [
    ['Les Souverainistes','Souverainistes','G'],['Les Intégristes','Integristes','G'],['Les Identitaires','Identitaires','M'],
    ['Les Traditionalistes','Traditionalistes','M'],['Les Anti-immigration','AntiImmig','M'],['Les Masculinistes','Masculinistes','P'],
    ['Les Survivalistes','Survivalistes','P'],['Les Complotistes','Complotistes','P'],
  ],
  'Les Précaires': [
    ['Les Gilets jaunes','GiletsJaunes','G'],['Les Chômeurs','Chomeurs','M'],['Les Intérimaires','Interimaires','M'],
    ['Les Auto-entrepreneurs','AutoEntrepreneurs','M'],['Les Intermittents','Intermittents','P'],['Les Étudiants','Etudiants','P'],
    ['Les Chauffeurs VTC','Ubers','P'],['Les Livreurs','Livreurs','P'],
  ],
  'La Mobilité': [
    ['Les Automobilistes','Automobilistes','G'],['Les Taxis','Taxis','M'],['Les Routiers','Routiers','M'],
    ['Les Compagnies aériennes','Aerien','M'],['Les Motards','Motards','P'],['Les Usagers du périph','Periph','P'],
    ['Les Bateliers','Bateliers','P'],['Les Trottinettistes','Trottinettes','P'],
  ],
};
const TIERVAL = { P: { tier:'Petit', cost:4, voix:2 }, M: { tier:'Moyen', cost:8, voix:4 }, G: { tier:'Gros', cost:12, voix:6 } };
const VOTANTS = [];
const FAMILIES = {};   // blocKey -> famille
for (const fam in FAMILY_DEF) for (const [nom, bloc, t] of FAMILY_DEF[fam]) {
  const v = TIERVAL[t]; VOTANTS.push({ nom, bloc, tier: v.tier, cost: v.cost, voix: v.voix, family: fam });
  FAMILIES[bloc] = fam;
}
const VOTANT_BY_BLOC = {}; for (const v of VOTANTS) VOTANT_BY_BLOC[v.bloc] = v;
const FAMILY_LIST = Object.keys(FAMILY_DEF);

/* ------------------- INCOMPATIBILITÉS : paires EXCLUSIVES ------------------- */
/* On ne peut pas détenir les deux (refus à l'achat, sauf carte Incohérence). Cross-familles. */
const INCOMPAT = [
  ['Chasseurs','Animalistes'], ['Chasseurs','Vegans'], ['Eleveurs','Vegans'],
  ['Patronat','CGT'], ['Actionnaires','CGT'], ['Banquiers','GiletsJaunes'],
  ['Flics','GiletsJaunes'], ['Gendarmes','GiletsJaunes'],
  ['Bobos','Souverainistes'], ['Eveilles','Masculinistes'], ['Eveilles','AntiImmig'],
  ['Neoruraux','Promoteurs'], ['Cyclistes','Automobilistes'], ['Cyclistes','Motards'],
  ['Integristes','Eveilles'], ['Militaires','Intermittents'], ['Souverainistes','BigTech'],
  ['AntiImmig','Livreurs'], ['Decroissants','Traders'], ['Survivalistes','Eveilles'],
  ['Traditionalistes','Youtubeurs'], ['Agroalim','ONG'], ['Luxe','GiletsJaunes'], ['Automobilistes','Decroissants'],
];
function incompatWith(bloc, owned) {
  for (const [a, b] of INCOMPAT) { if (bloc === a && owned.includes(b)) return b; if (bloc === b && owned.includes(a)) return a; }
  return null;
}

/* ------------------------- COALITIONS (familles) --------------------------- */
function familyCounts(blocs) { const c = {}; for (const b of blocs) { const f = FAMILIES[b]; if (f) c[f] = (c[f] || 0) + 1; } return c; }
function coalitionBonus(blocs) { const c = familyCounts(blocs); let b = 0; for (const f in c) if (c[f] >= 3) b += c[f]; return b; }
function completeFamilies(blocs) { const c = familyCounts(blocs); return Object.keys(c).filter(f => c[f] >= 3); }
function isFidele(bloc, blocs) { const f = FAMILIES[bloc]; if (!f) return false; return familyCounts(blocs)[f] >= 3; }

/* --------------- PARTIS = nom satirique + famille interdite ---------------- */
/* Le nom N'EST montré qu'au propriétaire (il révélerait la famille interdite sinon). */
const PARTY_BY_FAMILY = {
  'Le Capital':            'La France des Travailleurs',
  'Le Bloc Public':        'Le Parti du Privé',
  "L'Ordre & le Terroir":  'Les Écologistes Radicaux',
  'La Start-up Nation':    'Le Mouvement Souverain',
  "L'Écolo-Bobo":          'Le Rassemblement des Bâtisseurs',
  "L'Identité":            'La République Ouverte',
  'Les Précaires':         'Le Parti de l\'Ordre',
  'La Mobilité':           'Les Amis du Rail',
};

/* ------------------- COMBINES : pioche commune ----------------------------- */
const COMBINES_DEF = [
  // SALE — 3 fronts × 3/6/9
  { kind:'cor', front:'Justice',  nom:'Petit pot-de-vin', gain:3, n:4 },
  { kind:'cor', front:'Justice',  nom:"Trafic d'influence", gain:6, n:3 },
  { kind:'cor', front:'Justice',  nom:'Caisse noire judiciaire', gain:9, n:2 },
  { kind:'cor', front:'Presse',   nom:'Petits cadeaux', gain:3, n:4 },
  { kind:'cor', front:'Presse',   nom:'Ménage médiatique', gain:6, n:3 },
  { kind:'cor', front:'Presse',   nom:'Voyage offert', gain:9, n:2 },
  { kind:'cor', front:'Finances', nom:'Note de frais maquillée', gain:3, n:4 },
  { kind:'cor', front:'Finances', nom:'Rétrocommission', gain:6, n:3 },
  { kind:'cor', front:'Finances', nom:'Évasion fiscale', gain:9, n:2 },
  // PROPRE (leurre, plafond 6)
  { kind:'clean', nom:"Don d'un militant", gain:3, n:4 },
  { kind:'clean', nom:'Cotisations du parti', gain:3, n:4 },
  { kind:'clean', nom:'Meeting payant', gain:6, n:3 },
  { kind:'clean', nom:'Subvention européenne', gain:6, n:3 },
  // Attaque & défense
  { kind:'den', nom:'Dénonciation', n:20 },
  { kind:'pro', nom:'Juge acheté', front:'Justice', n:4 },
  { kind:'pro', nom:'Médias corrompus', front:'Presse', n:4 },
  { kind:'pro', nom:'Compte offshore', front:'Finances', n:4 },
  { kind:'bla', nom:'Blanchiment', n:8 },
  { kind:'steal', e:'debauchage', nom:'Débauchage', n:8 },
  { kind:'steal', e:'opa', nom:'OPA électorale', n:4 },
  // Coups tactiques
  { kind:'coup', e:'element', nom:'Élément de langage', n:5 },
  { kind:'coup', e:'remise', nom:'Remise de campagne', n:3 },
  { kind:'coup', e:'incoherence', nom:'Incohérence', n:3 },
  { kind:'coup', e:'promesse', nom:'Promesse intenable', n:3 },
  { kind:'coup', e:'renvoi', nom:"Renvoi d'ascenseur", n:2 },
];

/* -------------------------------- RNG seedée ------------------------------- */
function nextRand(state) { let t = (state.rng += 0x6D2B79F5) >>> 0; t = Math.imul(t ^ (t >>> 15), 1 | t); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function shuffle(arr, state) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(nextRand(state) * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

/* ------------------------------- CONSTRUCTION ------------------------------ */
function buildCombines() { const d = []; for (const c of COMBINES_DEF) { const { n, ...card } = c; for (let i = 0; i < n; i++) d.push({ ...card }); } return d; }
function buildVotants() { return VOTANTS.map(v => ({ ...v })); }

function newPlayer(id, forbiddenFamily, name) {
  return {
    id, name: name || ('Joueur ' + (id + 1)),
    forbiddenFamily,                        // SECRET
    money: CONFIG.start, voix: 0,
    votants: [], blocs: [],
    financ: { Justice: [], Presse: [], Finances: [] },   // piles ordonnées {clean,amount}
    protect: [], hand: [],
    attackedThisRound: false, denounceLaunched: 0, failedDenounce: [],
    incoherenceReady: false, discount: false,
  };
}

function createGame(opts = {}) {
  const nPlayers = Math.max(2, Math.min(6, opts.nPlayers || 4));
  const state = {
    rng: (opts.seed != null ? opts.seed : (Date.now() & 0xffffffff)) >>> 0,
    nPlayers, X: (opts.X != null ? opts.X : seuil(nPlayers)),
    marketVisible: opts.marketVisible || marketVisibleFor(nPlayers),
    turn: 0, order: [], currentIdx: 0, actionsLeft: 0,
    deck: [], discard: [], votantDeck: [], market: [],
    players: [], over: false, winner: null, endReason: null,
    pending: null, endingTriggered: false, log: [],
  };
  const famPool = shuffle(FAMILY_LIST.slice(), state);   // famille interdite distincte par joueur
  for (let i = 0; i < nPlayers; i++) state.players.push(newPlayer(i, famPool[i % famPool.length], (opts.names && opts.names[i]) || null));
  state.deck = shuffle(buildCombines(), state);
  state.votantDeck = shuffle(buildVotants(), state);
  refillMarket(state);
  for (const p of state.players) drawUp(state, p);
  startRound(state);
  return state;
}

/* ------------------------------ UTILITAIRES -------------------------------- */
function log(state, msg, tag) { state.log.unshift({ t: state.turn, msg, tag: tag || null }); }
function current(state) { return state.order[state.currentIdx]; }
function recompute(p) { p.voix = Math.max(0, p.votants.reduce((a, x) => a + x.voix, 0) + coalitionBonus(p.blocs)); }
function finalScore(p) { return p.voix; }

function frontCount(p, fr) { return p.financ[fr].length; }
function saleSumFront(p, fr) { return p.financ[fr].reduce((a, c) => a + (c.clean ? 0 : c.amount), 0); }
function biggestDirty(p) { let best = null; for (const fr of FRONTS) p.financ[fr].forEach((c, i) => { if (!c.clean && (!best || c.amount > best.amount)) best = { front: fr, idx: i, amount: c.amount }; }); return best; }
function exposedSaleFronts(p) { return FRONTS.filter(fr => !p.protect.includes(fr) && saleSumFront(p, fr) > 0); }

function refillMarket(state) { while (state.market.length < state.marketVisible && state.votantDeck.length > 0) state.market.push(state.votantDeck.pop()); }
function drawUp(state, p) { while (p.hand.length < CONFIG.hand) { if (state.deck.length === 0) { if (state.discard.length === 0) break; state.deck = shuffle(state.discard, state); state.discard = []; } p.hand.push(state.deck.pop()); } }
function discardFromHand(state, p, idx) { state.discard.push(p.hand[idx]); p.hand.splice(idx, 1); }
function returnVotant(state, p, i) { const v = p.votants.splice(i, 1)[0]; if (v && v.bloc) { const bi = p.blocs.indexOf(v.bloc); if (bi >= 0) p.blocs.splice(bi, 1); if (VOTANT_BY_BLOC[v.bloc]) state.votantDeck.push({ ...VOTANT_BY_BLOC[v.bloc] }); } return v ? v.voix : 0; }

/* ------------------------------- TOURS / MANCHES --------------------------- */
function startRound(state) {
  state.turn++;
  for (const p of state.players) p.attackedThisRound = false;
  const sp = (state.turn - 1) % state.nPlayers;
  state.order = state.players.slice(sp).concat(state.players.slice(0, sp));
  state.currentIdx = 0;
  beginTurn(state);
}
function beginTurn(state) { const p = current(state); p.money += CONFIG.income; p.discount = false; p.incoherenceReady = false; state.actionsLeft = CONFIG.actions; log(state, `${p.name} encaisse +${CONFIG.income} M€`, 'income'); }
function endTurn(state) {
  const p = current(state);
  drawUp(state, p);
  state.currentIdx++;
  if (state.currentIdx < state.nPlayers) { beginTurn(state); return; }
  if (state.endingTriggered) { endGame(state, 'seuil'); return; }
  if (state.turn >= CONFIG.guardrail || (state.votantDeck.length === 0 && state.market.length === 0)) { endGame(state, 'gardefou'); return; }
  startRound(state);
}
function endGame(state, reason) {
  state.over = true; state.endReason = reason;
  const ranked = state.players.slice().sort((a, b) => finalScore(b) - finalScore(a) || b.money - a.money);
  state.winner = ranked[0].id;
  log(state, `🏆 ${ranked[0].name} gagne avec ${ranked[0].voix} voix (${reason === 'seuil' ? 'le plus de voix en fin de manche' : 'garde-fou'})`, 'win');
}

/* ----------------------------- ACTIONS LÉGALES ----------------------------- */
function legalActions(state, playerId) {
  const acts = [];
  if (state.over) return acts;
  if (state.pending) {
    if (state.pending.playerId === playerId) {
      const t = state.players.find(p => p.id === playerId);
      if (state.pending.kind === 'debt') acts.push({ type: 'PAY_DEBT', votantIndexes: debtChoice(t, state.pending.voixNeeded) });
      else if (state.pending.kind === 'cede') cedeableBlocs(state, t, state.pending).forEach(b => acts.push({ type: 'CEDE_BLOC', bloc: b }));
    }
    return acts;
  }
  const p = current(state);
  if (!p || p.id !== playerId || state.actionsLeft <= 0) { if (p && p.id === playerId) acts.push({ type: 'END_TURN' }); return acts; }
  state.market.forEach((c, i) => { if (canBuy(p, c).ok) acts.push({ type: 'BUY_VOTANT', marketIndex: i }); });
  p.hand.forEach((card, i) => {
    if (card.kind === 'cor') acts.push({ type: 'PLAY_FINANCE', handIndex: i });
    else if (card.kind === 'clean') acts.push({ type: 'PLAY_FINANCE_CLEAN', handIndex: i });
    else if (card.kind === 'pro' && CONFIG.protectCost <= p.money && !p.protect.includes(card.front)) acts.push({ type: 'PLAY_PROTECT', handIndex: i });
    else if (card.kind === 'bla' && CONFIG.blanchCost <= p.money && biggestDirty(p)) acts.push({ type: 'PLAY_BLANCH', handIndex: i });
    else if (card.kind === 'den' && CONFIG.denounceCost <= p.money) {
      for (const t of state.players) if (t !== p && !t.attackedThisRound)
        for (const fr of FRONTS) if (!t.protect.includes(fr) && frontCount(t, fr) > 0) acts.push({ type: 'PLAY_DENOUNCE', handIndex: i, targetId: t.id, front: fr });
    } else if (card.kind === 'steal') {
      for (const t of state.players) if (t !== p && !t.attackedThisRound && cedeableBlocs(state, t, { attackerId: p.id, mode: card.e }).length) acts.push({ type: 'PLAY_STEAL', handIndex: i, targetId: t.id });
    } else if (card.kind === 'coup' && card.e !== 'element') acts.push({ type: 'PLAY_COUP', handIndex: i });
  });
  acts.push({ type: 'RECYCLE', handIndexes: [0] });
  acts.push({ type: 'END_TURN' });
  return acts;
}
function canBuy(p, c) {
  let cost = c.cost;
  if (p.discount) cost = Math.max(0, cost - 3);
  if (cost > p.money) return { ok: false, why: 'argent' };
  if (FAMILIES[c.bloc] === p.forbiddenFamily) return { ok: false, why: 'famille-interdite' };
  if (incompatWith(c.bloc, p.blocs) && !p.incoherenceReady) return { ok: false, why: 'incompatible' };
  return { ok: true, cost };
}
// blocs qu'une victime peut céder à un vol : isolés (hors coalition complète) ET pas de la
// famille interdite de l'attaquant. OPA => uniquement les plus hauts tiers possédés.
function cedeableBlocs(state, victim, pend) {
  const attacker = state.players.find(x => x.id === pend.attackerId);
  let cand = victim.blocs.filter(b => !isFidele(b, victim.blocs) && FAMILIES[b] !== (attacker ? attacker.forbiddenFamily : null));
  if (pend.mode === 'opa' && cand.length) { const mx = Math.max(...cand.map(b => VOTANT_BY_BLOC[b].voix)); cand = cand.filter(b => VOTANT_BY_BLOC[b].voix === mx); }
  return cand;
}

/* ----------------------------- APPLIQUER UNE ACTION ------------------------ */
function applyAction(state, playerId, action) {
  if (state.over) return fail(state, 'partie terminée');
  if (state.pending) {
    if (playerId !== state.pending.playerId) return fail(state, 'réaction en attente');
    const p = state.players.find(x => x.id === playerId);
    if (state.pending.kind === 'debt' && action.type === 'PAY_DEBT') return doPayDebt(state, p, action.votantIndexes);
    if (state.pending.kind === 'cede' && action.type === 'CEDE_BLOC') return doCede(state, p, action.bloc);
    return fail(state, 'réaction attendue');
  }
  const p = current(state);
  if (!p || p.id !== playerId) return fail(state, 'pas ton tour');
  if (action.type === 'END_TURN') { endTurn(state); return { ok: true, state }; }
  if (state.actionsLeft <= 0) return fail(state, "plus d'action");
  let res;
  switch (action.type) {
    case 'BUY_VOTANT': res = doBuy(state, p, action.marketIndex); break;
    case 'PLAY_FINANCE': res = doFinance(state, p, action.handIndex); break;
    case 'PLAY_FINANCE_CLEAN': res = doFinanceClean(state, p, action.handIndex, action.front); break;
    case 'PLAY_PROTECT': res = doProtect(state, p, action.handIndex); break;
    case 'PLAY_BLANCH': res = doBlanch(state, p, action.handIndex); break;
    case 'PLAY_DENOUNCE': res = doDenounce(state, p, action.handIndex, action.targetId, action.front); break;
    case 'PLAY_STEAL': res = doSteal(state, p, action.handIndex, action.targetId); break;
    case 'PLAY_COUP': res = doCoup(state, p, action.handIndex); break;
    case 'RECYCLE': res = doRecycle(state, p, action.handIndexes); break;
    default: res = fail(state, 'action inconnue');
  }
  if (res && res.ok && !state.over && state.players.some(q => q.voix >= state.X)) state.endingTriggered = true;
  return res;
}
function fail(state, why) { return { ok: false, error: why, state }; }
function spend(state) { state.actionsLeft = Math.max(0, state.actionsLeft - 1); }

function doBuy(state, p, idx) {
  const c = state.market[idx]; if (!c) return fail(state, 'bloc absent du marché');
  const chk = canBuy(p, c); if (!chk.ok) return fail(state, 'achat impossible: ' + chk.why);
  let note = '';
  if (p.incoherenceReady && incompatWith(c.bloc, p.blocs)) { p.incoherenceReady = false; p.financ.Presse.push({ clean: false, amount: 3 }); note = ' (incohérence)'; }
  p.money -= chk.cost; p.discount = false;
  if (!p.blocs.includes(c.bloc)) p.blocs.push(c.bloc);
  p.votants.push({ nom: c.nom, bloc: c.bloc, voix: c.voix });
  state.market.splice(idx, 1); refillMarket(state); recompute(p);
  log(state, `${p.name} achète ${c.nom} (+${c.voix} voix${note})`, 'buy');
  spend(state); return { ok: true, state };
}
function doFinance(state, p, i) {
  const card = p.hand[i]; if (!card || card.kind !== 'cor') return fail(state, 'pas une carte corruption');
  p.money += card.gain; p.financ[card.front].push({ clean: false, amount: card.gain });
  log(state, `${p.name} se finance (+${card.gain} M€, carte posée)`, 'finance');
  discardFromHand(state, p, i); spend(state); return { ok: true, state };
}
function doFinanceClean(state, p, i, front) {
  const card = p.hand[i]; if (!card || card.kind !== 'clean') return fail(state, 'pas un financement propre');
  const fr = FRONTS.includes(front) ? front : decoyFront(p);
  p.money += card.gain; p.financ[fr].push({ clean: true, amount: card.gain });
  log(state, `${p.name} se finance (+${card.gain} M€, carte posée)`, 'finance');
  discardFromHand(state, p, i); spend(state); return { ok: true, state };
}
function decoyFront(p) { const withSale = FRONTS.filter(fr => p.financ[fr].some(c => !c.clean)); if (withSale.length) return withSale.sort((a, b) => frontCount(p, b) - frontCount(p, a))[0]; return FRONTS.slice().sort((a, b) => frontCount(p, a) - frontCount(p, b))[0]; }
function doProtect(state, p, i) {
  const card = p.hand[i]; if (!card || card.kind !== 'pro') return fail(state, 'pas une protection');
  if (CONFIG.protectCost > p.money) return fail(state, "pas assez d'argent");
  p.money -= CONFIG.protectCost; if (!p.protect.includes(card.front)) p.protect.push(card.front);
  log(state, `${p.name} protège ${card.front}`, 'protect');
  discardFromHand(state, p, i); spend(state); return { ok: true, state };
}
function doBlanch(state, p, i) {
  const card = p.hand[i]; if (!card || card.kind !== 'bla') return fail(state, 'pas un blanchiment');
  const big = biggestDirty(p); if (!big) return fail(state, 'rien à blanchir');
  if (CONFIG.blanchCost > p.money) return fail(state, "pas assez d'argent");
  p.money -= CONFIG.blanchCost; p.financ[big.front][big.idx].clean = true;
  log(state, `${p.name} blanchit une carte (${big.front})`, 'blanch');
  discardFromHand(state, p, i); spend(state); return { ok: true, state };
}
function doDenounce(state, p, i, targetId, front) {   // frappe TOUTE la corruption du front
  const card = p.hand[i]; if (!card || card.kind !== 'den') return fail(state, 'pas une dénonciation');
  const t = state.players.find(x => x.id === targetId); if (!t || t === p) return fail(state, 'cible invalide');
  if (CONFIG.denounceCost > p.money) return fail(state, "pas assez d'argent");
  p.money -= CONFIG.denounceCost; p.denounceLaunched++;
  discardFromHand(state, p, i); spend(state);
  const ei = t.hand.findIndex(c => c.kind === 'coup' && c.e === 'element');
  const blocked = t.protect.includes(front) || t.attackedThisRound;
  const saleSum = blocked ? 0 : saleSumFront(t, front);   // somme de TOUTES les cartes sales du front
  if (!blocked && saleSum > 0 && ei >= 0) { discardFromHand(state, t, ei); log(state, `${p.name} dénonce ${t.name} (${front})… contré (Élément de langage) !`, 'denounce'); return { ok: true, state }; }
  if (saleSum <= 0) {   // RATÉ (que du propre / vide / protégé)
    p.failedDenounce.push(t.id + ':' + front);   // l'accusateur retient son erreur (IA)
    const amende = Math.min(CONFIG.amende, p.money); p.money -= amende; t.money += amende;
    log(state, `${p.name} dénonce ${t.name} (${front})… RATÉ : −${amende} M€ d'amende à ${t.name}`, 'denounce');
    return { ok: true, state };
  }
  // TOUCHÉ : la cible perd TOUTE la corruption du front (les cartes sales sautent)
  t.financ[front] = t.financ[front].filter(c => c.clean);
  let byVotants = 0;
  if (t.money >= saleSum) t.money -= saleSum;
  else { const shortfall = saleSum - t.money; t.money = 0; const need = Math.ceil(shortfall / 2); if (t.votants.length) { state.pending = { kind: 'debt', playerId: t.id, voixNeeded: need }; byVotants = need; } }
  t.attackedThisRound = true; recompute(t);
  log(state, `${p.name} dénonce ${t.name} (${front}) : −${saleSum} M€${byVotants ? ` → rend des votants` : ''}`, 'denounce');
  return { ok: true, state };
}
function doPayDebt(state, p, idxs) {
  if (!state.pending || state.pending.kind !== 'debt' || state.pending.playerId !== p.id) return fail(state, 'pas de dette');
  let list = (idxs || []).filter(i => i >= 0 && i < p.votants.length).sort((a, b) => b - a);
  if (!list.length) { if (!p.votants.length) { state.pending = null; recompute(p); return { ok: true, state }; } return fail(state, 'choisis au moins un votant'); }
  let need = state.pending.voixNeeded;
  for (const i of list) { if (need <= 0) break; need -= returnVotant(state, p, i); }
  refillMarket(state); recompute(p);
  if (need <= 0 || p.votants.length === 0) state.pending = null; else state.pending.voixNeeded = need;
  log(state, `${p.name} rend des votants (scandale)`, 'denounce');
  return { ok: true, state };
}
function doSteal(state, p, i, targetId) {   // débauchage / OPA : la VICTIME choisit le bloc
  const card = p.hand[i]; if (!card || card.kind !== 'steal') return fail(state, 'pas une carte de vol');
  const t = state.players.find(x => x.id === targetId); if (!t || t === p) return fail(state, 'cible invalide');
  if (t.attackedThisRound) return fail(state, 'cible déjà attaquée ce tour');
  if (!cedeableBlocs(state, t, { attackerId: p.id, mode: card.e }).length) return fail(state, 'aucun bloc cédable');
  discardFromHand(state, p, i); spend(state);
  t.attackedThisRound = true;
  state.pending = { kind: 'cede', playerId: t.id, attackerId: p.id, mode: card.e };
  log(state, `${p.name} ${card.e === 'opa' ? 'lance une OPA sur' : 'débauche'} ${t.name}…`, 'denounce');
  return { ok: true, state };
}
function doCede(state, victim, bloc) {   // la victime cède un bloc à l'attaquant
  if (!state.pending || state.pending.kind !== 'cede' || state.pending.playerId !== victim.id) return fail(state, 'pas de vol en cours');
  const legal = cedeableBlocs(state, victim, state.pending);
  if (!legal.includes(bloc)) return fail(state, 'bloc non cédable');
  const attacker = state.players.find(x => x.id === state.pending.attackerId);
  const vi = victim.votants.findIndex(v => v.bloc === bloc);
  if (vi >= 0) victim.votants.splice(vi, 1);
  const bi = victim.blocs.indexOf(bloc); if (bi >= 0) victim.blocs.splice(bi, 1);
  const src = VOTANT_BY_BLOC[bloc];
  if (attacker && !attacker.blocs.includes(bloc)) { attacker.blocs.push(bloc); attacker.votants.push({ nom: src.nom, bloc, voix: src.voix }); }
  recompute(victim); if (attacker) recompute(attacker);
  state.pending = null;
  log(state, `${victim.name} cède ${src.nom} à ${attacker ? attacker.name : '?'}`, 'denounce');
  if (!state.over && attacker && attacker.voix >= state.X) state.endingTriggered = true;
  return { ok: true, state };
}
function doCoup(state, p, i) {
  const card = p.hand[i]; if (!card || card.kind !== 'coup') return fail(state, 'pas un coup');
  if (card.e === 'element') return fail(state, "l'Élément de langage se joue en réaction");
  if (card.e === 'remise') { p.discount = true; log(state, `${p.name} : remise prête`, 'coup'); }
  else if (card.e === 'incoherence') { p.incoherenceReady = true; log(state, `${p.name} prépare une incohérence`, 'coup'); }
  else if (card.e === 'promesse') { p.votants.push({ nom: 'Promesse intenable', bloc: null, voix: 3 }); p.financ.Presse.push({ clean: false, amount: 3 }); recompute(p); log(state, `${p.name} : promesse intenable (+3 voix)`, 'buy'); }
  else if (card.e === 'renvoi') { p.money += 3; discardFromHand(state, p, i); drawUp(state, p); log(state, `${p.name} : renvoi d'ascenseur (+3 M€, pioche 1)`, 'coup'); spend(state); return { ok: true, state }; }
  discardFromHand(state, p, i); spend(state); return { ok: true, state };
}
function doRecycle(state, p, idxs) {
  const list = (idxs || []).filter(i => i >= 0 && i < p.hand.length).sort((a, b) => b - a).slice(0, 2);
  if (!list.length) return fail(state, 'aucune carte à recycler');
  for (const i of list) discardFromHand(state, p, i);
  drawUp(state, p);
  log(state, `${p.name} recycle ${list.length} carte(s)`, 'recycle');
  spend(state); return { ok: true, state };
}

/* ------------------------------- ÉTAT PUBLIC ------------------------------- */
function publicState(state, playerId) {
  return {
    nPlayers: state.nPlayers, X: state.X, turn: state.turn, guardrail: CONFIG.guardrail,
    currentPlayerId: state.over ? null : current(state).id,
    actionsLeft: state.actionsLeft, over: state.over, winner: state.winner, endReason: state.endReason,
    finalRound: state.endingTriggered, pending: state.pending ? { kind: state.pending.kind, playerId: state.pending.playerId, attackerId: state.pending.attackerId, mode: state.pending.mode, voixNeeded: state.pending.voixNeeded } : null,
    deckCount: state.deck.length, discardCount: state.discard.length, votantsLeft: state.votantDeck.length,
    market: state.market.map(c => ({ nom: c.nom, bloc: c.bloc, tier: c.tier, cost: c.cost, voix: c.voix, family: c.family })),
    log: state.log.slice(0, 60),
    players: state.players.map(p => {
      const mine = p.id === playerId, reveal = mine || state.over;
      return {
        id: p.id, name: p.name, voix: p.voix, money: p.money,
        blocs: p.blocs.slice(), protect: p.protect.slice(),
        votants: p.votants.map(v => ({ nom: v.nom, bloc: v.bloc, voix: v.voix, family: v.bloc ? FAMILIES[v.bloc] : null, fidele: v.bloc ? isFidele(v.bloc, p.blocs) : false })),
        coalitions: completeFamilies(p.blocs),
        financCount: Object.fromEntries(FRONTS.map(f => [f, p.financ[f].length])),
        handCount: p.hand.length, attackedThisRound: p.attackedThisRound,
        hand: mine ? p.hand.slice() : undefined,
        financ: mine ? { Justice: p.financ.Justice.slice(), Presse: p.financ.Presse.slice(), Finances: p.financ.Finances.slice() } : undefined,
        forbiddenFamily: reveal ? p.forbiddenFamily : undefined,
        partyName: reveal ? PARTY_BY_FAMILY[p.forbiddenFamily] : undefined,
        finalScore: state.over ? finalScore(p) : undefined,
      };
    }),
  };
}

/* ----------------------------------- IA ------------------------------------ */
function debtChoice(p, need) {
  const idx = p.votants.map((_, i) => i).sort((a, b) => { const fa = p.votants[a].bloc && isFidele(p.votants[a].bloc, p.blocs) ? 1 : 0; const fb = p.votants[b].bloc && isFidele(p.votants[b].bloc, p.blocs) ? 1 : 0; if (fa !== fb) return fa - fb; return p.votants[a].voix - p.votants[b].voix; });
  const pick = []; let acc = 0; for (const i of idx) { pick.push(i); acc += p.votants[i].voix; if (acc >= need) break; }
  const last = pick[pick.length - 1]; if (last != null && p.votants[last].voix >= need) return [last];
  return pick;
}
function botChooseAction(state, playerId) {
  if (state.pending && state.pending.playerId === playerId) {
    const p = state.players.find(x => x.id === playerId);
    if (state.pending.kind === 'debt') return { type: 'PAY_DEBT', votantIndexes: debtChoice(p, state.pending.voixNeeded) };
    const cand = cedeableBlocs(state, p, state.pending); // cède le moins précieux
    const bloc = cand.slice().sort((a, b) => VOTANT_BY_BLOC[a].voix - VOTANT_BY_BLOC[b].voix)[0];
    return { type: 'CEDE_BLOC', bloc };
  }
  const p = current(state);
  if (!p || p.id !== playerId || state.over || state.pending || state.actionsLeft <= 0) return { type: 'END_TURN' };
  const others = state.players.filter(q => q !== p);
  const myMax = Math.max(...state.players.map(q => q.voix));
  const iLead = p.voix >= myMax - 3;
  // 1. défense si je mène et exposé
  const myExposed = exposedSaleFronts(p);
  if (iLead && myExposed.length) {
    const pi = p.hand.findIndex(c => c.kind === 'pro' && myExposed.includes(c.front)); if (pi >= 0 && CONFIG.protectCost <= p.money) return { type: 'PLAY_PROTECT', handIndex: pi };
    const big = biggestDirty(p); if (big && big.amount >= 6) { const bi = p.hand.findIndex(c => c.kind === 'bla'); if (bi >= 0 && CONFIG.blanchCost <= p.money) return { type: 'PLAY_BLANCH', handIndex: bi }; }
  }
  // 2. dénoncer le meneur sur son front le plus chargé (≥2 cartes = meilleur pari, hors ratés connus)
  const di = p.hand.findIndex(c => c.kind === 'den');
  if (di >= 0 && CONFIG.denounceCost <= p.money) {
    const tgt = others.filter(q => !q.attackedThisRound && (q.voix >= state.X - 10 || q.voix >= p.voix + 5))
      .map(q => { const fr = FRONTS.filter(f => !q.protect.includes(f) && !p.failedDenounce.includes(q.id + ':' + f)).sort((a, b) => frontCount(q, b) - frontCount(q, a))[0]; return { q, fr, n: fr ? frontCount(q, fr) : 0 }; })
      .filter(x => x.fr && x.n >= 2).sort((a, b) => b.q.voix - a.q.voix)[0];
    if (tgt) return { type: 'PLAY_DENOUNCE', handIndex: di, targetId: tgt.q.id, front: tgt.fr };
  }
  // 3. voler un bloc au meneur
  const si = p.hand.findIndex(c => c.kind === 'steal');
  if (si >= 0) { const card = p.hand[si]; const tgt = others.filter(q => !q.attackedThisRound && q.voix >= p.voix && cedeableBlocs(state, q, { attackerId: p.id, mode: card.e }).length).sort((a, b) => b.voix - a.voix)[0]; if (tgt) return { type: 'PLAY_STEAL', handIndex: si, targetId: tgt.id }; }
  // 4. promesse si proche du seuil
  const pri = p.hand.findIndex(c => c.kind === 'coup' && c.e === 'promesse'); if (pri >= 0 && p.voix >= state.X - 6) return { type: 'PLAY_COUP', handIndex: pri };
  // 5. acheter le meilleur bloc (favorise les coalitions ; respecte famille interdite + incompat)
  let best = -1, bestScore = -1;
  state.market.forEach((c, i) => { const chk = canBuy(p, c); if (!chk.ok) return; const marg = coalitionBonus(p.blocs.concat([c.bloc])) - coalitionBonus(p.blocs); const eff = c.voix + marg; const sc = eff / Math.max(1, chk.cost) + eff * 0.03; if (sc > bestScore) { bestScore = sc; best = i; } });
  if (best >= 0) return { type: 'BUY_VOTANT', marketIndex: best };
  // 6. se financer si pauvre
  if (p.money < 10) { if (!iLead) { const ci = p.hand.findIndex(c => c.kind === 'cor'); if (ci >= 0) return { type: 'PLAY_FINANCE', handIndex: ci }; } const cl = p.hand.findIndex(c => c.kind === 'clean'); if (cl >= 0) return { type: 'PLAY_FINANCE_CLEAN', handIndex: cl }; const ci2 = p.hand.findIndex(c => c.kind === 'cor'); if (ci2 >= 0) return { type: 'PLAY_FINANCE', handIndex: ci2 }; }
  // 7. recycler l'inutile
  const junk = []; for (let k = p.hand.length - 1; k >= 0 && junk.length < 2; k--) { const c = p.hand[k]; if ((c.kind === 'coup' && c.e === 'renvoi') || (c.kind === 'pro' && !myExposed.includes(c.front))) junk.push(k); }
  if (junk.length) return { type: 'RECYCLE', handIndexes: junk };
  // 8. financer sinon finir
  if (p.money < 14) { const ci = p.hand.findIndex(c => c.kind === 'cor' || c.kind === 'clean'); if (ci >= 0) return p.hand[ci].kind === 'cor' ? { type: 'PLAY_FINANCE', handIndex: ci } : { type: 'PLAY_FINANCE_CLEAN', handIndex: ci }; }
  return { type: 'END_TURN' };
}
function playOutTurn(state, playerId) { let g = 0; while (!state.over && !state.pending && current(state).id === playerId && g++ < 80) { const a = botChooseAction(state, playerId); applyAction(state, playerId, a); if (a.type === 'END_TURN') break; } }
function autoStep(state) { if (state.over) return; if (state.pending) { const pid = state.pending.playerId; applyAction(state, pid, botChooseAction(state, pid)); return; } playOutTurn(state, current(state).id); }

/* -------------------------- BAC À SABLE D'ÉQUILIBRAGE ----------------------- */
function simulate(nPlayers, nGames = 1000, seed = 12345, X = null) {
  let totalTurns = 0, bySeuil = 0, totalWinVoix = 0, totalDen = 0; const seatWins = Array(nPlayers).fill(0);
  for (let g = 0; g < nGames; g++) {
    const st = createGame({ nPlayers, seed: (seed + g * 2654435761) >>> 0, X: X != null ? X : undefined });
    let guard = 0; while (!st.over && guard++ < 3000) autoStep(st);
    totalTurns += st.turn; if (st.endReason === 'seuil') bySeuil++;
    seatWins[st.winner]++; totalWinVoix += finalScore(st.players[st.winner]); totalDen += st.players.reduce((a, p) => a + p.denounceLaunched, 0);
  }
  const pct = seatWins.map(w => 100 * w / nGames);
  return {
    nPlayers, seuil: X != null ? X : seuil(nPlayers),
    avgManches: +(totalTurns / nGames).toFixed(1),
    avgTours: +(totalTurns * nPlayers / nGames).toFixed(1),   // tours totaux (manches × joueurs)
    pctSeuil: Math.round(100 * bySeuil / nGames),
    seatSpread: +(Math.max(...pct) - Math.min(...pct)).toFixed(1),
    avgWinVoix: +(totalWinVoix / nGames).toFixed(1),
    avgDenonc: +(totalDen / nGames).toFixed(1),
  };
}
function calibrate(nGames = 800) {
  const out = {};
  for (const N of [2, 3, 4, 5, 6]) { let best = null; for (let X = 24; X <= 70; X += 2) { const r = simulate(N, nGames, 9000 + N, X); if (r.pctSeuil < 90) continue; const err = Math.abs(r.avgTours - 44); if (!best || err < best.err) best = { X, err, ...r }; } out[N] = best; }
  return out;
}

/* -------------------------------- EXPORTS ---------------------------------- */
const API = {
  CONFIG, FRONTS, INCOMPAT, VOTANTS, COMBINES_DEF, FAMILIES, FAMILY_DEF, FAMILY_LIST, PARTY_BY_FAMILY,
  seuil, coalitionBonus, completeFamilies, isFidele, cedeableBlocs,
  createGame, legalActions, applyAction, publicState,
  botChooseAction, playOutTurn, autoStep, simulate, calibrate,
};
if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (typeof globalThis !== 'undefined') globalThis.CaisseNoire = API;

if (typeof require !== 'undefined' && require.main === module) {
  const arg = process.argv[2];
  if (arg === 'calibrate') {
    console.log('Caisse Noire v0.7 — calibration (cible ~44 tours totaux, ≥90% par le seuil) :');
    const c = calibrate(600);
    for (const N of [2, 3, 4, 5, 6]) { const r = c[N]; console.log(r ? `  ${N}j  seuil=${r.X}  tours=${r.avgTours}  manches=${r.avgManches}  %seuil=${r.pctSeuil}  écart=${r.seatSpread}  dénonc=${r.avgDenonc}` : `  ${N}j  aucun ≥90% trouvé`); }
  } else {
    console.log('Caisse Noire v0.7 — rapport (seuil fixe 45 voix) :');
    for (const N of [2, 3, 4, 5, 6]) { const r = simulate(N, 800); console.log(`  ${N}j  seuil=${r.seuil}  toursTotaux=${r.avgTours}  manches=${r.avgManches}  %seuil=${r.pctSeuil}  écart=${r.seatSpread}  voixVainq=${r.avgWinVoix}  dénonc=${r.avgDenonc}`); }
  }
}
