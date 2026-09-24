import { useState } from 'react';
import { useNavigate } from 'react-router';
import { login } from '../lib/admin.ts';

export function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function submit() {
    setSubmitting(true);
    setError('');

    if (await login(password)) {
      navigate('/', { replace: true });
    } else {
      setError('密碼錯誤');
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-dvh grid place-items-center bg-base-200 p-6">
      <div className="card bg-base-100 shadow-sm w-full max-w-sm">
        <div className="card-body items-center gap-4">
          <img src="/icons8-helper-94.png" alt="" width={94} height={94} />
          <h1 className="card-title">SlotHelper</h1>

          <form
            className="w-full flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <input
              type="password"
              className="input w-full"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="管理密碼"
              autoFocus
            />
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting && <span className="loading loading-spinner" />}
              登入
            </button>
          </form>

          {error && <div className="alert alert-error">{error}</div>}
        </div>
      </div>
    </main>
  );
}
