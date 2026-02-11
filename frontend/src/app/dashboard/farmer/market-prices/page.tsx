"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, RefreshCcw } from 'lucide-react';
import api, { MarketPrice } from '@/lib/api';
import { Button } from '@/components/ui/button';

export default function MarketPricesPage() {
    const [prices, setPrices] = useState<MarketPrice[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchPrices = async () => {
        setLoading(true);
        try {
            const res = await api.get('/market/prices');
            setPrices(res.data);
        } catch (err) {
            console.error("Failed to fetch market prices", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPrices();
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Live Market Prices</h1>
                <Button onClick={fetchPrices} variant="outline">
                    <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {prices.map((crop, idx) => (
                    <Card key={idx} className="hover:shadow-lg transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xl font-bold">{crop.crop_name}</CardTitle>
                            <span className={`text-xs px-2 py-1 rounded-full font-bold ${crop.trend === 'up' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {crop.trend === 'up' ? '▲ Trending Up' : '▼ Trending Down'}
                            </span>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold mb-2">₹{crop.market_price.toLocaleString()}</div>
                            <div className="flex justify-between items-center text-sm text-gray-500 mb-4">
                                <span>Change: ₹{Math.abs(crop.change)}</span>
                                <span>Mandi: {crop.nearest_mandi}</span>
                            </div>

                            <div className="pt-4 border-t border-gray-100">
                                <div className="flex justify-between items-center bg-gray-50 p-2 rounded">
                                    <span className="text-sm font-medium">MSP (Govt)</span>
                                    <span className="font-bold">₹{crop.msp.toLocaleString()}</span>
                                </div>
                                <div className={`text-xs text-center mt-2 font-bold ${crop.msp_comparison === 'above' ? 'text-green-600' : 'text-red-500'}`}>
                                    {crop.msp_comparison === 'above' ? '✅ Selling above MSP' : '⚠️ Selling below MSP'}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
