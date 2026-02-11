"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getProductDetails, Product, addToCart } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Truck, MapPin, User, CheckCircle, Calendar } from "lucide-react";

export default function ProductDetailsPage() {
    const params = useParams();
    const id = parseInt(params.id as string);
    const [product, setProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);
    const [qty, setQty] = useState(1);

    useEffect(() => {
        if (id) fetchProduct();
    }, [id]);

    const fetchProduct = async () => {
        try {
            const data = await getProductDetails(id);
            setProduct(data);
        } catch (error) {
            console.error("Failed to fetch product details:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddToCart = async () => {
        if (!product) return;
        try {
            await addToCart(product.id, qty);
            alert("Added to cart!");
        } catch (error) {
            console.error("Failed to add to cart:", error);
        }
    };

    if (loading) return <div className="p-8 text-center">Loading product details...</div>;
    if (!product) return <div className="p-8 text-center text-red-500">Product not found.</div>;

    // Parse Traceability JSON (safely)
    let traceability: any = {};
    try {
        traceability = product.traceability_json ? JSON.parse(product.traceability_json) : {};
    } catch (e) {
        console.warn("Invalid traceability JSON");
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: Product Info */}
            <div className="space-y-6">
                <div className="bg-gray-100 rounded-lg h-96 flex items-center justify-center text-6xl">
                    {product.category === 'crop' ? '🌾' : product.category === 'processed' ? '🥡' : '📦'}
                </div>
                <div>
                    <div className="flex justify-between items-start">
                        <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
                        <Badge className="text-sm px-3 py-1 capitalize">{product.category}</Badge>
                    </div>
                    <p className="text-gray-500 mt-2">{product.brand || 'Unknown Brand'}</p>

                    <div className="flex items-baseline gap-2 mt-4">
                        <span className="text-4xl font-bold text-green-700">₹{product.price}</span>
                        <span className="text-lg text-gray-500">per {product.unit}</span>
                    </div>

                    <p className="mt-4 text-gray-600 leading-relaxed">{product.description}</p>

                    <div className="flex items-center gap-4 mt-8">
                        <div className="flex items-center border rounded-md">
                            <button className="px-3 py-2 bg-gray-50 hover:bg-gray-100" onClick={() => setQty(Math.max(1, qty - 1))}>-</button>
                            <span className="px-4 py-2 font-medium">{qty}</span>
                            <button className="px-3 py-2 bg-gray-50 hover:bg-gray-100" onClick={() => setQty(qty + 1)}>+</button>
                        </div>
                        <Button size="lg" className="flex-1 bg-green-600 hover:bg-green-700" onClick={handleAddToCart}>
                            <ShoppingCart className="w-5 h-5 mr-2" /> Add to Cart
                        </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Available Stock: {product.quantity} {product.unit}</p>
                </div>
            </div>

            {/* Right: Traceability & Details */}
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Truck className="w-5 h-5 text-blue-600" /> Journey Traceability
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">

                        {/* Timeline Item 1: Origin */}
                        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-300 group-[.is-active]:bg-green-500 text-slate-500 group-[.is-active]:text-green-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                                <MapPin className="w-5 h-5" />
                            </div>
                            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded border border-slate-200 shadow">
                                <div className="flex items-center justify-between space-x-2 mb-1">
                                    <div className="font-bold text-slate-900">Origin / Farm</div>
                                </div>
                                <div className="text-slate-500 text-sm">
                                    <div className="flex items-center gap-1"><User className="w-3 h-3" /> {traceability.farmer_name || product.brand || 'Local Farm'}</div>
                                    <div className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {traceability.location || 'Maharashtra, India'}</div>
                                </div>
                            </div>
                        </div>

                        {/* Timeline Item 2: Processing (if manufactured) */}
                        {product.category === 'processed' && (
                            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-300 group-[.is-active]:bg-blue-500 text-slate-500 group-[.is-active]:text-blue-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                                    <CheckCircle className="w-5 h-5" />
                                </div>
                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded border border-slate-200 shadow">
                                    <div className="flex items-center justify-between space-x-2 mb-1">
                                        <div className="font-bold text-slate-900">Processing</div>
                                        <time className="font-caveat font-medium text-indigo-500 text-xs">Batch: {product.batch_number}</time>
                                    </div>
                                    <div className="text-slate-500 text-sm">
                                        Processed at certified facility. Quality Checked.
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Timeline Item 3: Marketplace */}
                        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-300 group-[.is-active]:bg-purple-500 text-slate-500 group-[.is-active]:text-purple-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                                <ShoppingCart className="w-5 h-5" />
                            </div>
                            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded border border-slate-200 shadow">
                                <div className="flex items-center justify-between space-x-2 mb-1">
                                    <div className="font-bold text-slate-900">Ready for Sale</div>
                                    <time className="font-caveat font-medium text-indigo-500 text-xs">{new Date().toLocaleDateString()}</time>
                                </div>
                                <div className="text-slate-500 text-sm">
                                    Available on AgriChain Marketplace.
                                </div>
                            </div>
                        </div>

                    </CardContent>
                </Card>

                {/* Additional Specs */}
                <Card>
                    <CardHeader><CardTitle>Product Specifications</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-gray-500 block">Unit</span>
                            <span className="font-medium">{product.unit}</span>
                        </div>
                        <div>
                            <span className="text-gray-500 block">Batch ID</span>
                            <span className="font-mono">{product.batch_number}</span>
                        </div>
                        {product.expiry_date && (
                            <div>
                                <span className="text-gray-500 block">Expiry Date</span>
                                <span className="font-medium text-red-600">{new Date(product.expiry_date).toLocaleDateString()}</span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
