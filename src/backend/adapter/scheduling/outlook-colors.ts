// Microsoft 只公布 preset 的色名、沒有色碼，這些顏色是近似值。
const PRESET_COLORS: Partial<Record<string, string>> = {
  preset0: '#F07D88', // Red
  preset1: '#FF8C00', // Orange
  preset2: '#FECB6F', // Brown
  preset3: '#FFF100', // Yellow
  preset4: '#5FBE7D', // Green
  preset5: '#33BAB1', // Teal
  preset6: '#A3B367', // Olive
  preset7: '#55ABE5', // Blue
  preset8: '#A895E2', // Purple
  preset9: '#E48BB5', // Cranberry
  preset10: '#B9C0CB', // Steel
  preset11: '#4C596E', // DarkSteel
  preset12: '#ABABAB', // Gray
  preset13: '#666666', // DarkGray
  preset14: '#474747', // Black
  preset15: '#910A19', // DarkRed
  preset16: '#CE4B28', // DarkOrange
  preset17: '#A47332', // DarkBrown
  preset18: '#B0A923', // DarkYellow
  preset19: '#026802', // DarkGreen
  preset20: '#1C6367', // DarkTeal
  preset21: '#5C6A22', // DarkOlive
  preset22: '#254069', // DarkBlue
  preset23: '#562685', // DarkPurple
  preset24: '#80275D', // DarkCranberry
};

// 沒設顏色的類別 Graph 回 none,查不到就回 undefined 讓前端用預設色
export function toPresetColor(preset?: string): string | undefined {
  return preset ? PRESET_COLORS[preset] : undefined;
}
