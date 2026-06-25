import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { tryGetFirestoreDb } from "@/lib/firebase";
import { DEFAULT_HOUSE_EDGE } from "./constants";
import { defaultBombRanges, mergeBombRanges, type GridBombRanges } from "./bombRangeSettings";
import { clampWalletBalance } from "./playerStorage";
import { type SimChartTick } from "@/lib/simulation/timeChartHistory";

const MAX_LIVE_TICKS = 2500;

export interface LiveChartSnapshot {
  chartHistory: SimChartTick[];
  updatedAt: number;
  totalGames: number;
  userProfit: number;
  adminRevenue: number;
  activeSources: { player: number; simulation: number };
}

export interface BlockGameWalletDoc {
  balance: number;
  totalGames: number;
  totalStaked: number;
  totalWon: number;
  updatedAt: string;
}

export interface BlockGameSettingsDoc {
  houseEdge: number;
  bombRanges: GridBombRanges;
  updatedAt: string;
  updatedBy?: string;
}

export interface BlockGameFundRequestDoc {
  id: string;
  uid: string;
  userEmail: string;
  userName: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
  resolvedAt?: string;
  note?: string;
}

function liveChartRef() {
  const db = tryGetFirestoreDb();
  if (!db) return null;
  return doc(db, "blockGame", "liveChart");
}

function settingsRef() {
  const db = tryGetFirestoreDb();
  if (!db) return null;
  return doc(db, "blockGame", "settings");
}

function walletRef(uid: string) {
  const db = tryGetFirestoreDb();
  if (!db) return null;
  return doc(db, "blockGameWallets", uid);
}

function fundRequestRef(id: string) {
  const db = tryGetFirestoreDb();
  if (!db) return null;
  return doc(db, "blockGameFundRequests", id);
}

function fundRequestsCol() {
  const db = tryGetFirestoreDb();
  if (!db) return null;
  return collection(db, "blockGameFundRequests");
}

export function parseLiveChartDoc(data: Record<string, unknown> | undefined): LiveChartSnapshot {
  const history = Array.isArray(data?.chartHistory) ? (data!.chartHistory as SimChartTick[]) : [];
  const metrics = (data?.metrics ?? {}) as Record<string, number>;
  const sources = (data?.activeSources ?? {}) as Record<string, number>;
  return {
    chartHistory: history,
    updatedAt: Number(data?.updatedAt ?? 0),
    totalGames: Number(metrics.totalGames ?? history.length),
    userProfit: Number(metrics.userProfit ?? history[history.length - 1]?.userCumulative ?? 0),
    adminRevenue: Number(metrics.adminRevenue ?? history[history.length - 1]?.adminCumulative ?? 0),
    activeSources: {
      player: Number(sources.player ?? 0),
      simulation: Number(sources.simulation ?? 0),
    },
  };
}

export function parseBlockGameSettings(data: Record<string, unknown> | undefined): BlockGameSettingsDoc {
  const edge = Number(data?.houseEdge ?? DEFAULT_HOUSE_EDGE);
  const bombRanges = mergeBombRanges(
    data?.bombRanges as GridBombRanges | Record<string, unknown> | undefined,
  );
  return {
    houseEdge: Math.min(0.5, Math.max(0.01, Number.isFinite(edge) ? edge : DEFAULT_HOUSE_EDGE)),
    bombRanges,
    updatedAt: String(data?.updatedAt ?? ""),
    updatedBy: data?.updatedBy ? String(data.updatedBy) : undefined,
  };
}

function defaultSettings(): BlockGameSettingsDoc {
  return { houseEdge: DEFAULT_HOUSE_EDGE, bombRanges: defaultBombRanges(), updatedAt: "" };
}

/** Public game settings — house edge for live /game multipliers. */
export function subscribeBlockGameSettings(listener: (settings: BlockGameSettingsDoc) => void): Unsubscribe {
  const ref = settingsRef();
  if (!ref) {
    listener(defaultSettings());
    return () => {};
  }
  return onSnapshot(
    ref,
    (snap) => {
      listener(
        snap.exists()
          ? parseBlockGameSettings(snap.data() as Record<string, unknown>)
          : defaultSettings(),
      );
    },
    () => listener(defaultSettings()),
  );
}

export async function loadBlockGameSettings(): Promise<BlockGameSettingsDoc> {
  const ref = settingsRef();
  if (!ref) return defaultSettings();
  const snap = await getDoc(ref);
  if (!snap.exists()) return defaultSettings();
  return parseBlockGameSettings(snap.data() as Record<string, unknown>);
}

/** One-shot read for soft chart refresh (no listener flicker). */
export async function loadLiveChartSnapshot(): Promise<LiveChartSnapshot | null> {
  const ref = liveChartRef();
  if (!ref) return null;
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return parseLiveChartDoc(snap.data() as Record<string, unknown>);
}

/** Public live chart — all players + simulations aggregate here. */
export function subscribeLiveChart(listener: (snapshot: LiveChartSnapshot | null) => void): Unsubscribe {
  const ref = liveChartRef();
  if (!ref) {
    listener(null);
    return () => {};
  }
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        listener(null);
        return;
      }
      listener(parseLiveChartDoc(snap.data() as Record<string, unknown>));
    },
    () => listener(null),
  );
}

