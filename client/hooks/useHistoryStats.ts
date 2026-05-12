import { useState, useEffect } from "react";

export interface HistoryStatsResponse {
  totalChats: number;
  lineChartData: { time: string; label: string; red: number; yellow: number; green: number }[];
  timeOfDayData: { time: string; label: string; value: number }[];
  aiMessages: { auto: number; manual: number };
  reviewApprovals: { approved: number; total: number };
  timeSavedSeconds: number;
}

function formatDateParam(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function useHistoryStats(startDate: Date | undefined, endDate: Date | undefined) {
  const [data, setData] = useState<HistoryStatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startIso = startDate ? formatDateParam(startDate) : undefined;
  const endIso = endDate ? formatDateParam(endDate) : undefined;

  useEffect(() => {
    const params = new URLSearchParams();
    if (startIso) params.set("start", startIso);
    if (endIso) params.set("end", endIso);

    setLoading(true);
    setError(null);

    fetch(`/users/me/history-stats?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load stats: ${res.status}`);
        return res.json() as Promise<HistoryStatsResponse>;
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load stats");
        setLoading(false);
      });
  }, [startIso, endIso]);

  return { data, loading, error };
}
