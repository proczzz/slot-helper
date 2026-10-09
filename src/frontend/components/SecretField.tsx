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

      {!configured ? <p className="label">尚未設定</p> : hint && <p className="label">{hint}</p>}
    </fieldset>
  );
}
