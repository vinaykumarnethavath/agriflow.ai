"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Plus, Trash2, Edit2, Filter } from "lucide-react";
import { useRouter } from 'next/navigation';
import { getAllFarmerExpenses, CropExpense } from '@/lib/api';

interface CropExpenseWithCrop extends CropExpense {
    crop_name: string;
}

export default function ExpensesPage() {
    const router = useRouter();
    const [expenses, setExpenses] = useState<CropExpenseWithCrop[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("All");

    useEffect(() => {
        fetchExpenses();
    }, []);

    const fetchExpenses = async () => {
        try {
            setLoading(true);
            const data = await getAllFarmerExpenses();
            setExpenses(data);
        } catch (err) {
            setError("Failed to load expenses");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const filteredExpenses = expenses.filter(expense => {
        const matchesSearch =
            expense.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
            expense.crop_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (expense.notes && expense.notes.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesCategory = categoryFilter === "All" || expense.category === categoryFilter;

        return matchesSearch && matchesCategory;
    });

    const totalCost = filteredExpenses.reduce((sum, expense) => sum + expense.total_cost, 0);

    if (loading) return <div className="flex justify-center items-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-green-600" /></div>;

    return (
        <div className="container mx-auto p-4 max-w-6xl">
            <div className="flex items-center mb-6">
                <Button variant="ghost" onClick={() => router.back()} className="mr-4">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <h1 className="text-2xl font-bold text-gray-800">All Expenses</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Total Expenses Logged</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{expenses.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Total Cost (Filtered)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">₹ {totalCost.toLocaleString()}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <CardTitle>Expense Log</CardTitle>
                        <div className="flex gap-2 w-full md:w-auto">
                            <input
                                type="text"
                                placeholder="Search expenses..."
                                className="border rounded-md px-3 py-2 text-sm w-full md:w-64"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <select
                                className="border rounded-md px-3 py-2 text-sm"
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                            >
                                <option value="All">All Categories</option>
                                <option value="Input">Input</option>
                                <option value="Labor">Labor</option>
                                <option value="Machinery">Machinery</option>
                                <option value="Irrigation">Irrigation</option>
                                <option value="Logistics">Logistics</option>
                                <option value="Miscellaneous">Miscellaneous</option>
                            </select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="text-left p-4 font-medium text-gray-600">Date</th>
                                    <th className="text-left p-4 font-medium text-gray-600">Crop</th>
                                    <th className="text-left p-4 font-medium text-gray-600">Category</th>
                                    <th className="text-left p-4 font-medium text-gray-600">Details</th>
                                    <th className="text-right p-4 font-medium text-gray-600">Cost</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredExpenses.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-gray-500">No expenses found.</td>
                                    </tr>
                                ) : (
                                    filteredExpenses.map(expense => (
                                        <tr key={expense.id} className="border-b last:border-0 hover:bg-gray-50">
                                            <td className="p-4 whitespace-nowrap text-sm text-gray-600">
                                                {new Date(expense.date).toLocaleDateString()}
                                            </td>
                                            <td className="p-4 font-medium text-gray-800">
                                                {expense.crop_name}
                                            </td>
                                            <td className="p-4">
                                                <span className="px-2 py-1 rounded-md bg-gray-100 text-xs font-medium text-gray-700">
                                                    {expense.category}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="font-bold text-teal-900 text-base mb-1">
                                                    {expense.type} {expense.unit === 'bags' && '(Bags)'}
                                                </div>
                                                {expense.unit === 'bags' ? (
                                                    <div className="text-sm">
                                                        <div className="text-teal-700 font-medium whitespace-nowrap">
                                                            {expense.quantity} Bags * {expense.unit_size || '?'} kg/bag * ₹{expense.unit_cost}/bag
                                                        </div>
                                                        <div className="text-emerald-600 mt-1 font-semibold text-xs">
                                                            Total Qty: {expense.quantity * (expense.unit_size || 0)} kg
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-gray-500">
                                                        {expense.quantity} {expense.unit} @ ₹{expense.unit_cost}/{expense.unit}
                                                    </div>
                                                )}
                                                {expense.notes && (
                                                    <div className="text-xs text-gray-400 mt-1 italic max-w-xs truncate">
                                                        {expense.notes}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4 text-right font-bold text-red-600">
                                                ₹ {expense.total_cost.toLocaleString()}
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
