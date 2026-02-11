"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Calendar, Share2, ExternalLink } from 'lucide-react';
import api, { NewsItem } from '@/lib/api';
import { Button } from '@/components/ui/button';

export default function NewsPage() {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchNews = async () => {
            try {
                const res = await api.get('/news/');
                setNews(res.data);
            } catch (err) {
                console.error("Failed to fetch news", err);
            } finally {
                setLoading(false);
            }
        };
        fetchNews();
    }, []);

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Farmer News & Government Schemes</h1>

            {news.map((item) => (
                <Card key={item.id} className="overflow-hidden hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row justify-between gap-4">
                            <div className="flex-1 space-y-3">
                                <div className="flex items-center gap-3">
                                    <Badge variant={
                                        item.category === 'scheme' ? 'default' :
                                            item.category === 'alert' ? 'destructive' : 'secondary'
                                    } className="uppercase tracking-wider text-[10px]">
                                        {item.category}
                                    </Badge>
                                    <span className="text-xs text-gray-500 flex items-center gap-1">
                                        <Calendar className="h-3 w-3" /> {item.date}
                                    </span>
                                </div>

                                <h3 className="text-xl font-bold text-gray-900 leading-tight">
                                    {item.title}
                                </h3>
                                <p className="text-gray-600 leading-relaxed">
                                    {item.summary}
                                </p>

                                <div className="flex items-center gap-4 pt-2">
                                    <div className="flex items-center gap-2 text-sm font-medium text-gray-900 bg-gray-100 px-3 py-1 rounded-full">
                                        Source: {item.source}
                                        {item.verified && <ShieldCheck className="h-4 w-4 text-blue-600" />}
                                    </div>
                                </div>
                            </div>

                            <div className="flex md:flex-col gap-2 justify-center border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-4">
                                <Button variant="outline" size="sm" className="w-full">
                                    <Share2 className="h-4 w-4 mr-2" /> Share
                                </Button>
                                <Button size="sm" className="w-full">
                                    Read More <ExternalLink className="h-4 w-4 ml-2" />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
