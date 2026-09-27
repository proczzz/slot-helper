export async function login(username: string, password: string): Promise<boolean> {
  const response = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return response.ok;
}

export async function logout(): Promise<void> {
  await fetch('/api/admin/logout', { method: 'POST' });
}

export async function isLoggedIn(): Promise<boolean> {
  const response = await fetch('/api/admin/me');
  return response.ok;
}

export async function getConfig(): Promise<Record<string, string>> {
  const response = await request('/api/admin/config');
  if (!response.ok) throw new Error('讀取設定失敗');
  return response.json();
}

export async function saveConfig(values: Record<string, string>): Promise<boolean> {
  const response = await request('/api/admin/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  });
  return response.ok;
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(path, init);
  if (response.status === 401) {
    window.location.href = '/login';
  }
  return response;
}
