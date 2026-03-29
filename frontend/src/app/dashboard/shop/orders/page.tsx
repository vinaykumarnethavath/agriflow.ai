"use client";

import { useEffect, useState, useMemo } from "react";
import { getShopOrdersDetailed, updateOrderStatus, ShopOrderDetailed } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Package, Truck, CheckCircle, Clock, ShoppingCart, CreditCard,
    TrendingUp, AlertCircle, Wallet, ChevronDown, ChevronUp, X
} from "lucide-react";

export default function ShopOrdersPage() {
    const [orders, setOrders] = useState<ShopOrderDetailed[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<ShopOrderDetailed | null>(null);
    const [timeFilter, setTimeFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");

    // Confirm with discount modal
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmDiscount, setConfirmDiscount] = useState(0);
    const [confirming, setConfirming] = useState(false);

    const filteredOrders = useMemo(() => {
        return orders.filter((order) => {
            const matchesStatus = statusFilter === "all" || order.status === statusFilter;
            if (!matchesStatus) return false;
            if (timeFilter === "all") return true;
            const orderDate = new Date(order.created_at);
            const now = new Date();
            if (timeFilter === "today") return orderDate.toDateString() === now.toDateString();
            if (timeFilter === "weekly") {
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(now.getDate() - 7);
                return orderDate >= oneWeekAgo;
            }
            if (timeFilter === "monthly") {
                const oneMonthAgo = new Date();
                oneMonthAgo.setMonth(now.getMonth() - 1);
                return orderDate >= oneMonthAgo;
            }
            return true;
        });
    }, [orders, timeFilter, statusFilter]);

    useEffect(() => {
        fetchOrders();
    }, []);

    useEffect(() => {
        if (selectedOrder && !filteredOrders.some((o) => o.id === selectedOrder.id)) {
            setSelectedOrder(filteredOrders[0] || null);
        }
    }, [filteredOrders, selectedOrder]);

    const fetchOrders = async () => {
        try {
            const data = await getShopOrdersDetailed();
            setOrders(data);
        } catch (error) {
            console.error("Failed to fetch shop orders:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = async (id: number, newStatus: string, extraData?: any) => {
        try {
            await updateOrderStatus(id, { status: newStatus, ...extraData });
            await fetchOrders();
            if (selectedOrder && selectedOrder.id === id) {
                setSelectedOrder((prev) => prev ? { ...prev, status: newStatus } : null);
            }
        } catch (error) {
            console.error("Failed to update status:", error);
            alert("Failed to update status");
        }
    };

    const openConfirmModal = () => {
        if (!selectedOrder) return;
        setConfirmDiscount(selectedOrder.discount || 0);
        setShowConfirmModal(true);
    };

    const handleConfirmWithDiscount = async () => {
        if (!selectedOrder) return;
        setConfirming(true);
        try {
            await updateOrderStatus(selectedOrder.id, {
                status: "confirmed",
                discount: confirmDiscount,
            });
            await fetchOrders();
            setShowConfirmModal(false);
            // Refresh selected order
            const updated = orders.find(o => o.id === selectedOrder.id);
            if (updated) setSelectedOrder(updated);
        } catch (error) {
            console.error("Failed to confirm:", error);
            alert("Failed to confirm order");
        } finally {
            setConfirming(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "pending": return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200">Pending</Badge>;
            case "confirmed": return <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200">Confirmed</Badge>;
            case "dispatched": return <Badge className="bg-cyan-100 text-cyan-700 hover:bg-cyan-200">Dispatched</Badge>;
            case "completed": return <Badge className="bg-green-100 text-green-700 hover:bg-green-200">Completed</Badge>;
            case "cancelled": return <Badge className="bg-red-100 text-red-700 hover:bg-red-200">Cancelled</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    if (loading) return <div className="p-8 text-center bg-gray-50 h-full">Loading orders...</div>;

    return (
        <div className="p-6 max-w-7xl mx-auto h-[calc(100vh-100px)]">
            <div className="flex flex-col h-full space-y-4">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">Shop Orders</h1>
                        <p className="text-gray-500 text-sm">Manage orders with full cost & profit breakdown</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 overflow-hidden">
                    {/* Order List */}
                    <Card className="col-span-1 border-r h-full overflow-y-auto">
                        <CardHeader className="pb-3 border-b sticky top-0 bg-white z-10">
                            <CardTitle className="text-lg">Order History</CardTitle>
                            <div className="flex gap-2 mt-2 flex-wrap">
                                <select
                                    value={timeFilter}
                                    onChange={(e) => setTimeFilter(e.target.value)}
                                    className="p-1 border rounded text-xs text-gray-700 bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                                >
                                    <option value="all">Any Time</option>
                                    <option value="today">Today</option>
                                    <option value="weekly">This Week</option>
                                    <option value="monthly">This Month</option>
                                </select>
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="p-1 border rounded text-xs text-gray-700 bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                                >
                                    <option value="all">Any Status</option>
                                    <option value="pending">Pending</option>
                                    <option value="confirmed">Confirmed</option>
                                    <option value="dispatched">Dispatched</option>
                                    <option value="completed">Completed</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-gray-100">
                                {filteredOrders.length === 0 ? (
                                    <div className="p-6 text-center text-gray-500">No matching orders</div>
                                ) : (
                                    filteredOrders.map((order) => (
                                        <div
                                            key={order.id}
                                            onClick={() => setSelectedOrder(order)}
                                            className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${selectedOrder?.id === order.id ? "bg-green-50 border-l-4 border-l-green-600" : ""}`}
                                        >
                                            <div className="flex justify-between items-start mb-1">
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
                                                    {order.status === "completed" && order.profit !== undefined && (
                                                        <div className={`text-xs mt-0.5 font-semibold ${order.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                                            {order.profit >= 0 ? "+" : ""}₹{order.profit.toFixed(0)} profit
                                                        </div>
                                                    )}
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
                                <CardHeader className="border-b bg-gray-50 sticky top-0 z-10">
                                    <div className="flex justify-between items-center flex-wrap gap-2">
                                        <div>
                                            <CardTitle className="flex items-center gap-3">
                                                Order #{selectedOrder.id}
                                                {getStatusBadge(selectedOrder.status)}
                                            </CardTitle>
                                            <p className="text-sm text-gray-500 mt-1">
                                                {new Date(selectedOrder.created_at).toLocaleString()} · {selectedOrder.farmer_name || "Walk-in Customer"}
                                            </p>
                                        </div>
                                        <div className="flex gap-2 flex-wrap">
                                            {selectedOrder.status === "pending" && (
                                                <>
                                                    <Button size="sm" onClick={() => handleStatusUpdate(selectedOrder.id, "cancelled")} className="bg-red-600 hover:bg-red-700">
                                                        Decline
                                                    </Button>
                                                    <Button size="sm" onClick={openConfirmModal} className="bg-indigo-600 hover:bg-indigo-700">
                                                        <CheckCircle className="w-4 h-4 mr-1" /> Confirm
                                                    </Button>
                                                </>
                                            )}
                                            {(selectedOrder.status === "confirmed" || selectedOrder.status === "pending") && (
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleStatusUpdate(selectedOrder.id, "dispatched")}
                                                    className="bg-blue-600"
                                                    disabled={selectedOrder.payment_mode === "razorpay" && selectedOrder.payment_status !== "paid"}
                                                >
                                                    <Truck className="w-4 h-4 mr-1" /> Dispatch
                                                </Button>
                                            )}
                                            {selectedOrder.status === "dispatched" && (
                                                <Button size="sm" onClick={() => handleStatusUpdate(selectedOrder.id, "completed")} className="bg-green-600">
                                                    <CheckCircle className="w-4 h-4 mr-1" /> Complete
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardHeader>

                                <CardContent className="p-6 space-y-6">
                                    {/* Items Table */}
                                    <div>
                                        <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm text-gray-700">
                                            <ShoppingCart className="w-4 h-4" /> Order Items
                                        </h3>
                                        <div className="border rounded-xl overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50 border-b">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left font-medium text-gray-600">Product</th>
                                                        <th className="px-4 py-3 text-center font-medium text-gray-600">Qty</th>
                                                        <th className="px-4 py-3 text-right font-medium text-gray-600">Unit Price</th>
                                                        <th className="px-4 py-3 text-right font-medium text-gray-600">Cost Price</th>
                                                        <th className="px-4 py-3 text-right font-medium text-gray-600">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {selectedOrder.items?.map((item, idx) => {
                                                        const itemProfit = item.subtotal - ((item.cost_price || 0) * item.quantity);
                                                        return (
                                                            <tr key={idx} className="hover:bg-gray-50/50">
                                                                <td className="px-4 py-3 font-medium">{item.product_name}</td>
                                                                <td className="px-4 py-3 text-center">{item.quantity}</td>
                                                                <td className="px-4 py-3 text-right">₹{item.unit_price}</td>
                                                                <td className="px-4 py-3 text-right text-blue-600">
                                                                    {item.cost_price ? `₹${item.cost_price}` : <span className="text-gray-300">—</span>}
                                                                </td>
                                                                <td className="px-4 py-3 text-right">
                                                                    <div>₹{item.subtotal}</div>
                                                                    {item.cost_price ? (
                                                                        <div className={`text-xs font-semibold ${itemProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                                                            {itemProfit >= 0 ? "+" : ""}₹{itemProfit.toFixed(0)} margin
                                                                        </div>
                                                                    ) : null}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                                <tfoot className="bg-gray-50 font-medium text-sm">
                                                    <tr>
                                                        <td colSpan={4} className="px-4 py-2 text-right text-gray-600">Subtotal</td>
                                                        <td className="px-4 py-2 text-right">₹{selectedOrder.total_amount}</td>
                                                    </tr>
                                                    {selectedOrder.discount > 0 && (
                                                        <tr>
                                                            <td colSpan={4} className="px-4 py-2 text-right text-green-600">Discount</td>
                                                            <td className="px-4 py-2 text-right text-green-600">-₹{selectedOrder.discount}</td>
                                                        </tr>
                                                    )}
                                                    <tr className="border-t-2 border-gray-200 text-base">
                                                        <td colSpan={4} className="px-4 py-3 text-right">
                                                            Total ({selectedOrder.payment_mode})
                                                            {selectedOrder.payment_status && (
                                                                <span className={`ml-2 text-xs px-2 py-0.5 rounded-full text-white inline-block ${selectedOrder.payment_status === "paid" ? "bg-green-600" : "bg-yellow-500"}`}>
                                                                    {selectedOrder.payment_status.toUpperCase()}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-bold text-green-700 text-lg">₹{selectedOrder.final_amount}</td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Profit Summary */}
                                    <div className={`rounded-xl p-5 border-2 ${selectedOrder.profit >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                                        <h3 className="font-semibold mb-4 flex items-center gap-2 text-sm">
                                            <TrendingUp className="w-4 h-4" /> Order Profit Analysis
                                        </h3>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
                                            {[
                                                { label: "Revenue", value: selectedOrder.final_amount, color: "text-green-700", bg: "bg-green-50" },
                                                { label: "Product Cost", value: selectedOrder.total_cost, color: "text-blue-700", bg: "bg-blue-50" },
                                                {
                                                    label: "Net Profit",
                                                    value: selectedOrder.profit,
                                                    color: selectedOrder.profit >= 0 ? "text-emerald-700 font-bold" : "text-red-700 font-bold",
                                                    bg: selectedOrder.profit >= 0 ? "bg-emerald-100" : "bg-red-100"
                                                },
                                            ].map((item) => (
                                                <div key={item.label} className={`${item.bg} rounded-lg p-3`}>
                                                    <div className="text-xs text-gray-500 mb-1">{item.label}</div>
                                                    <div className={`text-base ${item.color}`}>
                                                        {item.value >= 0 ? "" : "-"}₹{Math.abs(item.value).toLocaleString()}
                                                    </div>
                                                </div>
                                            ))}
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

            {/* Confirm with Discount Modal */}
            {showConfirmModal && selectedOrder && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
                        <div className="flex justify-between items-center">
                            <h2 className="text-lg font-bold text-gray-800">Confirm Order #{selectedOrder.id}</h2>
                            <button onClick={() => setShowConfirmModal(false)} className="p-1 hover:bg-gray-100 rounded">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-xl space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Customer</span>
                                <span className="font-medium">{selectedOrder.farmer_name || "Walk-in"}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Order Total</span>
                                <span className="font-medium">₹{selectedOrder.total_amount}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Items</span>
                                <span>{selectedOrder.items?.length || 0} products</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm font-semibold">Discount (₹) — Optional</Label>
                            <Input
                                type="number"
                                value={confirmDiscount}
                                onChange={e => setConfirmDiscount(Number(e.target.value))}
                                placeholder="0"
                                className="text-lg"
                            />
                            <p className="text-xs text-gray-400">Give a discount to the farmer before confirming</p>
                        </div>

                        <div className="bg-green-50 p-4 rounded-xl">
                            <div className="flex justify-between font-bold text-lg">
                                <span>Final Amount</span>
                                <span className="text-green-700">
                                    ₹{Math.max(0, selectedOrder.total_amount - confirmDiscount).toLocaleString()}
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => setShowConfirmModal(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                                onClick={handleConfirmWithDiscount}
                                disabled={confirming}
                            >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                {confirming ? "Confirming..." : "Confirm Order"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
