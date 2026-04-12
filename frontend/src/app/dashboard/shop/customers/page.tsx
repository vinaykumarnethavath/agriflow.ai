"use client";

import { useEffect, useState } from "react";
import { getShopCustomers, ShopCustomer } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, IndianRupee, Calendar } from "lucide-react";

export default function ShopCustomersPage() {
    const [customers, setCustomers] = useState<ShopCustomer[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCustomers();

        // Poll every 15 seconds for real-time updates
        const interval = setInterval(() => {
            fetchCustomers();
        }, 15000);

        return () => clearInterval(interval);
    }, []);

    const fetchCustomers = async () => {
        try {
            const data = await getShopCustomers();
            setCustomers(data);
        } catch (error) {
            console.error("Failed to fetch customers:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center bg-gray-50 h-full">Loading customers...</div>;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">My Customers</h1>
                    <p className="text-gray-500">Farmers who have purchased from your shop</p>
                </div>
                <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-100">
                    <span className="font-bold text-lg text-gray-800">{customers.length}</span>
                    <span className="text-gray-500 text-sm ml-2">Total Farmers</span>
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-700 font-medium border-b">
                                <tr>
                                    <th className="px-6 py-4">Farmer Name</th>
                                    <th className="px-6 py-4 text-center">Total Orders</th>
                                    <th className="px-6 py-4 text-right">Total Spent</th>
                                    <th className="px-6 py-4 text-right">Last Purchase</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {customers.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                            <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                            <p className="text-lg font-medium">No customers yet</p>
                                            <p className="text-sm">Farmers will appear here after their first purchase.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    customers.map((customer) => (
                                        <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold">
                                                        {customer.full_name.charAt(0)}
                                                    </div>
                                                    <span className="font-medium text-gray-900">{customer.full_name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="bg-gray-100 px-2 py-1 rounded-md text-xs font-medium text-gray-600">
                                                    {customer.total_orders} Orders
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1 font-medium text-gray-900">
                                                    <IndianRupee className="w-3 h-3 text-gray-400" />
                                                    {customer.total_spent.toLocaleString()}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right text-gray-500">
                                                <div className="flex items-center justify-end gap-2">
                                                    {new Date(customer.last_order_date).toLocaleDateString()}
                                                    <Calendar className="w-3 h-3 text-gray-300" />
                                                </div>
                                            </td>
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
