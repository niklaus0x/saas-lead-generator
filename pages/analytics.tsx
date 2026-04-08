import { useEffect, useState } from 'react'

interface OverviewData {
  totalLeads: number;
  totalSearches: number;
  avgScore: number;
  withWhatsApp: number;
  withEmail: number;
  painSignals: number;
  highScore: number;
  converted: number;
  conversionRate: string;
  waQueue: { total: number; sent: number; replied: number };
  outreach: { total: number; active: number; replied: number };
}

interface SourceData { source: string; count: number; avgScore: string; withWhatsApp: number; whatsAppRate: string; }
interface FunnelStage { stage: string; count: number; }
interface TimelineEntry { date: string; searches: number; leads: number; }
interface NicheEntry { niche: string; searches: number; totalLeads: number; avgLeads: string; }

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const STAGE_COLORS: Record<string, string> = { new: 'bg-gray-200', contacted: 'bg-blue-200', interested: 'bg-yellow-200', demo: 'bg-purple-200', converted: 'bg-green-300', dead: 'bg-red-200' };
const STAGE_LABELS: Record<string, string> = { new: 'New', contacted: 'Contacted', interested: 'Interested', demo: 'Demo', converted: 'Converted', dead: 'Dead' };

function StatCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const colors: Record<string, string> = { blue: 'text-blue-600', green: 'text-green-600', yellow: 'text-yellow-600', purple: 'text-purple-600', red: 'text-red-500', gray: 'text-gray-600' };
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-3xl font-bold ${colors[color] || colors.blue}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function BarChart({ data, labelKey, valueKey, color = 'bg-blue-500' }: { data: any[]; labelKey: string; valueKey: string; color?: string }) {
  const max = Math.max(...data.map(d => d[valueKey]), 1);
  return (
    <div className="space-y-2">
      {data.slice(0, 10).map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-32 text-xs text-gray-600 truncate shrink-0">{item[labelKey]}</div>
          <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
            <div className={`${color} h-full rounded-full transition-all`} style={{ width: `${(item[valueKey] / max) * 100}%` }} />
          </div>
          <div className="text-xs font-medium text-gray-700 w-8 text-right">{item[valueKey]}</div>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [sources, setSources] = useState<SourceData[]>([]);
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [niches, setNiches] = useState<NicheEntry[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [ov, src, fn, tl, ni, sc] = await Promise.all([
        fetch(`${API}/api/analytics/overview`).then(r => r.json()),
        fetch(`${API}/api/analytics/by-source`).then(r => r.json()),
        fetch(`${API}/api/analytics/funnel`).then(r => r.json()),
        fetch(`${API}/api/analytics/timeline`).then(r => r.json()),
        fetch(`${API}/api/analytics/top-niches`).then(r => r.json()),
        fetch(`${API}/api/analytics/scores`).then(r => r.json()),
      ]);
      setOverview(ov);
      setSources(src.sources || []);
      setFunnel(fn.funnel || []);
      setTimeline(tl.timeline || []);
      setNiches(ni.niches || []);
      setScores(sc.distribution || {});
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); const interval = setInterval(fetchAll, 30000); return () => clearInterval(interval); }, []);

  if (loading && !overview) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center"><div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" /><p className="text-gray-500 text-sm">Loading analytics...</p></div>
    </div>
  );

  const funnelMax = Math.max(...funnel.map(f => f.count), 1);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Last updated: {lastUpdated}</p>
          </div>
          <div className="flex gap-3">
            <a href="/" className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50">← Search</a>
            <button onClick={fetchAll} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700">Refresh</button>
          </div>
        </div>

        {/* Overview Stats */}
        {overview && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Leads" value={overview.totalLeads.toLocaleString()} sub={`${overview.totalSearches} searches`} color="blue" />
            <StatCard label="Avg Score" value={overview.avgScore} sub="out of 10" color="purple" />
            <StatCard label="Has WhatsApp" value={overview.withWhatsApp.toLocaleString()} sub={`${overview.totalLeads > 0 ? ((overview.withWhatsApp / overview.totalLeads) * 100).toFixed(0) : 0}% of leads`} color="green" />
            <StatCard label="Conversion Rate" value={overview.conversionRate} sub={`${overview.converted} converted`} color="yellow" />
            <StatCard label="Pain Signals" value={overview.painSignals.toLocaleString()} sub="high-fit leads" color="red" />
            <StatCard label="High Score (8+)" value={overview.highScore.toLocaleString()} sub="priority leads" color="purple" />
            <StatCard label="WA Queue" value={overview.waQueue?.total || 0} sub={`${overview.waQueue?.replied || 0} replied`} color="green" />
            <StatCard label="Sequences" value={overview.outreach?.active || 0} sub={`${overview.outreach?.replied || 0} replied`} color="blue" />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* CRM Funnel */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">CRM Pipeline Funnel</h2>
            <div className="space-y-2">
              {funnel.map(stage => (
                <div key={stage.stage} className="flex items-center gap-3">
                  <div className="w-24 text-xs text-gray-600 capitalize">{STAGE_LABELS[stage.stage] || stage.stage}</div>
                  <div className="flex-1 rounded-full h-6 overflow-hidden bg-gray-100">
                    <div className={`${STAGE_COLORS[stage.stage] || 'bg-gray-300'} h-full rounded-full flex items-center pl-2 transition-all`} style={{ width: `${Math.max((stage.count / funnelMax) * 100, stage.count > 0 ? 8 : 0)}%` }}>
                      {stage.count > 0 && <span className="text-xs font-medium text-gray-700">{stage.count}</span>}
                    </div>
                  </div>
                  <div className="text-xs font-medium text-gray-500 w-6 text-right">{stage.count}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Score Distribution */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Lead Score Distribution</h2>
            <div className="space-y-1.5">
              {Object.entries(scores).map(([score, count]) => {
                const max = Math.max(...Object.values(scores), 1);
                const color = parseInt(score) >= 8 ? 'bg-green-500' : parseInt(score) >= 5 ? 'bg-yellow-400' : 'bg-red-400';
                return (
                  <div key={score} className="flex items-center gap-2">
                    <div className="w-6 text-xs text-right text-gray-500">{score}</div>
                    <div className="flex-1 bg-gray-100 rounded h-4 overflow-hidden">
                      <div className={`${color} h-full rounded`} style={{ width: `${(count / max) * 100}%` }} />
                    </div>
                    <div className="text-xs text-gray-500 w-6">{count}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Sources */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Leads by Source</h2>
            <BarChart data={sources} labelKey="source" valueKey="count" color="bg-blue-500" />
            {sources.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No data yet — run a search</p>}
          </div>

          {/* Top Niches */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Top Searched Niches</h2>
            <BarChart data={niches} labelKey="niche" valueKey="searches" color="bg-purple-500" />
            {niches.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No searches yet</p>}
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Leads Found Per Day (Last 30 Days)</h2>
          {timeline.length > 0 ? (
            <div className="flex items-end gap-1 h-32">
              {timeline.map((entry, i) => {
                const max = Math.max(...timeline.map(e => e.leads), 1);
                const height = Math.max((entry.leads / max) * 100, 4);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${entry.date}: ${entry.leads} leads`}>
                    <div className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors" style={{ height: `${height}%` }} />
                  </div>
                );
              })}
            </div>
          ) : <p className="text-sm text-gray-400 text-center py-8">No search history yet</p>}
          <div className="flex justify-between text-xs text-gray-400 mt-2">
            <span>{timeline[0]?.date || ''}</span>
            <span>{timeline[timeline.length - 1]?.date || ''}</span>
          </div>
        </div>

        {/* Source detail table */}
        {sources.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Source Performance</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-6 py-3 text-gray-600 font-medium">Source</th>
                    <th className="text-right px-6 py-3 text-gray-600 font-medium">Leads</th>
                    <th className="text-right px-6 py-3 text-gray-600 font-medium">Avg Score</th>
                    <th className="text-right px-6 py-3 text-gray-600 font-medium">With WhatsApp</th>
                    <th className="text-right px-6 py-3 text-gray-600 font-medium">WA Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sources.map(s => (
                    <tr key={s.source} className="hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium text-gray-800">{s.source}</td>
                      <td className="px-6 py-3 text-right text-gray-600">{s.count}</td>
                      <td className="px-6 py-3 text-right">
                        <span className={`font-medium ${parseFloat(s.avgScore) >= 6 ? 'text-green-600' : parseFloat(s.avgScore) >= 4 ? 'text-yellow-600' : 'text-red-500'}`}>{s.avgScore}</span>
                      </td>
                      <td className="px-6 py-3 text-right text-gray-600">{s.withWhatsApp}</td>
                      <td className="px-6 py-3 text-right text-gray-600">{s.whatsAppRate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
