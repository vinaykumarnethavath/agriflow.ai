"use client";

import React, { useEffect, useState } from "react";
import { getMyProducts, Product } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Factory, AlertTriangle } from "lucide-react";

export default function InventoryPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchInventory = async () => {
            try {
                const data = await getMyProducts();
                setProducts(data);
            } catch (error) {
                console.error("Failed to fetch inventory:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchInventory();
    }, []);

    const rawMaterials = products.filter(p => p.category === 'raw_material');
    const finishedGoods = products.filter(p => p.category === 'processed');

    const InventoryTable = ({ data, type }: { data: Product[], type: string }) => (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-700 font-medium">
                    <tr>
                        <th className="px-6 py-3">Product Name</th>
                        <th className="px-6 py-3">Batch ID</th>
                        <th className="px-6 py-3">Stock Level</th>
                        <th className="px-6 py-3">Value (Cost/Price)</th>
                        <th className="px-6 py-3">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {data.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                No {type} inventory found.
                            </td>
                        </tr>
                    ) : (
                        data.map((p) => (
                            <tr key={p.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 font-medium text-gray-900">
                                    {p.name}
                                    <div className="text-xs text-gray-400">{p.brand}</div>
                                </td>
                                <td className="px-6 py-4 font-mono text-xs text-gray-500">{p.batch_number}</td>
                                <td className="px-6 py-4 font-bold">
                                    {p.quantity} <span className="text-gray-500 font-normal">{p.unit}</span>
                                </td>
                                <td className="px-6 py-4">
                                    {type === 'Raw Material' ? (
                                        <span className="text-gray-600">Cost: ₹{p.cost_price}</span>
                                    ) : (
                                        <span className="text-green-600">Sell: ₹{p.price}</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    {p.quantity < 10 ? (
                                        <span className="flex items-center text-red-600 text-xs font-bold">
                                            <AlertTriangle className="w-3 h-3 mr-1" /> Low Stock
                                        </span>
                                    ) : (
                                        <span className="text-green-600 text-xs bg-green-100 px-2 py-1 rounded-full">In Stock</span>
                                    )}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );

    if (loading) return <div className="p-8 text-center">Loading inventory...</div>;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Inventory Overview</h1>
                    <p className="text-gray-500">Track raw materials and finished goods</p>
                </div>
            </div>

            <Tabs defaultValue="raw" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="raw" className="flex items-center gap-2">
                        <Package className="w-4 h-4" /> Raw Materials
                    </TabsTrigger>
                    <TabsTrigger value="finished" className="flex items-center gap-2">
                        <Factory className="w-4 h-4" /> Finished Goods
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="raw">
                    <Card>
                        <CardHeader><CardTitle>Raw Material Stock</CardTitle></CardHeader>
                        <CardContent className="p-0">
                            <InventoryTable data={rawMaterials} type="Raw Material" />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="finished">
                    <Card>
                        <CardHeader><CardTitle>Finished Goods Stock</CardTitle></CardHeader>
                        <CardContent className="p-0">
                            <InventoryTable data={finishedGoods} type="Finished Goods" />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
