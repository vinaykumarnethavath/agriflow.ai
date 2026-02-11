"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import Link from "next/link";
import {
    ShoppingCart,
    Search,
    Filter,
    Package,
    Minus,
    Plus,
    Trash2,
    ArrowLeft,
    History,
    CheckCircle,
    Clock,
    Leaf,
    Droplets,
    Bug,
    Wrench
} from "lucide-react";

interface Product {
    id: number;
    name: string;
    short_name?: string;
    category: string;
    price: number;
    quantity: number;
    batch_number: string;
    description?: string;
    user_id: number;
}

interface CartItem {
    product: Product;
    quantity: number;
}

interface Order {
    id: number;
    product_id: number;
    quantity: number;
    total_price: number;
    status: string;
    created_at: string;
    product_name?: string;
}

// Short names commonly used by farmers
const COMMON_SHORT_NAMES: Record<string, string> = {
    "DAP": "DAP (Di-Ammonium Phosphate)",
    "MOP": "MOP (Muriate of Potash)",
    "NPK": "NPK Fertilizer",
    "Urea": "Urea (46-0-0)",
    "SSP": "SSP (Single Super Phosphate)",
    "ZnSO4": "Zinc Sulphate",
    "Potash": "Potash / MOP",
};

export default function MarketPage() {
    const { user } = useAuth();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [showCart, setShowCart] = useState(false);
    const [orders, setOrders] = useState<Order[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [orderPlaced, setOrderPlaced] = useState(false);

    const categories = [
        { id: "all", name: "All Products", icon: Package },
        { id: "fertilizer", name: "Fertilizers", icon: Leaf },
        { id: "pesticide", name: "Pesticides", icon: Bug },
        { id: "seeds", name: "Seeds", icon: Droplets },
        { id: "equipment", name: "Equipment", icon: Wrench },
    ];

    useEffect(() => {
        fetchProducts();
        fetchOrders();
    }, []);

    const fetchProducts = async () => {
        try {
            const response = await api.get("/products");
            setProducts(response.data);
        } catch (error) {
            console.error("Failed to fetch products:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchOrders = async () => {
        try {
            const response = await api.get("/orders/my-orders");
            setOrders(response.data);
        } catch (error) {
            console.error("Failed to fetch orders:", error);
        }
    };

    // Filter products by search and category
    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            const matchesSearch =
                product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (product.short_name && product.short_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;

            return matchesSearch && matchesCategory;
        });
    }, [products, searchQuery, selectedCategory]);

    const addToCart = (product: Product) => {
        setCart(prev => {
            const existing = prev.find(item => item.product.id === product.id);
            if (existing) {
                return prev.map(item =>
                    item.product.id === product.id
                        ? { ...item, quantity: Math.min(item.quantity + 1, product.quantity) }
                        : item
                );
            }
            return [...prev, { product, quantity: 1 }];
        });
    };

    const removeFromCart = (productId: number) => {
        setCart(prev => prev.filter(item => item.product.id !== productId));
    };

    const updateCartQuantity = (productId: number, delta: number) => {
        setCart(prev =>
            prev.map(item => {
                if (item.product.id === productId) {
                    const newQty = Math.max(1, Math.min(item.quantity + delta, item.product.quantity));
                    return { ...item, quantity: newQty };
                }
                return item;
            })
        );
    };

    const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    const placeOrder = async () => {
        try {
            for (const item of cart) {
                await api.post("/orders", {
                    product_id: item.product.id,
                    quantity: item.quantity,
                    total_price: item.product.price * item.quantity,
                });
            }
            setCart([]);
            setOrderPlaced(true);
            fetchOrders();
            setTimeout(() => {
                setOrderPlaced(false);
                setShowCart(false);
            }, 3000);
        } catch (error) {
            console.error("Failed to place order:", error);
        }
    };

    const getShortName = (product: Product) => {
        return product.short_name || product.name;
    };

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case "fertilizer": return <Leaf className="h-4 w-4" />;
            case "pesticide": return <Bug className="h-4 w-4" />;
            case "seeds": return <Droplets className="h-4 w-4" />;
            case "equipment": return <Wrench className="h-4 w-4" />;
            default: return <Package className="h-4 w-4" />;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent"></div>
            </div>
        );
    }

    // Order History View
    if (showHistory) {
        return (
            <div className="space-y-6 p-2">
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        onClick={() => setShowHistory(false)}
                        className="flex items-center gap-2"
                    >
                        <ArrowLeft className="h-4 w-4" /> Back to Market
                    </Button>
                    <h1 className="text-3xl font-bold text-gray-800">Order History</h1>
                </div>

                {orders.length === 0 ? (
                    <Card className="border-dashed border-2">
                        <CardContent className="p-12 text-center">
                            <History className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                            <h3 className="text-xl font-bold text-gray-600">No orders yet</h3>
                            <p className="text-gray-500">Your order history will appear here</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {orders.map(order => (
                            <Card key={order.id} className="border-gray-100 hover:shadow-md transition-shadow">
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-bold text-gray-800">Order #{order.id}</p>
                                            <p className="text-sm text-gray-500">
                                                {new Date(order.created_at).toLocaleDateString()} • {order.quantity} items
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-green-700">₹{order.total_price.toLocaleString()}</p>
                                            <span className={`text-xs px-2 py-1 rounded-full font-bold ${order.status === 'Completed'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-amber-100 text-amber-700'
                                                }`}>
                                                {order.status === 'Completed' ? <CheckCircle className="h-3 w-3 inline mr-1" /> : <Clock className="h-3 w-3 inline mr-1" />}
                                                {order.status}
                                            </span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // Cart View
    if (showCart) {
        return (
            <div className="space-y-6 p-2">
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        onClick={() => setShowCart(false)}
                        className="flex items-center gap-2"
                    >
                        <ArrowLeft className="h-4 w-4" /> Continue Shopping
                    </Button>
                    <h1 className="text-3xl font-bold text-gray-800">Your Cart</h1>
                </div>

                {orderPlaced ? (
                    <Card className="bg-green-50 border-green-200">
                        <CardContent className="p-12 text-center">
                            <CheckCircle className="h-20 w-20 mx-auto text-green-500 mb-4" />
                            <h3 className="text-2xl font-bold text-green-800">Order Placed Successfully!</h3>
                            <p className="text-green-600">Your order has been submitted and will be processed soon.</p>
                        </CardContent>
                    </Card>
                ) : cart.length === 0 ? (
                    <Card className="border-dashed border-2">
                        <CardContent className="p-12 text-center">
                            <ShoppingCart className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                            <h3 className="text-xl font-bold text-gray-600">Your cart is empty</h3>
                            <p className="text-gray-500">Add products to get started</p>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <div className="space-y-4">
                            {cart.map(item => (
                                <Card key={item.product.id} className="border-gray-100">
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-center">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    {getCategoryIcon(item.product.category)}
                                                    <h3 className="font-bold text-gray-800">{getShortName(item.product)}</h3>
                                                </div>
                                                {item.product.short_name && (
                                                    <p className="text-xs text-gray-500">{item.product.name}</p>
                                                )}
                                                <p className="text-sm text-green-600 font-bold">₹{item.product.price} each</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => updateCartQuantity(item.product.id, -1)}
                                                        className="h-8 w-8 p-0"
                                                    >
                                                        <Minus className="h-4 w-4" />
                                                    </Button>
                                                    <span className="font-bold w-8 text-center">{item.quantity}</span>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => updateCartQuantity(item.product.id, 1)}
                                                        className="h-8 w-8 p-0"
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                                <p className="font-bold text-lg w-24 text-right">
                                                    ₹{(item.product.price * item.quantity).toLocaleString()}
                                                </p>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => removeFromCart(item.product.id)}
                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        <Card className="bg-gradient-to-r from-green-600 to-green-700 text-white border-none">
                            <CardContent className="p-6">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="text-green-100 text-sm">Total Amount</p>
                                        <p className="text-4xl font-bold">₹{cartTotal.toLocaleString()}</p>
                                        <p className="text-green-200 text-sm">{cartItemCount} item(s)</p>
                                    </div>
                                    <Button
                                        onClick={placeOrder}
                                        className="bg-white text-green-700 hover:bg-green-50 font-bold px-8 py-6 text-lg"
                                    >
                                        Place Order
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        );
    }

    // Main Market View
    return (
        <div className="space-y-6 p-2">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/farmer">
                        <Button variant="outline" size="sm">
                            <ArrowLeft className="h-4 w-4 mr-2" /> Dashboard
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-green-900">Buy Fertilizers & More</h1>
                        <p className="text-gray-500">Browse products from local shops</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setShowHistory(true)}
                        className="flex items-center gap-2"
                    >
                        <History className="h-4 w-4" /> Order History
                    </Button>
                    <Button
                        onClick={() => setShowCart(true)}
                        className="bg-green-600 hover:bg-green-700 relative"
                    >
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Cart
                        {cartItemCount > 0 && (
                            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                                {cartItemCount}
                            </span>
                        )}
                    </Button>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by name (e.g., DAP, Urea, NPK)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border-2 border-gray-100 rounded-xl focus:border-green-500 outline-none text-gray-800"
                    />
                </div>
            </div>

            {/* Category Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                {categories.map(cat => (
                    <Button
                        key={cat.id}
                        variant={selectedCategory === cat.id ? "default" : "outline"}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`flex items-center gap-2 whitespace-nowrap ${selectedCategory === cat.id
                            ? "bg-green-600 hover:bg-green-700"
                            : "hover:bg-green-50"
                            }`}
                    >
                        <cat.icon className="h-4 w-4" />
                        {cat.name}
                    </Button>
                ))}
            </div>

            {/* Products Grid */}
            {filteredProducts.length === 0 ? (
                <Card className="border-dashed border-2">
                    <CardContent className="p-12 text-center">
                        <Package className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                        <h3 className="text-xl font-bold text-gray-600">No products found</h3>
                        <p className="text-gray-500">Try adjusting your search or filters</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredProducts.map(product => {
                        const inCart = cart.find(item => item.product.id === product.id);
                        return (
                            <Card
                                key={product.id}
                                className="border-gray-100 hover:border-green-200 hover:shadow-lg transition-all group"
                            >
                                <CardContent className="p-5">
                                    {/* Category Badge */}
                                    <div className="flex justify-between items-start mb-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${product.category === 'fertilizer' ? 'bg-green-100 text-green-700' :
                                            product.category === 'pesticide' ? 'bg-red-100 text-red-700' :
                                                product.category === 'seeds' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-gray-100 text-gray-700'
                                            }`}>
                                            {getCategoryIcon(product.category)}
                                            {product.category}
                                        </span>
                                        {product.quantity < 10 && (
                                            <span className="text-xs text-amber-600 font-bold">Low Stock</span>
                                        )}
                                    </div>

                                    {/* Product Name */}
                                    <h3 className="font-bold text-xl text-gray-800 group-hover:text-green-700 transition-colors">
                                        {getShortName(product)}
                                    </h3>
                                    {product.short_name && (
                                        <p className="text-xs text-gray-500 mb-2">{product.name}</p>
                                    )}
                                    {product.description && (
                                        <p className="text-sm text-gray-500 mb-3 line-clamp-2">{product.description}</p>
                                    )}

                                    {/* Price and Stock */}
                                    <div className="flex justify-between items-end mb-4">
                                        <div>
                                            <p className="text-2xl font-bold text-green-600">₹{product.price}</p>
                                            <p className="text-xs text-gray-400">per unit</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-medium text-gray-600">{product.quantity} available</p>
                                            <p className="text-xs text-gray-400">Batch: {product.batch_number}</p>
                                        </div>
                                    </div>

                                    {/* Add to Cart Button */}
                                    <Button
                                        onClick={() => addToCart(product)}
                                        disabled={product.quantity === 0}
                                        className={`w-full ${inCart
                                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                                            : "bg-green-600 hover:bg-green-700"
                                            }`}
                                    >
                                        {inCart ? (
                                            <>
                                                <CheckCircle className="h-4 w-4 mr-2" />
                                                In Cart ({inCart.quantity})
                                            </>
                                        ) : (
                                            <>
                                                <Plus className="h-4 w-4 mr-2" />
                                                Add to Cart
                                            </>
                                        )}
                                    </Button>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Floating Cart Summary */}
            {cartItemCount > 0 && !showCart && (
                <div className="fixed bottom-6 right-6 left-6 md:left-auto md:w-96">
                    <Card className="bg-gradient-to-r from-green-600 to-green-700 text-white border-none shadow-2xl">
                        <CardContent className="p-4">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-green-100 text-sm">{cartItemCount} item(s)</p>
                                    <p className="text-2xl font-bold">₹{cartTotal.toLocaleString()}</p>
                                </div>
                                <Button
                                    onClick={() => setShowCart(true)}
                                    className="bg-white text-green-700 hover:bg-green-50 font-bold"
                                >
                                    View Cart →
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
