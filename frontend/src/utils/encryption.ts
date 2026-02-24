// Frontend encryption utility (same key as backend)
// Uses Web Crypto API to match backend's AES-256-CBC format
const ENCRYPTION_KEY = 'A7f@9Kx#2Lm$8Qp!4Zr&1Ty*6Uv%3Bn^0Ws'

/**
 * Derive encryption key from password (matches backend SHA-256 hash)
 */
async function deriveKey(): Promise<CryptoKey> {
  // Hash the key to get 32 bytes (SHA-256)
  const keyData = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ENCRYPTION_KEY))
  
  // Import as raw key for AES-CBC
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-CBC' },
    false,
    ['encrypt']
  )
}

/**
 * Encrypt data using AES-256-CBC (matches backend format)
 * Returns: IV:encrypted (both in hex)
 */
export async function encryptData(text: string): Promise<string> {
  try {
    if (!crypto.subtle) {
      throw new Error('Web Crypto API not available')
    }

    const key = await deriveKey()
    
    // Generate random IV (16 bytes for AES-CBC)
    const iv = crypto.getRandomValues(new Uint8Array(16))
    
    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-CBC', iv },
      key,
      new TextEncoder().encode(text)
    )
    
    // Convert IV and encrypted data to hex strings
    const ivHex = Array.from(iv)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    
    const encryptedHex = Array.from(new Uint8Array(encrypted))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    
    // Return in format: IV:encrypted (matches backend)
    return ivHex + ':' + encryptedHex
  } catch (error) {
    console.error('Encryption error:', error)
    throw new Error('Failed to encrypt data')
  }
}
