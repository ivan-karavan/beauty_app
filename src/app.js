import { selectLooks, weatherAdvice } from "./looks.js";
import { loadWeather } from "./weather.js";
import { listPhotos, savePhoto } from "./photos.js";

const $ = (selector) => document.querySelector(selector);
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const state = {
  tab: "looks",
  base: "49",
  occasion: "everyday",
  filter: "all",
  photos: [],
  weather: null,
  weatherStatus: "Загружаем погоду…",
  location: "Москва",
};
let catalog;
let weatherRequest = 0;
let disposeDialog = () => {};
const dialog = $("dialog");

function notify(message = "") {
  $("#message").textContent = message;
  $("#message").hidden = !message;
}

function closeDialog() {
  dialog.close();
}
dialog.addEventListener("close", () => {
  disposeDialog();
  disposeDialog = () => {};
  $("#dialog-content").replaceChildren();
});
dialog.querySelector(".close").addEventListener("click", closeDialog);

function showDialog(title, body, dispose = () => {}) {
  $("#dialog-content").innerHTML =
    `<h2 id="dialog-title">${escape(title)}</h2>${body}`;
  disposeDialog = dispose;
  dialog.showModal();
}

function itemPhoto(item) {
  return `<div class="photo"><img src="${escape(item.file)}" alt="${escape(item.name)}" loading="lazy" style="transform:rotate(${Number(item.rotation) || 0}deg)"></div>`;
}

function lookPhotos(look) {
  if ([1, 3].includes(look.id))
    return `<div class="collage collage-${look.id}"><img src="looks/two-looks-preview.png" alt="${escape(look.title)} — готовый коллаж" loading="lazy"></div>`;
  return `<div class="look-photos">${look.items.map((id) => itemPhoto(catalog.items[id])).join("")}</div>`;
}

function condition(code) {
  if (code === 0) return "Ясно";
  if (code <= 3) return "Облачно";
  if ([45, 48].includes(code)) return "Туман";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Снег";
  if (code >= 95) return "Гроза";
  return "Дождь";
}

const degrees = (temperature) =>
  `${temperature < 0 ? "−" : temperature > 0 ? "+" : ""}${Math.abs(Math.round(temperature))}°`;

function weatherPanel() {
  const weather = state.weather;
  return `<section class="weather" aria-label="Погода">
    <strong>${weather ? `${degrees(weather.temperature)} · ${condition(weather.code)}` : escape(state.weatherStatus)}</strong>
    <p>${escape(state.location)}${weather ? ` · ${state.location === "Вручную" ? "твой выбор" : "сейчас, ощущается " + degrees(weather.feelsLike)}` : ""}</p>
    <div class="weather-actions"><button data-action="weather">${weather ? "Изменить погоду" : "Выбрать погоду"}</button><button data-action="location">По геопозиции</button></div>
  </section>`;
}

function renderLooks() {
  const looks = selectLooks(catalog, state);
  return `${weatherPanel()}
    <div class="segments" aria-label="Повод">${[
      ["everyday", "Повседневный"],
      ["evening", "Вечерний"],
    ]
      .map(
        ([value, label]) =>
          `<button data-occasion="${value}" aria-pressed="${state.occasion === value}">${label}</button>`,
      )
      .join("")}</div>
    <button class="base" data-action="base" aria-label="Сменить основу"><span>Основа: ${escape(catalog.items[state.base].name)}</span><span aria-hidden="true">Сменить ›</span></button>
    <p class="section-caption">Сочетаний: ${looks.length} · из твоих вещей</p>
    <div class="feed">${
      looks
        .map(
          (
            look,
          ) => `<button class="look-card" data-testid="look-card" data-look="${look.id}" aria-label="${escape(look.title)}">
      ${lookPhotos(look)}<div class="look-copy"><span class="eyebrow">${state.occasion === "everyday" ? "НА КАЖДЫЙ ДЕНЬ" : "ДЛЯ ОСОБОГО ВЕЧЕРА"}</span><h2>${escape(look.title)}</h2><p>${escape(look.why)}</p><span class="more">Подробнее <span aria-hidden="true">↗</span></span></div>
    </button>`,
        )
        .join("") ||
      '<div class="empty"><span aria-hidden="true">✧</span><h2>Подходящих сочетаний пока нет</h2><p>Попробуй другую основу или повод. Новые фото пока не участвуют в подборе.</p></div>'
    }</div>
    <p class="advice" data-testid="weather-advice">${weatherAdvice(state.weather)}</p>`;
}

