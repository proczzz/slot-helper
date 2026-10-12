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

export type Section =
  | 'system'
  | 'ai'
  | 'shop'
  | 'line'
  | 'scheduling'
  | 'google-calendar'
  | 'outlook'
  | 'telegram'
  | 'whatsapp';

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

// system 區塊的 VO 與 Request 形狀相同 —— jwtSecret 由後端的 mapper 擋住,
// 前端從頭到尾不知道它存在
export interface SystemConfigVo {
  historyTurns: number;
  historyDays: number;
  maxSteps: number;
  fallbackReply: string;
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
  timeZone: string;
  businessHours: BusinessHours;
  services: Service[];
}

// GET 回來的:機密欄位只有尾碼,空字串代表尚未設定
export interface LineConfigVo {
  accessTokenMask: string;
  webhookSecretMask: string;
}

// PUT 送出的:只放老闆真的改過的欄位,沒放的後端會沿用舊值
export interface LineConfigRequest {
  accessToken?: string;
  webhookSecret?: string;
}

// GET 回來的。challengeToken 不遮罩 —— 老闆要讀回來貼進 Meta 的表單
export interface WhatsappConfigVo {
  accessTokenMask: string;
  webhookSecretMask: string;
  phoneNumberId: string;
  challengeToken: string;
}

// PUT 送出的:兩個機密欄位只在老闆按了變更時才放進來
export interface WhatsappConfigRequest {
  accessToken?: string;
  webhookSecret?: string;
  phoneNumberId: string;
  challengeToken: string;
}

// GET 回來的。通關密語是後端註冊 webhook 時自己產生的,老闆不會看到也不會填
export interface TelegramConfigVo {
  accessTokenMask: string;
  // 存字串而不是數字,它只會被原樣轉交給 Telegram
  chatId: string;
}

// PUT 送出的:accessToken 只在老闆按了變更時才放進來
export interface TelegramConfigRequest {
  accessToken?: string;
  chatId: string;
}

// 'scheduling' 這一列只記現在用哪個供應商,null 代表停用;
// 各供應商的設定在自己那一列,所以切換供應商不會蓋掉另一邊
export interface SchedulingSelection {
  provider: string | null;
}

// GET 回來的。私鑰是一整塊 PEM,尾碼沒有意義,所以只回「有沒有」——
// 「這是哪一組憑證」看 serviceAccountEmail 就知道,而那個本身不是機密
export interface GoogleCalendarVo {
  serviceAccountEmail: string;
  hasPrivateKey: boolean;
  calendarId: string;
}

// PUT 送出的:privateKey 只在老闆重新上傳金鑰檔時才放進來
export interface GoogleCalendarRequest {
  serviceAccountEmail: string;
  privateKey?: string;
  calendarId: string;
}

// GET 回來的。遮罩露前三碼,因為 Azure 的憑證列表也顯示前三碼,老闆才對得起來;
// 空字串代表尚未設定(SecretField 的協定)
export interface OutlookVo {
  clientId: string;
  clientSecretMask: string;
  calendarId: string;
}

// PUT 的語意是「沒送的欄位不變」,所以全部可選 ——
// 設定表單不送 calendarId、日曆下拉只送 calendarId
export interface OutlookRequest {
  clientId?: string;
  clientSecret?: string;
  calendarId?: string;
}

export interface OutlookCalendar {
  id: string;
  name: string;
  isDefault: boolean;
}