export async function appendLiveChartTick(
  tick: SimChartTick,
  sourceKind: "player" | "simulation",
): Promise<void> {
  const ref = liveChartRef();
  if (!ref) return;

  await runTransaction(tryGetFirestoreDb()!, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? (snap.data() as Record<string, unknown>) : {};
    const history = Array.isArray(data.chartHistory) ? ([...data.chartHistory] as SimChartTick[]) : [];
    const last = history[history.length - 1];
    if (last?.gameIndex === tick.gameIndex) return;

    history.push(tick);
    const trimmed = history.length > MAX_LIVE_TICKS ? history.slice(-MAX_LIVE_TICKS) : history;
    const sources = (data.activeSources ?? {}) as Record<string, number>;

    tx.set(
      ref,
      {
        chartHistory: trimmed,
        updatedAt: Date.now(),
        metrics: {
          totalGames: tick.gameIndex,
          userProfit: tick.userCumulative,
          adminRevenue: tick.adminCumulative,
        },
        activeSources: {
          ...sources,
          [sourceKind]: Number(sources[sourceKind] ?? 0) + 1,
        },
      },
      { merge: true },
    );
  });
}

export async function loadBlockGameWallet(uid: string): Promise<BlockGameWalletDoc | null> {
  const ref = walletRef(uid);
  if (!ref) return null;
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const d = snap.data() as BlockGameWalletDoc;
  return { ...d, balance: clampWalletBalance(Number(d.balance ?? 0)) };
}

export async function saveBlockGameWallet(uid: string, wallet: BlockGameWalletDoc): Promise<void> {
  const ref = walletRef(uid);
  if (!ref) return;
  await setDoc(
    ref,
    {
      ...wallet,
      balance: clampWalletBalance(wallet.balance),
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

export async function ensureBlockGameWallet(uid: string, localBalance?: number): Promise<BlockGameWalletDoc> {
  const existing = await loadBlockGameWallet(uid);
  if (existing) return existing;

  const fresh: BlockGameWalletDoc = {
    balance: clampWalletBalance(localBalance ?? FREE_STARTING_BALANCE_KES),
    totalGames: 0,
    totalStaked: 0,
    totalWon: 0,
    updatedAt: new Date().toISOString(),
  };
  await saveBlockGameWallet(uid, fresh);
  return fresh;
}

export function subscribeBlockGameWallet(
  uid: string,
  listener: (wallet: BlockGameWalletDoc | null) => void,
): Unsubscribe {
  const ref = walletRef(uid);
  if (!ref) {
    listener(null);
    return () => {};
  }
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        listener(null);
        return;
      }
      const d = snap.data() as BlockGameWalletDoc;
      listener({ ...d, balance: clampWalletBalance(Number(d.balance ?? 0)) });
    },
    () => listener(null),
  );
}

export async function createBlockGameFundRequest(args: {
  uid: string;
  userEmail: string;
  userName: string;
  amount: number;
}): Promise<BlockGameFundRequestDoc> {
  const id = `fr_${Date.now().toString(36)}`;
  const record: BlockGameFundRequestDoc = {
    id,
    uid: args.uid,
    userEmail: args.userEmail,
    userName: args.userName,
    amount: Math.max(1, Math.round(args.amount)),
    status: "pending",
    requestedAt: new Date().toISOString(),
  };
  const ref = fundRequestRef(id);
  if (ref) await setDoc(ref, record);
  return record;
}

export function subscribePendingFundRequests(
  listener: (requests: BlockGameFundRequestDoc[]) => void,
): Unsubscribe {
  const col = fundRequestsCol();
  if (!col) {
    listener([]);
    return () => {};
  }
  return onSnapshot(
    col,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ ...(d.data() as BlockGameFundRequestDoc), id: d.id }))
        .filter((r) => r.status === "pending")
        .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
      listener(list);
    },
    () => listener([]),
  );
}

export async function resolveFundRequest(
  id: string,
  status: "approved" | "rejected",
  note?: string,
): Promise<boolean> {
  const ref = fundRequestRef(id);
  const db = tryGetFirestoreDb();
  if (!ref || !db) return false;

  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return false;
      const req = snap.data() as BlockGameFundRequestDoc;
      if (req.status !== "pending") return false;

      const wRef = status === "approved" ? walletRef(req.uid) : null;
      let prevWallet: BlockGameWalletDoc | null = null;
      if (wRef) {
        const wSnap = await tx.get(wRef);
        prevWallet = wSnap.exists() ? (wSnap.data() as BlockGameWalletDoc) : null;
      }

      tx.set(
        ref,
        {
          status,
          resolvedAt: new Date().toISOString(),
          note: note ?? null,
        },
        { merge: true },
      );

      if (status === "approved" && wRef) {
        const balance = clampWalletBalance((prevWallet?.balance ?? FREE_STARTING_BALANCE_KES) + req.amount);
        tx.set(
          wRef,
          {
            balance,
            totalGames: prevWallet?.totalGames ?? 0,
            totalStaked: prevWallet?.totalStaked ?? 0,
            totalWon: prevWallet?.totalWon ?? 0,
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        );
      }

      return true;
    });
  } catch {
    return false;
  }
}

/** Player: watch own fund requests for approve/reject notifications. */
export function subscribeUserFundRequests(
  uid: string,
  listener: (requests: BlockGameFundRequestDoc[]) => void,
): Unsubscribe {
  const col = fundRequestsCol();
  if (!col) {
    listener([]);
    return () => {};
  }
  const q = query(col, where("uid", "==", uid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ ...(d.data() as BlockGameFundRequestDoc), id: d.id }))
        .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
      listener(list);
    },
    () => listener([]),
  );
}

export const SIM_UNLOCK_KEY = "block-game-simulation-unlocked";

export function isSimulationUnlockedLocally(): boolean {
  try {
    return sessionStorage.getItem(SIM_UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSimulationUnlockedLocally(): void {
  try {
    sessionStorage.setItem(SIM_UNLOCK_KEY, "1");
  } catch {
    /* ignore */
  }
}
