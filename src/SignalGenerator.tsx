import React, { useState, useEffect } from 'react';

// ============ TYPES ============
interface Payload {
  tickers: string;
  format: string;
  timeHorizon: string;
  riskTolerance: string;
  exchange: string;
}

interface TradeSetup {
  entry_zone?: string;
  target_1?: number;
  target_2?: number;
  stop_loss?: number;
  risk_reward_ratio?: number;
}

interface TechnicalIndicators {
  '20_dma'?: number;
  '50_dma'?: number;
  '200_dma'?: number;
  rsi_14?: number;
  macd?: {
    macd_line?: number;
    signal_line?: number;
    histogram?: number;
  };
  trend?: string;
}

interface PriceLevels {
  '52_week_high'?: number;
  '52_week_low'?: number;
  support?: number;
  resistance?: number;
}

interface AnalysisScores {
  technical?: number;
  fundamental?: number;
  sentiment?: number;
  total?: number;
}

interface PositionSizing {
  risk_tolerance?: string;
  risk_multiplier?: number;
  suggested_allocation?: string;
}

interface Result {
  symbol: string;
  company_name?: string;
  current_price: number;
  price_date?: string;
  signal: 'BUY' | 'SELL' | 'HOLD' | 'SELL/AVOID';
  confidence: string | number;
  entry_price: number;
  target_price: number;
  stop_loss: number;
  isInvalid?: boolean;
  invalidReason?: string;
  error?: string;
  details?: string;
  price_levels?: PriceLevels;
  technical_indicators?: TechnicalIndicators;
  trade_setup?: TradeSetup;
  analysis_scores?: AnalysisScores;
  scores?: AnalysisScores;
  position_sizing?: PositionSizing;
  summary?: string;
  analysis_summary?: string;
}

interface ApiResponse {
  results: Result[];
}

