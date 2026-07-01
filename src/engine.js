/* =============================================================================
 * CAISSE NOIRE — Moteur de jeu v0.6 « corruption cachée » (headless, source de vérité)
 * -----------------------------------------------------------------------------
 * - Aucune dépendance, aucun DOM. Tourne en Node (serveur) ET navigateur.
 * - Déterministe : tout l'aléatoire vient d'une RNG seedée (state.rng) => rejouable.
 * - État 100% sérialisable en JSON (pas de Set/Map) => sync réseau facile.
 *
 * MODÈLE v0.6 (règles : ../docs/REGLES.md §16 ; contenu : ../catalogue-v0.6.html) :
 *   - 3 FRONTS : Justice · Presse · Finances (la Rue est retirée).
 *   - CORRUPTION CACHÉE : financement (propre ET sale) joué FACE CACHÉE dans le casier.
 *     Les autres voient l'argent + le NOMBRE de cartes par front, jamais le contenu.
 *   - SALE : 3 fronts × montants 3/6/9 (mêmes montants partout => aucune déduction).
 *     Montant gagné = montant perdu si dénoncé (100%).
 *   - PROPRE (leurre) : Don/Cotisations 3, Meeting/Subvention 6 (plafond 6). Jamais dénonçable.
 *   - DÉNONCIATION = PARI sur l'argent : cible + 1 front. Touché => la cible perd le TOTAL
 *     sale du front (cash, sinon REND des votants de SON choix => perd des voix, blocs au marché).
 *     Raté => l'accusateur perd sa mise + AMENDE 3 versée à la cible.
 *   - VOIX = somme des votants + bonus de COALITION (8 familles) + objectif (à la fin).
 *     Coalition complète (≥3 d'une famille) => blocs FIDÈLES / involables.
 *   - VOL (Débauchage/OPA) : transfert de voix sur blocs ISOLÉS uniquement.
 *   - RÔLE SECRET = pouvoir (parti) + objectif caché (+3 voix si rempli, révélé à la fin).
 *   - FIN : atteindre le seuil VERROUILLE la manche finale ; on la termine ; PUIS le plus de
 *     voix gagne (même si le meneur est repassé sous le seuil). 1 attaque subie / manche.
 *
 * SEUIL : 30 (plat, 2→6 joueurs) — calibré par simulate()/calibrate().
 *
 * API : createGame / legalActions / applyAction / publicState / botChooseAction / seuil / simulate
 * ACTIONS : BUY_VOTANT · PLAY_FINANCE · PLAY_FINANCE_CLEAN{front?} · PLAY_PROTECT · PLAY_BLANCH ·
 *           PLAY_DENOUNCE{targetId,front} · PLAY_STEAL{targetId,blocCible?} · PLAY_COUP ·
 *           PAY_DEBT{votantIndexes} (réaction du dénoncé) · RECYCLE · END_TURN
 * ============================================================================= */

'use strict';

/* ----------------------------- CONFIG (à calibrer) ------------------------- */
const CONFIG = {
  start: 7, income: 3, hand: 5, actions: 2,
  protectCost: 5, blanchCost: 3, denounceCost: 2, amende: 3,   // amende sur dénonciation ratée
  debauchageCost: 2, debauchageDelta: 2,
  opaCost: 4, opaDelta: 3,
  objectiveBonus: 3,
  guardrail: 16,
};
// Seuil de victoire — CALIBRÉ par simulation v0.6 : seuil PLAT de 30 pour N=2..6
// (~11 manches, ≥98% de victoires par le seuil). Les bonus de coalition compensent le
// partage de l'électorat, donc la pente 40−2N n'est pas nécessaire (elle rendait 2j trop long).
const SEUIL = { 2: 30, 3: 30, 4: 30, 5: 30, 6: 30 };
function seuil(nPlayers) { return SEUIL[nPlayers] != null ? SEUIL[nPlayers] : 30; }
function marketVisibleFor(_n) { return 8; }

const FRONTS = ['Justice', 'Presse', 'Finances'];   // la Rue est retirée en v0.6

/* ----------------------- INCOMPATIBILITÉS (par bloc) ----------------------- */
const HARD = [['Intégristes', 'LGBT'], ['Patronat', 'CGT']];
const SOFT = [
  ['Animalistes', 'Chasseurs'], ['Animalistes', 'Pétrole'], ['Animalistes', 'Agriculteurs'],
  ['Souverainistes', 'Diaspora'], ['Antivax', 'Soignants'], ['Bobos', 'Chasseurs'], ['Bobos', 'Pétrole'],
  ['Flics', 'Complotistes'], ['Complotistes', 'Profs'], ['Intégristes', 'Influenceurs'],
  ['Patronat', 'Fonctionnaires'], ['Retraités', 'Étudiants'],
  ['Ubers', 'Taxis'], ['Masculinistes', 'Éveillés'], ['Éveillés', 'Souverainistes'],
  ['Militaires', 'Intermittents'], ['Chômeurs', 'Patronat'], ['Rentiers', 'CGT'], ['Héritiers', 'CGT'],
  ['Pharma', 'Antivax'], ['Pêcheurs', 'Animalistes'], ['Pêcheurs', 'Bobos'], ['Banquiers', 'CGT'],
  ['Crypto', 'Banquiers'], ['Libertariens', 'Fonctionnaires'], ['Libertariens', 'CGT'], ['Startuppers', 'CGT'],
  ['Motards', 'Bobos'], ['Promoteurs', 'Néoruraux'], ['Survivalistes', 'Éveillés'],
];
function conflictsIn(pairs, bloc, owned) {
  for (const [a, b] of pairs) { if (bloc === a && owned.includes(b)) return b; if (bloc === b && owned.includes(a)) return a; }
  return null;
}
const hardConflict = (bloc, owned) => conflictsIn(HARD, bloc, owned);
const softConflict = (bloc, owned) => conflictsIn(SOFT, bloc, owned);

