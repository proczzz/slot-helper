import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAutoReset } from '../hooks/use-auto-reset.ts';
import { getSection, saveSection, type WhatsappConfig } from '../lib/admin.ts';

const EMPTY: WhatsappConfig = {
  phoneNumberId: '',
  accessToken: '',
  appSecret: '',
  verifyToken: '',
};

export function WhatsappSettingsPage() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['config', 'whatsapp'],
    queryFn: () => getSection<WhatsappConfig>('whatsapp'),
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

  // 後端的 GET 回的是原樣存進去的 JSON、不套 schema,所以舊資料可能缺欄位,用 EMPTY 補齊
  return <WhatsappForm config={{ ...EMPTY, ...data }} />;
}

function WhatsappForm({ config }: { config: WhatsappConfig }) {
  const [phoneNumberId, setPhoneNumberId] = useState(config.phoneNumberId);
  const [accessToken, setAccessToken] = useState(config.accessToken);
  const [appSecret, setAppSecret] = useState(config.appSecret);
  const [verifyToken, setVerifyToken] = useState(config.verifyToken);
  const queryClient = useQueryClient();

  const webhookUrl = `${window.location.origin}/whatsapp/webhook`;

  const save = useMutation({
    mutationFn: (next: WhatsappConfig) => saveSection('whatsapp', next),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['config', 'whatsapp'] });
    },
  });

  useAutoReset(save);

  const complete = !!phoneNumberId && !!accessToken && !!appSecret && !!verifyToken;

  return (
    <div className="card max-w-2xl bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <h2 className="card-title">WhatsApp 設定</h2>
        <p className="text-sm opacity-70">
          顧客用 WhatsApp 傳訊息給你的商業號碼，AI 會自動回覆與處理預約。
        </p>

        <div className="alert alert-info text-sm">
          <ol className="list-decimal space-y-1 pl-4">
            <li>在 Meta 開發者平台建立應用程式，加入 WhatsApp 產品並綁定電話號碼</li>
            <li>權杖請用「系統使用者」產生的永久權杖 —— 開發面板上那組只有 24 小時</li>
            <li>App secret 在「應用程式設定 → 基本資料 → 應用程式密鑰」</li>
            <li>最後把下面的 Webhook 網址與驗證字串填進 Meta，並訂閱 messages 欄位</li>
          </ol>
        </div>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate({ phoneNumberId, accessToken, appSecret, verifyToken });
          }}
        >
          <fieldset className="fieldset">
            <legend className="fieldset-legend">Phone number ID</legend>
            <input
              type="text"
              className="input w-full font-mono text-xs"
              value={phoneNumberId}
              onChange={(event) => setPhoneNumberId(event.target.value)}
              spellCheck={false}
            />
            <p className="label">是一串數字，不是電話號碼本身</p>
          </fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset-legend">存取權杖</legend>
            <textarea
              className="textarea textarea-bordered w-full font-mono text-xs"
              rows={4}
              value={accessToken}
              onChange={(event) => setAccessToken(event.target.value)}
              spellCheck={false}
            />
          </fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset-legend">App secret</legend>
            <input
              type="password"
              className="input w-full"
              value={appSecret}
              onChange={(event) => setAppSecret(event.target.value)}
              spellCheck={false}
            />
            <p className="label">用來驗證 webhook 真的來自 Meta</p>
          </fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset-legend">驗證字串</legend>
            <div className="join w-full">
              <input
                type="text"
                className="input join-item w-full font-mono text-xs"
                value={verifyToken}
                onChange={(event) => setVerifyToken(event.target.value)}
                spellCheck={false}
              />
              <button
                type="button"
                className="btn join-item"
                onClick={() => setVerifyToken(crypto.randomUUID())}
              >
                產生
              </button>
            </div>
            <p className="label">自己定一串就好，要和填進 Meta 的完全一致</p>
          </fieldset>

          <button type="submit" className="btn btn-primary" disabled={save.isPending || !complete}>
            {save.isPending && <span className="loading loading-spinner" />}
            儲存
          </button>
        </form>

        <fieldset className="fieldset border-t border-base-300 pt-4">
          <legend className="fieldset-legend">Webhook 網址</legend>
          <div className="join w-full">
            <input type="text" className="input join-item w-full" value={webhookUrl} readOnly />
            <button
              type="button"
              className="btn join-item"
              onClick={() => void navigator.clipboard.writeText(webhookUrl)}
            >
              複製
            </button>
          </div>
          {/* Meta 那端要自己貼,所以我們只是提供一個方便值;後台和對外網域不一定相同 */}
          <p className="label">
            貼到 Meta 的 Callback URL。如果你的後台和對外網域不同，請自行替換網域
          </p>
        </fieldset>

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
