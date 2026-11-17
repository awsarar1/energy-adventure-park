import { useState } from 'react';
import { ChartNoAxesCombined } from 'lucide-react';
import type { Reading } from './physics';

export const energy = [
  { key: 'ke', label: 'طاقة الحركة', symbol: 'KE', color: '#2583ed' },
  { key: 'pe', label: 'طاقة الوضع', symbol: 'PE', color: '#df429b' },
  { key: 'me', label: 'الطاقة الميكانيكية', symbol: 'ME', color: '#f0a522' },
  { key: 'heat', label: 'الطاقة الداخلية', symbol: 'ΔU', color: '#12a98b' },
] as const;
export const format = (n: number, decimals = 0) => n.toLocaleString('en-US', {
  minimumFractionDigits: decimals, maximumFractionDigits: decimals,
});

export function EnergyChart({ series, budget }: { series: Reading[][]; budget: number }) {
  const [selected, select] = useState<number | null>(null);
  const [hidden, hide] = useState<string[]>([]);
  const end = Math.max(8, ...series.map(s => s.at(-1)!.t));
  const xMax = Math.ceil(end / 2) * 2;
  const x = (t: number) => 72 + 812 * t / xMax;
  const y = (e: number) => 178 - 151 * e / (budget * 1.08);
  const point = selected === null ? undefined : series[0][Math.min(selected, series[0].length - 1)];
  const comparison = point && series[1]?.reduce((best, row) =>
    Math.abs(row.t - point.t) < Math.abs(best.t - point.t) ? row : best);
  const path = (rows: Reading[], key: typeof energy[number]['key']) => rows.map((row, i) =>
    (i ? 'L' : 'M') + x(row.t).toFixed(2) + ',' + y(row[key]).toFixed(2)).join(' ');
  return <section className="panel chart-card" aria-labelledby="chart-heading">
    <div className="chart-head"><div className="block-title"><span className="tile"><ChartNoAxesCombined size={19}/></span><div>
      <h2 id="chart-heading">تغيّر الطاقة مع الزمن</h2><p>اختاري نقطة على الرسم لقراءة القيم في تلك اللحظة.</p></div></div>
      <div className="legend">{energy.map(item => <button key={item.key} type="button" aria-label={item.label}
        aria-pressed={!hidden.includes(item.key)} onClick={() => hide(old => old.includes(item.key) ? old.filter(k => k !== item.key) : [...old, item.key])}>
        <i style={{background: item.color}}/>{item.symbol}</button>)}</div>
    </div>
    {series.length > 1 && <p className="chart-key">خط متصل للعربة الوردية دون احتكاك، وخط متقطع للعربة السماوية مع الاحتكاك.</p>}
    <svg className="chart" direction="ltr" viewBox="0 0 910 220" role="img" aria-label="منحنيات الطاقة بالجول مع الزمن بالثواني"
      onPointerDown={event => {
        const rect = event.currentTarget.getBoundingClientRect();
        const target = ((event.clientX - rect.left) * 910 / rect.width - 72) / 812 * xMax;
        let i = 0;
        series[0].forEach((row, j) => { if (Math.abs(row.t - target) < Math.abs(series[0][i].t - target)) i = j; });
        select(i);
      }}>
      <text x="10" y="15">J</text><text x="895" y="206">s</text>
      {[0, .25, .5, .75, 1].map(t => <g key={t}>
        <line x1="72" x2="884" y1={y(t * budget)} y2={y(t * budget)}/>
        <text x="63" y={y(t * budget) + 4} textAnchor="end">{format(t * budget)}</text>
      </g>)}
      {Array.from({length: 5}, (_, i) => xMax * i / 4).map(t => <g key={t}>
        <line x1={x(t)} x2={x(t)} y1="22" y2="178"/><text x={x(t)} y="202" textAnchor="middle">{format(t, t % 1 ? 1 : 0)}</text>
      </g>)}
      {series.map((rows, lane) => energy.filter(e => !hidden.includes(e.key)).map(e =>
        rows.length > 1 ? <path key={lane + e.key} d={path(rows, e.key)} stroke={e.color} strokeWidth={lane ? 2.4 : 3} strokeDasharray={lane ? '7 5' : undefined}/>
        : <circle key={lane + e.key} cx={x(rows[0].t)} cy={y(rows[0][e.key])} r="4" fill={e.color}/>))}
      {point && <g><line className="cursor" x1={x(point.t)} x2={x(point.t)} y1="22" y2="178"/>
        {energy.filter(e => !hidden.includes(e.key)).map(e => <circle key={e.key} cx={x(point.t)} cy={y(point[e.key])} r="4.5" fill={e.color} stroke="white"/>)}</g>}
    </svg>
    {series[0].length > 1 && <div className="chart-inspect">
      <label>قراءة لحظة محددة <input aria-label="عينة الرسم البياني" type="range" min="0" max={series[0].length - 1}
        value={selected === null ? series[0].length - 1 : Math.min(selected, series[0].length - 1)} onChange={event => select(+event.target.value)} /></label>
      {point && <div className="sample"><bdi>t = {format(point.t, 2)} s</bdi>{energy.map(e =>
        <bdi key={e.key} style={{color:e.color}}>{e.symbol} {format(point[e.key])}{comparison ? ' / ' + format(comparison[e.key]) : ''} J</bdi>)}
        <button className="quiet" onClick={() => select(null)}>مسح التحديد</button></div>}
    </div>}
  </section>;
}

