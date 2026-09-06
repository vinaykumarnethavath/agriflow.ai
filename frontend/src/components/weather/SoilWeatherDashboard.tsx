"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
    Droplets,
    Thermometer,
    Wind,
    CloudRain,
    Sun,
    MapPin,
    Calendar,
    Sprout,
    RefreshCw,
    Layers,
    AlertTriangle,
    CheckCircle2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import api, {
    getSoilWeatherForecast,
    SoilWeatherResponse,
    FarmerRecommendation
} from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import { T } from "@/components/TranslateText";

// Soil moisture color thresholds
function getMoistureColor(val: number) {
    if (val < 0.10) return "#ef4444"; // Red (Critically Dry)
    if (val < 0.20) return "#f59e0b"; // Amber (Low)
    if (val < 0.30) return "#0ea5e9"; // Sky Blue (Optimal)
    return "#10b981"; // Emerald Green (Saturated/High)
}

function getMoistureStatusBadge(val: number) {
    if (val < 0.10) return { label: "Dry", bg: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300" };
    if (val < 0.20) return { label: "Low", bg: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300" };
    if (val < 0.35) return { label: "Optimal", bg: "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300" };
    return { label: "Moist", bg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" };
}

function getWeatherIcon(precip: number, tempMax: number) {
    if (precip > 10) return "⛈️";
    if (precip > 2) return "🌧️";
    if (tempMax > 36) return "☀️";
    if (tempMax > 28) return "🌤️";
    if (tempMax > 18) return "⛅";
    return "🌥️";
}

function getDayName(dateStr: string, idx: number, locale: string = "en") {
    if (idx === 0) return locale === "te" ? "ఈరోజు" : locale === "hi" ? "आज" : locale === "ta" ? "இன்று" : locale === "kn" ? "ಇಂದು" : "Today";
    if (idx === 1) return locale === "te" ? "రేపు" : locale === "hi" ? "कल" : locale === "ta" ? "நாளை" : locale === "kn" ? "ನಾಳೆ" : "Tomorrow";
    try {
        const dt = new Date(dateStr);
        return dt.toLocaleDateString(locale === "te" ? "te-IN" : locale === "hi" ? "hi-IN" : locale === "ta" ? "ta-IN" : locale === "kn" ? "kn-IN" : "en-US", { weekday: "short" });
    } catch {
        return `Day ${idx + 1}`;
    }
}

export default function SoilWeatherDashboard() {
    const { t } = useLanguage();
    const [lat, setLat] = useState<number>(17.3850);
    const [lon, setLon] = useState<number>(78.4867);
    const [locationName, setLocationName] = useState("Detecting Farm Location...");
    const [data, setData] = useState<SoilWeatherResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Direct telemetry fetcher
    const fetchDirectValues = useCallback(async (latitude: number, longitude: number, name?: string) => {
        setLoading(true);
        setError(null);
        try {
            const resp = await getSoilWeatherForecast(latitude, longitude);
            setData(resp);
            if (name) {
                setLocationName(name);
            }
        } catch (err: any) {
            console.error("Failed to fetch weather & soil data:", err);
            setError(err.response?.data?.detail || "Failed to fetch live data from Open-Meteo API.");
        } finally {
            setLoading(false);
        }
    }, []);

    // Automatic location detection on mount
    useEffect(() => {
        const resolveLocationAndLoad = async () => {
            setLoading(true);

            const loadFallbackFromProfile = async () => {
                try {
                    const profileRes = await api.get("/farmer/profile");
                    const p = profileRes.data || {};

                    const q = [p.village, p.mandal, p.district, p.state, "India"].filter(Boolean).join(", ");
                    if (q && q.trim().length > 0) {
                        const geoRes = await api.get("/weather/geocode", { params: { name: p.district || p.village || "Hyderabad" } });
                        const first = geoRes.data?.results?.[0];
                        if (first?.latitude && first?.longitude) {
                            setLat(first.latitude);
                            setLon(first.longitude);
                            setLocationName(first.display || q);
                            await fetchDirectValues(first.latitude, first.longitude, first.display || q);
                            return;
                        }
                    }
                } catch {
                    // Profile lookup fallback
                }

                // Default location fallback
                setLat(17.3850);
                setLon(78.4867);
                setLocationName("Hyderabad, Telangana, India");
                await fetchDirectValues(17.3850, 78.4867, "Hyderabad, Telangana, India");
            };

            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    async (pos) => {
                        const userLat = Number(pos.coords.latitude.toFixed(4));
                        const userLon = Number(pos.coords.longitude.toFixed(4));
                        setLat(userLat);
                        setLon(userLon);
                        const autoName = `Farm Location (${userLat}°, ${userLon}°)`;
                        setLocationName(autoName);
                        await fetchDirectValues(userLat, userLon, autoName);
                    },
                    async () => {
                        await loadFallbackFromProfile();
                    },
                    { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
                );
            } else {
                await loadFallbackFromProfile();
            }
        };

        resolveLocationAndLoad();
    }, [fetchDirectValues]);

    const handleRefresh = () => {
        fetchDirectValues(lat, lon, locationName);
    };

    const current = data?.current || {};
    const daily = data?.daily || [];
    const recommendations = data?.recommendations || [];

    // Compact simplified soil depth configuration
    const soilMoistureLayers = [
        { label: "Topsoil (0–1 cm)", shortDesc: "Germination layer", key: "soil_moisture_0_to_1cm", altKey: "soil_moisture_0_to_7cm" },
        { label: "Shallow (1–3 cm)", shortDesc: "Seedling roots", key: "soil_moisture_1_to_3cm", altKey: "soil_moisture_7_to_28cm" },
        { label: "Active (3–9 cm)", shortDesc: "Main crop roots", key: "soil_moisture_3_to_9cm", altKey: "soil_moisture_28_to_100cm" },
        { label: "Deep (9–27 cm)", shortDesc: "Taproot feeding", key: "soil_moisture_9_to_27cm", altKey: "soil_moisture_100_to_255cm" },
        { label: "Subsoil (27–81 cm)", shortDesc: "Deep water reserve", key: "soil_moisture_27_to_81cm" },
    ];

    const surfaceMoistureVal = current.soil_moisture_0_to_1cm ?? current.soil_moisture_0_to_7cm;

    return (
        <div className="space-y-5">
            {/* ── 1. Top Location Header & Status Bar ── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-card p-3.5 sm:p-4 rounded-xl border border-border shadow-xs">
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-bold text-card-foreground flex items-center gap-1.5">
                            <MapPin className="h-4 w-4 text-green-600 dark:text-green-400" />
                            {locationName}
                        </h2>
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-green-100 text-green-800 dark:bg-green-950/80 dark:text-green-300 border border-green-200 dark:border-green-800 inline-flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                            <T>Live Weather & Soil Telemetry</T>
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Lat: {data?.latitude ?? lat}° · Lon: {data?.longitude ?? lon}° · Elevation: {data?.elevation ?? 0}m · Timezone: {data?.timezone ?? "UTC"}
                    </p>
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={loading}
                    className="text-xs font-semibold gap-1.5 border-border bg-card hover:bg-muted shrink-0"
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                    {t("common.refresh", "Refresh")}
                </Button>
            </div>

            {/* Loading Indicator */}
            {loading && !data && (
                <div className="p-10 rounded-xl bg-card border border-border text-center space-y-2">
                    <div className="h-7 w-7 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-sm font-semibold text-foreground"><T>Fetching live agricultural telemetry...</T></p>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {error}
                </div>
            )}

            {/* ── 2. Top 5 Key Metric KPI Cards ── */}
            {data && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
                    {/* 1. Surface Moisture */}
                    <Card className="border-border bg-card shadow-xs">
                        <CardContent className="p-3.5 space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-muted-foreground"><T>Soil Moisture</T></span>
                                <div className="p-1 rounded-md bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
                                    <Droplets className="h-3.5 w-3.5" />
                                </div>
                            </div>
                            <div className="text-xl sm:text-2xl font-black text-sky-600 dark:text-sky-400">
                                {surfaceMoistureVal != null ? `${(surfaceMoistureVal * 100).toFixed(1)}%` : "N/A"}
                            </div>
                            <p className="text-[10px] text-muted-foreground font-medium truncate">
                                {surfaceMoistureVal != null ? (surfaceMoistureVal > 0.20 ? <T>Optimal Moisture</T> : <T>Needs Watering</T>) : <T>Surface moisture</T>}
                            </p>
                        </CardContent>
                    </Card>

                    {/* 2. Air Temperature */}
                    <Card className="border-border bg-card shadow-xs">
                        <CardContent className="p-3.5 space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-muted-foreground"><T>Air Temperature</T></span>
                                <div className="p-1 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                                    <Thermometer className="h-3.5 w-3.5" />
                                </div>
                            </div>
                            <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">
                                {current.temperature_2m != null ? `${current.temperature_2m.toFixed(1)}°C` : "N/A"}
                            </div>
                            <p className="text-[10px] text-muted-foreground font-medium truncate">
                                {current.temperature_2m_max != null && current.temperature_2m_min != null
                                    ? `H: ${current.temperature_2m_max.toFixed(0)}° · L: ${current.temperature_2m_min.toFixed(0)}°`
                                    : <T>Current temp</T>}
                            </p>
                        </CardContent>
                    </Card>

                    {/* 3. Precipitation */}
                    <Card className="border-border bg-card shadow-xs">
                        <CardContent className="p-3.5 space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-muted-foreground"><T>Rainfall Today</T></span>
                                <div className="p-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                                    <CloudRain className="h-3.5 w-3.5" />
                                </div>
                            </div>
                            <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                                {current.precipitation_sum != null
                                    ? `${current.precipitation_sum} mm`
                                    : (current.precipitation != null ? `${current.precipitation} mm` : "0.0 mm")}
                            </div>
                            <p className="text-[10px] text-muted-foreground font-medium truncate">
                                <T>Total rainfall</T>
                            </p>
                        </CardContent>
                    </Card>

                    {/* 4. Wind Speed */}
                    <Card className="border-border bg-card shadow-xs">
                        <CardContent className="p-3.5 space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-muted-foreground"><T>Wind Speed</T></span>
                                <div className="p-1 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                                    <Wind className="h-3.5 w-3.5" />
                                </div>
                            </div>
                            <div className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400">
                                {current.windspeed_10m != null ? `${current.windspeed_10m.toFixed(1)} km/h` : "N/A"}
                            </div>
                            <p className="text-[10px] text-muted-foreground font-medium truncate">
                                {current.windspeed_10m != null && current.windspeed_10m > 20 ? <T>Breezy / High Wind</T> : <T>Calm / Good for Spray</T>}
                            </p>
                        </CardContent>
                    </Card>

                    {/* 5. Evapotranspiration */}
                    <Card className="border-border bg-card shadow-xs col-span-2 sm:col-span-1">
                        <CardContent className="p-3.5 space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-muted-foreground"><T>Water Evaporation</T></span>
                                <div className="p-1 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                                    <Sun className="h-3.5 w-3.5" />
                                </div>
                            </div>
                            <div className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400">
                                {(current.evapotranspiration ?? current.et0_fao_evapotranspiration) != null
                                    ? `${(current.evapotranspiration ?? current.et0_fao_evapotranspiration)?.toFixed(1)} mm`
                                    : "N/A"}
                            </div>
                            <p className="text-[10px] text-muted-foreground font-medium truncate">
                                <T>Daily soil water loss</T>
                            </p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* ── 3. Smart Farmer Advisory & Recommendations (Prominent at top) ── */}
            {recommendations.length > 0 && (
                <Card className="border-border bg-card shadow-xs">
                    <CardHeader className="p-3.5 sm:p-4 pb-2 border-b border-border">
                        <CardTitle className="text-sm font-bold flex items-center gap-2 text-card-foreground">
                            🧑‍🌾 <T>Smart Farmer Advisory & Immediate Action Tips</T>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3.5 sm:p-4 space-y-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            {recommendations.map((rec: FarmerRecommendation, idx: number) => {
                                const isWarning = rec.type === "warning";
                                const isCaution = rec.type === "caution";
                                const isSuccess = rec.type === "success";

                                const badgeStyles = isWarning
                                    ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
                                    : isCaution
                                    ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300"
                                    : isSuccess
                                    ? "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300"
                                    : "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300";

                                return (
                                    <div
                                        key={idx}
                                        className={`p-3 rounded-xl border flex items-start gap-2.5 transition-all ${badgeStyles}`}
                                    >
                                        <span className="text-xl shrink-0 mt-0.5">{rec.icon}</span>
                                        <div>
                                            <p className="font-bold text-xs"><T>{rec.title}</T></p>
                                            <p className="text-[11px] opacity-90 mt-0.5 leading-relaxed"><T>{rec.text}</T></p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── 4. 7-Day Agricultural Weather & Rainfall Forecast ── */}
            {daily.length > 1 && (
                <Card className="border-border bg-card shadow-xs">
                    <CardHeader className="p-3.5 sm:p-4 pb-2 border-b border-border">
                        <CardTitle className="text-sm font-bold flex items-center justify-between text-card-foreground">
                            <span className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-green-600 dark:text-green-400" />
                                <T>7-Day Agricultural Weather Forecast</T>
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3.5 sm:p-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                            {daily.slice(0, 7).map((d, idx) => {
                                const precipVal = d.precipitation_sum ?? d.precipitation ?? 0;
                                const maxT = d.temperature_2m_max ?? d.temperature_2m ?? 0;
                                const minT = d.temperature_2m_min ?? 0;
                                const smVal = d.soil_moisture_0_to_1cm ?? d.soil_moisture_0_to_7cm;

                                return (
                                    <div
                                        key={d.date}
                                        className={`p-2.5 rounded-xl border text-center transition-all ${
                                            idx === 0
                                                ? "border-green-500 bg-green-50/70 dark:bg-green-950/40 shadow-xs ring-1 ring-green-500/20"
                                                : "border-border bg-muted/20 hover:border-green-300 dark:hover:border-green-800"
                                        }`}
                                    >
                                        <div className="text-xs font-bold text-card-foreground">
                                            {getDayName(d.date, idx, (useLanguage as any)().locale)}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground">
                                            {d.date.slice(5)}
                                        </div>
                                        <div className="text-2xl my-1">
                                            {getWeatherIcon(precipVal, maxT)}
                                        </div>
                                        <div className="text-xs font-black text-foreground">
                                            {maxT ? `${Math.round(maxT)}°` : "--"}
                                            <span className="text-[10px] font-normal text-muted-foreground ml-1">
                                                {minT ? `${Math.round(minT)}°` : ""}
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium mt-1">
                                            💧 {precipVal} mm
                                        </div>
                                        {smVal != null && (
                                            <div className="text-[9px] text-emerald-700 dark:text-emerald-400 font-bold mt-0.5">
                                                🌱 SM: {(smVal * 100).toFixed(0)}%
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── 5. Optimized Compact Multi-Depth Soil Moisture ── */}
            {data && (
                <Card className="border-border bg-card shadow-xs">
                    <CardHeader className="p-3.5 sm:p-4 pb-2 border-b border-border">
                        <CardTitle className="text-xs sm:text-sm font-bold flex items-center justify-between text-card-foreground">
                            <span className="flex items-center gap-1.5">
                                <Layers className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                                <T>Soil Moisture by Root Depth Levels</T>
                            </span>
                            <span className="text-[11px] font-medium text-muted-foreground"><T>5 Depth Layers</T></span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3.5 sm:p-4 space-y-2.5">
                        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                            {soilMoistureLayers.map((layer) => {
                                const val = current[layer.key as keyof typeof current] ?? (layer.altKey ? current[layer.altKey as keyof typeof current] : undefined);
                                if (val == null || typeof val !== "number") return null;

                                const pct = Math.min((val / 0.50) * 100, 100);
                                const color = getMoistureColor(val);
                                const badge = getMoistureStatusBadge(val);

                                return (
                                    <div key={layer.key} className="p-2.5 rounded-lg border border-border bg-muted/20 flex flex-col justify-between space-y-1.5">
                                        <div>
                                            <div className="flex justify-between items-start">
                                                <p className="font-bold text-[11px] text-card-foreground leading-tight"><T>{layer.label}</T></p>
                                                <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${badge.bg}`}>
                                                    <T>{badge.label}</T>
                                                </span>
                                            </div>
                                            <p className="text-[9px] text-muted-foreground mt-0.5"><T>{layer.shortDesc}</T></p>
                                        </div>
                                        <div>
                                            <div className="flex justify-between items-baseline mb-1">
                                                <span className="text-[10px] text-muted-foreground font-semibold"><T>Moisture:</T></span>
                                                <span className="font-mono font-black text-xs" style={{ color }}>
                                                    {(val * 100).toFixed(1)}%
                                                </span>
                                            </div>
                                            <div className="w-full h-1.5 bg-muted/60 rounded-full overflow-hidden border border-border/50">
                                                <div
                                                    className="h-full rounded-full transition-all duration-500"
                                                    style={{
                                                        width: `${pct}%`,
                                                        backgroundColor: color
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="pt-1.5 border-t border-border flex flex-wrap items-center justify-between gap-1.5 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> &lt;10% <T>Dry</T></span>
                            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> 10–20% <T>Low</T></span>
                            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-500" /> 20–30% <T>Optimal</T></span>
                            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> &gt;30% <T>Moist</T></span>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
