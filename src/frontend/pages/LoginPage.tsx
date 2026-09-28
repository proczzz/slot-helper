import { useState } from 'react';
import { useNavigate } from 'react-router';
import { login } from '../lib/admin.ts';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function submit() {
    setSubmitting(true);
    setError('');

    const message = await login(username, password);
    if (message) {
      setError(message);
      setSubmitting(false);
    } else {
      navigate('/', { replace: true });
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-base-200 p-6">
      <div className="card w-full max-w-sm bg-base-100 shadow-sm">
        <div className="card-body items-center gap-4">
          <img src="/icons8-helper-94.png" alt="" width={94} height={94} />
          <h1 className="card-title">SlotHelper</h1>

          <form
            className="flex w-full flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <input
              type="text"
              className="input w-full"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="帳號"
              autoComplete="username"
              autoFocus
            />
            <input
              type="password"
              className="input w-full"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="密碼"
              autoComplete="current-password"
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !username || !password}
            >
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
