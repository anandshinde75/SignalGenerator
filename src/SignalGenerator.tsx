import React, { useState, useEffect } from "react";

// ============ CONFIGURATION ============
const N8N_WEBHOOK_URL = "http://localhost:5678/webhook/signalGenerator";

// ============ N8N API CALL ============
const callN8N = async (payload) => {
  // Add exchange suffix to tickers if not already present
  const tickers = payload.tickers.split(',').map(t => {
    const trimmed = t.trim().toUpperCase();
    if (trimmed.includes('.')) return trimmed; // Already has suffix
    return `${trimmed}.${payload.exchange}`; // Add exchange suffix
  }).join(', ');

  const n8nPayload = {
    "Ticker ": tickers,
    "Time Horizon": payload.timeHorizon,
    "Risk Tolerance": payload.riskTolerance,
    "Output Format": payload.format
  };
  const response = await fetch(N8N_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(n8nPayload)
  });
  if (!response.ok) throw new Error(`Server error: ${response.status}`);
  const data = await response.json();
  
  // Handle n8n response formats
  let result;
  if (Array.isArray(data)) {
    result = data[0]?.results ? data[0] : { results: data };
  } else if (data.results) {
    result = data;
  } else {
    result = { results: [data] };
  }
  
  // Validate each result for invalid symbols
  if (result.results) {
    result.results = result.results.map(r => {
      // Check if there's an error in the response
      if (r.error) {
        return { ...r, isInvalid: true, invalidReason: r.details || r.error };
      }
      // Check for mutual fund or invalid instrument type (from raw price data if available)
      if (r.Price_Data?.chart?.result?.[0]?.meta) {
        const meta = r.Price_Data.chart.result[0].meta;
        if (meta.instrumentType === 'MUTUALFUND') {
          return { 
            ...r, 
            isInvalid: true, 
            invalidReason: `"${r.symbol || meta.symbol}" is a mutual fund, not a stock. For State Bank of India, use SBIN instead of SBI.`
          };
        }
        if (meta.exchangeName === 'YHD' || !meta.currency) {
          return { 
            ...r, 
            isInvalid: true, 
            invalidReason: `"${r.symbol || meta.symbol}" is not a valid NSE/BSE stock symbol. Please check the ticker name.`
          };
        }
      }
      return r;
    });
  }
  
  return result;
};

