// SVG 是建置時打包進來的固定檔案,不是使用者輸入,所以 inline 進 DOM 是安全的。
// inline 而不用 <img> 是為了讓沒指定顏色的單色 logo 能跟著主題變色
const PROVIDER_FILES = import.meta.glob('../assets/brands/provider/*.svg', {
  query: '?raw',
  eager: true,
  import: 'default',
});

const MODEL_FILES = import.meta.glob('../assets/brands/model/*.svg', {
  query: '?raw',
  eager: true,
  import: 'default',
});

const CHANNEL_FILES = import.meta.glob('../assets/brands/channel/*.svg', {
  query: '?raw',
  eager: true,
  import: 'default',
});

const CALENDAR_FILES = import.meta.glob('../assets/brands/calendar/*.svg', {
  query: '?raw',
  eager: true,
  import: 'default',
});

// 不是品牌,是我們自己指定含義的通用圖示
const ICON_FILES = import.meta.glob('../assets/icon/*.svg', {
  query: '?raw',
  eager: true,
  import: 'default',
});

function byName(files: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(files).map(([path, svg]) => [
      path.split('/').pop()!.replace('.svg', ''),
      svg as string,
    ]),
  );
}

const PROVIDERS = byName(PROVIDER_FILES);
const MODELS = byName(MODEL_FILES);
const CHANNELS = byName(CHANNEL_FILES);
const CALENDARS = byName(CALENDAR_FILES);
const ICONS = byName(ICON_FILES);

// 原樣在深色或淺色主題下會看不見的檔案。
// fill-current:原檔沒指定顏色,交給主題的文字色
// dark:invert:原檔寫死深色,深色主題要反轉
const TREATMENT: Record<string, string> = {
  'groq-icon': 'fill-current',
  'groq-wordmark': 'fill-current',
  'nvidia-icon': 'fill-current',
  'openai-wordmark': 'fill-current',
  'grok-icon': 'fill-current',
  'anthropic-icon': 'dark:invert',
  'anthropic-wordmark': 'dark:invert',
  'xai-icon': 'dark:invert',
};

// 先命中先贏,順序是刻意的:
// 微調廠牌要排在基礎模型前面 —— nvidia/Llama-3.1-Nemotron、deepseek-ai/llama-7b、
// Qwen/llama-7b 都含 llama 但不是 Meta 的,所以 llama 擺最後。
// openrouter 的 id 前面會帶供應商(anthropic/claude-sonnet-4),所以公司名也列進來。
// 沒有對應檔案的 pattern 行為跟沒列一樣(都是問號),列著是為了之後丟檔就生效
const MODEL_PATTERNS: { pattern: RegExp; icon: string }[] = [
  { pattern: /nemotron|nvidia/i, icon: 'nvidia' },
  { pattern: /deepseek/i, icon: 'deepseek' },
  { pattern: /qwen|qwq|qvq/i, icon: 'qwen' },
  { pattern: /kimi|moonshot/i, icon: 'kimi' },
  { pattern: /glm|zhipu|z-ai/i, icon: 'glm' },
  { pattern: /claude|anthropic/i, icon: 'claude' },
  // 有人只寫 sonnet-4-5 這種簡稱,不帶 claude
  { pattern: /opus|sonnet|haiku/i, icon: 'claude' },
  { pattern: /gpt|openai|codex|^o[1-9]/i, icon: 'openai' },
  { pattern: /gemini|gemma/i, icon: 'gemini' },
  { pattern: /grok|x-ai|xai/i, icon: 'grok' },
  { pattern: /mi(?:s|xt)ral|ministral|codestral|devstral|magistral|pixtral/i, icon: 'mistral' },
  { pattern: /(?:^|[-/])phi[-\d]/i, icon: 'phi' },
  { pattern: /llama|meta/i, icon: 'llama' },
];

function findIcon(name: string): { file: string; svg: string } | undefined {
  const file = `${name}-icon`;
  const svg = MODELS[file] ?? PROVIDERS[file];

  return svg ? { file, svg } : undefined;
}

