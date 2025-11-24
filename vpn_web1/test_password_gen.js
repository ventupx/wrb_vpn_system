import CryptoJS from 'crypto-js';
import { generate2022Blake3Aes256GcmKey } from './src/utils/password.js';

try {
    const key = generate2022Blake3Aes256GcmKey();
    console.log('Generated Key:', key);
    console.log('Length:', key.length);

    // Verify base64 decoding length using Buffer (Node.js)
    const decoded = Buffer.from(key, 'base64');
    console.log('Decoded Length:', decoded.length);

    if (decoded.length === 32) {
        console.log('SUCCESS: Key is 32 bytes.');
    } else {
        console.error('FAILURE: Key is not 32 bytes.');
        process.exit(1);
    }
} catch (error) {
    console.error('Error:', error);
    process.exit(1);
}
