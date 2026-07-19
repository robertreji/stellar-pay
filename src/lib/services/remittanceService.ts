import 'server-only';
import { supabase } from "@/lib/supabase";

export interface RemittanceTx {
  id?: string;
  reference_id: string;
  sender_wallet: string;
  sender_username: string;
  recipient_name: string;
  recipient_upi: string;
  amount_usdc: number;
  exchange_rate: number;
  amount_inr: number;
  stellar_tx_hash?: string;
  status: 'pending' | 'payment_detected' | 'processing' | 'completed' | 'failed' | 'refunded';
  created_at?: string;
  completed_at?: string;
}

export async function createRemittance(
  params: Omit<RemittanceTx, 'id' | 'status' | 'created_at' | 'completed_at'>
): Promise<RemittanceTx> {
  const { data, error } = await supabase
    .from("remittance_transactions")
    .insert({
      reference_id: params.reference_id,
      sender_wallet: params.sender_wallet,
      sender_username: params.sender_username.toLowerCase(),
      recipient_name: params.recipient_name,
      recipient_upi: params.recipient_upi.trim(),
      amount_usdc: params.amount_usdc,
      exchange_rate: params.exchange_rate,
      amount_inr: params.amount_inr,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error("[remittanceService] Error creating remittance:", error);
    throw new Error(error.message || "Failed to create remittance transaction");
  }

  return data;
}

export async function getRemittancesByUsername(username: string): Promise<RemittanceTx[]> {
  const { data, error } = await supabase
    .from("remittance_transactions")
    .select("*")
    .eq("sender_username", username.toLowerCase())
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[remittanceService] Error fetching remittances by username:", error);
    throw new Error("Failed to fetch remittance records");
  }

  return data || [];
}

export async function getRemittanceByReferenceId(referenceId: string): Promise<RemittanceTx | null> {
  const { data, error } = await supabase
    .from("remittance_transactions")
    .select("*")
    .eq("reference_id", referenceId)
    .maybeSingle();

  if (error) {
    console.error("[remittanceService] Error fetching remittance by reference:", error);
    throw new Error("Failed to query transaction details");
  }

  return data || null;
}

export async function updateRemittanceStatus(
  referenceId: string,
  status: RemittanceTx['status'],
  stellarTxHash?: string
): Promise<RemittanceTx> {
  const isFinalState = ['completed', 'failed', 'refunded'].includes(status);
  const updates: Partial<RemittanceTx> = {
    status,
    ...(stellarTxHash ? { stellar_tx_hash: stellarTxHash } : {}),
    ...(isFinalState ? { completed_at: new Date().toISOString() } : {}),
  };

  const { data, error } = await supabase
    .from("remittance_transactions")
    .update(updates)
    .eq("reference_id", referenceId)
    .select()
    .single();

  if (error) {
    console.error("[remittanceService] Error updating status:", error);
    throw new Error(`Failed to update remittance status: ${error.message}`);
  }

  return data;
}
