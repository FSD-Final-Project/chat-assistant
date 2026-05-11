import { useState, useEffect } from "react";

export interface HistoryStatsResponse {
  totalChats: number;
  lineChartData: { date: string; red: number; yellow: number; green: number }[];
  timeOfDayData: { hour: number; value: number }[];
  aiMessages: { auto: number; manual: number };
  reviewApprovals: { approved: number; total: number };
  timeSavedSeconds: number;
}

export function useHistoryStats(startDate: Date | undefined, endDate: Date | undefined) {
  const [data, setData] = useState<HistoryStatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startIso = startDate?.toISOString();
  const endIso = endDate?.toISOString();

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
