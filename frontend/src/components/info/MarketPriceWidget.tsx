"use client";

import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, ChevronLeft, ChevronRight } from 'lucide-react';
import api, { MarketPrice } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import { T } from '@/components/TranslateText';

export default function MarketPriceWidget({ filterCrops }: { filterCrops?: string[] }) {
    const [prices, setPrices] = useState<MarketPrice[]>([]);
    const [loading, setLoading] = useState(true);
    const scrollRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
    const { t } = useLanguage();

    useEffect(() => {
        const fetchPrices = async () => {
            try {
                const res = await api.get('/market/prices');
                let data = res.data;

                if (filterCrops && filterCrops.length > 0) {
                    const validUserCrops = filterCrops.filter(c => c && c.trim().length > 0);
                    if (validUserCrops.length > 0) {
                        data = data.filter((price: MarketPrice) =>
                            validUserCrops.some(userCrop => {
                                const pName = price.crop_name.toLowerCase();
                                const uName = userCrop.toLowerCase().trim();
                                // Stricter matching: exact match, or one contains the other as a distinct word
                                if (pName === uName) return true;
                                const pWords = pName.split(/[\s-]+/);
                                const uWords = uName.split(/[\s-]+/);
                                return pWords.some(w => uWords.includes(w)) || uName.includes(pName);
                            })
                        );
                    } else {
                        data = [];
                    }
                } else if (filterCrops) {
                    data = [];
                } else {
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

    const scrollMarkets = (cropName: string, direction: 'left' | 'right') => {
        const ref = scrollRefs.current[cropName];
        if (ref) {
            const scrollAmount = 200;
            ref.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
        }
    };

    if (loading) return <div className="h-64 animate-pulse bg-gray-100 rounded-xl"></div>;

    if (filterCrops && prices.length === 0) {
        return (
            <Card className="bg-card border text-card-foreground shadow-sm h-full flex flex-col justify-center items-center p-6 text-center">
                <div className="bg-muted p-3 rounded-full mb-3">
                    <TrendingUp className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-medium text-foreground">{t('marketPrices.noData')}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t('crops.addFirstCropDesc')}</p>
            </Card>
        );
    }

    return (
        <Card className="bg-card border text-card-foreground shadow-sm h-full">
            <CardHeader className="pb-3 border-b bg-muted/50">
                <CardTitle className="text-lg font-bold flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                        {filterCrops ? t('farmer.myCrops') : t('marketPrices.title')}
                    </span>
                    <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-1 rounded-full">
                        {t('marketPrices.perQuintal')}
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y divide-border">
                    {prices.map((crop, idx) => (
                        <div key={idx} className="p-4 hover:bg-muted/50 transition-colors">
                            {/* Crop Header */}
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <h4 className="font-bold text-foreground"><T>{crop.crop_name}</T></h4>
                                    {crop.msp_comparison === 'above' && (
                                        <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded border border-green-200">
                                            {t('marketPrices.priceUp')}
                                        </span>
                                    )}
                                    {crop.msp_comparison === 'below' && (
                                        <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded border border-red-200">
                                            {t('marketPrices.priceDown')}
                                        </span>
                                    )}
                                </div>
                                <div className="text-right">
                                    <div className="text-lg font-bold text-foreground">₹{crop.market_price.toLocaleString()}</div>
                                    <div className={`text-xs font-bold flex items-center justify-end gap-1 ${crop.trend === 'up' ? 'text-green-600' : 'text-red-500'}`}>
                                        {crop.trend === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                        ₹{Math.abs(crop.change)}
                                    </div>
                                </div>
                            </div>

                            {/* Scrollable Nearby Markets */}
                            {crop.markets && crop.markets.length > 0 && (
                                <div className="relative">
                                    <button
                                        onClick={() => scrollMarkets(crop.crop_name, 'left')}
                                        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-background/90 shadow-md rounded-full p-1 border border-border hover:bg-accent -ml-1"
                                    >
                                        <ChevronLeft className="h-3 w-3 text-foreground" />
                                    </button>
                                    <div
                                        ref={el => { scrollRefs.current[crop.crop_name] = el; }}
                                        className="flex gap-2 overflow-x-auto scrollbar-hide px-4 py-1"
                                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                                    >
                                        {crop.markets.map((market: any, mIdx: number) => (
                                            <div
                                                key={mIdx}
                                                className="flex-shrink-0 bg-muted/50 border border-border rounded-lg px-3 py-2 min-w-[140px] hover:border-green-200 transition-colors"
                                            >
                                                <p className="text-xs font-bold text-muted-foreground truncate"><T>{market.market_name}</T></p>
                                                <p className="text-sm font-bold text-foreground mt-0.5">₹{market.price.toLocaleString()}</p>
                                                <div className="flex items-center justify-between mt-1">
                                                    <span className="text-[10px] text-muted-foreground">{market.distance_km} km</span>
                                                    <span className={`text-[10px] font-bold flex items-center gap-0.5 ${market.trend === 'up' ? 'text-green-600' : 'text-red-500'}`}>
                                                        {market.trend === 'up' ? '↑' : '↓'}₹{Math.abs(market.change)}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => scrollMarkets(crop.crop_name, 'right')}
                                        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-background/90 shadow-md rounded-full p-1 border border-border hover:bg-accent -mr-1"
                                    >
                                        <ChevronRight className="h-3 w-3 text-foreground" />
                                    </button>
                                </div>
                            )}

                            {/* MSP Info */}
                            {crop.msp > 0 && (
                                <div className="mt-2 text-[10px] text-muted-foreground">
                                    MSP: ₹{crop.msp.toLocaleString()}/Qtl
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {!filterCrops && (
                    <div className="p-3 bg-blue-50/50 text-center border-t border-blue-100">
                        <p className="text-xs text-blue-600 font-medium">
                            💡 <T>Tip: Prices are volatile. Check MSP before selling.</T>
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
