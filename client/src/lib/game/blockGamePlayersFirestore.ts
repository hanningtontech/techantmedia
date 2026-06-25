import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  setDoc,
  startAfter,
  where,
  writeBatch,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { tryGetFirestoreDb } from "@/lib/firebase";
import type { BlockGameWalletDoc } from "./blockGameFirestore";
import {
  applyRoundToStats,
  filterRoundsByPeriod,
  normalizePlayerRoundDoc,
  parsePlayerStatsFromFirestore,
  playerStatsToFirestore,
  type BlockGamePlayerStats,
  EMPTY_PLAYER_STATS,
} from "./playerRoundSchema";
import {
  fetchTechantMediaUserProfile,
  KNOWN_BLOCK_GAME_PLAYER_UIDS,
  parseTechantMediaUserDoc,
  type TechantMediaUserProfile,
} from "./techantMediaUserProfile";
import type { BlockGamePlayerRoundDoc } from "./playerRevenueFirestore";

export type { BlockGamePlayerStats };
export { EMPTY_PLAYER_STATS };

export const BLOCK_GAME_PLAYERS_COLLECTION = "blockGamePlayers";
export const BLOCK_GAME_PLAYERS_ANALYSIS_PATH = "/admin/block-game/players";
export const PLAYERS_PAGE_SIZE = 25;
export const PLAYER_ROUNDS_PAGE_SIZE = 30;

export interface BlockGamePlayerDoc {
  uid: string;
  userEmail: string;
  userName: string;
  registeredAt: number;
  registeredAtIso: string;
  lastSeenAt: number;
  lastPlayedAt: number | null;
  stats: BlockGamePlayerStats;
  /** @deprecated use stats — kept for table bindings */
  totalRounds: number;
  totalStaked: number;
  totalPayout: number;
  totalUserProfit: number;
  totalAdminRevenue: number;
}

function mapPlayerDoc(d: QueryDocumentSnapshot): BlockGamePlayerDoc {
  const x = d.data();
  const stats = parsePlayerStatsFromFirestore(x);
  return {
    uid: d.id,
    userEmail: typeof x.userEmail === "string" ? x.userEmail : "",
    userName: typeof x.userName === "string" ? x.userName : "",
    registeredAt: typeof x.registeredAt === "number" ? x.registeredAt : 0,
    registeredAtIso: typeof x.registeredAtIso === "string" ? x.registeredAtIso : "",
    lastSeenAt: typeof x.lastSeenAt === "number" ? x.lastSeenAt : 0,
    lastPlayedAt: typeof x.lastPlayedAt === "number" ? x.lastPlayedAt : null,
    stats,
    totalRounds: stats.rounds,
    totalStaked: stats.staked,
    totalPayout: stats.payout,
    totalUserProfit: stats.userProfit,
    totalAdminRevenue: stats.adminRevenue,
  };
}

function playersCol() {
  const db = tryGetFirestoreDb();
  if (!db) return null;
  return collection(db, BLOCK_GAME_PLAYERS_COLLECTION);
}

function playerRef(uid: string) {
  const db = tryGetFirestoreDb();
  if (!db) return null;
  return doc(db, BLOCK_GAME_PLAYERS_COLLECTION, uid);
}

/** Upsert a block-game player profile when they sign in or register at /game. */
export async function ensureBlockGamePlayerRegistered(args: {
  uid: string;
  userEmail: string;
  userName: string;
}): Promise<void> {
  const ref = playerRef(args.uid);
  const db = tryGetFirestoreDb();
  if (!ref || !db) return;

  const tm = await fetchTechantMediaUserProfile(args.uid);
  const userEmail = tm?.email || args.userEmail;
  const userName = tm?.displayName || args.userName || userEmail;

  const now = Date.now();
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      const registeredAt = tm?.createdAtMs && tm.createdAtMs > 0 ? tm.createdAtMs : now;
      tx.set(ref, {
        uid: args.uid,
        userEmail,
        userName,
        registeredAt,
        registeredAtIso: new Date(registeredAt).toISOString(),
        lastSeenAt: now,
        lastPlayedAt: null,
        ...playerStatsToFirestore({ ...EMPTY_PLAYER_STATS }),
      });
      return;
    }
    tx.set(
      ref,
      {
        userEmail,
        userName,
        lastSeenAt: now,
      },
      { merge: true },
    );
  });
}

