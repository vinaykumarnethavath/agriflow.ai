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
    Wrench,
    Store,
    Star,
    ChevronDown,
    CreditCard
} from "lucide-react";
import MockRazorpayPopup from "@/components/payment/MockRazorpayPopup";

interface Product {
    id: number;
    name: string;
    short_name?: string;
    category: string;
    brand?: string;
    price: number;
    quantity: number;
    batch_number: string;
    description?: string;
    image_url?: string;
    product_image_url?: string;
    user_id: number;
    seller_name?: string;
    unit?: string;
    quantity_per_unit?: number;
    manufacture_date?: string;
    main_composition?: string;
}

interface CartItem {
    product: Product;
    quantity: number;
}

interface ShopInfo {
    id: number;
    name: string;
    village?: string;
    mandal?: string;
    district?: string;
    state?: string;
}

interface OrderItem {
    product_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    image_url?: string;
    product_image_url?: string;
    brand?: string;
    manufacturer?: string;
    main_composition?: string;  // Product composition for farmer visibility
}

interface Order {
    id: number;
    shop_id: number;
    shop_name?: string;
    farmer_id?: number;
    total_amount: number;
    discount: number;
    final_amount: number;
    payment_mode: string;
    payment_status?: string;
    payment_id?: string;
    status: string;
    created_at: string;
    items?: OrderItem[];
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
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [selectedShop, setSelectedShop] = useState<number | null>(null);
    const [shops, setShops] = useState<ShopInfo[]>([]);
    const [nearbyShopIds, setNearbyShopIds] = useState<Set<number> | null>(null);
    const [radiusKm, setRadiusKm] = useState<number>(50);
    const [orderPlaced, setOrderPlaced] = useState(false);
    const [placingOrder, setPlacingOrder] = useState(false);
    const [paymentMode, setPaymentMode] = useState<"cash" | "razorpay">("razorpay");
    const [mockOptions, setMockOptions] = useState<any>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

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
        fetchNearbyShops(radiusKm);
    }, []);

    useEffect(() => {
        fetchNearbyShops(radiusKm);
    }, [radiusKm]);

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

    const fetchNearbyShops = async (radius: number) => {
        try {
            const response = await api.get("/location/nearby/internal", {
                params: {
                    types: "shop",
                    radius_km: radius,
                    limit: 100,
                },
            });
            const providers = (response.data || []) as Array<{
                user_id: number;
                name?: string;
                village?: string;
                mandal?: string;
                district?: string;
                state?: string;
            }>;
            const nextShops = providers
                .filter(p => typeof p.user_id === "number")
                .map(p => ({
                    id: p.user_id,
                    name: p.name || "Shop",
                    village: p.village,
                    mandal: p.mandal,
                    district: p.district,
                    state: p.state,
                }));
            setShops(nextShops);
            const ids = new Set<number>(nextShops.map(s => s.id));
            setNearbyShopIds(ids);

            setSelectedShop(prev => {
                if (prev === null) return prev;
                return ids.has(prev) ? prev : null;
            });
        } catch (error) {
            console.error("Failed to fetch shops:", error);
            setNearbyShopIds(null);
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

    const handleCancelOrder = async (orderId: number) => {
        if (!confirm("Are you sure you want to cancel this order?")) return;
        try {
            await api.put(`/orders/${orderId}/status`, { status: "cancelled" });
            fetchOrders();
            fetchProducts();
        } catch (error) {
            console.error(error);
            alert("Failed to cancel order.");
        }
    };

    // Filter products by search, category, and shop
    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            const matchesSearch =
                product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (product.short_name && product.short_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (product.brand && product.brand.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
            const matchesShop = selectedShop === null || product.user_id === selectedShop;
            const matchesNearby = nearbyShopIds ? nearbyShopIds.has(product.user_id) : true;

            return matchesSearch && matchesCategory && matchesShop && matchesNearby;
        });
    }, [products, searchQuery, selectedCategory, selectedShop, nearbyShopIds]);

    const groupedFilteredProducts = useMemo(() => {
        const groups: Record<string, Product & { related_batches: Product[] }> = {};
        for (const p of filteredProducts) {
            const key = `${p.name}_${p.category}_${p.user_id}`;
            if (!groups[key]) {
                groups[key] = { ...p, related_batches: [p] };
            } else {
                groups[key].quantity += p.quantity;
                groups[key].related_batches.push(p);
            }
        }
        return Object.values(groups);
    }, [filteredProducts]);

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
        if (placingOrder) return;
        setPlacingOrder(true);
        try {
            // Group cart items by shop (user_id)
            const shopGroups: Record<number, CartItem[]> = {};
            for (const item of cart) {
                const shopId = item.product.user_id;
                if (!shopGroups[shopId]) shopGroups[shopId] = [];
                shopGroups[shopId].push(item);
            }

            for (const shopId in shopGroups) {
                const items: {product_id: number, quantity: number}[] = [];
                for (const item of shopGroups[shopId]) {
                    const relatedBatches = (item.product as any).related_batches || [item.product];
                    let remainingQty = item.quantity;
                    for (const batch of relatedBatches) {
                        if (remainingQty <= 0) break;
                        const qtyToTake = Math.min(batch.quantity, remainingQty);
                        if (qtyToTake > 0) {
                            items.push({
                                product_id: batch.id,
                                quantity: qtyToTake
                            });
                            remainingQty -= qtyToTake;
                        }
                    }
                }

                await api.post("/orders/", {
                    items,
                    payment_mode: paymentMode, // "cash" or "razorpay"
                    discount: 0,
                });
            }

            alert(`Order requests sent successfully! Shop owners will review them.`);
            setCart([]);
            setOrderPlaced(true);
            fetchOrders();
            fetchProducts();
            setTimeout(() => {
                setOrderPlaced(false);
                setShowCart(false);
                setPaymentMode("cash");
            }, 3000);

        } catch (error: any) {
            console.error("Failed to request order:", error);
            alert(error?.response?.data?.detail || "Failed to request order. Please try again.");
        } finally {
            setPlacingOrder(false);
        }
    };

    const handlePayNow = async (order: Order) => {
        try {
            const { getRazorpayConfig, createPaymentOrder, verifyPayment } = await import("@/lib/payment-api");
            const config = await getRazorpayConfig();
            const paymentOrder = await createPaymentOrder({
                amount: order.final_amount,
                payment_for: "shop_order",
                reference_id: order.id,
                notes: "Deferred Farmer Payment"
            });

            const options = {
                key: config.key_id,
                amount: paymentOrder.amount * 100,
                currency: "INR",
                name: "AgriChain Market",
                description: `Payment for Order #${order.id}`,
                order_id: paymentOrder.razorpay_order_id,
                theme: { color: "#16a34a" },
                handler: async (response: any) => {
                    try {
                        await verifyPayment({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                        });
                        alert("Payment successful!");
                        fetchOrders();
                    } catch (err) {
                        alert("Payment verification failed.");
                    }
                }
            };
            
            if (config.key_id.startsWith("rzp_test_placeholder")) {
                setMockOptions(options);
                return;
            }

            if (!(window as any).Razorpay) {
                await new Promise<void>((resolve, reject) => {
                    const script = document.createElement("script");
                    script.src = "https://checkout.razorpay.com/v1/checkout.js";
                    script.onload = () => resolve();
                    script.onerror = () => reject();
                    document.body.appendChild(script);
                });
            }

            const razorpay = new (window as any).Razorpay(options);
            razorpay.open();
        } catch (error) {
            console.error("Razorpay initiation failed", error);
            alert("Could not initialize payment window.");
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

    const getCategoryColor = (category: string) => {
        switch (category) {
            case "fertilizer": return "bg-emerald-100 text-emerald-700";
            case "pesticide": return "bg-rose-100 text-rose-700";
            case "seeds": return "bg-blue-100 text-blue-700";
            case "equipment": return "bg-amber-100 text-amber-700";
            default: return "bg-gray-100 text-gray-700";
        }
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case "completed": return "bg-emerald-100 text-emerald-700";
            case "confirmed": return "bg-blue-100 text-blue-700";
            case "dispatched": return "bg-purple-100 text-purple-700";
            case "pending": return "bg-amber-100 text-amber-700";
            case "cancelled": return "bg-red-100 text-red-700";
            default: return "bg-gray-100 text-gray-700";
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent"></div>
            </div>
        );
    }

    // ===========================
    //  ORDER HISTORY VIEW — Side Panel Layout
    // ===========================
    if (showHistory) {
        return (
            <div className="space-y-4 p-2">
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        onClick={() => { setShowHistory(false); setSelectedOrder(null); }}
                        className="flex items-center gap-2 border-gray-300 text-gray-700"
                    >
                        <ArrowLeft className="h-4 w-4" /> Back to Shopping
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
                    <div className="flex gap-4 h-[calc(100vh-180px)]">
                        {/* Order List (Left) */}
                        <div className="w-full md:w-96 flex-shrink-0 overflow-y-auto space-y-2 pr-1">
                            {orders.map(order => (
                                <div
                                    key={order.id}
                                    onClick={() => setSelectedOrder(order)}
                                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                                        selectedOrder?.id === order.id
                                            ? "border-green-400 bg-green-50 shadow-md"
                                            : "border-gray-200 bg-white hover:border-green-200 hover:shadow-sm"
                                    }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-gray-800">Order #{order.id}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                {" · "}
                                                {new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute:'2-digit' })}
                                            </p>
                                            {order.shop_name && (
                                                <span className="text-[10px] text-blue-600 font-medium flex items-center gap-1 mt-1">
                                                    <Store className="h-3 w-3" />{order.shop_name}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-green-700">₹{order.final_amount.toLocaleString()}</p>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${getStatusStyle(order.status)}`}>
                                                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                            </span>
                                        </div>
                                    </div>
                                    {order.items && (
                                        <p className="text-[11px] text-gray-400 mt-2 truncate">
                                            {order.items.map(i => i.product_name).join(", ")}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Order Detail Panel (Right) */}
                        <div className="hidden md:flex flex-1 overflow-y-auto">
                            {!selectedOrder ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                                    <History className="h-12 w-12 mb-3 opacity-50" />
                                    <p className="font-medium">Select an order to view details</p>
                                </div>
                            ) : (
                                <Card className="flex-1 border-gray-200">
                                    <CardHeader className="border-b bg-gray-50/50 pb-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <CardTitle className="text-xl">Order #{selectedOrder.id}</CardTitle>
                                                <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                                                    <Clock className="h-3.5 w-3.5" />
                                                    {new Date(selectedOrder.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    {" at "}
                                                    {new Date(selectedOrder.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute:'2-digit' })}
                                                </p>
                                                {selectedOrder.shop_name && (
                                                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200 mt-2 inline-flex items-center gap-1">
                                                        <Store className="h-3 w-3" />{selectedOrder.shop_name}
                                                    </span>
                                                )}
                                            </div>
                                            <span className={`text-xs px-3 py-1.5 rounded-full font-bold ${getStatusStyle(selectedOrder.status)}`}>
                                                {selectedOrder.status === 'completed' ? <CheckCircle className="h-3 w-3 inline mr-1" /> : <Clock className="h-3 w-3 inline mr-1" />}
                                                {selectedOrder.status.charAt(0).toUpperCase() + selectedOrder.status.slice(1)}
                                            </span>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-5 space-y-5">
                                        {/* Cart Items */}
                                        <div>
                                            <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-3">Cart Items</h3>
                                            <div className="space-y-3">
                                                {selectedOrder.items?.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between items-start py-2.5 border-b border-gray-50 last:border-0">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-12 h-12 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden border">
                                                                {item.image_url || item.product_image_url ? (
                                                                    <img src={item.image_url || item.product_image_url} alt={item.product_name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-gray-400"><Package className="h-5 w-5" /></div>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className="font-semibold text-gray-800">{item.product_name}</p>
                                                                <p className="text-xs text-gray-500">
                                                                    {item.brand || item.manufacturer ? <span className="text-emerald-700 font-medium">{item.brand || item.manufacturer}</span> : ''}
                                                                    {item.brand || item.manufacturer ? ' · ' : ''}Qty: {item.quantity} × ₹{item.unit_price}
                                                                </p>
                                                                {item.main_composition && (
                                                                    <span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-100 font-medium mt-1 inline-block">
                                                                        🧪 {item.main_composition}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <p className="font-semibold text-gray-800">₹{item.subtotal.toLocaleString()}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Transaction Details */}
                                        <div className="border-t pt-4">
                                            <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-3">Transaction Details</h3>
                                            <div className="bg-gray-50 rounded-xl p-4 space-y-2.5">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-500">Subtotal</span>
                                                    <span className="font-medium text-gray-800">₹{selectedOrder.total_amount.toLocaleString()}</span>
                                                </div>
                                                {selectedOrder.discount > 0 && (
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-gray-500">Discount</span>
                                                        <span className="font-medium text-green-600">- ₹{selectedOrder.discount.toLocaleString()}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between text-sm border-t pt-2">
                                                    <span className="font-bold text-gray-800">Total</span>
                                                    <span className="font-bold text-green-700 text-lg">₹{selectedOrder.final_amount.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Payment Details */}
                                        <div className="border-t pt-4">
                                            <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-3">Payment</h3>
                                            <div className="flex items-center gap-3">
                                                <div className="bg-blue-50 p-2 rounded-lg">
                                                    <CreditCard className="h-5 w-5 text-blue-600" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-800 capitalize">{selectedOrder.payment_mode}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {selectedOrder.payment_status === "paid" ? (
                                                            <span className="text-green-600 font-bold">✅ Payment Completed</span>
                                                        ) : (
                                                            <span className="text-amber-600 font-medium">⏳ Payment Pending</span>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="border-t pt-4 flex gap-3">
                                            {selectedOrder.status === 'pending' && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleCancelOrder(selectedOrder.id)}
                                                    className="text-red-600 border-red-200 hover:bg-red-50"
                                                >
                                                    <Trash2 className="h-4 w-4 mr-1" /> Cancel Order
                                                </Button>
                                            )}
                                            {selectedOrder.status === "confirmed" && selectedOrder.payment_mode === "razorpay" && selectedOrder.payment_status !== "paid" && (
                                                <Button
                                                    size="sm"
                                                    onClick={() => handlePayNow(selectedOrder)}
                                                    className="bg-green-600 hover:bg-green-700 text-white"
                                                >
                                                    <CreditCard className="h-4 w-4 mr-1" /> Pay Now — ₹{selectedOrder.final_amount.toLocaleString()}
                                                </Button>
                                            )}
                                            {selectedOrder.payment_status === "paid" && (
                                                <span className="text-sm text-green-700 font-bold bg-green-100 px-3 py-1.5 rounded-full border border-green-200">Paid ✅</span>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                )}
                {mockOptions && <MockRazorpayPopup options={mockOptions} onClose={() => { setMockOptions(null); fetchOrders(); }} />}
            </div>
        );
    }

    // ===========================
    //  CART VIEW
    // ===========================
    if (showCart) {
        return (
            <div className="space-y-6 p-2">
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        onClick={() => setShowCart(false)}
                        className="flex items-center gap-2 border-gray-300 text-gray-700"
                    >
                        <ArrowLeft className="h-4 w-4" /> Continue Shopping
                    </Button>
                    <h1 className="text-3xl font-bold text-gray-800">Your Cart</h1>
                </div>

                {orderPlaced ? (
                    <Card className="bg-emerald-50 border-emerald-200">
                        <CardContent className="p-12 text-center">
                            <CheckCircle className="h-20 w-20 mx-auto text-emerald-500 mb-4" />
                            <h3 className="text-2xl font-bold text-emerald-800">Order Placed Successfully!</h3>
                            <p className="text-emerald-600">Your order has been submitted to the shop. You can track it in Order History.</p>
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
                                <Card key={item.product.id} className="border-gray-200">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-4">
                                            {/* Product Image */}
                                            <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                                                {item.product.image_url || item.product.product_image_url ? (
                                                    <img src={item.product.image_url || item.product.product_image_url} alt={item.product.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-2xl">
                                                        {item.product.category === 'fertilizer' ? '🌿' : item.product.category === 'pesticide' ? '🧴' : item.product.category === 'seeds' ? '🌱' : '📦'}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    {getCategoryIcon(item.product.category)}
                                                    <h3 className="font-bold text-gray-800">{getShortName(item.product)}</h3>
                                                </div>
                                                {item.product.seller_name && (
                                                    <button
                                                        onClick={() => { setSelectedShop(item.product.user_id); setShowCart(false); }}
                                                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer transition-colors"
                                                    >
                                                        <Store className="h-3 w-3" />
                                                        Sold by <span className="font-bold">{item.product.seller_name}</span>
                                                    </button>
                                                )}
                                                <p className="text-sm text-green-700 font-bold">₹{item.product.price} each</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => updateCartQuantity(item.product.id, -1)}
                                                        className="h-8 w-8 p-0 text-gray-700"
                                                    >
                                                        <Minus className="h-4 w-4" />
                                                    </Button>
                                                    <span className="font-bold w-8 text-center text-gray-800">{item.quantity}</span>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => updateCartQuantity(item.product.id, 1)}
                                                        className="h-8 w-8 p-0 text-gray-700"
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                                <p className="font-bold text-lg w-24 text-right text-gray-800">
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

                        <Card className="bg-gradient-to-r from-green-600 to-emerald-700 border-none shadow-xl">
                            <CardContent className="p-6">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="text-green-100 text-sm">Total Amount</p>
                                        <p className="text-4xl font-bold text-white">₹{cartTotal.toLocaleString()}</p>
                                        <p className="text-green-200 text-sm">{cartItemCount} item(s) • {Object.keys(
                                            cart.reduce((acc, item) => ({ ...acc, [item.product.user_id]: true }), {} as Record<number, boolean>)
                                        ).length} shop(s)</p>
                                    </div>
                                        <div className="mb-4 bg-white/10 rounded-lg p-3">
                                            <p className="text-green-100 text-sm mb-2 font-medium">Payment Mode</p>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant={paymentMode === "razorpay" ? "default" : "outline"}
                                                    onClick={() => setPaymentMode("razorpay")}
                                                    className={`flex-1 ${paymentMode === "razorpay" ? "bg-white text-green-700 hover:bg-gray-100" : "bg-transparent text-white border-green-400 hover:bg-green-700 hover:text-white"}`}
                                                >
                                                    <CreditCard className="w-4 h-4 mr-2" /> Pay Online
                                                </Button>
                                                <Button
                                                    variant={paymentMode === "cash" ? "default" : "outline"}
                                                    onClick={() => setPaymentMode("cash")}
                                                    className={`flex-1 ${paymentMode === "cash" ? "bg-white text-green-700 hover:bg-gray-100" : "bg-transparent text-white border-green-400 hover:bg-green-700 hover:text-white"}`}
                                                >
                                                    Cash on Delivery
                                                </Button>
                                            </div>
                                        </div>
                                        <Button
                                            onClick={placeOrder}
                                            disabled={placingOrder}
                                            className="w-full bg-white text-green-700 hover:bg-green-50 font-bold px-8 py-6 text-lg"
                                        >
                                            {placingOrder ? "Processing..." : "Request Order"}
                                        </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}
                {mockOptions && <MockRazorpayPopup options={mockOptions} onClose={() => { setMockOptions(null); setPlacingOrder(false); }} />}
            </div>
        );
    }

    return (
        <div className="space-y-6 p-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/farmer">
                        <Button variant="outline" className="flex items-center gap-2 border-gray-300 text-gray-700">
                            <ArrowLeft className="h-4 w-4" /> Back
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-800">Market</h1>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={() => { setShowHistory(true); fetchOrders(); }}
                        className="flex items-center gap-2 border-gray-300 text-gray-700"
                    >
                        <History className="h-4 w-4" /> Order History
                    </Button>
                    <Button
                        onClick={() => setShowCart(true)}
                        className="bg-green-600 hover:bg-green-700 text-white relative"
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

            {/* Nearby Shops Quick Filter Removed completely */}

            {/* Search and Shop Filter */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by name, brand (e.g., DAP, Urea, IFFCO)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-500 outline-none text-gray-800 bg-white"
                    />
                </div>
                {/* Shop Filter */}
                <div className="relative">
                    <select
                        value={selectedShop ?? "all"}
                        onChange={(e) => setSelectedShop(e.target.value === "all" ? null : parseInt(e.target.value))}
                        className="appearance-none pl-10 pr-10 py-3 border-2 border-gray-200 rounded-xl focus:border-green-500 outline-none text-gray-800 bg-white min-w-[200px]"
                    >
                        <option value="all">All Shops</option>
                        {shops.map(shop => (
                            <option key={shop.id} value={shop.id}>
                                {shop.name}{(shop.village || shop.mandal || shop.district || shop.state)
                                    ? ` (${shop.village || shop.mandal || shop.district || shop.state})`
                                    : ""}
                            </option>
                        ))}
                    </select>
                    <Store className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
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
                            ? "bg-green-600 hover:bg-green-700 text-white"
                            : "hover:bg-green-50 text-gray-700 border-gray-300"
                            }`}
                    >
                        <cat.icon className="h-4 w-4" />
                        {cat.name}
                    </Button>
                ))}
            </div>

            {/* Products Grid */}
            {groupedFilteredProducts.length === 0 ? (
                <Card className="border-dashed border-2">
                    <CardContent className="p-12 text-center">
                        <Package className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                        <h3 className="text-xl font-bold text-gray-600">No products found</h3>
                        <p className="text-gray-500">Try adjusting your search or filters</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {groupedFilteredProducts.map(product => {
                        const inCart = cart.find(item => item.product.id === product.id);
                        return (
                            <Card
                                key={product.id}
                                className="border-gray-200 hover:border-green-300 hover:shadow-lg transition-all group overflow-hidden"
                            >
                                {/* Product Image */}
                                <div 
                                    className="w-full h-44 bg-gray-50 overflow-hidden relative cursor-pointer"
                                    onClick={() => {
                                        const imgUrl = product.image_url || product.product_image_url;
                                        if (imgUrl) setSelectedImage(imgUrl);
                                    }}
                                >
                                    {product.image_url || product.product_image_url ? (
                                        <img
                                            src={product.image_url || product.product_image_url}
                                            alt={product.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <div className="text-6xl opacity-30">
                                                {product.category === 'fertilizer' ? '🌿' : product.category === 'pesticide' ? '🧴' : product.category === 'seeds' ? '🌱' : '📦'}
                                            </div>
                                        </div>
                                    )}
                                    {/* Category Badge */}
                                    <span className={`absolute top-3 left-3 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${getCategoryColor(product.category)}`}>
                                        {getCategoryIcon(product.category)}
                                        {product.category}
                                    </span>
                                    {product.quantity < 10 && (
                                        <span className="absolute top-3 right-3 text-xs bg-amber-100 text-amber-700 font-bold px-2 py-1 rounded-full">Low Stock</span>
                                    )}
                                </div>

                                <CardContent className="p-4">
                                    <div className="flex-1">
                                        <h3 className="font-bold text-lg text-gray-800 group-hover:text-green-700 transition-colors line-clamp-1">
                                            {getShortName(product)}
                                        </h3>
                                        {product.brand && (
                                            <p className="text-xs text-gray-500 mb-1">{product.brand}</p>
                                        )}

                                        {/* Shop Name */}
                                        {product.seller_name && (
                                            <button
                                                onClick={() => setSelectedShop(product.user_id)}
                                                className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 mb-2 transition-colors cursor-pointer"
                                            >
                                                <Store className="h-3 w-3" /> {product.seller_name}
                                            </button>
                                        )}
                                        
                                        {/* Pack Size & Dates */}
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            {product.quantity_per_unit && product.unit && (
                                                <span className="text-[10px] bg-green-50 text-green-700 font-bold px-2 py-0.5 rounded-full border border-green-100 flex items-center gap-1">
                                                    <Package className="h-3 w-3" />
                                                    {product.quantity_per_unit} {product.unit} pack
                                                </span>
                                            )}
                                            {product.manufacture_date && (
                                                <span className="text-[10px] bg-sky-50 text-sky-700 font-medium px-2 py-0.5 rounded-full border border-sky-100">
                                                    Mfg: {new Date(product.manufacture_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                                                </span>
                                            )}
                                        </div>
                                        {product.main_composition && (
                                            <div className="mt-1 mb-2">
                                                <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded inline-block">
                                                    <span className="font-semibold">Composition:</span> {product.main_composition}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Price and Stock */}
                                    <div className="flex justify-between items-end mb-3 mt-auto">
                                        <div>
                                            <p className="text-2xl font-bold text-green-700">₹{product.price}</p>
                                            <p className="text-xs text-gray-500">per unit</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-medium text-gray-600">{product.quantity} in stock</p>
                                        </div>
                                    </div>

                                    {/* Add to Cart Button */}
                                    <Button
                                        onClick={() => addToCart(product)}
                                        disabled={product.quantity === 0}
                                        className={`w-full ${inCart
                                            ? "bg-green-100 text-green-700 hover:bg-green-200 border border-green-300"
                                            : "bg-green-600 hover:bg-green-700 text-white"
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
                <div className="fixed bottom-6 right-6 left-6 md:left-auto md:w-96 z-50">
                    <Card className="bg-gradient-to-r from-green-600 to-emerald-700 border-none shadow-2xl">
                        <CardContent className="p-4">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-green-100 text-sm">{cartItemCount} item(s)</p>
                                    <p className="text-2xl font-bold text-white">₹{cartTotal.toLocaleString()}</p>
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
            {mockOptions && <MockRazorpayPopup options={mockOptions} onClose={() => { setMockOptions(null); setPlacingOrder(false); }} />}
            
            {/* Image Lightbox */}
            {selectedImage && (
                <div 
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
                    onClick={() => setSelectedImage(null)}
                >
                    <div className="relative max-w-5xl max-h-[90vh] w-full h-full flex items-center justify-center">
                        <button 
                            className="absolute top-0 right-0 md:top-4 md:right-4 text-white bg-black/50 hover:bg-black/80 rounded-full p-2 transition-colors z-10"
                            onClick={(e) => { e.stopPropagation(); setSelectedImage(null); }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                        <img 
                            src={selectedImage} 
                            alt="Full View" 
                            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
