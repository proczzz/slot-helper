import z from 'zod';
import type { TokenStore } from './types';

// 授權需要這兩個
export const OutlookOauthSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
});

export type OutlookOauthSettings = z.infer<typeof OutlookOauthSchema>;

// 存在 scheduling-state 那一列的形狀
const OutlookStateSchema = z.object({
  refreshToken: z.string().min(1),
  accountEmail: z.string().default(''),
});

export type OutlookState = z.infer<typeof OutlookStateSchema>;

// TokenStore 存的是字串、形狀由供應商自己決定,所以解析也歸這裡
export function parseOutlookState(raw: string | null): OutlookState | null {
  if (!raw) return null;

  try {
    const parsed = OutlookStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null; // 存著的不是 JSON,當成還沒連結
  }
}

export interface OutlookTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

// common 才同時接受個人與組織帳號
const AUTHORITY = 'https://login.microsoftonline.com/common/oauth2/v2.0';
const ME_URL = 'https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName';

// offline_access 是拿到 refresh token 的唯一開關;User.Read 只為了顯示連到哪個帳號
const SCOPES = [
  'openid',
  'offline_access',
  'https://graph.microsoft.com/Calendars.ReadWrite',
  'https://graph.microsoft.com/User.Read',
].join(' ');

// 老闆的瀏覽器要去的網址
export function buildAuthorizeUrl(
  settings: OutlookOauthSettings,
  redirectUri: string,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: settings.clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: SCOPES,
    state,
  });

  return `${AUTHORITY}/authorize?${params.toString()}`;
}

// 還沒有 refresh token，用 callback 時拿到的code領第一張refresh token + access token
export function exchangeCode(
  settings: OutlookOauthSettings,
  redirectUri: string,
  code: string,
): Promise<OutlookTokens> {
  return requestTokens(settings, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri, // 必須和授權時送的一模一樣
  });
}

// 有舊refresh token，拿去換新的(因為90天過期) + access token
export function refreshTokens(
  settings: OutlookOauthSettings,
  refreshToken: string,
): Promise<OutlookTokens> {
  return requestTokens(settings, {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
}

let cachedToken: { refreshToken: string; accessToken: string; expiresAt: number } | null = null;

// 讀出存著的 refresh token,必要時刷新並寫回。回 null 代表還沒連結(預期狀態,不是錯誤)
export async function getAccessToken(
  settings: OutlookOauthSettings,
  tokens: TokenStore,
): Promise<string | null> {
  const state = parseOutlookState(await tokens.get());
  if (!state) return null;

  if (
    cachedToken &&
    cachedToken.refreshToken === state.refreshToken &&
    cachedToken.expiresAt > Date.now() + 60_000
  ) {
    return cachedToken.accessToken;
  }

  const fresh = await refreshTokens(settings, state.refreshToken);

  // 換到的新 refresh token 一定要寫回去,否則下次還是用舊的那顆,90 天後就過期了
  const next: OutlookState = { ...state, refreshToken: fresh.refreshToken };
  await tokens.set(JSON.stringify(next));

  cachedToken = {
    refreshToken: fresh.refreshToken,
    accessToken: fresh.accessToken,
    expiresAt: fresh.expiresAt,
  };

  console.log('Outlook: 已更新快取token');
  return fresh.accessToken;
}

// 顯示用的,拿不到不該讓整個授權失敗。個人帳號的 mail 可能是空的,退回 userPrincipalName
export async function fetchAccountEmail(accessToken: string): Promise<string> {
  const response = await fetch(ME_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return '';

  const data = (await response.json()) as { mail?: string; userPrincipalName?: string };
  return data.mail ?? data.userPrincipalName ?? '';
}

// 兩種 grant 的差別只有那兩三個欄位,其餘完全相同
async function requestTokens(
  settings: OutlookOauthSettings,
  grant: Record<string, string>,
): Promise<OutlookTokens> {
  const response = await fetch(`${AUTHORITY}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: settings.clientId,
      client_secret: settings.clientSecret,
      scope: SCOPES,
      ...grant,
    }),
  });

  if (!response.ok) {
    // 原因在 error_description,裡面有 AADSTSxxxxx 代碼,比我們自己編的訊息有用
    const body = (await response.json().catch(() => null)) as { error_description?: string } | null;
    throw new Error(`Outlook 取得權杖失敗: ${body?.error_description ?? response.status}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}
