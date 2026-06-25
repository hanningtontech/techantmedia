#!/usr/bin/env node
/**
 * Creates a $10/month GCP budget alert for hanningtonkutria-portfolio.
 * Run: pnpm setup:gcp-budget
 *
 * Manual steps (if CLI fails): see scripts/FIREBASE_BILLING_AUDIT_PROMPT.md
 */
import { execSync } from "node:child_process";

const PROJECT_ID = "hanningtonkutria-portfolio";
const BILLING_ACCOUNT = "013282-45E365-B4B6B0";
const BUDGET_NAME = "Hannington Portfolio $10 monthly";
const BUDGET_USD = 10;

function run(cmd) {
  console.log(`> ${cmd}`);
  return execSync(cmd, {
    stdio: "inherit",
    encoding: "utf8",
    env: { ...process.env, CLOUDSDK_CORE_PROJECT: PROJECT_ID },
  });
}

function runQuiet(cmd) {
  return execSync(cmd, {
    encoding: "utf8",
    env: { ...process.env, CLOUDSDK_CORE_PROJECT: PROJECT_ID },
  }).trim();
}

console.log("\n=== GCP $10/month budget setup ===\n");

try {
  run(`gcloud services enable billingbudgets.googleapis.com --project=${PROJECT_ID}`);

  const existing = runQuiet(
    `gcloud billing budgets list --billing-account=${BILLING_ACCOUNT} --format="value(displayName)" 2>nul || echo ""`,
  );
  if (existing.split("\n").some((n) => n.includes("Hannington Portfolio"))) {
    console.log("\nBudget already exists — skipping create.\n");
    process.exit(0);
  }

  run(
    [
      "gcloud billing budgets create",
      `--billing-account=${BILLING_ACCOUNT}`,
      `--display-name="${BUDGET_NAME}"`,
      `--budget-amount=${BUDGET_USD}USD`,
      "--threshold-rule=percent=0.5",
      "--threshold-rule=percent=0.9",
      "--threshold-rule=percent=1.0",
      `--filter-projects=projects/${PROJECT_ID}`,
    ].join(" "),
  );

  console.log("\nBudget created. Billing admins on the account receive email at 50%, 90%, and 100%.\n");
} catch (err) {
  console.error("\nCLI setup failed. Use the manual Console steps in scripts/FIREBASE_BILLING_AUDIT_PROMPT.md\n");
  process.exit(1);
}