/* ------------------------- FAMILLES & COALITIONS (§15.1) ------------------- */
const FAMILY_DEF = {
  'Le Capital':            ['Patronat', 'Banquiers', 'Rentiers', 'Héritiers', 'Promoteurs'],
  'Le Bloc Public':        ['CGT', 'Fonctionnaires', 'Soignants', 'Profs'],
  "L'Ordre & le Terroir":  ['Flics', 'Militaires', 'Chasseurs', 'Agriculteurs', 'Pêcheurs'],
  'La Start-up Nation':    ['Startuppers', 'Crypto', 'Influenceurs', 'Libertariens', 'Gamers'],
  "L'Écolo-Bobo":          ['Animalistes', 'Bobos', 'Néoruraux', 'Éveillés'],
  "L'Identité":            ['Souverainistes', 'Intégristes', 'Masculinistes', 'Survivalistes'],
  'Les Précaires':         ['Chômeurs', 'Intermittents', 'Étudiants', 'Ubers'],
  'La Mobilité':           ['Taxis', 'Routiers', 'Motards'],
};
const FAMILIES = {};
for (const fam in FAMILY_DEF) for (const bloc of FAMILY_DEF[fam]) FAMILIES[bloc] = fam;
function familyCounts(blocs) { const c = {}; for (const b of blocs) { const f = FAMILIES[b]; if (f) c[f] = (c[f] || 0) + 1; } return c; }
function coalitionBonus(blocs) { const c = familyCounts(blocs); let b = 0; for (const f in c) if (c[f] >= 3) b += c[f]; return b; }
function completeFamilies(blocs) { const c = familyCounts(blocs); return Object.keys(c).filter(f => c[f] >= 3); }
function isFidele(bloc, blocs) { const f = FAMILIES[bloc]; if (!f) return false; return familyCounts(blocs)[f] >= 3; }

/* --------------------------- VOTANTS (42 uniques) -------------------------- */
const VOTANTS = [
  ['Influenceurs','Influenceurs','Petit',4,2],['Étudiants','Étudiants','Petit',4,2],
  ['Animalistes','Animalistes','Petit',4,2],['Anti-vax','Antivax','Petit',4,2],
  ['Gamers','Gamers','Petit',4,2],['Bobos urbains','Bobos','Petit',4,2],
  ['Complotistes','Complotistes','Petit',4,2],['Masculinistes','Masculinistes','Petit',4,2],
  ['Intermittents','Intermittents','Petit',4,2],['Chauffeurs VTC','Ubers','Petit',4,2],
  ['Les Éveillés','Éveillés','Petit',4,2],['Crypto-bros','Crypto','Petit',4,2],
  ['Survivalistes','Survivalistes','Petit',4,2],['Néo-ruraux','Néoruraux','Petit',4,2],
  ['Libertariens','Libertariens','Petit',4,2],
  ['Policiers','Flics','Moyen',8,4],['Agriculteurs','Agriculteurs','Moyen',8,4],
  ['Taxis','Taxis','Moyen',8,4],['Francs-maçons','Maçons','Moyen',8,4],
  ['Chasseurs','Chasseurs','Moyen',8,4],['Soignants','Soignants','Moyen',8,4],
  ['Profs','Profs','Moyen',8,4],['Diaspora','Diaspora','Moyen',8,4],
  ['Militaires','Militaires','Moyen',8,4],['Chômeurs','Chômeurs','Moyen',8,4],
  ['Rentiers','Rentiers','Moyen',8,4],['Héritiers','Héritiers','Moyen',8,4],
  ['Routiers','Routiers','Moyen',8,4],['Motards','Motards','Moyen',8,4],
  ['Start-uppers','Startuppers','Moyen',8,4],['Pêcheurs','Pêcheurs','Moyen',8,4],
  ['Patronat','Patronat','Gros',12,6],['La CGT','CGT','Gros',12,6],
  ['Intégristes','Intégristes','Gros',12,6],['Fonctionnaires','Fonctionnaires','Gros',12,6],
  ['Lobby pétrolier','Pétrole','Gros',12,6],['Souverainistes','Souverainistes','Gros',12,6],
  ['Communauté LGBT','LGBT','Gros',12,6],['Banquiers','Banquiers','Gros',12,6],
  ['Promoteurs immobiliers','Promoteurs','Gros',12,6],['Lobby pharmaceutique','Pharma','Gros',12,6],
  ['Retraités','Retraités','Gros',13,7],
].map(([nom, bloc, tier, cost, voix]) => ({ nom, bloc, tier, cost, voix }));
const VOTANT_BY_BLOC = {}; for (const v of VOTANTS) VOTANT_BY_BLOC[v.bloc] = v;

