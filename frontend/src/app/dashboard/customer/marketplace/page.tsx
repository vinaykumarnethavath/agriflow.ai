"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getMarketplaceProducts, Product } from "@/lib/api";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Search, Filter } from "lucide-react";
import Link from "next/link";
import { addToCart } from "@/lib/api";

export default function MarketplacePage() {
    const searchParams = useSearchParams();
    const categoryParam = searchParams.get("category");

    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState(categoryParam || "");

    useEffect(() => {
        fetchProducts();
    }, [category, search]); // Re-fetch when filters change (debouncing would be better in prod)

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const data = await getMarketplaceProducts(category || undefined, search || undefined);
            setProducts(data);
        } catch (error) {
            console.error("Failed to fetch products:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddToCart = async (e: React.MouseEvent, productId: number) => {
        e.preventDefault(); // Prevent navigation if clicking button inside link
        e.stopPropagation();
        try {
            await addToCart(productId, 1);
            alert("Added to cart!"); // Replace with toast later
        } catch (error) {
            console.error("Failed to add to cart:", error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Marketplace</h1>
                    <p className="text-gray-500">Browse fresh produce and processed goods</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                        <Input
                            placeholder="Search products..."
                            className="pl-8"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select
                        className="border rounded-md px-3 py-2 text-sm bg-white"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                    >
                        <option value="">All Categories</option>
                        <option value="crop">Fresh Crops</option>
                        <option value="processed">Processed Goods</option>
                        <option value="seeds">Seeds</option>
                        <option value="fertilizer">Fertilizers</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-500">Loading marketplace...</div>
            ) : products.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed">
                    <p className="text-gray-500">No products found matching your criteria.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {products.map((product) => (
                        <Link href={`/dashboard/customer/products/${product.id}`} key={product.id} className="group">
                            <Card className="h-full hover:shadow-lg transition-shadow overflow-hidden flex flex-col">
                                <div className="h-48 bg-gray-100 flex items-center justify-center relative">
                                    {/* Placeholder Image */}
                                    <span className="text-4xl">
                                        {product.category === 'crop' ? '🌾' :
                                            product.category === 'processed' ? '🥡' : '📦'}
                                    </span>
                                    {product.quantity < 10 && (
                                        <Badge variant="destructive" className="absolute top-2 right-2">Low Stock</Badge>
                                    )}
                                </div>
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-lg line-clamp-1">{product.name}</CardTitle>
                                        <Badge variant="secondary" className="capitalize text-xs">{product.category}</Badge>
                                    </div>
                                    <p className="text-sm text-gray-500">{product.brand || 'Local Farmer'}</p>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-bold text-green-700">₹{product.price}</span>
                                        <span className="text-sm text-gray-500">/{product.unit}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2 line-clamp-2">{product.description}</p>
                                </CardContent>
                                <CardFooter className="pt-0">
                                    <Button className="w-full bg-green-600 hover:bg-green-700" onClick={(e) => handleAddToCart(e, product.id)}>
                                        <ShoppingCart className="w-4 h-4 mr-2" /> Add to Cart
                                    </Button>
                                </CardFooter>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