function hasLooks(id) {
  return catalog.looks.some((look) => look.items.includes(Number(id)));
}

function renderWardrobe() {
  const current = Object.entries(catalog.items).map(([id, item]) => ({
    id,
    ...item,
    inLooks: hasLooks(id),
  }));
  const items =
    state.filter === "new"
      ? state.photos
      : state.filter === "curated"
        ? current.filter((item) => item.inLooks)
        : [...current, ...state.photos];
  return `<p class="intro">Твои вещи и сохранённые фото</p>
    <div class="segments filters">${[
      ["all", "Все"],
      ["curated", "В подборе"],
      ["new", "Новые фото"],
    ]
      .map(
        ([value, label]) =>
          `<button data-filter="${value}" aria-pressed="${state.filter === value}">${label}</button>`,
      )
      .join("")}</div>
    <div class="wardrobe-grid">${items.map((item) => `<button class="item-card" data-testid="item-card" data-item="${escape(item.id)}" aria-label="${escape(item.name)}">${itemPhoto(item)}<h2>${escape(item.name)}</h2><p>${item.inLooks ? 'В подборе <span aria-hidden="true">›</span>' : "Пока без подбора"}</p></button>`).join("")}</div>
    ${items.length ? '<p class="section-caption">Нажми на вещь, чтобы рассмотреть её или выбрать основой образов.</p>' : '<div class="empty"><h2>Новых фото пока нет</h2><p>Добавь фото с телефона — оно останется здесь.</p></div>'}`;
}

function render() {
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
    `${itemPhoto(item)}<p class="badge">${hasLooks(id) ? "В подборе" : "Пока без подбора"}</p><p>${item.isNew ? "Фото сохранено на устройстве. Распознавание и подбор появятся позже." : hasLooks(id) ? "Для этой вещи есть готовые сочетания. Откроем их под выбранные погоду и повод." : "Для этой вещи пока нет готовых сочетаний. Вещь доступна в каталоге и при выборе основы."}</p>${item.isNew ? "" : '<button class="primary" id="use-item">Образы с этой вещью →</button>'}`,
  );
  if (!item.isNew) $("#use-item").onclick = () => chooseBase(id);
}

function showLook(id) {
  const look = catalog.looks.find((look) => look.id === Number(id));
  showDialog(
    look.title,
    `${lookPhotos(look)}<ul class="item-names">${look.items.map((id) => `<li>${escape(catalog.items[id].name)}</li>`).join("")}</ul><h3>Почему вместе</h3><p>${escape(look.why)}</p><h3>Как носить</h3><p>${escape(look.wear)}</p><h3>По погоде</h3><p>${escape(look.weather)}</p><p class="advice">${weatherAdvice(state.weather)}</p>`,
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

function showWeatherForm() {
  showDialog(
    "Выбрать погоду",
    `<form id="weather-form"><label for="temperature">Температура, °C</label><div class="temperature-control"><input id="temperature" name="temperature" type="number" inputmode="decimal" min="-60" max="60" step="any" required value="${state.weather?.temperature ?? 12}"><button class="soft" id="temperature-sign" type="button" aria-label="Сменить знак температуры">+ / −</button></div><label>Осадки<select name="precipitation"><option value="dry">Без осадков</option><option value="rain">Дождь</option><option value="snow">Снег</option></select></label><label>Ветер, м/с<input name="wind" type="number" min="0" max="100" step="any" required value="${state.weather?.wind ?? 0}"></label><button class="primary" type="submit">Применить</button></form>`,
  );
  $("#temperature-sign").onclick = () => {
    const input = $("#temperature");
    input.value = String(-Number(input.value || 0));
    input.focus();
  };
  const currentCondition = state.weather && condition(state.weather.code);
  $("#weather-form select").value =
    currentCondition === "Снег"
      ? "snow"
      : state.weather?.precipitation > 0
        ? "rain"
        : "dry";
  $("#weather-form").onsubmit = (event) => {
    event.preventDefault();
    const data = new FormData(event.target);
    const temperature = Number(data.get("temperature"));
    weatherRequest++;
    state.weather = {
      temperature,
      feelsLike: temperature,
      precipitation: data.get("precipitation") === "dry" ? 0 : 1,
      code: { dry: 0, rain: 61, snow: 71 }[data.get("precipitation")],
      wind: Number(data.get("wind")),
    };
    state.location = "Вручную";
    closeDialog();
    render();
  };
}

async function updateWeather(location, label) {
  const request = ++weatherRequest;
  state.weatherStatus = "Загружаем погоду…";
  state.weather = null;
  state.location = label;
  render();
  try {
    const weather = await loadWeather(location);
    if (request !== weatherRequest) return;
    state.weather = weather;
  } catch {
    if (request !== weatherRequest) return;
    state.weatherStatus = "Не удалось загрузить погоду";
  }
  render();
}

function locate() {
  const request = ++weatherRequest;
  state.weatherStatus = "Определяем местоположение…";
  state.weather = null;
  render();
  const failed = () => {
    if (request !== weatherRequest) return;
    state.weatherStatus = "Геопозиция недоступна. Выбери погоду вручную";
    render();
  };
  if (!navigator.geolocation) return failed();
  navigator.geolocation.getCurrentPosition(
    (position) => {
      if (request === weatherRequest)
        updateWeather(position.coords, "Рядом с тобой");
    },
    failed,
    { timeout: 8000, maximumAge: 300000 },
  );
}

$("#content").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const { occasion, filter, item, look, action } = button.dataset;
  if (occasion) {
    state.occasion = occasion;
    render();
  }
  if (filter) {
    state.filter = filter;
    render();
  }
  if (item) showItem(item);
  if (look) showLook(look);
  if (action === "base") showBasePicker();
  if (action === "weather") showWeatherForm();
  if (action === "location") locate();
});
document.querySelectorAll("[data-tab]").forEach(
  (button) =>
    (button.onclick = () => {
      state.tab = button.dataset.tab;
      render();
      window.scrollTo(0, 0);
    }),
);

