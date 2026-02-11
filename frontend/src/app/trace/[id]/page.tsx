"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sprout, User, Calendar, MapPin, CheckCircle, Clock } from "lucide-react";

interface TraceEvent {
    id: number;
    action: string;
    details: string;
    timestamp: string;
    actor_id: number;
}

interface ProductDetails {
    name: string;
    category: string;
    description: string;
    batch_number: string;
    quantity: number;
}

interface FarmerDetails {
    name: string;
    is_verified: boolean;
}

export default function TraceabilityPage() {
    const params = useParams();
    const id = params?.id as string;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [data, setData] = useState<{
        product: ProductDetails;
        farmer: FarmerDetails;
        events: TraceEvent[];
    } | null>(null);

    useEffect(() => {
        if (id) {
            fetchTraceability();
        }
    }, [id]);

    const fetchTraceability = async () => {
        try {
            // Note: asking backend for public endpoint
            // We need to ensure api.get doesn't require auth for this specific endpoint 
            // or we use fetch directly if the interceptor enforces it.
            // Assuming the backend allows it.
            const response = await api.get(`/traceability/public/${id}`);
            setData(response.data);
        } catch (err) {
            console.error("Failed to fetch traceability:", err);
            setError("Product not found or invalid QR code.");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-green-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent"></div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
                <Card className="max-w-md w-full">
                    <CardContent className="p-8 text-center">
                        <div className="bg-red-100 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">⚠️</span>
                        </div>
                        <h1 className="text-xl font-bold text-gray-800 mb-2">Unavailable</h1>
                        <p className="text-gray-600">{error}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-green-50 to-white py-12 px-4 sm:px-6">
            <div className="max-w-3xl mx-auto space-y-8">
                {/* Header Section */}
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center p-3 bg-green-100 rounded-full mb-4">
                        <Sprout className="h-8 w-8 text-green-600" />
                    </div>
                    <h1 className="text-3xl font-bold text-green-900">{data.product.name}</h1>
                    <p className="text-green-700 font-medium">Verified Product Journey</p>
                </div>

                {/* Product & Farmer Card */}
                <Card className="border-green-100 shadow-lg overflow-hidden">
                    <div className="bg-green-600 p-4 text-white flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <span className="font-mono bg-white/20 px-2 py-1 rounded text-sm">
                                Batch: {data.product.batch_number}
                            </span>
                        </div>
                        <span className="text-sm bg-white/20 px-2 py-1 rounded capitalize">
                            {data.product.category}
                        </span>
                    </div>
                    <CardContent className="p-6 grid md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <User className="h-5 w-5 text-gray-400 mt-1" />
                                <div>
                                    <p className="text-sm text-gray-500">Grown by</p>
                                    <h3 className="font-bold text-lg flex items-center gap-2">
                                        {data.farmer.name}
                                        {data.farmer.is_verified && (
                                            <CheckCircle className="h-4 w-4 text-blue-500" />
                                        )}
                                    </h3>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <MapPin className="h-5 w-5 text-gray-400 mt-1" />
                                <div>
                                    <p className="text-sm text-gray-500">Origin</p>
                                    <p className="font-medium">Andhra Pradesh, India</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-xl">
                            <p className="text-sm text-gray-600 italic">"{data.product.description}"</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Timeline */}
                <div className="relative pl-8 border-l-2 border-green-200 space-y-8">
                    {data.events.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            No timeline events recorded yet.
                        </div>
                    ) : (
                        data.events.map((event, index) => (
                            <div key={event.id} className="relative">
                                {/* Dot */}
                                <div className="absolute -left-[41px] top-0 bg-green-500 h-5 w-5 rounded-full border-4 border-white shadow-sm"></div>

                                <Card className="border-gray-100 hover:shadow-md transition-shadow">
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-bold text-gray-800">{event.action}</h4>
                                            <span className="text-xs text-gray-400 flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {new Date(event.timestamp).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600">{event.details}</p>
                                    </CardContent>
                                </Card>
                            </div>
                        ))
                    )}
                </div>

                <div className="text-center pt-8">
                    <p className="text-xs text-gray-400">
                        Powered by <span className="font-bold text-green-600">AgriChain</span> Traceability Platform
                    </p>
                </div>
            </div>
        </div>
    );
}
