import type { SchedulingWindow, Task, WeatherWindowsByTaskId } from "../scheduler/types";

const GEOCODING_ENDPOINT = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_ENDPOINT = "https://api.open-meteo.com/v1/forecast";

export type WeatherTaskState = "ready" | "blocked" | "error";

export interface WeatherSnapshot {
  code: number;
  temperatureC?: number;
  label: string;
  icon: string;
}

export interface WeatherTaskStatus {
  state: WeatherTaskState;
  location: string;
  summary: string;
  source: "Open-Meteo";
  current?: WeatherSnapshot;
  errorDetail?: string;
}

export interface WeatherConstraintResult {
  windowsByTaskId: WeatherWindowsByTaskId;
  statusByTaskId: Record<string, WeatherTaskStatus>;
}

interface GeocodingResponse {
  results?: Array<{
    name: string;
    country?: string;
    admin1?: string;
    latitude: number;
    longitude: number;
    timezone?: string;
  }>;
}

interface ForecastResponse {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
    is_day?: number;
  };
  hourly?: {
    time?: string[];
    weather_code?: number[];
    precipitation?: number[];
  };
}

interface ProxyWeatherResponse extends ForecastResponse {
  displayName?: string;
  error?: string;
  detail?: string;
}

interface LocationForecast {
  displayName: string;
  windows: SchedulingWindow[];
  current?: WeatherSnapshot;
}

/**
 * Fetches clear/dry windows for weather-sensitive tasks.
 * Network calls stay outside the scheduler; only deterministic windows are injected into it.
 *
 * Replan first calls its own Next.js route so deployments do not depend on browser CORS.
 * If that route is unavailable (for example in a static preview), it falls back to the
 * public Open-Meteo endpoints directly. No API key is required for the non-commercial MVP.
 */
export async function fetchWeatherConstraints(
  tasks: Task[],
  dayStart: Date,
  dayEnd: Date,
  signal?: AbortSignal,
): Promise<WeatherConstraintResult> {
  const weatherTasks = tasks.filter(
    (task) => task.weatherSensitive && weatherQueryForTask(task),
  );
  const windowsByTaskId: WeatherWindowsByTaskId = {};
  const statusByTaskId: Record<string, WeatherTaskStatus> = {};

  if (weatherTasks.length === 0) return { windowsByTaskId, statusByTaskId };

  const queryByTaskId = new Map(
    weatherTasks.map((task) => [task.id, weatherQueryForTask(task)!]),
  );
  const locations = [...new Set(queryByTaskId.values())];
  const forecasts = new Map<string, LocationForecast | Error>();

  await Promise.all(
    locations.map(async (location) => {
      try {
        forecasts.set(
          location,
          await fetchLocationForecast(location, dayStart, dayEnd, signal),
        );
      } catch (error) {
        forecasts.set(
          location,
          error instanceof Error ? error : new Error("Weather unavailable"),
        );
      }
    }),
  );

  for (const task of weatherTasks) {
    const location = queryByTaskId.get(task.id)!;
    const forecast = forecasts.get(location);
    if (!forecast || forecast instanceof Error) {
      windowsByTaskId[task.id] = [];
      statusByTaskId[task.id] = {
        state: "error",
        location,
        summary: "Couldn't load weather for this area. Check the city/suburb and try again.",
        source: "Open-Meteo",
        errorDetail: forecast instanceof Error ? forecast.message : undefined,
      };
      continue;
    }

    windowsByTaskId[task.id] = forecast.windows;
    statusByTaskId[task.id] = {
      state: forecast.windows.length > 0 ? "ready" : "blocked",
      location: forecast.displayName,
      summary:
        forecast.windows.length > 0
          ? `${forecast.windows.length} clear, dry window${forecast.windows.length === 1 ? "" : "s"} available today.`
          : "No clear, dry window is available today. The task will stay open for another day.",
      source: "Open-Meteo",
      current: forecast.current,
    };
  }

  return { windowsByTaskId, statusByTaskId };
}

function weatherQueryForTask(task: Task): string | undefined {
  const value = task.weatherLocation?.trim() || task.location?.trim();
  return value || undefined;
}

async function fetchLocationForecast(
  location: string,
  dayStart: Date,
  dayEnd: Date,
  signal?: AbortSignal,
): Promise<LocationForecast> {
  try {
    return await fetchViaAppRoute(location, dayStart, dayEnd, signal);
  } catch (proxyError) {
    try {
      return await fetchDirect(location, dayStart, dayEnd, signal);
    } catch (directError) {
      const proxyMessage = proxyError instanceof Error ? proxyError.message : "app route failed";
      const directMessage = directError instanceof Error ? directError.message : "direct request failed";
      throw new Error(`${proxyMessage}; ${directMessage}`);
    }
  }
}

async function fetchViaAppRoute(
  location: string,
  dayStart: Date,
  dayEnd: Date,
  signal?: AbortSignal,
): Promise<LocationForecast> {
  const params = new URLSearchParams({
    location,
    start: dateKey(dayStart),
    end: dateKey(new Date(dayEnd.getTime() - 1)),
  });
  const response = await fetch(`/api/weather?${params.toString()}`, {
    signal,
    cache: "no-store",
  });
  const payload = (await response.json()) as ProxyWeatherResponse;
  if (!response.ok) {
    throw new Error(payload.detail || payload.error || "Weather route failed");
  }

  return forecastPayloadToLocationForecast(
    payload,
    payload.displayName || location,
    dayStart,
    dayEnd,
  );
}

