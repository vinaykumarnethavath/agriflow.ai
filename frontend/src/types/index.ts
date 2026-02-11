export enum UserRole {
    FARMER = "farmer",
    SHOP = "shop",
    MANUFACTURER = "manufacturer",
    CUSTOMER = "customer"
}

export interface User {
    id: number;
    email: string;
    full_name: string;
    role: UserRole;
}

export interface AuthResponse {
    access_token: string;
    token_type: string;
    role: UserRole;
}

export interface Crop {
    id: number;
    user_id: number;
    name: string;
    area: number;
    sowing_date: string;
    expected_harvest_date: string;
    status: string;
    notes?: string;
}

export interface Product {
    id: number;
    user_id: number;
    name: string;
    category: string;
    price: number;
    quantity: number;
    batch_number: string;
    description?: string;
    traceability_json: string;
}

export interface Order {
    id: number;
    buyer_id: number;
    seller_id: number;
    product_id: number;
    quantity: number;
    total_price: number;
    status: string;
    created_at: string;
}
