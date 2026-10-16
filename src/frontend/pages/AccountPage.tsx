import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Icon } from '../components/BrandMark.tsx';
import { useAutoReset } from '../hooks/use-auto-reset.ts';
import { changePassword, getMe } from '../lib/admin.ts';

export function AccountPage() {
  const [changing, setChanging] = useState(false);

  const me = useQuery({ queryKey: ['me'], queryFn: getMe });

  return (
    <div className="card mx-auto w-full max-w-3xl bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <h2 className="card-title">帳號</h2>

        <ul className="list rounded-box border border-base-200">
          <li className="list-row items-center">
            <Icon name="material/account" className="size-6 text-base-content/60" />
            <div>
              <p className="text-sm text-base-content/60">帳號名稱</p>
              <p className="font-medium">{me.isPending ? '載入中⋯' : (me.data ?? '')}</p>
            </div>
          </li>

          <li>
            <button
              type="button"
              className="list-row w-full items-center text-left hover:bg-base-200"
              onClick={() => setChanging(true)}
            >
              <Icon name="material/edit" className="size-6 text-base-content/60" />
              <p className="flex-1 font-medium">修改密碼</p>
              <span className="text-base-content/40">›</span>
            </button>
          </li>
        </ul>

        {me.isError && <p className="label text-error">{me.error.message}</p>}
      </div>

      {changing && <PasswordModal onClose={() => setChanging(false)} />}
    </div>
  );
}

function PasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const save = useMutation({
    mutationFn: (next: { currentPassword: string; newPassword: string }) =>
      changePassword(next.currentPassword, next.newPassword),
    onSuccess: onClose,
  });

  useAutoReset(save);

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit =
    currentPassword.length > 0 && newPassword.length >= 8 && newPassword === confirmPassword;

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="text-lg font-bold">修改密碼</h3>

        <form
          className="flex flex-col gap-4 py-4"
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
              autoFocus
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

          {save.isError && <div className="alert alert-error">{save.error.message}</div>}

          <div className="modal-action">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              取消
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={save.isPending || !canSubmit}
            >
              {save.isPending && <span className="loading loading-spinner loading-xs" />}
              更新密碼
            </button>
          </div>
        </form>
      </div>
      {/* 不給背景關閉:填到一半誤觸會整份消失 */}
      <div className="modal-backdrop" />
    </div>
  );
}
