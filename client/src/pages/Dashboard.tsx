import React, { useEffect, useState } from 'react';
import { fetchApi } from '../services/api';

export const Dashboard: React.FC = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [insights, setInsights] = useState<any>(null);
  const [error, setError] = useState('');
  const [businessId, setBusinessId] = useState<string | null>(null);

  useEffect(() => {
    const login = async () => {
      try {
        const res = await fetch('/api/auth/demo-login', { method: 'POST' });
        const data = await res.json();
        setBusinessId(data.business.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        setError(err.message);
      }
    };
    login();
  }, []);

  useEffect(() => {
    if (!businessId) return;

    const loadInsights = async () => {
      try {
        const data = await fetchApi('/radar/insights', {
          headers: { 'x-business-id': businessId }
        });
        setInsights(data);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        setError(err.message);
      }
    };
    loadInsights();
  }, [businessId]);

  if (error) return <div className="text-red-500">Error: {error}</div>;
  if (!insights) return <div>Loading...</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Radar Insights Dashboard</h1>
      <div className="bg-white p-6 rounded shadow mb-6">
        <h2 className="text-xl font-semibold">Lost Cash Radar</h2>
        <p className="text-gray-600">Total at risk: ${(insights.totalAtRisk / 100).toFixed(2)}</p>

        <div className="mt-4">
          <h3 className="font-bold">Unconverted Quotes (Accepted but no invoice)</h3>
          <ul className="list-disc pl-5">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {insights.unconvertedQuotes.map((q: any) => (
              <li key={q.id}>Quote #{q.id.split('-')[0]} - ${(q.total / 100).toFixed(2)}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
