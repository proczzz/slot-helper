// 路由不認識任何區塊的形狀,只負責分派。各區塊自己宣告怎麼綁、怎麼顯示。
// 兩個方向的 unknown 都是誠實的 —— 進來的是 HTTP body,存著的是資料庫的 JSON
export interface ConfigMapper {
  toConfig(body: unknown, stored: unknown): unknown;
  toVo(stored: unknown): unknown;
}
