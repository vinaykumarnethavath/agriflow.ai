"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Newspaper, ShieldCheck, AlertCircle, Sprout, TrendingUp, ExternalLink, Clock } from 'lucide-react';
import api, { NewsItem } from '@/lib/api';

interface NewsWidgetProps {
    filterCategory?: string;
    limit?: number;
}

function getRelativeTime(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 14) return "1 week ago";
    return `${Math.floor(diffDays / 7)} weeks ago`;
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

                // Sort by date descending
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
            case 'scheme': return <ShieldCheck className="h-3.5 w-3.5 text-purple-600" />;
            case 'alert': return <AlertCircle className="h-3.5 w-3.5 text-red-600" />;
            case 'market': return <TrendingUp className="h-3.5 w-3.5 text-blue-600" />;
            case 'tip': return <Sprout className="h-3.5 w-3.5 text-green-600" />;
            default: return <Newspaper className="h-3.5 w-3.5 text-gray-600" />;
        }
    };

    const getCategoryStyle = (category: string) => {
        switch (category) {
            case 'scheme': return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800";
            case 'alert': return "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800";
            case 'market': return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800";
            case 'tip': return "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800";
            default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
        }
    };

    // Loading skeleton
    if (loading) {
        return (
            <Card className="bg-card border text-card-foreground shadow-sm">
                <CardHeader className="pb-3 border-b bg-muted/50">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <Newspaper className="h-5 w-5 text-foreground" />
                        Agricultural News
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="p-4 border-b border-border animate-pulse">
                            <div className="flex gap-3">
                                <div className="flex-1 space-y-2">
                                    <div className="h-3 bg-muted rounded w-16" />
                                    <div className="h-4 bg-muted rounded w-3/4" />
                                    <div className="h-3 bg-muted rounded w-full" />
                                    <div className="h-3 bg-muted rounded w-2/3" />
                                </div>
                                <div className="w-20 h-16 bg-muted rounded-lg flex-shrink-0" />
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        );
    }

    if (news.length === 0) {
        return (
            <Card className="bg-card border text-card-foreground shadow-sm h-full flex items-center justify-center p-6 text-center">
                <div>
                    <Newspaper className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-40" />
                    <p className="text-muted-foreground text-sm">No recent agricultural news.</p>
                </div>
            </Card>
        )
    }

    return (
        <Card className="bg-card border text-card-foreground shadow-sm h-full flex flex-col">
            <CardHeader className="pb-3 border-b bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20">
                <CardTitle className="text-lg font-bold flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <div className="bg-gradient-to-br from-orange-500 to-red-500 p-1.5 rounded-lg">
                            <Newspaper className="h-4 w-4 text-white" />
                        </div>
                        {filterCategory === 'scheme' ? 'Govt. Schemes' : 'Agricultural News'}
                    </span>
                    <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" /> Last 15 days
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto max-h-[500px]">
                <div className="divide-y divide-border">
                    {news.map((item) => (
                        <div
                            key={item.id}
                            className="p-4 hover:bg-muted/50 transition-colors group"
                        >
                            <div className="flex gap-3">
                                {/* Text content */}
                                <div className="flex-1 min-w-0">
                                    {/* Category + Time */}
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${getCategoryStyle(item.category)}`}>
                                            {getCategoryIcon(item.category)}
                                            {item.category}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                            <Clock className="h-2.5 w-2.5" />
                                            {getRelativeTime(item.date)}
                                        </span>
                                    </div>

                                    {/* Title */}
                                    <h4 className="font-bold text-sm text-foreground group-hover:text-green-700 dark:group-hover:text-green-400 transition-colors mb-1 line-clamp-2">
                                        {item.title}
                                    </h4>

                                    {/* Summary */}
                                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                                        {item.summary}
                                    </p>

                                    {/* Footer: Source + Link */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                            {item.source}
                                        </span>
                                        {item.verified && (
                                            <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-800">
                                                <ShieldCheck className="h-2.5 w-2.5" /> Verified
                                            </span>
                                        )}
                                        {item.url && (
                                            <a
                                                href={item.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1 text-[10px] font-bold text-green-600 hover:text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40 px-1.5 py-0.5 rounded border border-green-100 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <ExternalLink className="h-2.5 w-2.5" /> Read More
                                            </a>
                                        )}
                                    </div>
                                </div>

                                {/* Thumbnail Image */}
                                {item.image_url && (
                                    <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-border">
                                        <img
                                            src={item.image_url}
                                            alt=""
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
