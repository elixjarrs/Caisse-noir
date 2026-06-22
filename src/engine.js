/* =============================================================================
 * CAISSE NOIRE — Moteur de jeu (headless, source de vérité des règles)
 * -----------------------------------------------------------------------------
 * - Aucune dépendance, aucun DOM. Tourne en Node (serveur) ET navigateur.
 * - Déterministe : tout l'aléatoire vient d'une RNG seedée stockée dans l'état.
 *   => le serveur peut être autoritatif, et une partie est rejouable (seed + actions).
 * - État 100% sérialisable en JSON (pas de Set/Map) => facile à synchroniser en réseau.
 *
 * VALEURS CALIBRÉES PAR SIMULATION — ne pas modifier sans re-simuler (voir simulate()).
 * Règles complètes : ../docs/REGLES.md
 *
 * COMMENT BRANCHER LE MULTIJOUEUR EN LIGNE (pour Claude Code / la suite) :
 *   1. Le SERVEUR détient l'état autoritatif (createGame). Il ne renvoie à chaque
 *      client que publicState(state, playerId) — qui masque la main des autres
 *      (on ne voit que le NOMBRE de cartes) et le contenu des pioches.
 *   2. Un client envoie une action -> le serveur valide via applyAction() ->
 *      si ok, il diffuse le nouvel état public + le log à tous.
 *   3. Sièges vides / joueurs manquants : remplis par botChooseAction() (même IA
 *      que la démo, calibrée). Idéal pour tester ou compléter une partie.
 *   4. Boucle type : pendant que currentPlayer est un bot OU déconnecté, applique
 *      botChooseAction puis END_TURN automatiquement.
 *
 * API PRINCIPALE :
 *   createGame({ nPlayers, partyIds?, seed? }) -> state
 *   legalActions(state, playerId) -> [actions]
 *   applyAction(state, playerId, action) -> { ok, error?, state }   (mute l'état)
 *   publicState(state, playerId) -> état filtré pour ce joueur
 *   botChooseAction(state, playerId) -> action
 *   seuil(nPlayers) -> nombre de voix pour gagner (30 - nPlayers)
 *   simulate(nPlayers, nGames, seed) -> stats d'équilibrage
 *
 * ACTIONS (action = { type, ... }) :
 *   { type:'BUY_VOTANT', marketIndex }          // achète un bloc visible du marché
 *   { type:'PLAY_FINANCE', handIndex }          // joue une carte corruption
 *   { type:'PLAY_PROTECT', handIndex }          // pose un bouclier (front = celui de la carte)
 *   { type:'PLAY_BLANCH',  handIndex }          // nettoie ta plus grosse carte sale
 *   { type:'PLAY_DENOUNCE',handIndex, targetId, front }
 *   { type:'PLAY_COUP',    handIndex }          // remise / incoherence / promesse / renvoi
 *   { type:'RECYCLE',      handIndexes:[..] }   // défausse 1-2, repioche (1 action)
 *   { type:'END_TURN' }
 *   (l'« Élément de langage » est joué automatiquement par la cible si elle l'a en main ;
 *    voir resolveDenounce — peut être rendu interactif plus tard.)
 * ============================================================================= */

'use strict';

/* ----------------------------- CONFIG (calibré) ---------------------------- */
const CONFIG = {
  start: 7, income: 3, hand: 5, actions: 2,
  protectCost: 5, blanchCost: 3, denounceCost: 2,
  guardrail: 16,        // manches max (garde-fou anti-partie infinie)
};
function seuil(nPlayers) { return 30 - nPlayers; }   // 2j->28 ... 6j->24
// Marché de votants TOURNANT : nb de blocs visibles à l'achat (rules: ~6-8).
// NB équilibrage : à 6 joueurs, l'électorat (161 voix / 42 blocs) est tout juste suffisant,
// donc ~20-25% des parties se finissent par épuisement du marché (« tout l'électorat a
// choisi son camp, on compte les voix ») plutôt que par le seuil. C'est un ending légitime
// et thématique. Knob d'ajustement si besoin : baisser un peu le seuil à 6 j., ou élargir
// cette fenêtre. À ce stade beta, on garde 8 (fidèle aux règles).
function marketVisibleFor(_nPlayers) { return 8; }

