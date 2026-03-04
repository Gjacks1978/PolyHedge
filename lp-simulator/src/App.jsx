import { useState, useMemo, useEffect, useRef } from "react";

// ─── MATH UTILS ───────────────────────────────────────────────
function normCDF(x) {
  const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;
  const sign=x<0?-1:1; x=Math.abs(x);
  const t=1/(1+p*x);
  const y=1-((((a5*t+a4)*t+a3)*t+a2)*t+a1)*t*Math.exp(-x*x);
  return 0.5*(1+sign*y);
}
function bsPut(S,K,T,iv){
  const t=T/365; if(t<=0) return Math.max(0,K-S);
  const d1=(Math.log(S/K)+0.5*iv*iv*t)/(iv*Math.sqrt(t));
  const d2=d1-iv*Math.sqrt(t);
  return K*Math.exp(-0.04*t)*normCDF(-d2)-S*normCDF(-d1);
}
function ilPct(P,S0){ const r=P/S0; return 1-(2*Math.sqrt(r)/(1+r)); }
function holdValue(P,S0,C){ return C/2+(C/2/S0)*P; }
function lpValue(P,S0,Plo,Phi,C){
  if(P<=Plo){ const lpAtPlo=holdValue(Plo,S0,C)*(1-ilPct(Plo,S0)); return lpAtPlo+(lpAtPlo/Plo)*(P-Plo); }
  if(P>=Phi){ return holdValue(Phi,S0,C)*(1-ilPct(Phi,S0)); }
  return holdValue(P,S0,C)*(1-ilPct(P,S0));
}
function fmtUSD(v,sign=true){ 
  const abs="$"+Math.abs(v).toFixed(0);
  if(!sign) return abs;
  return v>=0?"+"+abs:"-"+abs;
}
function col(v){ return v>0?"#4ade80":v<0?"#f87171":"#888"; }

// Polymarket odd decay
function oddAtDay(entryOdd,entryDay,currentDay,totalDays=7){
  const rem=totalDays-currentDay; const remEntry=totalDays-entryDay;
  if(rem<=0||remEntry<=0) return 0;
  return entryOdd*(rem/remEntry);
}

