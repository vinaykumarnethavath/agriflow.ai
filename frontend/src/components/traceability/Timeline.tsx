import React from 'react';
import { CheckCircle, Truck, Factory, Sprout } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TraceEvent {
    id: number;
    action: string;
    timestamp: string;
    details: string; // JSON
}

interface TimelineProps {
    events: TraceEvent[];
}

export const TraceabilityTimeline: React.FC<TimelineProps> = ({ events }) => {
    const getIcon = (action: string) => {
        if (action.includes("Harvest")) return <Sprout className="h-5 w-5 text-green-600" />;
        if (action.includes("Process")) return <Factory className="h-5 w-5 text-purple-600" />;
        if (action.includes("Ship")) return <Truck className="h-5 w-5 text-blue-600" />;
        return <CheckCircle className="h-5 w-5 text-gray-600" />;
    };

    return (
        <Card>
            <CardHeader><CardTitle>Product Journey</CardTitle></CardHeader>
            <CardContent>
                <div className="relative border-l-2 border-green-200 ml-3 space-y-8 pb-4">
                    {events.map((event, index) => (
                        <div key={event.id} className="mb-8 ml-6 relative">
                            <span className="absolute -left-10 bg-white border-2 border-green-500 rounded-full p-1">
                                {getIcon(event.action)}
                            </span>
                            <div className="bg-white p-4 rounded-lg border shadow-sm">
                                <h4 className="font-bold text-gray-800">{event.action}</h4>
                                <span className="text-xs text-gray-400">{new Date(event.timestamp).toLocaleString()}</span>
                                <p className="text-sm text-gray-600 mt-2">{event.details}</p>
                            </div>
                        </div>
                    ))}
                    {events.length === 0 && <p className="ml-6 text-gray-500">No events recorded yet.</p>}
                </div>
            </CardContent>
        </Card>
    );
};
