/**
 * Voice Action Handler — Executes structured actions from the AI voice backend.
 *
 * Receives parsed JSON actions from POST /voice/process and executes them:
 * - navigate: Router.push to a page
 * - api_call: Make API calls (add crop, expense, etc.)
 * - fill_form: Dispatch events for page components to pre-fill forms
 * - show_answer: Return text for display + TTS
 * - change_language: Switch the app locale
 */

import api from "./api";

// ── Types ────────────────────────────────────────────────────────────────────

export interface VoiceActionResponse {
    action: "navigate" | "api_call" | "fill_form" | "show_answer" | "change_language" | "ask_followup";
    params: Record<string, any>;
    response_text: string;
    navigate_to: string | null;
    execution_result?: any;
    requires_followup?: boolean;
}

export interface VoiceExecutionResult {
    success: boolean;
    message: string;
    navigateTo?: string | null;
    data?: any;
}

export interface VoiceMessage {
    role: "user" | "assistant";
    content: string;
}

// ── Send transcript to backend for AI processing ─────────────────────────────

export async function processVoiceCommand(
    transcript: string,
    currentPage: string,
    locale: string,
    history: VoiceMessage[] = []
): Promise<VoiceActionResponse> {
    const response = await api.post<VoiceActionResponse>("/voice/process", {
        transcript,
        current_page: currentPage,
        locale,
        history,
    });
    return response.data;
}

// ── Execute the parsed action ────────────────────────────────────────────────

export async function executeVoiceAction(
    action: VoiceActionResponse,
    options: {
        router: any;
        setLocale?: (locale: any) => void;
    }
): Promise<VoiceExecutionResult> {
    const { router, setLocale } = options;

    switch (action.action) {
        case "navigate":
            return {
                success: true,
                message: action.response_text,
                navigateTo: action.navigate_to,
            };

        case "api_call":
            // If the server already executed this action, return the result directly
            if (action.execution_result) {
                return {
                    success: action.execution_result.success ?? true,
                    message: action.response_text,
                    navigateTo: action.navigate_to,
                    data: action.execution_result.data,
                };
            }
            return await handleApiCall(action);

        case "ask_followup":
            return {
                success: true,
                message: action.response_text,
                navigateTo: action.navigate_to,
            };

        case "fill_form":
            // Dispatch a custom event that page components can listen for
            if (typeof window !== "undefined") {
                const event = new CustomEvent("voice-fill-form", {
                    detail: action.params.fields || action.params,
                });
                window.dispatchEvent(event);
            }
            return {
                success: true,
                message: action.response_text,
                navigateTo: action.navigate_to,
            };

        case "show_answer":
            return {
                success: true,
                message: action.response_text,
                navigateTo: action.navigate_to,
            };

        case "change_language":
            if (setLocale && action.params.locale) {
                setLocale(action.params.locale);
            }
            return {
                success: true,
                message: action.response_text,
            };

        default:
            return {
                success: true,
                message: action.response_text,
                navigateTo: action.navigate_to,
            };
    }
}

// ── API Call Handler ─────────────────────────────────────────────────────────

async function handleApiCall(action: VoiceActionResponse): Promise<VoiceExecutionResult> {
    const { endpoint, data } = action.params;

    try {
        switch (endpoint) {
            case "add_crop": {
                const cropData = {
                    name: data.name || "Unnamed Crop",
                    area: data.area || 1,
                    season: data.season || getCurrentSeason(),
                    variety: data.variety || "",
                    sowing_date: data.sowing_date || new Date().toISOString().split("T")[0],
                    status: data.status || "active",
                    notes: data.notes || "",
                };
                await api.post("/crops/", cropData);
                return {
                    success: true,
                    message: action.response_text,
                    navigateTo: action.navigate_to || "/dashboard/farmer/crops",
                };
            }

            case "add_expense": {
                // For expenses, we need a crop_id. If not provided, navigate to crops page
                if (!data.crop_id) {
                    return {
                        success: true,
                        message: action.response_text + " Please select a crop to add this expense to.",
                        navigateTo: "/dashboard/farmer/crops",
                        data: { pendingExpense: data },
                    };
                }
                await api.post(`/crops/${data.crop_id}/expenses`, data);
                return {
                    success: true,
                    message: action.response_text,
                    navigateTo: action.navigate_to,
                };
            }

            case "update_profile": {
                await api.put("/farmer/profile", data);
                return {
                    success: true,
                    message: action.response_text,
                    navigateTo: action.navigate_to || "/dashboard/farmer/profile",
                };
            }

            default:
                return {
                    success: true,
                    message: action.response_text,
                    navigateTo: action.navigate_to,
                };
        }
    } catch (err: any) {
        console.error("[VoiceAction] API call failed:", err);
        const detail = err.response?.data?.detail || err.message || "API call failed";
        return {
            success: false,
            message: `Sorry, the action failed: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`,
            navigateTo: action.navigate_to,
        };
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getCurrentSeason(): string {
    const month = new Date().getMonth() + 1;
    if (month >= 6 && month <= 10) return "Kharif";
    if (month >= 11 || month <= 3) return "Rabi";
    return "Zaid";
}
