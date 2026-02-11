"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { UserRole } from "@/types";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    Sprout,
    ShoppingBag,
    Factory,
    LineChart,
    LogOut,
    ShoppingCart,
    Sun,
    PackageSearch,
    Box,
    Store,
    TrendingUp,
    User
} from "lucide-react";
import { Button } from "../ui/button";

const Sidebar = () => {
    const { user, logout } = useAuth();
    const pathname = usePathname();

    const getNavItems = () => {
        if (!user) return [];

        switch (user.role) {
            case UserRole.FARMER:
                return [
                    { name: "Dashboard", href: "/dashboard/farmer", icon: LayoutDashboard },
                    { name: "My Crops", href: "/dashboard/farmer/crops", icon: Sprout },
                    { name: "Buy Fertilizers", href: "/dashboard/farmer/market", icon: ShoppingBag },
                    { name: "Market Prices", href: "/dashboard/farmer/market-prices", icon: TrendingUp },
                    { name: "Weather", href: "/dashboard/farmer/weather", icon: Sun },
                    { name: "Farmer News", href: "/dashboard/farmer/news", icon: PackageSearch },
                    { name: "Profile", href: "/dashboard/farmer/profile", icon: User },
                ];
            case UserRole.SHOP:
                return [
                    { name: "Dashboard", href: "/dashboard/shop", icon: LayoutDashboard },
                    { name: "Inventory", href: "/dashboard/shop/inventory", icon: PackageSearch },
                    { name: "Orders", href: "/dashboard/shop/orders", icon: Box },
                ];
            case UserRole.MANUFACTURER:
                return [
                    { name: "Dashboard", href: "/dashboard/manufacturer", icon: LayoutDashboard },
                    { name: "Purchases", href: "/dashboard/manufacturer/purchases", icon: ShoppingBag },
                    { name: "Production", href: "/dashboard/manufacturer/production", icon: Factory },
                    { name: "Inventory", href: "/dashboard/manufacturer/inventory", icon: Box },
                    { name: "Sales", href: "/dashboard/manufacturer/sales", icon: LineChart },
                ];
            case UserRole.CUSTOMER:
                return [
                    { name: "Home", href: "/dashboard/customer", icon: LayoutDashboard },
                    { name: "Marketplace", href: "/dashboard/customer/marketplace", icon: Store },
                    { name: "Cart", href: "/dashboard/customer/cart", icon: ShoppingCart },
                    { name: "Orders", href: "/dashboard/customer/orders", icon: ShoppingBag },
                ];
            default:
                return [];
        }
    };

    const navItems = getNavItems();

    return (
        <div className="h-screen w-64 bg-green-900 text-white flex flex-col p-4 fixed left-0 top-0">
            <div className="mb-8">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Sprout className="h-8 w-8 text-green-400" />
                    AgriChain
                </h1>
                <p className="text-xs text-green-300 mt-1">Supply Chain Platform</p>
            </div>

            <nav className="flex-1 space-y-2">
                {navItems.map((item) => (
                    <Link key={item.href} href={item.href}>
                        <div className={cn(
                            "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors hover:bg-green-800",
                            pathname === item.href ? "bg-green-700 text-white" : "text-green-100"
                        )}>
                            <item.icon className="h-5 w-5" />
                            <span>{item.name}</span>
                        </div>
                    </Link>
                ))}
            </nav>

            <div className="pt-4 border-t border-green-800">
                <div className="mb-4 px-2">
                    <p className="font-semibold">{user?.full_name}</p>
                    <p className="text-xs text-green-300 capitalize">{user?.role}</p>
                </div>
                <Button
                    variant="ghost"
                    className="w-full justify-start text-red-300 hover:text-red-100 hover:bg-red-900/20"
                    onClick={logout}
                >
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                </Button>
            </div>
        </div>
    );
};

export default Sidebar;
