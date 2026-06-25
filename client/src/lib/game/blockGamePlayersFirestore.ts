import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  startAfter,
  where,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { tryGetFirestoreDb } from "@/lib/firebase";
import type { BlockGamePlayerRoundDoc } from "./playerRevenueFirestore";

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
  totalRounds: number;
  totalStaked: number;
  totalPayout: number;
  totalUserProfit: number;
  totalAdminRevenue: number;
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

function mapPlayerDoc(d: QueryDocumentSnapshot): BlockGamePlayerDoc {
  const x = d.data();
  return {
    uid: d.id,
    userEmail: typeof x.userEmail === "string" ? x.userEmail : "",
    userName: typeof x.userName === "string" ? x.userName : "",
    registeredAt: typeof x.registeredAt === "number" ? x.registeredAt : 0,
    registeredAtIso: typeof x.registeredAtIso === "string" ? x.registeredAtIso : "",
    lastSeenAt: typeof x.lastSeenAt === "number" ? x.lastSeenAt : 0,
    lastPlayedAt: typeof x.lastPlayedAt === "number" ? x.lastPlayedAt : null,
    totalRounds: typeof x.totalRounds === "number" ? x.totalRounds : 0,
    totalStaked: typeof x.totalStaked === "number" ? x.totalStaked : 0,
    totalPayout: typeof x.totalPayout === "number" ? x.totalPayout : 0,
    totalUserProfit: typeof x.totalUserProfit === "number" ? x.totalUserProfit : 0,
    totalAdminRevenue: typeof x.totalAdminRevenue === "number" ? x.totalAdminRevenue : 0,
  };
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

  const now = Date.now();
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      tx.set(ref, {
        uid: args.uid,
        userEmail: args.userEmail,
        userName: args.userName,
        registeredAt: now,
        registeredAtIso: new Date(now).toISOString(),
        lastSeenAt: now,
        lastPlayedAt: null,
        totalRounds: 0,
        totalStaked: 0,
        totalPayout: 0,
        totalUserProfit: 0,
        totalAdminRevenue: 0,
      });
      return;
    }
    tx.set(
      ref,
      {
        userEmail: args.userEmail,
        userName: args.userName,
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

export async function fetchPlayerRoundsPage(
  uid: string,
  opts: {
    pageSize?: number;
    afterDoc?: QueryDocumentSnapshot | null;
    sinceMs?: number;
    untilMs?: number;
  },
): Promise<PaginatedRoundsResult> {
  const db = tryGetFirestoreDb();
  if (!db) return { rounds: [], lastDoc: null, hasMore: false };

  const pageSize = opts.pageSize ?? PLAYER_ROUNDS_PAGE_SIZE;
  const col = collection(db, "blockGamePlayerRounds");

  const constraints: Parameters<typeof query>[1][] = [where("uid", "==", uid)];
  if (opts.sinceMs != null) constraints.push(where("playedAtMs", ">=", opts.sinceMs));
  if (opts.untilMs != null) constraints.push(where("playedAtMs", "<=", opts.untilMs));
  constraints.push(orderBy("playedAtMs", "desc"));
  if (opts.afterDoc) constraints.push(startAfter(opts.afterDoc));
  constraints.push(limit(pageSize + 1));

  const q = query(col, ...constraints);
  const snap = await getDocs(q);
  const docs = snap.docs;
  const hasMore = docs.length > pageSize;
  const page = hasMore ? docs.slice(0, pageSize) : docs;

  return {
    rounds: page.map((d) => ({ ...(d.data() as BlockGamePlayerRoundDoc), id: d.id })),
    lastDoc: page.length > 0 ? page[page.length - 1]! : null,
    hasMore,
  };
}
