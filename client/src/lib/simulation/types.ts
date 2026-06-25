export type MultiplierMode = "linear" | "progressive" | "custom";

export type CellState = "hidden" | "safe" | "bomb";

export type GameStatus = "idle" | "playing" | "won" | "lost" | "cashed_out";

export type PlayMode = "manual" | "step" | "auto";

export type SessionOutcome = "won" | "lost" | "cashed_out" | "stopped";

export interface GameConfig {
  stake: number;
  rows: number;
  cols: number;
  bombs: number;
  houseEdge: number;
  simulationRounds: number;
  multiplierMode: MultiplierMode;
  bonusFactor: number;
  customFormula: string;
}

/** Auto-simulation: multiple independent players, each playing many games. */
export interface AutoSimSettings {
  /** @deprecated Use gamesPerPlayerMax; kept for saved sessions. */
  gamesPerPlayer: number;
  gamesPerPlayerMin: number;
  gamesPerPlayerMax: number;
  playerCount: number;
  /** Delay between visual game steps (ms). 0 = max-speed batch. */
  speedMs: number;
  /** Randomize starting deposit and stake per player (multi-player). */
  randomizeWallets: boolean;
  depositMin: number;
  depositMax: number;
  stakeMin: number;
  stakeMax: number;
}

export interface UserWalletSettings {
  deposit: number;
  stake: number;
}

export interface PayoutRow {
  round: number;
  winProbability: number;
  multiplier: number;
  potentialBalance: number;
  expectedValue: number;
}

export interface EvPoint {
  round: number;
  expectedValue: number;
  stake: number;
}

/** Per-game economics: user profit vs admin (house) revenue. */
export interface GameEconomics {
  userStake: number;
  userPayout: number;
  userProfit: number;
  adminRevenue: number;
}

export interface SessionEconomics {
  gamesPlayed: number;
  playerCount: number;
  userTotalStaked: number;
  userTotalPayout: number;
  userNetProfit: number;
  adminNetRevenue: number;
  totalDeposited: number;
  totalEndingBalance: number;
  realizedHouseEdge: number;
}

export interface PlayerWallet {
  playerId: number;
  startingBalance: number;
  currentBalance: number;
  stakePerGame: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  skippedGames: number;
  totalStaked: number;
  totalPayout: number;
}

export interface PlayerStats {
  playerId: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  skippedGames: number;
  totalStaked: number;
  totalPayout: number;
  netProfit: number;
  startingBalance: number;
  endingBalance: number;
  stakePerGame: number;
  /** Session winner: ending balance above starting deposit */
  sessionWon: boolean;
  sessionLost: boolean;
}

export interface SimulationSummary {
  gamesPlayed: number;
  totalWins: number;
  totalLosses: number;
  averagePayout: number;
  highestPayout: number;
  lowestPayout: number;
  totalStaked: number;
  totalPaidOut: number;
  rtp: number;
  playerCount: number;
  gamesPerPlayer: number;
  gamesPerPlayerMin: number;
  gamesPerPlayerMax: number;
  userNetProfit: number;
  adminNetRevenue: number;
  averageUserProfitPerGame: number;
  totalDeposited: number;
  totalEndingBalance: number;
  playersWinners: number;
  playersLosers: number;
  playersBreakEven: number;
  playerStats: PlayerStats[];
  stoppedEarly: boolean;
}

export interface ManualSessionResult {
  outcome: SessionOutcome;
  startingAccountBalance: number;
  endingAccountBalance: number;
  gameStake: number;
  payout: number;
  netProfit: number;
  round: number;
  multiplier: number;
}

export interface SinglePlayOutcome {
  pickIndex: number;
  isBomb: boolean;
  balanceDelta: number;
  balanceAfter: number;
  round: number;
  multiplier: number;
  bombIndices: number[];
  economics: GameEconomics;
}

export interface AutoPlayProgress {
  running: boolean;
  completed: number;
  target: number;
  activePlayer: number;
  totalPlayers: number;
}

export interface EconomicsPoint {
  game: number;
  userCumulativeProfit: number;
  adminCumulativeRevenue: number;
  cumulativeStake: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  stake: 10,
  rows: 5,
  cols: 5,
  bombs: 3,
  houseEdge: 0.03,
  simulationRounds: 5,
  multiplierMode: "linear",
  bonusFactor: 0.1,
  customFormula: "(1 - edge) / pWin",
};

export const DEFAULT_AUTO_SIM: AutoSimSettings = {
  gamesPerPlayer: 1000,
  gamesPerPlayerMin: 500,
  gamesPerPlayerMax: 1000,
  playerCount: 10,
  speedMs: 25,
  randomizeWallets: true,
  depositMin: 50,
  depositMax: 500,
  stakeMin: 5,
  stakeMax: 25,
};

export const DEFAULT_WALLET: UserWalletSettings = {
  deposit: 100,
  stake: 10,
};

export const PLAYER_LIST_THRESHOLD = 20;

export const GRID_PRESETS = [
  { label: "1×2", rows: 1, cols: 2 },
  { label: "5×5", rows: 5, cols: 5 },
  { label: "10×10", rows: 10, cols: 10 },
  { label: "20×20", rows: 20, cols: 20 },
] as const;

export const EMPTY_SESSION_ECONOMICS: SessionEconomics = {
  gamesPlayed: 0,
  playerCount: 1,
  userTotalStaked: 0,
  userTotalPayout: 0,
  userNetProfit: 0,
  adminNetRevenue: 0,
  totalDeposited: 0,
  totalEndingBalance: 0,
  realizedHouseEdge: 0,
};

/** Persisted simulation session for local storage and Excel export. */
export interface SimulationSessionRecord {
  id: string;
  name: string;
  startedAt: string | null;
  savedAt: string;
  config: GameConfig;
  autoSimSettings: AutoSimSettings;
  userWallet: UserWalletSettings;
  sessionEconomics: SessionEconomics;
  summary: SimulationSummary | null;
  manualResult: ManualSessionResult | null;
  economicsSeries: EconomicsPoint[];
}
