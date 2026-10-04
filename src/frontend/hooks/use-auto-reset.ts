import { useEffect } from 'react';

const RESET_DELAY = 3000;

// 只收真正用到的五個欄位,不綁 React Query 的 UseMutationResult 泛型
interface Resettable {
  isIdle: boolean;
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  reset: () => void;
}

// mutation 結束三秒後退回 idle,讀 isSuccess / isError 的提示就會自己消失
export function useAutoReset(mutation: Resettable): void {
  useEffect(() => {
    if (mutation.isIdle || mutation.isPending) return;

    const timer = setTimeout(mutation.reset, RESET_DELAY);
    return () => clearTimeout(timer);
  }, [mutation.isSuccess, mutation.isError, mutation.reset]);
}