// ============ STYLES ============
const S = {
  wrap: { minHeight: '100vh', background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)', padding: 16, fontFamily: 'system-ui' },
  card: { background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', marginBottom: 16 },
  hdr: { color: '#ecfdf5', marginBottom: 20, maxWidth: 1100, margin: '0 auto 20px' },
  label: { display: 'block', fontSize: 11, fontWeight: 600, color: '#065f46', marginBottom: 6, textTransform: 'uppercase' },
  input: { width: '100%', padding: 12, border: '2px solid #d1fae5', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  select: { padding: 12, border: '2px solid #d1fae5', borderRadius: 8, fontSize: 14, background: '#fff', width: '100%' },
  btn: { padding: '12px 24px', background: 'linear-gradient(135deg,#059669,#047857)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' },
  btn2: { padding: '10px 16px', background: '#fff', color: '#047857', border: '2px solid #a7f3d0', borderRadius: 8, fontWeight: 500, cursor: 'pointer' },
  err: { color: '#dc2626', fontSize: 12, marginTop: 6 },
  toast: { position: 'fixed', top: 16, right: 16, padding: 14, borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', zIndex: 1000 },
  badge: (s) => ({ padding: '5px 14px', borderRadius: 99, fontSize: 12, fontWeight: 700, background: s === 'BUY' ? '#dcfce7' : s === 'SELL' ? '#fee2e2' : '#fef9c3', color: s === 'BUY' ? '#166534' : s === 'SELL' ? '#991b1b' : '#854d0e' }),
  th: { background: '#ecfdf5', padding: 12, textAlign: 'left', fontWeight: 600, color: '#065f46', borderBottom: '2px solid #a7f3d0' },
  td: { padding: 12, borderBottom: '1px solid #e5e7eb' },
  section: { marginTop: 16, padding: 16, background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0' },
  secTitle: { fontSize: 14, fontWeight: 700, color: '#065f46', marginBottom: 12 },
  kv: { display: 'flex', borderBottom: '1px solid #e5e7eb', fontSize: 13 },
  kvL: { flex: '0 0 45%', padding: 8, fontWeight: 500, background: '#f9fafb' },
  kvV: { flex: 1, padding: 8 },
  acc: { border: '2px solid #d1fae5', borderRadius: 10, marginBottom: 12, overflow: 'hidden' },
  accH: { padding: 16, background: '#ecfdf5', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  disc: { background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 10, padding: 14, fontSize: 12, color: '#92400e', marginTop: 16 }
};

const KV = ({ l, v, b }) => <div style={S.kv}><div style={S.kvL}>{l}</div><div style={{ ...S.kvV, fontWeight: b ? 700 : 400 }}>{v ?? '—'}</div></div>;

export default function SignalUI() {
  const [input, setInput] = useState('RELIANCE');
  const [format, setFormat] = useState('Detailed');
  const [timeH, setTimeH] = useState('Medium-term');
  const [riskT, setRiskT] = useState('Moderate');
  const [exchange, setExchange] = useState('NS');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [valErr, setValErr] = useState('');
  const [toast, setToast] = useState(null);
  const [data, setData] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 5000); return () => clearTimeout(t); } }, [toast]);

  const run = async () => {
    setError(''); setValErr('');
    if (!input.trim()) { setValErr('Enter at least one ticker'); return; }
    setLoading(true); setData(null);
    try {
      const res = await callN8N({ tickers: input, format, timeHorizon: timeH, riskTolerance: riskT, exchange });
      if (res?.results) { setData(res); if (res.results[0]) setExpanded(res.results[0].symbol); }
    } catch (e) { setError(e.message); setToast(e.message); }
    setLoading(false);
  };

  const results = data?.results || [];
  const isCompact = format.toLowerCase().startsWith('compact');

  const Compact = () => (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{['Symbol', 'Price', 'Signal', 'Confidence', 'Entry', 'Target', 'SL'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
        <tbody>{results.map(r => <tr key={r.symbol}>
          <td style={{ ...S.td, fontWeight: 700 }}>{r.symbol}</td>
          <td style={S.td}>₹{r.current_price}</td>
          <td style={S.td}><span style={S.badge(r.signal)}>{r.signal}</span></td>
          <td style={S.td}>{Math.round(r.confidence * 100)}%</td>
          <td style={S.td}>{r.trade_setup?.entry_zone || '—'}</td>
          <td style={S.td}>₹{r.trade_setup?.target_1 || '—'}</td>
          <td style={S.td}>₹{r.trade_setup?.stop_loss || '—'}</td>
        </tr>)}</tbody>
      </table>
    </div>
  );

  const Detailed = ({ r }) => {
    const pl = r.price_levels || {};
    const ti = r.technical_indicators || {};
    const ts = r.trade_setup || {};
    const ps = r.position_sizing || {};
    const sc = r.scores || {};

    return (
      <div style={{ padding: 16 }}>
        {r.company_name && <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>{r.company_name}</div>}
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
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

        {r.analysis_summary && (
          <div style={S.section}>
            <div style={S.secTitle}>📋 Analysis Summary</div>
            <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>{r.analysis_summary}</p>
          </div>
        )}

        <button style={{ ...S.btn2, marginTop: 12 }} onClick={() => navigator.clipboard.writeText(JSON.stringify(r, null, 2))}>📋 Copy JSON</button>
      </div>
    );
  };

  return (
    <div style={S.wrap}>
      <header style={S.hdr}>
        <div style={{ fontSize: 24, fontWeight: 700 }}>💎 AI Signal Generator</div>
        <div style={{ fontSize: 13, color: '#a7f3d0' }}>v4.7-Pro • 🔗 n8n Connected</div>
      </header>
      <main style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={S.card}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={S.label}>Tickers</label>
              <input style={{ ...S.input, borderColor: valErr ? '#ef4444' : '#d1fae5' }} value={input} onChange={e => setInput(e.target.value)} placeholder="RELIANCE, TCS, SBIN, INFY" />
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>Use NSE symbols (e.g., SBIN for SBI, HDFCBANK for HDFC)</div>
              {valErr && <div style={S.err}>{valErr}</div>}
            </div>
            <div><label style={S.label}>Format</label><select style={S.select} value={format} onChange={e => setFormat(e.target.value)}><option>Detailed</option><option>Compact</option></select></div>
            <div><label style={S.label}>Horizon</label><select style={S.select} value={timeH} onChange={e => setTimeH(e.target.value)}><option>Short-term</option><option>Medium-term</option><option>Long-term</option></select></div>
            <div><label style={S.label}>Risk</label><select style={S.select} value={riskT} onChange={e => setRiskT(e.target.value)}><option>Conservative</option><option>Moderate</option><option>Aggressive</option></select></div>
            <div><label style={S.label}>Exchange</label><select style={S.select} value={exchange} onChange={e => setExchange(e.target.value)}><option value="NS">NSE (India)</option><option value="BO">BSE (India)</option></select></div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button style={S.btn} onClick={run} disabled={loading}>{loading ? '⏳ Analyzing...' : '🚀 Run Analysis'}</button>
            <button style={S.btn2} onClick={() => setInput('')}>Clear</button>
            {results.length > 0 && <button style={S.btn2} onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)])); a.download = `signal-${Date.now()}.json`; a.click(); }}>📄 Export JSON</button>}
          </div>
        </div>

        {toast && <div style={S.toast}>⚠️ {toast} <button style={{ ...S.btn2, padding: '4px 10px', marginLeft: 8 }} onClick={run}>Retry</button></div>}
        {error && !toast && <div style={{ ...S.card, background: '#fef2f2', color: '#991b1b' }}>⚠️ {error}</div>}
        {loading && <div style={{ ...S.card, textAlign: 'center', padding: 40 }}><div style={{ fontSize: 32 }}>⏳</div><div style={{ color: '#065f46', marginTop: 8 }}>Calling n8n webhook...</div></div>}

        {!loading && results.length > 0 && (
          <div style={S.card}>
            {isCompact ? <Compact /> : results.map(r => (
              <div key={r.symbol} style={S.acc}>
                <div style={{ ...S.accH, background: r.isInvalid ? '#fef2f2' : '#ecfdf5' }} onClick={() => setExpanded(expanded === r.symbol ? null : r.symbol)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <strong>{r.symbol}</strong>
                    {r.isInvalid ? (
                      <span style={{ color: '#dc2626', fontSize: 13 }}>❌ Invalid Symbol</span>
                    ) : (
                      <>
                        <span style={{ color: '#6b7280' }}>₹{r.current_price}</span>
                        <span style={S.badge(r.signal)}>{r.signal}</span>
                        <span style={{ fontSize: 13 }}>{Math.round(r.confidence * 100)}% confidence</span>
                      </>
                    )}
                  </div>
                  <span>{expanded === r.symbol ? '▼' : '▶'}</span>
                </div>
                {expanded === r.symbol && (
                  r.isInvalid ? (
                    <div style={{ padding: 16, background: '#fef2f2', borderTop: '1px solid #fecaca' }}>
                      <div style={{ color: '#991b1b', marginBottom: 12 }}>
                        <strong>⚠️ Symbol Error:</strong> {r.invalidReason}
                      </div>
                      <div style={{ fontSize: 13, color: '#6b7280' }}>
                        <strong>Common NSE Symbol Tips:</strong>
                        <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                          <li>State Bank of India → <strong>SBIN</strong> (not SBI)</li>
                          <li>HDFC Bank → <strong>HDFCBANK</strong> (not HDFC)</li>
                          <li>ICICI Bank → <strong>ICICIBANK</strong> (not ICICI)</li>
                        </ul>
                        <a href="https://www.nseindia.com/market-data/live-equity-market" target="_blank" rel="noopener noreferrer" style={{ color: '#047857' }}>
                          🔗 Find correct symbols on NSE website
                        </a>
                      </div>
                    </div>
                  ) : <Detailed r={r} />
                )}
              </div>
            ))}
            <div style={S.disc}>⚠️ <strong>Disclaimer:</strong> {data?.disclaimer || "This analysis is not investment advice. Not SEBI-registered. For educational purposes only."}</div>
          </div>
        )}

        {!loading && results.length === 0 && !error && <div style={{ ...S.card, textAlign: 'center', color: '#6b7280' }}>Enter tickers and click "Run Analysis"</div>}
      </main>
    </div>
  );
}