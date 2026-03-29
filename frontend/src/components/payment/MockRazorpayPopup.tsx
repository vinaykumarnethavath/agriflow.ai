import React, { useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, CreditCard, Wallet, Building, Smartphone, ChevronRight, Plus } from "lucide-react";

export default function MockRazorpayPopup({
    options,
    onClose
}: {
    options: any,
    onClose: () => void
}) {
    const [step, setStep] = useState<"method" | "processing" | "success">("method");

    const [selectedMethod, setSelectedMethod] = useState<string | null>("Navi");

    const handlePayment = () => {
        setStep("processing");
        setTimeout(() => {
            setStep("success");
            setTimeout(() => {
                options.handler({
                    razorpay_order_id: options.order_id,
                    razorpay_payment_id: `pay_mock_${selectedMethod}_` + Math.random().toString(36).substring(2, 9),
                    razorpay_signature: "dummy_signature",
                });
                onClose();
            }, 1000);
        }, 1500);
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200 lg:p-0">
            <div className="bg-gray-50 rounded-xl shadow-2xl w-full h-full max-w-md md:h-[90vh] overflow-hidden relative animate-in zoom-in-95 duration-200 flex flex-col font-sans">
                
                {/* Header Navbar */}
                <div className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition text-gray-700">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h2 className="font-bold text-gray-900 text-[17px]">Payment Options</h2>
                        <div className="text-xs text-gray-500 font-medium">
                            <span>1 item • Total: ₹{(options.amount / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </div>

                {/* Content Body */}
                <div className="flex-1 overflow-y-auto w-full pb-6">
                    {step === "method" && (
                        <div className="w-full space-y-6">
                            {/* Promotional Banner */}
                            <div className="bg-[#126b59] p-4 text-white rounded-b-xl flex justify-between items-center shadow-md">
                                <div>
                                    <p className="text-xs font-semibold opacity-90">instant payments!</p>
                                    <button className="bg-white text-gray-800 text-xs font-bold px-3 py-1.5 rounded-full mt-2 shadow-sm uppercase tracking-wide">
                                        Activate in 10s
                                    </button>
                                </div>
                                <div className="text-xl font-black italic">
                                    UPI
                                    <span className="text-[#f16f2c]">►</span>
                                </div>
                            </div>
                            
                            <div className="px-4 space-y-5">
                                {/* Preferred Payment */}
                                <div>
                                    <h3 className="font-bold text-gray-800 text-sm mb-3 ml-1">Preferred Payment</h3>
                                    <div className="bg-white rounded-[16px] shadow-sm overflow-hidden border border-gray-100">
                                        <div className="p-4 border-b border-gray-100/60">
                                            <label className="flex items-center gap-3 cursor-pointer">
                                                <div className="w-8 h-8 bg-purple-900 rounded-md flex items-center justify-center text-white font-bold text-lg">
                                                    Navi
                                                </div>
                                                <div className="flex-1 font-semibold text-gray-800 text-[15px]">Navi</div>
                                                <div className="text-green-500 bg-green-50 rounded-full p-0.5">
                                                    <CheckCircle2 className="w-5 h-5 fill-current text-white" />
                                                </div>
                                            </label>
                                            <button 
                                                onClick={handlePayment} 
                                                className="w-full mt-4 bg-[#1ba672] hover:bg-[#158f60] text-white font-bold py-3.5 rounded-xl transition-all shadow-sm"
                                            >
                                                Pay via Navi UPI
                                            </button>
                                        </div>
                                        <div className="p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50" onClick={() => { setSelectedMethod('BHIM'); handlePayment(); }}>
                                            <div className="w-8 h-8 bg-white border rounded-md shadow-sm p-1 flex items-center justify-center">
                                                <strong className="text-green-600 text-xs">BHIM</strong>
                                            </div>
                                            <div className="flex-1 font-semibold text-gray-800 text-[15px]">BHIM</div>
                                            <div className="w-5 h-5 rounded-full border-2 border-gray-300"></div>
                                        </div>
                                    </div>
                                </div>

                                {/* Pay by any UPI App */}
                                <div>
                                    <h3 className="font-bold text-gray-800 text-sm mb-3 ml-1 flex items-center gap-2">
                                        <span className="font-black italic text-gray-500">UPI<span className="text-[#f16f2c] shrink-0 inline-flex">►</span></span> 
                                        Pay by any UPI App
                                    </h3>
                                    <div className="bg-white rounded-[16px] shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
                                        {[
                                            { id: 'gpay', name: 'Google Pay', icon: 'G' },
                                            { id: 'phonepe', name: 'PhonePe UPI', icon: 'Pe', color: 'bg-purple-600' },
                                            { id: 'paytm', name: 'Paytm UPI', sub: '₹30 to ₹300 Cashback on Paytm UPI Transactions above ₹100', icon: 'Paytm', color: 'bg-[#002e6e]' },
                                        ].map((app) => (
                                            <label key={app.id} className="flex items-start gap-4 p-4 cursor-pointer hover:bg-gray-50 relative group">
                                                <div className={`w-8 h-8 ${app.color || 'bg-blue-500'} font-bold text-white rounded-md flex items-center justify-center text-xs shrink-0 shadow-sm`}>
                                                    {app.icon}
                                                </div>
                                                <div className="flex-1 relative top-0.5">
                                                    <div className="font-semibold text-gray-800 text-[15px]">{app.name}</div>
                                                    {app.sub && <div className="text-[11.5px] text-[#1ba672] leading-tight mt-1 pr-6">{app.sub}</div>}
                                                </div>
                                                <div className="flex items-center h-8">
                                                    <div onClick={() => { setSelectedMethod(app.name); handlePayment(); }} className="w-5 h-5 rounded-full border-2 border-gray-300 group-hover:border-[#f16f2c] transition flex items-center justify-center"></div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Credit & Debit Cards */}
                                <div>
                                    <h3 className="font-bold text-gray-800 text-sm mb-3 ml-1">Credit & Debit Cards</h3>
                                    <div className="bg-white rounded-[16px] shadow-sm border border-gray-100 overflow-hidden p-4 cursor-pointer hover:bg-gray-50 border-dashed hover:border-orange-500 hover:border-solid transition-colors group">
                                        <div className="flex items-center gap-4" onClick={() => setSelectedMethod('card')}>
                                            <div className="w-8 h-8 border border-gray-200 rounded-md flex items-center justify-center text-orange-500 group-hover:bg-orange-50 bg-white">
                                                <Plus className="w-5 h-5" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-bold text-orange-600 text-[15px]">Add New Card</div>
                                                <div className="text-xs text-gray-500 mt-0.5">Save and Pay via Cards.</div>
                                            </div>
                                        </div>
                                    </div>
                                    {selectedMethod === 'card' && (
                                        <div className="mt-3 bg-white p-4 rounded-xl shadow-sm border border-gray-200 animate-in slide-in-from-top-2">
                                            <input type="text" placeholder="Card Number" className="w-full p-3 border rounded-lg mb-3 bg-gray-50 focus:bg-white" />
                                            <div className="flex gap-3 mb-3">
                                                <input type="text" placeholder="MM/YY" className="w-full p-3 border rounded-lg bg-gray-50 focus:bg-white" />
                                                <input type="password" placeholder="CVV" className="w-full p-3 border rounded-lg bg-gray-50 focus:bg-white" />
                                            </div>
                                            <button onClick={handlePayment} className="w-full font-bold bg-[#f16f2c] hover:bg-[#d65d21] text-white py-3.5 rounded-xl shadow-sm">
                                                Pay ₹{(options.amount / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* More Payment Options */}
                                <div>
                                    <h3 className="font-bold text-gray-800 text-sm mb-3 ml-1">More Payment Options</h3>
                                    <div className="bg-white rounded-[16px] shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
                                        {[
                                            { id: 'wallets', name: 'Wallets', sub: 'PhonePe, Amazon Pay & more', icon: <Wallet className="w-4 h-4 text-gray-600" /> },
                                            { id: 'netbanking', name: 'Netbanking', sub: 'Select from a list of banks', icon: <Building className="w-4 h-4 text-gray-600" /> },
                                            { id: 'cod', name: 'Pay on Delivery', sub: 'Pay in cash or pay online.', icon: <span className="font-bold text-gray-600 text-[10px]">₹</span> },
                                        ].map((opt) => (
                                            <div key={opt.id}>
                                                <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50" onClick={() => setSelectedMethod(selectedMethod === opt.id ? null : opt.id)}>
                                                    <div className="w-8 h-8 rounded-md border border-gray-200 flex items-center justify-center bg-gray-50">
                                                        {opt.icon}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="font-semibold text-gray-800 text-[15px]">{opt.name}</div>
                                                        <div className="text-xs text-gray-500 mt-0.5">{opt.sub}</div>
                                                    </div>
                                                    <ChevronRight className="w-4 h-4 text-gray-400" />
                                                </div>
                                                {selectedMethod === opt.id && (
                                                    <div className="px-4 pb-4 animate-in slide-in-from-top-2">
                                                        <button onClick={handlePayment} className="w-full bg-[#1ba672] hover:bg-[#158f60] text-white font-bold py-3.5 rounded-xl transition-all shadow-sm">
                                                            Simulate {opt.name} Payment
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === "processing" && (
                        <div className="flex flex-col items-center justify-center p-12 text-center h-[60vh]">
                            <Loader2 className="w-12 h-12 text-[#1ba672] animate-spin mb-4" />
                            <h3 className="text-lg font-bold text-gray-800">Processing Payment...</h3>
                            <p className="text-sm text-gray-500">Please wait while we process your mock transaction.</p>
                        </div>
                    )}

                    {step === "success" && (
                        <div className="flex flex-col items-center justify-center p-12 text-center h-[60vh] animate-in fade-in zoom-in">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 text-[#1ba672]">
                                <CheckCircle2 className="w-10 h-10" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800">Payment Successful!</h3>
                            <p className="text-sm text-gray-500">Redirecting to order confirmation...</p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
