"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cloud, CloudRain, Sun, Zap, Wind, Droplets, AlertTriangle, Thermometer } from 'lucide-react';
import api, { WeatherData } from '@/lib/api';

export default function WeatherBoard() {
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const resolveFallbackLocationFromProfile = async () => {
            try {
                const profileRes = await api.get('/farmer/profile');
                const p = profileRes.data || {};

                const qPrimary = [
                    p.village,
                    p.mandal,
                    p.district,
                    p.state,
                    'India',
                ].filter(Boolean).join(', ');

                const qWithPin = [
                    p.village,
                    p.mandal,
                    p.district,
                    p.state,
                    p.pincode,
                    'India',
                ].filter(Boolean).join(', ');

                const queries = [qPrimary, qWithPin].filter(q => q && q.trim().length > 0);
                for (const q of queries) {
                    const geoRes = await api.get('/location/geocode', { params: { q } });
                    const loc = geoRes.data as any;
                    if (loc?.lat && loc?.lng) return { lat: loc.lat as number, lon: loc.lng as number };
                }
                return null;
            } catch (e) {
                return null;
            }
        };

        const fetchWeatherForCoords = async (lat: number, lon: number) => {
            const res = await api.get('/weather/', { params: { lat, lon } });
            setWeather(res.data);
        };

        const fetchWeather = async () => {
            try {
                if (!navigator.geolocation) {
                    const fallback = await resolveFallbackLocationFromProfile();
                    if (fallback) {
                        await fetchWeatherForCoords(fallback.lat, fallback.lon);
                    } else {
                        const res = await api.get('/weather/');
                        setWeather(res.data);
                    }
                    return;
                }

                await new Promise<void>((resolve) => {
                    navigator.geolocation.getCurrentPosition(
                        async (position) => {
                            try {
                                await fetchWeatherForCoords(position.coords.latitude, position.coords.longitude);
                            } catch (e) {
                                console.error("Failed to fetch weather", e);
                            }
                            resolve();
                        },
                        async (err) => {
                            console.error("Geolocation error:", err);
                            const fallback = await resolveFallbackLocationFromProfile();
                            if (fallback) {
                                await fetchWeatherForCoords(fallback.lat, fallback.lon);
                            } else {
                                const res = await api.get('/weather/');
                                setWeather(res.data);
                            }
                            resolve();
                        },
                        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
                    );
                });
            } catch (err) {
                console.error("Failed to fetch weather", err);
            } finally {
                setLoading(false);
            }
        };

        fetchWeather();
    }, []);

    const getWeatherIcon = (condition: string) => {
        switch (condition?.toLowerCase()) {
            case 'sunny': return <Sun className="h-8 w-8 text-yellow-500" />;
            case 'cloudy': return <Cloud className="h-8 w-8 text-gray-400" />;
            case 'rainy': return <CloudRain className="h-8 w-8 text-blue-500" />;
            case 'stormy': return <Zap className="h-8 w-8 text-purple-500" />;
            case 'partly cloudy': return <Cloud className="h-8 w-8 text-yellow-300" />;
            default: return <Sun className="h-8 w-8 text-yellow-500" />;
        }
    };

    if (loading) return <div className="h-64 animate-pulse bg-gray-100/50 rounded-xl border border-gray-200"></div>;
    if (!weather) return null;

    return (
        <Card className="bg-gradient-to-br from-blue-500 to-blue-700 text-white border-none shadow-xl overflow-hidden">
            <CardContent className="p-0">
                {/* Header Section */}
                <div className="p-6 pb-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold flex items-center gap-2">
                                <span className="opacity-90">{weather.location}</span>
                            </h2>
                            <p className="text-blue-100 text-sm">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                        </div>
                        <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                            {getWeatherIcon(weather.condition)}
                        </div>
                    </div>

                    <div className="mt-6 flex items-end gap-4">
                        <div className="text-6xl font-bold">{Math.round(weather.temperature)}°</div>
                        <div className="mb-2">
                            <p className="font-medium text-lg">{weather.condition}</p>
                            <p className="text-blue-100 text-sm flex items-center gap-1">
                                <Droplets className="h-3 w-3" /> {weather.humidity}% Humidity
                                <span className="mx-1">•</span>
                                <Wind className="h-3 w-3" /> {weather.wind_speed} km/h
                            </p>
                        </div>
                    </div>

                    {/* Alerts Section */}
                    {weather.alerts && weather.alerts.length > 0 && (
                        <div className="mt-6 space-y-2">
                            {weather.alerts.map((alert, idx) => (
                                <div key={idx} className={`flex items-start gap-3 p-3 rounded-lg backdrop-blur-md ${alert.type === 'warning' ? 'bg-red-500/30 border border-red-500/50' : 'bg-orange-500/30 border border-orange-500/50'}`}>
                                    <AlertTriangle className={`h-5 w-5 shrink-0 ${alert.type === 'warning' ? 'text-red-200' : 'text-orange-200'}`} />
                                    <div>
                                        <p className="font-bold text-sm text-white">{alert.title}</p>
                                        <p className="text-xs text-white/90">{alert.message}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Forecast & Advice Section */}
                <div className="bg-white/10 backdrop-blur-sm p-4 border-t border-white/10">
                    <div className="grid grid-cols-4 gap-2 text-center mb-4">
                        {weather.forecast.slice(0, 4).map((day, idx) => (
                            <div key={idx} className="bg-white/5 rounded-lg p-2">
                                <p className="text-xs text-blue-100 mb-1">{day.day}</p>
                                <div className="flex justify-center my-1 scale-75">
                                    {getWeatherIcon(day.condition)}
                                </div>
                                <p className="font-bold text-sm">{Math.round(day.temp)}°</p>
                            </div>
                        ))}
                    </div>

                    {weather.advice && weather.advice.length > 0 && (
                        <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-3">
                            <p className="text-xs font-bold text-green-100 uppercase mb-1 flex items-center gap-1">
                                <SproutIcon className="h-3 w-3" />
                                Farming Advice
                            </p>
                            <p className="text-sm font-medium text-white">
                                "{weather.advice[0]}"
                            </p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function SproutIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M7 20h10" />
            <path d="M10 20c5.5-2.5.8-6.4 3-10" />
            <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .5-3.5 1.3-3.5 1.3s-.9-2.4 0-4.6" />
            <path d="M16.5 6.6c-1.5-.7-3.7-.5-5 0 .5 2 2.3 3.6 4.3 4.2 0 0-.6-2.5.7-4.2" />
        </svg>
    )
}
