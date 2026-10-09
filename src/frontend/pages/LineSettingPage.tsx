import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAutoReset } from '../hooks/use-auto-reset.ts';
import {
  getSection,
  saveSection,
  type LineConfigRequest,
  type LineConfigVo,
} from '../lib/admin.ts';

const EMPTY: LineConfigVo = { accessTokenMask: '', webhookSecretMask: '' };

export function LineSettingsPage() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['config', 'line'],
    queryFn: () => getSection<LineConfigVo>('line'),
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
  return <LineForm config={{ ...EMPTY, ...data }} />;
}

function LineForm({ config }: { config: LineConfigVo }) {
  // undefined 代表「沒在編輯這個欄位」,送出時就不會放進 payload。
  // 還沒設定過的欄位直接進入編輯狀態,老闆不必多按一次「變更」
  const [accessToken, setAccessToken] = useState<string | undefined>(
    config.accessTokenMask ? undefined : '',
  );
  const [webhookSecret, setWebhookSecret] = useState<string | undefined>(
    config.webhookSecretMask ? undefined : '',
  );
  const queryClient = useQueryClient();

  const webhookUrl = `${window.location.origin}/line/webhook`;

  const save = useMutation({
    mutationFn: (next: LineConfigRequest) => saveSection('line', next),
    onSuccess: () => {
      // 存完就回到遮罩狀態。這是事件而不是同步,所以不需要 useEffect
      setAccessToken(undefined);
      setWebhookSecret(undefined);
      void queryClient.invalidateQueries({ queryKey: ['config', 'line'] });
    },
  });

  useAutoReset(save);

  const editing = accessToken !== undefined || webhookSecret !== undefined;
  const incomplete = accessToken === '' || webhookSecret === '';

  return (
    <div className="card max-w-2xl bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <h2 className="card-title">LINE 設定</h2>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();

            // 只送有改過的欄位,後端靠「key 不存在」判斷不變更
            const next: LineConfigRequest = {};
            if (accessToken !== undefined) next.accessToken = accessToken;
            if (webhookSecret !== undefined) next.webhookSecret = webhookSecret;
            save.mutate(next);
          }}
        >
          <SecretField
            label="Channel secret"
            mask={config.webhookSecretMask}
            value={webhookSecret}
            onChange={setWebhookSecret}
          />

          <SecretField
            label="Channel access token"
            mask={config.accessTokenMask}
            value={accessToken}
            onChange={setAccessToken}
            multiline
          />

          <button
            type="submit"
            className="btn btn-primary"
            disabled={save.isPending || !editing || incomplete}
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
            貼到 LINE Developers 的 Webhook URL，並開啟 Use webhook
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

interface SecretFieldProps {
  label: string;
  mask: string; // 空字串代表尚未設定
  value: string | undefined; // undefined 代表沒在編輯
  onChange: (value: string | undefined) => void;
  multiline?: boolean;
}

// 已設定的金鑰只顯示尾碼,要按「變更」才能編輯 ——
// 後端不會回傳真值,所以輸入框一開始是空的,取消就丟棄輸入
function SecretField({ label, mask, value, onChange, multiline }: SecretFieldProps) {
  const configured = mask.length > 0;
  const editing = value !== undefined;

  let control;
  if (!editing) {
    control = (
      <code className="flex-1 rounded-box bg-base-200 px-3 py-2 font-mono text-xs">{mask}</code>
    );
  } else if (multiline) {
    control = (
      <textarea
        className="textarea textarea-bordered flex-1 resize-none font-mono text-xs"
        rows={4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        autoFocus={configured}
      />
    );
  } else {
    control = (
      <input
        type="text"
        className="input flex-1 font-mono text-xs"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        autoFocus={configured}
      />
    );
  }

  return (
    <fieldset className="fieldset">
      <legend className="fieldset-legend">{label}</legend>

      <div className="flex items-start gap-2">
        {control}

        {/* 還沒設定過的欄位沒有可以回去的狀態,所以不給取消 */}
        {!editing && (
          <button type="button" className="btn btn-sm" onClick={() => onChange('')}>
            變更
          </button>
        )}
        {editing && configured && (
          <button type="button" className="btn btn-sm" onClick={() => onChange(undefined)}>
            取消
          </button>
        )}
      </div>

      {!configured && <p className="label">尚未設定</p>}
    </fieldset>
  );
}
