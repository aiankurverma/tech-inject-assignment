import { TerritoryMap, type Territory } from "@/components/crm/territory-map";

// US tile-grid layout (states grouped by sales region).
function t(
  code: string,
  name: string,
  col: number,
  row: number,
  revenue: number,
  quota: number,
  pipeline: number,
  accounts: number,
  owner?: string,
  winRate?: number,
): Territory {
  return {
    code,
    name,
    col,
    row,
    revenue,
    quota,
    pipeline,
    accounts,
    winRate,
    owner: owner ? { name: owner } : undefined,
  };
}

const territories = [
  t("WA", "Washington", 0, 0, 820_000, 900_000, 610_000, 64, "Jordan Lee", 0.34),
  t("OR", "Oregon", 0, 1, 210_000, 350_000, 190_000, 22, "Jordan Lee", 0.27),
  t("CA", "California", 0, 2, 2_450_000, 2_200_000, 1_900_000, 188, "Maya Chen", 0.38),
  t("ID", "Idaho", 1, 1, 70_000, 120_000, 60_000, 8, "Jordan Lee", 0.25),
  t("NV", "Nevada", 1, 2, 160_000, 250_000, 90_000, 14, undefined, 0.21),
  t("AZ", "Arizona", 1, 3, 390_000, 420_000, 280_000, 31, "Maya Chen", 0.31),
  t("CO", "Colorado", 2, 2, 540_000, 500_000, 330_000, 41, "Sam Ortiz", 0.36),
  t("TX", "Texas", 3, 4, 1_620_000, 1_900_000, 1_400_000, 140, "Sam Ortiz", 0.29),
  t("MN", "Minnesota", 4, 0, 350_000, 300_000, 150_000, 26, "Nia Brooks", 0.4),
  t("IL", "Illinois", 5, 1, 980_000, 1_000_000, 720_000, 77, "Nia Brooks", 0.33),
  t("GA", "Georgia", 6, 3, 610_000, 800_000, 520_000, 49, "Chris Doyle", 0.26),
  t("PA", "Pennsylvania", 7, 1, 690_000, 850_000, 420_000, 55, "Ava Goldberg", 0.28),
  t("NC", "North Carolina", 7, 2, 450_000, 520_000, 510_000, 38, "Chris Doyle", 0.3),
  t("FL", "Florida", 7, 4, 1_050_000, 1_200_000, 880_000, 92, "Chris Doyle", 0.3),
  t("NY", "New York", 8, 0, 2_900_000, 2_600_000, 2_100_000, 210, "Ava Goldberg", 0.37),
  t("MA", "Massachusetts", 9, 0, 1_120_000, 1_000_000, 640_000, 83, "Ava Goldberg", 0.39),
];

export default function Example() {
  return (
    <TerritoryMap
      className="w-full max-w-[1000px]"
      territories={territories}
      defaultSelected="CA"
    />
  );
}
