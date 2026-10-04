import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { changePassword } from '../lib/admin.ts';

export function AccountPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const save = useMutation({
    // changePassword 把錯誤當成回傳值,這裡轉成 throw 才走得到 isError
    mutationFn: async (next: { currentPassword: string; newPassword: string }) => {
      const failure = await changePassword(next.currentPassword, next.newPassword);
      if (failure) throw new Error(failure);
    },
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
  });

  // 成功或失敗的提示顯示三秒,reset 會把 mutation 退回 idle
  useEffect(() => {
    if (save.isIdle || save.isPending) return;
    const timer = setTimeout(() => save.reset(), 3000);
    return () => clearTimeout(timer);
  }, [save.isSuccess, save.isError, save.reset]);

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
            save.mutate({ currentPassword, newPassword });
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

          <button type="submit" className="btn btn-primary" disabled={save.isPending || !canSubmit}>
            {save.isPending && <span className="loading loading-spinner" />}
            更新密碼
          </button>
        </form>

        {save.isSuccess && (
          <div className="toast toast-end">
            <div className="alert alert-success">密碼已更新</div>
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
