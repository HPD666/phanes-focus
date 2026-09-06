/**
 * Weather telemetry via Open-Meteo — a free, keyless, CORS-enabled API.
 * Phanes treats weather as one of its analysis layers and the AI engine
 * reads it when answering the operator.
 */

export interface WeatherNow {
  temperature: number;
  apparent: number;
  humidity: number;
  precipitation: number;
  windSpeed: number;
  windDirection: number;
  code: number;
  isDay: boolean;
  label: string;
  icon: "sun" | "cloud" | "rain" | "snow" | "storm" | "fog" | "night";
  fetchedAt: number;
}

const CODE_MAP: Record<number, { label: string; icon: WeatherNow["icon"] }> = {
  0: { label: "Clear sky", icon: "sun" },
  1: { label: "Mainly clear", icon: "sun" },
  2: { label: "Partly cloudy", icon: "cloud" },
  3: { label: "Overcast", icon: "cloud" },
  45: { label: "Fog", icon: "fog" },
  48: { label: "Depositing rime fog", icon: "fog" },
  51: { label: "Light drizzle", icon: "rain" },
  53: { label: "Drizzle", icon: "rain" },
  55: { label: "Dense drizzle", icon: "rain" },
  61: { label: "Light rain", icon: "rain" },
  63: { label: "Rain", icon: "rain" },
  65: { label: "Heavy rain", icon: "rain" },
  66: { label: "Freezing rain", icon: "rain" },
  67: { label: "Heavy freezing rain", icon: "rain" },
  71: { label: "Light snow", icon: "snow" },
  73: { label: "Snow", icon: "snow" },
  75: { label: "Heavy snow", icon: "snow" },
  77: { label: "Snow grains", icon: "snow" },
  80: { label: "Light showers", icon: "rain" },
  81: { label: "Showers", icon: "rain" },
  82: { label: "Violent showers", icon: "storm" },
  85: { label: "Snow showers", icon: "snow" },
  86: { label: "Heavy snow showers", icon: "snow" },
  95: { label: "Thunderstorm", icon: "storm" },
  96: { label: "Thunderstorm with hail", icon: "storm" },
  99: { label: "Severe thunderstorm", icon: "storm" },
};

let cache: { key: string; data: WeatherNow; at: number } | null = null;

export async function fetchWeather(
  lat: number,
  lng: number,
): Promise<WeatherNow | null> {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  if (cache && cache.key === key && Date.now() - cache.at < 10 * 60 * 1000) {
    return cache.data;
  }
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,` +
      `precipitation,weather_code,wind_speed_10m,wind_direction_10m,is_day&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      current?: {
        temperature_2m: number;
        apparent_temperature: number;
        relative_humidity_2m: number;
        precipitation: number;
        weather_code: number;
        wind_speed_10m: number;
        wind_direction_10m: number;
        is_day: number;
      };
    };
    const cur = json.current;
    if (!cur) return null;
    const mapped = CODE_MAP[cur.weather_code] ?? {
      label: "Unknown",
      icon: "cloud" as const,
    };
    const data: WeatherNow = {
      temperature: cur.temperature_2m,
      apparent: cur.apparent_temperature,
      humidity: cur.relative_humidity_2m,
      precipitation: cur.precipitation,
      windSpeed: cur.wind_speed_10m,
      windDirection: cur.wind_direction_10m,
      code: cur.weather_code,
      isDay: cur.is_day === 1,
      ...mapped,
      fetchedAt: Date.now(),
    };
    cache = { key, data, at: Date.now() };
    return data;
  } catch {
    return null;
  }
}