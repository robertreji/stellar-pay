import 'server-only';

export interface BankProvider {
  validateUpiId(upiId: string): Promise<{ success: boolean; name?: string; error?: string }>;
  payout(params: {
    fromAccount: string;
    toAccount: string;
    amountUsd: number;
    referenceId: string;
    idempotencyKey: string;
  }): Promise<{ success: boolean; transferId?: string; error?: string }>;
}

export class SimulatedBankAdapter implements BankProvider {
  private bankUrl: string;
  private bankApiKey: string;

  constructor() {
    this.bankUrl = process.env.BANK_URL || "https://localhost:3001";
    this.bankApiKey = process.env.BANK_API_KEY || "";
  }

  // Parse accountId from upiId. E.g. "robert@stellarbank" -> "robert"
  private parseAccountId(upiId: string): string {
    const clean = upiId.trim();
    if (clean.includes("@")) {
      return clean.split("@")[0].toLowerCase();
    }
    return clean.toLowerCase();
  }

  async validateUpiId(upiId: string): Promise<{ success: boolean; name?: string; error?: string }> {
    const accountId = this.parseAccountId(upiId);
    if (!accountId) {
      return { success: false, error: "Invalid UPI ID format. Expected format: username@stellarbank" };
    }

    try {
      const url = `${this.bankUrl}/api/bank/balance?accountId=${encodeURIComponent(accountId)}`;
      console.log(`[bankService] Checking account validation at: ${url}`);
      
      let response = await fetch(url, {
        headers: {
          ...(this.bankApiKey ? { Authorization: `Bearer ${this.bankApiKey}` } : {}),
        },
      });

      if (response.status === 404) {
        const mockups = ["rohit", "anita", "priya", "manoj", "neha"];
        if (mockups.includes(accountId)) {
          console.log(`[bankService] Mockup account ${accountId} not found. Registering on the fly...`);
          const regUrl = `${this.bankUrl}/api/bank/register`;
          const regRes = await fetch(regUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              accountId,
              name: accountId.charAt(0).toUpperCase() + accountId.slice(1),
              password: "password123",
              initialBalance: 50000.0,
            }),
          });
          if (regRes.ok) {
            response = await fetch(url, {
              headers: {
                ...(this.bankApiKey ? { Authorization: `Bearer ${this.bankApiKey}` } : {}),
              },
            });
          }
        } else {
          return { success: false, error: "Recipient UPI ID not found in bank simulator." };
        }
      }

      if (response.status === 404) {
        return { success: false, error: "Recipient UPI ID not found in bank simulator." };
      }

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `Bank service validation error: ${errorText}` };
      }

      const data = await response.json();
      return { success: true, name: data.name };
    } catch (err: any) {
      console.error("[bankService] UPI ID validation catch-error:", err);
      return { success: false, error: err.message || "Failed to contact bank simulator." };
    }
  }

  async payout(params: {
    fromAccount: string;
    toAccount: string;
    amountUsd: number;
    referenceId: string;
    idempotencyKey: string;
  }): Promise<{ success: boolean; transferId?: string; error?: string }> {
    const toAccountId = this.parseAccountId(params.toAccount);
    
    try {
      const url = `${this.bankUrl}/api/transfers`;
      console.log(`[bankService] Executing payout to ${toAccountId} of ${params.amountUsd} USD...`);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.bankApiKey ? { Authorization: `Bearer ${this.bankApiKey}` } : {}),
        },
        body: JSON.stringify({
          from_account: params.fromAccount,
          to_account: toAccountId,
          amount: params.amountUsd,
          currency: "USD",
          reference_id: params.referenceId,
          idempotency_key: params.idempotencyKey,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        // If conflict (409) is returned, it means transfer was already executed. Treat as success.
        if (response.status === 409) {
          console.log(`[bankService] Payout already executed for ref ${params.referenceId}.`);
          return { success: true, transferId: data.transfer_id };
        }
        return { success: false, error: data.error || "Bank simulator transfer failed." };
      }

      return { success: true, transferId: data.transfer_id };
    } catch (err: any) {
      console.error("[bankService] Payout catch-error:", err);
      return { success: false, error: err.message || "Failed to contact bank simulator during payout." };
    }
  }
}

// Export the default active provider instance
export const bankService: BankProvider = new SimulatedBankAdapter();