export interface PaginatedPlayersResult {
  players: BlockGamePlayerDoc[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

export async function fetchBlockGamePlayersPage(opts: {
  pageSize?: number;
  afterDoc?: QueryDocumentSnapshot | null;
}): Promise<PaginatedPlayersResult> {
  const col = playersCol();
  if (!col) return { players: [], lastDoc: null, hasMore: false };

  const pageSize = opts.pageSize ?? PLAYERS_PAGE_SIZE;
  const constraints: Parameters<typeof query>[1][] = [orderBy("registeredAt", "desc")];
  if (opts.afterDoc) constraints.push(startAfter(opts.afterDoc));
  constraints.push(limit(pageSize + 1));

  const q = query(col, ...constraints);
  const snap = await getDocs(q);
  const docs = snap.docs;
  const hasMore = docs.length > pageSize;
  const page = hasMore ? docs.slice(0, pageSize) : docs;

  return {
    players: page.map(mapPlayerDoc),
    lastDoc: page.length > 0 ? page[page.length - 1]! : null,
    hasMore,
  };
}

export interface PaginatedRoundsResult {
  rounds: BlockGamePlayerRoundDoc[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

const MAX_PERIOD_FETCH_PAGES = 25;

/** Load round pages until the period has rows or history is exhausted. */
export async function fetchPlayerRoundsForPeriod(
  uid: string,
  startMs: number,
  endMs: number,
  opts?: { pageSize?: number; maxPages?: number },
): Promise<PaginatedRoundsResult> {
  const pageSize = opts?.pageSize ?? PLAYER_ROUNDS_PAGE_SIZE;
  const maxPages = opts?.maxPages ?? MAX_PERIOD_FETCH_PAGES;
  const all: BlockGamePlayerRoundDoc[] = [];
  let afterDoc: QueryDocumentSnapshot | null = null;
  let hasMore = true;
  let pages = 0;

  while (pages < maxPages && hasMore) {
    const page = await fetchPlayerRoundsPage(uid, { pageSize, afterDoc });
    pages += 1;
    all.push(...page.rounds);
    afterDoc = page.lastDoc;
    hasMore = page.hasMore;

    const inPeriod = filterRoundsByPeriod(all, startMs, endMs);
    if (inPeriod.length > 0) {
      return {
        rounds: inPeriod,
        lastDoc: page.lastDoc,
        hasMore: page.hasMore,
      };
    }

    const oldest = page.rounds[page.rounds.length - 1];
    if (oldest && oldest.playedAtMs < startMs) break;
    if (page.rounds.length === 0) break;
  }

  return {
    rounds: filterRoundsByPeriod(all, startMs, endMs),
    lastDoc: afterDoc,
    hasMore,
  };
}

export async function fetchPlayerRoundsPage(
  uid: string,
  opts: {
    pageSize?: number;
    afterDoc?: QueryDocumentSnapshot | null;
  },
): Promise<PaginatedRoundsResult> {
  const db = tryGetFirestoreDb();
  if (!db) return { rounds: [], lastDoc: null, hasMore: false };

  const pageSize = opts.pageSize ?? PLAYER_ROUNDS_PAGE_SIZE;
  const col = collection(db, "blockGamePlayerRounds");

  const constraints: Parameters<typeof query>[1][] = [
    where("uid", "==", uid),
    orderBy("playedAtMs", "desc"),
  ];
  if (opts.afterDoc) constraints.push(startAfter(opts.afterDoc));
  constraints.push(limit(pageSize + 1));

  const q = query(col, ...constraints);
  const snap = await getDocs(q);
  const docs = snap.docs.map((d) => normalizePlayerRoundDoc(d.id, d.data()));

  const hasMore = snap.docs.length > pageSize;
  const page = docs.slice(0, pageSize);
  const lastDoc = snap.docs.length > 0 ? snap.docs[Math.min(pageSize, snap.docs.length) - 1]! : null;

  return {
    rounds: page,
    lastDoc,
    hasMore,
  };
}

const ROUNDS_SCAN_PAGE = 400;
const WRITE_BATCH_SIZE = 400;

interface PlayerBackfillRow {
  uid: string;
  userEmail: string;
  userName: string;
  registeredAt: number;
  lastSeenAt: number;
  lastPlayedAt: number | null;
  stats: BlockGamePlayerStats;
}

function emptyBackfillRow(uid: string): PlayerBackfillRow {
  return {
    uid,
    userEmail: "",
    userName: "",
    registeredAt: 0,
    lastSeenAt: 0,
    lastPlayedAt: null,
    stats: { ...EMPTY_PLAYER_STATS },
  };
}

function ensureBackfillRow(map: Map<string, PlayerBackfillRow>, uid: string): PlayerBackfillRow {
  const existing = map.get(uid);
  if (existing) return existing;
  const row = emptyBackfillRow(uid);
  map.set(uid, row);
  return row;
}

function applyRoundToBackfill(row: PlayerBackfillRow, round: BlockGamePlayerRoundDoc): void {
  applyRoundToStats(row.stats, round);
  if (round.userEmail) row.userEmail = round.userEmail;
  if (round.userName) row.userName = round.userName;
  if (!row.registeredAt || round.playedAtMs < row.registeredAt) row.registeredAt = round.playedAtMs;
  row.lastSeenAt = Math.max(row.lastSeenAt, round.playedAtMs);
  row.lastPlayedAt =
    row.lastPlayedAt == null ? round.playedAtMs : Math.max(row.lastPlayedAt, round.playedAtMs);
}

function reconcileWalletIntoStats(stats: BlockGamePlayerStats, wallet: BlockGameWalletDoc): void {
  const games = wallet.totalGames ?? 0;
  if (games <= 0) return;

  const staked = wallet.totalStaked ?? 0;
  const payout = wallet.totalWon ?? 0;
  const walletProfit = payout - staked;

  if (stats.rounds < games) {
    stats.rounds = games;
    stats.staked = Math.max(stats.staked, staked);
    stats.payout = Math.max(stats.payout, payout);
  }

  if (stats.userProfit === 0) {
    if (walletProfit !== 0) {
      stats.userProfit = walletProfit;
      stats.adminRevenue = -walletProfit;
    } else if (stats.staked > 0 || stats.payout > 0) {
      stats.userProfit = stats.payout - stats.staked;
      stats.adminRevenue = -stats.userProfit;
    }
  }
}

function applyWalletToBackfill(row: PlayerBackfillRow, wallet: BlockGameWalletDoc): void {
  const updatedMs = Date.parse(wallet.updatedAt);
  const ts = Number.isFinite(updatedMs) ? updatedMs : Date.now();
  reconcileWalletIntoStats(row.stats, wallet);
  if (!row.registeredAt || ts < row.registeredAt) row.registeredAt = ts;
  row.lastSeenAt = Math.max(row.lastSeenAt, ts);
  if ((wallet.totalGames ?? 0) > 0) {
    row.lastPlayedAt = row.lastPlayedAt == null ? ts : Math.max(row.lastPlayedAt, ts);
  }
}

function finalizeBackfillRow(row: PlayerBackfillRow): void {
  const s = row.stats;
  if (s.rounds > 0 && s.userProfit === 0 && (s.staked > 0 || s.payout > 0)) {
    s.userProfit = s.payout - s.staked;
    s.adminRevenue = -s.userProfit;
  }
}

function backfillRowToFirestore(row: PlayerBackfillRow): Record<string, unknown> {
  finalizeBackfillRow(row);
  const registeredAt = row.registeredAt || row.lastSeenAt || Date.now();
  const lastSeenAt = row.lastSeenAt || registeredAt;
  return {
    uid: row.uid,
    userEmail: row.userEmail,
    userName: row.userName,
    registeredAt,
    registeredAtIso: new Date(registeredAt).toISOString(),
    lastSeenAt,
    lastPlayedAt: row.lastPlayedAt,
    ...playerStatsToFirestore(row.stats),
  };
}

function applyTechantMediaProfileToBackfill(
  row: PlayerBackfillRow,
  profile: TechantMediaUserProfile,
): void {
  if (profile.email) row.userEmail = profile.email;
  if (profile.displayName) row.userName = profile.displayName;
  if (profile.createdAtMs > 0) {
    if (!row.registeredAt || profile.createdAtMs < row.registeredAt) {
      row.registeredAt = profile.createdAtMs;
    }
    row.lastSeenAt = Math.max(row.lastSeenAt, profile.createdAtMs);
  }
}

async function enrichBackfillFromTechantMediaUsers(
  db: NonNullable<ReturnType<typeof tryGetFirestoreDb>>,
  map: Map<string, PlayerBackfillRow>,
  uids: string[],
  onProgress?: (message: string) => void,
): Promise<void> {
  const unique = Array.from(new Set(uids));
  onProgress?.(`Loading ${unique.length} TechantMedia profiles…`);

  for (let i = 0; i < unique.length; i += 10) {
    const chunk = unique.slice(i, i + 10);
    const userSnap = await getDocs(
      query(collection(db, "users"), where(documentId(), "in", chunk)),
    );
    for (const d of userSnap.docs) {
      const row = map.get(d.id);
      if (!row) continue;
      applyTechantMediaProfileToBackfill(row, parseTechantMediaUserDoc(d.id, d.data()));
    }
  }
}

export interface SyncBlockGamePlayersResult {
  total: number;
  created: number;
  updated: number;
  roundsScanned: number;
}

/**
 * Admin: import existing game users from wallets, round history, fund requests, and user profiles.
 */
export async function syncBlockGamePlayersFromSources(
  onProgress?: (message: string) => void,
): Promise<SyncBlockGamePlayersResult> {
  const db = tryGetFirestoreDb();
  if (!db) throw new Error("Firestore is not configured.");

  const map = new Map<string, PlayerBackfillRow>();
  let roundsScanned = 0;

  onProgress?.("Registering known TechantMedia game accounts…");
  for (const uid of KNOWN_BLOCK_GAME_PLAYER_UIDS) {
    ensureBackfillRow(map, uid);
  }

  onProgress?.("Scanning round history…");
  const roundsCol = collection(db, "blockGamePlayerRounds");
  let lastRoundDoc: QueryDocumentSnapshot | null = null;
  while (true) {
    const constraints: Parameters<typeof query>[1][] = [orderBy("playedAtMs", "asc"), limit(ROUNDS_SCAN_PAGE)];
    if (lastRoundDoc) constraints.push(startAfter(lastRoundDoc));
    const snap = await getDocs(query(roundsCol, ...constraints));
    if (snap.empty) break;

    onProgress?.(`Scanning rounds… ${roundsScanned + snap.size} loaded`);

    for (const d of snap.docs) {
      const round = normalizePlayerRoundDoc(d.id, d.data());
      if (!round.uid) continue;
      applyRoundToBackfill(ensureBackfillRow(map, round.uid), round);
      roundsScanned += 1;
    }

    lastRoundDoc = snap.docs[snap.docs.length - 1]!;
    if (snap.size < ROUNDS_SCAN_PAGE) break;
  }

  onProgress?.("Loading wallets…");
  const walletSnap = await getDocs(collection(db, "blockGameWallets"));
  for (const d of walletSnap.docs) {
    const wallet = d.data() as BlockGameWalletDoc;
    applyWalletToBackfill(ensureBackfillRow(map, d.id), wallet);
  }

  onProgress?.("Loading fund requests…");
  const fundSnap = await getDocs(collection(db, "blockGameFundRequests"));
  for (const d of fundSnap.docs) {
    const fr = d.data();
    const uid = typeof fr.uid === "string" ? fr.uid : "";
    if (!uid) continue;
    const row = ensureBackfillRow(map, uid);
    if (typeof fr.userEmail === "string" && fr.userEmail) row.userEmail = fr.userEmail;
    if (typeof fr.userName === "string" && fr.userName) row.userName = fr.userName;
    const reqMs = Date.parse(typeof fr.requestedAt === "string" ? fr.requestedAt : "");
    if (Number.isFinite(reqMs)) {
      if (!row.registeredAt || reqMs < row.registeredAt) row.registeredAt = reqMs;
      row.lastSeenAt = Math.max(row.lastSeenAt, reqMs);
    }
  }

  const uids = Array.from(
    new Set([...map.keys(), ...KNOWN_BLOCK_GAME_PLAYER_UIDS]),
  );
  await enrichBackfillFromTechantMediaUsers(db, map, uids, onProgress);

  if (map.size === 0) {
    return { total: 0, created: 0, updated: 0, roundsScanned };
  }

  onProgress?.(`Writing ${map.size} player records…`);
  let created = 0;
  let updated = 0;
  const rows = Array.from(map.values());

  for (let i = 0; i < rows.length; i += WRITE_BATCH_SIZE) {
    const chunk = rows.slice(i, i + WRITE_BATCH_SIZE);
    const batchWrite = writeBatch(db);

    for (const row of chunk) {
      const ref = doc(db, BLOCK_GAME_PLAYERS_COLLECTION, row.uid);
      const existing = await getDoc(ref);
      batchWrite.set(ref, backfillRowToFirestore(row));
      if (existing.exists()) updated += 1;
      else created += 1;
    }

    await batchWrite.commit();
  }

  return { total: map.size, created, updated, roundsScanned };
}
