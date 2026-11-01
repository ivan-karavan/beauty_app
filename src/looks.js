// Editorial priorities from the existing lookbook, not inferred fabric properties.
const everydayOrder = [13, 11, 12, 14, 16, 5];

export function selectLooks(catalog, { base, occasion, weather }) {
  const score = (look) => {
    const comfort = everydayOrder.indexOf(look.id);
    let value = occasion === "everyday" && comfort >= 0 ? 20 - comfort : 0;
    if (weather) {
      const layered = look.items.length > 2;
      if (weather.temperature < 10 && layered) value += 30;
      if (weather.temperature >= 20 && layered) value -= 30;
      if (weather.precipitation > 0 && look.items.includes(49)) value -= 5;
    }
    return value;
  };
  return catalog.looks
    .filter(
      (look) =>
        look.items.some((id) => String(id) === String(base)) &&
        look.items.every((id) => catalog.items[id]) &&
        (occasion === "evening"
          ? look.scenarios.some((s) => s.startsWith("Театр"))
          : look.scenarios.some((s) => !s.startsWith("Театр")) &&
            ![6, 7].includes(look.id)),
    )
    .sort((a, b) => score(b) - score(a) || a.id - b.id);
}

export function weatherAdvice(weather) {
  if (!weather)
    return "Погода неизвестна. Показаны сочетания для помещения; условия на улице оцени отдельно.";
  const notes = [
    "Это основа для помещения. Состав ткани, теплота и свобода посадки по фото не установлены.",
  ];
  if (weather.temperature < 10)
    notes.push("Для улицы нужно отдельное утепление и подходящая обувь.");
  if (weather.temperature >= 20)
    notes.push("В тепле проверь комфорт; дополнительный слой можно снять.");
  if (weather.precipitation > 0)
    notes.push("Осадки: проверь обувь и длину брюк, чтобы низ не намокал.");
  if (weather.wind >= 10)
    notes.push("Сильный ветер: потребуется защита от ветра.");
  return notes.join(" ");
}
