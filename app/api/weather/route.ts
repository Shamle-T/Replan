import { NextResponse } from "next/server";

const GEOCODING_ENDPOINT = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_ENDPOINT = "https://api.open-meteo.com/v1/forecast";

interface GeocodingResponse {
  results?: Array<{
    name: string;
    country?: string;
    admin1?: string;
    latitude: number;
    longitude: number;
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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const location = url.searchParams.get("location")?.trim();
  const startDate = url.searchParams.get("start")?.trim();
  const endDate = url.searchParams.get("end")?.trim();

  if (!location || !startDate || !endDate) {
    return NextResponse.json(
      { error: "location, start and end are required" },
      { status: 400 },
    );
  }

  try {
    const geocodeUrl = new URL(GEOCODING_ENDPOINT);
    geocodeUrl.searchParams.set("name", location);
    geocodeUrl.searchParams.set("count", "5");
    geocodeUrl.searchParams.set("language", "en");
    geocodeUrl.searchParams.set("format", "json");

    const geocodeResponse = await fetch(geocodeUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!geocodeResponse.ok) {
      throw new Error(`Location lookup failed (${geocodeResponse.status})`);
    }

    const geocode = (await geocodeResponse.json()) as GeocodingResponse;
    const match = geocode.results?.[0];
    if (!match) {
      return NextResponse.json(
        {
          error: "Location not found",
          detail: "Use a city, suburb, or postcode such as ‘Subang Jaya, Malaysia’.",
        },
        { status: 404 },
      );
    }

    const forecastUrl = new URL(FORECAST_ENDPOINT);
    forecastUrl.searchParams.set("latitude", String(match.latitude));
    forecastUrl.searchParams.set("longitude", String(match.longitude));
    forecastUrl.searchParams.set("current", "temperature_2m,weather_code,is_day");
    forecastUrl.searchParams.set("hourly", "weather_code,precipitation");
    forecastUrl.searchParams.set("timezone", "auto");
    forecastUrl.searchParams.set("start_date", startDate);
    forecastUrl.searchParams.set("end_date", endDate);

    const forecastResponse = await fetch(forecastUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!forecastResponse.ok) {
      throw new Error(`Forecast lookup failed (${forecastResponse.status})`);
    }

    const forecast = (await forecastResponse.json()) as ForecastResponse;
    const times = forecast.hourly?.time ?? [];
    const codes = forecast.hourly?.weather_code ?? [];
    const precipitation = forecast.hourly?.precipitation ?? [];

    if (times.length === 0) {
      throw new Error("Forecast did not contain hourly data");
    }

    return NextResponse.json({
      displayName: [match.name, match.admin1, match.country].filter(Boolean).join(", "),
      current: forecast.current,
      hourly: {
        time: times,
        weather_code: codes,
        precipitation,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Weather service unavailable";
    return NextResponse.json(
      {
        error: "Weather service unavailable",
        detail: message,
      },
      { status: 502 },
    );
  }
}
