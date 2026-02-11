"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line } from 'recharts';

interface AnalyticsProps {
    yieldData: { name: string, yield: number }[];
    revenueData?: any[]; // For future use
}

export default function AnalyticsCharts({ yieldData }: AnalyticsProps) {
    if (!yieldData || yieldData.length === 0) {
        return (
            <Card className="h-full">
                <CardHeader>
                    <CardTitle>Crop Yield Analysis</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px] flex items-center justify-center text-gray-500">
                    No harvest data available.
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle>Crop Yield Analysis (Quintals)</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={yieldData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="yield" fill="#16a34a" name="Actual Yield" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
