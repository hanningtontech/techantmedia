import type { SimulationSessionRecord } from "./types";
import { sanitizeSessionFileName } from "./sessionStorage";

function fmtMoney(n: number): string {
  return n.toFixed(2);
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

export async function buildSimulationSessionExcelBuffer(
  record: SimulationSessionRecord,
): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Block Game Simulation";
  workbook.created = new Date(record.savedAt);

  const summary = workbook.addWorksheet("Summary");
  summary.columns = [{ width: 28 }, { width: 36 }];
  const summaryRows: [string, string | number][] = [
    ["Session name", record.name],
    ["Session started", record.startedAt ?? "—"],
    ["Saved at", record.savedAt],
    ["Grid", `${record.config.rows}×${record.config.cols}`],
    ["Bombs", record.config.bombs],
    ["House edge", fmtPct(record.config.houseEdge)],
    ["Win rounds target", record.config.simulationRounds],
    ["Multiplier mode", record.config.multiplierMode],
    ["Games played", record.sessionEconomics.gamesPlayed],
    ["Players", record.sessionEconomics.playerCount],
    ["User total staked", fmtMoney(record.sessionEconomics.userTotalStaked)],
    ["User total payout", fmtMoney(record.sessionEconomics.userTotalPayout)],
    ["User net profit", fmtMoney(record.sessionEconomics.userNetProfit)],
    ["Admin net revenue", fmtMoney(record.sessionEconomics.adminNetRevenue)],
    ["Total deposited", fmtMoney(record.sessionEconomics.totalDeposited)],
    ["Total ending balance", fmtMoney(record.sessionEconomics.totalEndingBalance)],
    ["Realized house edge", fmtPct(record.sessionEconomics.realizedHouseEdge)],
  ];

  if (record.summary) {
    summaryRows.push(
      ["Auto sim players", record.summary.playerCount],
      ["Games per player (max)", record.summary.gamesPerPlayerMax ?? record.summary.gamesPerPlayer],
      ["Games per player (min)", record.summary.gamesPerPlayerMin ?? record.summary.gamesPerPlayer],
      ["RTP", fmtPct(record.summary.rtp)],
      ["Session winners", record.summary.playersWinners],
      ["Session losers", record.summary.playersLosers],
      ["Break even players", record.summary.playersBreakEven],
      ["Game wins", record.summary.totalWins],
      ["Game losses", record.summary.totalLosses],
      ["Stopped early", record.summary.stoppedEarly ? "Yes" : "No"],
    );
  }

  if (record.manualResult) {
    summaryRows.push(
      ["Manual outcome", record.manualResult.outcome],
      ["Manual starting balance", fmtMoney(record.manualResult.startingAccountBalance)],
      ["Manual ending balance", fmtMoney(record.manualResult.endingAccountBalance)],
      ["Manual net profit", fmtMoney(record.manualResult.netProfit)],
      ["Manual stake", fmtMoney(record.manualResult.gameStake)],
      ["Manual payout", fmtMoney(record.manualResult.payout)],
    );
  }

  summaryRows.forEach(([label, value], i) => {
    const row = summary.getRow(i + 1);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true };
    row.getCell(2).value = value;
  });

  const configSheet = workbook.addWorksheet("Config");
  configSheet.columns = [{ width: 22 }, { width: 18 }];
  const configRows: [string, string | number][] = [
    ["Stake (default)", record.config.stake],
    ["Rows", record.config.rows],
    ["Cols", record.config.cols],
    ["Bombs", record.config.bombs],
    ["House edge", record.config.houseEdge],
    ["Simulation rounds", record.config.simulationRounds],
    ["Bonus factor", record.config.bonusFactor],
    ["Custom formula", record.config.customFormula],
    ["Wallet deposit", record.userWallet.deposit],
    ["Wallet stake", record.userWallet.stake],
    [
      "Auto games/player",
      record.autoSimSettings.gamesPerPlayerMin === record.autoSimSettings.gamesPerPlayerMax
        ? record.autoSimSettings.gamesPerPlayerMax
        : `${record.autoSimSettings.gamesPerPlayerMin}–${record.autoSimSettings.gamesPerPlayerMax}`,
    ],
    ["Auto player count", record.autoSimSettings.playerCount],
    ["Auto speed (ms)", record.autoSimSettings.speedMs],
    ["Randomize wallets", record.autoSimSettings.randomizeWallets ? "Yes" : "No"],
    ["Deposit min", record.autoSimSettings.depositMin],
    ["Deposit max", record.autoSimSettings.depositMax],
    ["Stake min", record.autoSimSettings.stakeMin],
    ["Stake max", record.autoSimSettings.stakeMax],
  ];
  configRows.forEach(([label, value], i) => {
    const row = configSheet.getRow(i + 1);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true };
    row.getCell(2).value = value;
  });

  if (record.economicsSeries.length > 0) {
    const trend = workbook.addWorksheet("Economics trend");
    trend.columns = [{ width: 10 }, { width: 18 }, { width: 18 }, { width: 18 }];
    const header = trend.getRow(1);
    ["Game", "User cumulative profit", "Admin cumulative revenue", "Cumulative stake"].forEach(
      (h, i) => {
        const cell = header.getCell(i + 1);
        cell.value = h;
        cell.font = { bold: true };
      },
    );
    record.economicsSeries.forEach((point, i) => {
      const row = trend.getRow(i + 2);
      row.getCell(1).value = point.game;
      row.getCell(2).value = point.userCumulativeProfit;
      row.getCell(3).value = point.adminCumulativeRevenue;
      row.getCell(4).value = point.cumulativeStake;
    });
  }

  if (record.summary && record.summary.playerStats.length > 0) {
    const players = workbook.addWorksheet("Players");
    players.columns = [
      { width: 10 },
      { width: 14 },
      { width: 12 },
      { width: 12 },
      { width: 12 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 12 },
      { width: 12 },
    ];
    const ph = players.getRow(1);
    [
      "Player #",
      "Stake/game",
      "Games",
      "Wins",
      "Losses",
      "Skipped",
      "Starting $",
      "Ending $",
      "Net profit",
      "Session won",
    ].forEach((h, i) => {
      ph.getCell(i + 1).value = h;
      ph.getCell(i + 1).font = { bold: true };
    });
    record.summary.playerStats.forEach((p, i) => {
      const row = players.getRow(i + 2);
      row.getCell(1).value = p.playerId + 1;
      row.getCell(2).value = p.stakePerGame;
      row.getCell(3).value = p.gamesPlayed;
      row.getCell(4).value = p.wins;
      row.getCell(5).value = p.losses;
      row.getCell(6).value = p.skippedGames;
      row.getCell(7).value = p.startingBalance;
      row.getCell(8).value = p.endingBalance;
      row.getCell(9).value = p.netProfit;
      row.getCell(10).value = p.sessionWon ? "Yes" : p.sessionLost ? "No" : "Even";
    });
  }

  return workbook.xlsx.writeBuffer();
}

export async function downloadSimulationSessionExcel(record: SimulationSessionRecord): Promise<void> {
  const buffer = await buildSimulationSessionExcelBuffer(record);
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = record.savedAt.slice(0, 10);
  link.href = url;
  link.download = `${sanitizeSessionFileName(record.name)}-${date}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