export async function getOutlookCalendars(): Promise<OutlookCalendar[]> {
  const response = await request('/api/admin/outlook/calendars');
  const body = (await response.json()) as JSendBody<OutlookCalendar[]>;
  if (body.status !== 'success') throw new Error(toErrorMessage(body));
  return body.data ?? [];
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const response = await request('/api/admin/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  });

  await assertOk(response);
}

// 授權狀態存在 scheduling-state 那一列,不走設定頁的通用端點(它不在白名單裡)
export interface OutlookConnection {
  connected: boolean;
  accountEmail: string;
}

export async function getOutlookConnection(): Promise<OutlookConnection> {
  const response = await request('/api/admin/outlook/connection');
  const body = (await response.json()) as JSendBody<OutlookConnection>;
  if (body.status !== 'success') throw new Error('讀取 Outlook 授權狀態失敗');
  return body.data ?? { connected: false, accountEmail: '' };
}

// redirectUri 由這裡用當下的 origin 算出來送上去 —— 它不是設定,
// 而是「這一次授權從哪個網域發起」,後端會連同 state 一起種進 cookie 交給 callback
export async function startOutlookAuthorize(redirectUri: string): Promise<string> {
  const response = await request('/api/admin/outlook/authorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ redirectUri }),
  });
  const body = (await response.json()) as JSendBody<{ url: string }>;
  if (body.status !== 'success' || !body.data) throw new Error(toErrorMessage(body));
  return body.data.url;
}

export async function disconnectOutlook(): Promise<void> {
  const response = await request('/api/admin/outlook/connection', { method: 'DELETE' });
  await assertOk(response);
}

export interface EventLabel {
  id: string;
  name: string;
  color?: string; // 色碼。供應商給不出來時會省略
}

export async function getCalendarLabels(): Promise<EventLabel[]> {
  const response = await request('/api/admin/calendar/labels');
  const body = (await response.json()) as JSendBody<EventLabel[]>;
  if (body.status !== 'success') throw new Error('讀取日曆標籤失敗');
  return body.data ?? [];
}

export interface WebhookInfo {
  url: string;
  pendingUpdateCount: number;
  lastErrorMessage?: string;
  lastErrorAt?: string;
}

// 尚未設定 Telegram 時回 null
export async function getTelegramWebhook(): Promise<WebhookInfo | null> {
  const response = await request('/api/admin/telegram/webhook');
  const body = (await response.json()) as JSendBody<WebhookInfo | null>;
  if (body.status !== 'success') throw new Error('讀取 Webhook 狀態失敗');
  return body.data ?? null;
}

// 把 webhook 網址註冊給 Telegram。網址由前端給 —— 後端在反向代理或內網後台底下推不出正確的值
export async function registerTelegramWebhook(url: string): Promise<WebhookInfo> {
  const response = await request('/api/admin/telegram/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const body = (await response.json()) as JSendBody<WebhookInfo>;
  if (body.status !== 'success') throw new Error(toErrorMessage(body));
  return body.data!;
}

// 老闆設定 Telegram 後確認真的收得到。失敗時後端回 fail,訊息是 Telegram 的原文
export async function sendTelegramTest(): Promise<void> {
  const response = await request('/api/admin/telegram/test', { method: 'POST' });
  await assertOk(response);
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
  // fallback = AI 沒給出文字,顧客收到的是保底訊息
  role: 'user' | 'assistant' | 'fallback';
  content: string;
  timestamp: number;
  // 只有 assistant 的訊息有,而且舊資料是 null
  provider?: string | null;
  model?: string | null;
  trace?: string | null; // ReplyTrace 的 JSON 原文
}

// messages.trace 存的形狀。包成物件而不是裸陣列,
// 未來加 key(例如模型的思考過程)才不會變成兩種格式並存
export interface ReplyTrace {
  tools: ToolCallRecord[];
  reasoning?: ReasoningRecord[];
}

// 推理模型(deepseek-reasoner 這類)才有。同一輪的多段已在後端合併
export interface ReasoningRecord {
  step: number;
  text: string;
}

// error 有值代表失敗,output 與 error 都沒有代表步數用完、沒拿到結果
export interface ToolCallRecord {
  step: number;
  name: string;
  input: unknown;
  output?: unknown;
  error?: string;
}

// 參數順序對齊後端的 CustomerRepository.list
export async function listCustomers(
  limit: number,
  before?: number,
  channel?: string,
): Promise<Customer[]> {
  const query = new URLSearchParams({ limit: String(limit) });
  if (before !== undefined) query.set('before', String(before));
  if (channel) query.set('channel', channel);

  const response = await request(`/api/admin/customers?${query}`);
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
