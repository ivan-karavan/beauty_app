import { setupPwa } from "./pwa.js";
import { SEASONS, currentSeason, selectLooks } from "./looks.js";
import { listPhotos } from "./photos.js";

const $ = (selector) => document.querySelector(selector);
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const SEASON_KEY = "beauty-app.season";
function restoreSeason() {
  try {
    const saved = localStorage.getItem(SEASON_KEY);
    if (SEASONS.some((season) => season.id === saved)) return saved;
  } catch {}
  return currentSeason();
}
const state = {
  tab: "looks",
  base: "49",
  occasion: "everyday",
  category: "all",
  photos: [],
  season: restoreSeason(),
};
let catalog;
const dialog = $("dialog");

function notify(message = "") {
  $("#message").textContent = message;
  $("#message").hidden = !message;
}

function closeDialog() {
  dialog.close();
}
dialog.addEventListener("close", () => {
  $("#dialog-content").replaceChildren();
});
dialog.querySelector(".close").addEventListener("click", closeDialog);

function showDialog(title, body) {
  $("#dialog-content").innerHTML =
    `<h2 id="dialog-title">${escape(title)}</h2>${body}`;
  dialog.showModal();
}

function itemPhoto(item) {
  return `<div class="photo"><img src="${escape(item.file)}" alt="${escape(item.name)}" loading="lazy" style="transform:rotate(${Number(item.rotation) || 0}deg)"></div>`;
}

function lookArtwork(look) {
  return `<div class="look-artwork"><img src="${escape(look.preview)}" alt="${escape(look.title)} — визуализация образа" loading="lazy"></div>`;
}

function lookAdditions(look) {
  if (!look.additions?.length) return "";
  return `<p class="look-additions"><strong>Дополнить:</strong> ${look.additions.map((item) => escape(item.name)).join(" · ")}<span>Вне каталога</span></p>`;
}

function missingItems(look) {
  if (!look.additions?.length) return "";
  return `<section class="look-suggestions" aria-labelledby="suggestions-title"><h3 id="suggestions-title">Чего не хватает</h3><p>Предлагаемые дополнения — их нет в каталоге.</p><ul>${look.additions.map((item) => `<li><span>${escape(item.name)}</span><small>${item.type === "clothing" ? "Одежда" : "Аксессуар"}</small></li>`).join("")}</ul></section>`;
}

function showSeasonPicker() {
  showDialog(
    "Выбери сезон",
    `<div class="season-options">${SEASONS.map((season) => `<button class="soft" data-season="${season.id}" aria-pressed="${state.season === season.id}">${escape(season.label)}</button>`).join("")}</div>`,
  );
  dialog.querySelectorAll("[data-season]").forEach((button) => {
    button.onclick = () => {
      state.season = button.dataset.season;
      try {
        localStorage.setItem(SEASON_KEY, state.season);
        notify();
      } catch {
        notify(
          "Не удалось сохранить сезон на устройстве. Выбор действует до перезагрузки страницы.",
        );
      }
      closeDialog();
      render();
    };
  });
}

function renderLooks() {
  const looks = selectLooks(catalog, state);
  return `<div class="segments" aria-label="Повод">${[
    ["everyday", "Повседневный"],
    ["evening", "Вечерний"],
  ]
    .map(
      ([value, label]) =>
        `<button data-occasion="${value}" aria-pressed="${state.occasion === value}">${label}</button>`,
    )
    .join("")}</div>
    <button class="base" data-action="base" aria-label="Сменить основу"><span>Основа: ${escape(catalog.items[state.base].name)}</span><span aria-hidden="true">Сменить ›</span></button>
    <p class="section-caption">Сочетаний: ${looks.length} · с твоими вещами</p>
    <div class="feed">${
      looks
        .map(
          (
            look,
          ) => `<button class="look-card" data-testid="look-card" data-look="${look.id}" aria-label="${escape(look.title)}">
      ${lookArtwork(look)}<div class="look-copy"><span class="eyebrow">${state.occasion === "everyday" ? "НА КАЖДЫЙ ДЕНЬ" : "ДЛЯ ОСОБОГО ВЕЧЕРА"}</span>${look.extended ? '<span class="look-badge">Сложный образ · С дополнениями</span>' : ""}<h2>${escape(look.title)}</h2><p>${escape(look.why)}</p>${lookAdditions(look)}<span class="more">Подробнее <span aria-hidden="true">↗</span></span></div>
    </button>`,
        )
        .join("") ||
      '<div class="empty"><span aria-hidden="true">✧</span><h2>Подходящих сочетаний пока нет</h2><p>Попробуй другой сезон, основу или повод.</p></div>'
    }</div>`;
}

function hasLooks(id) {
  return catalog.looks.some((look) => look.items.includes(Number(id)));
}

