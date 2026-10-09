import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAutoReset } from '../hooks/use-auto-reset.ts';
import {
  getSection,
  saveSection,
  type SchedulingConfigRequest,
  type SchedulingConfigVo,
} from '../lib/admin.ts';

const PROVIDER = 'google-calendar';

const EMPTY: SchedulingConfigVo = {
  provider: 'none',
  settings: { serviceAccountEmail: '', hasPrivateKey: false, calendars: [] },
};

export function CalendarSettingsPage() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['config', 'scheduling'],
    queryFn: () => getSection<SchedulingConfigVo>('scheduling'),
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
      <div className="alert alert-error max-w-2xl">
        <span>{error.message}</span>
      </div>
    );
  }

  return <CalendarForm config={{ ...EMPTY, ...data }} />;
}

function CalendarForm({ config }: { config: SchedulingConfigVo }) {
  const [enabled, setEnabled] = useState(config.provider === PROVIDER);
  const [email, setEmail] = useState(config.settings.serviceAccountEmail);
  // undefined 代表「不變更」,不會放進送出的 payload
  const [privateKey, setPrivateKey] = useState<string | undefined>(
    config.settings.hasPrivateKey ? undefined : '',
  );
  const [calendarId, setCalendarId] = useState(config.settings.calendars[0]?.id ?? '');
  const [calendarName, setCalendarName] = useState(config.settings.calendars[0]?.name ?? '');
  const [fileError, setFileError] = useState('');
  const [dragging, setDragging] = useState(false);
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: (next: SchedulingConfigRequest) => saveSection('scheduling', next),
    onSuccess: () => {
      // 存完就回到唯讀狀態,不然畫面還停在剛剛編輯的樣子
      setPrivateKey(undefined);
      setFileError('');
      void queryClient.invalidateQueries({ queryKey: ['config', 'scheduling'] });
      // 換了日曆,店家設定頁讀的標籤清單也跟著變
      void queryClient.invalidateQueries({ queryKey: ['calendar-labels'] });
    },
  });

  useAutoReset(save);

  async function importServiceAccountJson(file: File) {
    setFileError('');
    try {
      const data = JSON.parse(await file.text()) as {
        client_email?: string;
        private_key?: string;
      };
      if (!data.client_email || !data.private_key) {
        setFileError('這個檔案缺少 client_email 或 private_key');
        return;
      }
      setEmail(data.client_email);
      setPrivateKey(data.private_key);
    } catch {
      setFileError('檔案不是有效的 JSON');
    }
  }

  // 取消變更:金鑰與電子郵件都回到後端現有的那一組
  function cancelEdit() {
    setPrivateKey(undefined);
    setEmail(config.settings.serviceAccountEmail);
    setFileError('');
  }

  const editing = privateKey !== undefined;
  const hasKey = editing ? !!email && privateKey !== '' : config.settings.hasPrivateKey;
  const canSubmit = !enabled || (hasKey && !!calendarId && !!calendarName);

  return (
    <div className="card max-w-2xl bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <h2 className="card-title">Google 日曆設定</h2>

        <label className="label cursor-pointer justify-start gap-3">
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          <span>啟用日曆預約功能</span>
        </label>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const settings: SchedulingConfigRequest['settings'] = {
              serviceAccountEmail: email,
              calendars: [{ id: calendarId, name: calendarName }],
            };
            if (privateKey !== undefined) settings.privateKey = privateKey;
            save.mutate({ provider: enabled ? PROVIDER : 'none', settings });
          }}
        >
          <fieldset className="contents" disabled={!enabled}>
            <div className="flex flex-col gap-3 rounded-box border border-base-300 p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">服務帳號金鑰</span>
                {editing ? (
                  config.settings.hasPrivateKey && (
                    <button
                      type="button"
                      className="btn btn-sm btn-error btn-soft"
                      onClick={cancelEdit}
                    >
                      取消
                    </button>
                  )
                ) : (
                  <button type="button" className="btn btn-sm" onClick={() => setPrivateKey('')}>
                    變更
                  </button>
                )}
              </div>

              {editing && (
                <label
                  className={`flex flex-col items-center justify-center gap-2 rounded-box border-2 border-dashed p-6 transition-colors ${
                    enabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                  } ${
                    dragging
                      ? 'border-primary bg-primary/5'
                      : 'border-base-300 hover:border-base-content/30'
                  }`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    if (!enabled) return;
                    const file = event.dataTransfer.files[0];
                    if (file) void importServiceAccountJson(file);
                  }}
                >
                  <span className="font-medium">拖曳金鑰檔到這裡</span>
                  <span className="text-sm text-base-content/60">或點擊選擇檔案</span>
                  <span className="text-xs text-base-content/50">
                    Google 下載的 Service Account JSON，會自動填入下面兩欄；也可以手動貼上
                  </span>
                  <input
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void importServiceAccountJson(file);
                      event.target.value = '';
                    }}
                  />
                </label>
              )}

              {fileError && <p className="label text-error">{fileError}</p>}

              <fieldset className="fieldset">
                <legend className="fieldset-legend">Service Account 電子郵件</legend>
                <input
                  type="text"
                  className="input w-full"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={!editing}
                  spellCheck={false}
                  placeholder="xxx@專案名.iam.gserviceaccount.com"
                />
              </fieldset>

              <fieldset className="fieldset">
                <legend className="fieldset-legend">私鑰</legend>
                <textarea
                  className="textarea w-full resize-none font-mono text-xs"
                  rows={editing ? 8 : 2}
                  value={privateKey ?? ''}
                  onChange={(event) => setPrivateKey(event.target.value)}
                  disabled={!editing}
                  spellCheck={false}
                  placeholder={
                    editing ? '-----BEGIN PRIVATE KEY-----' : '已儲存，為安全起見不顯示內容'
                  }
                />
              </fieldset>
            </div>

            <fieldset className="fieldset">
              <legend className="fieldset-legend">日曆名稱</legend>
              <input
                type="text"
                className="input w-full"
                value={calendarName}
                onChange={(event) => setCalendarName(event.target.value)}
                placeholder="自己辨識用，例如「台北店」"
              />
            </fieldset>

            <fieldset className="fieldset">
              <legend className="fieldset-legend">日曆 ID</legend>
              <input
                type="text"
                className="input w-full"
                value={calendarId}
                onChange={(event) => setCalendarId(event.target.value)}
                placeholder="xxx@group.calendar.google.com"
              />
            </fieldset>
          </fieldset>

          <button type="submit" className="btn btn-primary" disabled={save.isPending || !canSubmit}>
            {save.isPending && <span className="loading loading-spinner" />}
            儲存
          </button>
        </form>

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
    </div>
  );
}
