import { Button } from "@/components/ui/button";

interface TodaySummaryTabsProps {
    tabs: string[];
    activeTab: string;
    onTabChange: (tab: string) => void;
}

export function TodaySummaryTabs({ tabs, activeTab, onTabChange }: TodaySummaryTabsProps) {
    return (
        <div className="flex gap-2 mb-6 w-fit">
            {tabs.map((tab) => (
                <Button
                    key={tab}
                    variant={activeTab === tab ? "default" : "outline"}
                    size="sm"
                    onClick={() => onTabChange(tab)}
                    className="rounded-full"
                >
                    {tab}
                </Button>
            ))}
        </div>
    );
}