const FRONTS = ['Justice', 'Presse', 'Rue', 'Finances'];

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
  for (const [a, b] of pairs) {
    if (bloc === a && owned.includes(b)) return b;
    if (bloc === b && owned.includes(a)) return a;
  }
  return null;
}
const hardConflict = (bloc, owned) => conflictsIn(HARD, bloc, owned);
const softConflict = (bloc, owned) => conflictsIn(SOFT, bloc, owned);

/* --------------------------- VOTANTS (42 uniques) -------------------------- */
/* nom = libellé carte, bloc = clé d'incompatibilité. Pool = 161 voix. */
const VOTANTS = [
  // Petits (4 M€ / 2 voix)
  ['Influenceurs','Influenceurs','Petit',4,2],['Étudiants','Étudiants','Petit',4,2],
  ['Animalistes','Animalistes','Petit',4,2],['Anti-vax','Antivax','Petit',4,2],
  ['Gamers','Gamers','Petit',4,2],['Bobos urbains','Bobos','Petit',4,2],
  ['Complotistes','Complotistes','Petit',4,2],['Masculinistes','Masculinistes','Petit',4,2],
  ['Intermittents','Intermittents','Petit',4,2],['Chauffeurs VTC','Ubers','Petit',4,2],
  ['Les Éveillés','Éveillés','Petit',4,2],['Crypto-bros','Crypto','Petit',4,2],
  ['Survivalistes','Survivalistes','Petit',4,2],['Néo-ruraux','Néoruraux','Petit',4,2],
  ['Libertariens','Libertariens','Petit',4,2],
  // Moyens (8 M€ / 4 voix)
  ['Policiers','Flics','Moyen',8,4],['Agriculteurs','Agriculteurs','Moyen',8,4],
  ['Taxis','Taxis','Moyen',8,4],['Francs-maçons','Maçons','Moyen',8,4],
  ['Chasseurs','Chasseurs','Moyen',8,4],['Soignants','Soignants','Moyen',8,4],
  ['Profs','Profs','Moyen',8,4],['Diaspora','Diaspora','Moyen',8,4],
  ['Militaires','Militaires','Moyen',8,4],['Chômeurs','Chômeurs','Moyen',8,4],
  ['Rentiers','Rentiers','Moyen',8,4],['Héritiers','Héritiers','Moyen',8,4],
  ['Routiers','Routiers','Moyen',8,4],['Motards','Motards','Moyen',8,4],
  ['Start-uppers','Startuppers','Moyen',8,4],['Pêcheurs','Pêcheurs','Moyen',8,4],
  // Gros (12 M€ / 6 voix)
  ['Patronat','Patronat','Gros',12,6],['La CGT','CGT','Gros',12,6],
  ['Intégristes','Intégristes','Gros',12,6],['Fonctionnaires','Fonctionnaires','Gros',12,6],
  ['Lobby pétrolier','Pétrole','Gros',12,6],['Souverainistes','Souverainistes','Gros',12,6],
  ['Communauté LGBT','LGBT','Gros',12,6],['Banquiers','Banquiers','Gros',12,6],
  ['Promoteurs immobiliers','Promoteurs','Gros',12,6],['Lobby pharmaceutique','Pharma','Gros',12,6],
  // Énorme (13 M€ / 7 voix)
  ['Retraités','Retraités','Gros',13,7],
].map(([nom, bloc, tier, cost, voix]) => ({ nom, bloc, tier, cost, voix }));

