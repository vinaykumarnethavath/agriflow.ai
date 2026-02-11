"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PackageSearch, TrendingUp, Users, DollarSign, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { getShopAnalytics, getSalesTrend, getShopOrders, ShopAnalytics, SalesTrend, ShopOrder } from "@/lib/api";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function ShopDashboard() {
    const { user } = useAuth();
    const [analytics, setAnalytics] = useState<ShopAnalytics | null>(null);
    const [salesTrend, setSalesTrend] = useState<SalesTrend[]>([]);
    const [recentOrders, setRecentOrders] = useState<ShopOrder[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch data in parallel
                // Note: getShopOrders returns all orders, we slice top 5
                const [analyticsData, trendData, ordersData] = await Promise.all([
                    getShopAnalytics(),
                    getSalesTrend(7),
                    getShopOrders()
                ]);
                setAnalytics(analyticsData);
                setSalesTrend(trendData);
                setRecentOrders(ordersData.slice(0, 5));
            } catch (error) {
                console.error("Failed to fetch dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) {
        return <div className="p-8 text-center">Loading dashboard...</div>;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">Shop Dashboard - {user?.full_name}</h1>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue (Month)</CardTitle>
                        <DollarSign className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₹{analytics?.month_revenue.toLocaleString() || 0}</div>
                        <p className="text-xs text-muted-foreground">Today: ₹{analytics?.today_sales.toLocaleString() || 0}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Inventory</CardTitle>
                        <PackageSearch className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{analytics?.total_products || 0} Products</div>
                        <p className="text-xs text-muted-foreground">{analytics?.total_stock || 0} Total Units</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{analytics?.low_stock_count || 0}</div>
                        <p className="text-xs text-muted-foreground">Items below threshold</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                        <TrendingUp className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{recentOrders.length}</div> {/* Just recent count for now if API doesn't give total count separately, or use analytics data if added */}
                        <p className="text-xs text-muted-foreground">Recent activity</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sales Chart */}
                <Card className="col-span-2">
                    <CardHeader>
                        <CardTitle>Sales Trend (Last 7 Days)</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={salesTrend}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip formatter={(value) => [`₹${value}`, "Sales"]} />
                                <Line type="monotone" dataKey="sales" stroke="#16a34a" strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card>
                    <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Link href="/dashboard/shop/inventory/new">
                            <Button className="w-full bg-green-600 hover:bg-green-700">Add New Product</Button>
                        </Link>
                        <Link href="/dashboard/shop/inventory">
                            <Button variant="outline" className="w-full">Manage Stock</Button>
                        </Link>
                        <Link href="/dashboard/shop/orders">
                            <Button variant="outline" className="w-full">View All Orders</Button>
                        </Link>
                        <Link href="/dashboard/shop/customers">
                            <Button variant="outline" className="w-full">View Customers</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Orders Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Orders</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-700 font-medium">
                                <tr>
                                    <th className="px-4 py-3">Order ID</th>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {recentOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500">No recent orders found.</td>
                                    </tr>
                                ) : (
                                    recentOrders.map((order) => (
                                        <tr key={order.id}>
                                            <td className="px-4 py-3 font-medium">#{order.id}</td>
                                            <td className="px-4 py-3 text-gray-500">
                                                {new Date(order.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded-full text-xs ${order.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                        order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'
                                                    }`}>
                                                    {order.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium">₹{order.final_amount}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
