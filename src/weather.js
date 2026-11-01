export async function loadWeather({ latitude, longitude }, fetcher = fetch) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude,
    longitude,
    current:
      "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
    wind_speed_unit: "ms",
  });
  const response = await fetcher(url, {
    signal: AbortSignal.timeout(8000),
    credentials: "omit",
  });
  if (!response.ok) throw new Error("Прогноз недоступен");
  const { current } = await response.json();
  const fields = [
    "temperature_2m",
    "apparent_temperature",
    "precipitation",
    "weather_code",
    "wind_speed_10m",
  ];
  if (!current || !fields.every((key) => Number.isFinite(current[key])))
    throw new Error("Неполный прогноз");
  return {
    temperature: current.temperature_2m,
    feelsLike: current.apparent_temperature,
    precipitation: current.precipitation,
    code: current.weather_code,
    wind: current.wind_speed_10m,
  };
}
