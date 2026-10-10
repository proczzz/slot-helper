import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useAutoReset } from '../hooks/use-auto-reset.ts';
import {
  disconnectOutlook,
  getOutlookCalendars,
  getOutlookConnection,
  saveSection,
  startOutlookAuthorize,
  type OutlookRequest,
  type OutlookVo,
} from '../lib/admin.ts';
import { SecretField } from './SecretField.tsx';

export function OutlookForm({ config }: { config: OutlookVo }) {
  // 不是設定,而是「這一次授權從哪個網域發起」。老闆不能改 ——
  // 授權必須從和它同網域的後台發起,否則 callback 拿不到 state cookie
  const redirectUri = `${window.location.origin}/oauth/outlook/callback`;

  const [clientId, setClientId] = useState(config.clientId);
  // undefined 代表「不變更」,不會放進送出的 payload
  const [clientSecret, setClientSecret] = useState<string | undefined>(
    config.clientSecretMask ? undefined : '',
  );
  const [calendarId, setCalendarId] = useState(config.calendarId);
  const queryClient = useQueryClient();

  const changed =
    clientSecret !== undefined || clientId !== config.clientId || calendarId !== config.calendarId;
  const incomplete = !clientId || clientSecret === '';
  // 授權要用後端已儲存的設定,所以改過還沒存時不能連結
  const stored = !!config.clientId && !!config.clientSecretMask;

  // 日曆清單要連結完才列得出來。這個 key 和 ConnectionSection 裡的相同,
  // React Query 共用快取,不會重複請求
  const connection = useQuery({
    queryKey: ['outlook-connection'],
    queryFn: getOutlookConnection,
    enabled: stored,
  });
  const connected = connection.data?.connected === true;

  const calendars = useQuery({
    queryKey: ['outlook-calendars'],
    queryFn: getOutlookCalendars,
    enabled: connected,
  });

  const save = useMutation({
    mutationFn: (next: OutlookRequest) => saveSection('outlook', next),
    onSuccess: () => {
      setClientSecret(undefined);
      void queryClient.invalidateQueries({ queryKey: ['config', 'calendar'] });
      // 換了日曆,店家設定頁讀的標籤清單也跟著變
      void queryClient.invalidateQueries({ queryKey: ['calendar-labels'] });
    },
  });

  useAutoReset(save);

  let calendarHint;
  if (!connected) {
    calendarHint = <p className="label">連結 Outlook 帳號之後才能選擇日曆</p>;
  } else if (calendars.isError) {
    calendarHint = <p className="label text-error">{calendars.error.message}</p>;
  } else {
    calendarHint = <p className="label">建議另開一本只放預約與臨時休假的日曆</p>;
  }

  return (
    <div className="flex flex-col gap-4 border-t border-base-300 pt-4">
      <div className="alert alert-info text-sm">
        <ol className="list-decimal space-y-1 pl-4">
          <li>
            到 Azure Portal 註冊應用程式，支援帳戶類型選「任何組織目錄 + 個人 Microsoft 帳戶」
          </li>
          <li>「驗證」頁面新增「Web」平台，重新導向 URI 貼下面那個網址 —— 必須完全一致</li>
          <li>「憑證及祕密」建立用戶端密碼（最長 24 個月），把 Client ID 與密碼填進下面並儲存</li>
          <li>按「連結 Outlook」同意授權，回來之後選擇預約日曆再儲存一次</li>
        </ol>
      </div>

      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();

          const next: OutlookRequest = { clientId, calendarId };
          if (clientSecret !== undefined) next.clientSecret = clientSecret;
          save.mutate(next);
        }}
      >
        <fieldset className="fieldset">
          <legend className="fieldset-legend">應用程式 (用戶端) ID</legend>
          <input
            type="text"
            className="input w-full font-mono text-xs"
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            spellCheck={false}
            placeholder="00000000-0000-0000-0000-000000000000"
          />
          <p className="label">Azure 應用程式「概觀」頁面上的那一組 GUID</p>
        </fieldset>

        <SecretField
          label="用戶端密碼"
          mask={config.clientSecretMask}
          value={clientSecret}
          onChange={setClientSecret}
          hint="Azure 只在建立當下顯示完整的值,之後只看得到前三碼"
        />

        <fieldset className="fieldset">
          <legend className="fieldset-legend">預約日曆</legend>
          <select
            className="select w-full"
            value={calendarId}
            disabled={!connected || calendars.isPending}
            onChange={(event) => setCalendarId(event.target.value)}
          >
            <option value="">尚未選擇</option>
            {/* 還沒連結時清單是空的,但已經存過的值要留在選項裡,畫面才不會看起來沒選 */}
            {!connected && calendarId && <option value={calendarId}>目前選擇的日曆</option>}
            {(calendars.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.isDefault ? '（預設）' : ''}
              </option>
            ))}
          </select>
          {calendarHint}
        </fieldset>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={save.isPending || !changed || incomplete}
        >
          {save.isPending && <span className="loading loading-spinner" />}
          儲存
        </button>
      </form>

      <div className="mt-2 border-t border-base-300 pt-4">
        <p className="mb-2 text-sm font-medium">重新導向 URI</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-box bg-base-200 px-3 py-2 font-mono text-xs break-all">
            {redirectUri}
          </code>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => void navigator.clipboard.writeText(redirectUri)}
          >
            複製
          </button>
        </div>
        <p className="mt-1 text-xs opacity-60">
          貼到 Azure「驗證」頁面的重新導向 URI，兩邊必須完全一致。這個值由你現在開後台的網址決定，
          所以授權也要從這個網址操作
        </p>
      </div>

      <ConnectionSection stored={stored} changed={changed} redirectUri={redirectUri} />

      {save.isSuccess && (
        <div className="toast toast-end">
          <div className="alert alert-success">已儲存</div>
        </div>
      )}

      {save.isError && (
        <div className="toast toast-end">
          <div className="alert alert-error">{save.error.message}</div>
        </div>
      )}
    </div>
  );
}

