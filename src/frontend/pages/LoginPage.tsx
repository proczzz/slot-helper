import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { isLoggedIn, login } from '../lib/admin.ts';
import { APP_VERSION } from '../../version.ts';
import { REPO_URL } from '../hooks/use-latest-version.ts';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  // 憑證還有效就直接進後台,不用再登入一次
  useEffect(() => {
    isLoggedIn()
      .then((ok) => (ok ? navigate('/', { replace: true }) : setChecking(false)))
      // 連不到後端:照樣顯示表單,送出時會給明確的錯誤訊息
      .catch(() => setChecking(false));
  }, [navigate]);

  async function submit() {
    setSubmitting(true);
    setError('');

    try {
      const message = await login(username, password);
      if (message) {
        setError(message);
        setSubmitting(false);
        return;
      }
      navigate('/', { replace: true });
    } catch {
      // fetch reject:連不到後端。沒接的話按鈕會永遠卡在轉圈
      setError('連不到伺服器，請確認後端是否已啟動。');
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <main className="grid min-h-dvh place-items-center bg-base-200">
        <span className="loading loading-spinner loading-lg" />
      </main>
    );
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-base-200 p-6">
      <div className="card w-full max-w-sm bg-base-100 shadow-sm">
        <div className="card-body items-center gap-4">
          <img src="/favicon.svg" alt="" width={94} height={94} />
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

          <a
            href={`${REPO_URL}/releases`}
            target="_blank"
            rel="noreferrer"
            className="link link-hover text-xs opacity-50"
          >
            v{APP_VERSION}
          </a>
        </div>
      </div>
    </main>
  );
}
