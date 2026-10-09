import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { SecretField } from '../components/SecretField.tsx';
import { useAutoReset } from '../hooks/use-auto-reset.ts';
import {
  getSection,
  saveSection,
  type WhatsappConfigRequest,
  type WhatsappConfigVo,
} from '../lib/admin.ts';

const EMPTY: WhatsappConfigVo = {
  accessTokenMask: '',
  webhookSecretMask: '',
  phoneNumberId: '',
  challengeToken: '',
};

export function WhatsappSettingsPage() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['config', 'whatsapp'],
    queryFn: () => getSection<WhatsappConfigVo>('whatsapp'),
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

  // 資料到齊才掛載表單,初始值直接交給 useState,不需要再用 useEffect 同步
  return <WhatsappForm config={{ ...EMPTY, ...data }} />;
}

function WhatsappForm({ config }: { config: WhatsappConfigVo }) {
  // undefined 代表「沒在編輯這個欄位」,送出時就不會放進 payload
  const [accessToken, setAccessToken] = useState<string | undefined>(
    config.accessTokenMask ? undefined : '',
  );
  const [webhookSecret, setWebhookSecret] = useState<string | undefined>(
    config.webhookSecretMask ? undefined : '',
  );
  const [phoneNumberId, setPhoneNumberId] = useState(config.phoneNumberId);
  const [challengeToken, setChallengeToken] = useState(config.challengeToken);
  const queryClient = useQueryClient();

  const webhookUrl = `${window.location.origin}/whatsapp/webhook`;

  const save = useMutation({
    mutationFn: (next: WhatsappConfigRequest) => saveSection('whatsapp', next),
    onSuccess: () => {
      // 存完就回到遮罩狀態。這是事件而不是同步,所以不需要 useEffect
      setAccessToken(undefined);
      setWebhookSecret(undefined);
      void queryClient.invalidateQueries({ queryKey: ['config', 'whatsapp'] });
    },
  });

  useAutoReset(save);

  const changed =
    accessToken !== undefined ||
    webhookSecret !== undefined ||
    phoneNumberId !== config.phoneNumberId ||
    challengeToken !== config.challengeToken;

  const incomplete =
    accessToken === '' || webhookSecret === '' || !phoneNumberId || !challengeToken;

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
            <li>App secret 在應用程式的「設定 → 基本資料」，和存取權杖是不同的東西</li>
            <li>最後把下面的 Webhook 網址與驗證字串填進 Meta，並訂閱 messages 欄位</li>
          </ol>
        </div>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();

            // 非機密欄位每次都送;兩個機密欄位只在改過時才放進來
            const next: WhatsappConfigRequest = { phoneNumberId, challengeToken };
            if (accessToken !== undefined) next.accessToken = accessToken;
            if (webhookSecret !== undefined) next.webhookSecret = webhookSecret;
            save.mutate(next);
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

          <SecretField
            label="存取權杖"
            mask={config.accessTokenMask}
            value={accessToken}
            onChange={setAccessToken}
            multiline
            hint="系統使用者產生的永久權杖"
          />

          <SecretField
            label="App secret"
            mask={config.webhookSecretMask}
            value={webhookSecret}
            onChange={setWebhookSecret}
            hint="用來驗證 webhook 真的來自 Meta"
          />

          <fieldset className="fieldset">
            <legend className="fieldset-legend">驗證字串</legend>
            <div className="flex items-center gap-2">
              <input
                type="text"
                className="input flex-1 font-mono text-xs"
                value={challengeToken}
                onChange={(event) => setChallengeToken(event.target.value)}
                spellCheck={false}
              />
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setChallengeToken(crypto.randomUUID())}
              >
                產生
              </button>
            </div>
            <p className="label">自己定一串就好，要和填進 Meta 的完全一致</p>
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
          <p className="mb-2 text-sm font-medium">Webhook 網址</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-box bg-base-200 px-3 py-2 font-mono text-xs break-all">
              {webhookUrl}
            </code>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => void navigator.clipboard.writeText(webhookUrl)}
            >
              複製
            </button>
          </div>
          <p className="mt-1 text-xs opacity-60">
            貼到 Meta 的 Callback URL。如果你的後台和對外網域不同，請自行替換網域
          </p>
        </div>

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
