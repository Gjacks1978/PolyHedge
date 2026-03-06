/* eslint-disable */
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
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@300;400;500&family=Inter:wght@400;500;600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:${S.bg};}
  input[type=range]{accent-color:${S.gold};width:100%;cursor:pointer;height:4px;}
  input[type=number]{background:#0a0a18;border:1px solid ${S.border};color:${S.text};
    font-family:'IBM Plex Mono',monospace;font-size:14px;padding:8px 10px;border-radius:6px;width:100%;
    outline:none;transition:border-color 0.2s;}
  input[type=number]:focus{border-color:${S.gold};}
  input[type=number]::-webkit-inner-spin-button{opacity:0.4;}
  .card{background:${S.surface};border:1px solid ${S.border};border-radius:10px;padding:18px;}
  .tab{cursor:pointer;padding:10px 20px;font-family:'Space Grotesk',sans-serif;font-size:13px;font-weight:600;
    border-radius:8px;transition:all 0.2s;letter-spacing:0.5px;}
  .tab.active{background:${S.gold};color:#000;}
  .tab.inactive{color:${S.textDim};background:transparent;}
  .tab.inactive:hover{color:${S.text};background:${S.border};}
  table{width:100%;border-collapse:collapse;}
  th{color:${S.dim};font-size:10px;text-align:right;padding:6px 8px;
    border-bottom:1px solid ${S.border};font-family:'IBM Plex Mono',monospace;letter-spacing:1px;}
  th:first-child{text-align:left;}
  td{font-size:13px;font-family:'IBM Plex Mono',monospace;text-align:right;
    padding:7px 8px;border-bottom:1px solid #0a0a15;}
  td:first-child{text-align:left;color:${S.textDim};}
  tr:hover td{background:#0f0f1e;}
  .label{font-size:10px;color:${S.textDim};letter-spacing:1px;font-family:'IBM Plex Mono',monospace;margin-bottom:6px;}
  .value{font-size:22px;font-family:'Space Grotesk',sans-serif;font-weight:700;}
  .pill{display:inline-block;padding:5px 14px;border-radius:20px;font-size:11px;
    cursor:pointer;font-family:'IBM Plex Mono',monospace;transition:all 0.15s;margin:2px;}
  .sep{border-left:1px solid ${S.border};}
  .insight{padding:14px 16px;background:#090914;border-radius:8px;
    border-left:3px solid ${S.gold};font-size:13px;color:${S.textDim};
    font-family:'Inter',sans-serif;line-height:1.8;margin-top:14px;}
  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
  .grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
  .grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;}
  .grid-5{display:grid;grid-template-columns:repeat(5,1fr);gap:16px;}
  @media(max-width:700px){
    .card{padding:14px;}
    .tab{padding:8px 12px;font-size:12px;}
    .grid-2,.grid-3,.grid-4,.grid-5{grid-template-columns:1fr!important;}
    .grid-2-mobile{grid-template-columns:1fr 1fr!important;}
    .hide-mobile{display:none!important;}
    table{font-size:11px;}
    th,td{padding:5px 4px;}
    .value{font-size:18px!important;}
    input[type=number]{font-size:16px;}
  }
  @media(max-width:480px){
    .grid-2-mobile{grid-template-columns:1fr!important;}
  }
`;

// ─── INPUT FIELD ──────────────────────────────────────────────
function Field({ label, value, onChange, prefix = "", suffix = "", min, max, step = 1 }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {prefix && <span style={{ color: S.gold, fontFamily: "'IBM Plex Mono'", fontSize: 14 }}>{prefix}</span>}
        <input type="number" value={value} min={min} max={max} step={step}
          onChange={e => onChange(+e.target.value)}
          style={{ flex: 1 }} />
        {suffix && <span style={{ color: S.textDim, fontFamily: "'IBM Plex Mono'", fontSize: 12 }}>{suffix}</span>}
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


// ─── COLLAPSIBLE CARD ─────────────────────────────────────────
function CollapsibleCard({ title, titleColor, borderColor, defaultOpen = true, children, subtitle }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card" style={{ borderColor: borderColor || S.border, padding: 0, overflow: "hidden" }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "14px 18px", cursor: "pointer", userSelect: "none",
          borderBottom: open ? `1px solid ${S.border}` : "none" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "1px", fontFamily: "'IBM Plex Mono',monospace", color: titleColor || S.textDim }}>{title}</span>
          {subtitle && <span style={{ fontSize: 10, color: S.dim, fontFamily: "'Inter',sans-serif", fontWeight: 400 }}>{subtitle}</span>}
        </div>
        <span style={{ color: S.dim, fontSize: 11, fontFamily: "'IBM Plex Mono'", flexShrink: 0, marginLeft: 12 }}>
          {open ? "▲" : "▼"}
        </span>
      </div>
      {open && <div style={{ padding: "16px 18px" }}>{children}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 2 — POLYMARKET HEDGE
// ═══════════════════════════════════════════════════════════════
function TabPolymarket({ liveEth, onSetAlert, requestAlertPermission }) {
  const [ethPrice, setEthPrice] = useState(2000);
  const [capital, setCapital] = useState(4000);
  const [rangeLo, setRangeLo] = useState(10);
  const [rangeHi, setRangeHi] = useState(10);
  const [apr, setApr] = useState(100);
  const [stopPct, setStopPct] = useState(2);
  const [betOdd, setBetOdd] = useState(0.15);
  const [downOdd, setDownOdd] = useState(0.02);
  const [downBet, setDownBet] = useState(5);
  const [alertSet, setAlertSet] = useState(false);
  const [shortEth, setShortEth]   = useState(0);      // ETH qty shorted
  const [fundingRate, setFundingRate] = useState(0.01); // funding % per day

  // Auto-fill ETH price when live data arrives
  useEffect(() => {
    if (liveEth && !alertSet) setEthPrice(Math.round(liveEth));
  }, [liveEth]);
  const [betAmount, setBetAmount] = useState(20);
  const [entryDay, setEntryDay] = useState(0);
  const [waitDays, setWaitDays] = useState(0);
  const [ethMoveWait, setEthMoveWait] = useState(0);

  const Plo = ethPrice * (1 - rangeLo / 100);
  const Phi = ethPrice * (1 + rangeHi / 100);
  const feesDay = capital * (apr / 100) / 365;
  const stop = capital * stopPct / 100;
  const winPayoff = betAmount / betOdd;
  const breakEvenDays = stop / feesDay;
  const DAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  // Short perp calculations
  const shortNotional  = shortEth * ethPrice;                        // $ value of short
  const deltaLP        = -(capital / (2 * ethPrice));                 // LP natural delta (negative, sells ETH as price rises)
  const deltaNeutral   = Math.abs(deltaLP);                          // ETH to short for delta-neutral
  const shortPnlTop    = -shortEth * (ethPrice * rangeHi / 100);    // loss when ETH hits upper limit
  const shortPnlBot    =  shortEth * (ethPrice * rangeLo / 100);    // gain when ETH hits lower limit
  const fundingCostDay = shortNotional * (fundingRate / 100);        // daily funding cost
  const fundingCostWeek = fundingCostDay * 7;

  // Consolidated PnL — 3 scenarios (weekly)
  const feesWeek = feesDay * 7;
  const pnlRange = {
    lp:     feesWeek,
    short:  -fundingCostWeek,
    bet:    -(betAmount + downBet),
    total:  feesWeek - fundingCostWeek - betAmount - downBet,
  };
  const pnlTop = {
    lp:     feesWeek - stop,
    short:  shortPnlTop - fundingCostWeek,
    bet:    winPayoff - betAmount - downBet,
    total:  (feesWeek - stop) + (shortPnlTop - fundingCostWeek) + (winPayoff - betAmount - downBet),
  };
  const pnlBot = {
    lp:     feesWeek - stop,
    short:  shortPnlBot - fundingCostWeek,
    bet:    -(betAmount + downBet) + (downBet / (downOdd / 100)),
    total:  (feesWeek - stop) + (shortPnlBot - fundingCostWeek) + (-(betAmount + downBet) + (downBet / (downOdd / 100))),
  };

  // Odd after waiting + price move
  // Price move INCREASES odd, time decay DECREASES odd — independent and multiplicative
  const oddAfterWait = useMemo(() => {
    // Price boost: ETH closer to strike = higher probability
    const distanceCovered = Math.min(1, ethMoveWait / rangeHi);
    const priceBoostMultiplier = 1 + distanceCovered * 3;
    const oddAfterPriceMove = betOdd * priceBoostMultiplier;
    // Time decay: less days remaining = lower probability
    const totalDays = 7 - entryDay;
    const remainingDays = Math.max(0, totalDays - waitDays);
    const timeFactor = totalDays > 0 ? remainingDays / totalDays : 0;
    return Math.min(0.95, oddAfterPriceMove * timeFactor);
  }, [betOdd, entryDay, waitDays, ethMoveWait, rangeHi]);

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

      {/* Countdown to next market open */}
      <WeeklyCountdown />

      <PolymarketLive ethPrice={ethPrice} rangePct={rangeHi} onSelectOdd={odd => setBetOdd(odd)} onSelectDownOdd={odd => setDownOdd(odd)} />

      {/* Early entry panels — side by side */}
      <div className="grid-2">
        <EarlyEntryPanel ethPrice={ethPrice} betOdd={betOdd} setBetOdd={setBetOdd} />
        <DownsidePanel ethPrice={ethPrice} rangePct={rangeLo} downOdd={downOdd} setDownOdd={setDownOdd} downBet={downBet} setDownBet={setDownBet} stopPct={stopPct} capital={capital} feesDay={feesDay} />
      </div>

      {/* Pool + aposta inputs */}
      <div className="grid-2" style={{ gap: 16 }}>
        <CollapsibleCard title="CONFIGURAÇÃO DA POOL" defaultOpen={true}>
          <div className="grid-2-mobile" style={{ display: "grid", gap: 12 }}>
            <Field label="PREÇO ETH" value={ethPrice} onChange={setEthPrice} prefix="$" min={100} max={10000} step={10} />
            <Field label="CAPITAL TOTAL" value={capital} onChange={setCapital} prefix="$" min={500} max={100000} step={100} />
            <div>
              <div className="label">RANGE INFERIOR ↓</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="number" value={rangeLo} min={1} max={50} step={0.5}
                  onChange={e => setRangeLo(+e.target.value)} style={{ flex: 1 }} />
                <span style={{ color: S.textDim, fontFamily: "'IBM Plex Mono'", fontSize: 12 }}>%</span>
              </div>
              <div style={{ fontSize: 10, color: S.red, fontFamily: "'IBM Plex Mono'", marginTop: 4 }}>
                → ${(ethPrice * (1 - rangeLo / 100)).toFixed(0)}
              </div>
            </div>
            <div>
              <div className="label">RANGE SUPERIOR ↑</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="number" value={rangeHi} min={1} max={50} step={0.5}
                  onChange={e => setRangeHi(+e.target.value)} style={{ flex: 1 }} />
                <span style={{ color: S.textDim, fontFamily: "'IBM Plex Mono'", fontSize: 12 }}>%</span>
              </div>
              <div style={{ fontSize: 10, color: S.green, fontFamily: "'IBM Plex Mono'", marginTop: 4 }}>
                → ${(ethPrice * (1 + rangeHi / 100)).toFixed(0)}
              </div>
            </div>
            <Field label="APR ESTIMADO" value={apr} onChange={setApr} suffix="% aa" min={10} max={500} step={5} />
          </div>
          <div className="grid-2-mobile" style={{ display: "grid", gap: 10, marginTop: 14 }}>
            <Stat label="FEES / DIA" value={`$${feesDay.toFixed(1)}`} color={S.green} small />
            <Stat label="STOP NOS LIMITES" value={`$${stop.toFixed(0)} (${stopPct}%)`} color={S.red} small />
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span className="label">STOP % NOS LIMITES</span>
              <span style={{ color: S.gold, fontSize: 13, fontFamily: "'IBM Plex Mono'" }}>{stopPct}%</span>
            </div>
            <input type="range" min={0.5} max={15} step={0.1} value={stopPct} onChange={e => setStopPct(+e.target.value)} />
          </div>
        </CollapsibleCard>

        <CollapsibleCard title="CONFIGURAÇÃO DA APOSTA" defaultOpen={true}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span className="label">ODD DE ENTRADA</span>
                <span style={{ color: S.gold, fontSize: 14, fontFamily: "'IBM Plex Mono'", fontWeight: 600 }}>
                  {(betOdd * 100).toFixed(0)}% → paga {(1/betOdd).toFixed(1)}x
                </span>
              </div>
              <input type="range" min={1} max={50} step={0.5}
                value={Math.round(betOdd * 1000) / 10}
                onChange={e => setBetOdd(+e.target.value / 100)} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: S.dim, marginTop: 3, fontFamily: "'IBM Plex Mono'" }}>
                <span>1% (100x)</span><span>15%</span><span>25%</span><span>50% (2x)</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, marginTop: 6,
                background: `linear-gradient(to right, ${S.green} ${(betOdd*100-0.5)/49.5*100}%, ${betOdd<=0.15?S.green:betOdd<=0.30?S.gold:S.red} ${(betOdd*100-0.5)/49.5*100}%, transparent)`,
                border: `1px solid ${S.border}` }} />
              <div style={{ fontSize: 10, color: betOdd<=0.15?S.green:betOdd<=0.30?S.gold:S.red, marginTop: 4, fontFamily: "'IBM Plex Mono'" }}>
                {betOdd<=0.10 ? "✓ Assimetria máxima" : betOdd<=0.20 ? "✓ Zona ideal de hedge" : betOdd<=0.35 ? "⚠ Odd moderada" : "✗ Pouca assimetria"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "1px", fontFamily: "'IBM Plex Mono',monospace", color: "inherit", marginBottom: 8 }}>DIA DE ENTRADA</div>
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
              <span style={{ color: S.gold, fontSize: 13, fontFamily: "'IBM Plex Mono'" }}>${betAmount} → recebe ${winPayoff.toFixed(0)}</span>
            </div>
            <input type="range" min={5} max={stop} step={5} value={betAmount} onChange={e => setBetAmount(+e.target.value)} />
            <div style={{ fontSize: 10, color: S.dim, marginTop: 4, fontFamily: "'IBM Plex Mono'" }}>
              = {(betAmount / feesDay).toFixed(1)} dias de fees · retorno {(winPayoff / betAmount).toFixed(1)}x
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 14 }}>
            <Stat label="BREAK-EVEN CICLO" value={`${breakEvenDays.toFixed(1)}d`} color={S.blue} small />
            <Stat label="PAYOFF APOSTA" value={`$${winPayoff.toFixed(0)}`} color={S.green} small />
            <Stat label="STOP PÓS-APOSTA" value={`$${(stop - winPayoff + betAmount).toFixed(0)}`}
              color={(stop - winPayoff + betAmount) < 0 ? S.green : S.gold} small />
          </div>
        </CollapsibleCard>
      </div>

      <CollapsibleCard title="OTIMIZADOR DE TIMING — ESPERAR ANTES DE APOSTAR"
        titleColor={S.gold} borderColor={S.gold + "40"} defaultOpen={false}>
        <div className="grid-2" style={{ gap: 24 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span className="label">DIAS DE ESPERA</span>
              <span style={{ color: S.gold, fontSize: 13, fontFamily: "'IBM Plex Mono'" }}>{waitDays} dias</span>
            </div>
            <input type="range" min={0} max={4} step={1} value={waitDays} onChange={e => setWaitDays(+e.target.value)} />
            <div style={{ fontSize: 11, color: S.textDim, marginTop: 6, fontFamily: "'IBM Plex Mono'" }}>
              Observa o mercado antes de apostar
            </div>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span className="label">MOVIMENTO ETH NO PERÍODO</span>
              <span style={{ color: S.gold, fontSize: 13, fontFamily: "'IBM Plex Mono'" }}>+{ethMoveWait}%</span>
            </div>
            <input type="range" min={0} max={rangeHi} step={0.5} value={ethMoveWait} onChange={e => setEthMoveWait(+e.target.value)} />
            <div style={{ fontSize: 11, color: S.textDim, marginTop: 6, fontFamily: "'IBM Plex Mono'" }}>
              Alta observada antes de apostar
            </div>
          </div>
        </div>

        <div className="grid-4" style={{ marginTop: 14 }}>
          <Stat label="ODD ORIGINAL" value={`${(betOdd * 100).toFixed(0)}%`} color={S.textDim} small />
          <Stat label="ODD APÓS ESPERA" value={`${(oddAfterWait * 100).toFixed(0)}%`} color={oddAfterWait > betOdd ? S.green : S.red} small />
          <Stat label="PAYOFF APÓS ESPERA" value={`$${winPayoffAfterWait.toFixed(0)}`} color={winPayoffAfterWait >= winPayoff ? S.green : S.gold} small />
          <div className="card" style={{ textAlign: "center", background: "#090914" }}>
            <div className="label">VEREDICTO</div>
            <div style={{ fontSize: 12, color: ethMoveWait >= 2 && waitDays <= 2 ? S.green : ethMoveWait >= 1 && waitDays <= 3 ? S.gold : ethMoveWait === 0 && waitDays >= 2 ? S.red : S.gold, marginTop: 4, fontFamily: "'IBM Plex Mono'", fontWeight: 600 }}>
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
      </CollapsibleCard>

      <CollapsibleCard title="DEPRECIAÇÃO DA APOSTA AO LONGO DA SEMANA" defaultOpen={true}>
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
                <div style={{ fontSize: 11, color: isEntry ? S.gold : isPast ? S.dim : S.textDim, marginBottom: 3, fontFamily: "'IBM Plex Mono'" }}>
                  {DAY_LABELS[day - 1]}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: isPast ? S.dim : col(value - betAmount), fontFamily: "'IBM Plex Mono'" }}>
                  {isPast ? "—" : `$${value?.toFixed(0)}`}
                </div>
                <div style={{ fontSize: 9, color: S.dim, fontFamily: "'IBM Plex Mono'" }}>
                  {isPast ? "" : `${pct?.toFixed(0)}%`}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 10, color: S.dim, marginTop: 8, fontFamily: "'IBM Plex Mono'" }}>
          Valor de revenda no mercado secundário · % do custo original recuperável
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="CENÁRIOS DE SAÍDA — ETH TOCA O LIMITE SUPERIOR" defaultOpen={true}>
        <div style={{ overflowX: "auto" }}>
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
      </CollapsibleCard>

      <CollapsibleCard title="⚡ SHORT PERPÉTUO — HEDGE DELTA"
        titleColor={S.purple} borderColor={S.purple + "50"} defaultOpen={true}>
        <div className="grid-2" style={{ gap: 16 }}>

          {/* Left — inputs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span className="label">QUANTIDADE SHORT (ETH)</span>
                <span style={{ color: S.purple, fontSize: 13, fontFamily: "'IBM Plex Mono'", fontWeight: 700 }}>
                  {shortEth} ETH
                </span>
              </div>
              <input type="range" min={0} max={Math.max(5, Math.ceil(deltaNeutral * 2))} step={0.05}
                value={shortEth} onChange={e => setShortEth(+e.target.value)}
                style={{ accentColor: S.purple }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9,
                color: S.dim, fontFamily: "'IBM Plex Mono'", marginTop: 4 }}>
                <span>0 (sem hedge)</span>
                <span style={{ color: S.purple }}>▼ delta neutro: {deltaNeutral.toFixed(3)} ETH</span>
                <span>{Math.ceil(deltaNeutral * 2)} ETH</span>
              </div>
              {/* Delta neutral indicator */}
              <div style={{ marginTop: 6, fontSize: 11, fontFamily: "'Inter'",
                color: Math.abs(shortEth - deltaNeutral) < 0.05 ? S.green
                     : shortEth < deltaNeutral * 0.5 ? S.red : S.gold }}>
                {Math.abs(shortEth - deltaNeutral) < 0.05
                  ? "✅ Delta neutro — posição perfeitamente hedgeada"
                  : shortEth === 0
                  ? "⚠ Sem short — exposição total ao movimento do ETH"
                  : shortEth < deltaNeutral
                  ? `⬇ Subhedgeado — delta residual: ${((deltaNeutral - shortEth) * ethPrice).toFixed(0)}$ em ETH`
                  : `⬆ Superhedgeado — short domina: ${((shortEth - deltaNeutral) * ethPrice).toFixed(0)}$ acima do neutro`}
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span className="label">FUNDING RATE (% / DIA)</span>
                <span style={{ color: S.textDim, fontSize: 13, fontFamily: "'IBM Plex Mono'" }}>
                  {fundingRate}%/dia → ${fundingCostWeek.toFixed(2)}/sem
                </span>
              </div>
              <input type="range" min={0} max={0.2} step={0.005}
                value={fundingRate} onChange={e => setFundingRate(+e.target.value)}
                style={{ accentColor: S.purple }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9,
                color: S.dim, fontFamily: "'IBM Plex Mono'", marginTop: 2 }}>
                <span>0%</span><span>0.05% (típico)</span><span>0.1% (alto)</span><span>0.2% (extremo)</span>
              </div>
            </div>

            <div style={{ padding: "10px 12px", background: "#090914", borderRadius: 8,
              border: `1px solid ${S.purple}30` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: S.dim, fontFamily: "'IBM Plex Mono'" }}>NOTIONAL</span>
                <span style={{ fontSize: 13, color: S.purple, fontFamily: "'IBM Plex Mono'", fontWeight: 600 }}>
                  ${shortNotional.toFixed(0)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: S.dim, fontFamily: "'IBM Plex Mono'" }}>PNL SE TOPO ↑</span>
                <span style={{ fontSize: 13, color: S.red, fontFamily: "'IBM Plex Mono'" }}>
                  {shortPnlTop >= 0 ? "+" : ""}${shortPnlTop.toFixed(0)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: S.dim, fontFamily: "'IBM Plex Mono'" }}>PNL SE FUNDO ↓</span>
                <span style={{ fontSize: 13, color: S.green, fontFamily: "'IBM Plex Mono'" }}>
                  +${shortPnlBot.toFixed(0)}
                </span>
              </div>
            </div>
          </div>

          {/* Right — PnL consolidado */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 10, color: S.dim, fontFamily: "'IBM Plex Mono'", letterSpacing: 1 }}>
              PNL CONSOLIDADO — LP + SHORT + APOSTAS
            </div>
            {[
              { label: "↔ RANGE (semana completa)", data: pnlRange, color: S.gold },
              { label: "↑ TOPO (sai pelo limite superior)", data: pnlTop, color: S.green },
              { label: "↓ FUNDO (sai pelo limite inferior)", data: pnlBot, color: S.red },
            ].map(({ label, data, color }) => (
              <div key={label} style={{ padding: "12px 14px", background: "#090914", borderRadius: 8,
                border: `1px solid ${color}25` }}>
                <div style={{ fontSize: 9, color: color, fontFamily: "'IBM Plex Mono'",
                  letterSpacing: 1, marginBottom: 8 }}>{label}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {[
                    { k: "LP (fees − stop)", v: data.lp },
                    { k: "Short perp", v: data.short },
                    { k: "Apostas", v: data.bet },
                  ].map(({ k, v }) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 11, color: S.dim, fontFamily: "'IBM Plex Mono'" }}>{k}</span>
                      <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono'",
                        color: v >= 0 ? S.green : S.red }}>
                        {v >= 0 ? "+" : ""}${v.toFixed(0)}
                      </span>
                    </div>
                  ))}
                  <div style={{ borderTop: `1px solid ${S.border}`, marginTop: 4, paddingTop: 6,
                    display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: S.textDim, fontFamily: "'IBM Plex Mono'" }}>
                      TOTAL
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Space Grotesk'",
                      color: data.total >= 0 ? S.green : S.red }}>
                      {data.total >= 0 ? "+" : ""}${data.total.toFixed(0)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            <div style={{ fontSize: 10, color: S.dim, fontFamily: "'Inter'", lineHeight: 1.5,
              padding: "8px 10px", background: S.purple + "08", borderRadius: 6,
              borderLeft: `2px solid ${S.purple}40` }}>
              💡 Delta neutro sugerido: <strong style={{ color: S.purple }}>{deltaNeutral.toFixed(3)} ETH</strong> = ${(deltaNeutral * ethPrice).toFixed(0)} notional
              · Funding semanal: <strong style={{ color: fundingCostWeek > feesWeek * 0.1 ? S.red : S.textDim }}>${fundingCostWeek.toFixed(2)}</strong>
              {fundingCostWeek > feesWeek * 0.15 && " ⚠ funding alto — monitore"}
            </div>
          </div>
        </div>
      </CollapsibleCard>

      {/* Alert Setup */}
      <AlertSetup ethPrice={ethPrice} plo={Plo} phi={Phi} capital={capital}
        onSetAlert={onSetAlert} requestAlertPermission={requestAlertPermission}
        alertSet={alertSet} setAlertSet={setAlertSet} />

      {/* Resumo previsibilidade */}
      <CollapsibleCard title="PREVISIBILIDADE — RESULTADO CONSOLIDADO"
        titleColor={S.green} borderColor={S.green + "40"} defaultOpen={true}>
        <div className="grid-3">
          {[
            { label: "↔ RANGE (semana)", value: `${pnlRange.total >= 0 ? "+" : ""}$${pnlRange.total.toFixed(0)}`, sub: `fees $${feesWeek.toFixed(0)} − funding $${fundingCostWeek.toFixed(0)} − apostas $${(betAmount+downBet).toFixed(0)}`, color: pnlRange.total >= 0 ? S.green : S.gold },
            { label: "↑ TOPO (com short+aposta)", value: `${pnlTop.total >= 0 ? "+" : ""}$${pnlTop.total.toFixed(0)}`, sub: pnlTop.total >= 0 ? "operação lucrativa mesmo saindo!" : `${(pnlTop.total / capital * 100).toFixed(1)}% do capital`, color: pnlTop.total >= 0 ? S.green : S.gold },
            { label: "↓ FUNDO (com short+aposta)", value: `${pnlBot.total >= 0 ? "+" : ""}$${pnlBot.total.toFixed(0)}`, sub: pnlBot.total >= 0 ? "short cobre o stop ✓" : `${(pnlBot.total / capital * 100).toFixed(1)}% do capital`, color: pnlBot.total >= 0 ? S.green : S.red },
          ].map(item => (
            <div key={item.label} style={{ textAlign: "center", padding: "16px", background: "#090914", borderRadius: 8, border: `1px solid ${item.color}20` }}>
              <div className="label">{item.label}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: item.color, fontFamily: "'Space Grotesk'", marginTop: 6 }}>{item.value}</div>
              <div style={{ fontSize: 10, color: S.textDim, marginTop: 4, fontFamily: "'IBM Plex Mono'", lineHeight: 1.4 }}>{item.sub}</div>
            </div>
          ))}
        </div>
        <div className="insight" style={{ marginTop: 14 }}>
          <strong style={{ color: S.green }}>Custo anual do seguro:</strong> ${betAmount} × 52 semanas = ${(betAmount * 52).toFixed(0)} · 
          Fees anuais estimadas: ${(capital * apr / 100).toFixed(0)} · 
          Funding anual: ${(fundingCostDay * 365).toFixed(0)} ·
          <strong style={{ color: S.gold }}> APR líquido: {(apr - (betAmount * 52 / capital * 100) - (fundingCostDay * 365 / capital * 100)).toFixed(0)}% aa</strong>
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="VISÃO GERAL DA ESTRATÉGIA" titleColor={S.gold} borderColor={S.gold + '40'} defaultOpen={true}>
      <StrategyChart
        ethPrice={ethPrice} capital={capital} rangeLo={rangeLo} rangeHi={rangeHi}
        apr={apr} stopPct={stopPct} betOdd={betOdd} betAmount={betAmount}
      />
      </CollapsibleCard>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// STRATEGY CHART COMPONENT
// ═══════════════════════════════════════════════════════════════
function StrategyChart({ ethPrice, capital, rangeLo, rangeHi, apr, stopPct, betOdd, betAmount }) {
  const canvasRef = useRef(null);

  const Plo      = ethPrice * (1 - rangeLo / 100);
  const Phi      = ethPrice * (1 + rangeHi / 100);
  const feesDay  = capital * (apr / 100) / 365;
  const stop     = capital * stopPct / 100;
  const payoff   = betAmount / betOdd;

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx    = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // ── Layout ──────────────────────────────────────────────────
    const pad   = { t: 40, b: 50, l: 60, r: 160 };
    const cW    = W - pad.l - pad.r;
    const cH    = H - pad.t - pad.b;
    const DAYS  = 28; // 4 weeks

    // Price range for Y axis
    const minP  = ethPrice * 0.60;
    const maxP  = ethPrice * 1.30;
    const xS    = d => pad.l + (d / (DAYS - 1)) * cW;
    const yS    = p => pad.t + cH - ((p - minP) / (maxP - minP)) * cH;

    // ── Background ──────────────────────────────────────────────
    ctx.fillStyle = "#070710";
    ctx.fillRect(0, 0, W, H);

    // ── LP Range zone (gold fill) ────────────────────────────────
    ctx.fillStyle = "rgba(232,184,75,0.07)";
    ctx.fillRect(pad.l, yS(Phi), cW, yS(Plo) - yS(Phi));

    // ── Fee accumulation area (inside range, green gradient) ─────
    // Show fees as a growing band from bottom of range
    const grad = ctx.createLinearGradient(pad.l, 0, pad.l + cW, 0);
    grad.addColorStop(0, "rgba(61,214,140,0.0)");
    grad.addColorStop(1, "rgba(61,214,140,0.12)");
    ctx.fillStyle = grad;
    ctx.fillRect(pad.l, yS(Phi), cW * 0.75, yS(Plo) - yS(Phi));

    // ── Grid lines (weeks) ───────────────────────────────────────
    ctx.strokeStyle = "#1a1a2e"; ctx.lineWidth = 1;
    [7, 14, 21].forEach(d => {
      ctx.beginPath();
      ctx.setLineDash([3, 4]);
      ctx.moveTo(xS(d), pad.t);
      ctx.lineTo(xS(d), pad.t + cH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#454560";
      ctx.font = "9px IBM Plex Mono";
      ctx.textAlign = "center";
      ctx.fillText(`Sem ${d/7}`, xS(d), H - 10);
    });
    // Day 0 label
    ctx.fillStyle = "#454560"; ctx.font = "9px IBM Plex Mono"; ctx.textAlign = "center";
    ctx.fillText("Entrada", xS(0), H - 10);
    ctx.fillText("Sem 4", xS(27), H - 10);

    // ── Y axis price labels ──────────────────────────────────────
    [Plo, ethPrice, Phi].forEach((p, i) => {
      const colors = ["#f06060", "#e8b84b", "#3dd68c"];
      const labels = ["Limite ↓", "Entrada", "Limite ↑"];
      ctx.strokeStyle = colors[i] + "60"; ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(pad.l, yS(p)); ctx.lineTo(pad.l + cW, yS(p)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = colors[i];
      ctx.font = "bold 9px IBM Plex Mono";
      ctx.textAlign = "right";
      ctx.fillText(`$${Math.round(p)}`, pad.l - 4, yS(p) + 3);
      ctx.textAlign = "left";
      ctx.fillStyle = colors[i] + "90";
      ctx.font = "8px IBM Plex Mono";
      ctx.fillText(labels[i], pad.l + cW + 6, yS(p) + 3);
    });

    // ── Scenario paths ───────────────────────────────────────────
    const seed = n => Math.sin(n * 9301 + 49297) * 0.5 + 0.5;

    // Path A: stays in range 4 weeks (main scenario — fees)
    const pathRange = Array.from({ length: DAYS }, (_, i) =>
      ethPrice + Math.sin(i * 0.55) * (ethPrice * 0.055) + Math.cos(i * 1.1) * (ethPrice * 0.025) + (seed(i + 10) - 0.5) * (ethPrice * 0.015)
    );

    // Path B: breaks upper on day 12
    const pathUpper = Array.from({ length: DAYS }, (_, i) => {
      if (i < 10) return ethPrice + Math.sin(i * 0.5) * (ethPrice * 0.04) + (seed(i + 50) - 0.5) * (ethPrice * 0.01);
      if (i < 13) return ethPrice * (1 + (i - 9) * 0.035) + (seed(i + 50) - 0.5) * (ethPrice * 0.008);
      return Phi + (seed(i + 60) - 0.5) * (ethPrice * 0.01);
    });

    // Path C: breaks lower on day 18
    const pathLower = Array.from({ length: DAYS }, (_, i) => {
      if (i < 15) return ethPrice - Math.sin(i * 0.4) * (ethPrice * 0.03) + (seed(i + 90) - 0.5) * (ethPrice * 0.012);
      if (i < 19) return ethPrice * (1 - (i - 14) * 0.028) + (seed(i + 90) - 0.5) * (ethPrice * 0.008);
      return Plo - (seed(i + 100) - 0.5) * (ethPrice * 0.008);
    });

    // Draw Path A (range — dashed gold, full width)
    ctx.beginPath(); ctx.strokeStyle = "#e8b84b80"; ctx.lineWidth = 1.5; ctx.setLineDash([5, 3]);
    pathRange.forEach((p, i) => i === 0 ? ctx.moveTo(xS(i), yS(p)) : ctx.lineTo(xS(i), yS(p)));
    ctx.stroke(); ctx.setLineDash([]);

    // Draw Path B (upper break — green solid up to exit, ghost after)
    const exitB = 12;
    ctx.beginPath(); ctx.strokeStyle = "#3dd68c"; ctx.lineWidth = 2;
    ctx.shadowColor = "#3dd68c"; ctx.shadowBlur = 4;
    pathUpper.slice(0, exitB + 1).forEach((p, i) => i === 0 ? ctx.moveTo(xS(i), yS(p)) : ctx.lineTo(xS(i), yS(p)));
    ctx.stroke(); ctx.shadowBlur = 0;
    // Ghost continuation
    ctx.beginPath(); ctx.strokeStyle = "#3dd68c25"; ctx.lineWidth = 1; ctx.setLineDash([2, 4]);
    pathUpper.slice(exitB).forEach((p, i) => i === 0 ? ctx.moveTo(xS(exitB + i), yS(p)) : ctx.lineTo(xS(exitB + i), yS(p)));
    ctx.stroke(); ctx.setLineDash([]);
    // Exit dot
    ctx.beginPath(); ctx.arc(xS(exitB), yS(pathUpper[exitB]), 5, 0, Math.PI * 2);
    ctx.fillStyle = "#3dd68c"; ctx.fill();

    // Draw Path C (lower break — red solid up to exit)
    const exitC = 18;
    ctx.beginPath(); ctx.strokeStyle = "#f06060"; ctx.lineWidth = 2;
    ctx.shadowColor = "#f06060"; ctx.shadowBlur = 4;
    pathLower.slice(0, exitC + 1).forEach((p, i) => i === 0 ? ctx.moveTo(xS(i), yS(p)) : ctx.lineTo(xS(i), yS(p)));
    ctx.stroke(); ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.strokeStyle = "#f0606025"; ctx.lineWidth = 1; ctx.setLineDash([2, 4]);
    pathLower.slice(exitC).forEach((p, i) => i === 0 ? ctx.moveTo(xS(exitC + i), yS(p)) : ctx.lineTo(xS(exitC + i), yS(p)));
    ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(xS(exitC), yS(pathLower[exitC]), 5, 0, Math.PI * 2);
    ctx.fillStyle = "#f06060"; ctx.fill();

    // ── Fee accumulation bar (bottom strip) ─────────────────────
    const feeBarH = 6;
    const feeBarY = pad.t + cH + 16;
    // Background track
    ctx.fillStyle = "#1a1a2e";
    ctx.beginPath(); ctx.roundRect(pad.l, feeBarY, cW, feeBarH, 3); ctx.fill();
    // Growing fee bar (for range scenario — full 4 weeks)
    const feeTotal = feesDay * DAYS;
    const feeBarW  = cW * 0.75; // ~3 weeks in range before exit
    const feeGrad  = ctx.createLinearGradient(pad.l, 0, pad.l + feeBarW, 0);
    feeGrad.addColorStop(0, "#3dd68c40");
    feeGrad.addColorStop(1, "#3dd68c");
    ctx.fillStyle = feeGrad;
    ctx.beginPath(); ctx.roundRect(pad.l, feeBarY, feeBarW, feeBarH, 3); ctx.fill();

    // ── Annotations ─────────────────────────────────────────────
    ctx.textAlign = "left";

    // Title
    ctx.fillStyle = "#e8b84b";
    ctx.font = "bold 11px Space Grotesk";
    ctx.fillText("ESTRATÉGIA LP HEDGE", pad.l, 20);
    ctx.fillStyle = "#454560";
    ctx.font = "9px IBM Plex Mono";
    ctx.fillText(`Capital $${capital.toLocaleString()} · APR ${apr}% · Stop ${stopPct}% · Aposta ${(betOdd*100).toFixed(0)}%`, pad.l, 32);

    // Right-side outcome boxes
    const boxX  = pad.l + cW + 8;
    const boxW  = pad.r - 14;

    // Outcome: Upper break
    const netUpper = feesDay * exitB - stop + payoff - betAmount;
    ctx.fillStyle = "#3dd68c20";
    ctx.beginPath(); ctx.roundRect(boxX, yS(Phi) - 12, boxW, 46, 4); ctx.fill();
    ctx.strokeStyle = "#3dd68c50"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(boxX, yS(Phi) - 12, boxW, 46, 4); ctx.stroke();
    ctx.fillStyle = "#3dd68c"; ctx.font = "bold 10px Space Grotesk"; ctx.textAlign = "center";
    ctx.fillText("↑ TOPO", boxX + boxW/2, yS(Phi) + 4);
    ctx.font = "bold 12px Space Grotesk";
    ctx.fillText(`${netUpper >= 0 ? "+" : ""}$${netUpper.toFixed(0)}`, boxX + boxW/2, yS(Phi) + 18);
    ctx.fillStyle = "#3dd68c80"; ctx.font = "8px IBM Plex Mono";
    ctx.fillText(`aposta paga $${payoff.toFixed(0)}`, boxX + boxW/2, yS(Phi) + 30);

    // Outcome: Range (fees)
    const feesRange = feesDay * DAYS;
    ctx.fillStyle = "#e8b84b15";
    ctx.beginPath(); ctx.roundRect(boxX, yS(ethPrice) - 24, boxW, 48, 4); ctx.fill();
    ctx.strokeStyle = "#e8b84b40"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(boxX, yS(ethPrice) - 24, boxW, 48, 4); ctx.stroke();
    ctx.fillStyle = "#e8b84b"; ctx.font = "bold 10px Space Grotesk"; ctx.textAlign = "center";
    ctx.fillText("↔ RANGE", boxX + boxW/2, yS(ethPrice) - 8);
    ctx.font = "bold 12px Space Grotesk";
    ctx.fillText(`+$${(feesRange - betAmount * (DAYS/7)).toFixed(0)}`, boxX + boxW/2, yS(ethPrice) + 6);
    ctx.fillStyle = "#e8b84b80"; ctx.font = "8px IBM Plex Mono";
    ctx.fillText(`fees - apostas`, boxX + boxW/2, yS(ethPrice) + 18);

    // Outcome: Lower break
    const netLower = feesDay * exitC - stop - betAmount;
    ctx.fillStyle = "#f0606015";
    ctx.beginPath(); ctx.roundRect(boxX, yS(Plo) - 34, boxW, 48, 4); ctx.fill();
    ctx.strokeStyle = "#f0606040"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(boxX, yS(Plo) - 34, boxW, 48, 4); ctx.stroke();
    ctx.fillStyle = "#f06060"; ctx.font = "bold 10px Space Grotesk"; ctx.textAlign = "center";
    ctx.fillText("↓ FUNDO", boxX + boxW/2, yS(Plo) - 18);
    ctx.font = "bold 12px Space Grotesk";
    ctx.fillText(`${netLower >= 0 ? "+" : ""}$${netLower.toFixed(0)}`, boxX + boxW/2, yS(Plo) - 4);
    ctx.fillStyle = "#f0606080"; ctx.font = "8px IBM Plex Mono";
    ctx.fillText(`short amortece`, boxX + boxW/2, yS(Plo) + 8);

    // Bet annotation (weekly flag on path B)
    [0, 7, 12].forEach((d, i) => {
      if (d >= exitB && i > 0) return;
      const p = pathUpper[d];
      ctx.fillStyle = i === 0 ? "#e8b84b" : d < exitB ? "#e8b84b80" : "#3dd68c";
      ctx.beginPath(); ctx.arc(xS(d), yS(p) - 14, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = i === 0 ? "#e8b84b" : "#e8b84b60";
      ctx.font = "8px IBM Plex Mono"; ctx.textAlign = "center";
      ctx.fillText(i === 0 ? `$${betAmount}` : d < exitB ? `$${betAmount}` : "paga!", xS(d), yS(p) - 20);
    });

    // Fee bar label
    ctx.fillStyle = "#3dd68c";
    ctx.font = "8px IBM Plex Mono"; ctx.textAlign = "left";
    ctx.fillText(`fees acumuladas: +$${(feesDay * DAYS * 0.75).toFixed(0)} (range)`, pad.l + 4, feeBarY - 3);

  }, [ethPrice, capital, rangeLo, rangeHi, apr, stopPct, betOdd, betAmount]);

  return (
    <div className="card" style={{ borderColor: S.gold + "40" }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "1px", fontFamily: "'IBM Plex Mono',monospace", color: "inherit", marginBottom: 12, color: S.gold }}>VISÃO GERAL DA ESTRATÉGIA</div>
      <canvas ref={canvasRef} width={820} height={320}
        style={{ width: "100%", height: "auto", borderRadius: 8, display: "block" }} />
      <div className="grid-3" style={{ marginTop: 12 }}>
        {[
          { color: S.green,   dash: false, label: "Saída pelo topo",  sub: "Aposta cobre o stop → lucro" },
          { color: S.gold,    dash: true,  label: "Lateral no range", sub: "Fees acumulam semana a semana" },
          { color: S.red,     dash: false, label: "Saída pelo fundo", sub: "Short + aposta amortece o stop" },
        ].map(item => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10,
            padding: "8px 12px", background: "#090914", borderRadius: 6 }}>
            <div style={{ width: 24, height: 2, background: item.color,
              borderTop: item.dash ? `2px dashed ${item.color}` : "none",
              opacity: item.dash ? 1 : 1, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 11, color: item.color, fontFamily: "'IBM Plex Mono'", fontWeight: 600 }}>{item.label}</div>
              <div style={{ fontSize: 10, color: S.dim, fontFamily: "'Inter'", marginTop: 1 }}>{item.sub}</div>
            </div>
          </div>
        ))}
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
    // Cenário 5 — Saída antecipada (sobe forte dia 3, fecha com lucro parcial)
    case 4: return Array.from({ length: 14 }, (_, i) => {
      if (i < 3) return 2000 + i * 48 + (seed(i + 400) - 0.5) * 12;
      if (i < 6) return 2144 + (seed(i + 420) - 0.5) * 18; // plateau próximo do topo
      return 2144 - (i - 5) * 12 + (seed(i + 440) - 0.5) * 20; // começa a cair
    });
    // Cenário 6 — Rebalanceamento (ETH se aproxima do limite, fecha e reabre)
    case 5: return Array.from({ length: 28 }, (_, i) => {
      if (i < 8) return 2000 + i * 22 + (seed(i + 500) - 0.5) * 20;  // sobe suave
      if (i < 10) return 2176 + (seed(i + 520) - 0.5) * 15;           // próximo do topo ≈ 2180
      if (i < 18) return 2050 + Math.sin((i-10) * 0.9) * 55 + (seed(i + 540) - 0.5) * 18; // novo range
      if (i < 22) return 2050 + (i-17) * 30 + (seed(i + 560) - 0.5) * 15;
      return 2170 + (seed(i + 580) - 0.5) * 20;
    });
    // Cenário 7 — Chop (oscila muito, fecha flat, apostas viram pó)
    case 6: return Array.from({ length: 21 }, (_, i) => {
      return 2000 + Math.sin(i * 1.4) * 85 + Math.cos(i * 2.1) * 40 + (seed(i + 600) - 0.5) * 30;
    });
    // Cenário 8 — 2 meses no range (8 semanas, aposta toda semana, valem?)
    case 7: return Array.from({ length: 62 }, (_, i) => {
      const base = 2000 + Math.sin(i * 0.18) * 70 + Math.sin(i * 0.42) * 35;
      return base + (seed(i + 700) - 0.5) * 28;
    });
    // Cenário 9 — Gap de mercado (-25% overnight, sem chance de fechar no stop)
    case 8: return Array.from({ length: 14 }, (_, i) => {
      const seed = (n) => Math.sin(n * 9301 + 49297) * 0.5 + 0.5;
      if (i === 0) return 2000;
      if (i === 1) return 1500; // gap -25% overnight
      if (i < 5) return 1500 + Math.sin(i * 0.9) * 30 + (seed(i + 800) - 0.5) * 20; // lateral abaixo
      return 1500 + (i - 4) * 15 + (seed(i + 820) - 0.5) * 25; // lenta recuperação
    });
    default: return [];
  }
}

const SCENARIO_META = [
  { title: "Cenário 1", subtitle: "Lateral 2-3 semanas → cai ao fundo", color: "#f06060",
    desc: "ETH oscila dentro do range por ~18 dias acumulando fees, depois cai e toca o limite inferior. Aposta não serve, mas fees absorvem tudo." },
  { title: "Cenário 2", subtitle: "Sobe rápido em 2 dias", color: "#3dd68c",
    desc: "ETH dispara e toca o limite superior em 2 dias. Pouco fee acumulado, mas aposta paga e transforma o stop em lucro." },
  { title: "Cenário 3", subtitle: "Lateral 3+ semanas → rompe para cima", color: "#5b9cf6",
    desc: "ETH oscila por 21 dias acumulando fees generosas, depois rompe. Custo das apostas renovadas é absorvido pelas fees." },
  { title: "Cenário 4", subtitle: "Cai → lateral → rompe em 2 semanas", color: "#a78bfa",
    desc: "ETH cai inicialmente, estabiliza, depois rompe para cima em ~14 dias. Aposta salva a saída pelo topo." },
  { title: "Cenário 5", subtitle: "Saída antecipada no dia 5", color: "#f59e0b",
    desc: "ETH sobe forte e chega a 93% do limite superior no dia 3. Você fecha a posição e vende a aposta pelo valor de mercado (≈55% do payoff máximo). Realize o ganho parcial ou aguarda o toque?" },
  { title: "Cenário 6", subtitle: "Rebalanceamento no limite", color: "#06b6d4",
    desc: "ETH se aproxima do topo no dia 8 sem tocar. Você fecha, paga gas + spread, e reabre no novo range centrado em $2.150. Custo real do rebalanceamento vs risco de sair pelo limite sem hedge." },
  { title: "Cenário 7", subtitle: "Chop: oscila muito, fecha flat", color: "#e879f9",
    desc: "ETH oscila ±8% dentro do range durante 3 semanas mas fecha próximo do preço de entrada. Fees boas pelas oscilações, mas cada aposta semanal virou pó. Vale a pena hedgear em mercados laterais voláteis?" },
  { title: "Cenário 8", subtitle: "2 meses no range — aposta toda semana?", color: "#34d399",
    desc: "ETH permanece no range por 8 semanas completas. 8 apostas consecutivas, todas expiram sem valor. As fees acumuladas justificam o custo total do hedge? Quando parar de apostar?" },
  { title: "Cenário 9", subtitle: "Gap -25% overnight no fim de semana", color: "#ff4444",
    desc: "ETH abre segunda com gap de -25% (notícia negativa no fim de semana). Você não consegue fechar no stop — sai muito abaixo do previsto. O short perpétuo amortece mas não cobre tudo. Qual o prejuízo real vs o simulado?" },
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
      ctx.fillStyle = c + "80"; ctx.font = "9px IBM Plex Mono"; ctx.textAlign = "right";
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
    ctx.fillStyle = "#333"; ctx.font = "8px IBM Plex Mono"; ctx.textAlign = "center";
    for (let d = 0; d < path.length; d += 7) ctx.fillText(`d${d}`, xS(d), H - 4);
  }, [path, color, exitIdx, exitType]);
  return <canvas ref={canvasRef} width={380} height={160} style={{ width: "100%", height: 160, borderRadius: 6 }} />;
}

function calcScenario(path, betOdd = 0.15, betAmount = 20, capital = 4000, apr = 100, stopPct = 2, scenarioIdx = 0) {
  const LOWER = 1800, UPPER = 2200;
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
  let netPnL = lpPnL + betPayoff - totalBetCost;
  let netWithout = lpPnL;
  let extra = {};

  // Scenario 5: Early exit — sell bet at 55% of max payoff on day 5
  if (scenarioIdx === 4) {
    const earlyExitDay = 5;
    const feesEarly = feesDay * earlyExitDay;
    const betResaleValue = winPayoff * 0.55; // sell bet at 55% before expiry
    const betCost = betAmount;
    const lpPnLEarly = feesEarly; // still in range, no stop
    const netEarly = lpPnLEarly + betResaleValue - betCost;
    const netWait = lpPnL + betPayoff - totalBetCost; // if waits til expiry
    extra = { earlyExitDay, feesEarly, betResaleValue, netEarly, netWait,
      insight: `Saída dia ${earlyExitDay}: +$${feesEarly.toFixed(0)} fees + $${betResaleValue.toFixed(0)} aposta (55% do máx) = $${netEarly.toFixed(0)} vs aguardar = $${netWait.toFixed(0)}` };
    netPnL = netEarly;
    exitDay = earlyExitDay;
    exitType = "early";
  }

  // Scenario 6: Rebalance cost — gas + spread + fees lost during reopen (≈1.5 days of fees + $15 gas)
  if (scenarioIdx === 5) {
    const rebalanceDay = 8;
    const feesBeforeRebal = feesDay * rebalanceDay;
    const rebalanceCost = feesDay * 1.5 + 15; // 1.5 days lost fees + gas
    const feesAfterRebal = feesDay * (path.length - rebalanceDay); // continues in new range
    const totalFees = feesBeforeRebal + feesAfterRebal;
    const netWithRebal = totalFees - rebalanceCost - totalBetCost;
    const netWithoutRebal = lpPnL - totalBetCost; // risk: could hit limit
    extra = { rebalanceDay, rebalanceCost: rebalanceCost.toFixed(0), feesBeforeRebal: feesBeforeRebal.toFixed(0),
      feesAfterRebal: feesAfterRebal.toFixed(0),
      insight: `Custo rebalanceamento dia ${rebalanceDay}: $${rebalanceCost.toFixed(0)} (gas + ${1.5} dias de fees perdidas). Fees totais: $${totalFees.toFixed(0)}. Evita stop de $${stop.toFixed(0)}.` };
    netPnL = netWithRebal;
    netWithout = netWithoutRebal;
  }

  // Scenario 7: Chop — all bets expire worthless, but fees are good
  if (scenarioIdx === 6) {
    const chopWeeks = 3;
    const totalBets = betAmount * chopWeeks;
    const chopFees = fees;
    const netChopWithBet = chopFees - totalBets;
    const netChopWithout = chopFees;
    const hedgeEfficiency = (totalBets / chopFees * 100).toFixed(0);
    extra = { chopWeeks, totalBets, chopFees: chopFees.toFixed(0), hedgeEfficiency,
      insight: `${chopWeeks} apostas expiram sem valor (-$${totalBets}). Fees: +$${chopFees.toFixed(0)}. Custo do hedge = ${hedgeEfficiency}% das fees. ${parseFloat(hedgeEfficiency) < 30 ? "✓ Razoável" : "⚠ Custo alto — considere só apostar com viés"}` };
    netPnL = netChopWithBet;
    netWithout = netChopWithout;
  }

  // Scenario 9: Gap — ETH drops 25% overnight, can't close at stop
  if (scenarioIdx === 8) {
    const gapPct    = 25;                         // gap size %
    const shortCovers = gapPct * 0.6;             // short covers ~60% of gap move
    const netExposure = gapPct - shortCovers;      // residual ~10%
    const gapLoss   = capital * netExposure / 100;
    const fees1day  = feesDay * 1;                // only 1 day of fees before gap
    const netGap    = fees1day - gapLoss;
    const vsSimulated = -(stop) - netGap;         // how much worse than stop
    extra = {
      gapPct, shortCovers, netExposure,
      gapLoss: gapLoss.toFixed(0),
      vsSimulated: Math.abs(vsSimulated).toFixed(0),
      insight: `Gap de -${gapPct}% overnight. Short cobre ~${shortCovers}% → exposição residual ${netExposure}% = -$${gapLoss.toFixed(0)}. ${netExposure < 5 ? "✓ Short absorveu bem — perda controlada" : "⚠ Perda real significativamente maior que o stop simulado de $" + stop.toFixed(0)}`
    };
    netPnL    = fees1day - gapLoss - betAmount;
    netWithout = fees1day - gapLoss;
    exitDay   = 1;
    exitType  = "lower";
  }

  // Scenario 8: 2 months in range — weekly bet question
  if (scenarioIdx === 7) {
    const weeks8 = 8;
    const totalBets8 = betAmount * weeks8;
    const fees8 = feesDay * 62;
    const netWith8 = fees8 - totalBets8;
    const netWithout8 = fees8;
    const breakEvenWeeks = Math.ceil(fees8 / betAmount);
    // When does it stop making sense to bet? After absorbing stop loss fully
    const weeksToAbsorbStop = Math.ceil(stop / betAmount);
    const betEfficiency = (totalBets8 / fees8 * 100).toFixed(0);
    extra = { weeks8, totalBets8, fees8: fees8.toFixed(0), netWith8, netWithout8,
      breakEvenWeeks, weeksToAbsorbStop, betEfficiency,
      insight: `8 semanas no range: fees $${fees8.toFixed(0)}, 8 apostas -$${totalBets8}. Stop = $${stop.toFixed(0)} = ${weeksToAbsorbStop} semanas de aposta. Após absorver o stop (sem.${weeksToAbsorbStop}+), apostar deixa de compensar? Eficiência do hedge: ${betEfficiency}% das fees.` };
    netPnL = netWith8;
    netWithout = netWithout8;
    exitDay = 61;
    exitType = "still_in";
  }

  return { fees, exitDay, exitType, weeksActive, totalBetCost, betPayoff, lpPnL, netPnL, netWithout, winPayoff, stop, extra };
}

function TabScenarios() {
  const [betOdd, setBetOdd] = useState(0.15);
  const [downOdd, setDownOdd] = useState(0.02);
  const [downBet, setDownBet] = useState(5);
  const [betAmount, setBetAmount] = useState(20);
  const [capital, setCapital] = useState(4000);
  const [apr, setApr] = useState(100);
  const [stopPct, setStopPct] = useState(2);
  const [rangeLo3, setRangeLo3] = useState(10);
  const [rangeHi3, setRangeHi3] = useState(10);
  const [activeIdx, setActiveIdx] = useState(null);
  const paths = useMemo(() => SCENARIO_META.map((_, i) => generatePath(i)), []);
  const results = useMemo(() => paths.map((p, i) => calcScenario(p, betOdd, betAmount, capital, apr, stopPct, i)), [paths, betOdd, betAmount, capital, apr, stopPct]);
  const DAY_LABELS = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom","Seg","Ter","Qua","Qui","Sex","Sáb","Dom","Seg","Ter","Qua","Qui","Sex","Sáb","Dom","Seg","Ter","Qua","Dom"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Controls */}
      <div className="card">
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "1px", fontFamily: "'IBM Plex Mono',monospace", color: "inherit", marginBottom: 14 }}>PARÂMETROS GLOBAIS</div>
        <div className="grid-5">
          <Field label="CAPITAL" value={capital} onChange={setCapital} prefix="$" min={500} max={100000} step={100} />
          <Field label="APR" value={apr} onChange={setApr} suffix="%" min={10} max={500} step={5} />
          <Field label="STOP %" value={stopPct} onChange={setStopPct} suffix="%" min={0.5} max={15} step={0.1} />
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span className="label">ODD APOSTA</span>
              <span style={{ color: S.gold, fontSize: 13, fontFamily: "'IBM Plex Mono'" }}>{(betOdd*100).toFixed(0)}%</span>
            </div>
            <input type="range" min={3} max={50} step={1}
              value={Math.round(betOdd*100)}
              onChange={e => setBetOdd(+e.target.value/100)} />
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span className="label">APOSTA/SEM</span>
              <span style={{ color: S.gold, fontSize: 12, fontFamily: "'IBM Plex Mono'" }}>${betAmount}</span>
            </div>
            <input type="range" min={5} max={80} step={5} value={betAmount} onChange={e => setBetAmount(+e.target.value)} />
          </div>
        </div>
      </div>

      {/* Scenario grid */}
      <div className="grid-2" style={{ gap: 14 }}>
        {SCENARIO_META.map((sc, idx) => {
          const r = results[idx];
          const isActive = activeIdx === idx;
          return (
            <div key={idx} className="card" style={{ cursor: "pointer", borderColor: isActive ? sc.color : S.border, transition: "border-color 0.2s" }}
              onClick={() => setActiveIdx(isActive ? null : idx)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: sc.color, letterSpacing: 2, fontFamily: "'IBM Plex Mono'" }}>{sc.title.toUpperCase()}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Space Grotesk'", marginTop: 2 }}>{sc.subtitle}</div>
                </div>
                <div style={{
                  fontSize: 16, fontWeight: 800, fontFamily: "'Space Grotesk'",
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
                    <div style={{ fontSize: 9, color: S.dim, fontFamily: "'IBM Plex Mono'" }}>{item.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: item.c || S.text, fontFamily: "'IBM Plex Mono'", marginTop: 2 }}>{item.value}</div>
                  </div>
                ))}
              </div>

              {isActive && (
                <div className="insight" style={{ borderColor: sc.color }}>
                  <strong style={{ color: sc.color }}>{sc.title}:</strong> {sc.desc}
                  {r.extra?.insight && <><br /><br /><span style={{ color: S.gold }}>📊 {r.extra.insight}</span></>}
                  {!r.extra?.insight && r.exitType === "upper" && <><br /><strong style={{ color: S.green }}>Aposta pagou ${r.betPayoff.toFixed(0)}</strong> — stop de $${r.stop.toFixed(0)} virou {r.netPnL >= 0 ? `lucro de $${r.netPnL.toFixed(0)}` : `perda mínima de $${Math.abs(r.netPnL).toFixed(0)}`}.</>}
                  {!r.extra?.insight && r.exitType === "lower" && <><br />Aposta não serviu (custo ${r.totalBetCost}). Fees de ${r.fees.toFixed(0)} {r.lpPnL >= 0 ? "cobriram o stop" : `não cobriram o stop de $${r.stop.toFixed(0)}`}.</>}
                  <br /><strong style={{ color: S.gold }}>Diferença com aposta: {fmtUSD(r.netPnL - r.netWithout)}</strong>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="card">
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "1px", fontFamily: "'IBM Plex Mono',monospace", color: "inherit", marginBottom: 12 }}>RESUMO COMPARATIVO</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {SCENARIO_META.map((sc, idx) => {
            const r = results[idx];
            return (
              <div key={idx} style={{ textAlign: "center", padding: "14px 8px", background: "#090914", borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: sc.color, fontFamily: "'IBM Plex Mono'", marginBottom: 6 }}>{sc.title.toUpperCase()}</div>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Space Grotesk'", color: r.netPnL >= 0 ? S.green : S.red }}>
                  {r.netPnL >= 0 ? "+" : ""}${r.netPnL.toFixed(0)}
                </div>
                <div style={{ fontSize: 10, color: S.textDim, marginTop: 4, fontFamily: "'IBM Plex Mono'" }}>
                  sem hedge: {r.netWithout >= 0 ? "+" : ""}${r.netWithout.toFixed(0)}
                </div>
                <div style={{ fontSize: 11, marginTop: 4, fontFamily: "'IBM Plex Mono'", color: col(r.netPnL - r.netWithout) }}>
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
// DOWNSIDE PANEL
// ═══════════════════════════════════════════════════════════════
function DownsidePanel({ ethPrice, rangePct, downOdd, setDownOdd, downBet, setDownBet, stopPct, capital, feesDay }) {
  const strikeTarget  = ethPrice ? Math.round(ethPrice * (1 - rangePct / 100) / 100) * 100 : 1800;
  const downOddDec    = downOdd / 100;
  const payoffMax     = downBet / downOddDec;
  const multMax       = payoffMax / downBet;
  const stop          = capital * stopPct / 100;
  // Short perpétuo cobre ~60% do movimento downside
  const shortCovers   = stop * 0.60;
  const residual      = Math.max(0, stop - shortCovers);
  const minBetNeeded  = residual * downOddDec; // aposta mínima para cobrir residual
  const isOptimal     = downBet >= minBetNeeded;
  const netIfFund     = payoffMax - stop;

  return (
    <CollapsibleCard title="⬇ HEDGE DOWNSIDE" titleColor={S.red} borderColor={S.red + "40"} defaultOpen={true}
      subtitle="Strike -10% · Short cobre ~60% · aposta cobre o resíduo">

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Strike info */}
        <div style={{ padding: "10px 12px", background: "#090914", borderRadius: 8,
          border: `1px solid ${S.red}30` }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: S.dim, fontFamily: "'IBM Plex Mono'" }}>STRIKE ALVO</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: S.red, fontFamily: "'Space Grotesk'" }}>
              ${strikeTarget.toLocaleString()}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontSize: 11, color: S.dim, fontFamily: "'IBM Plex Mono'" }}>STOP RESIDUAL</span>
            <span style={{ fontSize: 13, color: S.textDim, fontFamily: "'IBM Plex Mono'" }}>
              ${residual.toFixed(0)} <span style={{ color: S.dim, fontSize: 10 }}>(após short)</span>
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontSize: 11, color: S.dim, fontFamily: "'IBM Plex Mono'" }}>APOSTA MÍN.</span>
            <span style={{ fontSize: 13, color: isOptimal ? S.green : S.gold, fontFamily: "'IBM Plex Mono'" }}>
              ${minBetNeeded.toFixed(2)} {isOptimal ? "✓" : "⚠"}
            </span>
          </div>
        </div>

        {/* Odd slider */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span className="label">ODD DOWNSIDE</span>
            <span style={{ color: S.red, fontSize: 14, fontFamily: "'IBM Plex Mono'", fontWeight: 700 }}>
              {downOdd}% → {multMax.toFixed(0)}x
            </span>
          </div>
          <input type="range" min={1} max={15} step={0.5}
            value={downOdd} onChange={e => setDownOdd(+e.target.value)} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9,
            color: S.dim, fontFamily: "'IBM Plex Mono'", marginTop: 2 }}>
            <span>1% (100x)</span><span>5% (20x)</span><span>15% (7x)</span>
          </div>
        </div>

        {/* Bet amount */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span className="label">VALOR APOSTADO</span>
            <span style={{ color: S.gold, fontSize: 13, fontFamily: "'IBM Plex Mono'" }}>${downBet}</span>
          </div>
          <input type="range" min={1} max={50} step={1}
            value={downBet} onChange={e => setDownBet(+e.target.value)} />
        </div>

        {/* Result */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={{ padding: "12px 10px", background: "#090914", borderRadius: 8, textAlign: "center",
            border: `1px solid ${netIfFund >= 0 ? S.green : S.red}30` }}>
            <div style={{ fontSize: 9, color: S.dim, fontFamily: "'IBM Plex Mono'" }}>SE TOCAR O FUNDO</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Space Grotesk'",
              color: netIfFund >= 0 ? S.green : S.red, marginTop: 4 }}>
              {netIfFund >= 0 ? "+" : ""}${netIfFund.toFixed(0)}
            </div>
            <div style={{ fontSize: 10, color: S.dim, fontFamily: "'IBM Plex Mono'", marginTop: 2 }}>
              payoff ${payoffMax.toFixed(0)} − stop ${stop.toFixed(0)}
            </div>
          </div>
          <div style={{ padding: "12px 10px", background: "#090914", borderRadius: 8, textAlign: "center" }}>
            <div style={{ fontSize: 9, color: S.dim, fontFamily: "'IBM Plex Mono'" }}>SE FICAR NO RANGE</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: S.red, fontFamily: "'Space Grotesk'", marginTop: 4 }}>
              -${downBet}
            </div>
            <div style={{ fontSize: 10, color: S.dim, fontFamily: "'IBM Plex Mono'", marginTop: 2 }}>
              custo semanal do seguro
            </div>
          </div>
        </div>

        {/* Insight */}
        <div style={{ fontSize: 11, fontFamily: "'Inter'", color: S.textDim, lineHeight: 1.5,
          padding: "8px 12px", background: S.red + "08", borderRadius: 6, borderLeft: `2px solid ${S.red}40` }}>
          {downOdd <= 2
            ? "🔥 Odd muito baixa — considere apostar mais para lucrar se tocar"
            : downOdd <= 5
            ? "✅ Zona ideal — cobre residual com custo mínimo"
            : "⚠ Odd moderada — verifique se o payoff ainda cobre o stop"}
        </div>
      </div>
    </CollapsibleCard>
  );
}

// ═══════════════════════════════════════════════════════════════
// EARLY ENTRY PANEL — Entrada na abertura com odd baixa
// ═══════════════════════════════════════════════════════════════
function EarlyEntryPanel({ ethPrice, betOdd, setBetOdd }) {
  const [openOdd, setOpenOdd]         = useState(betOdd * 100);
  const [betAmt, setBetAmt]           = useState(20);
  const [ethMoveWed, setEthMoveWed]   = useState(4);
  const [exitDay, setExitDay]         = useState(7);

  // Sync: when openOdd changes here, update parent betOdd
  const handleOpenOddChange = (val) => {
    setOpenOdd(val);
    setBetOdd(val / 100);
  };

  // Strike alvo = ETH atual + 10%
  const strikeTarget = ethPrice ? Math.round(ethPrice * 1.10 / 100) * 100 : 2200;
  const distToStrike = Math.max(0.5, (strikeTarget - ethPrice) / ethPrice * 100);
  const openOddDec   = openOdd / 100;
  const payoffMax    = betAmt / openOddDec;
  const multMax      = payoffMax / betAmt;

  // Odd no dia de saída — modelo simples baseado em movimento de preço e tempo
  const exitOddCalc = useMemo(() => {
    // Quanto % do caminho até o strike ETH percorreu?
    const distToStrike = Math.max(0.5, (strikeTarget - ethPrice) / ethPrice * 100);
    const pctCovered   = Math.min(0.98, ethMoveWed / distToStrike);
    // Odd de saída: sobe exponencialmente conforme se aproxima do strike
    // 0% coberto → odd = openOdd (sem movimento)
    // 50% coberto → odd ~5x maior
    // 95% coberto → odd ~40x maior (quase no strike)
    const priceBoost   = Math.pow(1 + pctCovered * 3, 2.5);
    // Time decay: menos dias restantes = ligeiramente menor
    // (mas price effect domina quando ETH se move)
    const timeDecay    = Math.max(0.3, (7 - exitDay) / 7);
    const rawOdd       = Math.min(0.92, openOddDec * priceBoost * timeDecay);
    return Math.max(openOddDec * 0.05, rawOdd); // mínimo: 5% da odd original
  }, [openOdd, ethMoveWed, exitDay, strikeTarget, ethPrice]);

  // Valor de revenda: aposta comprada a openOdd%, agora sendo negociada a exitOddCalc%
  // No Polymarket, se você comprou "sim" a 1%, e agora está 10%, cada token que
  // você pagou $0.01 agora vale $0.10 → multiplicou 10x
  const resaleMultiplier = exitOddCalc / openOddDec;          // ex: 10%/1% = 10x
  const resaleValue      = betAmt * resaleMultiplier;          // $20 × 10 = $200
  const profitExit       = resaleValue - betAmt;
  const multExit         = resaleMultiplier;
  const roi              = (profitExit / betAmt * 100);

  const DAY_NAMES = ["", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  // Simulação: 10 semanas apostando $betAmt na abertura com odd de abertura avg
  const weeklyCost   = betAmt;
  const hitRate      = 0.15; // histórico: ~15% das semanas ETH sobe 10%+
  const avgPayoffHit = betAmt * 8 * 0.7; // odd sobe ~8x em semana de alta (ex: 3%→24%) → revende por 70% do ganho
  const expectedWeekly = avgPayoffHit * hitRate - weeklyCost * (1 - hitRate);
  const annualNet    = expectedWeekly * 52;

  return (
    <CollapsibleCard title="⚡ ENTRADA NA ABERTURA — ESTRATÉGIA DE ODD BAIXA"
      titleColor={S.gold} borderColor={S.gold + "60"} defaultOpen={true}
      subtitle="Domingo 21h Brasília · Strike +10% · Máxima assimetria">
      <div className="grid-2" style={{ gap: 16 }}>

        {/* Inputs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span className="label">ODD DE ABERTURA</span>
              <span style={{ color: S.green, fontSize: 14, fontFamily: "'IBM Plex Mono'", fontWeight: 700 }}>
                {openOdd}% → paga {multMax.toFixed(0)}x
              </span>
            </div>
            <input type="range" min={1} max={15} step={0.5}
              value={openOdd} onChange={e => handleOpenOddChange(+e.target.value)} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: S.dim, fontFamily: "'IBM Plex Mono'", marginTop: 2 }}>
              <span>1% (100x)</span><span>5% (20x)</span><span>10% (10x)</span><span>15% (7x)</span>
            </div>
            <div style={{ fontSize: 11, marginTop: 4, fontFamily: "'Inter'",
              color: openOdd <= 3 ? S.green : openOdd <= 7 ? S.gold : S.textDim }}>
              {openOdd <= 2 ? "🔥 Assimetria extrema — raro mas acontece" :
               openOdd <= 5 ? "✅ Zona ideal — melhor relação risco/retorno" :
               openOdd <= 10 ? "⚠ Razoável — ETH já tem algum momentum" :
               "⛔ Odds altas — não é entrada de abertura"}
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span className="label">VALOR APOSTADO</span>
              <span style={{ color: S.gold, fontSize: 13, fontFamily: "'IBM Plex Mono'" }}>${betAmt}</span>
            </div>
            <input type="range" min={5} max={100} step={5}
              value={betAmt} onChange={e => setBetAmt(+e.target.value)} />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span className="label">ETH SOBE ATÉ O DIA DE SAÍDA</span>
              <span style={{ color: S.gold, fontSize: 13, fontFamily: "'IBM Plex Mono'" }}>+{ethMoveWed}%</span>
            </div>
            <input type="range" min={0} max={15} step={0.5}
              value={ethMoveWed} onChange={e => setEthMoveWed(+e.target.value)} />
            <div style={{ fontSize: 10, color: S.dim, fontFamily: "'IBM Plex Mono'", marginTop: 2 }}>
              Strike: ${strikeTarget.toLocaleString()} · ETH atual: ${ethPrice?.toLocaleString() || "—"} · falta {((strikeTarget/ethPrice-1)*100).toFixed(1)}%
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span className="label">DIA DE SAÍDA (VENDE A APOSTA)</span>
              <span style={{ color: S.gold, fontSize: 13, fontFamily: "'IBM Plex Mono'" }}>{DAY_NAMES[exitDay]}</span>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[2,3,4,5,6].map(d => (
                <span key={d} className="pill"
                  style={{ background: exitDay===d ? S.gold : S.border,
                    color: exitDay===d ? "#000" : S.textDim, fontSize: 11 }}
                  onClick={() => setExitDay(d)}>
                  {DAY_NAMES[d]}
                </span>
              ))}
              <span className="pill"
                style={{ background: exitDay===7 ? S.green : S.border,
                  color: exitDay===7 ? "#000" : S.textDim, fontSize: 11,
                  border: exitDay===7 ? "none" : `1px solid ${S.green}40` }}
                onClick={() => setExitDay(7)}>
                🏁 Vencimento
              </span>
            </div>
          </div>
        </div>

        {/* Results */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Main payoff card */}
          <div style={{ padding: 16, background: "#090914", borderRadius: 10,
            border: `1px solid ${profitExit > 0 ? S.green : S.border}` }}>
            <div style={{ fontSize: 10, color: S.dim, fontFamily: "'IBM Plex Mono'", marginBottom: 8 }}>
              {exitDay === 7 ? 'RESULTADO NO VENCIMENTO (DOM)' : `RESULTADO ESPERADO — SAÍDA ${DAY_NAMES[exitDay].toUpperCase()}`}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: S.dim, fontFamily: "'IBM Plex Mono'" }}>APOSTA</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: S.red, fontFamily: "'Space Grotesk'" }}>-${betAmt}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: S.dim, fontFamily: "'IBM Plex Mono'" }}>
                  {exitDay === 7 ? (ethMoveWed >= distToStrike ? "PAYOFF MÁXIMO" : "EXPIRA SEM VALOR") : "VENDE POR"}
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Space Grotesk'",
                  color: exitDay === 7 ? (ethMoveWed >= distToStrike ? S.green : S.red) : S.green }}>
                  {exitDay === 7
                    ? (ethMoveWed >= distToStrike ? `+$${payoffMax.toFixed(0)}` : "$0")
                    : `+$${resaleValue.toFixed(0)}`}
                </div>
              </div>
            </div>
            {(() => {
              const touched    = ethMoveWed >= distToStrike;
              const netVenc    = touched ? payoffMax - betAmt : -betAmt;
              const displayNet = exitDay === 7 ? netVenc : profitExit;
              const displayMul = exitDay === 7 ? (touched ? multMax : 0) : multExit;
              return (
                <div style={{ textAlign: "center", padding: "10px", borderRadius: 8,
                  background: displayNet > 0 ? S.green + "15" : S.red + "15",
                  border: `1px solid ${displayNet > 0 ? S.green : S.red}30` }}>
                  <div style={{ fontSize: 10, color: S.dim, fontFamily: "'IBM Plex Mono'" }}>LUCRO LÍQUIDO</div>
                  <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Space Grotesk'",
                    color: displayNet > 0 ? S.green : S.red }}>
                    {displayNet >= 0 ? "+" : ""}${displayNet.toFixed(0)}
                  </div>
                  <div style={{ fontSize: 12, color: S.gold, fontFamily: "'IBM Plex Mono'", marginTop: 2 }}>
                    {displayMul.toFixed(1)}x · ROI {(displayNet / betAmt * 100).toFixed(0)}%
                  </div>
                  {exitDay === 7 && <div style={{ fontSize: 10, color: S.dim, fontFamily: "'Inter'", marginTop: 4 }}>
                    {touched ? "✅ ETH tocou o strike — aposta venceu" : "❌ ETH não tocou o strike — aposta expira"}
                  </div>}
                </div>
              );
            })()}
          </div>

          {/* Stats row */}
          <div className="grid-2-mobile" style={{ display: "grid", gap: 8 }}>
            <div style={{ padding: "10px 8px", background: "#090914", borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 9, color: S.dim, fontFamily: "'IBM Plex Mono'" }}>SE VENCER (100%)</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: S.green, fontFamily: "'Space Grotesk'" }}>
                +${(payoffMax - betAmt).toFixed(0)}
              </div>
              <div style={{ fontSize: 10, color: S.textDim, fontFamily: "'IBM Plex Mono'" }}>{multMax.toFixed(0)}x</div>
            </div>
            <div style={{ padding: "10px 8px", background: "#090914", borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 9, color: S.dim, fontFamily: "'IBM Plex Mono'" }}>ODD NA SAÍDA EST.</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: S.gold, fontFamily: "'Space Grotesk'" }}>
                {(exitOddCalc * 100).toFixed(1)}%
              </div>
              <div style={{ fontSize: 10, color: S.textDim, fontFamily: "'IBM Plex Mono'" }}>
                vs {openOdd}% abertura
              </div>
            </div>
          </div>

          {/* Expected value over 10 weeks */}
          <div style={{ padding: "12px 14px", background: S.gold + "10", borderRadius: 8,
            border: `1px solid ${S.gold}30` }}>
            <div style={{ fontSize: 10, color: S.gold, fontFamily: "'IBM Plex Mono'", marginBottom: 6 }}>
              VALOR ESPERADO — 10 SEMANAS (histórico ~15% hit rate)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 9, color: S.dim, fontFamily: "'IBM Plex Mono'" }}>CUSTO</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: S.red, fontFamily: "'Space Grotesk'" }}>-${(weeklyCost * 10).toFixed(0)}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 9, color: S.dim, fontFamily: "'IBM Plex Mono'" }}>GANHO ESPERADO</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: S.green, fontFamily: "'Space Grotesk'" }}>+${(avgPayoffHit * hitRate * 10).toFixed(0)}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 9, color: S.dim, fontFamily: "'IBM Plex Mono'" }}>LÍQUIDO</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: annualNet/52*10 >= 0 ? S.green : S.red, fontFamily: "'Space Grotesk'" }}>
                  {annualNet/52*10 >= 0 ? "+" : ""}${(annualNet/52*10).toFixed(0)}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: S.textDim, fontFamily: "'Inter'", marginTop: 8 }}>
              💡 Com odd de abertura baixa e saída antecipada, 1 acerto em 10 semanas cobre as outras 9.
            </div>
          </div>
        </div>
      </div>
    </CollapsibleCard>
  );
}

// ═══════════════════════════════════════════════════════════════
// WEEKLY COUNTDOWN COMPONENT
// ═══════════════════════════════════════════════════════════════
function WeeklyCountdown() {
  const [timeLeft, setTimeLeft] = useState(null);
  const [phase, setPhase]       = useState(""); // "open_soon" | "open_now" | "midweek" | "closing"

  useEffect(() => {
    function calc() {
      // Market opens Monday 00:00 UTC = Sunday 21:00 Brasília (UTC-3)
      // Market closes Sunday 04:00 UTC = Saturday 01:00 Brasília
      const now = new Date();
      const nowUTC = new Date(now.toISOString());
      const day = nowUTC.getUTCDay(); // 0=Sun 1=Mon ... 6=Sat
      const h   = nowUTC.getUTCHours();
      const m   = nowUTC.getUTCMinutes();
      const s   = nowUTC.getUTCSeconds();
      const totalSecsToday = h * 3600 + m * 60 + s;

      // Next Monday 00:00 UTC
      let daysToMon = (8 - day) % 7;
      if (daysToMon === 0 && totalSecsToday > 3600) daysToMon = 7; // already past open
      if (day === 1 && totalSecsToday < 21600) daysToMon = 0; // still Monday early

      const secsTilOpen = daysToMon * 86400 - totalSecsToday;

      // Phases
      if (day === 1 && h < 3) {
        setPhase("open_now");
      } else if (secsTilOpen <= 7200 && secsTilOpen > 0) {
        setPhase("open_soon");
      } else if (day >= 1 && day <= 3) {
        setPhase("midweek");
      } else if (day >= 5 || (day === 0 && h >= 0)) {
        setPhase("closing");
      } else {
        setPhase("waiting");
      }

      const secs = Math.abs(secsTilOpen);
      const dd   = Math.floor(secs / 86400);
      const hh   = Math.floor((secs % 86400) / 3600);
      const mm   = Math.floor((secs % 3600) / 60);
      const ss   = secs % 60;
      setTimeLeft({ dd, hh, mm, ss, secsTilOpen });
    }
    calc();
    const iv = setInterval(calc, 1000);
    return () => clearInterval(iv);
  }, []);

  if (!timeLeft) return null;

  const phaseConfig = {
    open_now:  { color: S.green,  icon: "🟢", label: "MERCADO ABERTO AGORA",        sub: "Odd de abertura — melhor momento para entrar!" },
    open_soon: { color: S.green,  icon: "⚡", label: "ABRE EM BREVE",               sub: "Prepare-se — odds baixíssimas em minutos" },
    midweek:   { color: S.gold,   icon: "📊", label: "SEMANA EM CURSO",             sub: "Mercado aberto — odds já precificam movimento da semana" },
    closing:   { color: S.red,    icon: "⏳", label: "PRÓXIMA ABERTURA",            sub: "Aguarde a segunda para pegar odds de abertura" },
    waiting:   { color: S.textDim,icon: "🕐", label: "PRÓXIMA ABERTURA",            sub: "Segunda-feira 00:00 UTC · 21h domingo (Brasília)" },
  };
  const cfg = phaseConfig[phase] || phaseConfig.waiting;

  return (
    <div className="card" style={{ borderColor: cfg.color + "60", marginBottom: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="label" style={{ color: cfg.color }}>
            {cfg.icon} {cfg.label}
          </div>
          <div style={{ fontSize: 12, color: S.textDim, fontFamily: "'Inter'", marginTop: 3 }}>
            {cfg.sub}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          {phase === "open_now" ? (
            <div style={{ fontSize: 22, fontWeight: 800, color: S.green, fontFamily: "'Space Grotesk'" }}>
              AGORA ✓
            </div>
          ) : (
            <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
              {timeLeft.dd > 0 && (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: cfg.color, fontFamily: "'Space Grotesk'", lineHeight: 1 }}>{timeLeft.dd}</div>
                  <div style={{ fontSize: 9, color: S.dim, fontFamily: "'IBM Plex Mono'" }}>dias</div>
                </div>
              )}
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: cfg.color, fontFamily: "'Space Grotesk'", lineHeight: 1 }}>{String(timeLeft.hh).padStart(2,"0")}</div>
                <div style={{ fontSize: 9, color: S.dim, fontFamily: "'IBM Plex Mono'" }}>horas</div>
              </div>
              <div style={{ fontSize: 18, color: cfg.color, fontWeight: 800, lineHeight: 1.2 }}>:</div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: cfg.color, fontFamily: "'Space Grotesk'", lineHeight: 1 }}>{String(timeLeft.mm).padStart(2,"0")}</div>
                <div style={{ fontSize: 9, color: S.dim, fontFamily: "'IBM Plex Mono'" }}>min</div>
              </div>
              <div style={{ fontSize: 18, color: cfg.color, fontWeight: 800, lineHeight: 1.2 }}>:</div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: cfg.color, fontFamily: "'Space Grotesk'", lineHeight: 1 }}>{String(timeLeft.ss).padStart(2,"0")}</div>
                <div style={{ fontSize: 9, color: S.dim, fontFamily: "'IBM Plex Mono'" }}>seg</div>
              </div>
            </div>
          )}
          <div style={{ fontSize: 10, color: S.dim, fontFamily: "'IBM Plex Mono'", marginTop: 4, textAlign: "right" }}>
            Segunda 00:00 UTC · Dom 21h Brasília
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ALERT SETUP COMPONENT
// ═══════════════════════════════════════════════════════════════
function AlertSetup({ ethPrice, plo, phi, capital, onSetAlert, requestAlertPermission, alertSet, setAlertSet }) {
  const [notifSupported] = useState("Notification" in window);
  const [notifPerm, setNotifPerm] = useState(typeof Notification !== "undefined" ? Notification.permission : "denied");

  const activate = async () => {
    if (notifPerm !== "granted") {
      const perm = await Notification.requestPermission();
      setNotifPerm(perm);
      if (perm !== "granted") return;
    }
    onSetAlert({ plo, phi, capital });
    setAlertSet(true);
  };

  const deactivate = () => {
    onSetAlert(null);
    setAlertSet(false);
  };

  return (
    <div className="card" style={{ borderColor: alertSet ? S.green + "60" : S.border, marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="label" style={{ color: alertSet ? S.green : S.textDim }}>
            {alertSet ? "🔔 ALERTAS ATIVOS" : "🔔 ALERTAS DE RANGE"}
          </div>
          {alertSet ? (
            <div style={{ fontSize: 12, color: S.text, fontFamily: "'Inter'", marginTop: 4 }}>
              Monitorando ETH $${ethPrice} · Aviso quando chegar a 5% dos limites
              <span style={{ color: S.red, marginLeft: 8 }}>↓${plo.toFixed(0)}</span>
              <span style={{ color: S.dim, marginLeft: 4 }}>—</span>
              <span style={{ color: S.green, marginLeft: 4 }}>↑${phi.toFixed(0)}</span>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: S.textDim, fontFamily: "'Inter'", marginTop: 4 }}>
              Receba notificações quando ETH se aproximar dos limites da pool
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {alertSet ? (
            <button onClick={deactivate}
              style={{ background: S.red + "20", border: `1px solid ${S.red}40`, color: S.red,
                padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontFamily: "'Inter'", fontSize: 12 }}>
              Desativar
            </button>
          ) : (
            <button onClick={activate} disabled={!notifSupported}
              style={{ background: S.green + "20", border: `1px solid ${S.green}40`, color: S.green,
                padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontFamily: "'Inter'", fontSize: 12,
                opacity: notifSupported ? 1 : 0.4 }}>
              {!notifSupported ? "Não suportado" : notifPerm === "denied" ? "Permitir notificações" : "Ativar alertas"}
            </button>
          )}
        </div>
      </div>
      {alertSet && (
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[
            { label: "LIMITE INFERIOR", value: `$${plo.toFixed(0)}`, color: S.red },
            { label: "PREÇO ATUAL", value: `$${ethPrice}`, color: S.gold },
            { label: "LIMITE SUPERIOR", value: `$${phi.toFixed(0)}`, color: S.green },
          ].map(item => (
            <div key={item.label} style={{ textAlign: "center", padding: "8px", background: "#090914", borderRadius: 6 }}>
              <div className="label">{item.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: item.color, fontFamily: "'Space Grotesk'" }}>{item.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// POLYMARKET LIVE PANEL
// ═══════════════════════════════════════════════════════════════
function PolymarketLive({ ethPrice, rangePct, onSelectOdd, onSelectDownOdd }) {
  const [markets, setMarkets]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [expanded, setExpanded]   = useState(false);

  const upperLimit = ethPrice * (1 + rangePct / 100);
  const lowerLimit = ethPrice * (1 - rangePct / 100);

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

  // Identify weekly market (shortest question / contains week range like "March 2-8")
  const weeklyMarket = markets.find(m => /\d+-\d+/.test(m.question)) || markets[0];
  const otherMarkets = markets.filter(m => m !== weeklyMarket);

  // Best upside/downside from weekly market — no strike filter, show all
  const weeklyOutcomes = weeklyMarket?.outcomes || [];
  const bestUp = weeklyOutcomes
    .filter(o => o.strike >= upperLimit * 0.95)
    .sort((a, b) => Math.abs(a.strike - upperLimit) - Math.abs(b.strike - upperLimit))[0];
  const bestDown = weeklyOutcomes
    .filter(o => o.strike <= lowerLimit * 1.05)
    .sort((a, b) => Math.abs(a.strike - lowerLimit) - Math.abs(b.strike - lowerLimit))[0];

  const renderMarket = (market, hideTitle = false) => {
    return (
      <div key={market.id} style={{ marginBottom: 16 }}>
        {!hideTitle && <div style={{ fontSize: 11, color: S.textDim, marginBottom: 8, fontFamily: "'IBM Plex Mono'",
          borderBottom: "1px solid " + S.border, paddingBottom: 6 }}>
          {market.question}
          <span style={{ color: S.dim, marginLeft: 8, fontSize: 10 }}>
            Vol: ${parseFloat(market.volume || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
          </span>
        </div>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {(market.outcomes || []).map((o, i) => {
            const isUp   = bestUp   && o.strike === bestUp.strike   && market === weeklyMarket;
            const isDown = bestDown && o.strike === bestDown.strike && market === weeklyMarket;
            return (
              <div key={i}
                onClick={() => { if (onSelectOdd) onSelectOdd(parseFloat(o.odd)); }}
                style={{ padding: "8px 12px", borderRadius: 8, minWidth: 90, textAlign: "center",
                  background: isUp ? S.green + "20" : isDown ? S.red + "15" : "#090914",
                  border: "1px solid " + (isUp ? S.green : isDown ? S.red + "60" : S.border),
                  cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = S.gold}
                onMouseLeave={e => e.currentTarget.style.borderColor = isUp ? S.green : isDown ? S.red + "60" : S.border}>
                <div style={{ fontSize: 10, color: isUp ? S.green : isDown ? S.red : S.dim,
                  fontFamily: "'IBM Plex Mono'", marginBottom: 3 }}>
                  {isUp ? "★ " : isDown ? "▼ " : ""}${o.strike.toLocaleString()}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700,
                  color: isUp ? S.green : isDown ? S.red : S.text, fontFamily: "'Space Grotesk'" }}>
                  {o.oddPct}%
                </div>
                <div style={{ fontSize: 10, color: S.textDim, fontFamily: "'IBM Plex Mono'", marginTop: 2 }}>
                  paga ${o.payoffPer100}/$100
                </div>
                <div style={{ fontSize: 9, color: S.gold, fontFamily: "'IBM Plex Mono'", marginTop: 3 }}>
                  ↑ usar
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="card" style={{ borderColor: S.green + "40" }}>
      {/* ── Header ── */}
      <div onClick={() => setExpanded(e => !e)}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
          cursor: "pointer", marginBottom: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "1px",
            fontFamily: "'IBM Plex Mono',monospace", color: S.green }}>
            POLYMARKET — ODDS AO VIVO
          </span>
          {weeklyMarket && (
            <span style={{ fontSize: 10, color: S.dim, fontFamily: "'IBM Plex Mono'" }}>
              {weeklyMarket.question}
              <span style={{ marginLeft: 6 }}>
                Vol: ${parseFloat(weeklyMarket.volume || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
              </span>
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {lastUpdate && <span style={{ fontSize: 9, color: S.dim, fontFamily: "'IBM Plex Mono'" }}>{lastUpdate}</span>}
          <button onClick={e => { e.stopPropagation(); fetchMarkets(); }} disabled={loading}
            style={{ background: S.border, border: "none", color: S.text, padding: "4px 10px",
              borderRadius: 6, cursor: "pointer", fontFamily: "'IBM Plex Mono'", fontSize: 10 }}>
            {loading ? "..." : "↻"}
          </button>
          <span style={{ color: S.dim, fontSize: 12, fontFamily: "'IBM Plex Mono'" }}>
            {expanded ? "▲" : "▼"}
          </span>
        </div>
      </div>

      {/* ── Errors / loading ── */}
      {error && (
        <div style={{ padding: "10px 14px", background: S.red + "15", borderRadius: 6,
          color: S.red, fontSize: 12, fontFamily: "'IBM Plex Mono'", marginBottom: 10 }}>
          {error}
        </div>
      )}
      {loading && !markets.length && (
        <div style={{ textAlign: "center", padding: 24, color: S.dim, fontSize: 12, fontFamily: "'IBM Plex Mono'" }}>
          buscando mercados...
        </div>
      )}

      {/* ── Weekly market — ALWAYS visible ── */}
      {weeklyMarket && renderMarket(weeklyMarket, true)}

      {/* ── Other markets — only when expanded ── */}
      {expanded && otherMarkets.map(m => renderMarket(m))}

      {/* ── Insight ── */}
      {bestUp && (
        <div className="insight" style={{ borderColor: S.green, marginTop: 8 }}>
          <strong style={{ color: S.green }}>↑ Topo (${upperLimit.toFixed(0)}):</strong>{" "}
          <strong style={{ color: S.gold }}>${bestUp.strike.toLocaleString()}</strong> — {bestUp.oddPct}% — $20 recebe{" "}
          <strong style={{ color: S.green }}>${(20 / parseFloat(bestUp.odd)).toFixed(0)}</strong>
          {bestDown && <>{" · "}
            <strong style={{ color: S.red }}>↓ Fundo (${lowerLimit.toFixed(0)}):</strong>{" "}
            <strong style={{ color: S.textDim }}>${bestDown.strike.toLocaleString()}</strong> — {bestDown.oddPct}% — $20 recebe{" "}
            <strong style={{ color: S.textDim }}>${(20 / parseFloat(bestDown.odd)).toFixed(0)}</strong>
          </>}
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
  const tabs = ["Polymarket Hedge", "Cenários", "Manutenção do Hedge"];

  // ── Live ETH price ──
  const [liveEth, setLiveEth] = useState(null);
  const [ethChange24h, setEthChange24h] = useState(null);
  const [ethLoading, setEthLoading] = useState(false);

  // ── Alert state: {active, plo, phi, capital} ──
  const [alert, setAlert] = useState(null);

  const fetchEthPrice = async () => {
    setEthLoading(true);
    try {
      const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd&include_24hr_change=true");
      const d = await r.json();
      setLiveEth(d.ethereum.usd);
      setEthChange24h(d.ethereum.usd_24h_change);
    } catch {}
    setEthLoading(false);
  };

  useEffect(() => {
    fetchEthPrice();
    const iv = setInterval(fetchEthPrice, 30000);
    return () => clearInterval(iv);
  }, []);

  // ── Range alert checker ──
  useEffect(() => {
    if (!alert || !liveEth) return;
    const { plo, phi } = alert;
    const distLo = ((liveEth - plo) / plo * 100).toFixed(1);
    const distHi = ((phi - liveEth) / phi * 100).toFixed(1);
    const warningThreshold = 3; // within 3% of limit
    if (liveEth <= plo * 1.03 || liveEth >= phi * 0.97) {
      const side = liveEth <= plo * 1.03 ? "INFERIOR" : "SUPERIOR";
      const dist = liveEth <= plo * 1.03 ? distLo : distHi;
      if (Notification.permission === "granted") {
        new Notification(`⚠ ETH próximo do limite ${side}`, {
          body: `ETH $${liveEth.toFixed(0)} — a ${dist}% do limite. Monitore sua pool.`,
          icon: "/favicon.ico"
        });
      }
    }
  }, [liveEth, alert]);

  const requestAlertPermission = () => Notification.requestPermission();

  return (
    <div style={{ background: S.bg, minHeight: "100vh", color: S.text, fontFamily: "'Inter', sans-serif" }}>
      <style>{css}</style>

      {/* Header */}
      <div style={{ padding: "32px 28px 0", maxWidth: 960, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 10, color: S.gold, letterSpacing: 4, marginBottom: 8, fontFamily: "'IBM Plex Mono'" }}>
                LP HEDGE STRATEGY · ETH/USDC
              </div>
              <div style={{ fontSize: 32, fontFamily: "'Space Grotesk'", fontWeight: 800, letterSpacing: -1, lineHeight: 1.1 }}>
                Simulador Completo
              </div>
              <div style={{ fontSize: 13, color: S.textDim, marginTop: 6, fontFamily: "'Inter', sans-serif" }}>
                Pool concentrada · Short hedge · Put seguro · Polymarket timing
              </div>
            </div>

            {/* Live ETH price widget */}
            <div style={{ textAlign: "right", minWidth: 140 }}>
              <div style={{ fontSize: 10, color: S.dim, fontFamily: "'IBM Plex Mono'", letterSpacing: 1, marginBottom: 4 }}>
                ETH/USD AO VIVO
              </div>
              {liveEth ? (
                <>
                  <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Space Grotesk'", color: S.gold, lineHeight: 1 }}>
                    ${liveEth.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                  <div style={{ fontSize: 12, fontFamily: "'IBM Plex Mono'", marginTop: 4,
                    color: ethChange24h >= 0 ? S.green : S.red }}>
                    {ethChange24h >= 0 ? "▲" : "▼"} {Math.abs(ethChange24h).toFixed(2)}% 24h
                  </div>
                  <div style={{ fontSize: 9, color: S.dim, fontFamily: "'IBM Plex Mono'", marginTop: 2 }}>
                    atualiza a cada 30s
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: S.dim, fontFamily: "'IBM Plex Mono'" }}>
                  {ethLoading ? "carregando..." : "—"}
                </div>
              )}
            </div>
          </div>

          {/* Alert bar */}
          {alert && liveEth && (() => {
            const { plo, phi } = alert;
            const distLo = ((liveEth - plo) / plo * 100);
            const distHi = ((phi - liveEth) / phi * 100);
            const nearLo = distLo <= 5;
            const nearHi = distHi <= 5;
            const danger = distLo <= 2 || distHi <= 2;
            if (!nearLo && !nearHi) return null;
            return (
              <div style={{ marginTop: 12, padding: "10px 16px", borderRadius: 8,
                background: danger ? S.red + "20" : S.gold + "15",
                border: `1px solid ${danger ? S.red : S.gold}`,
                display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 16 }}>{danger ? "🚨" : "⚠️"}</span>
                <span style={{ fontSize: 13, fontFamily: "'Inter'", color: danger ? S.red : S.gold }}>
                  {nearLo && `ETH a ${distLo.toFixed(1)}% do limite inferior ($${plo.toFixed(0)})`}
                  {nearHi && `ETH a ${distHi.toFixed(1)}% do limite superior ($${phi.toFixed(0)})`}
                  {danger ? " — ATENÇÃO IMEDIATA" : " — monitore de perto"}
                </span>
              </div>
            );
          })()}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 24, overflowX: "auto", paddingBottom: 4 }}>
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
      <div style={{ padding: "0 clamp(8px, 3vw, 28px) 40px", maxWidth: 960, margin: "0 auto" }}>
        {tab === 0 && <TabPolymarket liveEth={liveEth} onSetAlert={setAlert} requestAlertPermission={requestAlertPermission} />}
        {tab === 1 && <TabScenarios />}
        {tab === 2 && <TabMaintenance />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 3 — MANUTENÇÃO DO HEDGE
// ═══════════════════════════════════════════════════════════════
function TabMaintenance() {
  const [capital,  setCapital]  = useState(4000);
  const [apr,      setApr]      = useState(100);
  const [stopPct,  setStopPct]  = useState(2);
  const [weeks,    setWeeks]    = useState(8);
  const [baseOdd,  setBaseOdd]  = useState(3);   // odd padrão %

  // Per-week overrides: { oddOverride, extraBet }
  const [weekData, setWeekData] = useState(
    Array.from({ length: 12 }, () => ({ oddOverride: null, extraBet: 0 }))
  );

  const feesDay  = capital * (apr / 100) / 365;
  const feesWeek = feesDay * 7;
  const stop     = capital * stopPct / 100;

  const updateWeek = (i, key, val) => {
    setWeekData(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [key]: val };
      return next;
    });
  };

  // Compute cumulative state per week
  const rows = useMemo(() => {
    let feesAcc = 0;
    return Array.from({ length: weeks }, (_, i) => {
      const residual    = Math.max(0, stop - feesAcc);          // stop ainda não coberto
      const wd          = weekData[i] || { oddOverride: null, extraBet: 0 };
      const odd         = (wd.oddOverride ?? baseOdd) / 100;
      const coverBet    = residual > 0 ? residual * odd : 0;    // aposta mínima para cobrir residual
      const extraBet    = wd.extraBet || 0;
      const totalBet    = coverBet + extraBet;
      const payoffCover = coverBet / odd;
      const payoffExtra = extraBet / odd;
      const payoffTotal = totalBet / odd;

      feesAcc += feesWeek;

      const netIfRange  = feesWeek - totalBet;                  // fees da semana menos aposta
      const netIfTop    = feesWeek - stop + payoffTotal;        // sai pelo topo: fees - stop + payoff
      const netIfBot    = feesWeek - stop - totalBet;           // sai pelo fundo: fees - stop - aposta

      return {
        week: i + 1,
        feesAcc,
        residual,
        odd,
        coverBet,
        extraBet,
        totalBet,
        payoffTotal,
        netIfRange,
        netIfTop,
        netIfBot,
        isFullyCovered: residual <= 0,
        isOpportunistic: odd <= 0.05 && extraBet > 0,
      };
    });
  }, [capital, apr, stopPct, weeks, baseOdd, weekData, feesWeek, stop]);

  const totalBetCost   = rows.reduce((s, r) => s + r.totalBet, 0);
  const totalFees      = rows[rows.length - 1]?.feesAcc || 0;
  const breakEvenWeek  = rows.findIndex(r => r.feesAcc >= stop) + 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Global params */}
      <div className="card">
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "1px", fontFamily: "'IBM Plex Mono',monospace", color: "inherit", marginBottom: 14 }}>PARÂMETROS DA POSIÇÃO</div>
        <div className="grid-5">
          <Field label="CAPITAL"   value={capital}  onChange={setCapital}  prefix="$" min={500}  max={50000} step={100} />
          <Field label="APR"       value={apr}      onChange={setApr}      suffix="%" min={10}   max={500}   step={5} />
          <Field label="STOP %"    value={stopPct}  onChange={setStopPct}  suffix="%" min={0.5}  max={15}    step={0.1} />
          <Field label="SEMANAS"   value={weeks}    onChange={w => { setWeeks(w); setWeekData(Array.from({ length: 12 }, () => ({ oddOverride: null, extraBet: 0 }))); }} min={2} max={12} step={1} />
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span className="label">ODD BASE</span>
              <span style={{ color: S.gold, fontFamily: "'IBM Plex Mono'", fontSize: 12 }}>{baseOdd}%</span>
            </div>
            <input type="range" min={1} max={15} step={0.5} value={baseOdd} onChange={e => setBaseOdd(+e.target.value)} />
          </div>
        </div>

        {/* Summary stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 16 }}>
          {[
            { label: "FEES TOTAIS",       value: `+$${totalFees.toFixed(0)}`,      color: S.green },
            { label: "CUSTO APOSTAS",     value: `-$${totalBetCost.toFixed(0)}`,   color: S.red },
            { label: "BREAK-EVEN",        value: `semana ${breakEvenWeek || "—"}`, color: S.gold },
            { label: "STOP",              value: `$${stop.toFixed(0)}`,            color: S.textDim },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center", padding: "10px", background: "#090914", borderRadius: 8 }}>
              <div style={{ fontSize: 9, color: S.dim, fontFamily: "'IBM Plex Mono'" }}>{s.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.color, fontFamily: "'Space Grotesk'", marginTop: 4 }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Visual timeline */}
      <div className="card">
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "1px", fontFamily: "'IBM Plex Mono',monospace", color: "inherit", marginBottom: 14 }}>EVOLUÇÃO DO HEDGE — SEMANA A SEMANA</div>
        <div style={{ position: "relative", height: 120, marginBottom: 8 }}>
          {rows.map((r, i) => {
            const w    = 100 / rows.length;
            const feeH = Math.min(100, (r.feesAcc / (stop * 1.5)) * 100);
            const stopH = Math.max(0, 100 - feeH);
            return (
              <div key={i} style={{ position: "absolute", left: `${i * w}%`, width: `${w - 0.5}%`,
                height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                {/* Fee bar */}
                <div style={{ width: "100%", height: `${feeH}%`, background: S.green + "60",
                  borderRadius: "3px 3px 0 0", position: "relative" }}>
                  {r.totalBet > 0 && (
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0,
                      height: `${Math.min(100, r.totalBet / feesWeek * 100)}%`,
                      background: r.isOpportunistic ? S.gold + "90" : S.red + "70",
                      borderRadius: "0 0 3px 3px" }} />
                  )}
                </div>
                <div style={{ fontSize: 8, color: S.dim, fontFamily: "'IBM Plex Mono'",
                  textAlign: "center", marginTop: 3 }}>S{r.week}</div>
              </div>
            );
          })}
          {/* Stop line */}
          {(() => {
            const stopY = 100 - Math.min(100, (stop / (stop * 1.5)) * 100);
            return (
              <div style={{ position: "absolute", top: `${stopY}%`, left: 0, right: 0,
                borderTop: `1px dashed ${S.red}80`, pointerEvents: "none" }}>
                <span style={{ fontSize: 8, color: S.red, fontFamily: "'IBM Plex Mono'",
                  background: "#0e0e1a", padding: "0 4px" }}>stop ${stop.toFixed(0)}</span>
              </div>
            );
          })()}
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 10, color: S.dim, fontFamily: "'IBM Plex Mono'" }}>
          <span><span style={{ color: S.green }}>█</span> fees acumuladas</span>
          <span><span style={{ color: S.red }}>█</span> cobertura residual</span>
          <span><span style={{ color: S.gold }}>█</span> aposta oportunista</span>
        </div>
      </div>

      {/* Week-by-week table */}
      <div className="card">
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "1px", fontFamily: "'IBM Plex Mono',monospace", color: "inherit", marginBottom: 14 }}>CONFIGURAÇÃO POR SEMANA</div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>SEM</th>
                <th>FEES ACC</th>
                <th>RESIDUAL</th>
                <th>ODD</th>
                <th>COB. MIN</th>
                <th>EXTRA 🎯</th>
                <th>TOTAL BET</th>
                <th>PAYOFF</th>
                <th>SE RANGE</th>
                <th>SE TOPO ↑</th>
                <th>SE FUNDO ↓</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ opacity: r.isFullyCovered && r.extraBet === 0 ? 0.5 : 1 }}>
                  <td>
                    <span style={{ color: r.isFullyCovered ? S.green : S.gold,
                      fontWeight: 600, fontFamily: "'IBM Plex Mono'" }}>
                      {r.isFullyCovered ? "✓" : r.week}
                    </span>
                    {!r.isFullyCovered && <span style={{ color: S.dim }}> S{r.week}</span>}
                  </td>
                  <td style={{ color: S.green }}>+${r.feesAcc.toFixed(0)}</td>
                  <td style={{ color: r.residual <= 0 ? S.green : S.red }}>
                    {r.residual <= 0 ? "coberto ✓" : `$${r.residual.toFixed(0)}`}
                  </td>
                  {/* Odd override input */}
                  <td>
                    <input type="number" value={weekData[i]?.oddOverride ?? baseOdd}
                      min={1} max={50} step={0.5}
                      onChange={e => updateWeek(i, "oddOverride", +e.target.value)}
                      style={{ width: 52, fontSize: 11, padding: "3px 6px",
                        background: weekData[i]?.oddOverride ? S.gold + "20" : "#090914",
                        border: `1px solid ${weekData[i]?.oddOverride ? S.gold : S.border}`,
                        color: S.text, borderRadius: 4, fontFamily: "'IBM Plex Mono'" }} />
                    <span style={{ color: S.dim, fontSize: 10, marginLeft: 2 }}>%</span>
                  </td>
                  <td style={{ color: S.textDim }}>${r.coverBet.toFixed(2)}</td>
                  {/* Extra bet input */}
                  <td>
                    <input type="number" value={weekData[i]?.extraBet || 0}
                      min={0} max={200} step={5}
                      onChange={e => updateWeek(i, "extraBet", +e.target.value)}
                      style={{ width: 56, fontSize: 11, padding: "3px 6px",
                        background: weekData[i]?.extraBet > 0 ? S.gold + "20" : "#090914",
                        border: `1px solid ${weekData[i]?.extraBet > 0 ? S.gold : S.border}`,
                        color: S.text, borderRadius: 4, fontFamily: "'IBM Plex Mono'" }} />
                    <span style={{ color: S.dim, fontSize: 10, marginLeft: 2 }}>$</span>
                  </td>
                  <td style={{ color: r.totalBet > 0 ? S.red : S.dim }}>
                    {r.totalBet > 0 ? `-$${r.totalBet.toFixed(2)}` : "—"}
                  </td>
                  <td style={{ color: S.green }}>
                    {r.payoffTotal > 0 ? `+$${r.payoffTotal.toFixed(0)}` : "—"}
                  </td>
                  <td style={{ color: r.netIfRange >= 0 ? S.green : S.red }}>
                    {r.netIfRange >= 0 ? "+" : ""}${r.netIfRange.toFixed(0)}
                  </td>
                  <td style={{ color: r.netIfTop >= 0 ? S.green : S.red, fontWeight: 600 }}>
                    {r.netIfTop >= 0 ? "+" : ""}${r.netIfTop.toFixed(0)}
                  </td>
                  <td style={{ color: r.netIfBot >= 0 ? S.green : S.red }}>
                    {r.netIfBot >= 0 ? "+" : ""}${r.netIfBot.toFixed(0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 10, color: S.dim, marginTop: 10, fontFamily: "'IBM Plex Mono'" }}>
          COB. MIN = aposta mínima para cobrir o stop residual · EXTRA = aposta oportunista manual · ODD editável por semana
        </div>
      </div>

      {/* Insight */}
      <div className="insight">
        <strong style={{ color: S.gold }}>Lógica de manutenção:</strong>
        {" "}A cobertura mínima decai automaticamente conforme as fees absorvem o stop.
        {breakEvenWeek > 0 && <> A partir da <strong style={{ color: S.green }}>semana {breakEvenWeek}</strong>, o stop está 100% coberto pelas fees — apostas passam a ser puramente oportunistas.</>}
        {" "}Use a coluna <strong style={{ color: S.gold }}>EXTRA</strong> nas semanas com odd baixa para adicionar exposição assimétrica sem comprometer a proteção.
      </div>
    </div>
  );
}