/* ------------------- COMBINES : pioche commune v0.6 ------------------------ */
/* kinds : cor (sale), clean (propre), den, pro, bla, steal, coup */
const COMBINES_DEF = [
  // SALE — 3 fronts × 3/6/9 (gain = montant perdu si dénoncé)
  { kind:'cor', front:'Justice',  nom:'Petit pot-de-vin',        gain:3, n:4 },
  { kind:'cor', front:'Justice',  nom:"Trafic d'influence",      gain:6, n:3 },
  { kind:'cor', front:'Justice',  nom:'Caisse noire judiciaire', gain:9, n:2 },
  { kind:'cor', front:'Presse',   nom:'Petits cadeaux',          gain:3, n:4 },
  { kind:'cor', front:'Presse',   nom:'Ménage médiatique',       gain:6, n:3 },
  { kind:'cor', front:'Presse',   nom:'Voyage offert',           gain:9, n:2 },
  { kind:'cor', front:'Finances', nom:'Note de frais maquillée', gain:3, n:4 },
  { kind:'cor', front:'Finances', nom:'Rétrocommission',         gain:6, n:3 },
  { kind:'cor', front:'Finances', nom:'Évasion fiscale',         gain:9, n:2 },
  // PROPRE — leurre, plafond 6
  { kind:'clean', nom:"Don d'un militant",     gain:3, n:4 },
  { kind:'clean', nom:'Cotisations du parti',  gain:3, n:4 },
  { kind:'clean', nom:'Meeting payant',        gain:6, n:3 },
  { kind:'clean', nom:'Subvention européenne', gain:6, n:3 },
  // Attaque & défense
  { kind:'den', nom:'Dénonciation', n:18 },
  { kind:'pro', nom:'Juge acheté',      front:'Justice',  n:4 },
  { kind:'pro', nom:'Médias corrompus', front:'Presse',   n:4 },
  { kind:'pro', nom:'Compte offshore',  front:'Finances', n:4 },
  { kind:'bla', nom:'Blanchiment', n:8 },
  { kind:'steal', e:'debauchage', nom:'Débauchage',     n:6 },
  { kind:'steal', e:'opa',        nom:'OPA électorale', n:3 },
  // Coups tactiques
  { kind:'coup', e:'element',     nom:'Élément de langage', n:4 },
  { kind:'coup', e:'remise',      nom:'Remise de campagne', n:3 },
  { kind:'coup', e:'incoherence', nom:'Incohérence',        n:3 },
  { kind:'coup', e:'promesse',    nom:'Promesse intenable', n:3 },
  { kind:'coup', e:'renvoi',      nom:"Renvoi d'ascenseur", n:2 },
];

/* ---------------------------- PARTIS (6 pouvoirs) -------------------------- */
const PARTIES = [
  { id:'meute',      nom:'La Meute',       sub:'médiatique',   ban:null,    bonus:'freePresse' },
  { id:'lumiere',    nom:'La Lumière',     sub:'religieux',    ban:'LGBT',  bonus:'integ+1' },
  { id:'cartel',     nom:'Le Cartel',      sub:'patronal',     ban:'CGT',   bonus:'income+1' },
  { id:'vague',      nom:'La Vague',       sub:'populiste',    ban:null,    bonus:'cheapDenounce' },
  { id:'verts',      nom:'Les Verts pâles',sub:'écolo',        ban:'Pétrole',bonus:'ecoloDiscount' },
  { id:'forteresse', nom:'La Forteresse',  sub:'souverainiste',ban:'Diaspora',bonus:'foreign+2' },
];

/* ----------------------- OBJECTIFS SECRETS (catalogue) --------------------- */
/* check(p, state) évalué au décompte final. +3 voix si rempli. */
const OBJECTIVES = [
  { id:'mains-propres', nom:'Les Mains Propres', desc:'Finir sans carte sale sur Justice',
    check:p => p.financ.Justice.every(c => c.clean) },
  { id:'faiseur-rois',  nom:'Le Faiseur de Rois', desc:'Détenir les Retraités à la fin',
    check:p => p.blocs.includes('Retraités') },
  { id:'pur-dur',       nom:'Le Pur et Dur', desc:'Avoir au moins une coalition complète',
    check:p => completeFamilies(p.blocs).length >= 1 },
  { id:'cameleon',      nom:'Le Caméléon', desc:'Posséder des blocs de 3 familles différentes',
    check:p => Object.keys(familyCounts(p.blocs)).length >= 3 },
  { id:'magouilleur',   nom:'Le Magouilleur', desc:'Jouer au moins 5 cartes de corruption',
    check:p => p.saleCardsPlayed >= 5 },
  { id:'procureur',     nom:'Le Procureur', desc:'Lancer le plus de dénonciations',
    check:(p, state) => p.denounceLaunched > 0 && p.denounceLaunched === Math.max(...state.players.map(q => q.denounceLaunched)) },
];

