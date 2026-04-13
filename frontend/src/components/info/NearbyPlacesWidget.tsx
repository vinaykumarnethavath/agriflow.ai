"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Navigation, Store, Landmark, Building2, Loader2, MapPinOff, RefreshCw } from 'lucide-react';
import { Button } from "@/components/ui/button";
import api, { NearbyPlace, GeocodedLocation } from '@/lib/api';

const TYPE_CONFIG: Record<string, { icon: string; label: string; gradient: string; border: string }> = {
    market: { icon: "🌾", label: "Mandi / Market", gradient: "from-amber-500/10 to-orange-500/10", border: "border-amber-200 dark:border-amber-800" },
    shop: { icon: "🏪", label: "Agri Shop", gradient: "from-green-500/10 to-emerald-500/10", border: "border-green-200 dark:border-green-800" },
    bank: { icon: "🏦", label: "Bank", gradient: "from-blue-500/10 to-indigo-500/10", border: "border-blue-200 dark:border-blue-800" },
    government: { icon: "🏛️", label: "Govt. Office", gradient: "from-purple-500/10 to-violet-500/10", border: "border-purple-200 dark:border-purple-800" },
};

function getDistanceColor(km: number) {
    if (km <= 2) return "text-green-600 bg-green-50 dark:bg-green-950/40 dark:text-green-400";
    if (km <= 10) return "text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400";
    if (km <= 30) return "text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400";
    return "text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-400";
}

export default function NearbyPlacesWidget() {
    const [places, setPlaces] = useState<NearbyPlace[]>([]);
    const [userLocation, setUserLocation] = useState<GeocodedLocation | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedType, setSelectedType] = useState<string>("all");
    const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);

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
                const loc = geoRes.data as GeocodedLocation;
                if (loc?.lat && loc?.lng) return loc;
            }
            return null;
        } catch (e) {
            return null;
        }
    };

    const fetchLocationData = async (lat: number, lon: number) => {
        setLoading(true);
        setError(null);
        try {
            const reverseRes = await api.get('/location/reverse', { params: { lat, lon } });
            const loc = reverseRes.data as GeocodedLocation;
            setUserLocation(loc);

            const locality = [
                loc?.components?.village,
                loc?.components?.district,
                loc?.components?.state,
            ].filter(Boolean).join(', ');

            const nearbyRes = await api.get('/location/nearby', {
                params: { lat, lon, types: 'market,shop,bank,government', radius_km: 50, locality },
            });
            setPlaces(nearbyRes.data);
        } catch (err) {
            console.error("Failed to fetch location data", err);
            setError("Failed to load nearby places. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const requestLocation = () => {
        setLoading(true);
        setError(null);
        if (!navigator.geolocation) {
            setError("Geolocation is not supported by your browser.");
            setLoading(false);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setCoords({ lat: latitude, lon: longitude });
                fetchLocationData(latitude, longitude);
            },
            async (err) => {
                console.error("Geolocation error:", err);

                const fallback = await resolveFallbackLocationFromProfile();
                if (fallback?.lat && fallback?.lng) {
                    setCoords({ lat: fallback.lat, lon: fallback.lng });
                    fetchLocationData(fallback.lat, fallback.lng);
                    return;
                }

                setError("Unable to detect your location. Please allow location access, or ensure your profile address is saved correctly.");
                setLoading(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    };

    useEffect(() => {
        requestLocation();
    }, []);

    const filteredPlaces = selectedType === "all"
        ? places
        : places.filter(p => p.type === selectedType);

    // Loading state
    if (loading) {
        return (
            <Card className="bg-card border text-card-foreground shadow-sm">
                <CardContent className="p-8 flex flex-col items-center justify-center gap-3">
                    <div className="relative">
                        <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping" />
                        <div className="relative bg-gradient-to-br from-green-500 to-emerald-600 p-3 rounded-full">
                            <Loader2 className="h-6 w-6 text-white animate-spin" />
                        </div>
                    </div>
                    <p className="text-sm font-medium text-muted-foreground animate-pulse">Detecting your location...</p>
                </CardContent>
            </Card>
        );
    }

    // Error state
    if (error && places.length === 0) {
        return (
            <Card className="bg-card border text-card-foreground shadow-sm">
                <CardContent className="p-8 flex flex-col items-center justify-center gap-3 text-center">
                    <div className="bg-red-100 dark:bg-red-950/40 p-3 rounded-full">
                        <MapPinOff className="h-6 w-6 text-red-500" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">{error}</p>
                    <Button size="sm" variant="outline" onClick={requestLocation} className="mt-2">
                        <RefreshCw className="h-3 w-3 mr-1" /> Retry
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-card border text-card-foreground shadow-sm overflow-hidden">
            {/* Header with detected location */}
            <CardHeader className="pb-3 border-b bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-1.5 rounded-lg">
                            <MapPin className="h-4 w-4 text-white" />
                        </div>
                        Nearby Places
                    </CardTitle>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={requestLocation}
                        className="text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900/30"
                    >
                        <RefreshCw className="h-3 w-3 mr-1" /> Refresh
                    </Button>
                </div>
                {userLocation && (
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Navigation className="h-3 w-3 text-green-600" />
                        <span className="font-medium text-foreground">{userLocation.formatted_address}</span>
                    </div>
                )}
            </CardHeader>

            <CardContent className="p-4 space-y-4">
                {/* Type Filter Pills */}
                <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                    <button
                        onClick={() => setSelectedType("all")}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                            selectedType === "all"
                                ? "bg-green-600 text-white border-green-600 shadow-md shadow-green-200 dark:shadow-green-900"
                                : "bg-muted text-muted-foreground border-border hover:bg-accent"
                        }`}
                    >
                        All ({places.length})
                    </button>
                    {Object.entries(TYPE_CONFIG).map(([type, config]) => {
                        const count = places.filter(p => p.type === type).length;
                        if (count === 0) return null;
                        return (
                            <button
                                key={type}
                                onClick={() => setSelectedType(type)}
                                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                                    selectedType === type
                                        ? "bg-green-600 text-white border-green-600 shadow-md shadow-green-200 dark:shadow-green-900"
                                        : "bg-muted text-muted-foreground border-border hover:bg-accent"
                                }`}
                            >
                                {config.icon} {config.label} ({count})
                            </button>
                        );
                    })}
                </div>

                {/* Places Grid */}
                {filteredPlaces.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <Store className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">No places found for this category.</p>
                    </div>
                ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                        {filteredPlaces.map((place, idx) => {
                            const config = TYPE_CONFIG[place.type] || TYPE_CONFIG.shop;
                            return (
                                <div
                                    key={idx}
                                    className={`group relative p-3 rounded-xl border bg-gradient-to-r ${config.gradient} ${config.border} hover:shadow-md transition-all duration-200 cursor-pointer`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="text-2xl flex-shrink-0 mt-0.5">{config.icon}</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <h4 className="font-bold text-sm text-foreground group-hover:text-green-700 dark:group-hover:text-green-400 transition-colors truncate">
                                                        {place.name}
                                                    </h4>
                                                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                                        {place.address}
                                                    </p>
                                                </div>
                                                <span className={`flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${getDistanceColor(place.distance_km)}`}>
                                                    {place.distance_km < 1
                                                        ? `${Math.round(place.distance_km * 1000)}m`
                                                        : `${place.distance_km} km`
                                                    }
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Footer Tip */}
                <div className="pt-2 border-t border-border">
                    <p className="text-[10px] text-muted-foreground text-center">
                        📍 Showing places within 50 km • Distances are approximate
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
