interface JSendBody<T> {
  status: 'success' | 'fail' | 'error';
  data?: T;
  message?: string;
}

// 帳號密碼錯誤是預期中的結果而非例外,所以回傳訊息而不拋錯
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

export type Section = 'ai' | 'shop' | 'line' | 'scheduling';

export async function getSection<T>(section: Section): Promise<T | null> {
  const response = await request(`/api/admin/config/${section}`);
  const body = (await response.json()) as JSendBody<T | null>;
  if (body.status !== 'success') throw new Error(`讀取 ${section} 設定失敗`);
  return body.data ?? null;
}

export async function saveSection<T>(section: Section, data: T): Promise<void> {
  const response = await request(`/api/admin/config/${section}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  await assertOk(response);
}

export interface AiKey {
  name: string;
  provider: string;
  apiKey: string;
  model: string;
}

export type Period = [string, string];

export interface BusinessHours {
  mon: Period[];
  tue: Period[];
  wed: Period[];
  thu: Period[];
  fri: Period[];
  sat: Period[];
  sun: Period[];
}

export type DayKey = keyof BusinessHours;

export interface Service {
  name: string;
  minutes: number;
  price: number;
  labelId: string;
}

export interface ShopConfig {
  instructions: string;
  businessHours: BusinessHours;
  services: Service[];
}

export interface LineConfig {
  channelSecret: string;
  accessToken: string;
}

export interface SchedulingConfig {
  provider: string;
  settings: {
    serviceAccountEmail: string;
    privateKey: string;
    calendars: { id: string; name: string }[];
  };
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const response = await request('/api/admin/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  });

  await assertOk(response);
}

export interface EventLabel {
  id: string;
  name: string;
  color: string;
}

export async function getCalendarLabels(): Promise<EventLabel[]> {
  const response = await request('/api/admin/calendar/labels');
  const body = (await response.json()) as JSendBody<EventLabel[]>;
  if (body.status !== 'success') throw new Error('讀取日曆標籤失敗');
  return body.data ?? [];
}

export async function listModels(provider: string, apiKey: string): Promise<string[]> {
  const response = await request('/api/admin/ai/models', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, apiKey }),
  });

  const body = (await response.json()) as JSendBody<string[]>;
  if (body.status !== 'success') throw new Error(toErrorMessage(body));
  return body.data ?? [];
}

export interface Customer {
  id: string;
  channel: string;
  name: string | null;
  displayName: string | null;
  pictureUrl: string | null;
  lastMessage: string | null;
  lastMessageAt: number | null;
}

export interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export async function listCustomers(before: number | null): Promise<Customer[]> {
  const query = before === null ? '' : `?before=${before}`;
  const response = await request(`/api/admin/customers${query}`);
  const body = (await response.json()) as JSendBody<Customer[]>;
  if (body.status !== 'success') throw new Error('讀取顧客清單失敗');
  return body.data ?? [];
}

export async function listMessages(customerId: string, before: number | null): Promise<Message[]> {
  const query = before === null ? '' : `?before=${before}`;
  const response = await request(
    `/api/admin/customers/${encodeURIComponent(customerId)}/messages${query}`,
  );
  const body = (await response.json()) as JSendBody<Message[]>;
  if (body.status !== 'success') throw new Error('讀取對話紀錄失敗');
  return body.data ?? [];
}

export function customerDisplayName(customer: Customer): string {
  return customer.displayName || customer.name || customer.id;
}

export async function createTestCustomer(id: string, name: string): Promise<void> {
  const response = await request('/api/admin/test-customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, name }),
  });

  await assertOk(response);
}

export async function sendTestMessage(sessionId: string, message: string): Promise<string> {
  const response = await request('/api/admin/test-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message }),
  });

  const body = (await response.json()) as JSendBody<{ reply: string }>;
  if (body.status !== 'success') throw new Error(toErrorMessage(body));
  return body.data?.reply ?? '';
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(path, init);
  if (response.status === 401) {
    window.location.href = '/login';
  }
  return response;
}

// 回應不是 2xx 就把 JSend 的訊息轉成例外。login 例外處理,見該函式
async function assertOk(response: Response): Promise<void> {
  if (response.ok) return;
  throw new Error(toErrorMessage(await response.json()));
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
