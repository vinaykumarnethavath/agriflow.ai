"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import api, { MarketPrice } from '@/lib/api';

export default function MarketPriceWidget({ filterCrops }: { filterCrops?: string[] }) {
    const [prices, setPrices] = useState<MarketPrice[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPrices = async () => {
            try {
                const res = await api.get('/market/prices');
                let data = res.data;

                if (filterCrops && filterCrops.length > 0) {
                    // Filter prices that match any of the user's crops (case-insensitive partial match)
                    data = data.filter((price: MarketPrice) =>
                        filterCrops.some(userCrop =>
                            price.crop_name.toLowerCase().includes(userCrop.toLowerCase()) ||
                            userCrop.toLowerCase().includes(price.crop_name.toLowerCase())
                        )
                    );
                } else if (filterCrops) {
                    // filterCrops provided but empty array -> user has no crops
                    // Maybe show top 4 generic ones, OR show "No active crops to track"
                    // User asked to "show market value of the crops which are growing"
                    // If no crops growing, maybe empty state?
                    // Let's stick to showing generic top 4 if no matches found, or we can return empty.
                    // But if filterCrops IS passed, we strictly filter.
                    data = [];
                } else {
                    // No filter provided, show top 4 default
                    data = data.slice(0, 4);
                }

                setPrices(data);
            } catch (err) {
                console.error("Failed to fetch market prices", err);
            } finally {
                setLoading(false);
            }
        };
        fetchPrices();
    }, [filterCrops]);

    if (loading) return <div className="h-64 animate-pulse bg-gray-100 rounded-xl"></div>;

    if (filterCrops && prices.length === 0) {
        return (
            <Card className="bg-white border text-card-foreground shadow-sm h-full flex flex-col justify-center items-center p-6 text-center">
                <div className="bg-gray-100 p-3 rounded-full mb-3">
                    <TrendingUp className="h-6 w-6 text-gray-400" />
                </div>
                <h3 className="font-medium text-gray-900">No Active Market Data</h3>
                <p className="text-sm text-gray-500 mt-1">Start growing crops to see their market rates here.</p>
            </Card>
        );
    }

    return (
        <Card className="bg-white border text-card-foreground shadow-sm h-full">
            <CardHeader className="pb-3 border-b bg-gray-50/50">
                <CardTitle className="text-lg font-bold flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                        {filterCrops ? 'My Crop Prices' : 'Market Rates'}
                    </span>
                    <span className="text-xs font-normal text-muted-foreground bg-gray-200 px-2 py-1 rounded-full">
                        Live (₹/Qtl)
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y divide-gray-100">
                    {prices.map((crop, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <h4 className="font-bold text-gray-900">{crop.crop_name}</h4>
                                    {crop.msp_comparison === 'above' && (
                                        <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded border border-green-200">
                                            High Demand
                                        </span>
                                    )}
                                </div>
                                <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                    📍 {crop.nearest_mandi}
                                </div>
                            </div>

                            <div className="text-right">
                                <div className="text-lg font-bold text-gray-900">₹{crop.market_price.toLocaleString()}</div>
                                <div className={`text-xs font-bold flex items-center justify-end gap-1 ${crop.trend === 'up' ? 'text-green-600' : 'text-red-500'
                                    }`}>
                                    {crop.trend === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                    ₹{Math.abs(crop.change)}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {!filterCrops && (
                    <div className="p-3 bg-blue-50/50 text-center border-t border-blue-100">
                        <p className="text-xs text-blue-600 font-medium">
                            💡 Tip: Prices are volatile. Check MSP before selling.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
