/**
 * PasswordCat Chrome Extension - Crypto Utilities
 * 采用 AES-GCM 加密，密钥派生使用 PBKDF2
 */

const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;
const ITERATIONS = 100000;

// 将字符串转为 ArrayBuffer
function stringToBuffer(str) {
  return new TextEncoder().encode(str);
}

// 将 ArrayBuffer 转为字符串
function bufferToString(buffer) {
  return new TextDecoder().decode(buffer);
}

// 将 ArrayBuffer 转为 Base64
function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Base64 转 ArrayBuffer
function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// 生成随机盐
function generateSalt() {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

// 生成随机 IV
function generateIV() {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}

// 从主密码派生加密密钥
async function deriveKey(password, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    stringToBuffer(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

// 加密数据
async function encrypt(data, password, salt) {
  const key = await deriveKey(password, salt);
  const iv = generateIV();
  const encodedData = stringToBuffer(JSON.stringify(data));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encodedData
  );
  
  // 返回: salt + iv + ciphertext
  const saltBuffer = new Uint8Array(salt);
  const ivBuffer = new Uint8Array(iv);
  const encryptedBuffer = new Uint8Array(encrypted);
  
  const result = new Uint8Array(SALT_LENGTH + IV_LENGTH + encryptedBuffer.length);
  result.set(saltBuffer, 0);
  result.set(ivBuffer, SALT_LENGTH);
  result.set(encryptedBuffer, SALT_LENGTH + IV_LENGTH);
  
  return bufferToBase64(result.buffer);
}

// 解密数据
async function decrypt(encryptedBase64, password) {
  const encryptedBuffer = new Uint8Array(base64ToBuffer(encryptedBase64));
  
  // 提取 salt, iv, ciphertext
  const salt = encryptedBuffer.slice(0, SALT_LENGTH);
  const iv = encryptedBuffer.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const ciphertext = encryptedBuffer.slice(SALT_LENGTH + IV_LENGTH);
  
  const key = await deriveKey(password, salt);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    ciphertext
  );
  
  return JSON.parse(bufferToString(decrypted));
}

// 生成随机密码
function generatePassword(length = 16, options = {}) {
  const {
    uppercase = true,
    lowercase = true,
    numbers = true,
    symbols = true
  } = options;
  
  let chars = '';
  if (uppercase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (lowercase) chars += 'abcdefghijklmnopqrstuvwxyz';
  if (numbers) chars += '0123456789';
  if (symbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  if (!chars) chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  
  const randomValues = crypto.getRandomValues(new Uint8Array(length));
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars[randomValues[i] % chars.length];
  }
  
  return password;
}

// 导出模块
window.PasswordCatCrypto = {
  encrypt,
  decrypt,
  generatePassword,
  generateSalt
};
