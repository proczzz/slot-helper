interface SecretFieldProps {
  label: string;
  mask: string; // 空字串代表尚未設定
  value: string | undefined; // undefined 代表沒在編輯
  onChange: (value: string | undefined) => void;
  multiline?: boolean;
  hint?: string;
}

// 已設定的金鑰只顯示尾碼,要按「變更」才能編輯 ——
// 後端不會回傳真值,所以輸入框一開始是空的,取消就丟棄輸入
export function SecretField({ label, mask, value, onChange, multiline, hint }: SecretFieldProps) {
  const configured = mask.length > 0;
  const editing = value !== undefined;

  let control;
  if (!editing) {
    // 高度要跟待會出現的輸入框一樣,不然按下變更時畫面會跳
    control = (
      <code
        className={`flex flex-1 items-center rounded-box bg-base-200 px-3 font-mono text-xs ${
          multiline ? 'h-24' : 'h-10'
        }`}
      >
        {mask}
      </code>
    );
  } else if (multiline) {
    control = (
      <textarea
        className="textarea textarea-bordered h-24 flex-1 resize-none font-mono text-xs"
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
          <button
            type="button"
            className="btn btn-sm btn-error btn-soft"
            onClick={() => onChange(undefined)}
          >
            取消
          </button>
        )}
      </div>

      {!configured ? <p className="label">尚未設定</p> : hint && <p className="label">{hint}</p>}
    </fieldset>
  );
}
