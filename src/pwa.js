export function setupPwa(showDialog, notify) {
  const install = document.querySelector("#install-app");
  const standalone = () =>
    matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  const isIOS =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  let installPrompt;
  const showHelp = () =>
    showDialog(
      "Добавить на главный экран",
      `
    <p><strong>iPhone и iPad:</strong> открой сайт в Safari, нажми «Поделиться» → «На экран „Домой“» → «Добавить». Если есть переключатель «Открыть как веб-приложение», оставь его включённым.</p>
    <p><strong>Android:</strong> открой меню браузера ⋮ → «Установить приложение» или «Добавить на главный экран».</p>
    <p><strong>Компьютер:</strong> в Chrome или Edge нажми значок установки в адресной строке или выбери установку приложения в меню.</p>`,
    );
  install.hidden = Boolean(standalone());
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
  });
  window.addEventListener("appinstalled", () => {
    install.hidden = true;
    installPrompt = null;
  });
  install.onclick = async () => {
    if (!installPrompt || isIOS) return showHelp();
    const prompt = installPrompt;
    installPrompt = null;
    try {
      await prompt.prompt();
      if ((await prompt.userChoice).outcome === "accepted")
        install.hidden = true;
    } catch {
      showHelp();
    }
  };

  const build = document.querySelector('meta[name="app-build"]')?.content;
  if (!build || build === "development" || !("serviceWorker" in navigator))
    return;
  let reloadRequested = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!reloadRequested) return;
    reloadRequested = false;
    location.reload();
  });
  navigator.serviceWorker
    .register(new URL("../sw.js", import.meta.url), {
      scope: new URL("../", import.meta.url).href,
      updateViaCache: "none",
    })
    .then((registration) => {
      const banner = document.querySelector("#pwa-update");
      const announce = () => {
        if (registration.waiting && navigator.serviceWorker.controller)
          banner.hidden = false;
      };
      announce();
      const watchInstalling = () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed") announce();
          if (worker.state === "redundant")
            notify(
              "Не удалось подготовить офлайн-версию. С подключением к интернету приложение остаётся доступным.",
            );
        });
      };
      watchInstalling();
      registration.addEventListener("updatefound", watchInstalling);
      document.querySelector("#pwa-reload").onclick = () => {
        if (!registration.waiting) return location.reload();
        reloadRequested = true;
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      };
    })
    .catch(() =>
      notify(
        "Не удалось включить офлайн-режим. Попробуй обновить страницу с подключением к интернету.",
      ),
    );
}