// ─── SHARED STYLES ────────────────────────────────────────────
const S = {
  bg: "#070710",
  surface: "#0e0e1a",
  border: "#1a1a2e",
  borderHover: "#2a2a4a",
  gold: "#e8b84b",
  green: "#3dd68c",
  red: "#f06060",
  blue: "#5b9cf6",
  purple: "#a78bfa",
  dim: "#454560",
  text: "#d4d4e8",
  textDim: "#7070a0",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@300;400;500&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:${S.bg};}
  input[type=range]{accent-color:${S.gold};width:100%;cursor:pointer;height:4px;}
  input[type=number]{background:#0a0a18;border:1px solid ${S.border};color:${S.text};
    font-family:'JetBrains Mono',monospace;font-size:14px;padding:8px 10px;border-radius:6px;width:100%;
    outline:none;transition:border-color 0.2s;}
  input[type=number]:focus{border-color:${S.gold};}
  input[type=number]::-webkit-inner-spin-button{opacity:0.4;}
  .card{background:${S.surface};border:1px solid ${S.border};border-radius:10px;padding:18px;}
  .tab{cursor:pointer;padding:10px 20px;font-family:'Syne',sans-serif;font-size:13px;font-weight:600;
    border-radius:8px;transition:all 0.2s;letter-spacing:0.5px;}
  .tab.active{background:${S.gold};color:#000;}
  .tab.inactive{color:${S.textDim};background:transparent;}
  .tab.inactive:hover{color:${S.text};background:${S.border};}
  table{width:100%;border-collapse:collapse;}
  th{color:${S.dim};font-size:10px;text-align:right;padding:6px 8px;
    border-bottom:1px solid ${S.border};font-family:'JetBrains Mono',monospace;letter-spacing:1px;}
  th:first-child{text-align:left;}
  td{font-size:12px;font-family:'JetBrains Mono',monospace;text-align:right;
    padding:7px 8px;border-bottom:1px solid #0a0a15;}
  td:first-child{text-align:left;color:${S.textDim};}
  tr:hover td{background:#0f0f1e;}
  .label{font-size:10px;color:${S.textDim};letter-spacing:1.5px;font-family:'JetBrains Mono',monospace;margin-bottom:6px;}
  .value{font-size:22px;font-family:'Syne',sans-serif;font-weight:700;}
  .pill{display:inline-block;padding:5px 14px;border-radius:20px;font-size:11px;
    cursor:pointer;font-family:'JetBrains Mono',monospace;transition:all 0.15s;margin:2px;}
  .sep{border-left:1px solid ${S.border};}
  .insight{padding:14px 16px;background:#090914;border-radius:8px;
    border-left:3px solid ${S.gold};font-size:12px;color:${S.textDim};
    font-family:'JetBrains Mono',monospace;line-height:1.8;margin-top:14px;}
`;

// ─── INPUT FIELD ──────────────────────────────────────────────
function Field({ label, value, onChange, prefix = "", suffix = "", min, max, step = 1 }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {prefix && <span style={{ color: S.gold, fontFamily: "'JetBrains Mono'", fontSize: 14 }}>{prefix}</span>}
        <input type="number" value={value} min={min} max={max} step={step}
          onChange={e => onChange(+e.target.value)}
          style={{ flex: 1 }} />
        {suffix && <span style={{ color: S.textDim, fontFamily: "'JetBrains Mono'", fontSize: 12 }}>{suffix}</span>}
      </div>
    </div>
  );
}

// ─── STAT CARD ────────────────────────────────────────────────
function Stat({ label, value, color, small }) {
  return (
    <div className="card" style={{ textAlign: "center" }}>
      <div className="label">{label}</div>
      <div className="value" style={{ fontSize: small ? 16 : 22, color: color || S.gold }}>{value}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 1 — LP + PUT SIMULATOR
// ═══════════════════════════════════════════════════════════════
function TabPut() {
  const [ethPrice, setEthPrice] = useState(2000);
  const [capital, setCapital] = useState(4000);
  const [rangePct, setRangePct] = useState(10);
  const [apr, setApr] = useState(100);
  const [strike, setStrike] = useState(1800);
  const [contracts, setContracts] = useState(1);
  const [expiry, setExpiry] = useState(45);
  const [iv] = useState(0.85);

  const Plo = ethPrice * (1 - rangePct / 100);
  const Phi = ethPrice * (1 + rangePct / 100);
  const feesDay = capital * (apr / 100) / 365;
  const premium = useMemo(() => bsPut(ethPrice, strike, expiry, iv) * contracts, [ethPrice, strike, expiry, iv, contracts]);
  const premiumPct = (premium / capital * 100).toFixed(2);
  const breakEvenDays = premium / feesDay;

  const SCENARIOS = [-50,-40,-30,-25,-20,-15,-12.5,-10,-5,0,5,10,12.5,20,25,30,40,50];

  const rows = useMemo(() => SCENARIOS.map(pct => {
    const P = ethPrice * (1 + pct / 100);
    const lp = lpValue(P, ethPrice, Plo, Phi, capital);
    const lpPnL = lp - capital;
    const putPayoff = Math.max(0, (strike - P) * contracts);
    const net = lpPnL + putPayoff - premium;
    const coverage = putPayoff > 0 && lpPnL < 0 ? Math.min(100, putPayoff / Math.abs(lpPnL) * 100) : (putPayoff > 0 ? 100 : 0);
    return { pct, P, lpPnL, putPayoff, net, coverage };
  }), [ethPrice, capital, Plo, Phi, strike, contracts, premium]);

  const coverageScenarios = rows.filter(r => [-12.5, -20, -30, -50].includes(r.pct));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Pool inputs */}
      <div className="card">
        <div className="label" style={{ marginBottom: 14 }}>CONFIGURAÇÃO DA POOL</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          <Field label="PREÇO ETH" value={ethPrice} onChange={setEthPrice} prefix="$" min={100} max={10000} step={10} />
          <Field label="CAPITAL TOTAL" value={capital} onChange={setCapital} prefix="$" min={500} max={100000} step={100} />
          <Field label="RANGE (CADA LADO)" value={rangePct} onChange={setRangePct} suffix="%" min={1} max={50} step={0.5} />
          <Field label="APR ESTIMADO" value={apr} onChange={setApr} suffix="% aa" min={10} max={500} step={5} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 14 }}>
          <Stat label="LIMITE INFERIOR" value={`$${Plo.toFixed(0)}`} color={S.red} small />
          <Stat label="ENTRADA ETH" value={`$${ethPrice}`} color={S.gold} small />
          <Stat label="LIMITE SUPERIOR" value={`$${Phi.toFixed(0)}`} color={S.green} small />
          <Stat label="FEES / DIA" value={`$${feesDay.toFixed(1)}`} color={S.blue} small />
        </div>
      </div>

      {/* Put inputs */}
      <div className="card">
        <div className="label" style={{ marginBottom: 14 }}>CONFIGURAÇÃO DA PUT</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span className="label">STRIKE</span>
              <span style={{ color: S.gold, fontSize: 14, fontFamily: "'JetBrains Mono'" }}>${strike} ({((1 - strike / ethPrice) * 100).toFixed(1)}% abaixo)</span>
            </div>
            <input type="range" min={ethPrice * 0.5} max={ethPrice} step={50}
              value={strike} onChange={e => setStrike(+e.target.value)} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: S.dim, marginTop: 3 }}>
              <span>-50%</span><span>ATM</span>
            </div>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span className="label">CONTRATOS</span>
              <span style={{ color: S.gold, fontSize: 14, fontFamily: "'JetBrains Mono'" }}>{contracts} ETH</span>
            </div>
            <input type="range" min={0.5} max={5} step={0.5}
              value={contracts} onChange={e => setContracts(+e.target.value)} />
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span className="label">VENCIMENTO</span>
              <span style={{ color: S.gold, fontSize: 14, fontFamily: "'JetBrains Mono'" }}>{expiry} dias</span>
            </div>
            <input type="range" min={7} max={90} step={7}
              value={expiry} onChange={e => setExpiry(+e.target.value)} />
          </div>
        </div>

        {/* Premium summary */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginTop: 16 }}>
          <Stat label="PRÊMIO TOTAL"
            value={`$${premium.toFixed(0)}`}
            color={+premiumPct <= 2 ? S.green : +premiumPct <= 3 ? S.gold : S.red} small />
          <Stat label="% DO CAPITAL" value={`${premiumPct}%`}
            color={+premiumPct <= 2 ? S.green : S.gold} small />
          <Stat label="BREAK-EVEN" value={`${breakEvenDays.toFixed(1)} dias`} color={S.blue} small />
          <div className="card" style={{ textAlign: "center" }}>
            <div className="label">TICKER DERIBIT</div>
            <div style={{ fontSize: 12, color: S.purple, fontFamily: "'JetBrains Mono'", fontWeight: 500, marginTop: 4 }}>
              ETH-{expiry <= 30 ? "28MAR26" : expiry <= 60 ? "25APR26" : "27JUN26"}-{strike}-P
            </div>
          </div>
        </div>
      </div>

      {/* Coverage cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {coverageScenarios.map(s => {
          const cov = s.coverage.toFixed(0);
          const covColor = +cov > 70 ? S.green : +cov > 40 ? S.gold : S.red;
          return (
            <div key={s.pct} className="card">
              <div className="label">ETH {s.pct}%</div>
              <div style={{ fontSize: 13, color: S.red, marginBottom: 4 }}>Perda LP: {fmtUSD(s.lpPnL)}</div>
              <div style={{ fontSize: 13, color: S.green }}>Put paga: {s.putPayoff > 0 ? fmtUSD(s.putPayoff) : "—"}</div>
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${S.border}` }}>
                <div className="label">COBERTURA</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: covColor }}>{cov}%</div>
                <div style={{ fontSize: 12, color: col(s.net), marginTop: 2 }}>Líquido: {fmtUSD(s.net)}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Full table */}
      <div className="card">
        <div className="label" style={{ marginBottom: 12 }}>TABELA COMPLETA</div>
        <table>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>CENÁRIO</th>
              <th>ETH</th>
              <th>P&L LP</th>
              <th>PUT PAGA</th>
              <th>PRÊMIO</th>
              <th>P&L LÍQUIDO</th>
              <th>SEM HEDGE</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(s => (
              <tr key={s.pct} style={{ background: s.pct === 0 ? "#0f0f1a" : "" }}>
                <td style={{ color: s.pct < 0 ? S.red : s.pct > 0 ? S.green : S.gold }}>
                  ETH {s.pct > 0 ? "+" : ""}{s.pct}%
                </td>
                <td>${s.P.toFixed(0)}</td>
                <td style={{ color: col(s.lpPnL) }}>{fmtUSD(s.lpPnL)}</td>
                <td style={{ color: s.putPayoff > 0 ? S.green : S.dim }}>
                  {s.putPayoff > 0 ? fmtUSD(s.putPayoff) : "—"}
                </td>
                <td style={{ color: S.red }}>-${premium.toFixed(0)}</td>
                <td style={{ fontWeight: 600, color: col(s.net) }}>{fmtUSD(s.net)}</td>
                <td style={{ color: col(s.lpPnL) }}>{fmtUSD(s.lpPnL)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize: 10, color: S.dim, marginTop: 10, fontFamily: "'JetBrains Mono'" }}>
          * P&L da LP não inclui fees · Prêmio calculado via Black-Scholes IV {(iv * 100).toFixed(0)}%aa
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 2 — POLYMARKET HEDGE
// ═══════════════════════════════════════════════════════════════
function TabPolymarket() {
  const [ethPrice, setEthPrice] = useState(2000);
  const [capital, setCapital] = useState(4000);
  const [rangePct, setRangePct] = useState(10);
  const [apr, setApr] = useState(100);
  const [stopPct, setStopPct] = useState(2);
  const [betOdd, setBetOdd] = useState(0.15);
  const [betAmount, setBetAmount] = useState(20);
  const [entryDay, setEntryDay] = useState(0);
  const [waitDays, setWaitDays] = useState(2);
  const [ethMoveWait, setEthMoveWait] = useState(1.5);

  const Plo = ethPrice * (1 - rangePct / 100);
  const Phi = ethPrice * (1 + rangePct / 100);
  const feesDay = capital * (apr / 100) / 365;
  const stop = capital * stopPct / 100;
  const winPayoff = betAmount / betOdd;
  const breakEvenDays = stop / feesDay;
  const DAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  // Odd after waiting + price move
  // Price move INCREASES odd, time decay DECREASES odd — independent and multiplicative
  const oddAfterWait = useMemo(() => {
    // Price boost: ETH closer to strike = higher probability
    const distanceCovered = Math.min(1, ethMoveWait / rangePct);
    const priceBoostMultiplier = 1 + distanceCovered * 3;
    const oddAfterPriceMove = betOdd * priceBoostMultiplier;
    // Time decay: less days remaining = lower probability
    const totalDays = 7 - entryDay;
    const remainingDays = Math.max(0, totalDays - waitDays);
    const timeFactor = totalDays > 0 ? remainingDays / totalDays : 0;
    return Math.min(0.95, oddAfterPriceMove * timeFactor);
  }, [betOdd, entryDay, waitDays, ethMoveWait, rangePct]);

  const winPayoffAfterWait = betAmount / oddAfterWait;

  const EXIT_DAYS = [1, 2, 3, 4, 5, 6, 7];

  const scenarios = useMemo(() => EXIT_DAYS.map(exitDay => {
    const feesAcc = feesDay * exitDay;
    const netWithout = feesAcc - stop;
    const netWin = feesAcc - stop + winPayoff - betAmount;
    const betResale = winPayoff * oddAtDay(betOdd, entryDay, exitDay);
    const netLose = feesAcc - betAmount;
    return { exitDay, feesAcc, netWithout, netWin, betResale, netLose };
  }), [feesDay, stop, winPayoff, betAmount, betOdd, entryDay]);

  // Depreciação
  const depreciacao = EXIT_DAYS.map(day => ({
    day,
    value: day < entryDay ? null : winPayoff * oddAtDay(betOdd, entryDay, day),
    pct: day < entryDay ? null : oddAtDay(betOdd, entryDay, day) / betOdd * 100,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      <PolymarketLive ethPrice={ethPrice} rangePct={rangePct} />

      {/* Pool + aposta inputs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="card">
          <div className="label" style={{ marginBottom: 14 }}>CONFIGURAÇÃO DA POOL</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="PREÇO ETH" value={ethPrice} onChange={setEthPrice} prefix="$" min={100} max={10000} step={10} />
            <Field label="CAPITAL TOTAL" value={capital} onChange={setCapital} prefix="$" min={500} max={100000} step={100} />
            <Field label="RANGE (CADA LADO)" value={rangePct} onChange={setRangePct} suffix="%" min={1} max={50} step={0.5} />
            <Field label="APR ESTIMADO" value={apr} onChange={setApr} suffix="% aa" min={10} max={500} step={5} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
            <Stat label="FEES / DIA" value={`$${feesDay.toFixed(1)}`} color={S.green} small />
            <Stat label="STOP NOS LIMITES" value={`$${stop.toFixed(0)} (${stopPct}%)`} color={S.red} small />
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span className="label">STOP % NOS LIMITES</span>
              <span style={{ color: S.gold, fontSize: 13, fontFamily: "'JetBrains Mono'" }}>{stopPct}%</span>
            </div>
            <input type="range" min={0.5} max={5} step={0.1} value={stopPct} onChange={e => setStopPct(+e.target.value)} />
          </div>
        </div>

        <div className="card">
          <div className="label" style={{ marginBottom: 14 }}>CONFIGURAÇÃO DA APOSTA</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div className="label" style={{ marginBottom: 8 }}>ODD DE ENTRADA</div>
              <div style={{ display: "flex", flexWrap: "wrap" }}>
                {[0.05, 0.10, 0.15, 0.20, 0.25, 0.30].map(o => (
                  <span key={o} className="pill"
                    style={{ background: betOdd === o ? S.gold : S.border, color: betOdd === o ? "#000" : S.textDim, fontWeight: betOdd === o ? 600 : 400 }}
                    onClick={() => setBetOdd(o)}>
                    {(o * 100).toFixed(0)}%
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="label" style={{ marginBottom: 8 }}>DIA DE ENTRADA</div>
              <div style={{ display: "flex", flexWrap: "wrap" }}>
                {[0, 1, 2, 3].map(d => (
                  <span key={d} className="pill"
                    style={{ background: entryDay === d ? S.gold : S.border, color: entryDay === d ? "#000" : S.textDim, fontWeight: entryDay === d ? 600 : 400 }}
                    onClick={() => setEntryDay(d)}>
                    {DAY_LABELS[d]}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span className="label">VALOR APOSTADO</span>
              <span style={{ color: S.gold, fontSize: 13, fontFamily: "'JetBrains Mono'" }}>${betAmount} → recebe ${winPayoff.toFixed(0)}</span>
            </div>
            <input type="range" min={5} max={stop} step={5} value={betAmount} onChange={e => setBetAmount(+e.target.value)} />
            <div style={{ fontSize: 10, color: S.dim, marginTop: 4, fontFamily: "'JetBrains Mono'" }}>
              = {(betAmount / feesDay).toFixed(1)} dias de fees · retorno {(winPayoff / betAmount).toFixed(1)}x
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 14 }}>
            <Stat label="BREAK-EVEN CICLO" value={`${breakEvenDays.toFixed(1)}d`} color={S.blue} small />
            <Stat label="PAYOFF APOSTA" value={`$${winPayoff.toFixed(0)}`} color={S.green} small />
            <Stat label="STOP PÓS-APOSTA" value={`$${(stop - winPayoff + betAmount).toFixed(0)}`}
              color={(stop - winPayoff + betAmount) < 0 ? S.green : S.gold} small />
          </div>
        </div>
      </div>

      {/* Timing optimizer */}
      <div className="card" style={{ borderColor: S.gold + "40" }}>
        <div className="label" style={{ marginBottom: 14, color: S.gold }}>OTIMIZADOR DE TIMING — ESPERAR ANTES DE APOSTAR</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span className="label">DIAS DE ESPERA</span>
              <span style={{ color: S.gold, fontSize: 13, fontFamily: "'JetBrains Mono'" }}>{waitDays} dias</span>
            </div>
            <input type="range" min={0} max={4} step={1} value={waitDays} onChange={e => setWaitDays(+e.target.value)} />
            <div style={{ fontSize: 11, color: S.textDim, marginTop: 6, fontFamily: "'JetBrains Mono'" }}>
              Observa o mercado antes de apostar
            </div>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span className="label">MOVIMENTO ETH NO PERÍODO</span>
              <span style={{ color: S.gold, fontSize: 13, fontFamily: "'JetBrains Mono'" }}>+{ethMoveWait}%</span>
            </div>
            <input type="range" min={0} max={rangePct} step={0.5} value={ethMoveWait} onChange={e => setEthMoveWait(+e.target.value)} />
            <div style={{ fontSize: 11, color: S.textDim, marginTop: 6, fontFamily: "'JetBrains Mono'" }}>
              Alta observada antes de apostar
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 14 }}>
          <Stat label="ODD ORIGINAL" value={`${(betOdd * 100).toFixed(0)}%`} color={S.textDim} small />
          <Stat label="ODD APÓS ESPERA" value={`${(oddAfterWait * 100).toFixed(0)}%`} color={oddAfterWait > betOdd ? S.green : S.red} small />
          <Stat label="PAYOFF APÓS ESPERA" value={`$${winPayoffAfterWait.toFixed(0)}`} color={winPayoffAfterWait >= winPayoff ? S.green : S.gold} small />
          <div className="card" style={{ textAlign: "center", background: "#090914" }}>
            <div className="label">VEREDICTO</div>
            <div style={{ fontSize: 12, color: ethMoveWait >= 2 && waitDays <= 2 ? S.green : ethMoveWait >= 1 && waitDays <= 3 ? S.gold : ethMoveWait === 0 && waitDays >= 2 ? S.red : S.gold, marginTop: 4, fontFamily: "'JetBrains Mono'", fontWeight: 600 }}>
              {waitDays === 0 ? "Sem confirmação" :
                ethMoveWait >= 2 && waitDays <= 2 ? "✓ Timing ótimo" :
                ethMoveWait >= 1 && waitDays <= 3 ? "✓ Ainda razoável" :
                ethMoveWait === 0 && waitDays >= 2 ? "✗ Sem viés — não apostar" : "⚠ Avalie o payoff"}
            </div>
          </div>
        </div>

        <div className="insight">
          <strong style={{ color: S.gold }}>Regra de ouro:</strong> Entrar na LP na {DAY_LABELS[entryDay]}. 
          Esperar {waitDays} {waitDays === 1 ? "dia" : "dias"} observando. 
          {ethMoveWait > 0
            ? ` ETH subiu ${ethMoveWait}% → odd subiu de ${(betOdd*100).toFixed(0)}% para ${(oddAfterWait*100).toFixed(0)}% (mais próximo do strike) → payoff por dólar apostado caiu de $${winPayoff.toFixed(0)} para $${winPayoffAfterWait.toFixed(0)} (mercado já precifica o movimento).`
            : ` ETH lateral → sem boost de preço, odd decaiu pelo tempo de ${(betOdd*100).toFixed(0)}% para ${(oddAfterWait*100).toFixed(0)}%.`}
          {ethMoveWait >= 1 && oddAfterWait >= 0.15
            ? ` ✓ Movimento confirma viés — vale apostar.`
            : ethMoveWait === 0 && waitDays <= 1
            ? ` ✓ Entrada imediata, sem confirmação ainda.`
            : ethMoveWait === 0
            ? ` ✗ ETH lateral por ${waitDays} dias — sem viés, considere não apostar.`
            : ` ⚠ Odd já cara — avalie se payoff ainda cobre o stop.`}
        </div>
      </div>

      {/* Depreciação */}
      <div className="card">
        <div className="label" style={{ marginBottom: 12 }}>DEPRECIAÇÃO DA APOSTA AO LONGO DA SEMANA</div>
        <div style={{ display: "flex", gap: 8 }}>
          {depreciacao.map(({ day, value, pct }) => {
            const isEntry = day === entryDay + 1;
            const isPast = day <= entryDay;
            const barH = pct ? Math.max(4, pct) : 0;
            return (
              <div key={day} style={{ flex: 1, textAlign: "center" }}>
                <div style={{ height: 60, display: "flex", alignItems: "flex-end", justifyContent: "center", marginBottom: 6 }}>
                  <div style={{
                    width: "70%", height: `${barH}%`,
                    background: isPast ? S.border : pct > 60 ? S.green : pct > 30 ? S.gold : S.red,
                    borderRadius: "3px 3px 0 0", opacity: isPast ? 0.2 : 1,
                    transition: "height 0.3s"
                  }} />
                </div>
                <div style={{ fontSize: 11, color: isEntry ? S.gold : isPast ? S.dim : S.textDim, marginBottom: 3, fontFamily: "'JetBrains Mono'" }}>
                  {DAY_LABELS[day - 1]}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: isPast ? S.dim : col(value - betAmount), fontFamily: "'JetBrains Mono'" }}>
                  {isPast ? "—" : `$${value?.toFixed(0)}`}
                </div>
                <div style={{ fontSize: 9, color: S.dim, fontFamily: "'JetBrains Mono'" }}>
                  {isPast ? "" : `${pct?.toFixed(0)}%`}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 10, color: S.dim, marginTop: 8, fontFamily: "'JetBrains Mono'" }}>
          Valor de revenda no mercado secundário · % do custo original recuperável
        </div>
      </div>

      {/* Cenários */}
      <div className="card">
        <div className="label" style={{ marginBottom: 12 }}>CENÁRIOS DE SAÍDA — ETH TOCA O LIMITE SUPERIOR</div>
        <table>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>DIA</th>
              <th>FEES ACUM.</th>
              <th>APOSTA PAGA</th>
              <th>STOP LP</th>
              <th>P&L SEM HEDGE</th>
              <th>P&L COM APOSTA</th>
              <th>DIFERENÇA</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map(s => {
              const diff = s.netWin - s.netWithout;
              return (
                <tr key={s.exitDay}>
                  <td style={{ color: S.textDim }}>{DAY_LABELS[s.exitDay - 1]} (dia {s.exitDay})</td>
                  <td style={{ color: S.green }}>+${s.feesAcc.toFixed(0)}</td>
                  <td style={{ color: S.green }}>+${winPayoff.toFixed(0)}</td>
                  <td style={{ color: S.red }}>-${stop.toFixed(0)}</td>
                  <td style={{ color: col(s.netWithout), fontWeight: 600 }}>{fmtUSD(s.netWithout)}</td>
                  <td style={{ color: col(s.netWin), fontWeight: 600 }}>{fmtUSD(s.netWin)}</td>
                  <td style={{ color: col(diff) }}>{fmtUSD(diff)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Resumo previsibilidade */}
      <div className="card" style={{ borderColor: S.green + "40" }}>
        <div className="label" style={{ marginBottom: 12, color: S.green }}>PREVISIBILIDADE DE PERDAS — OBJETIVO FINAL</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {[
            { label: "SAÍDA PELO FUNDO", value: "$0", sub: "hedge cobre 100%", color: S.green },
            { label: "SAÍDA PELO TOPO SEM APOSTA", value: `-$${stop.toFixed(0)}`, sub: `-${stopPct}% do capital`, color: S.red },
            { label: "SAÍDA PELO TOPO COM APOSTA", value: `$${Math.abs(stop - winPayoff + betAmount).toFixed(0)}`, sub: stop - winPayoff + betAmount < 0 ? "lucro!" : `-${((stop - winPayoff + betAmount) / capital * 100).toFixed(1)}%`, color: stop - winPayoff + betAmount < 0 ? S.green : S.gold },
          ].map(item => (
            <div key={item.label} style={{ textAlign: "center", padding: "16px", background: "#090914", borderRadius: 8, border: `1px solid ${item.color}20` }}>
              <div className="label">{item.label}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: item.color, fontFamily: "'Syne'", marginTop: 6 }}>{item.value}</div>
              <div style={{ fontSize: 11, color: S.textDim, marginTop: 4, fontFamily: "'JetBrains Mono'" }}>{item.sub}</div>
            </div>
          ))}
        </div>
        <div className="insight" style={{ marginTop: 14 }}>
          <strong style={{ color: S.green }}>Custo anual do seguro:</strong> ${betAmount} × 52 semanas = ${(betAmount * 52).toFixed(0)} · 
          Fees anuais estimadas: ${(capital * apr / 100).toFixed(0)} · 
          <strong style={{ color: S.gold }}> APR líquido: {(apr - (betAmount * 52 / capital * 100)).toFixed(0)}% aa</strong>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 3 — 4 CENÁRIOS COMPARATIVOS
// ═══════════════════════════════════════════════════════════════
function generatePath(scenario) {
  const seed = (n) => Math.sin(n * 9301 + 49297) * 0.5 + 0.5;
  switch (scenario) {
    case 0: return Array.from({ length: 22 }, (_, i) => {
      if (i < 18) return 2000 + Math.sin(i * 0.8) * 60 + (seed(i) - 0.5) * 25;
      return 2000 - (i - 17) * 58 + (seed(i + 50) - 0.5) * 12;
    });
    case 1: return Array.from({ length: 10 }, (_, i) => {
      if (i < 2) return 2000 + i * 115 + (seed(i) - 0.5) * 18;
      return 2200 + (seed(i + 20) - 0.5) * 22;
    });
    case 2: return Array.from({ length: 25 }, (_, i) => {
      if (i < 21) return 2000 + Math.sin(i * 0.6) * 58 + (seed(i + 100) - 0.5) * 22;
      return 2000 + (i - 20) * 85 + (seed(i + 150) - 0.5) * 12;
    });
    case 3: return Array.from({ length: 18 }, (_, i) => {
      if (i < 4) return 2000 - i * 32 + (seed(i + 200) - 0.5) * 16;
      if (i < 12) return 1880 + Math.sin((i - 4) * 0.7) * 42 + (seed(i + 250) - 0.5) * 16;
      return 1880 + (i - 11) * 105 + (seed(i + 300) - 0.5) * 16;
    });
    default: return [];
  }
}

const SCENARIO_META = [
  { title: "Cenário 1", subtitle: "Lateral 2-3 semanas → cai ao fundo", color: "#f06060", desc: "ETH oscila dentro do range por ~18 dias acumulando fees, depois cai e toca o limite inferior. Aposta não serve, mas fees absorvem tudo." },
  { title: "Cenário 2", subtitle: "Sobe rápido em 2 dias", color: "#3dd68c", desc: "ETH dispara e toca o limite superior em 2 dias. Pouco fee acumulado, mas aposta paga e transforma o stop em lucro." },
  { title: "Cenário 3", subtitle: "Lateral 3+ semanas → rompe para cima", color: "#5b9cf6", desc: "ETH oscila por 21 dias acumulando fees generosas, depois rompe. Custo das apostas renovadas é absorvido pelas fees." },
  { title: "Cenário 4", subtitle: "Cai → lateral → rompe em 2 semanas", color: "#a78bfa", desc: "ETH cai inicialmente, estabiliza, depois rompe para cima em ~14 dias. Aposta salva a saída pelo topo." },
];

function MiniChart({ path, color, exitIdx, exitType }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const pad = { t: 12, b: 20, l: 40, r: 8 };
    const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
    const LOWER = 1800, UPPER = 2200, ENTRY = 2000;
    const minP = 1600, maxP = 2400;
    const xS = i => pad.l + (i / (path.length - 1)) * cW;
    const yS = p => pad.t + cH - ((p - minP) / (maxP - minP)) * cH;
    ctx.fillStyle = "#090914"; ctx.fillRect(0, 0, W, H);
    // range zone
    ctx.fillStyle = "rgba(232,184,75,0.06)";
    ctx.fillRect(pad.l, yS(UPPER), cW, yS(LOWER) - yS(UPPER));
    // lines
    [[UPPER, "#3dd68c"], [ENTRY, "#e8b84b"], [LOWER, "#f06060"]].forEach(([p, c]) => {
      ctx.strokeStyle = c + "50"; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(pad.l, yS(p)); ctx.lineTo(pad.l + cW, yS(p)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = c + "80"; ctx.font = "9px JetBrains Mono"; ctx.textAlign = "right";
      ctx.fillText(`$${p}`, pad.l - 2, yS(p) + 3);
    });
    // week markers
    ctx.strokeStyle = "#5b9cf630"; ctx.lineWidth = 1;
    for (let w = 7; w < path.length; w += 7) {
      ctx.beginPath(); ctx.setLineDash([2, 3]);
      ctx.moveTo(xS(w), pad.t); ctx.lineTo(xS(w), pad.t + cH); ctx.stroke();
      ctx.setLineDash([]);
    }
    // price line
    const drawTo = exitIdx !== null ? exitIdx + 1 : path.length;
    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.shadowColor = color; ctx.shadowBlur = 5;
    for (let i = 0; i < drawTo; i++) {
      i === 0 ? ctx.moveTo(xS(i), yS(path[i])) : ctx.lineTo(xS(i), yS(path[i]));
    }
    ctx.stroke(); ctx.shadowBlur = 0;
    if (exitIdx !== null && path.length > exitIdx + 1) {
      ctx.beginPath(); ctx.strokeStyle = "#ffffff20"; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      for (let i = exitIdx; i < path.length; i++) {
        i === exitIdx ? ctx.moveTo(xS(i), yS(path[i])) : ctx.lineTo(xS(i), yS(path[i]));
      }
      ctx.stroke(); ctx.setLineDash([]);
    }
    if (exitIdx !== null) {
      ctx.beginPath(); ctx.arc(xS(exitIdx), yS(path[exitIdx]), 5, 0, Math.PI * 2);
      ctx.fillStyle = exitType === "upper" ? "#3dd68c" : "#f06060"; ctx.fill();
    }
    // day labels
    ctx.fillStyle = "#333"; ctx.font = "8px JetBrains Mono"; ctx.textAlign = "center";
    for (let d = 0; d < path.length; d += 7) ctx.fillText(`d${d}`, xS(d), H - 4);
  }, [path, color, exitIdx, exitType]);
  return <canvas ref={canvasRef} width={380} height={160} style={{ width: "100%", height: 160, borderRadius: 6 }} />;
}

function calcScenario(path, betOdd = 0.15, betAmount = 20, capital = 4000, apr = 100, stopPct = 2) {
  const LOWER = 1800, UPPER = 2200, ENTRY = 2000;
  const feesDay = capital * (apr / 100) / 365;
  const stop = capital * stopPct / 100;
  const winPayoff = betAmount / betOdd;
  let fees = 0, exitDay = null, exitType = null;
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    if (p >= LOWER && p <= UPPER) fees += feesDay;
    if (exitDay === null) {
      if (p >= UPPER) { exitDay = i; exitType = "upper"; }
      else if (p <= LOWER) { exitDay = i; exitType = "lower"; }
    }
  }
  if (exitDay === null) { exitDay = path.length - 1; exitType = "still_in"; }
  const weeksActive = Math.ceil((exitDay + 1) / 7);
  const totalBetCost = betAmount * weeksActive;
  const betPayoff = exitType === "upper" ? winPayoff : 0;
  const lpPnL = exitType === "still_in" ? fees : fees - stop;
  const netPnL = lpPnL + betPayoff - totalBetCost;
  const netWithout = lpPnL;
  return { fees, exitDay, exitType, weeksActive, totalBetCost, betPayoff, lpPnL, netPnL, netWithout, winPayoff, stop };
}

function TabScenarios() {
  const [betOdd, setBetOdd] = useState(0.15);
  const [betAmount, setBetAmount] = useState(20);
  const [capital, setCapital] = useState(4000);
  const [apr, setApr] = useState(100);
  const [stopPct, setStopPct] = useState(2);
  const [activeIdx, setActiveIdx] = useState(null);
  const paths = useMemo(() => SCENARIO_META.map((_, i) => generatePath(i)), []);
  const results = useMemo(() => paths.map(p => calcScenario(p, betOdd, betAmount, capital, apr, stopPct)), [paths, betOdd, betAmount, capital, apr, stopPct]);
  const DAY_LABELS = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom","Seg","Ter","Qua","Qui","Sex","Sáb","Dom","Seg","Ter","Qua","Qui","Sex","Sáb","Dom","Seg","Ter","Qua","Dom"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Controls */}
      <div className="card">
        <div className="label" style={{ marginBottom: 14 }}>PARÂMETROS GLOBAIS</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 20 }}>
          <Field label="CAPITAL" value={capital} onChange={setCapital} prefix="$" min={500} max={100000} step={100} />
          <Field label="APR" value={apr} onChange={setApr} suffix="%" min={10} max={500} step={5} />
          <Field label="STOP %" value={stopPct} onChange={setStopPct} suffix="%" min={0.5} max={5} step={0.1} />
          <div>
            <div className="label" style={{ marginBottom: 8 }}>ODD APOSTA</div>
            <div style={{ display: "flex", flexWrap: "wrap" }}>
              {[0.10, 0.15, 0.20, 0.25].map(o => (
                <span key={o} className="pill"
                  style={{ background: betOdd === o ? S.gold : S.border, color: betOdd === o ? "#000" : S.textDim }}
                  onClick={() => setBetOdd(o)}>
                  {(o * 100).toFixed(0)}%
                </span>
              ))}
            </div>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span className="label">APOSTA/SEM</span>
              <span style={{ color: S.gold, fontSize: 12, fontFamily: "'JetBrains Mono'" }}>${betAmount}</span>
            </div>
            <input type="range" min={5} max={80} step={5} value={betAmount} onChange={e => setBetAmount(+e.target.value)} />
          </div>
        </div>
      </div>

      {/* Scenario grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {SCENARIO_META.map((sc, idx) => {
          const r = results[idx];
          const isActive = activeIdx === idx;
          return (
            <div key={idx} className="card" style={{ cursor: "pointer", borderColor: isActive ? sc.color : S.border, transition: "border-color 0.2s" }}
              onClick={() => setActiveIdx(isActive ? null : idx)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: sc.color, letterSpacing: 2, fontFamily: "'JetBrains Mono'" }}>{sc.title.toUpperCase()}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Syne'", marginTop: 2 }}>{sc.subtitle}</div>
                </div>
                <div style={{
                  fontSize: 16, fontWeight: 800, fontFamily: "'Syne'",
                  color: r.netPnL >= 0 ? S.green : S.red,
                  background: r.netPnL >= 0 ? S.green + "15" : S.red + "15",
                  padding: "4px 12px", borderRadius: 20
                }}>
                  {r.netPnL >= 0 ? "+" : ""}${r.netPnL.toFixed(0)}
                </div>
              </div>

              <MiniChart path={paths[idx]} color={sc.color} exitIdx={r.exitDay} exitType={r.exitType} />

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginTop: 10 }}>
                {[
                  { label: "DIAS", value: `${r.exitDay}d` },
                  { label: "FEES", value: `+$${r.fees.toFixed(0)}`, c: S.green },
                  { label: `APOSTAS×${r.weeksActive}`, value: `-$${r.totalBetCost}`, c: S.red },
                  { label: "SEM HEDGE", value: `${r.netWithout >= 0 ? "+" : ""}$${r.netWithout.toFixed(0)}`, c: col(r.netWithout) },
                ].map(item => (
                  <div key={item.label} style={{ textAlign: "center", background: "#090914", borderRadius: 6, padding: "6px 4px" }}>
                    <div style={{ fontSize: 9, color: S.dim, fontFamily: "'JetBrains Mono'" }}>{item.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: item.c || S.text, fontFamily: "'JetBrains Mono'", marginTop: 2 }}>{item.value}</div>
                  </div>
                ))}
              </div>

              {isActive && (
                <div className="insight" style={{ borderColor: sc.color }}>
                  <strong style={{ color: sc.color }}>{sc.title}:</strong> {sc.desc}
                  {r.exitType === "upper" && <><br /><strong style={{ color: S.green }}>Aposta pagou ${r.betPayoff.toFixed(0)}</strong> — stop de $${r.stop.toFixed(0)} virou {r.netPnL >= 0 ? `lucro de $${r.netPnL.toFixed(0)}` : `perda mínima de $${Math.abs(r.netPnL).toFixed(0)}`}.</>}
                  {r.exitType === "lower" && <><br />Aposta não serviu (custo ${r.totalBetCost}). Fees de ${r.fees.toFixed(0)} {r.lpPnL >= 0 ? "cobriram o stop" : `não cobriram o stop de $${r.stop.toFixed(0)}`}.</>}
                  <br /><strong style={{ color: S.gold }}>Diferença com aposta: {fmtUSD(r.netPnL - r.netWithout)}</strong>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="card">
        <div className="label" style={{ marginBottom: 12 }}>RESUMO COMPARATIVO</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {SCENARIO_META.map((sc, idx) => {
            const r = results[idx];
            return (
              <div key={idx} style={{ textAlign: "center", padding: "14px 8px", background: "#090914", borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: sc.color, fontFamily: "'JetBrains Mono'", marginBottom: 6 }}>{sc.title.toUpperCase()}</div>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Syne'", color: r.netPnL >= 0 ? S.green : S.red }}>
                  {r.netPnL >= 0 ? "+" : ""}${r.netPnL.toFixed(0)}
                </div>
                <div style={{ fontSize: 10, color: S.textDim, marginTop: 4, fontFamily: "'JetBrains Mono'" }}>
                  sem hedge: {r.netWithout >= 0 ? "+" : ""}${r.netWithout.toFixed(0)}
                </div>
                <div style={{ fontSize: 11, marginTop: 4, fontFamily: "'JetBrains Mono'", color: col(r.netPnL - r.netWithout) }}>
                  aposta: {fmtUSD(r.netPnL - r.netWithout)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// POLYMARKET LIVE PANEL
// ═══════════════════════════════════════════════════════════════
function PolymarketLive({ ethPrice, rangePct }) {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const upperLimit = ethPrice * (1 + rangePct / 100);

  const fetchMarkets = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/polymarket");
      const data = await res.json();
      if (data.success && data.markets.length > 0) {
        setMarkets(data.markets);
        setLastUpdate(new Date().toLocaleTimeString("pt-BR"));
      } else {
        setError("Nenhum mercado ETH encontrado agora.");
      }
    } catch (e) {
      setError("Erro ao conectar com Polymarket.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarkets();
    const iv = setInterval(fetchMarkets, 60000);
    return () => clearInterval(iv);
  }, []);

  const allOutcomes = markets.flatMap(m => m.outcomes || []);
  const bestMatch = allOutcomes
    .filter(o => o.strike >= upperLimit * 0.95 && o.strike <= upperLimit * 1.1)
    .sort((a, b) => Math.abs(a.strike - upperLimit) - Math.abs(b.strike - upperLimit))[0];

  return (
    <div className="card" style={{ borderColor: S.green + "40", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div className="label" style={{ color: S.green }}>POLYMARKET — ODDS AO VIVO</div>
          {lastUpdate && <div style={{ fontSize: 10, color: S.dim, marginTop: 2, fontFamily: "'JetBrains Mono'" }}>
            Atualizado: {lastUpdate} · auto-refresh 60s
          </div>}
        </div>
        <button onClick={fetchMarkets} disabled={loading}
          style={{ background: S.border, border: "none", color: S.text, padding: "6px 14px",
            borderRadius: 6, cursor: "pointer", fontFamily: "'JetBrains Mono'", fontSize: 11 }}>
          {loading ? "carregando..." : "↻ atualizar"}
        </button>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", background: S.red + "15", borderRadius: 6,
          color: S.red, fontSize: 12, fontFamily: "'JetBrains Mono'" }}>
          {error}
        </div>
      )}

      {loading && !markets.length && (
        <div style={{ textAlign: "center", padding: 24, color: S.dim, fontSize: 12, fontFamily: "'JetBrains Mono'" }}>
          buscando mercados...
        </div>
      )}

      {markets.map(market => (
        <div key={market.id} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: S.textDim, marginBottom: 8,
            fontFamily: "'JetBrains Mono'", borderBottom: "1px solid " + S.border, paddingBottom: 6 }}>
            {market.question}
            <span style={{ color: S.dim, marginLeft: 8, fontSize: 10 }}>
              Vol: ${parseFloat(market.volume || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(market.outcomes || []).map((o, i) => {
              const isTarget = Math.abs(o.strike - upperLimit) / upperLimit < 0.05;
              return (
                <div key={i} style={{
                  padding: "8px 12px", borderRadius: 8, minWidth: 90, textAlign: "center",
                  background: isTarget ? S.green + "20" : "#090914",
                  border: "1px solid " + (isTarget ? S.green : S.border),
                }}>
                  <div style={{ fontSize: 10, color: isTarget ? S.green : S.dim,
                    fontFamily: "'JetBrains Mono'", marginBottom: 3 }}>
                    {isTarget ? "★ " : ""}${o.strike.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: isTarget ? S.green : S.text, fontFamily: "'Syne'" }}>
                    {o.oddPct}%
                  </div>
                  <div style={{ fontSize: 10, color: S.textDim, fontFamily: "'JetBrains Mono'", marginTop: 2 }}>
                    paga ${o.payoffPer100}/$100
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {bestMatch && (
        <div className="insight" style={{ borderColor: S.green, marginTop: 8 }}>
          <strong style={{ color: S.green }}>Strike mais próximo do topo (${upperLimit.toFixed(0)}):</strong>{" "}
          <strong style={{ color: S.gold }}>${bestMatch.strike.toLocaleString()}</strong> — odd{" "}
          <strong style={{ color: S.gold }}>{bestMatch.oddPct}%</strong> — apostar $20 recebe{" "}
          <strong style={{ color: S.green }}>${(20 / parseFloat(bestMatch.odd)).toFixed(0)}</strong>.
          {parseFloat(bestMatch.odd) <= 0.25 ? " ✓ Custo razoável." : " ⚠ Odd alta — avalie o payoff."}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [tab, setTab] = useState(0);
  const tabs = ["Put como Seguro", "Aposta Polymarket", "4 Cenários"];

  return (
    <div style={{ background: S.bg, minHeight: "100vh", color: S.text, fontFamily: "'JetBrains Mono', monospace" }}>
      <style>{css}</style>

      {/* Header */}
      <div style={{ padding: "32px 28px 0", maxWidth: 960, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 10, color: S.gold, letterSpacing: 4, marginBottom: 8, fontFamily: "'JetBrains Mono'" }}>
            LP HEDGE STRATEGY · ETH/USDC
          </div>
          <div style={{ fontSize: 32, fontFamily: "'Syne'", fontWeight: 800, letterSpacing: -1, lineHeight: 1.1 }}>
            Simulador Completo
          </div>
          <div style={{ fontSize: 12, color: S.textDim, marginTop: 6 }}>
            Pool concentrada · Short hedge · Put seguro · Polymarket timing
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {tabs.map((t, i) => (
            <button key={i} className={`tab ${tab === i ? "active" : "inactive"}`}
              onClick={() => setTab(i)}
              style={{ border: "none", cursor: "pointer" }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "0 28px 40px", maxWidth: 960, margin: "0 auto" }}>
        {tab === 0 && <TabPut />}
        {tab === 1 && <TabPolymarket />}
        {tab === 2 && <TabScenarios />}
      </div>
    </div>
  );
}
