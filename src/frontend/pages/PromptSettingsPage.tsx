import { useEffect, useState } from 'react';
import { getConfig, saveConfig } from '../lib/admin.ts';

export function PromptSettingsPage() {
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    getConfig().then((config) => {
      setInstructions(config.SYSTEM_PROMPT ?? '');
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  async function submit() {
    setSaving(true);
    const ok = await saveConfig({ SYSTEM_PROMPT: instructions });
    setSaving(false);
    setMessage(ok ? '已儲存' : '儲存失敗，請再試一次');
  }

  if (loading) {
    return (
      <div className="grid place-items-center p-12">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div className="card max-w-3xl bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <h2 className="card-title">AI 指示</h2>
        <p className="text-sm text-base-content/60">描述 AI 的身分、說話方式與服務規則。</p>

        <textarea
          className="textarea textarea-bordered w-full resize-none leading-relaxed"
          rows={16}
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          placeholder="例如：你是「小花美甲」的預約助理，語氣親切簡短⋯⋯"
          spellCheck={false}
        />

        <div className="rounded-box bg-base-200 p-4 text-sm">
          <p className="mb-2 font-medium">系統會自動附加以下內容，不需要自己寫</p>
          <ul className="list-inside list-disc text-base-content/70">
            <li>營業時間（在「營業時間」頁設定）</li>
            <li>目前時間（台北時區）</li>
          </ul>
        </div>

        <button className="btn btn-primary" disabled={saving} onClick={() => void submit()}>
          {saving && <span className="loading loading-spinner" />}
          儲存
        </button>
      </div>
    </div>
  );
}
