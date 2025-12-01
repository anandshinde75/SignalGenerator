import React, { useState, useEffect } from 'react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

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

interface KVProps {
  l: string;
  v: string | number | null | undefined;
  b?: boolean;
}

interface DetailedProps {
  r: Result;
}

// ============================================================================
// API CALL FUNCTION
// ============================================================================

const callN8N = async (payload: Payload): Promise<ApiResponse | null> => {
  // Add exchange suffix to tickers if not already present
  const tickers = payload.tickers
    .split(',')
    .map((t: string) => {
      const trimmed = t.trim().toUpperCase();
      if (trimmed.includes('.')) return trimmed;
      return `${trimmed}.${payload.exchange}`;
    })
    .join(',');

  const primaryUrl = `https://salubrious-unmagnifying-latoyia.ngrok-free.dev/webhook/signalGenerator`;
  const fallbackUrl = `/webhook/signalGenerator`;

  const requestBody = {
    'Ticker ': tickers,
    'Time Horizon': payload.timeHorizon,
    'Risk Tolerance': payload.riskTolerance,
    'Output Format': 'Detailed',
  };

  console.log('Sending to n8n:', requestBody);

  const urls = [primaryUrl, fallbackUrl];
  let lastError: Error | null = null;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`Attempting ${i === 0 ? 'primary' : 'fallback'} URL: ${url}`);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
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

      // === RESTORED: Handle error response format [{ "error": "..." }] ===
      if (Array.isArray(parsed) && parsed[0]?.error) {
        const errorMsg = parsed[0].error;
        const tickerSymbols = tickers.split(',');

        return {
          results: tickerSymbols.map((symbol) => ({
            symbol: symbol.trim(),
            current_price: 0,
            signal: 'SELL/AVOID' as const,
            confidence: '0%',
            entry_price: 0,
            target_price: 0,
            stop_loss: 0,
            isInvalid: true,
            invalidReason: `Invalid ticker: ${errorMsg}`,
          })),
        };
      }

      // Normal response handling
      let result: ApiResponse = Array.isArray(parsed) ? parsed[0] : parsed;
      console.log('Extracted result:', result);

      // === RESTORED: Validate each result for invalid symbols ===
      if (result.results) {
        result.results = result.results.map((r: Result) => {
          // Check for explicit error property
          if (r.error) {
            return { 
              ...r, 
              isInvalid: true, 
              invalidReason: r.details || r.error 
            };
          }

          // Check for missing or zero price (delisted/invalid symbol)
          if (!r.current_price || r.current_price === 0) {
            return {
              ...r,
              isInvalid: true,
              invalidReason: 'Invalid or delisted symbol - no price data available',
            };
          }

          // Check if symbol contains error indicators
          if (r.symbol && r.symbol.toLowerCase().includes('error')) {
            return {
              ...r,
              isInvalid: true,
              invalidReason: 'Symbol lookup failed',
            };
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


// ============================================================================
// STYLES - Responsive for both mobile (320px+) and desktop
// ============================================================================

const S = {
  container: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '16px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    background: 'linear-gradient(to bottom, #ecfdf5, #ffffff)',
    minHeight: '100vh',
    width: '100%',
    boxSizing: 'border-box' as const,
  },

  header: {
    background: 'linear-gradient(135deg, #047857 0%, #065f46 100%)',
    borderRadius: 8,
    padding: '10px 12px',
    marginBottom: 10,
    boxShadow: '0 2px 12px rgba(5, 150, 105, 0.12)',
  },

  h1: {
    fontSize: 18,
    fontWeight: 700,
    color: 'white',
    marginBottom: 2,
    textAlign: 'center' as const,
    letterSpacing: '-0.3px',
  },

  subtitle: {
    fontSize: 18,
    fontWeight: 700,
    color: 'white',
    marginBottom: 2,
    textAlign: 'center' as const,
    letterSpacing: '-0.3px',
  },

  card: {
    background: 'white',
    borderRadius: 12,
    padding: '20px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
    marginBottom: 16,
    border: '1px solid #d1fae5',
    width: '100%',
    boxSizing: 'border-box' as const,
  },

  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#047857',
    marginBottom: 6,
    letterSpacing: '0.3px',
  },

  input: {
    width: '100%',
    padding: '10px 14px',
    border: '2px solid #d1fae5',
    borderRadius: 8,
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'all 0.2s',
    fontFamily: 'inherit',
  },

  select: {
    width: '100%',
    padding: '10px 14px',
    border: '2px solid #d1fae5',
    borderRadius: 8,
    fontSize: 14,
    outline: 'none',
    background: 'white',
    cursor: 'pointer',
    boxSizing: 'border-box' as const,
    transition: 'all 0.2s',
    fontFamily: 'inherit',
  },

  btn: {
    width: '100%',
    padding: 14,
    background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.3s',
    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
    letterSpacing: '0.5px',
  },

  btn2: {
    padding: '6px 14px',
    background: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },

  acc: {
    marginBottom: 12,
    border: '2px solid #d1fae5',
    borderRadius: 10,
    overflow: 'hidden',
    transition: 'all 0.2s',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  },

  accH: {
    padding: 16,
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    transition: 'background 0.2s',
  },

  accB: {
    padding: 20,
    background: '#f0fdf4',
    borderTop: '2px solid #d1fae5',
  },

  kv: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #e5e7eb',
  },

  kvL: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: 500,
  },

  kvV: {
    color: '#111827',
    fontSize: 13,
    textAlign: 'right' as const,
    fontWeight: 600,
    overflowWrap: 'break-word' as const,
    wordBreak: 'break-word' as const,
    maxWidth: '60%',
  },

  err: {
    color: '#dc2626',
    fontSize: 12,
    marginTop: 4,
    fontWeight: 500,
  },

  toast: {
    position: 'fixed' as const,
    top: 20,
    right: 20,
    padding: 14,
    borderRadius: 10,
    background: '#fef2f2',
    border: '2px solid #fca5a5',
    color: '#991b1b',
    zIndex: 1000,
    boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
    maxWidth: 350,
  },

  badge: (s: string) => ({
    padding: '4px 12px',
    borderRadius: 16,
    fontSize: 12,
    fontWeight: 700,
    background: s === 'BUY' ? '#10b981' : s === 'SELL' ? '#ef4444' : '#f59e0b',
    color: 'white',
    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
    letterSpacing: '0.5px',
  }),

  th: {
    background: '#047857',
    padding: 12,
    textAlign: 'left' as const,
    fontWeight: 600,
    color: 'white',
    fontSize: 12,
    letterSpacing: '0.5px',
    textTransform: 'uppercase' as const,
  },

  td: {
    padding: 12,
    borderBottom: '1px solid #e5e7eb',
    fontSize: 13,
  },

  section: {
    marginTop: 0,
    padding: 16,
    background: '#ecfdf5',
    borderRadius: 10,
    border: '2px solid #a7f3d0',
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box' as const,
    overflowWrap: 'break-word' as const,
    wordBreak: 'break-word' as const,
  },

  secTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#047857',
    marginBottom: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },

  // === NEW: HIGHLIGHTED TRADE SETUP STYLES ===
  
  sectionHighlight: {
    marginTop: 0,
    padding: 18,
    background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
    borderRadius: 12,
    border: '3px solid #10b981',
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box' as const,
    overflowWrap: 'break-word' as const,
    wordBreak: 'break-word' as const,
    boxShadow: '0 6px 20px rgba(16, 185, 129, 0.3)',
    position: 'relative' as const,
    overflow: 'hidden' as const,
  },

  sectionHighlightSell: {
    background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
    border: '3px solid #ef4444',
    boxShadow: '0 6px 20px rgba(239, 68, 68, 0.3)',
  },

  sectionHighlightHold: {
    background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
    border: '3px solid #f59e0b',
    boxShadow: '0 6px 20px rgba(245, 158, 11, 0.3)',
  },

  ribbon: {
    position: 'absolute' as const,
    top: 12,
    right: -32,
    background: '#10b981',
    color: 'white',
    padding: '4px 40px',
    fontSize: 10,
    fontWeight: 700,
    transform: 'rotate(45deg)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    letterSpacing: '1px',
    textTransform: 'uppercase' as const,
  },

  ribbonSell: {
    background: '#ef4444',
  },

  ribbonHold: {
    background: '#f59e0b',
  },

  secTitleHighlight: {
    fontSize: 15,
    fontWeight: 800,
    color: '#047857',
    marginBottom: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.8px',
  },

  kvHighlight: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '10px 0',
    borderBottom: '2px solid #a7f3d0',
  },

  kvVHighlight: {
    color: '#065f46',
    fontSize: 14,
    textAlign: 'right' as const,
    fontWeight: 700,
    overflowWrap: 'break-word' as const,
    wordBreak: 'break-word' as const,
    maxWidth: '60%',
  },

  rrIndicator: {
    marginTop: 10,
    padding: '8px 12px',
    background: 'rgba(16, 185, 129, 0.15)',
    borderRadius: 8,
    fontSize: 11,
    color: '#047857',
    fontWeight: 700,
    textAlign: 'center' as const,
    letterSpacing: '0.5px',
  },

  // Responsive grid: stacks to 1 column on mobile (< 500px), 2 columns on desktop
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
    gap: 12,
    width: '100%',
  },

  summary: {
    background: 'linear-gradient(135deg, #fef3c7 0%, #fef9c3 100%)',
    border: '2px solid #fbbf24',
    borderRadius: 10,
    padding: 14,
    fontSize: 13,
    color: '#78350f',
    lineHeight: 1.6,
    marginTop: 0,
    marginBottom: 12,
    width: '100%',
    boxSizing: 'border-box' as const,
    overflowWrap: 'break-word' as const,
    wordBreak: 'break-word' as const,
  },

  invalid: {
    background: 'linear-gradient(135deg, #fee2e2 0%, #fef2f2 100%)',
    border: '2px solid #fca5a5',
    borderRadius: 10,
    padding: 16,
    color: '#991b1b',
  },

  footer: {
    textAlign: 'center' as const,
    fontSize: 12,
    color: '#6b7280',
    marginTop: 24,
    padding: '16px 0',
    borderTop: '1px solid #d1fae5',
  },
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const KV: React.FC<KVProps> = ({ l, v, b = false }) => (
  <div style={S.kv}>
    <div style={S.kvL}>{l}</div>
    <div style={{ ...S.kvV, fontWeight: b ? 700 : 400 }}>{v ?? '—'}</div>
  </div>
);

