"use client";

import React from 'react';
import WeatherBoard from '@/components/info/WeatherBoard';

export default function WeatherPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Weather Forecast & Advisory</h1>
            <WeatherBoard />
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                ⚠️ Weather data is currently simulated for demonstration.
            </div>
        </div>
    );
}
