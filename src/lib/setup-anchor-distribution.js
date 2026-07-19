const { execSync } = require("child_process");
const StellarSdk = require("@stellar/stellar-sdk");
const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "..", "stellarpay.db");

async function main() {
  console.log("Starting Anchor Platform distribution account setup...");

  // 1. Get distribution account secret from stellar CLI
  let distSecret;
  try {
    distSecret = execSync("stellar keys secret ap-distribution-account").toString().trim();
    console.log("Found distribution account secret key via Stellar CLI.");
  } catch (e) {
    console.error("Error: Failed to retrieve ap-distribution-account secret from Stellar CLI. Ensure ap_start.sh has run first.");
    process.exit(1);
  }

  const distKeypair = StellarSdk.Keypair.fromSecret(distSecret);
  const distAddress = distKeypair.publicKey();
  console.log(`Distribution Account Public Address: ${distAddress}`);

  // 2. Get USDC issuer public key from config.json or database
  let usdcIssuerPublic = null;
  let usdcIssuerSecret = null;
  try {
    const fs = require("fs");
    const configPath = path.join(__dirname, "..", "..", "config.json");
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      usdcIssuerPublic = config.usdc_issuer_public || null;
      usdcIssuerSecret = config.usdc_issuer_secret || null;
      if (usdcIssuerPublic) {
        console.log("Loaded USDC issuer configuration from config.json.");
      }
    }
  } catch (e) {
    console.warn("Warning: Failed to read from config.json:", e.message);
  }

  if (!usdcIssuerPublic || !usdcIssuerSecret) {
    let db;
    try {
      db = new Database(DB_PATH);
      const row = db.prepare("SELECT value FROM config WHERE key = ?").get("usdc_issuer_public");
      usdcIssuerPublic = row ? row.value : null;

      const rowSecret = db.prepare("SELECT value FROM config WHERE key = ?").get("usdc_issuer_secret");
      usdcIssuerSecret = rowSecret ? rowSecret.value : null;
    } catch (e) {
      console.error("Error: Failed to read from SQLite database:", e);
      process.exit(1);
    }
  }

  if (!usdcIssuerPublic || !usdcIssuerSecret) {
    console.error("Error: USDC issuer not found in config.json or database. Run the wallet app first to initialize the database.");
    process.exit(1);
  }

  console.log(`USDC Issuer Address: ${usdcIssuerPublic}`);

  const horizon = new StellarSdk.Horizon.Server("https://horizon-testnet.stellar.org");
  const usdcAsset = new StellarSdk.Asset("USDC", usdcIssuerPublic);

  // 2B. Deploy Stellar Asset Contract (SAC) for the dynamic USDC asset
  console.log("Ensuring Stellar Asset Contract (SAC) is deployed for dynamic USDC...");
  try {
    execSync(
      `stellar contract asset deploy --asset USDC:${usdcIssuerPublic} --network testnet --source-account ap-distribution-account`,
      { stdio: "inherit" }
    );
    console.log("Stellar Asset Contract (SAC) deployed successfully.");
  } catch (e) {
    console.log("Stellar Asset Contract is already deployed or created.");
  }

  // 3. Establish Trustline
  console.log("Checking if trustline to USDC already exists...");

  try {
    const accountInfo = await horizon.loadAccount(distAddress);
    const hasTrustline = accountInfo.balances.some(
      b => b.asset_code === "USDC" && b.asset_issuer === usdcIssuerPublic
    );

    if (hasTrustline) {
      console.log("Trustline already exists. Skipping trustline creation.");
    } else {
      console.log("Creating trustline to USDC...");
      const tx = new StellarSdk.TransactionBuilder(accountInfo, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addOperation(
          StellarSdk.Operation.changeTrust({
            asset: usdcAsset,
          })
        )
        .setTimeout(180)
        .build();

      tx.sign(distKeypair);
      await horizon.submitTransaction(tx);
      console.log("USDC Trustline established successfully!");
    }
  } catch (e) {
    console.error("Error establishing trustline:", e.message || e);
    process.exit(1);
  }

  // 4. Fund with USDC
  console.log("Funding distribution account with USDC from local faucet...");
  try {
    const issuerKeypair = StellarSdk.Keypair.fromSecret(usdcIssuerSecret);
    const issuerAccount = await horizon.loadAccount(usdcIssuerPublic);

    const tx = new StellarSdk.TransactionBuilder(issuerAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: distAddress,
          asset: usdcAsset,
          amount: "10000.00",
        })
      )
      .setTimeout(180)
      .build();

    tx.sign(issuerKeypair);
    const res = await horizon.submitTransaction(tx);
    console.log(`Successfully funded distribution account with 10,000.00 USDC! Transaction hash: ${res.hash}`);
  } catch (e) {
    console.error("Error funding distribution account:", e.message || e);
    process.exit(1);
  }

  console.log("Anchor Platform distribution setup completed successfully!");
}

main().catch(console.error);