$("#add-photo").onclick = () => {
  showDialog(
    "Добавить фото",
    '<p>Сначала рассмотрим фото, затем сохраним его на устройстве.</p><div class="upload-actions"><button class="primary" id="pick-file">Выбрать с телефона</button><button class="soft" id="take-photo">Снять камерой</button></div>',
  );
  $("#pick-file").onclick = () => {
    closeDialog();
    $("#file").click();
  };
  $("#take-photo").onclick = () => {
    closeDialog();
    $("#camera").click();
  };
};

async function refreshPhotos() {
  const photos = await listPhotos();
  state.photos.forEach((photo) => URL.revokeObjectURL(photo.file));
  state.photos = photos
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((photo) => ({
      id: photo.id,
      file: URL.createObjectURL(photo.file),
      name: "Новое фото",
      isNew: true,
    }));
}

async function previewPhoto(event) {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  notify();
  if (file.size > 20 * 1024 * 1024)
    return notify("Фото слишком большое. Выбери файл до 20 МБ.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
  } catch {
    URL.revokeObjectURL(url);
    return notify(
      "Не удалось открыть фото. Выбери другое изображение (JPEG, PNG или WebP).",
    );
  }
  showDialog(
    "Предпросмотр",
    `<div class="preview"><img src="${url}" alt="Новое фото"></div><p>Фото останется только на этом устройстве. Пока без подбора.</p><p id="save-error" role="alert" hidden></p><button id="save-photo" class="primary">Сохранить фото</button><button id="cancel-photo" class="text-button">Отмена</button>`,
    () => URL.revokeObjectURL(url),
  );
  $("#cancel-photo").onclick = closeDialog;
  const saveError = $("#save-error");
  $("#save-photo").onclick = async (event) => {
    const button = event.target;
    button.disabled = true;
    button.textContent = "Сохраняем…";
    try {
      await savePhoto(file);
      await refreshPhotos();
      if (button.isConnected && dialog.open) {
        state.tab = "wardrobe";
        state.filter = "new";
        closeDialog();
        window.scrollTo(0, 0);
      }
      render();
    } catch {
      if (button.isConnected && dialog.open) {
        saveError.textContent =
          "Не удалось сохранить фото. Проверь свободное место и доступ к хранилищу браузера.";
        saveError.hidden = false;
        button.disabled = false;
        button.textContent = "Сохранить фото";
      }
    }
  };
}
$("#file").addEventListener("change", previewPhoto);
$("#camera").addEventListener("change", previewPhoto);

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
start();
updateWeather({ latitude: 55.75, longitude: 37.62 }, "Москва");
