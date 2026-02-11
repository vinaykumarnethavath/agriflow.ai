"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Newspaper, ShieldCheck, AlertCircle, Sprout, TrendingUp } from 'lucide-react';
import api, { NewsItem } from '@/lib/api';
import { Badge } from "@/components/ui/badge";

interface NewsWidgetProps {
    filterCategory?: string;
    limit?: number;
}

export default function NewsWidget({ filterCategory, limit }: NewsWidgetProps) {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchNews = async () => {
            try {
                const res = await api.get('/news/');
                let data = res.data;

                if (filterCategory) {
                    data = data.filter((item: NewsItem) => item.category === filterCategory);
                }

                // Sort by date descending (assuming date string is YYYY-MM-DD or similar sortable format)
                data.sort((a: NewsItem, b: NewsItem) => new Date(b.date).getTime() - new Date(a.date).getTime());

                if (limit) {
                    data = data.slice(0, limit);
                }

                setNews(data);
            } catch (err) {
                console.error("Failed to fetch news", err);
            } finally {
                setLoading(false);
            }
        };
        fetchNews();
    }, [filterCategory, limit]);

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'scheme': return <ShieldCheck className="h-4 w-4 text-purple-600" />;
            case 'alert': return <AlertCircle className="h-4 w-4 text-red-600" />;
            case 'market': return <TrendingUp className="h-4 w-4 text-blue-600" />;
            case 'tip': return <Sprout className="h-4 w-4 text-green-600" />;
            default: return <Newspaper className="h-4 w-4 text-gray-600" />;
        }
    };

    const getCategoryBadge = (category: string) => {
        switch (category) {
            case 'scheme': return "bg-purple-100 text-purple-800 border-purple-200";
            case 'alert': return "bg-red-100 text-red-800 border-red-200";
            case 'market': return "bg-blue-100 text-blue-800 border-blue-200";
            case 'tip': return "bg-green-100 text-green-800 border-green-200";
            default: return "bg-gray-100 text-gray-800";
        }
    };

    if (loading) return <div className="h-64 animate-pulse bg-gray-100 rounded-xl"></div>;

    if (news.length === 0) {
        return (
            <Card className="bg-white border text-card-foreground shadow-sm h-full flex items-center justify-center p-6 text-center">
                <p className="text-gray-500">No recent updates.</p>
            </Card>
        )
    }

    return (
        <Card className="bg-white border text-card-foreground shadow-sm h-full flex flex-col">
            <CardHeader className="pb-3 border-b bg-gray-50/50">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Newspaper className="h-5 w-5 text-gray-700" />
                    {filterCategory === 'scheme' ? 'Latest Government Schemes' : 'Farmer News & Schemes'}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto max-h-[400px]">
                <div className="divide-y divide-gray-100">
                    {news.map((item) => (
                        <div key={item.id} className="p-4 hover:bg-gray-50 transition-colors group cursor-pointer">
                            <div className="flex items-start justify-between mb-2">
                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${getCategoryBadge(item.category)}`}>
                                    {getCategoryIcon(item.category)}
                                    {item.category}
                                </span>
                                <span className="text-[10px] text-gray-400">{item.date}</span>
                            </div>

                            <h4 className="font-bold text-gray-900 group-hover:text-green-700 transition-colors mb-1 line-clamp-2">
                                {item.title}
                            </h4>

                            <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                                {item.summary}
                            </p>

                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                    Source: {item.source}
                                </span>
                                {item.verified && (
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                        <ShieldCheck className="h-3 w-3" /> Verified
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
