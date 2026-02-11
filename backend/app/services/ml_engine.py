from typing import List, Dict, Any
from datetime import datetime
from ..models.crop import Crop, CropExpense

class MLEngine:
    @staticmethod
    def analyze_expenses(crop: Crop, expenses: List[CropExpense]) -> List[Dict[str, Any]]:
        insights = []
        
        if not expenses:
            return [{"type": "info", "message": "Add expenses to get AI insights.", "category": "General"}]

        total_cost = sum(e.total_cost for e in expenses)
        if total_cost == 0:
             return [{"type": "info", "message": "Total cost is zero. Add details to get insights.", "category": "General"}]

        # 1. Category Breakdown Analysis
        category_totals = {}
        for e in expenses:
            category_totals[e.category] = category_totals.get(e.category, 0) + e.total_cost
        
        # Thresholds (Heuristics)
        THRESHOLDS = {
            "Input": 0.40,      # > 40% of total cost is high for inputs
            "Labor": 0.30,      # > 30% is high for labor
            "Machinery": 0.25,
            "Irrigation": 0.15
        }

        for cat, amount in category_totals.items():
            percentage = amount / total_cost
            if cat in THRESHOLDS and percentage > THRESHOLDS[cat]:
                insights.append({
                    "type": "warning",
                    "category": cat,
                    "message": f"High spend on {cat} ({int(percentage*100)}% of total). Standard is ~{int(THRESHOLDS[cat]*100)}%.",
                    "action": f"Review {cat} costs. Check for bulk buying options or shared resources."
                })
        
        # 2. specific expensive items
        sorted_expenses = sorted(expenses, key=lambda x: x.total_cost, reverse=True)
        if sorted_expenses:
            top = sorted_expenses[0]
            if top.total_cost > total_cost * 0.2: # Single item > 20%
                 insights.append({
                    "type": "alert",
                    "category": top.category,
                    "message": f"Major expense detected: {top.type} ({top.quantity} {top.unit}) costs ₹{top.total_cost}.",
                    "action": "Ensure this specific expense is necessary and optimized."
                })

        # 3. Fertilizer ROI (Simple Check)
        input_cost = category_totals.get("Input", 0)
        if hasattr(crop, 'total_revenue') and crop.total_revenue and input_cost > 0:
            roi = crop.total_revenue / input_cost
            if roi < 2:
                 insights.append({
                    "type": "warning",
                    "category": "ROI",
                    "message": f"Low ROI on inputs. For every ₹1 spent on seeds/fertilizer, you only got ₹{roi:.1f}.",
                    "action": "Consider soil testing to optimize fertilizer usage."
                })
            else:
                 insights.append({
                    "type": "success",
                    "category": "ROI",
                    "message": f"Good ROI! You earned ₹{roi:.1f} for every ₹1 spent on inputs.",
                    "action": "Keep following current practices."
                })

        if not insights:
             insights.append({
                    "type": "success",
                    "category": "General",
                    "message": "Expenses look balanced within standard benchmarks.",
                    "action": "Monitor closely as crop grows."
                })

        return insights

    @staticmethod
    def predict_profitability(crop: Crop, expenses: List[CropExpense]) -> Dict[str, Any]:
        total_cost = sum(e.total_cost for e in expenses)
        
        # If already harvested, return actuals
        if crop.status == "Harvested" and crop.net_profit is not None:
             return {
                "predicted_profit": crop.net_profit,
                "confidence": "High (Actual)",
                "trend": "stable"
            }

        # Prediction Logic
        # Estimate remaining cost based on time elapsed? (Too complex for now)
        # Simple projection: Assume current cost is 60% of total if 'Growing'
        
        estimated_total_cost = total_cost * 1.5 # buffer
        
        # Estimate Revenue: Area * Yield Benchmark * Market Price Benchmark
        # Benchmarks (Placeholder)
        YIELD_BENCHMARK = 20 # quintals/acre
        PRICE_BENCHMARK = 2000 # INR/quintal
        
        estimated_revenue = crop.area * YIELD_BENCHMARK * PRICE_BENCHMARK
        predicted_profit = estimated_revenue - estimated_total_cost
        
        return {
            "predicted_profit": predicted_profit,
            "estimated_revenue": estimated_revenue,
            "estimated_cost": estimated_total_cost,
            "confidence": "Medium (Based on Market Averages)",
            "message": f"Based on {crop.area} acres, potential profit is ₹{predicted_profit:,.2f}."
        }

    @staticmethod
    def recommend_crops(month: int) -> List[Dict[str, str]]:
        # Simple seasonal recommender
        # 1-12 month
        recommendations = []
        
        if 6 <= month <= 9: # Kharif (Monsoon)
            recommendations = [
                {"name": "Rice", "reason": "Best suited for monsoon season."},
                {"name": "Maize", "reason": "Requires less water than rice, good market rate."},
                {"name": "Cotton", "reason": "High cash crop potential in this season."}
            ]
        elif 10 <= month <= 2: # Rabi (Winter)
             recommendations = [
                {"name": "Wheat", "reason": "Standard winter crop, stable MSP."},
                {"name": "Mustard", "reason": "Low water requirement, good oilseed prices."},
                {"name": "Chickpea", "reason": "Nitrogen fixing, good for soil health."}
            ]
        else: # Zaid (Summer)
             recommendations = [
                {"name": "Watermelon", "reason": "Short duration cash crop."},
                {"name": "Cucumber", "reason": "High demand in summer."},
                {"name": "Moong Dal", "reason": "Short duration, improves soil."}
            ]
            
        return recommendations

    @staticmethod
    def get_market_trends() -> List[Dict[str, Any]]:
        # Mock Data for Market Trends - normally would come from external API
        return [
            {"crop": "Wheat", "price": 2450, "unit": "q", "change": 5.2, "trend": "up"},
            {"crop": "Rice", "price": 1950, "unit": "q", "change": -1.5, "trend": "down"},
            {"crop": "Cotton", "price": 6200, "unit": "q", "change": 2.8, "trend": "up"},
            {"crop": "Maize", "price": 2100, "unit": "q", "change": 0.5, "trend": "stable"},
        ]
