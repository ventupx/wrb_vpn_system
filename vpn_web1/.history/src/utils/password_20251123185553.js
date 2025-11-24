/**
 * Generates a random 32-byte key for 2022-blake3-aes-256-gcm cipher.
 * @returns {string} Base64 encoded 32-byte key.
 */
export const generate2022Blake3Aes256GcmKey = () => {
  const arr = new Uint8Array(32);
  window.crypto.getRandomValues(arr);          // 1. 密码学级随机
  const base64 = btoa(String.fromCharCode(...arr)); // 2. 转 Base64
  // 转换为 Base64URL 格式（避免 + 和 / 字符）
  const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return base64url;
};
