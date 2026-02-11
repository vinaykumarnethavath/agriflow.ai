"use client";

import { useEffect, useState } from "react";
import { getShopOrders, updateOrderStatus, ShopOrder } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Truck, CheckCircle, Clock, ShoppingCart } from "lucide-react";

export default function ShopOrdersPage() {
    const [orders, setOrders] = useState<ShopOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<ShopOrder | null>(null);

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        try {
            const data = await getShopOrders();
            setOrders(data);
        } catch (error) {
            console.error("Failed to fetch shop orders:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = async (id: number, newStatus: string) => {
        try {
            await updateOrderStatus(id, newStatus);
            fetchOrders();
            // Update selected order view if it matches
            if (selectedOrder && selectedOrder.id === id) {
                setSelectedOrder({ ...selectedOrder, status: newStatus });
            }
        } catch (error) {
            console.error("Failed to update status:", error);
            alert("Failed to update status");
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "pending": return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200">Pending</Badge>;
            case "shipped": return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200">Shipped</Badge>;
            case "completed": return <Badge className="bg-green-100 text-green-700 hover:bg-green-200">Completed</Badge>;
            case "cancelled": return <Badge className="bg-red-100 text-red-700 hover:bg-red-200">Cancelled</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    if (loading) return <div className="p-8 text-center bg-gray-50 h-full">Loading orders...</div>;

    return (
        <div className="p-6 max-w-7xl mx-auto h-[calc(100vh-100px)]">
            <div className="flex flex-col h-full space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">Shop Orders</h1>
                        <p className="text-gray-500">Manage and fulfill customer orders</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full overflow-hidden">
                    {/* Order List */}
                    <Card className="col-span-1 border-r h-full overflow-y-auto">
                        <CardHeader>
                            <CardTitle className="text-lg">Order History</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-gray-100">
                                {orders.length === 0 ? (
                                    <div className="p-6 text-center text-gray-500">No orders yet</div>
                                ) : (
                                    orders.map((order) => (
                                        <div
                                            key={order.id}
                                            onClick={() => setSelectedOrder(order)}
                                            className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${selectedOrder?.id === order.id ? 'bg-green-50 border-l-4 border-l-green-600' : ''}`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="font-bold text-gray-800">#{order.id}</span>
                                                <span className="text-xs text-gray-500">{new Date(order.created_at).toLocaleDateString()}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <div className="text-sm">
                                                    <div className="font-medium text-gray-900">{order.farmer_name || `Farmer #${order.farmer_id}`}</div>
                                                    <div className="text-gray-500">{order.items?.length || 0} items</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-bold text-green-700">₹{order.final_amount}</div>
                                                    {getStatusBadge(order.status)}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Order Details */}
                    <Card className="col-span-2 h-full overflow-y-auto">
                        {selectedOrder ? (
                            <>
                                <CardHeader className="border-b bg-gray-50">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <CardTitle className="flex items-center gap-3">
                                                Order #{selectedOrder.id}
                                                {getStatusBadge(selectedOrder.status)}
                                            </CardTitle>
                                            <p className="text-sm text-gray-500 mt-1">
                                                Placed on {new Date(selectedOrder.created_at).toLocaleString()} by {selectedOrder.farmer_name || "Valued Farmer"}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            {selectedOrder.status === "pending" && (
                                                <Button size="sm" onClick={() => handleStatusUpdate(selectedOrder.id, "shipped")} className="bg-blue-600">
                                                    <Truck className="w-4 h-4 mr-2" /> Ship
                                                </Button>
                                            )}
                                            {selectedOrder.status === "shipped" && (
                                                <Button size="sm" onClick={() => handleStatusUpdate(selectedOrder.id, "completed")} className="bg-green-600">
                                                    <CheckCircle className="w-4 h-4 mr-2" /> Complete
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6 space-y-6">
                                    {/* Items Table */}
                                    <div>
                                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                                            <ShoppingCart className="w-4 h-4 text-gray-500" /> Order Items
                                        </h3>
                                        <div className="border rounded-lg overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50 border-b">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left">Product</th>
                                                        <th className="px-4 py-3 text-center">Qty</th>
                                                        <th className="px-4 py-3 text-right">Unit Price</th>
                                                        <th className="px-4 py-3 text-right">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {selectedOrder.items?.map((item) => (
                                                        <tr key={item.id}>
                                                            <td className="px-4 py-3 font-medium">{item.product_name}</td>
                                                            <td className="px-4 py-3 text-center">{item.quantity}</td>
                                                            <td className="px-4 py-3 text-right">₹{item.unit_price}</td>
                                                            <td className="px-4 py-3 text-right">₹{item.subtotal}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot className="bg-gray-50 font-medium">
                                                    <tr>
                                                        <td colSpan={3} className="px-4 py-3 text-right">Subtotal</td>
                                                        <td className="px-4 py-3 text-right">₹{selectedOrder.total_amount}</td>
                                                    </tr>
                                                    {selectedOrder.discount > 0 && (
                                                        <tr>
                                                            <td colSpan={3} className="px-4 py-3 text-right text-green-600">Discount</td>
                                                            <td className="px-4 py-3 text-right text-green-600">-₹{selectedOrder.discount}</td>
                                                        </tr>
                                                    )}
                                                    <tr className="text-lg border-t-2 border-gray-200">
                                                        <td colSpan={3} className="px-4 py-4 text-right">Total Paid ({selectedOrder.payment_mode})</td>
                                                        <td className="px-4 py-4 text-right font-bold text-green-700">₹{selectedOrder.final_amount}</td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>
                                </CardContent>
                            </>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <Package className="w-16 h-16 mb-4 opacity-20" />
                                <p>Select an order to view details</p>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
}
