import { useEffect, useState } from 'react';
import { changePassword } from '../lib/admin.ts';

export function AccountPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  async function submit() {
    setSaving(true);
    const message = await changePassword(currentPassword, newPassword);
    setSaving(false);

    if (message) {
      setMessage(message);
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setMessage('密碼已更新');
  }

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit =
    currentPassword.length > 0 && newPassword.length >= 8 && newPassword === confirmPassword;

  return (
    <div className="card max-w-md bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <h2 className="card-title">修改密碼</h2>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <fieldset className="fieldset">
            <legend className="fieldset-legend">目前密碼</legend>
            <input
              type="password"
              className="input w-full"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
            />
          </fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset-legend">新密碼</legend>
            <input
              type="password"
              className="input w-full"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
            />
            <p className="label">至少 8 個字元</p>
          </fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset-legend">確認新密碼</legend>
            <input
              type="password"
              className="input w-full"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
            />
            {mismatch && <p className="label text-error">兩次輸入的密碼不一致</p>}
          </fieldset>

          <button type="submit" className="btn btn-primary" disabled={saving || !canSubmit}>
            {saving && <span className="loading loading-spinner" />}
            更新密碼
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
