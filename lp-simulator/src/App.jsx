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
  const [alertSet, setAlertSet] = useState(false);

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

      <PolymarketLive ethPrice={ethPrice} rangePct={rangeHi} onSelectOdd={odd => setBetOdd(odd)} />

      {/* Early entry strategy panel */}
      <EarlyEntryPanel ethPrice={ethPrice} betOdd={betOdd} betAmount={betAmount} setBetOdd={setBetOdd} setBetAmount={setBetAmount} />

      {/* Pool + aposta inputs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="card">
          <div className="label" style={{ marginBottom: 14 }}>CONFIGURAÇÃO DA POOL</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
            <Stat label="FEES / DIA" value={`$${feesDay.toFixed(1)}`} color={S.green} small />
            <Stat label="STOP NOS LIMITES" value={`$${stop.toFixed(0)} (${stopPct}%)`} color={S.red} small />
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span className="label">STOP % NOS LIMITES</span>
              <span style={{ color: S.gold, fontSize: 13, fontFamily: "'IBM Plex Mono'" }}>{stopPct}%</span>
            </div>
            <input type="range" min={0.5} max={5} step={0.1} value={stopPct} onChange={e => setStopPct(+e.target.value)} />
          </div>
        </div>

        <div className="card">
          <div className="label" style={{ marginBottom: 14 }}>CONFIGURAÇÃO DA APOSTA</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span className="label">ODD DE ENTRADA</span>
                <span style={{ color: S.gold, fontSize: 14, fontFamily: "'IBM Plex Mono'", fontWeight: 600 }}>
                  {(betOdd * 100).toFixed(0)}% → paga {(1/betOdd).toFixed(1)}x
                </span>
              </div>
              <input type="range" min={3} max={50} step={1}
                value={Math.round(betOdd * 100)}
                onChange={e => setBetOdd(+e.target.value / 100)} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: S.dim, marginTop: 3, fontFamily: "'IBM Plex Mono'" }}>
                <span>3% (33x)</span><span>15%</span><span>25%</span><span>50% (2x)</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, marginTop: 6,
                background: `linear-gradient(to right, ${S.green} ${(betOdd*100-3)/47*100}%, ${betOdd<=0.15?S.green:betOdd<=0.30?S.gold:S.red} ${(betOdd*100-3)/47*100}%, transparent)`,
                border: `1px solid ${S.border}` }} />
              <div style={{ fontSize: 10, color: betOdd<=0.15?S.green:betOdd<=0.30?S.gold:S.red, marginTop: 4, fontFamily: "'IBM Plex Mono'" }}>
                {betOdd<=0.10 ? "✓ Assimetria máxima" : betOdd<=0.20 ? "✓ Zona ideal de hedge" : betOdd<=0.35 ? "⚠ Odd moderada" : "✗ Pouca assimetria"}
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
        </div>
      </div>

      {/* Timing optimizer */}
      <div className="card" style={{ borderColor: S.gold + "40" }}>
        <div className="label" style={{ marginBottom: 14, color: S.gold }}>OTIMIZADOR DE TIMING — ESPERAR ANTES DE APOSTAR</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
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

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 14 }}>
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

      {/* Alert Setup */}
      <AlertSetup ethPrice={ethPrice} plo={Plo} phi={Phi} capital={capital}
        onSetAlert={onSetAlert} requestAlertPermission={requestAlertPermission}
        alertSet={alertSet} setAlertSet={setAlertSet} />

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
              <div style={{ fontSize: 28, fontWeight: 800, color: item.color, fontFamily: "'Space Grotesk'", marginTop: 6 }}>{item.value}</div>
              <div style={{ fontSize: 11, color: S.textDim, marginTop: 4, fontFamily: "'IBM Plex Mono'" }}>{item.sub}</div>
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
        <div className="label" style={{ marginBottom: 14 }}>PARÂMETROS GLOBAIS</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 20 }}>
          <Field label="CAPITAL" value={capital} onChange={setCapital} prefix="$" min={500} max={100000} step={100} />
          <Field label="APR" value={apr} onChange={setApr} suffix="%" min={10} max={500} step={5} />
          <Field label="STOP %" value={stopPct} onChange={setStopPct} suffix="%" min={0.5} max={5} step={0.1} />
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
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
        <div className="label" style={{ marginBottom: 12 }}>RESUMO COMPARATIVO</div>
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
// EARLY ENTRY PANEL — Entrada na abertura com odd baixa
// ═══════════════════════════════════════════════════════════════
function EarlyEntryPanel({ ethPrice, betOdd, betAmount, setBetOdd, setBetAmount }) {
  // Uses betOdd/betAmount from parent — no duplicate sliders
  const openOdd    = betOdd * 100;        // % form
  const betAmt     = betAmount;
  const [ethMoveWed, setEthMoveWed] = useState(4);
  const [exitDay, setExitDay]       = useState(3);

  // Strike alvo = ETH atual + 10%
  const strikeTarget = ethPrice ? Math.round(ethPrice * 1.10 / 100) * 100 : 2200;
  const openOddDec   = openOdd / 100;
  const payoffMax    = betAmt / openOddDec;
  const multMax      = payoffMax / betAmt;

  // Odd no dia de saída — modelo simples baseado em movimento de preço e tempo
  const exitOddCalc = useMemo(() => {
    // Se ETH subiu X% em direção ao strike, qual a odd estimada?
    const distToStrike = ((strikeTarget - ethPrice) / ethPrice * 100); // % faltando para o strike
    const pctCovered   = Math.min(1, ethMoveWed / distToStrike);
    // Mais próximo do strike = odd muito maior
    const priceEffect  = openOddDec * (1 + pctCovered * 8); // 0% move = 1x, 100% move = 9x
    // Time decay pelo dia de saída (7 dias = semana completa)
    const timeDecay    = Math.max(0.05, (7 - exitDay) / 7);
    const rawOdd       = Math.min(0.92, priceEffect * timeDecay);
    return rawOdd;
  }, [openOdd, ethMoveWed, exitDay, strikeTarget, ethPrice]);

  const exitPayoff    = betAmt / exitOddCalc;
  const profitExit    = exitPayoff - betAmt;
  const multExit      = exitPayoff / betAmt;
  const roi           = ((exitPayoff - betAmt) / betAmt * 100);

  const DAY_NAMES = ["", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  // Simulação: 10 semanas apostando $betAmt na abertura com odd de abertura avg
  const weeklyCost   = betAmt;
  const hitRate      = 0.15; // histórico: ~15% das semanas ETH sobe 10%+
  const avgPayoffHit = betAmt / openOddDec * 0.7; // vende a 70% antes do vencimento
  const expectedWeekly = avgPayoffHit * hitRate - weeklyCost * (1 - hitRate);
  const annualNet    = expectedWeekly * 52;

  return (
    <div className="card" style={{ borderColor: S.gold + "60" }}>
      <div style={{ marginBottom: 14 }}>
        <div className="label" style={{ color: S.gold }}>⚡ ENTRADA NA ABERTURA — ESTRATÉGIA DE ODD BAIXA</div>
        <div style={{ fontSize: 12, color: S.textDim, fontFamily: "'Inter'", marginTop: 4 }}>
          Domingo 21h Brasília · Strike +10% · Mercado frio · Máxima assimetria
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Inputs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ padding: "10px 14px", background: S.gold+"10", borderRadius: 8,
            border: `1px solid ${S.gold}30`, marginBottom: 2 }}>
            <div style={{ fontSize: 10, color: S.dim, fontFamily: "'IBM Plex Mono'", marginBottom: 4 }}>USANDO DA CONFIGURAÇÃO ACIMA</div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: S.textDim, fontFamily: "'Inter'" }}>Odd de entrada</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: S.green, fontFamily: "'IBM Plex Mono'" }}>
                {openOdd.toFixed(1)}% → {multMax.toFixed(0)}x
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 13, color: S.textDim, fontFamily: "'Inter'" }}>Valor apostado</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: S.gold, fontFamily: "'IBM Plex Mono'" }}>${betAmt}</span>
            </div>
            <div style={{ fontSize: 10, color: S.dim, fontFamily: "'Inter'", marginTop: 6 }}>
              Altere os valores no painel "Configuração da Aposta" acima ↑
            </div>
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
            <div style={{ display: "flex", gap: 6 }}>
              {[2,3,4,5,6].map(d => (
                <span key={d} className="pill"
                  style={{ background: exitDay===d ? S.gold : S.border,
                    color: exitDay===d ? "#000" : S.textDim, fontSize: 11 }}
                  onClick={() => setExitDay(d)}>
                  {DAY_NAMES[d]}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Main payoff card */}
          <div style={{ padding: 16, background: "#090914", borderRadius: 10,
            border: `1px solid ${profitExit > 0 ? S.green : S.border}` }}>
            <div style={{ fontSize: 10, color: S.dim, fontFamily: "'IBM Plex Mono'", marginBottom: 8 }}>
              RESULTADO ESPERADO — SAÍDA {DAY_NAMES[exitDay].toUpperCase()}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: S.dim, fontFamily: "'IBM Plex Mono'" }}>APOSTA</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: S.red, fontFamily: "'Space Grotesk'" }}>-${betAmt}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: S.dim, fontFamily: "'IBM Plex Mono'" }}>VENDE POR</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: S.green, fontFamily: "'Space Grotesk'" }}>+${exitPayoff.toFixed(0)}</div>
              </div>
            </div>
            <div style={{ textAlign: "center", padding: "10px", borderRadius: 8,
              background: profitExit > 0 ? S.green + "15" : S.red + "15",
              border: `1px solid ${profitExit > 0 ? S.green : S.red}30` }}>
              <div style={{ fontSize: 10, color: S.dim, fontFamily: "'IBM Plex Mono'" }}>LUCRO LÍQUIDO</div>
              <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Space Grotesk'",
                color: profitExit > 0 ? S.green : S.red }}>
                {profitExit >= 0 ? "+" : ""}${profitExit.toFixed(0)}
              </div>
              <div style={{ fontSize: 12, color: S.gold, fontFamily: "'IBM Plex Mono'", marginTop: 2 }}>
                {multExit.toFixed(1)}x · ROI {roi.toFixed(0)}%
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
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
    </div>
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
function PolymarketLive({ ethPrice, rangePct, onSelectOdd }) {
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
  // Best hedge: strike above current price, odd between 5%-50% (useful asymmetry)
  const bestMatch = allOutcomes
    .filter(o => o.strike >= upperLimit * 0.95 && o.strike <= upperLimit * 1.5)
    .filter(o => parseFloat(o.odd) >= 0.05 && parseFloat(o.odd) <= 0.50)
    .sort((a, b) => Math.abs(a.strike - upperLimit) - Math.abs(b.strike - upperLimit))[0]
    || allOutcomes
    .filter(o => o.strike >= upperLimit * 0.95)
    .filter(o => parseFloat(o.odd) < 0.50)
    .sort((a, b) => a.strike - b.strike)[0];

  return (
    <div className="card" style={{ borderColor: S.green + "40", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div className="label" style={{ color: S.green }}>POLYMARKET — ODDS AO VIVO</div>
          {lastUpdate && <div style={{ fontSize: 10, color: S.dim, marginTop: 2, fontFamily: "'IBM Plex Mono'" }}>
            Atualizado: {lastUpdate} · auto-refresh 60s
          </div>}
        </div>
        <button onClick={fetchMarkets} disabled={loading}
          style={{ background: S.border, border: "none", color: S.text, padding: "6px 14px",
            borderRadius: 6, cursor: "pointer", fontFamily: "'IBM Plex Mono'", fontSize: 11 }}>
          {loading ? "carregando..." : "↻ atualizar"}
        </button>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", background: S.red + "15", borderRadius: 6,
          color: S.red, fontSize: 12, fontFamily: "'IBM Plex Mono'" }}>
          {error}
        </div>
      )}

      {loading && !markets.length && (
        <div style={{ textAlign: "center", padding: 24, color: S.dim, fontSize: 12, fontFamily: "'IBM Plex Mono'" }}>
          buscando mercados...
        </div>
      )}

      {markets.map(market => (
        <div key={market.id} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: S.textDim, marginBottom: 8,
            fontFamily: "'IBM Plex Mono'", borderBottom: "1px solid " + S.border, paddingBottom: 6 }}>
            {market.question}
            <span style={{ color: S.dim, marginLeft: 8, fontSize: 10 }}>
              Vol: ${parseFloat(market.volume || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(market.outcomes || []).map((o, i) => {
              const isTarget = bestMatch && o.strike === bestMatch.strike && parseFloat(o.odd) <= 0.50;
              return (
                <div key={i}
                  onClick={() => onSelectOdd && parseFloat(o.odd) <= 0.50 && onSelectOdd(parseFloat(o.odd))}
                  style={{
                    padding: "8px 12px", borderRadius: 8, minWidth: 90, textAlign: "center",
                    background: isTarget ? S.green + "20" : "#090914",
                    border: "1px solid " + (isTarget ? S.green : S.border),
                    cursor: parseFloat(o.odd) <= 0.50 ? "pointer" : "default",
                    transition: "all 0.15s",
                  }}>
                  <div style={{ fontSize: 10, color: isTarget ? S.green : S.dim,
                    fontFamily: "'IBM Plex Mono'", marginBottom: 3 }}>
                    {isTarget ? "★ " : ""}${o.strike.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: isTarget ? S.green : S.text, fontFamily: "'Space Grotesk'" }}>
                    {o.oddPct}%
                  </div>
                  <div style={{ fontSize: 10, color: S.textDim, fontFamily: "'IBM Plex Mono'", marginTop: 2 }}>
                    paga ${o.payoffPer100}/$100
                  </div>
                  {parseFloat(o.odd) <= 0.50 && (
                    <div style={{ fontSize: 9, color: S.gold, fontFamily: "'IBM Plex Mono'", marginTop: 3 }}>
                      ↑ usar
                    </div>
                  )}
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
          {parseFloat(bestMatch.odd) <= 0.15 ? " ✓ Odd ideal para hedge — boa assimetria." :
            parseFloat(bestMatch.odd) <= 0.30 ? " ✓ Custo razoável — payoff ainda compensa." :
            " ⚠ Odd moderada — verifique se o payoff cobre seu stop."}
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
  const tabs = ["Polymarket Hedge", "Cenários"];

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
        {tab === 0 && <TabPolymarket liveEth={liveEth} onSetAlert={setAlert} requestAlertPermission={requestAlertPermission} />}
        {tab === 1 && <TabScenarios />}
      </div>
    </div>
  );
}
