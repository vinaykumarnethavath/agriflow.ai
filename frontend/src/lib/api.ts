import axios from 'axios';

const API_URL = 'http://localhost:8000';
console.log("API Client initialized with baseURL:", API_URL);

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        const requestUrl = String(error.config?.url || '');
        const isAuthRequest = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/forgot-password') || requestUrl.includes('/auth/verify-otp') || requestUrl.includes('/auth/reset-password');
        if (error.response?.status === 401 && typeof window !== 'undefined' && !isAuthRequest) {
            // Token expired or invalid
            console.warn("Authentication error, redirecting to login");
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export interface Crop {
    id: number;
    user_id: number;
    name: string;
    area: number;
    season?: string;
    variety?: string;
    sowing_date: string;
    expected_harvest_date?: string;
    status: string;
    notes?: string;
    total_cost?: number;
    total_revenue?: number;
    actual_yield?: number;
    selling_price_per_unit?: number;
    net_profit?: number;
    actual_harvest_date?: string;
}

export interface CropUpdate {
    name?: string;
    area?: number;
    season?: string;
    variety?: string;
    sowing_date?: string;
    expected_harvest_date?: string;
    status?: string;
    notes?: string;
}

export interface CropExpense {
    id: number;
    crop_id: number;
    category: string;
    type: string;
    quantity: number;
    unit: string;
    unit_cost: number;
    total_cost: number;
    date: string;
    payment_mode: string;
    unit_size?: number;
    duration?: number;
    stage?: string;
    bill_url?: string;
    notes?: string;
}

export interface CropHarvest {
    id: number;
    crop_id: number;
    date: string;
    stage: string;
    quantity: number;     // stored in quintals
    unit: string;
    unit_size?: number;   // bag size in kg (used during recording)
    quality: string;
    selling_price_per_unit: number;
    total_revenue: number;
    buyer_type?: string;
    sold_to?: string;
    notes?: string;
    status?: string;
}

export interface CropSale {
    id: number;
    crop_id: number;
    date: string;
    buyer_type: string;
    buyer_name: string;
    buyer_id?: string;
    quantity_quintals: number;
    total_bags: number;
    bag_size: number;
    price_per_quintal: number;
    total_revenue: number;
    payment_mode: string;
    notes?: string;
    status: string;
    harvest_ids?: number[];
}

export const getCropExpenses = async (cropId: number) => {
    const response = await api.get<CropExpense[]>(`/farmer/crops/${cropId}/expenses`);
    return response.data;
};

export const getAllFarmerExpenses = async () => {
    const response = await api.get<(CropExpense & { crop_name: string })[]>("/farmer/expenses");
    return response.data;
};

export const createCropExpense = async (cropId: number, expense: Partial<CropExpense>) => {
    const response = await api.post<CropExpense>(`/farmer/crops/${cropId}/expenses`, expense);
    return response.data;
};



export const updateCropExpense = async (expenseId: number, expense: Partial<CropExpense>) => {
    const response = await api.put<CropExpense>(`/farmer/crops/expenses/${expenseId}`, expense);
    return response.data;
};

export const deleteCropExpense = async (expenseId: number) => {
    const response = await api.delete(`/farmer/crops/expenses/${expenseId}`);
    return response.data;
};

export const getCropHarvests = async (cropId: number) => {
    const response = await api.get<CropHarvest[]>(`/farmer/crops/${cropId}/harvests`);
    return response.data;
};

export const createCropHarvest = async (cropId: number, harvest: Partial<CropHarvest>) => {
    const response = await api.post<CropHarvest>(`/farmer/crops/${cropId}/harvests`, harvest);
    return response.data;
};

export const updateCropHarvest = async (harvestId: number, harvest: Partial<CropHarvest>) => {
    const response = await api.put<CropHarvest>(`/farmer/crops/harvests/${harvestId}`, harvest);
    return response.data;
};

export const deleteCropHarvest = async (harvestId: number) => {
    const response = await api.delete(`/farmer/crops/harvests/${harvestId}`);
    return response.data;
};

export const getCropSales = async (cropId: number) => {
    const response = await api.get<CropSale[]>(`/farmer/crops/${cropId}/sales`);
    return response.data;
};

export const createCropSale = async (cropId: number, sale: Partial<CropSale>) => {
    const response = await api.post<CropSale>(`/farmer/crops/${cropId}/sales`, sale);
    return response.data;
};

export const deleteCropSale = async (saleId: number) => {
    const response = await api.delete(`/farmer/crops/sales/${saleId}`);
    return response.data;
};

export interface Insight {
    type: "info" | "warning" | "alert" | "success";
    category: string;
    message: string;
    action: string;
}

export interface Prediction {
    predicted_profit: number;
    estimated_revenue: number;
    estimated_cost: number;
    confidence: string;
    message: string;
}

export interface CropRecommendation {
    name: string;
    reason: string;
}

export interface MarketTrend {
    crop: string;
    price: number;
    unit: string;
    change: number;
    trend: "up" | "down" | "stable";
}

export const updateCrop = async (id: number, cropData: CropUpdate) => {
    const response = await api.put<Crop>(`/crops/${id}`, cropData);
    return response.data;
};

export const getCropDetails = async (id: number) => {
    const response = await api.get<Crop>(`/crops/${id}`);
    return response.data;
};

// Duplicates removed.
export const getCropInsights = async (cropId: number) => {
    const response = await api.get<{ insights: Insight[], prediction: Prediction }>(`/analytics/crop/${cropId}/insights`);
    return response.data;
};

export const getRecommendations = async () => {
    const response = await api.get<CropRecommendation[]>("/analytics/recommendations");
    return response.data;
};

export const getMarketTrends = async () => {
    const response = await api.get<MarketTrend[]>("/analytics/market-trends");
    return response.data;
};


// Shop & Product Interfaces
export interface Product {
    id: number;
    name: string;
    short_name?: string;
    category: string;
    brand?: string;
    manufacturer?: string;
    price: number;
    cost_price?: number;
    quantity: number;
    unit: string;
    measure_unit?: string;
    quantity_per_unit?: number;
    batch_number: string;
    description?: string;
    main_composition?: string;
    manufacture_date?: string;
    image_url?: string;
    product_image_url?: string;
    low_stock_threshold?: number;
    user_id: number;
    traceability_json?: string;
    expiry_date?: string;
    apportioned_transport?: number;
    apportioned_labour?: number;
    apportioned_other?: number;
    status?: 'draft' | 'active';
    created_at?: string;
}

export interface ShopOrderItem {
    id: number;
    product_id: number;
    product_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
}

export interface ShopOrder {
    id: number;
    shop_id: number;
    farmer_id?: number;
    farmer_name?: string;
    total_amount: number;
    discount: number;
    final_amount: number;
    payment_mode: string;
    payment_status?: string;
    payment_id?: string;
    status: string;
    created_at: string;
    items?: ShopOrderItem[];
    total_expenses?: number;
    total_cost?: number;
    profit?: number;
}

export interface ShopOrderStatusUpdate {
    status?: string;
    payment_status?: string;
    discount?: number;
    expense_transportation?: number;
    expense_labour?: number;
    expense_other?: number;
    expense_notes?: string;
}

export interface ShopAnalytics {
  total_products: number;
  total_stock: number;
  today_sales: number;
  month_revenue: number;
  low_stock_count: number;
  pending_orders: number;
}

// Revenue report interface (from /analytics/shop/revenue)
export interface RevenueReport {
  total_revenue: number;
  total_cost: number;
  total_expenses: number;
  profit: number;
  total_orders: number;
  completed_orders: number;
  pending_orders: number;
  avg_ticket: number;
}

export const getShopRevenue = async (period?: string) => {
  const url = period ? `/analytics/shop/revenue?period=${period}` : "/analytics/shop/revenue";
  const response = await api.get<RevenueReport>(url);
  return response.data;
};

export interface CategoryRevenue {
  category: string;
  revenue: number;
  qty_sold: number;
  profit: number;
}

export const getCategoryRevenue = async (period?: string) => {
  const url = period ? `/analytics/shop/category-revenue?period=${period}` : "/analytics/shop/category-revenue";
  const response = await api.get<CategoryRevenue[]>(url);
  return response.data;
};

export interface ShopOrderDetailed {
  id: number;
  shop_id: number;
  farmer_id?: number;
  farmer_name?: string;
  total_amount: number;
  discount: number;
  final_amount: number;
  payment_mode: string;
  payment_status?: string;
  status: string;
  created_at: string;
  total_cost: number;
  total_expenses: number;
  profit: number;
  expense: {
    transportation: number;
    labour: number;
    other: number;
    notes?: string;
    total: number;
  } | null;
  items: {
    id: number;
    product_id: number;
    product_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    cost_price: number;
  }[];
}

export const getShopOrdersDetailed = async () => {
  const response = await api.get<ShopOrderDetailed[]>("/orders/shop-orders-detailed");
  return response.data;
};

export interface SalesTrend {
    date: string;
    sales: number;
    order_count: number;
}

// Shop API
export const getMyProducts = async () => {
    const response = await api.get<Product[]>("/products/my/all");
    return response.data;
}

export const updateProduct = async (id: number, data: Partial<Product>) => {
    const response = await api.put<Product>(`/products/${id}`, data);
    return response.data;
}

export const deleteProduct = async (id: number) => {
    const response = await api.delete(`/products/${id}`);
    return response.data;
}

export const markProductStatus = async (id: number, status: 'draft' | 'active') => {
    const response = await api.patch(`/products/${id}/status`, { status });
    return response.data;
}

export interface ProductBatchReceiveInfo {
    name: string;
    category: string;
    brand?: string;
    batch_number: string;
    cost_price: number;
    selling_price: number;
    quantity: number;
    unit?: string;
    description?: string;
    manufacture_date?: string;
    expiry_date?: string;
}

export interface BulkProductReceive {
    items: ProductBatchReceiveInfo[];
    total_transport_cost: number;
    total_labour_cost: number;
    total_other_cost: number;
    expense_notes?: string;
}

export const bulkReceiveStock = async (data: BulkProductReceive) => {
    const response = await api.post("/products/bulk-receive", data);
    return response.data;
}

export interface DraftBatch {
    id: number;
    name: string;
    batch_number: string;
    cost_price: number;
    quantity: number;
    unit: string;
    total_value: number;
    category: string;
    created_at: string;
    apportioned_transport: number;
    apportioned_labour: number;
    apportioned_other: number;
}

export const getDraftBatches = async (): Promise<DraftBatch[]> => {
    const response = await api.get<DraftBatch[]>('/shop-accounting/draft-batches');
    return response.data;
}

export const getShopOrders = async () => {
    const response = await api.get<ShopOrder[]>("/orders/shop-orders");
    return response.data;
}

export const updateOrderStatus = async (id: number, updateData: ShopOrderStatusUpdate) => {
    const response = await api.put<ShopOrder>(`/orders/${id}/status`, updateData);
    return response.data;
}

export const createManualOrder = async (orderData: {
    items: { product_id: number, quantity: number }[],
    farmer_id?: number,
    discount?: number,
    payment_mode?: string,
    expense_transportation?: number,
    expense_labour?: number,
    expense_other?: number,
    expense_notes?: string
}) => {
    const response = await api.post<ShopOrder>("/orders/", orderData);
    return response.data;
}

export const getShopAnalytics = async () => {
    const response = await api.get<ShopAnalytics>("/analytics/shop/overview");
    return response.data;
}

export const getSalesTrend = async (period = "7d") => {
    const response = await api.get<SalesTrend[]>("/analytics/shop/sales-trend", { params: { period } });
    return response.data;
}

export interface TopProduct {
    product_id: number;
    product_name: string;
    category: string;
    batch_number?: string;
    batch_id?: number;
    units_sold: number;
    revenue: number;
    cost_price?: number;
    total_cost?: number;
    overhead?: number;
    profit: number;
    remaining_qty?: number;
}

export interface ChannelBreakdown {
    channel: string;
    orders: number;
    revenue: number;
    average_order_value: number;
}

export interface OrderHealthMetric {
    status: string;
    count: number;
    percentage: number;
}

export const getTopProducts = async (period = "30d") => {
    const response = await api.get<TopProduct[]>("/analytics/shop/top-products", { params: { period } });
    return response.data;
};

export const getChannelBreakdown = async (period = "30d") => {
    const response = await api.get<ChannelBreakdown[]>("/analytics/shop/channel-breakdown", { params: { period } });
    return response.data;
};

export const getOrderHealth = async (period = "30d") => {
    const response = await api.get<OrderHealthMetric[]>("/analytics/shop/order-health", { params: { period } });
    return response.data;
};

export interface ShopCustomer {
    id: number;
    name: string;
    full_name: string;
    total_orders: number;
    total_spent: number;
    last_order_date: string;
}

export const getShopCustomers = async () => {
    const response = await api.get<ShopCustomer[]>("/analytics/shop/customers");
    return response.data;
}


// Manufacturer Interfaces
export interface ManufacturerStats {
    raw_stock: number;
    finished_stock: number;
    today_purchases: number;
    today_sales: number;
    month_revenue: number;
    month_purchases: number;
    net_profit: number;
    total_batches: number;
    avg_efficiency: number;
}

export interface MillAccountingSummary {
    period: string;
    total_revenue: number;
    total_purchase_cost: number;
    total_processing_cost: number;
    total_expenses: number;
    net_profit: number;
    total_sales_count: number;
    avg_sale_value: number;
    expense_by_category: Record<string, number>;
}

export interface MillExpense {
    id: number;
    manufacturer_id: number;
    category: string;
    amount: number;
    description: string | null;
    expense_date: string;
    created_at: string;
}

export interface ManufacturerPurchase {
    id: number;
    manufacturer_id: number;
    farmer_id?: number;
    farmer_name: string;
    crop_name: string;
    quantity: number;
    unit: string;
    price_per_unit: number;
    total_cost: number;
    transport_cost: number;
    quality_grade?: string;
    batch_id: string;
    date: string;
}

export interface ManufacturerSale {
    id: number;
    manufacturer_id: number;
    buyer_type: string;
    buyer_id?: number;
    buyer_name: string;
    product_id: number;
    quantity: number;
    selling_price: number;
    discount: number;
    total_amount: number;
    payment_mode: string;
    invoice_id: string;
    delivery_status: string;
    date: string;
}

export interface ProductionBatch {
    id: number;
    manufacturer_id: number;
    input_product_id: number;
    input_qty: number;
    output_product_name: string;
    output_qty: number;
    output_unit: string;
    processing_cost: number;
    waste_qty: number;
    efficiency: number;
    batch_number: string;
    date: string;
}

// Manufacturer API Functions
export const getManufacturerStats = async () => {
    const response = await api.get<ManufacturerStats>("/manufacturer/stats");
    return response.data;
}

export const createPurchase = async (data: Omit<ManufacturerPurchase, "id" | "manufacturer_id" | "batch_id" | "date">) => {
    const response = await api.post<ManufacturerPurchase>("/manufacturer/purchases", data);
    return response.data;
}

export const getPurchases = async () => {
    const response = await api.get<ManufacturerPurchase[]>("/manufacturer/purchases");
    return response.data;
}

export const createProductionBatch = async (data: any) => {
    const response = await api.post<ProductionBatch>("/manufacturer/production", data);
    return response.data;
}

export const getProductionHistory = async () => {
    const response = await api.get<ProductionBatch[]>("/manufacturer/production");
    return response.data;
}

export const createManufacturerSale = async (data: any) => {
    const response = await api.post<ManufacturerSale>("/manufacturer/sales", data);
    return response.data;
}

export const getManufacturerSales = async () => {
    const response = await api.get<ManufacturerSale[]>("/manufacturer/sales");
    return response.data;
}

export const getMillSalesTrend = async (period = "7d") => {
    const response = await api.get<{ date: string; sales: number }[]>("/manufacturer/sales-trend", { params: { period } });
    return response.data;
}

export const updateSaleDeliveryStatus = async (saleId: number, delivery_status: string) => {
    const response = await api.patch<ManufacturerSale>(`/manufacturer/sales/${saleId}/status`, { delivery_status });
    return response.data;
}

export const getMillAccountingSummary = async (period = "30d") => {
    const response = await api.get<MillAccountingSummary>(`/manufacturer/accounting/summary`, { params: { period } });
    return response.data;
}

export const getMillExpenses = async (period = "30d") => {
    const response = await api.get<MillExpense[]>(`/manufacturer/accounting/expenses`, { params: { period } });
    return response.data;
}

export const addMillExpense = async (data: { category: string; amount: number; description?: string; expense_date?: string }) => {
    const response = await api.post<MillExpense>("/manufacturer/accounting/expenses", data);
    return response.data;
}

export const deleteMillExpense = async (id: number) => {
    const response = await api.delete(`/manufacturer/accounting/expenses/${id}`);
    return response.data;
}

export interface MillTopCrop {
    crop_name: string;
    total_cost: number;
    total_qty: number;
    count: number;
}

export interface MillTopProduct {
    product_id: number;
    product_name: string;
    revenue: number;
    units_sold: number;
    count: number;
}

export interface MillAnalytics {
    period: string;
    total_revenue: number;
    total_purchase_cost: number;
    total_processing_cost: number;
    total_expenses: number;
    net_profit: number;
    profit_margin: number;
    total_sales_count: number;
    avg_sale_value: number;
    avg_efficiency: number;
    top_crops: MillTopCrop[];
    top_products: MillTopProduct[];
}

export const getMillAnalytics = async (period = "30d") => {
    const response = await api.get<MillAnalytics>("/manufacturer/analytics", { params: { period } });
    return response.data;
}

// Customer Interfaces
export interface CartItem {
    id: number;
    product_id: number;
    product_name: string;
    price: number;
    quantity: number;
    image_url?: string;
    seller_name: string;
}

export interface CustomerOrderItem {
    product_name: string;
    quantity: number;
    price: number;
    seller_id: number;
}

export interface CustomerOrder {
    id: number;
    total_amount: number;
    status: string;
    created_at: string;
    items: CustomerOrderItem[];
}

// Customer API
export const getMarketplaceProducts = async (category?: string, search?: string) => {
    const params = { category, search };
    const response = await api.get<Product[]>("/customer/marketplace", { params });
    return response.data;
}

export const getProductDetails = async (id: number) => {
    const response = await api.get<Product>(`/customer/products/${id}`);
    return response.data;
}

export const getCart = async () => {
    const response = await api.get<CartItem[]>("/customer/cart");
    return response.data;
}

export const addToCart = async (productId: number, quantity: number) => {
    const response = await api.post("/customer/cart", { product_id: productId, quantity });
    return response.data;
}

export const removeFromCart = async (itemId: number) => {
    const response = await api.delete(`/customer/cart/${itemId}`);
    return response.data;
}

export const checkout = async () => {
    const response = await api.post<CustomerOrder>("/customer/checkout");
    return response.data;
}

export const getMyOrders = async () => {
    const response = await api.get<CustomerOrder[]>("/customer/orders");
    return response.data;
}

// --- Weather & Analytics ---

// --- Info Module ---

export interface WeatherData {
    location: string;
    temperature: number;
    condition: string;
    humidity: number;
    wind_speed: number;
    rainfall_mm: number;
    forecast: { day: string, temp: number, condition: string, rain_prob: number }[];
    alerts: { type: 'warning' | 'caution', title: string, message: string }[];
    advice: string[];
}

export interface MarketLocation {
    market_name: string;
    distance_km: number;
    price: number;
    change: number;
    trend: 'up' | 'down';
}

export interface MarketPrice {
    crop_name: string;
    market_price: number;
    change: number;
    trend: 'up' | 'down';
    nearest_mandi: string;
    msp: number;
    msp_comparison: 'above' | 'below' | 'n/a';
    markets: MarketLocation[];
}

export interface NewsItem {
    id: number;
    category: 'scheme' | 'tip' | 'market' | 'alert';
    title: string;
    summary: string;
    source: string;
    verified: boolean;
    date: string;
}

export const getWeather = async () => {
    const response = await api.get<WeatherData>('/weather/');
    return response.data;
};

export const getMarketPrices = async () => {
    const response = await api.get<MarketPrice[]>('/market/prices');
    return response.data;
};

export const getNews = async () => {
    const response = await api.get<NewsItem[]>('/news/');
    return response.data;
};

export const getFarmerOverview = async () => {
    const response = await api.get('/analytics/farmer/overview');
    return response.data;
};

export const getYieldTrend = async () => {
    const response = await api.get('/analytics/farmer/yield-trend');
    return response.data;
};

// --- RAG Chatbot API ---
export interface ChatMessage {
    question: string;
}

export interface ChatResponse {
    answer: string;
    source: "db_only" | "external" | "mixed";
    data_points?: any;
}

export const sendChatMessage = async (question: string): Promise<ChatResponse> => {
    const response = await api.post<ChatResponse>('/rag/chat', { question });
    return response.data;
};

export default api;