function renderWardrobe() {
  const items = [
    ...Object.entries(catalog.items).map(([id, item]) => ({ id, ...item })),
    ...state.photos,
  ];
  const categories = [
    ...catalog.categories,
    ...(state.photos.length
      ? [{ id: "saved", label: "Сохранённые фото" }]
      : []),
  ];
  return `<label class="category-picker" for="category">Категория<select id="category"><option value="all">Все категории</option>${categories.map((category) => `<option value="${escape(category.id)}" ${state.category === category.id ? "selected" : ""}>${escape(category.label)}</option>`).join("")}</select></label>
    ${categories
      .filter(
        (category) =>
          state.category === "all" || state.category === category.id,
      )
      .map((category) => {
        const group = items.filter((item) => item.category === category.id);
        if (!group.length) return "";
        return `<section class="wardrobe-category" data-category="${escape(category.id)}" aria-labelledby="category-${escape(category.id)}"><h2 id="category-${escape(category.id)}">${escape(category.label)}</h2><div class="wardrobe-grid">${group.map((item) => `<button class="item-card" data-testid="item-card" data-item="${escape(item.id)}" data-category="${escape(category.id)}" aria-label="${escape(item.name)}">${itemPhoto(item)}<h3>${escape(item.name)}</h3><p>${item.isSaved ? "На этом устройстве" : 'Посмотреть образы <span aria-hidden="true">›</span>'}</p></button>`).join("")}</div></section>`;
      })
      .join("")}`;
}

function render() {
  const season = SEASONS.find((season) => season.id === state.season);
  $("#season-picker").textContent = season.label;
  $("#season-picker").setAttribute("aria-label", `Сезон: ${season.label}`);
  if (!catalog) return;
  $("#title").textContent = state.tab === "looks" ? "Образы" : "Гардероб";
  $("#content").innerHTML =
    state.tab === "looks" ? renderLooks() : renderWardrobe();
  $("#content").setAttribute("aria-busy", "false");
  document.querySelectorAll("[data-tab]").forEach((button) => {
    if (button.dataset.tab === state.tab)
      button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
}

function chooseBase(id) {
  state.base = id;
  state.tab = "looks";
  closeDialog();
  render();
  window.scrollTo(0, 0);
}

function showItem(id) {
  const item =
    catalog.items[id] || state.photos.find((photo) => photo.id === id);
  showDialog(
    item.name,
    `${itemPhoto(item)}<p class="badge">${hasLooks(id) ? "В подборе" : "Пока без подбора"}</p><p>${item.isSaved ? "Фото сохранено на этом устройстве и доступно для просмотра." : hasLooks(id) ? "Для этой вещи есть готовые сочетания. Откроем их под выбранные сезон и повод." : "Для этой вещи пока нет готовых сочетаний. Вещь доступна в каталоге и при выборе основы."}</p>${item.isSaved ? "" : '<button class="primary" id="use-item">Образы с этой вещью →</button>'}`,
  );
  if (!item.isSaved) $("#use-item").onclick = () => chooseBase(id);
}

function showLook(id) {
  const look = catalog.looks.find((look) => look.id === Number(id));
  showDialog(
    look.title,
    `${lookArtwork(look)}<p class="artwork-caption">Визуализация образа</p><section class="look-originals" aria-labelledby="originals-title"><h3 id="originals-title">Исходные фотографии</h3><p class="section-caption">Вещи из твоего каталога.</p><div class="originals-grid">${look.items.map((id) => `<figure>${itemPhoto(catalog.items[id])}<figcaption>${escape(catalog.items[id].name)}</figcaption></figure>`).join("")}</div></section>${missingItems(look)}<h3>Почему вместе</h3><p>${escape(look.why)}</p><h3>Как носить</h3><p>${escape(look.wear)}</p><h3>По сезону</h3><p>${escape(look.seasonNote)}</p>`,
  );
}

function showBasePicker() {
  showDialog(
    "Выбери основу",
    `<p>Вещь, которая обязательно будет в каждом образе.</p><div class="base-grid">${Object.entries(
      catalog.items,
    )
      .map(
        ([id, item]) =>
          `<button data-base="${id}" aria-label="${escape(item.name)}">${itemPhoto(item)}<span>${escape(item.name)}</span></button>`,
      )
      .join("")}</div>`,
  );
  $("#dialog-content")
    .querySelectorAll("[data-base]")
    .forEach(
      (button) => (button.onclick = () => chooseBase(button.dataset.base)),
    );
}

$("#content").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const { occasion, item, look, action } = button.dataset;
  if (occasion) {
    state.occasion = occasion;
    render();
  }
  if (item) showItem(item);
  if (look) showLook(look);
  if (action === "base") showBasePicker();
});
document.querySelectorAll("[data-tab]").forEach(
  (button) =>
    (button.onclick = () => {
      state.tab = button.dataset.tab;
      render();
      window.scrollTo(0, 0);
    }),
);

$("#season-picker").onclick = showSeasonPicker;
$("#content").addEventListener("change", (event) => {
  if (event.target.id === "category") {
    state.category = event.target.value;
    render();
  }
});

async function refreshPhotos() {
  const photos = await listPhotos();
  state.photos.forEach((photo) => URL.revokeObjectURL(photo.file));
  state.photos = photos
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((photo) => ({
      id: photo.id,
      file: URL.createObjectURL(photo.file),
      name: "Сохранённое фото",
      isSaved: true,
      category: "saved",
    }));
}

async function start() {
  try {
    const response = await fetch("looks/looks.json");
    if (!response.ok) throw new Error("catalog");
    catalog = await response.json();
    render();
  } catch {
    $("#content").innerHTML =
      "<p>Не удалось открыть каталог. Обнови страницу, чтобы попробовать снова.</p>";
    $("#content").setAttribute("aria-busy", "false");
  }
  try {
    await refreshPhotos();
    render();
  } catch {
    notify(
      "Хранилище фото недоступно. Текущие вещи и образы по-прежнему доступны.",
    );
  }
}
setupPwa(showDialog, notify);
render();
start();
