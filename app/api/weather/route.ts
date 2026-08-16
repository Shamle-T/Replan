import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const location = url.searchParams.get("location")?.trim();
  const start = url.searchParams.get("start")?.trim();
  const end = url.searchParams.get("end")?.trim();
  if (!location || !start || !end) return NextResponse.json({ error: "location, start and end are required" }, { status: 400 });
  try {
    const geocode = new URL("https://geocoding-api.open-meteo.com/v1/search");
    geocode.searchParams.set("name", location); geocode.searchParams.set("count", "1"); geocode.searchParams.set("format", "json");
    const placeResponse = await fetch(geocode, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
    const place = (await placeResponse.json()) as { results?: Array<{ name: string; admin1?: string; country?: string; latitude: number; longitude: number }> };
    const match = place.results?.[0];
    if (!placeResponse.ok || !match) return NextResponse.json({ error: "Location not found" }, { status: 404 });
    const forecast = new URL("https://api.open-meteo.com/v1/forecast");
    forecast.searchParams.set("latitude", String(match.latitude)); forecast.searchParams.set("longitude", String(match.longitude)); forecast.searchParams.set("current", "temperature_2m,weather_code,is_day"); forecast.searchParams.set("hourly", "weather_code,precipitation"); forecast.searchParams.set("timezone", "auto"); forecast.searchParams.set("start_date", start); forecast.searchParams.set("end_date", end);
    const weatherResponse = await fetch(forecast, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
    if (!weatherResponse.ok) throw new Error("Forecast lookup failed");
    const weather = await weatherResponse.json();
    return NextResponse.json({ ...weather, displayName: [match.name, match.admin1, match.country].filter(Boolean).join(", ") });
  } catch (error) { return NextResponse.json({ error: "Weather service unavailable", detail: error instanceof Error ? error.message : "Unknown weather error" }, { status: 502 }); }
}