function ConnectionSection({
  stored,
  changed,
  redirectUri,
}: {
  stored: boolean;
  changed: boolean;
  redirectUri: string;
}) {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['outlook-connection'],
    queryFn: getOutlookConnection,
    enabled: stored,
  });
  const queryClient = useQueryClient();

  const connect = useMutation({
    mutationFn: async () => {
      // 後端產生 state、把 state 與 redirectUri 種成 cookie,回網址讓我們整頁跳轉
      window.location.assign(await startOutlookAuthorize(redirectUri));
    },
  });

  const disconnect = useMutation({
    mutationFn: disconnectOutlook,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['outlook-connection'] });
      void queryClient.invalidateQueries({ queryKey: ['outlook-calendars'] });
    },
  });

  // enabled: false 的 query 會永遠停在 isPending,所以這個分支必須排在前面
  if (!stored) {
    return (
      <Section>
        <p className="label">先填好上面的設定並儲存，才能連結 Outlook 帳號</p>
      </Section>
    );
  }

  if (isPending) {
    return (
      <Section>
        <span className="loading loading-spinner loading-sm" />
      </Section>
    );
  }

  if (isError) {
    return (
      <Section>
        <div className="alert alert-error">
          <span className="text-sm">{error.message}</span>
        </div>
      </Section>
    );
  }

  // 動作在左、狀態在右,和 Telegram 的「註冊 Webhook + 已註冊」同一個排法
  let action;
  let badge;
  if (data.connected) {
    action = (
      <button
        type="button"
        className="btn btn-sm btn-error btn-soft"
        disabled={disconnect.isPending}
        onClick={() => disconnect.mutate()}
      >
        {disconnect.isPending && <span className="loading loading-spinner loading-xs" />}
        解除連結
      </button>
    );
    badge = <span className="badge badge-success badge-soft">已連結</span>;
  } else {
    action = (
      <button
        type="button"
        className="btn btn-sm"
        disabled={connect.isPending || changed}
        onClick={() => connect.mutate()}
      >
        {connect.isPending && <span className="loading loading-spinner loading-xs" />}
        連結 Outlook
      </button>
    );
    badge = <span className="badge badge-ghost">未連結</span>;
  }

  return (
    <Section>
      <div className="flex items-center gap-2">
        {action}
        {badge}
      </div>

      {data.accountEmail && (
        <p className="label font-mono text-xs break-all">帳號：{data.accountEmail}</p>
      )}

      {changed && !data.connected && (
        <p className="label text-warning">上面的設定改過還沒儲存，先儲存再連結</p>
      )}

      {connect.isError && (
        <div className="alert alert-error mt-2">
          <span className="whitespace-pre-wrap text-sm">{connect.error.message}</span>
        </div>
      )}

      {disconnect.isError && (
        <div className="alert alert-error mt-2">
          <span className="whitespace-pre-wrap text-sm">{disconnect.error.message}</span>
        </div>
      )}
    </Section>
  );
}

function Section({ children }: { children: ReactNode }) {
  return (
    <fieldset className="fieldset border-t border-base-300 pt-4">
      <legend className="fieldset-legend">Outlook 帳號授權</legend>
      {children}
    </fieldset>
  );
}
