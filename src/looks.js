export const SEASONS = [
  { id: "winter", label: "Зима" },
  { id: "spring", label: "Весна" },
  { id: "summer", label: "Лето" },
  { id: "autumn", label: "Осень" },
];

export function currentSeason(date = new Date()) {
  return [
    "winter",
    "winter",
    "spring",
    "spring",
    "spring",
    "summer",
    "summer",
    "summer",
    "autumn",
    "autumn",
    "autumn",
    "winter",
  ][date.getMonth()];
}

const everydayOrder = [13, 11, 12, 14, 16, 5];

export function selectLooks(catalog, { base, occasion, season }) {
  const score = (look) => {
    const index = everydayOrder.indexOf(look.id);
    return occasion === "everyday" && index >= 0
      ? everydayOrder.length - index
      : 0;
  };
  return catalog.looks
    .filter(
      (look) =>
        look.items.some((id) => String(id) === String(base)) &&
        look.items.every((id) => catalog.items[id]) &&
        (!season || look.seasons.includes(season)) &&
        (occasion === "evening"
          ? look.scenarios.some((value) => value.startsWith("Театр"))
          : look.scenarios.some((value) => !value.startsWith("Театр")) &&
            ![6, 7].includes(look.id)),
    )
    .sort((a, b) => score(b) - score(a) || a.id - b.id);
}
