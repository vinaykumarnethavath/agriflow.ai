"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { createPurchase, getPurchases, ManufacturerPurchase } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Truck, Plus, History } from "lucide-react";
import { Modal } from "@/components/ui/modal";

export default function PurchasesPage() {
    const [purchases, setPurchases] = useState<ManufacturerPurchase[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<ManufacturerPurchase>();

    // Watch for total calculation
    const qty = watch("quantity");
    const price = watch("price_per_unit");
    const transport = watch("transport_cost");

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const data = await getPurchases();
            setPurchases(data);
        } catch (error) {
            console.error("Failed to fetch purchases:", error);
        } finally {
            setLoading(false);
        }
    };

    const onSubmit = async (data: any) => {
        try {
            await createPurchase({
                ...data,
                quantity: parseFloat(data.quantity),
                price_per_unit: parseFloat(data.price_per_unit),
                transport_cost: parseFloat(data.transport_cost || 0),
                farmer_id: data.farmer_id ? parseInt(data.farmer_id) : undefined
            });
            fetchData();
            setIsModalOpen(false);
            reset();
        } catch (error) {
            console.error("Failed to create purchase:", error);
            alert("Failed to record purchase.");
        }
    };

    const calculateTotal = () => {
        const q = parseFloat(qty as any) || 0;
        const p = parseFloat(price as any) || 0;
        const t = parseFloat(transport as any) || 0;
        return (q * p) + t;
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Raw Material Purchases</h1>
                    <p className="text-gray-500">Record crops bought from farmers</p>
                </div>
                <Button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" /> New Purchase
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <History className="w-5 h-5" /> Purchase History
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-700 font-medium border-b">
                                <tr>
                                    <th className="px-6 py-4">Batch ID</th>
                                    <th className="px-6 py-4">Farmer</th>
                                    <th className="px-6 py-4">Crop</th>
                                    <th className="px-6 py-4 text-right">Qty</th>
                                    <th className="px-6 py-4 text-right">Price/Unit</th>
                                    <th className="px-6 py-4 text-right">Total Cost</th>
                                    <th className="px-6 py-4">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {purchases.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                                            No purchases recorded yet.
                                        </td>
                                    </tr>
                                ) : (
                                    purchases.map((p) => (
                                        <tr key={p.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 font-mono text-xs">{p.batch_id}</td>
                                            <td className="px-6 py-4 font-medium">{p.farmer_name}</td>
                                            <td className="px-6 py-4">{p.crop_name}</td>
                                            <td className="px-6 py-4 text-right">{p.quantity} {p.unit}</td>
                                            <td className="px-6 py-4 text-right">₹{p.price_per_unit}</td>
                                            <td className="px-6 py-4 text-right font-bold text-gray-900">₹{p.total_cost.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-gray-500">{new Date(p.date).toLocaleDateString()}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Record New Purchase">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Farmer Name</Label>
                            <Input {...register("farmer_name", { required: true })} placeholder="Ram Lal" />
                        </div>
                        <div className="space-y-2">
                            <Label>Farmer ID (Optional)</Label>
                            <Input type="number" {...register("farmer_id")} placeholder="Registered ID" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Crop Name</Label>
                            <Input {...register("crop_name", { required: true })} placeholder="Wheat" />
                        </div>
                        <div className="space-y-2">
                            <Label>Quality Grade</Label>
                            <select {...register("quality_grade")} className="w-full p-2 border rounded-md">
                                <option value="A">Grade A (Premium)</option>
                                <option value="B">Grade B (Standard)</option>
                                <option value="C">Grade C (Low)</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Quantity</Label>
                            <Input type="number" step="0.01" {...register("quantity", { required: true })} placeholder="100" />
                        </div>
                        <div className="space-y-2">
                            <Label>Unit</Label>
                            <select {...register("unit")} className="w-full p-2 border rounded-md">
                                <option value="kg">kg</option>
                                <option value="tons">tons</option>
                                <option value="quintal">quintal</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Price per Unit</Label>
                            <Input type="number" step="0.01" {...register("price_per_unit", { required: true })} placeholder="20" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Transport Cost (₹)</Label>
                        <Input type="number" step="0.01" {...register("transport_cost")} placeholder="500" />
                    </div>

                    <div className="bg-gray-100 p-4 rounded-lg flex justify-between items-center">
                        <span className="font-semibold text-gray-700">Total Purchase Cost:</span>
                        <span className="text-xl font-bold text-blue-700">₹{calculateTotal().toLocaleString()}</span>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Confirm Purchase</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
