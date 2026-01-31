"use client";

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

type RadarDatum = {
  label: string;
  avg: number; // 0–5
  count: number; // #samples used (non-zero)
};

export default function PlayerRadarClient({ data }: { data: RadarDatum[] }) {
  // If everything is 0, don't render the chart.
  const hasAny = data.some((d) => d.avg > 0);
  if (!hasAny) return null;

  return (
    <div className="border rounded px-3 py-3 bg-white">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-sm">Ratings radar</div>
        <div className="text-[0.7rem] text-gray-500">0–5 (ignores 0 scores)</div>
      </div>

      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data}>
            <PolarGrid />
            <PolarAngleAxis dataKey="label" tick={{ fontSize: 11 }} />
            <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
            <Tooltip
              formatter={(value: any, _name, props: any) => {
                const v = typeof value === "number" ? value : Number(value);
                const count = props?.payload?.count ?? 0;
                return [`${v.toFixed(1)} / 5 (${count} samples)`, "Avg"];
              }}
            />
            <Radar dataKey="avg" fillOpacity={0.25} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 text-[0.7rem] text-gray-500">
        Averages ignore 0 (“not assessed”). Hover points to see sample counts.
      </div>
    </div>
  );
}
