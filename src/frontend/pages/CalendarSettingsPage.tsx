import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { GoogleCalendarForm } from '../components/GoogleCalendarForm.tsx';
import { OutlookForm } from '../components/OutlookForm.tsx';
import { useAutoReset } from '../hooks/use-auto-reset.ts';
import {
  getSection,
  saveSection,
  type GoogleCalendarVo,
  type OutlookVo,
  type SchedulingSelection,
} from '../lib/admin.ts';

const GOOGLE = 'google-calendar';
const OUTLOOK = 'outlook';

// 新增供應商 = 這裡加一行 + 下面多掛一個設定表單,並和後端的 providers 表保持一致
const PROVIDERS = [
  { value: GOOGLE, label: 'Google 日曆' },
  { value: OUTLOOK, label: 'Outlook 日曆' },
];

// 後端回的是原樣存進去的 JSON,schema 新增欄位後舊資料會缺欄位,所以用常數補齊
const EMPTY_GOOGLE: GoogleCalendarVo = {
  serviceAccountEmail: '',
  hasPrivateKey: false,
  calendarId: '',
};

const EMPTY_OUTLOOK: OutlookVo = {
  clientId: '',
  clientSecretMask: '',
  calendarId: '',
};

// OAuth callback 用 query param 回報結果,因為那是一次頁面導覽而不是 API 呼叫
const OAUTH_RESULTS: Partial<Record<string, { text: string; failed: boolean }>> = {
  connected: { text: 'Outlook 已連結', failed: false },
  invalid_state: { text: '授權驗證失敗，請重新按一次「連結 Outlook」', failed: true },
  not_configured: { text: '請先儲存 Outlook 設定再連結', failed: true },
  failed: { text: '授權失敗，請確認 Azure 的重新導向 URI 與用戶端密碼是否正確', failed: true },
};

export function CalendarSettingsPage() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['config', 'calendar'],
    // 指標與各供應商的設定分成不同列,要一起拿回來才知道現在用的是哪一家
    queryFn: async () => {
      const [selection, google, outlook] = await Promise.all([
        getSection<SchedulingSelection>('scheduling'),
        getSection<GoogleCalendarVo>(GOOGLE),
        getSection<OutlookVo>(OUTLOOK),
      ]);

      return {
        provider: selection?.provider ?? null,
        google: { ...EMPTY_GOOGLE, ...google },
        outlook: { ...EMPTY_OUTLOOK, ...outlook },
      };
    },
  });

  if (isPending) {
    return (
      <div className="grid place-items-center p-12">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="alert alert-error mx-auto w-full max-w-3xl">
        <span>{error.message}</span>
      </div>
    );
  }

  return <CalendarSettings saved={data.provider} google={data.google} outlook={data.outlook} />;
}

function CalendarSettings({
  saved,
  google,
  outlook,
}: {
  saved: string | null;
  google: GoogleCalendarVo;
  outlook: OutlookVo;
}) {
  const [provider, setProvider] = useState(saved);
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: (next: string | null) => saveSection('scheduling', { provider: next }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['config', 'calendar'] });
      // 換了供應商,店家設定頁讀的標籤清單也跟著變
      void queryClient.invalidateQueries({ queryKey: ['calendar-labels'] });
    },
    // 沒存成功就把畫面退回去,不然選單顯示的和後端的不一致
    onError: () => setProvider(saved),
  });

  useAutoReset(save);

  // 這一列只有一個欄位,沒有「填完再送出」的階段,所以選了就存
  function changeProvider(next: string | null) {
    setProvider(next);
    save.mutate(next);
  }

  const result = OAUTH_RESULTS[params.get('oauth') ?? ''];

  return (
    <div className="card mx-auto w-full max-w-3xl bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <h2 className="card-title">日曆設定</h2>

        {/* 授權的結果屬於這個區塊而不是一次操作的成敗,所以不用 toast、也不自動消失 */}
        {result && (
          <div className={`alert ${result.failed ? 'alert-error' : 'alert-success'}`}>
            <span className="text-sm">{result.text}</span>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => {
                params.delete('oauth');
                setParams(params);
              }}
            >
              關閉
            </button>
          </div>
        )}

        <fieldset className="fieldset">
          <legend className="fieldset-legend">使用的日曆服務</legend>
          <select
            className="select w-full"
            value={provider ?? ''}
            disabled={save.isPending}
            onChange={(event) => changeProvider(event.target.value || null)}
          >
            <option value="">不啟用預約功能</option>
            {PROVIDERS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <p className="label">選了就立即生效。下面的設定各自有儲存按鈕</p>
        </fieldset>

        {provider === GOOGLE && <GoogleCalendarForm config={google} />}
        {provider === OUTLOOK && <OutlookForm config={outlook} />}

        {save.isSuccess && (
          <div className="toast toast-end">
            <div className="alert alert-success">已切換</div>
          </div>
        )}

        {save.isError && (
          <div className="toast toast-end">
            <div className="alert alert-error">{save.error.message}</div>
          </div>
        )}
      </div>
    </div>
  );
}
