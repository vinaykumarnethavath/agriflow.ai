"use client";


import React, { useEffect, useState } from "react";
import { getCart, removeFromCart, checkout, CartItem } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, ArrowRight, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function CartPage() {
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        fetchCart();
    }, []);

    const fetchCart = async () => {
        try {
            const data = await getCart();
            setCartItems(data);
        } catch (error) {
            console.error("Failed to fetch cart:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = async (id: number) => {
        try {
            await removeFromCart(id);
            fetchCart(); // Refresh
        } catch (error) {
            console.error("Failed to remove item:", error);
        }
    };

    const handleCheckout = async () => {
        if (!confirm("Confirm purchase?")) return;
        try {
            await checkout();
            alert("Order placed successfully!");
            router.push("/dashboard/customer/orders");
        } catch (error) {
            console.error("Checkout failed:", error);
            alert("Checkout failed. Please try again.");
        }
    };

    const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    if (loading) return <div className="p-8 text-center">Loading cart...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                <ShoppingBag className="w-8 h-8" /> Your Shopping Cart
            </h1>

            {cartItems.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-lg border shadow-sm">
                    <ShoppingBag className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                    <h2 className="text-xl font-semibold text-gray-700">Your cart is empty</h2>
                    <p className="text-gray-500 mb-6">Looks like you haven't added anything yet.</p>
                    <Link href="/dashboard/customer/marketplace">
                        <Button>Browse Marketplace</Button>
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Cart Items List */}
                    <div className="lg:col-span-2 space-y-4">
                        {cartItems.map((item) => (
                            <Card key={item.id} className="flex flex-row items-center p-4 gap-4">
                                <div className="w-20 h-20 bg-gray-100 rounded-md flex items-center justify-center text-2xl">
                                    📦
                                </div>
                                <div className="flex-grow">
                                    <h3 className="font-semibold text-lg">{item.product_name}</h3>
                                    <p className="text-sm text-gray-500">Seller: {item.seller_name}</p>
                                    <div className="flex items-center gap-4 mt-1">
                                        <span className="text-sm font-medium">Qty: {item.quantity}</span>
                                        <span className="text-xs text-gray-400">@ ₹{item.price}/unit</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-lg">₹{(item.price * item.quantity).toFixed(2)}</div>
                                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 h-8 px-2 mt-2" onClick={() => handleRemove(item.id)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </Card>
                        ))}
                    </div>

                    {/* Order Summary */}
                    <Card className="h-fit">
                        <CardHeader>
                            <CardTitle>Order Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Subtotal</span>
                                <span>₹{total.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Shipping</span>
                                <span className="text-green-600">Free</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Taxes</span>
                                <span>₹0.00</span>
                            </div>
                            <div className="border-t pt-2 mt-2 flex justify-between font-bold text-lg">
                                <span>Total</span>
                                <span>₹{total.toFixed(2)}</span>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button className="w-full bg-green-600 hover:bg-green-700 py-6 text-lg" onClick={handleCheckout}>
                                Checkout <ArrowRight className="w-5 h-5 ml-2" />
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            )}
        </div>
    );
}