// 各家的 viewBox 比例從 1 到 8.8 都有,只鎖高度會讓橫幅比方形寬好幾倍。
// 固定一個框、等比縮到塞滿,佔用的區塊才會一致。
// cover 則相反:填滿整個框、超出的部分裁掉,給切成圓形的頭像用
function Svg({
  name,
  svg,
  className,
  cover,
}: {
  name: string;
  svg: string;
  className: string;
  cover?: boolean;
}) {
  const fit = cover
    ? '[&>svg]:h-full [&>svg]:w-full'
    : '[&>svg]:h-auto [&>svg]:max-h-full [&>svg]:w-auto [&>svg]:max-w-full';
  // slice 讓比例不同的圖裁切而不是變形,原檔都沒有這個屬性
  const html = cover ? svg.replace('<svg', '<svg preserveAspectRatio="xMidYMid slice"') : svg;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${fit} ${TREATMENT[name] ?? ''} ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// 所有供應商標記共用的框,橫幅與「logo + 文字」才會佔一樣大
const WORDMARK_BOX = 'h-6 w-28';

function Unknown({ className }: { className: string }) {
  return (
    <span
      className={`inline-flex aspect-square shrink-0 items-center justify-center rounded bg-base-300 text-[0.6rem] font-bold text-base-content/50 ${className}`}
    >
      ?
    </span>
  );
}

// 有橫幅就用橫幅,只有 logo 就 logo 加文字,都沒有就只有文字
// className 要同時給寬與高,SVG 是靠框的兩個邊等比縮放的
export function ProviderMark({
  provider,
  className = WORDMARK_BOX,
}: {
  provider: string;
  className?: string;
}) {
  const wordmark = PROVIDERS[`${provider}-wordmark`];
  if (wordmark) {
    return <Svg name={`${provider}-wordmark`} svg={wordmark} className={className} />;
  }

  const icon = PROVIDERS[`${provider}-icon`];
  if (!icon) return <span className="text-sm">{provider}</span>;

  // 沒有橫幅的,用 logo 加文字湊出一樣大的區塊
  return (
    <span className={`inline-flex items-center justify-center gap-2 ${className}`}>
      <Svg name={`${provider}-icon`} svg={icon} className="h-5 w-5" />
      <span className="text-sm font-medium">{provider}</span>
    </span>
  );
}

// 模型名稱是自由字串,靠關鍵字猜品牌,猜不到就是問號 ——
// 不拿供應商的 logo 充數,那會讓一個不是模型的標誌出現在模型欄
export function ModelIcon({
  model,
  className = 'h-4 w-4',
  cover,
}: {
  model: string;
  className?: string;
  cover?: boolean;
}) {
  const matched = MODEL_PATTERNS.find((entry) => entry.pattern.test(model));
  const found = matched && findIcon(matched.icon);

  if (!found) return <Unknown className={className} />;
  return <Svg name={found.file} svg={found.svg} className={className} cover={cover} />;
}

export function ModelMark({ model, className = 'h-4 w-4' }: { model: string; className?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <ModelIcon model={model} className={className} />
      <span className="font-mono text-xs">{model}</span>
    </span>
  );
}

// 日曆服務的選項是寫死的,所以直接給檔名而不是用後端的 key 推導
export function CalendarMark({ name, className = 'size-8' }: { name: string; className?: string }) {
  const svg = CALENDARS[`${name}-icon`];
  if (!svg) return null;

  return <Svg name={`${name}-icon`} svg={svg} className={className} />;
}

// assets/icon/ 底下的檔名,例如 disable、test-tube
export function Icon({ name, className = 'size-5' }: { name: string; className?: string }) {
  const svg = ICONS[name];
  if (!svg) return null;

  return <Svg name={name} svg={svg} className={className} />;
}

// test 是我們自己造的管道,用通用圖示而不是品牌標
export function ChannelMark({
  channel,
  className = 'size-3',
}: {
  channel: string;
  className?: string;
}) {
  if (channel === 'test') return <Icon name="test-tube" className={className} />;

  const svg = CHANNELS[`${channel}-icon`];
  if (!svg) return null;

  return <Svg name={`${channel}-icon`} svg={svg} className={className} />;
}
