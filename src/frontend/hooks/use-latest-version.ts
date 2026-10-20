import { useQuery } from '@tanstack/react-query';
import { APP_VERSION } from '../../version.ts';

export const REPO_URL = 'https://github.com/proczzz/slot-helper';

const LATEST_URL = 'https://api.github.com/repos/proczzz/slot-helper/releases/latest';
const SIX_HOURS = 6 * 60 * 60_000;

// 0.10.0 要大於 0.9.0,所以逐段比數字而不是比字串
function isNewer(latest: string, current: string): boolean {
  const parse = (version: string) => version.replace(/^v/, '').split('.').map(Number);
  const [left, right] = [parse(latest), parse(current)];

  for (let index = 0; index < 3; index++) {
    const [a, b] = [left[index] ?? 0, right[index] ?? 0];
    if (a !== b) return a > b;
  }
  return false;
}

// 直接問 GitHub,不經過後端。查不到就當作沒有新版(自架環境可能連不到外網)
export function useLatestVersion(): { version: string; url: string } | null {
  const { data } = useQuery({
    queryKey: ['latest-version'],
    staleTime: SIX_HOURS,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const response = await fetch(LATEST_URL);
      // 還沒發布過正式版會是 404
      if (!response.ok) return null;

      const release = (await response.json()) as { tag_name: string; html_url: string };
      if (!isNewer(release.tag_name, APP_VERSION)) return null;
      return { version: release.tag_name.replace(/^v/, ''), url: release.html_url };
    },
  });

  return data ?? null;
}
