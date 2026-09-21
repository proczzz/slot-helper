/**
 * 用來取得 jwt token，方便開發時手動測試google api行為
 * pwsh終端可使用指令來存成變數: $TOKEN = node --env-file=.env scripts/get-token.ts
 * 測試腳本不想配置 tsconfig(根目錄太大包了)，vscode 兩個 process 物件飄紅線正常請忽略
 */
import { SignJWT, importPKCS8 } from 'jose';

const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
const privateKey = process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n');
const now = Math.floor(Date.now() / 1000);

const jwt = await new SignJWT({
  iss: email,
  scope: 'https://www.googleapis.com/auth/calendar',
  aud: 'https://oauth2.googleapis.com/token',
  iat: now,
  exp: now + 3600,
})
  .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
  .sign(await importPKCS8(privateKey, 'RS256'));

const response = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  }),
});

const data = (await response.json()) as { access_token: string };
console.log(data.access_token);