/* ------------------- COMBINES : pioche commune (104) ----------------------- */
const COMBINES_DEF = [
  { kind:'cor', nom:'Petit pot-de-vin', gain:3, malus:1, front:'Justice', n:12 },
  { kind:'cor', nom:'Faux militants',   gain:4, malus:2, front:'Rue',     n:10 },
  { kind:'cor', nom:'Costards & cadeaux',gain:6, malus:3, front:'Presse', n:10 },
  { kind:'cor', nom:'Emploi fictif',    gain:9, malus:4, front:'Finances',n:10 },
  { kind:'den', nom:'Dénonciation', n:22 },
  { kind:'pro', nom:'Juge acheté',      front:'Justice',  n:4 },
  { kind:'pro', nom:'Médias corrompus', front:'Presse',   n:4 },
  { kind:'pro', nom:'Opinion achetée',  front:'Rue',      n:4 },
  { kind:'pro', nom:'Compte offshore',  front:'Finances', n:4 },
  { kind:'bla', nom:'Blanchiment', n:10 },
  { kind:'coup', e:'remise',      nom:'Remise de campagne', n:3 },
  { kind:'coup', e:'incoherence', nom:'Incohérence',        n:3 },
  { kind:'coup', e:'promesse',    nom:'Promesse intenable', n:3 },
  { kind:'coup', e:'element',     nom:'Élément de langage', n:3 },
  { kind:'coup', e:'renvoi',      nom:"Renvoi d'ascenseur", n:2 },
]; // total 104

/* ---------------------------- PARTIS (6 rôles) ----------------------------- */
const PARTIES = [
  { id:'meute',      nom:'La Meute',       sub:'médiatique',   ban:null,    bonus:'freePresse' },
  { id:'lumiere',    nom:'La Lumière',     sub:'religieux',    ban:'LGBT',  bonus:'integ+1' },
  { id:'cartel',     nom:'Le Cartel',      sub:'patronal',     ban:'CGT',   bonus:'income+1' },
  { id:'vague',      nom:'La Vague',       sub:'populiste',    ban:null,    bonus:'cheapDenounce' },
  { id:'verts',      nom:'Les Verts pâles',sub:'écolo',        ban:'Pétrole',bonus:'ecoloDiscount' },
  { id:'forteresse', nom:'La Forteresse',  sub:'souverainiste',ban:'Diaspora',bonus:'foreign+2' },
];

