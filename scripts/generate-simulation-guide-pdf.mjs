/**
 * Block Game — complete player + simulation + charts + strategy guide (PDF).
 * Run: node scripts/generate-simulation-guide-pdf.mjs
 */
import { jsPDF } from "jspdf";
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "docs");
const OUT_FILE = join(OUT_DIR, "Block-Game-Simulation-Guide.pdf");

const SECTIONS = [
  {
    title: "1. What Is the Block Game?",
    body: [
      "The Block Game is a reveal-the-tiles game. You see a grid of hidden cells. Some cells hide bombs; the rest are safe. Tap a cell to reveal it.",
      "If you hit a bomb, you lose your stake for that round. Each safe pick increases your potential payout. You can withdraw (cash out) after at least one safe pick, or keep going for a bigger multiplier.",
      "There are two ways to use the system:",
      "• Live Player Game (/game) — play with a real KES wallet, session target, charts, and session history.",
      "• Simulation Dashboard (/simulation) — practice, test grids, run thousands of auto-games, and study the math.",
      "Both use the same fair math: same multiplier formulas, same probability rules, same 3% house edge in production.",
    ],
  },
  {
    title: "2. Quick Glossary",
    body: [
      "Stake — money you risk at the start of one round (KES in /game, dollars in simulation).",
      "Payout — money returned if you withdraw or clear all safe cells. Payout = stake × multiplier.",
      "Net profit — payout minus stake. On a bomb: net profit = −stake.",
      "Multiplier (M) — how many times your stake you receive if you cash out at that round.",
      "Round — number of safe cells revealed so far in the current game.",
      "House edge (edge) — built-in advantage for the operator. Production default: 3% (0.03).",
      "RTP — Return To Player = total paid out ÷ total staked. Target RTP ≈ 1 − edge (about 97%).",
      "EV — Expected Value. Average profit per round over infinite repeats. Negative EV = house wins long-term.",
      "P(win) or pWin — probability of k consecutive safe picks without hitting a bomb.",
      "Withdraw / cash out — end the round early and take stake × multiplier at the current round.",
      "Session target — optional goal balance you set in /game (must be at least 2× current balance).",
      "Session table — log of your past rounds: stake, payout, net, grid, multiplier.",
    ],
  },
  {
    title: "3. Live Player Game (/game)",
    body: [
      "Sign in, then you land on the play screen with wallet, grid, and controls.",
      "WALLET BAR: Shows balance (KES), stake input, optional session target, and settings gear.",
      "START / PLAY AGAIN: Deducts stake from balance and deals a fresh board. You need balance ≥ stake (min KES 5).",
      "PICK: Tap hidden cells while playing. Green = safe. Red bomb = round lost, stake gone.",
      "WITHDRAW: Available after at least 1 safe pick. Pays stake × multiplier and ends the round.",
      "RESET: Clears the finished board so you can change stake or settings before the next round.",
      "BOMBS: Each new round picks a random bomb count between 30% and 55% of total cells (fair RNG).",
      "GRID PRESETS: 3×4 up to 11×13 portrait-friendly boards. Change in Settings when not playing.",
      "FREE START: New wallets begin with KES 10. Request more funds in Settings if balance is low.",
      "SESSION TARGET: Set a target balance (≥ 2× current). Progress bar tracks you. Hitting target shows a celebration note.",
      "SESSION HISTORY: Desktop shows a table beside the grid. Phone: Settings → View session history (card list).",
      "FULL HISTORY PAGE: /game/history — every round in a scrollable table.",
      "CHART PANEL: Minimized strip or expanded candlestick chart — same live feed as /game/chart.",
    ],
  },
  {
    title: "4. Simulation Dashboard (/simulation)",
    body: [
      "The simulation is your lab. Configure rows, columns, bombs, house edge, and multiplier mode.",
      "PLAY MODES: Manual (you click), Step (random pick each step), Auto (Monte Carlo batch with virtual players).",
      "Compare USER profit (green) vs ADMIN revenue (red). Every game is zero-sum: user profit + admin revenue = 0.",
      "Save named sessions to browser storage, export Excel workbooks, and study charts before risking real play.",
      "Use simulation to answer: 'If I always cash out at round 3 on a 5×6 grid, what happens over 1,000 games?'",
      "Route: /simulation on TechantMedia portfolio site.",
    ],
  },
  {
    title: "5. How One Round Works (Step by Step)",
    body: [
      "1) You choose stake S (e.g. KES 10). Balance drops by S immediately.",
      "2) Bombs are placed uniformly at random on the grid (no pattern, no memory of past games).",
      "3) You reveal cells one at a time. Each safe pick advances round r by 1.",
      "4) After each safe pick, potential payout = S × M(r) where M(r) is the multiplier for round r.",
      "5) You may withdraw anytime after round ≥ 1, or keep picking until you hit a bomb or clear all safe cells.",
      "6) Bomb → payout 0, round ends. Withdraw → payout = S × M(r). Clear all safe cells → full win at final multiplier.",
      "7) Net profit for the round = payout − S. Balance updates and the round is logged in session history + chart.",
    ],
  },
  {
    title: "6. Core Probability (Simple Language)",
    body: [
      "Think of the grid as a bag of cells. Some are bombs, most are safe. You draw without putting back.",
      "After each safe pick, the next pick has slightly worse odds because one more safe cell is gone.",
      "Formula — probability of k safe picks in a row:",
      "P(k) = (safe/total) × ((safe−1)/(total−1)) × … × ((safe−k+1)/(total−k+1))",
      "Where: total = rows × cols, safe = total − bombs.",
      "Compact form: P(k) = product from i=0 to k−1 of (total − bombs − i) / (total − i)",
      "Example — 5×6 grid = 30 cells, 12 bombs (40%), want 3 safe picks:",
      "P(3) = (18/30) × (17/29) × (16/28) ≈ 0.355 (about 35.5% chance).",
      "Important: Past rounds do NOT change future odds. Each new game is a fresh shuffle. There is no 'due' safe cell.",
    ],
  },
  {
    title: "7. Multiplier Algorithm",
    body: [
      "Multipliers are calculated from your odds so the house keeps a small edge on average.",
      "LINEAR (production default):",
      "M(r) = (1 − edge) / P(r)",
      "Where P(r) = probability of surviving r consecutive safe picks, edge = 0.03 (3%).",
      "Meaning: harder rounds (lower P) pay more, scaled so long-run RTP ≈ 97%.",
      "PROGRESSIVE (simulation option):",
      "base = (1 − edge) / P(r)",
      "M(r) = base^(1 + bonus × (r − 1))  — later rounds pay even more aggressively.",
      "CUSTOM (simulation): JavaScript formula using edge, pWin, round, total, bombs, stake.",
      "Payout if you cash out at round r:",
      "Payout(r) = S × M(r)",
      "Potential balance while playing = account balance (after stake deducted) + Payout(r).",
    ],
  },
  {
    title: "8. Expected Value (The Honest Math)",
    body: [
      "EV tells you the average profit per round if you played the same strategy forever.",
      "EV(r) = S × [ P(r) × M(r) − (1 − P(r)) ]",
      "With linear multipliers, EV at the 'natural' cash-out round is slightly negative — that is the house edge.",
      "Rough rule: EV per round ≈ −S × edge when multipliers are fair (e.g. −KES 0.30 on a KES 10 stake at 3% edge).",
      "RTP over many games:",
      "RTP = (sum of payouts) / (sum of stakes) ≈ 1 − edge",
      "You CAN win short sessions by luck. You CANNOT beat negative EV forever without changing the rules.",
      "The simulation payout table shows P(r), M(r), and EV(r) for every round — study it before playing.",
    ],
  },
  {
    title: "9. Worked Example (5×6 Grid)",
    body: [
      "Grid: 5×6 = 30 cells. Suppose 12 bombs (40%). Stake S = KES 10. Edge = 3%.",
      "Round 1: P(1) = 18/30 = 0.60. M(1) = 0.97/0.60 ≈ 1.617. Cashout = KES 16.17.",
      "Round 2: P(2) = (18/30)(17/29) ≈ 0.352. M(2) = 0.97/0.352 ≈ 2.756. Cashout = KES 27.56.",
      "Round 3: P(3) ≈ 0.355 (see section 6). M(3) ≈ 2.732. Cashout ≈ KES 27.32.",
      "Each extra pick: higher multiplier BUT higher bomb risk on the next tap.",
      "If you hit a bomb on round 3, you lose KES 10. If you withdrew at round 2, you keep KES 27.56.",
      "The 'best' round to stop is a risk choice — not a hidden pattern in the grid.",
    ],
  },
  {
    title: "10. Live Charts — What They Show",
    body: [
      "The candlestick chart (Forex-style) appears in /game, /game/chart, and /simulation.",
      "It plots cumulative USER profit (green candles) and cumulative ADMIN revenue (red) over time.",
      "Each finished game adds a tick: userDelta = payout − stake, adminDelta = stake − payout.",
      "Candles group ticks by timeframe (1s, 5s, 1m, 1h, 1d, etc.). Switch timeframe to zoom in or out.",
      "Live stats overlay: total games, user profit, admin revenue, target RTP.",
      "Data sources merge automatically: active simulation session wins; otherwise Firestore live feed from all players.",
      "What charts are NOT: They do not predict the next cell. They show community/session economics history.",
      "How to use charts: See whether recent sessions trend up or down; notice variance; compare your play to aggregate RTP.",
    ],
  },
  {
    title: "11. Session Table & History",
    body: [
      "Every completed round logs: game #, outcome (Won / Lost / Withdrawn), stake, payout, net, multiplier, grid, time.",
      "Desktop: preview table next to the grid + link to full history.",
      "Phone: Settings → Session table summary → View session history (scrollable cards).",
      "Summary row: total rounds + net profit (green if positive, red if negative).",
      "Stored locally per user (up to 250 rounds) and synced to admin revenue records in Firestore.",
      "Use the table to review YOUR decisions: Did you withdraw too early or too late? Track net over 20+ rounds.",
    ],
  },
  {
    title: "12. Settings & Wallet (Phone + Desktop)",
    body: [
      "Grid size, color theme, tile style.",
      "Session target — set or clear profit goal (minimum target = 2× current balance).",
      "Session table — summary + open full history (phone: in-sheet cards).",
      "Request funds — admin approves deposits to your wallet.",
      "Stake limits: KES 5 – 9,000. Max wallet: KES 9,999.",
      "Phone layout: collapsible wallet bar, horizontal play controls, grid fills screen between wallet and buttons.",
    ],
  },
  {
    title: "13. Fairness & Randomness",
    body: [
      "Bomb positions: uniform random, no replacement, independent each round.",
      "Bomb count: random between 30% and 55% of cells each round (production).",
      "Cell picks: your choice in manual mode — no bias toward bombs or safe cells.",
      "Multipliers: computed from exact probability — not adjusted per player mid-round.",
      "Zero-sum economics: your loss is house revenue; your win is house cost.",
      "No memory: winning or losing last round does not change bomb placement on the next round.",
    ],
  },
  {
    title: "14. How to Think About Patterns",
    body: [
      "Real patterns you CAN learn:",
      "• Math patterns — how P(r) and M(r) change as r grows (from payout table / this guide).",
      "• Strategy patterns — when YOU usually withdraw vs push, and how that affects your bankroll.",
      "• Variance patterns — how swingy your results are at different stakes and grid sizes.",
      "Fake patterns (gambler's fallacy — avoid these):",
      "• 'I lost 5 times so I'm due for a win.' — False. Each round is independent.",
      "• 'This corner always has bombs.' — False. Positions are random each shuffle.",
      "• 'The chart is green so the next pick is safe.' — False. Chart shows past totals, not next cell.",
      "• 'After a big win the game gets harder.' — False. RNG does not punish winners.",
      "Use /simulation to run 1,000+ games and SEE variance — that is the right way to learn.",
    ],
  },
  {
    title: "15. Profit Hints — Play Smarter (Not Magic)",
    body: [
      "Disclaimer: The game has a house edge. These tips reduce unnecessary losses and help discipline — they do not guarantee profit.",
      "1) Learn in simulation first. Run auto-sim with your grid and stake. Read realized RTP and EV table.",
      "2) Use smaller stakes for longer practice. Stake S = 1–2% of bankroll per round is a common conservative rule.",
      "3) Decide your cash-out round BEFORE you start. Example: 'I always withdraw after round 2.' Stick to it.",
      "4) Bigger grids + more bombs = lower P(r) per step but higher multipliers. More volatility, not better EV.",
      "5) Chasing losses (doubling stake after a bomb) grows risk fast. The math does not support martingale here.",
      "6) Set a session target AND a stop-loss in your head. Example: stop at +KES 50 or −KES 30 for the day.",
      "7) Withdraw when the multiplier matches your pre-set goal — greed after a safe pick is how bombs hurt most.",
      "8) Track session history weekly. If net is always negative over 50+ rounds, lower stake or play fewer rounds.",
    ],
  },
  {
    title: "16. Choosing When to Withdraw",
    body: [
      "Trade-off in one sentence: earlier withdraw = safer but smaller win; later withdraw = bigger prize but more bomb risk.",
      "Survival probability drops each round. Multiplier rises each round. EV stays near −edge × stake under fair math.",
      "Conservative style: withdraw at round 1–2. Lower variance, smaller wins, more 'boring' sessions.",
      "Aggressive style: push to round 4+. Rare big wins, frequent total losses.",
      "Smart middle: pick a round where P(r) still feels comfortable TO YOU (e.g. P ≥ 25%) and fix that as your rule.",
      "Formula to compare two strategies (same stake, many rounds):",
      "Average profit ≈ N × EV(strategy) where N = number of rounds played.",
      "Simulation lets you measure actual average profit for 'always stop at round k' without guessing.",
    ],
  },
  {
    title: "17. Bankroll & Session Target Math",
    body: [
      "Bankroll B = current wallet balance. Stake S per round.",
      "Rounds you can afford if you lose every time (worst case): floor(B / S).",
      "Session target T must satisfy T ≥ 2 × B (system rule). Profit if hit = T − B.",
      "Example: B = KES 100, T = KES 250 → profit goal = KES 150. You need a lucky streak, not a pattern.",
      "Progress % shown in UI: min(100, round(100 × displayBalance / T)).",
      "Do not raise stake to reach target faster — that increases bust probability superlinearly.",
    ],
  },
  {
    title: "18. Grid Size & Bomb Density",
    body: [
      "Production bombs: between 30% and 55% of total cells, randomized each round.",
      "More cells → more picks possible before clearing the board, but bomb count scales too.",
      "Small grid (3×4 = 12 cells): fast rounds, easier to read, higher variance per minute.",
      "Large grid (11×13 = 143 cells): very low P(r) for high r, huge multipliers if you survive deep (rare).",
      "For steady practice, mid presets (5×6 to 7×8) balance screen size and readable odds.",
      "Bomb % label in UI: round(bombs / total × 100). Use it to mentally adjust how risky the next pick feels.",
    ],
  },
  {
    title: "19. Simulation Tools for Learning",
    body: [
      "Payout table: round-by-round P(win), multiplier, potential balance, EV.",
      "EV chart: line of expected value vs round — see where EV is least negative or most negative.",
      "Win/loss pie: theoretical P(full target) vs P(bomb before target).",
      "Payout histogram: distribution of outcomes from auto-sim — see how rare big wins are.",
      "Economics trend: cumulative user vs admin — watch zero-sum mirror in real time.",
      "Excel export: Summary, Config, Economics trend, Players — analyze offline in spreadsheets.",
      "Workflow: Set grid → read theory → manual play 10 rounds → auto-sim 5,000 games → compare realized edge to 3%.",
    ],
  },
  {
    title: "20. User vs Admin Economics",
    body: [
      "Per round: userStake = S, userPayout = payout, userProfit = payout − S.",
      "adminRevenue = S − payout = −userProfit.",
      "Session totals sum all rounds. Green user bar and red admin bar are mirrors.",
      "realizedHouseEdge = adminNetRevenue / userTotalStaked — compare to configured 3%.",
      "Over 100+ rounds, realized edge should hover near 3% unless variance is huge (small sample).",
    ],
  },
  {
    title: "21. Algorithm Pseudocode",
    body: [
      "START ROUND: if balance < S → cannot play. Deduct S. Place bombs uniformly. status = playing.",
      "PICK(cell): if bomb → payout=0, lost. Else round++. potential = S × M(round).",
      "  If round = all safe cells → won, payout = potential. Else continue.",
      "WITHDRAW: if round ≥ 1 → payout = S × M(round), status = cashed_out.",
      "RECORD: net = payout − S. Update wallet. Append session row. Push chart tick.",
      "MULTIPLIER(round): P = consecutiveWinProbability(total, bombs, round). Return (1−edge)/P for linear mode.",
      "NEW ROUND: new random bomb count in [30%, 55%] of cells. New bomb positions. No carry-over.",
    ],
  },
  {
    title: "22. Default Values Reference",
    body: [
      "Production (/game): 3% house edge, linear multiplier, KES 10 free start, stake KES 5–9000.",
      "Default grid preset: 5×6. Bombs: 30–55% of cells per round.",
      "Simulation defaults: 5×5, 3 bombs, $10 stake, 3% edge, 5 win rounds, linear multiplier.",
      "Chart default timeframe: auto-picked from data span (~48 candles visible).",
      "Session history cap: 250 records per user (local). Simulation saved sessions: 50 in browser.",
    ],
  },
  {
    title: "23. Routes & UI Map",
    body: [
      "/game — live play (auth required).",
      "/game/chart — full-screen live candlestick chart.",
      "/game/history — full session table.",
      "/simulation — research dashboard, auto-sim, Excel export.",
      "Key components: BlockGamePlayerContext (live play), BlockGameSimulationContext (sim), BlockGameUniversalChart (shared chart), PlayerSessionTable / PlayerSessionPhonePanel (history).",
      "Math engine: client/src/lib/simulation/math.ts and engine.ts.",
      "Regenerate this PDF: node scripts/generate-simulation-guide-pdf.mjs",
    ],
  },
  {
    title: "24. Responsible Play Reminder",
    body: [
      "Treat stake money as entertainment cost, not income.",
      "The algorithm is designed so the house earns about 3% of all stakes over time.",
      "Short-term wins are normal (variance). Long-term profit as a player is statistically unlikely.",
      "Use simulation and session history to learn discipline — not to find 'secret' bomb layouts.",
      "If play stops being fun, lower stakes or take a break. Request funds only what you can afford to lose.",
    ],
  },
];