// === NEW: Highlighted KV Component ===
const KVHighlight: React.FC<KVProps> = ({ l, v, b = false }) => (
  <div style={S.kvHighlight}>
    <div style={S.kvL}>{l}</div>
    <div style={{ ...S.kvVHighlight, fontWeight: b ? 800 : 700 }}>{v ?? '—'}</div>
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SignalUI() {
  // State management
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

  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // API call handler
  const run = async () => {
    setError('');
    setValErr('');

    if (!input.trim()) {
      setValErr('Please enter at least one ticker');
      return;
    }

    setLoading(true);
    setData(null);
    setExpanded(null);

    try {
      const res = await callN8N({
        tickers: input,
        format,
        timeHorizon: timeH,
        riskTolerance: riskT,
        exchange,
      });

      if (res?.results) {
        setData(res);
        if (res.results[0]) setExpanded(res.results[0].symbol);
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
      setError(errorMessage);
      setToast(errorMessage);
    }

    setLoading(false);
  };

  const results = data?.results || [];
  const isCompact = format === 'Compact';

  // ------------------------------------------------------------------------
  // COMPACT VIEW COMPONENT
  // ------------------------------------------------------------------------

  const Compact = () => (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['Symbol', 'Price', 'Signal', 'Confidence', 'Entry', 'Target', 'SL'].map((h) => (
              <th key={h} style={S.th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.map((r: Result) => {
            // === ENHANCED: Handle invalid tickers with detailed message ===
            if (r.isInvalid) {
              return (
                <tr key={r.symbol} style={{ background: '#fef2f2' }}>
                  <td style={{ ...S.td, fontWeight: 700, color: '#991b1b' }}>
                    {r.symbol}
                  </td>
                  <td colSpan={6} style={{ ...S.td, color: '#991b1b', fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>⚠️</span>
                      <span>{r.invalidReason || 'Invalid or delisted symbol'}</span>
                    </div>
                  </td>
                </tr>
              );
            }
  
            const ts = r.trade_setup || {};
  
            return (
              <tr key={r.symbol}>
                <td style={{ ...S.td, fontWeight: 700 }}>{r.symbol}</td>
                <td style={S.td}>₹{r.current_price}</td>
                <td style={S.td}>
                  <span style={S.badge(r.signal)}>{r.signal}</span>
                </td>
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


  // ------------------------------------------------------------------------
  // DETAILED VIEW COMPONENT (WITH HIGHLIGHTED TRADE SETUP)
  // ------------------------------------------------------------------------

  const Detailed: React.FC<DetailedProps> = ({ r }) => {
    const pl = r.price_levels || {};
    const ti = r.technical_indicators || {};
    const ts = r.trade_setup || {};
    const sc = r.analysis_scores || r.scores || {};
    const ps = r.position_sizing || {};
  
    // === ENHANCED: Handle invalid symbols with detailed error ===
    if (r.isInvalid) {
      return (
        <div style={S.invalid}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 24 }}>⚠️</span>
            <span>Invalid Symbol: {r.symbol}</span>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
            {r.invalidReason || 'This symbol may be delisted, invalid, or not found on the exchange.'}
          </div>
          <div style={{ 
            fontSize: 11, 
            background: 'rgba(153, 27, 27, 0.1)', 
            padding: 10, 
            borderRadius: 6,
            lineHeight: 1.5
          }}>
            <strong>Common Issues:</strong>
            <ul style={{ margin: '6px 0 0 0', paddingLeft: 20 }}>
              <li>Symbol may be delisted or suspended</li>
              <li>Check if you're using the correct NSE symbol (e.g., SBIN not SBI)</li>
              <li>Verify the symbol exists on NSE India</li>
              <li>Some symbols require .NS or .BO suffix</li>
            </ul>
          </div>
        </div>
      );
    }
  
    // === NEW: Determine Trade Setup Style Based on Signal ===
    const getTradeSetupStyle = () => {
      const baseStyle = { ...S.sectionHighlight };
      
      if (r.signal === 'SELL' || r.signal === 'SELL/AVOID') {
        return { ...baseStyle, ...S.sectionHighlightSell };
      } else if (r.signal === 'HOLD') {
        return { ...baseStyle, ...S.sectionHighlightHold };
      }
      
      return baseStyle; // BUY (default green)
    };

    const getRibbonStyle = () => {
      const baseStyle = { ...S.ribbon };
      
      if (r.signal === 'SELL' || r.signal === 'SELL/AVOID') {
        return { ...baseStyle, ...S.ribbonSell };
      } else if (r.signal === 'HOLD') {
        return { ...baseStyle, ...S.ribbonHold };
      }
      
      return baseStyle; // BUY
    };

    const getRibbonText = () => {
      if (r.signal === 'BUY') return 'ACTIONABLE';
      if (r.signal === 'SELL' || r.signal === 'SELL/AVOID') return 'EXIT';
      return 'WATCH';
    };

    return (
      <div>
        {/* Company Name */}
        {r.company_name && (
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 10 }}>
            {r.company_name}
          </div>
        )}

        {/* Analysis Summary */}
        {(r.summary || r.analysis_summary) && (
          <div style={S.summary}>
            <strong>📝 Analysis Summary:</strong> {r.analysis_summary || r.summary}
          </div>
        )}

        {/* Data Grid */}
        <div style={S.grid}>
           
          {/* === HIGHLIGHTED TRADE SETUP CARD === */}
          <div style={getTradeSetupStyle()}>
            {/* Ribbon Badge */}
            <div style={getRibbonStyle()}>
              {getRibbonText()}
            </div>
            
            <div style={S.secTitleHighlight}>
              ⚖️ TRADE SETUP {r.signal === 'BUY' ? '🚀' : r.signal === 'SELL' || r.signal === 'SELL/AVOID' ? '⚠️' : '👀'}
            </div>
            
            <KVHighlight l="Entry Zone" v={ts.entry_zone} />
            <KVHighlight l="Target 1" v={ts.target_1 ? `₹${ts.target_1}` : null} />
            <KVHighlight l="Target 2" v={ts.target_2 ? `₹${ts.target_2}` : null} />
            <KVHighlight l="Stop Loss" v={ts.stop_loss ? `₹${ts.stop_loss}` : null} />
            <KVHighlight l="Risk/Reward" v={ts.risk_reward_ratio ? `${ts.risk_reward_ratio}:1` : null} b />
            
            {/* Risk/Reward Indicator */}
            {ts.risk_reward_ratio && ts.risk_reward_ratio >= 2 && (
              <div style={S.rrIndicator}>
                ✓ FAVORABLE RISK/REWARD RATIO
              </div>
            )}
          </div>
          
          {/* Analysis Scores */}
          <div style={S.section}>
            <div style={S.secTitle}>🎯 Analysis Scores</div>
            <KV l="Technical" v={sc.technical ? `${sc.technical}/10` : null} />
            <KV l="Fundamental" v={sc.fundamental ? `${sc.fundamental}/10` : null} />
            <KV l="Sentiment" v={sc.sentiment ? `${sc.sentiment}/10` : null} />
            <KV l="Total Score" v={sc.total ? `${sc.total}/30` : null} b />
          </div>
        
          {/* Price Overview */}
          <div style={S.section}>
            <div style={S.secTitle}>📊 Price Overview</div>
            <KV l="Current Price" v={`₹${r.current_price}`} b />
            <KV l="52W High" v={pl['52_week_high'] ? `₹${pl['52_week_high']}` : null} />
            <KV l="52W Low" v={pl['52_week_low'] ? `₹${pl['52_week_low']}` : null} />
            <KV l="Support" v={pl.support ? `₹${pl.support}` : null} />
            <KV l="Resistance" v={pl.resistance ? `₹${pl.resistance}` : null} />
          </div>

          {/* Technical Indicators */}
          <div style={S.section}>
            <div style={S.secTitle}>📈 Technical Indicators</div>
            <KV l="20 DMA" v={ti['20_dma'] ? `₹${ti['20_dma']}` : null} />
            <KV l="50 DMA" v={ti['50_dma'] ? `₹${ti['50_dma']}` : null} />
            <KV l="200 DMA" v={ti['200_dma'] ? `₹${ti['200_dma']}` : null} />
            <KV l="RSI (14)" v={ti.rsi_14} />
            <KV l="MACD Line" v={ti.macd?.macd_line} />
            <KV l="Signal Line" v={ti.macd?.signal_line} />
            <KV l="Histogram" v={ti.macd?.histogram} />
            <KV l="Trend" v={ti.trend} b />
          </div>

          {/* Position Sizing */}
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

  // ------------------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------------------

  return (
    <div style={S.container}>
      {/* CSS Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.01);
          }
        }
      `}</style>

      {/* Header */}
      <div style={S.header}>
        <h1 style={S.h1}>📈 Stock Signal Generator</h1>
        <div style={S.subtitle}>AI-Powered NSE Stock Analysis</div>
      </div>

      {/* Collapsible Disclaimer */}
      <div
        style={{
          background: '#fef3c7',
          border: '2px solid #fbbf24',
          borderRadius: 10,
          padding: 10,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            color: '#78350f',
            position: 'relative',
          }}
          onClick={() => setShowDisclaimer(!showDisclaimer)}
        >
          <span>⚠️</span>
          <span>DISCLAIMER</span>
          <span style={{ position: 'absolute', right: 0, fontSize: 14 }}>
            {showDisclaimer ? '▲' : '▼'}
          </span>
        </div>

        {showDisclaimer && (
          <div
            style={{
              fontSize: 10,
              lineHeight: 1.5,
              color: '#78350f',
              marginTop: 8,
              paddingTop: 8,
              borderTop: '1px solid #fbbf24',
            }}
          >
            <strong>Educational Purpose Only.</strong> Not investment advice.{' '}
            <strong>Not SEBI Registered.</strong> Consult a qualified advisor before investing.{' '}
            <strong>Risk Warning:</strong> Trading involves substantial risk. You are solely
            responsible for your decisions.
          </div>
        )}
      </div>

      {/* Input Form */}
      <div style={S.card}>
        <div style={S.grid}>
          {/* Ticker Input - Spans full width */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={S.label}>Tickers</label>
            <input
              style={{ ...S.input, borderColor: valErr ? '#ef4444' : '#d1fae5' }}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="RELIANCE, TCS, SBIN, INFY"
            />
            <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>
              Use NSE symbols (e.g., SBIN for SBI, HDFCBANK for HDFC)
            </div>
            {valErr && <div style={S.err}>{valErr}</div>}
          </div>

          {/* Time Horizon */}
          <div>
            <label style={S.label}>Time Horizon</label>
            <select style={S.select} value={timeH} onChange={(e) => setTimeH(e.target.value)}>
              <option>Short-term 1-4 weeks</option>
              <option>Medium-term 1-3 months</option>
              <option>Long-term 3-12 months</option>
            </select>
          </div>

          {/* Risk Tolerance */}
          <div>
            <label style={S.label}>Risk Tolerance</label>
            <select style={S.select} value={riskT} onChange={(e) => setRiskT(e.target.value)}>
              <option>Conservative</option>
              <option>Moderate</option>
              <option>Aggressive</option>
            </select>
          </div>
          
          {/* Format Selection */}
          <div>
            <label style={S.label}>Format</label>
            <select style={S.select} value={format} onChange={(e) => setFormat(e.target.value)}>
              <option>Detailed</option>
              <option>Compact</option>
            </select>
          </div>
        </div>

        {/* Submit Button */}
        <button style={{ ...S.btn, marginTop: 12 }} onClick={run} disabled={loading}>
          {loading ? '⏳ Generating...' : '🚀 Generate Signals'}
        </button>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div style={S.toast}>
          ⚠️ {toast}{' '}
          <button style={{ ...S.btn2, padding: '4px 10px', marginLeft: 8 }} onClick={run}>
            Retry
          </button>
        </div>
      )}

      {/* Error Display */}
      {error && !toast && (
        <div style={{ ...S.card, background: '#fef2f2', color: '#991b1b' }}>⚠️ {error}</div>
      )}

      {/* Loading State */}
      {loading && (
        <div style={{ ...S.card, textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 28 }}>⏳</div>
          <div style={{ color: '#065f46', marginTop: 8 }}>Doing Technical, Fundamental and Sentimental analysis...</div>
        </div>
      )}

      {/* Results Display */}
      {!loading && results.length > 0 && (
        <div style={S.card}>
          {isCompact ? (
            <Compact />
          ) : (
            results.map((r: Result) => (
              <div key={r.symbol} style={S.acc}>
                <div
                  style={{ ...S.accH, background: r.isInvalid ? '#fef2f2' : '#ecfdf5' }}
                  onClick={() => setExpanded(expanded === r.symbol ? null : r.symbol)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: '#065f46' }}>
                      {r.symbol}
                    </span>
                    <span style={S.badge(r.signal)}>{r.signal}</span>
                    <span style={{ fontSize: 13, color: '#6b7280' }}>₹{r.current_price}</span>
                    {!r.isInvalid && (
                      <span style={{ fontSize: 12, color: '#059669' }}>
                        {typeof r.confidence === 'number'
                          ? `${(r.confidence * 100).toFixed(0)}%`
                          : r.confidence}{' '}
                        confidence
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 18 }}>{expanded === r.symbol ? '▲' : '▼'}</div>
                </div>
                {expanded === r.symbol && (
                  <div style={S.accB}>
                    <Detailed r={r} />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