async function fetchDirect(
  location: string,
  dayStart: Date,
  dayEnd: Date,
  signal?: AbortSignal,
): Promise<LocationForecast> {
  const geocodeUrl = new URL(GEOCODING_ENDPOINT);
  geocodeUrl.searchParams.set("name", location);
  geocodeUrl.searchParams.set("count", "5");
  geocodeUrl.searchParams.set("language", "en");
  geocodeUrl.searchParams.set("format", "json");

  const geocodeResponse = await fetch(geocodeUrl, { signal });
  if (!geocodeResponse.ok) throw new Error("Location lookup failed");
  const geocode = (await geocodeResponse.json()) as GeocodingResponse;
  const match = geocode.results?.[0];
  if (!match) {
    throw new Error("Location not found. Use a city, suburb, or postcode.");
  }

  const forecastUrl = new URL(FORECAST_ENDPOINT);
  forecastUrl.searchParams.set("latitude", String(match.latitude));
  forecastUrl.searchParams.set("longitude", String(match.longitude));
  forecastUrl.searchParams.set("current", "temperature_2m,weather_code,is_day");
  forecastUrl.searchParams.set("hourly", "weather_code,precipitation");
  forecastUrl.searchParams.set("timezone", "auto");
  forecastUrl.searchParams.set("start_date", dateKey(dayStart));
  forecastUrl.searchParams.set("end_date", dateKey(new Date(dayEnd.getTime() - 1)));

  const forecastResponse = await fetch(forecastUrl, { signal });
  if (!forecastResponse.ok) throw new Error("Forecast lookup failed");
  const forecast = (await forecastResponse.json()) as ForecastResponse;

  return forecastPayloadToLocationForecast(
    forecast,
    [match.name, match.admin1, match.country].filter(Boolean).join(", "),
    dayStart,
    dayEnd,
  );
}

function forecastPayloadToLocationForecast(
  forecast: ForecastResponse,
  displayName: string,
  dayStart: Date,
  dayEnd: Date,
): LocationForecast {
  const times = forecast.hourly?.time ?? [];
  const codes = forecast.hourly?.weather_code ?? [];
  const precipitation = forecast.hourly?.precipitation ?? [];
  if (times.length === 0) throw new Error("Forecast did not contain hourly data");

  const windows = mergeSuitableHours(
    times.map((time, index) => ({
      start: parseForecastLocalTime(time),
      suitable: isClearAndDry(codes[index], precipitation[index]),
    })),
    dayStart,
    dayEnd,
  );

  const currentCode = forecast.current?.weather_code;
  const current = Number.isFinite(currentCode)
    ? weatherSnapshot(
        currentCode as number,
        forecast.current?.temperature_2m,
        forecast.current?.is_day !== 0,
      )
    : undefined;

  return { displayName, windows, current };
}

function isClearAndDry(weatherCode: number | undefined, precipitation: number | undefined): boolean {
  return Number.isFinite(weatherCode) && (weatherCode as number) <= 2 && (precipitation ?? 0) <= 0.1;
}

export function weatherSnapshot(
  code: number,
  temperatureC?: number,
  isDay = true,
): WeatherSnapshot {
  if (code === 0) return { code, temperatureC, label: "Clear", icon: isDay ? "☀" : "☾" };
  if (code === 1) return { code, temperatureC, label: "Mostly clear", icon: isDay ? "🌤" : "☾" };
  if (code === 2) return { code, temperatureC, label: "Partly cloudy", icon: "⛅" };
  if (code === 3) return { code, temperatureC, label: "Cloudy", icon: "☁" };
  if ([45, 48].includes(code)) return { code, temperatureC, label: "Foggy", icon: "🌫" };
  if ([51, 53, 55, 56, 57].includes(code)) return { code, temperatureC, label: "Drizzle", icon: "🌦" };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { code, temperatureC, label: "Rain", icon: "🌧" };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { code, temperatureC, label: "Snow", icon: "❄" };
  if ([95, 96, 99].includes(code)) return { code, temperatureC, label: "Thunderstorms", icon: "⛈" };
  return { code, temperatureC, label: "Mixed weather", icon: "☁" };
}

function mergeSuitableHours(
  values: Array<{ start: Date; suitable: boolean }>,
  dayStart: Date,
  dayEnd: Date,
): SchedulingWindow[] {
  const windows: SchedulingWindow[] = [];
  let currentStart: Date | null = null;
  let currentEnd: Date | null = null;

  for (const value of values) {
    const hourStart = value.start;
    const hourEnd = new Date(hourStart.getTime() + 60 * 60_000);
    const insideDay = hourEnd.getTime() > dayStart.getTime() && hourStart.getTime() < dayEnd.getTime();

    if (!value.suitable || !insideDay) {
      if (currentStart && currentEnd) windows.push({ start: currentStart, end: currentEnd });
      currentStart = null;
      currentEnd = null;
      continue;
    }

    const clippedStart = new Date(Math.max(hourStart.getTime(), dayStart.getTime()));
    const clippedEnd = new Date(Math.min(hourEnd.getTime(), dayEnd.getTime()));
    if (currentEnd && currentEnd.getTime() === clippedStart.getTime()) {
      currentEnd = clippedEnd;
    } else {
      if (currentStart && currentEnd) windows.push({ start: currentStart, end: currentEnd });
      currentStart = clippedStart;
      currentEnd = clippedEnd;
    }
  }

  if (currentStart && currentEnd) windows.push({ start: currentStart, end: currentEnd });
  return windows;
}

function parseForecastLocalTime(value: string): Date {
  const [datePart, timePart = "00:00"] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}