/* -------------------------------- RNG seedée ------------------------------- */
function nextRand(state) {
  let t = (state.rng += 0x6D2B79F5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle(arr, state) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(nextRand(state) * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

/* ------------------------------- CONSTRUCTION ------------------------------ */
function buildCombines() {
  const d = [];
  for (const c of COMBINES_DEF) { const { n, ...card } = c; for (let i = 0; i < n; i++) d.push({ ...card }); }
  return d;
}
function buildVotants() { return VOTANTS.map(v => ({ ...v })); }

function newPlayer(id, party, objective, name) {
  return {
    id, name: name || ('Joueur ' + (id + 1)),
    role: { partyId: party.id, objectiveId: objective.id },
    banBloc: party.ban,
    money: CONFIG.start, voix: 0, stolenVoix: 0,
    votants: [], blocs: [],
    financ: { Justice: [], Presse: [], Finances: [] },     // {clean,amount} face cachée
    protect: [], hand: [],
    attackedThisRound: false, saleCardsPlayed: 0, denounceLaunched: 0, failedDenounce: [],
    freePresseUsed: false, discount: false, incoherenceReady: false,
  };
}
function partyOf(p) { return PARTIES.find(x => x.id === p.role.partyId); }
function bonusOf(p) { const party = partyOf(p); return party ? party.bonus : null; }
function objectiveOf(p) { return OBJECTIVES.find(o => o.id === p.role.objectiveId); }

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
  const partyPool = shuffle(PARTIES.slice(), state);
  const objPool = shuffle(OBJECTIVES.slice(), state);
  for (let i = 0; i < nPlayers; i++) {
    const party = partyPool[i % partyPool.length];
    const obj = objPool[i % objPool.length];
    state.players.push(newPlayer(i, party, obj, (opts.names && opts.names[i]) || null));
  }
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

function recompute(p) {
  const v = p.votants.reduce((a, x) => a + x.voix, 0) + coalitionBonus(p.blocs) + p.stolenVoix;
  p.voix = Math.max(0, v);
}
function finalScore(p, state) { return p.voix + (objectiveOf(p).check(p, state) ? CONFIG.objectiveBonus : 0); }

function saleSumFront(p, fr) { return p.financ[fr].reduce((a, c) => a + (c.clean ? 0 : c.amount), 0); }
function frontCount(p, fr) { return p.financ[fr].length; }
function biggestDirty(p) {
  let best = null;
  for (const fr of FRONTS) p.financ[fr].forEach((c, i) => { if (!c.clean && (!best || c.amount > best.amount)) best = { front: fr, idx: i, amount: c.amount }; });
  return best;
}
function exposedSaleFronts(p) { return FRONTS.filter(fr => !p.protect.includes(fr) && saleSumFront(p, fr) > 0); }
function denounceCost(p) { return bonusOf(p) === 'cheapDenounce' ? 1 : CONFIG.denounceCost; }

function refillMarket(state) { while (state.market.length < state.marketVisible && state.votantDeck.length > 0) state.market.push(state.votantDeck.pop()); }
function drawUp(state, p) {
  while (p.hand.length < CONFIG.hand) {
    if (state.deck.length === 0) { if (state.discard.length === 0) break; state.deck = shuffle(state.discard, state); state.discard = []; }
    p.hand.push(state.deck.pop());
  }
}
function discardFromHand(state, p, idx) { state.discard.push(p.hand[idx]); p.hand.splice(idx, 1); }
function returnVotant(state, p, i) {   // rend 1 votant au marché, retire son bloc
  const v = p.votants.splice(i, 1)[0];
  if (v && v.bloc) { const bi = p.blocs.indexOf(v.bloc); if (bi >= 0) p.blocs.splice(bi, 1); if (VOTANT_BY_BLOC[v.bloc]) state.votantDeck.push({ ...VOTANT_BY_BLOC[v.bloc] }); }
  return v ? v.voix : 0;
}

/* ------------------------------- TOURS / MANCHES --------------------------- */
function startRound(state) {
  state.turn++;
  for (const p of state.players) p.attackedThisRound = false;
  const sp = (state.turn - 1) % state.nPlayers;
  state.order = state.players.slice(sp).concat(state.players.slice(0, sp));
  state.currentIdx = 0;
  beginTurn(state);
}
function beginTurn(state) {
  const p = current(state);
  let inc = CONFIG.income + (bonusOf(p) === 'income+1' ? 1 : 0);
  p.money += Math.max(0, inc);
  p.discount = false; p.incoherenceReady = false;
  state.actionsLeft = CONFIG.actions;
  log(state, `${p.name} encaisse +${inc} M€`, 'income');
}
function endTurn(state) {
  const p = current(state);
  drawUp(state, p);
  state.currentIdx++;
  if (state.currentIdx < state.nPlayers) { beginTurn(state); return; }
  // fin de manche
  if (state.endingTriggered) { endGame(state, 'seuil'); return; }                                  // manche finale verrouillée
  if (state.turn >= CONFIG.guardrail || (state.votantDeck.length === 0 && state.market.length === 0)) { endGame(state, 'gardefou'); return; }
  startRound(state);
}
function endGame(state, reason) {
  state.over = true; state.endReason = reason;
  const ranked = state.players.slice().sort((a, b) => finalScore(b, state) - finalScore(a, state) || b.money - a.money);
  state.winner = ranked[0].id;
  log(state, `🏆 ${ranked[0].name} gagne avec ${finalScore(ranked[0], state)} voix (${reason === 'seuil' ? 'le plus de voix en fin de manche' : 'garde-fou'})`, 'win');
}

/* ----------------------------- ACTIONS LÉGALES ----------------------------- */
function legalActions(state, playerId) {
  const acts = [];
  if (state.over) return acts;
  if (state.pending) {   // une dette est en cours : seul le dénoncé agit (PAY_DEBT)
    if (state.pending.playerId === playerId) { const t = state.players.find(p => p.id === playerId); acts.push({ type: 'PAY_DEBT', votantIndexes: debtChoice(t, state.pending.voixNeeded) }); }
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
    else if (card.kind === 'den' && denounceCost(p) <= p.money) {
      for (const t of state.players) if (t !== p && !t.attackedThisRound)
        for (const fr of FRONTS) if (!t.protect.includes(fr) && frontCount(t, fr) > 0) acts.push({ type: 'PLAY_DENOUNCE', handIndex: i, targetId: t.id, front: fr });
    } else if (card.kind === 'steal') {
      const cost = card.e === 'opa' ? CONFIG.opaCost : CONFIG.debauchageCost;
      if (cost <= p.money) for (const t of state.players) if (t !== p && !t.attackedThisRound) { const bc = t.blocs.find(b => !isFidele(b, t.blocs)); if (bc) acts.push({ type: 'PLAY_STEAL', handIndex: i, targetId: t.id, blocCible: bc }); }
    } else if (card.kind === 'coup' && card.e !== 'element') acts.push({ type: 'PLAY_COUP', handIndex: i });
  });
  acts.push({ type: 'RECYCLE', handIndexes: [0] });
  acts.push({ type: 'END_TURN' });
  return acts;
}
function canBuy(p, c) {
  let cost = c.cost;
  if (bonusOf(p) === 'ecoloDiscount' && (c.bloc === 'Animalistes' || c.bloc === 'Bobos')) cost -= 2;
  if (p.discount) cost = Math.max(0, cost - 3);
  if (cost > p.money) return { ok: false, why: 'argent' };
  if (p.banBloc === c.bloc) return { ok: false, why: 'interdit-parti' };
  if (hardConflict(c.bloc, p.blocs) && !p.incoherenceReady) return { ok: false, why: 'incompat-dure' };
  return { ok: true, cost };
}

/* ----------------------------- APPLIQUER UNE ACTION ------------------------ */
function applyAction(state, playerId, action) {
  if (state.over) return fail(state, 'partie terminée');
  if (state.pending) {   // priorité absolue : régler la dette de dénonciation
    if (action.type !== 'PAY_DEBT' || playerId !== state.pending.playerId) return fail(state, 'une dette de dénonciation doit être réglée');
    return doPayDebt(state, state.players.find(p => p.id === playerId), action.votantIndexes);
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
    case 'PLAY_STEAL': res = doSteal(state, p, action.handIndex, action.targetId, action.blocCible); break;
    case 'PLAY_COUP': res = doCoup(state, p, action.handIndex); break;
    case 'RECYCLE': res = doRecycle(state, p, action.handIndexes); break;
    default: res = fail(state, 'action inconnue');
  }
  if (res && res.ok && !state.over && state.players.some(q => q.voix >= state.X)) state.endingTriggered = true;   // verrou manche finale
  return res;
}
function fail(state, why) { return { ok: false, error: why, state }; }
function spend(state) { state.actionsLeft = Math.max(0, state.actionsLeft - 1); }

function doBuy(state, p, idx) {
  const c = state.market[idx]; if (!c) return fail(state, 'bloc absent du marché');
  const chk = canBuy(p, c); if (!chk.ok) return fail(state, 'achat impossible: ' + chk.why);
  let gain = c.voix, note = '';
  if (p.incoherenceReady) { p.incoherenceReady = false; p.financ.Presse.push({ clean: false, amount: 3 }); note = ' (incohérence)'; }
  else { const soft = softConflict(c.bloc, p.blocs); if (soft) { gain -= 1; note = ` (−1, coalition bancale avec ${soft})`; } }
  if (bonusOf(p) === 'integ+1' && c.bloc === 'Intégristes') gain += 1;
  p.money -= chk.cost; p.discount = false;
  if (!p.blocs.includes(c.bloc)) p.blocs.push(c.bloc);
  p.votants.push({ nom: c.nom, bloc: c.bloc, voix: gain });
  state.market.splice(idx, 1); refillMarket(state); recompute(p);
  log(state, `${p.name} achète ${c.nom} (+${gain} voix${note})`, 'buy');
  spend(state); return { ok: true, state };
}
function doFinance(state, p, i) {
  const card = p.hand[i]; if (!card || card.kind !== 'cor') return fail(state, 'pas une carte corruption');
  let g = card.gain + (bonusOf(p) === 'foreign+2' && card.front === 'Presse' ? 2 : 0);
  p.money += g; p.financ[card.front].push({ clean: false, amount: g }); p.saleCardsPlayed++;
  log(state, `${p.name} se finance (+${g} M€, carte posée)`, 'finance');
  discardFromHand(state, p, i); spend(state); return { ok: true, state };
}
function doFinanceClean(state, p, i, front) {
  const card = p.hand[i]; if (!card || card.kind !== 'clean') return fail(state, 'pas un financement propre');
  const fr = FRONTS.includes(front) ? front : decoyFront(p);
  p.money += card.gain; p.financ[fr].push({ clean: true, amount: card.gain });
  log(state, `${p.name} se finance (+${card.gain} M€, carte posée)`, 'finance');
  discardFromHand(state, p, i); spend(state); return { ok: true, state };
}
function decoyFront(p) {
  const withSale = FRONTS.filter(fr => saleSumFront(p, fr) > 0);
  if (withSale.length) return withSale.sort((a, b) => saleSumFront(p, b) - saleSumFront(p, a))[0];
  return FRONTS.slice().sort((a, b) => frontCount(p, a) - frontCount(p, b))[0];
}
function doProtect(state, p, i) {
  const card = p.hand[i]; if (!card || card.kind !== 'pro') return fail(state, 'pas une protection');
  let cost = CONFIG.protectCost;
  if (bonusOf(p) === 'freePresse' && card.front === 'Presse' && !p.freePresseUsed) { cost = 0; p.freePresseUsed = true; }
  if (cost > p.money) return fail(state, "pas assez d'argent");
  p.money -= cost; if (!p.protect.includes(card.front)) p.protect.push(card.front);
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
function doDenounce(state, p, i, targetId, front) {   // PARI sur l'argent
  const card = p.hand[i]; if (!card || card.kind !== 'den') return fail(state, 'pas une dénonciation');
  const t = state.players.find(x => x.id === targetId);
  if (!t || t === p) return fail(state, 'cible invalide');
  const cost = denounceCost(p); if (cost > p.money) return fail(state, "pas assez d'argent");
  p.money -= cost; p.denounceLaunched++;
  discardFromHand(state, p, i); spend(state);
  const ei = t.hand.findIndex(c => c.kind === 'coup' && c.e === 'element');
  const blocked = t.protect.includes(front) || t.attackedThisRound;
  const sum = blocked ? 0 : saleSumFront(t, front);
  if (!blocked && sum > 0 && ei >= 0) { discardFromHand(state, t, ei); log(state, `${p.name} dénonce ${t.name} (${front})… contré (Élément de langage) !`, 'denounce'); return { ok: true, state }; }
  if (sum <= 0) {   // RATÉ : mise perdue + amende versée à la cible
    p.failedDenounce.push(t.id + ':' + front);   // l'accusateur retient son erreur (IA)
    const amende = Math.min(CONFIG.amende, p.money); p.money -= amende; t.money += amende;
    log(state, `${p.name} dénonce ${t.name} (${front})… RATÉ : −${amende} M€ d'amende à ${t.name}`, 'denounce');
    return { ok: true, state };
  }
  // TOUCHÉ : la cible perd le total sale du front (cash, sinon rend des votants de son choix)
  let byVotants = 0;
  if (t.money >= sum) t.money -= sum;
  else { const shortfall = sum - t.money; t.money = 0; const need = Math.ceil(shortfall / 2);
    if (t.votants.length) { state.pending = { kind: 'debt', playerId: t.id, voixNeeded: need }; byVotants = need; } }
  t.financ[front] = t.financ[front].filter(c => c.clean); t.attackedThisRound = true; recompute(t);
  log(state, `${p.name} dénonce ${t.name} (${front}) : −${sum} M€${byVotants ? ` → ${t.name} doit rendre des votants` : ''}`, 'denounce');
  return { ok: true, state };
}
function doPayDebt(state, p, idxs) {   // le dénoncé choisit quels votants rendre
  if (!state.pending || state.pending.playerId !== p.id) return fail(state, 'pas de dette');
  let list = (idxs || []).filter(i => i >= 0 && i < p.votants.length).sort((a, b) => b - a);
  if (!list.length) { if (!p.votants.length) { state.pending = null; recompute(p); return { ok: true, state }; } return fail(state, 'choisis au moins un votant à rendre'); }
  let need = state.pending.voixNeeded;
  for (const i of list) { if (need <= 0) break; need -= returnVotant(state, p, i); }
  refillMarket(state); recompute(p);
  if (need <= 0 || p.votants.length === 0) state.pending = null; else state.pending.voixNeeded = need;
  log(state, `${p.name} rend des votants (scandale)`, 'denounce');
  return { ok: true, state };
}
function doSteal(state, p, i, targetId, blocCible) {
  const card = p.hand[i]; if (!card || card.kind !== 'steal') return fail(state, 'pas une carte de vol');
  const t = state.players.find(x => x.id === targetId);
  if (!t || t === p) return fail(state, 'cible invalide');
  if (t.attackedThisRound) return fail(state, 'cible déjà attaquée ce tour');
  const isolated = t.blocs.filter(b => !isFidele(b, t.blocs));
  if (!isolated.length) return fail(state, 'aucun bloc isolé (coalitions involables)');
  const cost = card.e === 'opa' ? CONFIG.opaCost : CONFIG.debauchageCost;
  const delta = card.e === 'opa' ? CONFIG.opaDelta : CONFIG.debauchageDelta;
  if (cost > p.money) return fail(state, "pas assez d'argent");
  p.money -= cost; t.stolenVoix -= delta; p.stolenVoix += delta; t.attackedThisRound = true;
  recompute(t); recompute(p);
  const bc = isolated.includes(blocCible) ? blocCible : isolated[0];
  log(state, `${p.name} ${card.e === 'opa' ? 'lance une OPA sur' : 'débauche'} ${t.name} (${bc}) : −${delta}/+${delta} voix`, 'denounce');
  discardFromHand(state, p, i); spend(state); return { ok: true, state };
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
    finalRound: state.endingTriggered, pending: state.pending ? { playerId: state.pending.playerId, voixNeeded: state.pending.voixNeeded } : null,
    deckCount: state.deck.length, discardCount: state.discard.length, votantsLeft: state.votantDeck.length,
    market: state.market.map(c => ({ nom: c.nom, bloc: c.bloc, tier: c.tier, cost: c.cost, voix: c.voix, family: FAMILIES[c.bloc] || null })),
    log: state.log.slice(0, 60),
    players: state.players.map(p => {
      const mine = p.id === playerId, reveal = mine || state.over;
      return {
        id: p.id, name: p.name, voix: p.voix, money: p.money,
        blocs: p.blocs.slice(), protect: p.protect.slice(),
        votants: p.votants.map(v => ({ nom: v.nom, bloc: v.bloc, voix: v.voix, fidele: v.bloc ? isFidele(v.bloc, p.blocs) : false })),
        coalitions: completeFamilies(p.blocs),
        financCount: Object.fromEntries(FRONTS.map(f => [f, p.financ[f].length])),
        handCount: p.hand.length, attackedThisRound: p.attackedThisRound,
        hand: mine ? p.hand.slice() : undefined,
        financ: mine ? { Justice: p.financ.Justice.slice(), Presse: p.financ.Presse.slice(), Finances: p.financ.Finances.slice() } : undefined,
        role: reveal ? { partyId: p.role.partyId, party: partyOf(p).nom, objectiveId: p.role.objectiveId, objective: objectiveOf(p).nom, objectiveDesc: objectiveOf(p).desc } : undefined,
        objectiveMet: state.over ? objectiveOf(p).check(p, state) : undefined,
        finalScore: state.over ? finalScore(p, state) : undefined,
      };
    }),
  };
}

/* ----------------------------------- IA ------------------------------------ */
function debtChoice(p, need) {   // rend de quoi couvrir la dette en perdant le MOINS de voix possible
  const idx = p.votants.map((_, i) => i).sort((a, b) => {   // isolés d'abord, puis petites voix
    const fa = p.votants[a].bloc && isFidele(p.votants[a].bloc, p.blocs) ? 1 : 0;
    const fb = p.votants[b].bloc && isFidele(p.votants[b].bloc, p.blocs) ? 1 : 0;
    if (fa !== fb) return fa - fb;
    return p.votants[a].voix - p.votants[b].voix;
  });
  const pick = []; let acc = 0;
  for (const i of idx) { pick.push(i); acc += p.votants[i].voix; if (acc >= need) break; }
  // si le dernier (le plus gros pris) couvre seul la dette, inutile de rendre les petits avec
  const last = pick[pick.length - 1];
  if (last != null && p.votants[last].voix >= need) return [last];
  return pick;
}
function botChooseAction(state, playerId) {
  if (state.pending && state.pending.playerId === playerId) return { type: 'PAY_DEBT', votantIndexes: debtChoice(state.players.find(p => p.id === playerId), state.pending.voixNeeded) };
  const p = current(state);
  if (!p || p.id !== playerId || state.over || state.pending || state.actionsLeft <= 0) return { type: 'END_TURN' };
  const others = state.players.filter(q => q !== p);
  const myMax = Math.max(...state.players.map(q => q.voix));
  const iLead = p.voix >= myMax - 2;

  // 1. défense si je mène et exposé
  const myExposed = exposedSaleFronts(p);
  if (iLead && myExposed.length) {
    const big = biggestDirty(p);
    const pi = p.hand.findIndex(c => c.kind === 'pro' && myExposed.includes(c.front));
    if (pi >= 0 && CONFIG.protectCost <= p.money) return { type: 'PLAY_PROTECT', handIndex: pi };
    if (big && big.amount >= 6) { const bi = p.hand.findIndex(c => c.kind === 'bla'); if (bi >= 0 && CONFIG.blanchCost <= p.money) return { type: 'PLAY_BLANCH', handIndex: bi }; }
  }
  // 2. dénoncer le meneur sur son front le + chargé (au moins 2 cartes => meilleur pari)
  const di = p.hand.findIndex(c => c.kind === 'den');
  if (di >= 0 && denounceCost(p) <= p.money) {
    const tgt = others.filter(q => !q.attackedThisRound && (q.voix >= state.X - 8 || q.voix >= p.voix + 4))
      .map(q => { const fr = FRONTS.filter(f => !q.protect.includes(f) && !p.failedDenounce.includes(q.id + ':' + f)).sort((a, b) => frontCount(q, b) - frontCount(q, a))[0]; return { q, fr, n: fr ? frontCount(q, fr) : 0 }; })
      .filter(x => x.fr && x.n >= 2).sort((a, b) => b.q.voix - a.q.voix)[0];
    if (tgt) return { type: 'PLAY_DENOUNCE', handIndex: di, targetId: tgt.q.id, front: tgt.fr };
  }
  // 3. voler un bloc isolé du meneur
  const si = p.hand.findIndex(c => c.kind === 'steal');
  if (si >= 0) {
    const card = p.hand[si]; const cost = card.e === 'opa' ? CONFIG.opaCost : CONFIG.debauchageCost;
    if (cost <= p.money) { const tgt = others.filter(q => !q.attackedThisRound && q.voix >= p.voix).map(q => ({ q, bc: q.blocs.find(b => !isFidele(b, q.blocs)) })).filter(x => x.bc).sort((a, b) => b.q.voix - a.q.voix)[0];
      if (tgt) return { type: 'PLAY_STEAL', handIndex: si, targetId: tgt.q.id, blocCible: tgt.bc }; }
  }
  // 4. promesse si proche du seuil
  const pri = p.hand.findIndex(c => c.kind === 'coup' && c.e === 'promesse');
  if (pri >= 0 && p.voix >= state.X - 5) return { type: 'PLAY_COUP', handIndex: pri };
  // 5. acheter le meilleur bloc (favorise les coalitions)
  let best = -1, bestScore = -1;
  state.market.forEach((c, i) => {
    const chk = canBuy(p, c); if (!chk.ok) return;
    const soft = softConflict(c.bloc, p.blocs) ? 1 : 0;
    const marg = coalitionBonus(p.blocs.concat([c.bloc])) - coalitionBonus(p.blocs);
    const eff = c.voix - soft + marg;
    const sc = eff / Math.max(1, chk.cost) + eff * 0.03;
    if (sc > bestScore) { bestScore = sc; best = i; }
  });
  if (best >= 0) return { type: 'BUY_VOTANT', marketIndex: best };
  // 6. se financer si pauvre : sale (plus) si pas trop exposé, sinon propre
  if (p.money < 10) {
    if (!iLead) { const ci = p.hand.findIndex(c => c.kind === 'cor'); if (ci >= 0) return { type: 'PLAY_FINANCE', handIndex: ci }; }
    const cl = p.hand.findIndex(c => c.kind === 'clean'); if (cl >= 0) return { type: 'PLAY_FINANCE_CLEAN', handIndex: cl };
    const ci2 = p.hand.findIndex(c => c.kind === 'cor'); if (ci2 >= 0) return { type: 'PLAY_FINANCE', handIndex: ci2 };
  }
  // 7. recycler l'inutile
  const junk = [];
  for (let k = p.hand.length - 1; k >= 0 && junk.length < 2; k--) { const c = p.hand[k]; if ((c.kind === 'coup' && c.e === 'renvoi') || (c.kind === 'pro' && !myExposed.includes(c.front))) junk.push(k); }
  if (junk.length) return { type: 'RECYCLE', handIndexes: junk };
  // 8. financer même si pas pauvre, sinon finir
  if (p.money < 14) { const ci = p.hand.findIndex(c => c.kind === 'cor' || c.kind === 'clean'); if (ci >= 0) return p.hand[ci].kind === 'cor' ? { type: 'PLAY_FINANCE', handIndex: ci } : { type: 'PLAY_FINANCE_CLEAN', handIndex: ci }; }
  return { type: 'END_TURN' };
}
function playOutTurn(state, playerId) {
  let guard = 0;
  while (!state.over && !state.pending && current(state).id === playerId && guard++ < 60) {
    const a = botChooseAction(state, playerId);
    applyAction(state, playerId, a);
    if (a.type === 'END_TURN') break;
  }
}
// Pilote complet (résout aussi les dettes de dénonciation hors tour). Utile sim/IA.
function autoStep(state) {
  if (state.over) return;
  if (state.pending) { const pid = state.pending.playerId; applyAction(state, pid, botChooseAction(state, pid)); return; }
  playOutTurn(state, current(state).id);
}

/* -------------------------- BAC À SABLE D'ÉQUILIBRAGE ----------------------- */
function simulate(nPlayers, nGames = 1000, seed = 12345, X = null) {
  let totalTurns = 0, bySeuil = 0, totalWinVoix = 0, totalDen = 0, totalSteal = 0; const seatWins = Array(nPlayers).fill(0);
  for (let g = 0; g < nGames; g++) {
    const st = createGame({ nPlayers, seed: (seed + g * 2654435761) >>> 0, X: X != null ? X : undefined });
    let guard = 0;
    while (!st.over && guard++ < 800) autoStep(st);
    totalTurns += st.turn; if (st.endReason === 'seuil') bySeuil++;
    seatWins[st.winner]++; totalWinVoix += finalScore(st.players[st.winner], st);
    totalDen += st.players.reduce((a, p) => a + p.denounceLaunched, 0);
  }
  const pct = seatWins.map(w => 100 * w / nGames);
  return {
    nPlayers, seuil: X != null ? X : seuil(nPlayers),
    avgTurns: +(totalTurns / nGames).toFixed(1),
    pctSeuil: Math.round(100 * bySeuil / nGames),
    seatSpread: +(Math.max(...pct) - Math.min(...pct)).toFixed(1),
    avgWinVoix: +(totalWinVoix / nGames).toFixed(1),
    avgDenonc: +(totalDen / nGames).toFixed(1),
  };
}
function calibrate(nGames = 1200) {
  const out = {};
  for (const N of [2, 3, 4, 5, 6]) {
    let best = null;
    for (let X = 20; X <= 44; X++) { const r = simulate(N, nGames, 9000 + N, X); if (r.pctSeuil < 88) continue; const err = Math.abs(r.avgTurns - 11); if (!best || err < best.err) best = { X, err, ...r }; }
    out[N] = best;
  }
  return out;
}

/* -------------------------------- EXPORTS ---------------------------------- */
const API = {
  CONFIG, FRONTS, HARD, SOFT, VOTANTS, COMBINES_DEF, PARTIES, OBJECTIVES, FAMILIES, FAMILY_DEF,
  seuil, coalitionBonus, completeFamilies, isFidele,
  createGame, legalActions, applyAction, publicState,
  botChooseAction, playOutTurn, autoStep, simulate, calibrate,
};
if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (typeof globalThis !== 'undefined') globalThis.CaisseNoire = API;

if (typeof require !== 'undefined' && require.main === module) {
  const arg = process.argv[2];
  if (arg === 'calibrate') {
    console.log('Caisse Noire v0.6 — calibration du seuil (cible ~11 manches, ≥88% par le seuil) :');
    const c = calibrate(1200);
    for (const N of [2, 3, 4, 5, 6]) { const r = c[N]; console.log(r ? `  ${N}j  seuil=${r.X}  tours=${r.avgTurns}  %seuil=${r.pctSeuil}  écart=${r.seatSpread}  voixVainq=${r.avgWinVoix}  dénonc/partie=${r.avgDenonc}` : `  ${N}j  aucun seuil ≥88% trouvé`); }
  } else {
    console.log('Caisse Noire v0.6 — rapport d\'équilibrage (seuil 30) :');
    for (const N of [2, 3, 4, 5, 6]) { const r = simulate(N, 1500); console.log(`  ${N}j  seuil=${r.seuil}  tours=${r.avgTurns}  %seuil=${r.pctSeuil}  écart=${r.seatSpread}  voixVainq=${r.avgWinVoix}  dénonc/partie=${r.avgDenonc}`); }
  }
}
