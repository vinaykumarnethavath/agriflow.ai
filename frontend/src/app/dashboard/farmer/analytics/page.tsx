"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from "recharts";
import { Brain, TrendingUp, IndianRupee, Sprout, AlertCircle, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

interface ExpenseData {
    category: string;
    amount: number;
}

interface TrendData {
    crop: string;
    price: number;
    unit: string;
    change: number;
    trend: "up" | "down" | "stable";
}

interface Recommendation {
    name: string;
    reason: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function AnalyticsPage() {
    const [expenses, setExpenses] = useState<ExpenseData[]>([]);
    const [trends, setTrends] = useState<TrendData[]>([]);
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [expRes, trendRes, recRes] = await Promise.all([
                    api.get("/analytics/expenses"),
                    api.get("/analytics/market-trends"),
                    api.get("/analytics/recommendations")
                ]);
                setExpenses(expRes.data);
                setTrends(trendRes.data);
                setRecommendations(recRes.data);
            } catch (error) {
                console.error("Failed to fetch analytics:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return <div className="p-8 text-center">Loading insights...</div>;
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-indigo-100 rounded-full">
                    <Brain className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Analytics & Insights</h1>
                    <p className="text-gray-500">AI-driven recommendations and financial overview</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Expense Analysis */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <IndianRupee className="h-5 w-5 text-gray-500" /> Expense Distribution
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {expenses.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={expenses}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                        outerRadius={100}
                                        fill="#8884d8"
                                        dataKey="amount"
                                    >
                                        {expenses.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip formatter={(value) => `₹${value}`} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <AlertCircle className="h-8 w-8 mb-2" />
                                <p>No expense data available yet.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Market Trends */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-gray-500" /> Current Market Prices
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={trends}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="crop" />
                                <YAxis />
                                <RechartsTooltip formatter={(value) => `₹${value}/q`} />
                                <Legend />
                                <Bar dataKey="price" name="Price (₹/quintal)" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* AI Recommendations */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-3">
                    <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Sprout className="h-5 w-5 text-green-600" /> Recommended Crops for this Season
                    </h2>
                </div>
                {recommendations.map((rec, index) => (
                    <Card key={index} className="bg-gradient-to-br from-green-50 to-white border-green-100 hover:shadow-md transition-shadow">
                        <CardContent className="p-6">
                            <h3 className="font-bold text-lg text-green-800 mb-2">{rec.name}</h3>
                            <p className="text-green-700 text-sm">{rec.reason}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Market Trends Details Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Market Trend Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b text-left text-sm text-gray-500">
                                    <th className="pb-3 px-4">Crop</th>
                                    <th className="pb-3 px-4">Current Price</th>
                                    <th className="pb-3 px-4">Change (24h)</th>
                                    <th className="pb-3 px-4">Trend</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {trends.map((item, i) => (
                                    <tr key={i} className="text-sm">
                                        <td className="py-3 px-4 font-medium">{item.crop}</td>
                                        <td className="py-3 px-4">₹{item.price}/{item.unit}</td>
                                        <td className={`py-3 px-4 ${item.change > 0 ? 'text-green-600' : item.change < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                            {item.change > 0 ? '+' : ''}{item.change}%
                                        </td>
                                        <td className="py-3 px-4">
                                            {item.trend === 'up' && <span className="flex items-center text-green-600 gap-1"><ArrowUpRight className="h-4 w-4" /> Up</span>}
                                            {item.trend === 'down' && <span className="flex items-center text-red-600 gap-1"><ArrowDownRight className="h-4 w-4" /> Down</span>}
                                            {item.trend === 'stable' && <span className="flex items-center text-gray-500 gap-1"><Minus className="h-4 w-4" /> Stable</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
