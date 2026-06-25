import { FREE_STARTING_BALANCE_KES } from "./constants";

export function clampWalletBalance(balance: number): number {
  return Math.max(0, Math.round(balance));
}

const WALLET_KEY = "block-game-player-wallet-v1";
const FUND_REQUESTS_KEY = "block-game-fund-requests-v1";
const DEVICE_ID_KEY = "block-game-player-device-id";

export interface PlayerWalletRecord {
  deviceId: string;
  balance: number;
  totalGames: number;
  totalStaked: number;
  totalWon: number;
  createdAt: string;
  updatedAt: string;
}

export interface FundRequestRecord {
  id: string;
  deviceId: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
  resolvedAt?: string;
  note?: string;
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function getOrCreateDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const id = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
  localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

export function loadPlayerWallet(): PlayerWalletRecord {
  const deviceId = getOrCreateDeviceId();
  const stored = safeParse<PlayerWalletRecord>(localStorage.getItem(WALLET_KEY));
  if (stored && stored.deviceId === deviceId) {
    return { ...stored, balance: clampWalletBalance(stored.balance) };
  }

  const now = new Date().toISOString();
  const fresh: PlayerWalletRecord = {
    deviceId,
    balance: clampWalletBalance(FREE_STARTING_BALANCE_KES),
    totalGames: 0,
    totalStaked: 0,
    totalWon: 0,
    createdAt: now,
    updatedAt: now,
  };
  savePlayerWallet(fresh);
  return fresh;
}

export function savePlayerWallet(wallet: PlayerWalletRecord): void {
  localStorage.setItem(
    WALLET_KEY,
    JSON.stringify({ ...wallet, balance: clampWalletBalance(wallet.balance), updatedAt: new Date().toISOString() }),
  );
  window.dispatchEvent(new Event("player-wallet-updated"));
}

export function loadFundRequests(): FundRequestRecord[] {
  return safeParse<FundRequestRecord[]>(localStorage.getItem(FUND_REQUESTS_KEY)) ?? [];
}

function saveFundRequests(requests: FundRequestRecord[]): void {
  localStorage.setItem(FUND_REQUESTS_KEY, JSON.stringify(requests));
}

export function createFundRequest(amount: number): FundRequestRecord {
  const deviceId = getOrCreateDeviceId();
  const request: FundRequestRecord = {
    id: `fr_${Date.now().toString(36)}`,
    deviceId,
    amount: Math.max(1, Math.round(amount)),
    status: "pending",
    requestedAt: new Date().toISOString(),
  };
  const list = loadFundRequests();
  list.unshift(request);
  saveFundRequests(list.slice(0, 100));
  return request;
}

export function approveFundRequest(id: string): boolean {
  const list = loadFundRequests();
  const idx = list.findIndex((r) => r.id === id && r.status === "pending");
  if (idx < 0) return false;
  const req = list[idx]!;
  list[idx] = { ...req, status: "approved", resolvedAt: new Date().toISOString() };
  saveFundRequests(list);

  const wallet = loadPlayerWallet();
  if (wallet.deviceId === req.deviceId) {
    wallet.balance = clampWalletBalance(wallet.balance + req.amount);
    savePlayerWallet(wallet);
  }
  return true;
}

export function rejectFundRequest(id: string): boolean {
  const list = loadFundRequests();
  const idx = list.findIndex((r) => r.id === id && r.status === "pending");
  if (idx < 0) return false;
  list[idx] = {
    ...list[idx]!,
    status: "rejected",
    resolvedAt: new Date().toISOString(),
  };
  saveFundRequests(list);
  return true;
}

export function pendingFundRequests(): FundRequestRecord[] {
  return loadFundRequests().filter((r) => r.status === "pending");
}