/* -------------------------------- RNG seedée ------------------------------- */
function nextRand(state) {                 // mulberry32, état dans state.rng
  let t = (state.rng += 0x6D2B79F5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle(arr, state) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(nextRand(state) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ------------------------------- CONSTRUCTION ------------------------------ */
function buildCombines() {
  const d = [];
  for (const c of COMBINES_DEF) { const { n, ...card } = c; for (let i = 0; i < n; i++) d.push({ ...card }); }
  return d;
}
function buildVotants() { return VOTANTS.map(v => ({ ...v })); }

function newPlayer(id, party, isHuman) {
  return {
    id, name: party.nom, partyId: party.id, isHuman: !!isHuman,
    money: CONFIG.start, voix: 0,           // voix = position du pion sur la piste de score
    blocs: [], dirty: { Justice: [], Presse: [], Rue: [], Finances: [] },
    protect: [], votants: [], hand: [],
    banBloc: party.ban, freePresseUsed: false,
    denouncedThisRound: false, discount: false, incoherenceReady: false,
  };
}

/**
 * createGame({ nPlayers, partyIds?, seed? })
 * - partyIds : tableau d'id de partis (un par joueur). Sinon assignés au hasard.
 * - seed     : entier. Sinon dérivé du temps (NON déterministe ; passe un seed pour l'autorité serveur).
 */
function createGame(opts = {}) {
  const nPlayers = Math.max(2, Math.min(6, opts.nPlayers || 4));
  const state = {
    rng: (opts.seed != null ? opts.seed : (Date.now() & 0xffffffff)) >>> 0,
    nPlayers, X: seuil(nPlayers), marketVisible: opts.marketVisible || marketVisibleFor(nPlayers),
    turn: 0, order: [], currentIdx: 0, actionsLeft: 0,
    deck: [], discard: [], votantDeck: [], market: [],
    players: [], over: false, winner: null, endReason: null, log: [],
  };
  // partis
  let pool = PARTIES.slice();
  shuffle(pool, state);
  const chosen = [];
  for (let i = 0; i < nPlayers; i++) {
    let p = null;
    if (opts.partyIds && opts.partyIds[i]) p = PARTIES.find(x => x.id === opts.partyIds[i]);
    if (!p) p = pool.find(x => !chosen.includes(x)) || PARTIES[i % PARTIES.length];
    chosen.push(p);
    state.players.push(newPlayer(i, p, i === 0));   // joueur 0 = humain par défaut
  }
  // pioches
  state.deck = shuffle(buildCombines(), state);
  state.votantDeck = shuffle(buildVotants(), state);
  refillMarket(state);                         // ~8 votants visibles
  for (const p of state.players) drawUp(state, p);
  startRound(state);
  return state;
}

/* ------------------------------ UTILITAIRES -------------------------------- */
function log(state, msg, tag) { state.log.unshift({ t: state.turn, msg, tag: tag || null }); }
function current(state) { return state.order[state.currentIdx]; }
function maxIdx(arr) { let mi = -1, mv = -1; for (let i = 0; i < arr.length; i++) if (arr[i] > mv) { mv = arr[i]; mi = i; } return mi; }
function exposedFront(p) {                    // front non protégé avec la plus grosse carte sale
  let f = null, v = -1;
  for (const fr of FRONTS) {
    if (p.protect.includes(fr) || p.dirty[fr].length === 0) continue;
    const mx = Math.max(...p.dirty[fr]); if (mx > v) { v = mx; f = fr; }
  }
  return f;
}
function exposedFronts(p) { return FRONTS.filter(fr => !p.protect.includes(fr) && p.dirty[fr].length > 0); }
function biggestDirtyFront(p) {
  let f = null, v = -1;
  for (const fr of FRONTS) { if (!p.dirty[fr].length) continue; const mx = Math.max(...p.dirty[fr]); if (mx > v) { v = mx; f = fr; } }
  return f;
}
function denounceCost(p) { return p.bonus === 'cheapDenounce' || partyBonus(p) === 'cheapDenounce' ? 1 : CONFIG.denounceCost; }
function partyBonus(p) { const party = PARTIES.find(x => x.id === p.partyId); return party ? party.bonus : null; }

function refillMarket(state) {
  while (state.market.length < state.marketVisible && state.votantDeck.length > 0) {
    state.market.push(state.votantDeck.pop());
  }
}
function drawUp(state, p) {
  while (p.hand.length < CONFIG.hand) {
    if (state.deck.length === 0) {
      if (state.discard.length === 0) break;
      state.deck = shuffle(state.discard, state); state.discard = [];
    }
    p.hand.push(state.deck.pop());
  }
}
function discardFromHand(state, p, idx) { state.discard.push(p.hand[idx]); p.hand.splice(idx, 1); }

/* ------------------------------- TOURS / MANCHES --------------------------- */
function startRound(state) {
  state.turn++;
  for (const p of state.players) p.denouncedThisRound = false;
  // jeton premier joueur : tourne à chaque manche
  const sp = (state.turn - 1) % state.nPlayers;
  state.order = state.players.slice(sp).concat(state.players.slice(0, sp));
  state.currentIdx = 0;
  beginTurn(state);
}
function beginTurn(state) {
  const p = current(state);
  let inc = CONFIG.income + (partyBonus(p) === 'income+1' ? 1 : 0);
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
  // fin de manche : victoire ? (manche finale équitable = on a fini le tour de table)
  const reached = state.players.filter(q => q.voix >= state.X);
  if (reached.length) { endGame(state, reached.sort(cmpWin)[0], 'seuil'); return; }
  if (state.turn >= CONFIG.guardrail || state.votantDeck.length === 0 && state.market.length === 0) {
    endGame(state, state.players.slice().sort(cmpWin)[0], 'gardefou'); return;
  }
  startRound(state);
}
function cmpWin(a, b) { return b.voix - a.voix || b.money - a.money; }
function endGame(state, winner, reason) {
  state.over = true; state.winner = winner.id; state.endReason = reason;
  log(state, `🏆 ${winner.name} gagne avec ${winner.voix} voix (${reason === 'seuil' ? 'seuil atteint' : 'garde-fou'})`, 'win');
}

/* ----------------------------- ACTIONS LÉGALES ----------------------------- */
function legalActions(state, playerId) {
  const acts = [];
  if (state.over) return acts;
  const p = current(state);
  if (!p || p.id !== playerId || state.actionsLeft <= 0) {
    if (p && p.id === playerId) acts.push({ type: 'END_TURN' });
    return acts;
  }
  // achats votants visibles
  state.market.forEach((c, i) => { if (canBuy(p, c).ok) acts.push({ type: 'BUY_VOTANT', marketIndex: i }); });
  // cartes en main
  p.hand.forEach((card, i) => {
    if (card.kind === 'cor') acts.push({ type: 'PLAY_FINANCE', handIndex: i });
    else if (card.kind === 'pro' && CONFIG.protectCost <= p.money) acts.push({ type: 'PLAY_PROTECT', handIndex: i });
    else if (card.kind === 'bla' && CONFIG.blanchCost <= p.money && biggestDirtyFront(p)) acts.push({ type: 'PLAY_BLANCH', handIndex: i });
    else if (card.kind === 'den' && denounceCost(p) <= p.money) {
      for (const t of state.players) if (t !== p && !t.denouncedThisRound)
        for (const fr of exposedFronts(t)) acts.push({ type: 'PLAY_DENOUNCE', handIndex: i, targetId: t.id, front: fr });
    } else if (card.kind === 'coup' && card.e !== 'element') acts.push({ type: 'PLAY_COUP', handIndex: i });
  });
  acts.push({ type: 'RECYCLE', handIndexes: [0] });
  acts.push({ type: 'END_TURN' });
  return acts;
}
function canBuy(p, c) {
  let cost = c.cost;
  if (partyBonus(p) === 'ecoloDiscount' && (c.bloc === 'Animalistes' || c.bloc === 'Bobos')) cost -= 2;
  if (p.discount) cost = Math.max(0, cost - 3);
  if (cost > p.money) return { ok: false, why: 'argent' };
  if (p.banBloc === c.bloc) return { ok: false, why: 'interdit-parti' };
  if (hardConflict(c.bloc, p.blocs) && !p.incoherenceReady) return { ok: false, why: 'incompat-dure' };
  return { ok: true, cost };
}

/* ----------------------------- APPLIQUER UNE ACTION ------------------------ */
function applyAction(state, playerId, action) {
  if (state.over) return fail(state, 'partie terminée');
  const p = current(state);
  if (!p || p.id !== playerId) return fail(state, "pas ton tour");
  if (action.type === 'END_TURN') { endTurn(state); return { ok: true, state }; }
  if (state.actionsLeft <= 0) return fail(state, 'plus d\'action');

  switch (action.type) {
    case 'BUY_VOTANT': return doBuy(state, p, action.marketIndex);
    case 'PLAY_FINANCE': return doFinance(state, p, action.handIndex);
    case 'PLAY_PROTECT': return doProtect(state, p, action.handIndex);
    case 'PLAY_BLANCH': return doBlanch(state, p, action.handIndex);
    case 'PLAY_DENOUNCE': return doDenounce(state, p, action.handIndex, action.targetId, action.front);
    case 'PLAY_COUP': return doCoup(state, p, action.handIndex);
    case 'RECYCLE': return doRecycle(state, p, action.handIndexes);
    default: return fail(state, 'action inconnue');
  }
}
function fail(state, why) { return { ok: false, error: why, state }; }
function spend(state) { state.actionsLeft = Math.max(0, state.actionsLeft - 1); }

function doBuy(state, p, idx) {
  const c = state.market[idx]; if (!c) return fail(state, 'bloc absent du marché');
  const chk = canBuy(p, c); if (!chk.ok) return fail(state, 'achat impossible: ' + chk.why);
  let gain = c.voix, note = '';
  if (p.incoherenceReady) { p.incoherenceReady = false; p.dirty.Rue.push(2); note = ' (incohérence)'; }
  else { const soft = softConflict(c.bloc, p.blocs); if (soft) { gain -= 1; note = ` (−1, coalition bancale avec ${soft})`; } }
  if (partyBonus(p) === 'integ+1' && c.bloc === 'Intégristes') gain += 1;
  p.money -= chk.cost; p.voix += gain; p.discount = false;
  if (!p.blocs.includes(c.bloc)) p.blocs.push(c.bloc);
  p.votants.push({ nom: c.nom, voix: gain });
  state.market.splice(idx, 1); refillMarket(state);   // marché tournant : on révèle un nouveau bloc
  log(state, `${p.name} achète ${c.nom} (+${gain} voix${note})`, 'buy');
  spend(state); return { ok: true, state };
}
function doFinance(state, p, i) {
  const card = p.hand[i]; if (!card || card.kind !== 'cor') return fail(state, 'pas une carte corruption');
  let g = card.gain + (partyBonus(p) === 'foreign+2' && card.front === 'Presse' ? 2 : 0);
  p.money += g; p.dirty[card.front].push(card.malus);
  log(state, `${p.name} se finance (${card.nom}, +${g} M€, dette ${card.front})`, 'finance');
  discardFromHand(state, p, i); spend(state); return { ok: true, state };
}
function doProtect(state, p, i) {
  const card = p.hand[i]; if (!card || card.kind !== 'pro') return fail(state, 'pas une protection');
  let cost = CONFIG.protectCost;
  if (partyBonus(p) === 'freePresse' && card.front === 'Presse' && !p.freePresseUsed) { cost = 0; p.freePresseUsed = true; }
  if (cost > p.money) return fail(state, 'pas assez d\'argent');
  p.money -= cost; if (!p.protect.includes(card.front)) p.protect.push(card.front);
  log(state, `${p.name} protège ${card.front}`, 'protect');
  discardFromHand(state, p, i); spend(state); return { ok: true, state };
}
function doBlanch(state, p, i) {
  const card = p.hand[i]; if (!card || card.kind !== 'bla') return fail(state, 'pas un blanchiment');
  const fr = biggestDirtyFront(p); if (!fr) return fail(state, 'rien à blanchir');
  if (CONFIG.blanchCost > p.money) return fail(state, 'pas assez d\'argent');
  p.money -= CONFIG.blanchCost; const mi = maxIdx(p.dirty[fr]); p.dirty[fr].splice(mi, 1);
  log(state, `${p.name} blanchit une carte (${fr})`, 'blanch');
  discardFromHand(state, p, i); spend(state); return { ok: true, state };
}
function doDenounce(state, p, i, targetId, front) {
  const card = p.hand[i]; if (!card || card.kind !== 'den') return fail(state, 'pas une dénonciation');
  const t = state.players.find(x => x.id === targetId);
  if (!t || t === p) return fail(state, 'cible invalide');
  if (t.denouncedThisRound) return fail(state, 'cible déjà éclaboussée ce tour');
  if (t.protect.includes(front) || t.dirty[front].length === 0) return fail(state, 'front protégé ou propre');
  const cost = denounceCost(p); if (cost > p.money) return fail(state, 'pas assez d\'argent');
  p.money -= cost;
  // Élément de langage : la cible l'utilise automatiquement si elle l'a (peut devenir interactif)
  const ei = t.hand.findIndex(c => c.kind === 'coup' && c.e === 'element');
  if (ei >= 0) {
    discardFromHand(state, t, ei);
    log(state, `${p.name} dénonce ${t.name} (${front})… contré par un Élément de langage !`, 'denounce');
  } else {
    const mi = maxIdx(t.dirty[front]); const malus = t.dirty[front][mi];
    t.dirty[front].splice(mi, 1); t.voix = Math.max(0, t.voix - malus); t.denouncedThisRound = true;
    log(state, `${p.name} dénonce ${t.name} (${front}) : −${malus} voix`, 'denounce');
  }
  discardFromHand(state, p, i); spend(state); return { ok: true, state };
}
function doCoup(state, p, i) {
  const card = p.hand[i]; if (!card || card.kind !== 'coup') return fail(state, 'pas un coup');
  if (card.e === 'element') return fail(state, "l'Élément de langage se joue en réaction à une dénonciation");
  if (card.e === 'remise') { p.discount = true; log(state, `${p.name} : remise prête`, 'coup'); }
  else if (card.e === 'incoherence') { p.incoherenceReady = true; log(state, `${p.name} prépare une incohérence`, 'coup'); }
  else if (card.e === 'promesse') { p.voix += 3; p.dirty.Rue.push(2); log(state, `${p.name} : promesse intenable (+3 voix)`, 'buy'); }
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
/* Ce qu'un client a le droit de voir : sa main en clair, celle des autres = compte seulement. */
function publicState(state, playerId) {
  return {
    nPlayers: state.nPlayers, X: state.X, turn: state.turn, guardrail: CONFIG.guardrail,
    currentPlayerId: state.over ? null : current(state).id,
    actionsLeft: state.actionsLeft, over: state.over, winner: state.winner, endReason: state.endReason,
    deckCount: state.deck.length, discardCount: state.discard.length, votantsLeft: state.votantDeck.length,
    market: state.market.map(c => ({ nom: c.nom, bloc: c.bloc, tier: c.tier, cost: c.cost, voix: c.voix })),
    log: state.log.slice(0, 60),
    players: state.players.map(p => ({
      id: p.id, name: p.name, partyId: p.partyId, voix: p.voix, money: p.money,
      blocs: p.blocs.slice(), protect: p.protect.slice(),
      dirty: Object.fromEntries(FRONTS.map(f => [f, p.dirty[f].length])),  // compte de cartes sales par front (contenu caché)
      handCount: p.hand.length,
      hand: p.id === playerId ? p.hand.slice() : undefined,                // main en clair seulement pour soi
    })),
  };
}

/* ----------------------------------- IA ------------------------------------ */
/* Politique calibrée (identique à la démo). Renvoie UNE action pour le joueur courant. */
function botChooseAction(state, playerId) {
  const p = current(state);
  if (!p || p.id !== playerId || state.over) return { type: 'END_TURN' };
  if (state.actionsLeft <= 0) return { type: 'END_TURN' };
  const others = state.players.filter(q => q !== p);
  const myMax = Math.max(...state.players.map(q => q.voix));
  // 1. dénoncer un meneur/menaçant dénonçable
  const di = p.hand.findIndex(c => c.kind === 'den');
  if (di >= 0 && denounceCost(p) <= p.money) {
    const tgt = others.filter(q => !q.denouncedThisRound && exposedFront(q) && (q.voix >= state.X - 7 || q.voix >= p.voix + 5))
      .sort((u, v) => v.voix - u.voix)[0];
    if (tgt) return { type: 'PLAY_DENOUNCE', handIndex: di, targetId: tgt.id, front: exposedFront(tgt) };
  }
  // 2. défense si on est une cible probable
  const exp = exposedFront(p); const threatened = (p.voix >= myMax - 3 && p.voix > state.X * 0.4);
  if (threatened && exp && Math.max(...p.dirty[exp]) >= 3) {
    const pi = p.hand.findIndex(c => c.kind === 'pro' && c.front === exp);
    if (pi >= 0 && CONFIG.protectCost <= p.money) return { type: 'PLAY_PROTECT', handIndex: pi };
    const bi = p.hand.findIndex(c => c.kind === 'bla');
    if (bi >= 0 && CONFIG.blanchCost <= p.money) return { type: 'PLAY_BLANCH', handIndex: bi };
  }
  // 3. promesse si proche du seuil
  const pri = p.hand.findIndex(c => c.kind === 'coup' && c.e === 'promesse');
  if (pri >= 0 && p.voix >= state.X - 5) return { type: 'PLAY_COUP', handIndex: pri };
  // 4. acheter le meilleur bloc visible
  let best = -1, bestScore = -1;
  state.market.forEach((c, i) => {
    const chk = canBuy(p, c); if (!chk.ok) return;
    const soft = softConflict(c.bloc, p.blocs) ? 1 : 0; const eff = c.voix - soft;
    const sc = eff / Math.max(1, chk.cost) + eff * 0.02;
    if (sc > bestScore) { bestScore = sc; best = i; }
  });
  if (best >= 0) return { type: 'BUY_VOTANT', marketIndex: best };
  // 5. se financer si pauvre
  if (p.money < 10) { const ci = p.hand.findIndex(c => c.kind === 'cor'); if (ci >= 0) return { type: 'PLAY_FINANCE', handIndex: ci }; }
  // 6. recycler l'inutile (renvoi, protections de fronts non menacés)
  const junk = [];
  for (let k = p.hand.length - 1; k >= 0 && junk.length < 2; k--) {
    const c = p.hand[k];
    if ((c.kind === 'coup' && c.e === 'renvoi') || (c.kind === 'pro' && (!exp || c.front !== exp) && !threatened)) junk.push(k);
  }
  if (junk.length) return { type: 'RECYCLE', handIndexes: junk };
  // 7. financer même si riche, sinon finir
  const ci2 = p.hand.findIndex(c => c.kind === 'cor');
  if (ci2 >= 0 && p.money < 14) return { type: 'PLAY_FINANCE', handIndex: ci2 };
  return { type: 'END_TURN' };
}
/* Joue automatiquement le tour complet d'un joueur (bot ou déconnecté). */
function playOutTurn(state, playerId) {
  let guard = 0;
  while (!state.over && current(state).id === playerId && guard++ < 50) {
    const a = botChooseAction(state, playerId);
    applyAction(state, playerId, a);
    if (a.type === 'END_TURN') break;
  }
}

/* -------------------------- BAC À SABLE D'ÉQUILIBRAGE ----------------------- */
/* simulate(nPlayers, nGames, seed) -> { avgTurns, pctSeuil, seatSpread } */
function simulate(nPlayers, nGames = 1000, seed = 12345) {
  let totalTurns = 0, bySeuil = 0; const seatWins = Array(nPlayers).fill(0);
  for (let g = 0; g < nGames; g++) {
    const st = createGame({ nPlayers, seed: (seed + g * 2654435761) >>> 0 });
    let guard = 0;
    while (!st.over && guard++ < 400) playOutTurn(st, current(st).id);
    totalTurns += st.turn; if (st.endReason === 'seuil') bySeuil++;
    seatWins[st.winner]++;
  }
  const pct = seatWins.map(w => 100 * w / nGames);
  return {
    nPlayers, seuil: seuil(nPlayers),
    avgTurns: +(totalTurns / nGames).toFixed(1),
    pctSeuil: Math.round(100 * bySeuil / nGames),
    seatSpread: +(Math.max(...pct) - Math.min(...pct)).toFixed(1),
  };
}

/* -------------------------------- EXPORTS ---------------------------------- */
const API = {
  CONFIG, FRONTS, HARD, SOFT, VOTANTS, COMBINES_DEF, PARTIES, seuil,
  createGame, legalActions, applyAction, publicState,
  botChooseAction, playOutTurn, simulate,
};
if (typeof module !== 'undefined' && module.exports) module.exports = API;       // Node (CommonJS)
if (typeof globalThis !== 'undefined') globalThis.CaisseNoire = API;             // navigateur / global

/* Exécution directe `node src/engine.js` -> mini-rapport d'équilibrage */
if (typeof require !== 'undefined' && require.main === module) {
  console.log('Caisse Noire — moteur. Vérif équilibrage (marché tournant ~8, seuil 30−N) :');
  for (const N of [2, 3, 4, 5, 6]) {
    const r = simulate(N, 1500);
    console.log(`  ${N}j  seuil=${r.seuil}  tours=${r.avgTurns}  %seuil=${r.pctSeuil}  écartSièges=${r.seatSpread}`);
  }
}
