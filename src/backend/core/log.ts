// 錯誤只印一行:位置 | 類型: 訊息 | 最靠近我們的幾層堆疊。
// 完整堆疊大半是套件與 runtime 的內部,監控時只是噪音
const FRAMES = 3;

export function logError(where: string, error: unknown): void {
  if (!(error instanceof Error)) {
    console.error(`${where} | ${String(error)}`);
    return;
  }

  const frames = (error.stack ?? '')
    .split('\n')
    .slice(1, 1 + FRAMES)
    .map((line) => line.trim().replace(/^at /, ''))
    .join(' ← ');

  console.error(`${where} | ${error.name}: ${error.message}${frames ? ` | ${frames}` : ''}`);
}