// ============ N8N API CALL ============
const callN8N = async (payload: Payload): Promise<ApiResponse | null> => {
  // Add exchange suffix to tickers if not already present
  const tickers = payload.tickers.split(',').map((t: string) => {
    const trimmed = t.trim().toUpperCase();
    if (trimmed.includes('.')) return trimmed;
    return `${trimmed}.${payload.exchange}`;
  }).join(',');

  const primaryUrl = `https://anandshinde75.app.n8n.cloud/webhook/signalGenerator`;
  const fallbackUrl = `/webhook/signalGenerator`;

  const requestBody = {
    "Ticker ": tickers,
    "Time Horizon": payload.timeHorizon,
    "Risk Tolerance": payload.riskTolerance,
    "Output Format": "Detailed"
  };

  console.log("Sending to n8n:", requestBody);

  const urls = [primaryUrl, fallbackUrl];
  let lastError: Error | null = null;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`Attempting ${i === 0 ? 'primary' : 'fallback'} URL: ${url}`);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Response status from ${url}:`, res.status);
        console.error('Response text:', errorText);
        throw new Error(`HTTP ${res.status}: ${errorText || 'Failed to fetch data'}`);
      }

      const responseText = await res.text();
      console.log('Raw response:', responseText);

      if (!responseText || responseText.trim() === '') {
        throw new Error('Empty response from webhook. Make sure your n8n workflow returns data.');
      }

      let parsed;
      try {
        parsed = JSON.parse(responseText);
        console.log('Parsed response:', parsed);
      } catch (parseError) {
        console.error('Failed to parse JSON:', responseText);
        throw new Error('Invalid JSON response from webhook. Check your n8n workflow output.');
      }

      // 👇 NEW: Handle error response format [{ "error": "..." }]
      if (Array.isArray(parsed) && parsed[0]?.error) {
        const errorMsg = parsed[0].error;
        const tickerSymbols = tickers.split(',');
        
        return {
          results: tickerSymbols.map(symbol => ({
            symbol: symbol.trim(),
            current_price: 0,
            signal: 'SELL/AVOID' as const,
            confidence: '0%',
            entry_price: 0,
            target_price: 0,
            stop_loss: 0,
            isInvalid: true,
            invalidReason: `Invalid ticker: ${errorMsg}`
          }))
        };
      }

      // Normal response handling
      let result: ApiResponse = Array.isArray(parsed) ? parsed[0] : parsed;
      console.log('Extracted result:', result);

      // Validate each result for invalid symbols
      if (result.results) {
        result.results = result.results.map((r: Result) => {
          if (r.error) {
            return { ...r, isInvalid: true, invalidReason: r.details || r.error };
          }

          if (!r.current_price || r.current_price === 0) {
            return { ...r, isInvalid: true, invalidReason: 'Invalid or delisted symbol - no price data available' };
          }

          return r;
        });
      }

      console.log(`✅ Success using ${i === 0 ? 'primary' : 'fallback'} URL`);
      return result;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.error(`❌ Failed with ${i === 0 ? 'primary' : 'fallback'} URL:`, lastError.message);
      
      if (i < urls.length - 1) {
        console.log('Trying fallback URL...');
        continue;
      }
    }
  }

  throw lastError || new Error('All endpoints failed');
};


// ============ STYLES ============
const S = {
  container: { maxWidth: 1200, margin: '0 auto', padding: '24px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', background: 'linear-gradient(to bottom, #ecfdf5, #ffffff)', minHeight: '100vh' },
  header: { background: 'linear-gradient(135deg, #047857 0%, #065f46 100%)', borderRadius: 16, padding: '32px 24px', marginBottom: 24, boxShadow: '0 10px 30px rgba(5, 150, 105, 0.2)' },
  h1: { fontSize: 36, fontWeight: 800, color: 'white', marginBottom: 8, textAlign: 'center' as const, letterSpacing: '-0.5px' },
  subtitle: { fontSize: 16, color: '#d1fae5', textAlign: 'center' as const, fontWeight: 500 },
  disclaimer: { background: '#fef3c7', border: '2px solid #fbbf24', borderRadius: 12, padding: 16, marginBottom: 24, display: 'flex', alignItems: 'start', gap: 12 },
  disclaimerIcon: { fontSize: 24, flexShrink: 0 },
  disclaimerText: { fontSize: 13, lineHeight: 1.6, color: '#78350f' },
  card: { background: 'white', borderRadius: 16, padding: 28, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', marginBottom: 20, border: '1px solid #d1fae5' },
  label: { display: 'block', fontSize: 14, fontWeight: 600, color: '#047857', marginBottom: 8, letterSpacing: '0.3px' },
  input: { width: '100%', padding: '12px 16px', border: '2px solid #d1fae5', borderRadius: 10, fontSize: 15, outline: 'none', boxSizing: 'border-box' as const, transition: 'all 0.2s', fontFamily: 'inherit' },
  select: { width: '100%', padding: '12px 16px', border: '2px solid #d1fae5', borderRadius: 10, fontSize: 15, outline: 'none', background: 'white', cursor: 'pointer', boxSizing: 'border-box' as const, transition: 'all 0.2s', fontFamily: 'inherit' },
  btn: { width: '100%', padding: 16, background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)', color: 'white', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer', transition: 'all 0.3s', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)', letterSpacing: '0.5px' },
  btn2: { padding: '8px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' },
  acc: { marginBottom: 16, border: '2px solid #d1fae5', borderRadius: 12, overflow: 'hidden', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },
  accH: { padding: 20, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 0.2s' },
  accB: { padding: 24, background: '#f0fdf4', borderTop: '2px solid #d1fae5' },
  kv: { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #e5e7eb' },
  kvL: { color: '#6b7280', fontSize: 14, fontWeight: 500 },
  kvV: { color: '#111827', fontSize: 14, textAlign: 'right' as const, fontWeight: 600 },
  err: { color: '#dc2626', fontSize: 13, marginTop: 6, fontWeight: 500 },
  toast: { position: 'fixed' as const, top: 24, right: 24, padding: 16, borderRadius: 12, background: '#fef2f2', border: '2px solid #fca5a5', color: '#991b1b', zIndex: 1000, boxShadow: '0 10px 30px rgba(0,0,0,0.15)', maxWidth: 400 },
  badge: (s: string) => ({ padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700, background: s === 'BUY' ? '#10b981' : s === 'SELL' ? '#ef4444' : '#f59e0b', color: 'white', boxShadow: '0 2px 6px rgba(0,0,0,0.1)', letterSpacing: '0.5px' }),
  th: { background: '#047857', padding: 14, textAlign: 'left' as const, fontWeight: 600, color: 'white', fontSize: 13, letterSpacing: '0.5px', textTransform: 'uppercase' as const },
  td: { padding: 14, borderBottom: '1px solid #e5e7eb', fontSize: 14 },
  section: { marginTop: 16, padding: 20, background: '#ecfdf5', borderRadius: 12, border: '2px solid #a7f3d0' },
  secTitle: { fontSize: 16, fontWeight: 700, color: '#047857', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 },
  summary: { background: 'linear-gradient(135deg, #fef3c7 0%, #fef9c3 100%)', border: '2px solid #fbbf24', borderRadius: 12, padding: 16, fontSize: 14, color: '#78350f', lineHeight: 1.6, marginTop: 16 },
  invalid: { background: 'linear-gradient(135deg, #fee2e2 0%, #fef2f2 100%)', border: '2px solid #fca5a5', borderRadius: 12, padding: 20, color: '#991b1b' },
  footer: { textAlign: 'center' as const, fontSize: 13, color: '#6b7280', marginTop: 32, padding: '20px 0', borderTop: '1px solid #d1fae5' }
};

interface KVProps {
  l: string;
  v: string | number | null | undefined;
  b?: boolean;
}

const KV: React.FC<KVProps> = ({ l, v, b = false }) => <div style={S.kv}><div style={S.kvL}>{l}</div><div style={{ ...S.kvV, fontWeight: b ? 700 : 400 }}>{v ?? '—'}</div></div>;

export default function SignalUI() {
  const [input, setInput] = useState('RELIANCE');
  const [format, setFormat] = useState('Detailed');
  const [timeH, setTimeH] = useState('Medium-term');
  const [riskT, setRiskT] = useState('Moderate');
  const [exchange, setExchange] = useState('NS');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [valErr, setValErr] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 5000); return () => clearTimeout(t); } }, [toast]);

  const run = async () => {
    setError(''); setValErr('');
    if (!input.trim()) { setValErr('Please enter at least one ticker'); return; }
    setLoading(true); setData(null); setExpanded(null);
    try {
      const res = await callN8N({ tickers: input, format, timeHorizon: timeH, riskTolerance: riskT, exchange });
      if (res?.results) { setData(res); if (res.results[0]) setExpanded(res.results[0].symbol); }
    } catch (e) { 
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
      setError(errorMessage); 
      setToast(errorMessage); 
    }
    setLoading(false);
  };

  const results = data?.results || [];
  const isCompact = format === 'Compact';

const Compact = () => (
  <div style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          {['Symbol', 'Price', 'Signal', 'Confidence', 'Entry', 'Target', 'SL'].map(h => 
            <th key={h} style={S.th}>{h}</th>
          )}
        </tr>
      </thead>
      <tbody>
        {results.map((r: Result) => {
          const ts = r.trade_setup || {};  // Access nested trade_setup object
          
          return (
            <tr key={r.symbol}>
              <td style={{ ...S.td, fontWeight: 700 }}>{r.symbol}</td>
              <td style={S.td}>₹{r.current_price}</td>
              <td style={S.td}><span style={S.badge(r.signal)}>{r.signal}</span></td>
              <td style={S.td}>{r.confidence}</td>
              <td style={S.td}>{ts.entry_zone || '—'}</td>
              <td style={S.td}>{ts.target_1 ? `₹${ts.target_1}` : '—'}</td>
              <td style={S.td}>{ts.stop_loss ? `₹${ts.stop_loss}` : '—'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);


  interface DetailedProps {
    r: Result;
  }

  const Detailed: React.FC<DetailedProps> = ({ r }) => {
    const pl = r.price_levels || {};
    const ti = r.technical_indicators || {};
    const ts = r.trade_setup || {};
    const sc = r.analysis_scores || r.scores || {};
    const ps = r.position_sizing || {};

    if (r.isInvalid) {
      return (
        <div style={S.invalid}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>⚠️ Invalid Symbol</div>
          <div>{r.invalidReason || 'This symbol may be delisted or invalid'}</div>
        </div>
      );
    }

    return (
      <div>
        {r.company_name && <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 12 }}>{r.company_name}</div>}
                {(r.summary || r.analysis_summary) && (
	          <div style={S.summary}>
	            <strong>📝 Analysis Summary:</strong> {r.analysis_summary || r.summary}
	          </div>
        )}
        
        <div style={S.grid}>
          <div style={S.section}>
            <div style={S.secTitle}>📊 Price Overview</div>
            <KV l="Current Price" v={`₹${r.current_price}`} b />
            <KV l="Date" v={r.price_date} />
            <KV l="52W High" v={pl["52_week_high"] ? `₹${pl["52_week_high"]}` : null} />
            <KV l="52W Low" v={pl["52_week_low"] ? `₹${pl["52_week_low"]}` : null} />
            <KV l="Support" v={pl.support ? `₹${pl.support}` : null} />
            <KV l="Resistance" v={pl.resistance ? `₹${pl.resistance}` : null} />
          </div>

          <div style={S.section}>
            <div style={S.secTitle}>📈 Technical Indicators</div>
            <KV l="20 DMA" v={ti["20_dma"] ? `₹${ti["20_dma"]}` : null} />
            <KV l="50 DMA" v={ti["50_dma"] ? `₹${ti["50_dma"]}` : null} />
            <KV l="200 DMA" v={ti["200_dma"] ? `₹${ti["200_dma"]}` : null} />
            <KV l="RSI (14)" v={ti.rsi_14} />
            <KV l="MACD Line" v={ti.macd?.macd_line} />
            <KV l="Signal Line" v={ti.macd?.signal_line} />
            <KV l="Histogram" v={ti.macd?.histogram} />
            <KV l="Trend" v={ti.trend} b />
          </div>

          <div style={S.section}>
            <div style={S.secTitle}>🎯 Analysis Scores</div>
            <KV l="Technical" v={sc.technical ? `${sc.technical}/10` : null} />
            <KV l="Fundamental" v={sc.fundamental ? `${sc.fundamental}/10` : null} />
            <KV l="Sentiment" v={sc.sentiment ? `${sc.sentiment}/10` : null} />
            <KV l="Total Score" v={sc.total ? `${sc.total}/30` : null} b />
          </div>

          <div style={S.section}>
            <div style={S.secTitle}>⚖️ Trade Setup</div>
            <KV l="Entry Zone" v={ts.entry_zone} />
            <KV l="Target 1" v={ts.target_1 ? `₹${ts.target_1}` : null} />
            <KV l="Target 2" v={ts.target_2 ? `₹${ts.target_2}` : null} />
            <KV l="Stop Loss" v={ts.stop_loss ? `₹${ts.stop_loss}` : null} />
            <KV l="Risk/Reward" v={ts.risk_reward_ratio ? `${ts.risk_reward_ratio}:1` : null} b />
          </div>

          <div style={S.section}>
            <div style={S.secTitle}>📐 Position Sizing</div>
            <KV l="Risk Tolerance" v={ps.risk_tolerance} />
            <KV l="Risk Multiplier" v={ps.risk_multiplier ? `${ps.risk_multiplier}x` : null} />
            <KV l="Suggested Allocation" v={ps.suggested_allocation} b />
          </div>
        </div>


      </div>
    );
  };

  return (
    <div style={S.container}>
      <div style={S.header}>
        <h1 style={S.h1}>📈 Stock Signal Generator</h1>
        <div style={S.subtitle}>AI-Powered NSE/BSE Stock Analysis</div>
      </div>
      



<div style={{ 
  background: '#fef3c7', 
  border: '2px solid #fbbf24', 
  borderRadius: 12, 
  padding: 12, 
  marginBottom: 16 
}}>
 <div 
   style={{ 
     display: 'flex', 
     alignItems: 'center', 
     justifyContent: 'center',  // 👈 ADD THIS to center horizontally
     gap: 8, 
     cursor: 'pointer',
     fontSize: 13,
     fontWeight: 600,
     color: '#78350f',
     position: 'relative'  // 👈 ADD THIS for absolute positioning
   }}
   onClick={() => setShowDisclaimer(!showDisclaimer)}
 >
   <span>⚠️</span>
   <span>DISCLAIMER</span>
   <span style={{ 
     position: 'absolute',  // 👈 CHANGED from marginLeft: 'auto'
     right: 0,              // 👈 ADD THIS
     fontSize: 16 
   }}>
     {showDisclaimer ? '▲' : '▼'}
   </span>
 </div>

  
  {showDisclaimer && (
    <div style={{ 
      fontSize: 11, 
      lineHeight: 1.5, 
      color: '#78350f', 
      marginTop: 8,
      paddingTop: 8,
      borderTop: '1px solid #fbbf24'
    }}>
      <strong>Educational Purpose Only.</strong> Not investment advice. 
      <strong> Not SEBI Registered.</strong> Consult a qualified advisor before investing. 
      <strong> Risk Warning:</strong> Trading involves substantial risk. You are solely responsible for your decisions.
    </div>
  )}
</div>


      



      <div style={S.card}>
        <div style={S.grid}>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={S.label}>Tickers</label>
            <input style={{ ...S.input, borderColor: valErr ? '#ef4444' : '#d1fae5' }} value={input} onChange={e => setInput(e.target.value)} placeholder="RELIANCE, TCS, SBIN, INFY" />
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>Use NSE symbols (e.g., SBIN for SBI, HDFCBANK for HDFC)</div>
            {valErr && <div style={S.err}>{valErr}</div>}
          </div>



          <div>
            <label style={S.label}>Format</label>
            <select style={S.select} value={format} onChange={e => setFormat(e.target.value)}>
              <option>Detailed</option>
              <option>Compact</option>
            </select>
          </div>

          <div>
            <label style={S.label}>Time Horizon</label>
            <select style={S.select} value={timeH} onChange={e => setTimeH(e.target.value)}>
              <option>Short-term</option>
              <option>Medium-term</option>
              <option>Long-term</option>
            </select>
          </div>

          <div>
            <label style={S.label}>Risk Tolerance</label>
            <select style={S.select} value={riskT} onChange={e => setRiskT(e.target.value)}>
              <option>Conservative</option>
              <option>Moderate</option>
              <option>Aggressive</option>
            </select>
          </div>
        </div>

        <button style={{ ...S.btn, marginTop: 16 }} onClick={run} disabled={loading}>
          {loading ? '⏳ Generating...' : '🚀 Generate Signals'}
        </button>
      </div>

      {toast && <div style={S.toast}>⚠️ {toast} <button style={{ ...S.btn2, padding: '4px 10px', marginLeft: 8 }} onClick={run}>Retry</button></div>}
      {error && !toast && <div style={{ ...S.card, background: '#fef2f2', color: '#991b1b' }}>⚠️ {error}</div>}
      {loading && <div style={{ ...S.card, textAlign: 'center', padding: 40 }}><div style={{ fontSize: 32 }}>⏳</div><div style={{ color: '#065f46', marginTop: 8 }}>Calling n8n webhook...</div></div>}

      {!loading && results.length > 0 && (
        <div style={S.card}>
          {isCompact ? <Compact /> : results.map((r: Result) => (
            <div key={r.symbol} style={S.acc}>
              <div style={{ ...S.accH, background: r.isInvalid ? '#fef2f2' : '#ecfdf5' }} onClick={() => setExpanded(expanded === r.symbol ? null : r.symbol)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#065f46' }}>{r.symbol}</span>
                  <span style={S.badge(r.signal)}>{r.signal}</span>
                  <span style={{ fontSize: 14, color: '#6b7280' }}>₹{r.current_price}</span>
                  {!r.isInvalid && <span style={{ fontSize: 13, color: '#059669' }}>{typeof r.confidence === 'number' ? `${(r.confidence * 100).toFixed(0)}%` : r.confidence} confidence</span>}
                </div>
                <div style={{ fontSize: 20 }}>{expanded === r.symbol ? '▲' : '▼'}</div>
              </div>
              {expanded === r.symbol && <div style={S.accB}><Detailed r={r} /></div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}