import 'server-only';
import { supabase } from "@/lib/supabase";

export interface Recipient {
  id?: string;
  username: string; // The username of the owner/sender
  name: string;
  upi_id: string;
  nickname?: string;
  is_favorite?: boolean;
  is_recent?: boolean;
  created_at?: string;
}

export async function getRecipients(username: string): Promise<Recipient[]> {
  const { data, error } = await supabase
    .from("recipients")
    .select("*")
    .eq("username", username.toLowerCase())
    .order("is_favorite", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[recipientService] Error fetching recipients:", error);
    throw new Error("Failed to fetch recipients");
  }

  return data || [];
}

export async function addRecipient(recipient: Omit<Recipient, 'id' | 'created_at'>): Promise<Recipient> {
  const normalizedUsername = recipient.username.toLowerCase();
  
  // Clean up format
  let upiId = recipient.upi_id.trim();
  if (upiId && !upiId.includes("@")) {
    upiId = `${upiId}@stellarbank`;
  }

  // Deduplicate: check if UPI ID is already saved for this user
  const { data: existing } = await supabase
    .from("recipients")
    .select("*")
    .eq("username", normalizedUsername)
    .eq("upi_id", upiId)
    .maybeSingle();

  if (existing) {
    // If it exists, update nickname/name if needed or just return it
    const { data: updated, error: updateErr } = await supabase
      .from("recipients")
      .update({
        name: recipient.name,
        nickname: recipient.nickname || existing.nickname,
        is_favorite: recipient.is_favorite !== undefined ? recipient.is_favorite : existing.is_favorite,
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (updateErr) {
      console.error("[recipientService] Error updating existing recipient:", updateErr);
      throw new Error(updateErr.message);
    }
    return updated;
  }

  const { data, error } = await supabase
    .from("recipients")
    .insert({
      username: normalizedUsername,
      name: recipient.name,
      upi_id: upiId,
      nickname: recipient.nickname || null,
      is_favorite: recipient.is_favorite || false,
      is_recent: recipient.is_recent || false,
    })
    .select()
    .single();

  if (error) {
    console.error("[recipientService] Error adding recipient:", error);
    throw new Error(error.message || "Failed to add recipient");
  }

  return data;
}

export async function updateRecipient(
  id: string,
  updates: Partial<Omit<Recipient, 'id' | 'username' | 'created_at'>>
): Promise<Recipient> {
  const { data, error } = await supabase
    .from("recipients")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[recipientService] Error updating recipient:", error);
    throw new Error(error.message || "Failed to update recipient");
  }

  return data;
}

export async function deleteRecipient(id: string): Promise<void> {
  const { error } = await supabase
    .from("recipients")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[recipientService] Error deleting recipient:", error);
    throw new Error(error.message || "Failed to delete recipient");
  }
}
