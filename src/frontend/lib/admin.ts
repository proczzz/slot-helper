interface JSendBody<T> {
  status: 'success' | 'fail' | 'error';
  data?: T;
  message?: string;
}

export async function login(username: string, password: string): Promise<string | null> {
  const response = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (response.ok) return null;
  return toErrorMessage(await response.json());
}

export async function isLoggedIn(): Promise<boolean> {
  const response = await fetch('/api/admin/me');
  return response.ok;
}

export async function logout(): Promise<void> {
  await request('/api/admin/logout', { method: 'POST' });
}

export async function getConfig(): Promise<Record<string, string>> {
  const response = await request('/api/admin/config');
  const body = (await response.json()) as JSendBody<Record<string, string>>;
  if (body.status !== 'success') throw new Error('讀取設定失敗');
  return body.data ?? {};
}

export async function saveConfig(values: Record<string, string>): Promise<boolean> {
  const response = await request('/api/admin/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  });
  return response.ok;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<string | null> {
  const response = await request('/api/admin/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  });

  if (response.ok) return null;
  return toErrorMessage(await response.json());
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(path, init);
  if (response.status === 401) {
    window.location.href = '/login';
  }
  return response;
}

// fail 的 data 可能是字串或「欄位對應訊息」的物件,error 則是 message
function toErrorMessage(body: JSendBody<unknown>): string {
  if (body.status === 'fail') {
    if (typeof body.data === 'string') return body.data;
    if (body.data && typeof body.data === 'object') {
      return Object.values(body.data as Record<string, string>).join('\n');
    }
  }
  return body.message ?? '發生錯誤';
}
