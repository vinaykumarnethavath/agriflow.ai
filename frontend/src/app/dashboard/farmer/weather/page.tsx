"use client";

import React from 'react';
import WeatherBoard from '@/components/info/WeatherBoard';

export default function WeatherPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Weather Forecast & Advisory</h1>
            <WeatherBoard />
        </div>
    );
}
