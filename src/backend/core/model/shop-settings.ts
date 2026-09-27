export type BusinessHours = Record<string, [string, string][]>;

export interface ShopSettings {
  instructions: string;
  businessHours: BusinessHours;
}
