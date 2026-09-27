const ALGORITHM = 'pbkdf2-sha256';
// Workers 的 PBKDF2 迭代次數上限十萬，低於 OWASP 建議(60萬)但這是平台能做到的最大值
const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

// 格式:pbkdf2-sha256$迭代次數$鹽$雜湊。範例:
// pbkdf2-sha256$100000$b0DFv/ymn8TpwPQc1cB4Nw==$P8wmK4I+b+vjT08Aeppz0dqdQ46Xw652Jx1t3ZrNayI=
// └── 演算法 ──┘└迭代數┘└───── 鹽(base64) ──────┘└────────────── 雜湊(base64) ───────────────┘
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, ITERATIONS);
  return `${ALGORITHM}$${ITERATIONS}$${toBase64(salt)}$${hash}`;
}

export async function verifyPassword(stored: string, password: string): Promise<boolean> {
  const [algorithm, iterations, salt, hash] = stored.split('$');
  if (algorithm !== ALGORITHM || !iterations || !salt || !hash) return false;

  return (await derive(password, fromBase64(salt), Number(iterations))) === hash;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    KEY_BITS,
  );

  return toBase64(new Uint8Array(bits));
}

// ByteArray 轉 Base64
function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

// Base64 轉 ByteArray
function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}
