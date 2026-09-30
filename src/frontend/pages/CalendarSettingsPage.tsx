import { useEffect, useState } from 'react';
import { getSection, saveSection, type SchedulingConfig } from '../lib/admin.ts';

const PROVIDER = 'google-calendar';

export function CalendarSettingsPage() {
  const [enabled, setEnabled] = useState(false);
  const [email, setEmail] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [calendarId, setCalendarId] = useState('');
  const [calendarName, setCalendarName] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    getSection<SchedulingConfig>('scheduling')
      .then((config) => {
        if (config?.provider === PROVIDER) setEnabled(true);
        setEmail(config?.settings?.serviceAccountEmail ?? '');
        setPrivateKey(config?.settings?.privateKey ?? '');
        setCalendarId(config?.settings?.calendars?.[0]?.id ?? '');
        setCalendarName(config?.settings?.calendars?.[0]?.name ?? '');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  async function importServiceAccountJson(file: File) {
    setMessage('');
    try {
      const data = JSON.parse(await file.text()) as {
        client_email?: string;
        private_key?: string;
      };
      if (!data.client_email || !data.private_key) {
        setMessage('這個檔案缺少 client_email 或 private_key');
        return;
      }
      setEmail(data.client_email);
      setPrivateKey(data.private_key);
      setFileName(file.name);
    } catch {
      setMessage('檔案不是有效的 JSON');
    }
  }

  // 移除檔案時一併清空，避免留下與檔案不一致的內容
  function removeFile() {
    setFileName(null);
    setEmail('');
    setPrivateKey('');
    setMessage('');
  }

  async function submit() {
    setSaving(true);
    const error = await saveSection('scheduling', {
      provider: enabled ? PROVIDER : 'none',
      settings: {
        serviceAccountEmail: email,
        privateKey,
        calendars: [{ id: calendarId, name: calendarName }],
      },
    });
    setSaving(false);
    setMessage(error ?? '已儲存');
  }

  if (loading) {
    return (
      <div className="grid place-items-center p-12">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  const fieldsLocked = fileName !== null;
  const canSubmit = !enabled || (!!email && !!privateKey && !!calendarId && !!calendarName);

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
            void submit();
          }}
        >
          <fieldset className="contents" disabled={!enabled}>
            {fileName ? (
              <div className="flex items-center justify-between rounded-box border border-base-300 p-4">
                <div className="flex flex-col">
                  <span className="font-medium">{fileName}</span>
                  <span className="text-xs text-base-content/60">已帶入下面兩欄</span>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={removeFile}>
                  移除
                </button>
              </div>
            ) : (
              <label
                className={`flex flex-col items-center justify-center gap-2 rounded-box border-2 border-dashed p-8 transition-colors ${
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
                  Google 下載的 Service Account JSON，會自動填入下面兩欄
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

            <fieldset className="fieldset">
              <legend className="fieldset-legend">Service Account 電子郵件</legend>
              <input
                type="text"
                className="input w-full"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={fieldsLocked}
                placeholder="xxx@專案名.iam.gserviceaccount.com"
              />
            </fieldset>

            <fieldset className="fieldset">
              <legend className="fieldset-legend">私鑰</legend>
              <textarea
                className="textarea textarea-bordered w-full font-mono text-xs"
                rows={8}
                value={privateKey}
                onChange={(event) => setPrivateKey(event.target.value)}
                disabled={fieldsLocked}
                spellCheck={false}
                placeholder="-----BEGIN PRIVATE KEY-----"
              />
            </fieldset>

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

          <button type="submit" className="btn btn-primary" disabled={saving || !canSubmit}>
            {saving && <span className="loading loading-spinner" />}
            儲存
          </button>
        </form>

        {message && (
          <div className="toast toast-end">
            <div className="alert">{message}</div>
          </div>
        )}
      </div>
    </div>
  );
}
