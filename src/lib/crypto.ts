// Client-side cryptography module using browser Web Crypto API
// The server never sees the passwords or private keys.

export interface EncryptedPayload {
  encryptedKey: string;
  salt: string;
  iv: string;
}

// Helper to convert ArrayBuffer to Base64 in the browser
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Helper to convert Base64 to ArrayBuffer in the browser
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Encrypts a Stellar private/secret key client-side using a password.
 */
export async function encryptSecretKey(
  secretKey: string,
  password: string
): Promise<EncryptedPayload> {
  if (typeof window === "undefined" || !window.crypto || !window.crypto.subtle) {
    throw new Error("Web Crypto API is not supported in this environment");
  }

  const encoder = new TextEncoder();
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // 1. Import raw password as a cryptokey
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  // 2. Derive symmetric key from password + salt via PBKDF2
  const aesKey = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  // 3. Encrypt private key using AES-GCM
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    aesKey,
    encoder.encode(secretKey)
  );

  return {
    encryptedKey: arrayBufferToBase64(encryptedBuffer),
    salt: arrayBufferToBase64(salt.buffer),
    iv: arrayBufferToBase64(iv.buffer),
  };
}

/**
 * Decrypts a Stellar private/secret key client-side using the password.
 */
export async function decryptSecretKey(
  payload: EncryptedPayload,
  password: string
): Promise<string> {
  if (typeof window === "undefined" || !window.crypto || !window.crypto.subtle) {
    throw new Error("Web Crypto API is not supported in this environment");
  }

  const encoder = new TextEncoder();
  const salt = new Uint8Array(base64ToArrayBuffer(payload.salt));
  const iv = new Uint8Array(base64ToArrayBuffer(payload.iv));
  const encryptedData = base64ToArrayBuffer(payload.encryptedKey);

  // 1. Import raw password
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  // 2. Derive AES key
  const aesKey = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  try {
    // 3. Decrypt data
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      aesKey,
      encryptedData
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (error) {
    throw new Error("Decryption failed. Please verify your password.");
  }
}