function buildPdf() {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 18;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const textW = pageW - margin * 2;
  let y = 0;

  const newPageIfNeeded = (needed = 12) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const drawFormula = (text) => {
    doc.setFillColor(245, 245, 250);
    const lines = doc.splitTextToSize(text, textW - 8);
    const boxH = lines.length * 5 + 6;
    newPageIfNeeded(boxH + 4);
    doc.rect(margin, y - 3, textW, boxH, "F");
    doc.setFont("courier", "normal");
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 60);
    let fy = y + 2;
    for (const line of lines) {
      doc.text(line, margin + 4, fy);
      fy += 5;
    }
    y = fy + 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 45);
  };

  // Cover
  doc.setFillColor(8, 8, 12);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setTextColor(230, 230, 235);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Block Game", margin, 42);
  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(167, 139, 250);
  doc.text("Complete Guide — Play, Charts, Math & Strategy", margin, 54);
  doc.setFontSize(10);
  doc.setTextColor(160, 160, 170);
  const coverLines = doc.splitTextToSize(
    "Everything in plain language: how the live game works, how charts read, the probability and multiplier algorithms, session history, simulation tools, and honest tips for smarter play. Written for players who want to understand the system — not chase fake patterns.",
    textW,
  );
  doc.text(coverLines, margin, 68);
  doc.setFontSize(9);
  doc.text("Routes: /game  ·  /game/chart  ·  /game/history  ·  /simulation", margin, 100);
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, pageH - 20);
  doc.text("TechantMedia — hannington-portfolio", margin, pageH - 14);

  doc.addPage();
  y = margin;
  doc.setTextColor(30, 30, 35);

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Table of Contents", margin, y);
  y += 10;
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  for (const s of SECTIONS) {
    newPageIfNeeded(6);
    doc.text(s.title, margin, y);
    y += 5.5;
  }
  y += 8;

  for (const section of SECTIONS) {
    newPageIfNeeded(20);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(88, 28, 135);
    const titleLines = doc.splitTextToSize(section.title, textW);
    for (const line of titleLines) {
      newPageIfNeeded(8);
      doc.text(line, margin, y);
      y += 7;
    }
    y += 2;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 45);

    for (const para of section.body) {
      const isFormula =
        para.startsWith("P(") ||
        para.startsWith("M(") ||
        para.startsWith("EV(") ||
        para.startsWith("Payout") ||
        para.startsWith("RTP") ||
        para.startsWith("base =") ||
        para.startsWith("Compact form:") ||
        para.startsWith("Average profit") ||
        para.startsWith("LINEAR") ||
        para.startsWith("PROGRESSIVE") ||
        (para.includes("= product") && para.includes("total"));

      if (isFormula) {
        drawFormula(para);
        continue;
      }

      const isBullet = para.startsWith("•") || /^\d+\)/.test(para);
      const indent = isBullet ? margin + 4 : margin;
      const wrapW = isBullet ? textW - 4 : textW;
      const lines = doc.splitTextToSize(para, wrapW);
      for (const line of lines) {
        newPageIfNeeded(6);
        doc.text(line, indent, y);
        y += 5;
      }
      y += 2.5;
    }
    y += 5;
  }

  newPageIfNeeded(15);
  doc.setDrawColor(200, 200, 210);
  doc.line(margin, y, pageW - margin, y);
  y += 8;
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 110);
  doc.text("TechantMedia Portfolio — Block Game Player & Simulation Guide", margin, y);
  y += 5;
  doc.text("Regenerate: node scripts/generate-simulation-guide-pdf.mjs", margin, y);

  return doc.output("arraybuffer");
}

mkdirSync(OUT_DIR, { recursive: true });
const buffer = buildPdf();
writeFileSync(OUT_FILE, Buffer.from(buffer));
console.log(`PDF written to: ${OUT_FILE}`);
