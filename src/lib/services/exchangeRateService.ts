import 'server-only';

export interface ExchangeRates {
  usdToInr: number;              // Raw market USD -> INR
  aedToInr: number;              // Raw market AED -> INR
  usdToInrWithSpread: number;    // Offered USD -> INR (with spread deducted)
  aedToInrWithSpread: number;    // Offered AED -> INR (with spread deducted)
  spread: number;
}

const FALLBACK_USD_TO_INR = 83.50;
const FALLBACK_AED_TO_INR = 22.73;
const SPREAD = 0.0075; // 0.75% profit spread for the anchor

export async function getExchangeRates(): Promise<ExchangeRates> {
  let usdToInr = FALLBACK_USD_TO_INR;
  let aedToInr = FALLBACK_AED_TO_INR;

  try {
    // Fetch live USD rates from a public rates endpoint
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 300 } // cache rates for 5 minutes
    });
    if (res.ok) {
      const data = await res.json();
      if (data.rates && data.rates.INR) {
        usdToInr = data.rates.INR;
        if (data.rates.AED) {
          aedToInr = usdToInr / data.rates.AED;
        }
      }
    }
  } catch (err) {
    console.warn("[exchangeRateService] Failed to fetch live rates, falling back to mock defaults:", err);
  }

  // Deduct spread from the rate offered to the user (Anchor conversion profit)
  const usdToInrWithSpread = usdToInr * (1 - SPREAD);
  const aedToInrWithSpread = aedToInr * (1 - SPREAD);

  return {
    usdToInr,
    aedToInr,
    usdToInrWithSpread: parseFloat(usdToInrWithSpread.toFixed(4)),
    aedToInrWithSpread: parseFloat(aedToInrWithSpread.toFixed(4)),
    spread: SPREAD,
  };
}
