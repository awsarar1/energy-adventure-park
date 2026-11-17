import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, ArrowDownLeft, Atom, BookOpen, ChevronLeft, CircleHelp, ClipboardList, Flag, Gauge, GraduationCap, Maximize2, Minus, Mountain, Pause, Play, Plus, RotateCcw, Settings2, Thermometer, Timer, TrainFront, Trophy, Weight, Zap } from 'lucide-react';
import '@fontsource-variable/noto-sans-arabic';
import { Park } from './Park';
import { EnergyChart, energy, format } from './EnergyChart';
import { advance, FIXED_STEP, initial, makeTrack, read, type Config, type Reading } from './physics';
import './style.css';

const defaultConfig = {mass:500, height:20, friction:0.05};
type Mode = 'ideal' | 'friction' | 'compare';
const modes: {id: Mode; label: string}[] = [{id:'ideal', label:'بدون احتكاك'}, {id:'friction', label:'مع احتكاك'}, {id:'compare', label:'مقارنة'}];
const labels = ['انتظار البدء', 'قيد التشغيل', 'متوقفة مؤقتًا', 'انتهت التجربة'];
const points = [{name:'A', label:'الانطلاق'}, {name:'B', label:'القاع'}, {name:'C', label:'المرتفع الثاني'}];
const icons = [Activity, Mountain, Zap, Thermometer];

const laws = [
  {title:'طاقة الحركة', formula:'KE = ½mv²', body:'تعتمد على الكتلة ومربع السرعة. عند القاع B تبلغ سرعة العربة أكبر قيمة في التجربة دون احتكاك.', mode:'ideal'},
  {title:'طاقة الوضع التثاقلية', formula:'PE = mgh', body:'تعتمد على ارتفاع العربة فوق القاع، حيث نتخذ طاقة الوضع عند B مساوية للصفر.', mode:'ideal'},
  {title:'حفظ الطاقة الميكانيكية', formula:'ME = KE + PE', body:'في غياب الاحتكاك يبقى مجموع طاقتي الحركة والوضع ثابتًا، ولذلك ΔKE = −ΔPE.', mode:'ideal'},
  {title:'الطاقة الداخلية المكتسبة', formula:'ΔME = −ΔU = −fd', body:'تتناقص الطاقة الميكانيكية مع الاحتكاك. يمثّل f قوة الاحتكاك الثابتة ويمثّل d طول المسافة على السكة.', mode:'compare'},
] as const;

const questions = [
  {level:'سهل', title:'أي طاقة تختزنها عربة ساكنة عند النقطة A؟', choices:['طاقة حركة','طاقة وضع تثاقلية','طاقة حركة فقط عند القاع'], answer:1, why:'العربة ساكنة، لذا KE = 0. ارتفاعها عن B يعطيها طاقة وضع وفق PE = mgh.', mode:'ideal', config:defaultConfig},
  {level:'متوسط', title:'ما طاقة وضع عربة كتلتها 500 kg عند ارتفاع 20 m؟', choices:['10,000 J','50,000 J','100,000 J'], answer:2, why:'PE = mgh = 500 × 10 × 20 = 100,000 J.', mode:'ideal', config:defaultConfig},
  {level:'متوسط', title:'تبدأ العربة من السكون على ارتفاع 20 m بلا احتكاك. ما سرعتها عند B؟', choices:['10 m/s','20 m/s','30 m/s'], answer:1, why:'من mgh = ½mv² نجد v = √(2gh) = √400 = 20 m/s. عندها KE = 100,000 J لعربة كتلتها 500 kg.', mode:'ideal', config:defaultConfig},
  {level:'متقدم', title:'نقصت الطاقة الميكانيكية بمقدار 15,000 J بفعل الاحتكاك وحده. كم تساوي الزيادة في الطاقة الداخلية؟', choices:['0 J','7,500 J','15,000 J'], answer:2, why:'ΔME = −ΔU، لذا تزداد الطاقة الداخلية بمقدار 15,000 J. قارني ME وΔU للعربة السماوية.', mode:'compare', config:{...defaultConfig, friction:0.18}},
] as const;

const school = [
  {time:40, title:'مقدمة عن المشروع', script:'سنراقب عربة تبدأ من السكون. اسألي الطالبات عمّا سيحدث لسرعتها وهي تنزل، ثم وهي تصعد.'},
  {time:45, title:'طاقة الحركة وطاقة الوضع', script:'نشير إلى A وB. طاقة الوضع تعتمد على الارتفاع، وطاقة الحركة تعتمد على مربع السرعة. نتخذ القاع مرجعًا للارتفاع.'},
  {time:55, title:'تجربة بدون احتكاك', script:'شغّلي العربة الوردية. راقبي تناقص PE وتزايد KE أثناء النزول، ثم لاحظي ثبات الخط الأصفر الذي يمثّل ME.'},
  {time:60, title:'تجربة مع احتكاك', script:'قارني العربتين في الظروف الابتدائية نفسها. لاحظي نزول منحنى ME المتقطع وصعود منحنى الطاقة الداخلية للعربة السماوية.'},
  {time:55, title:'تحدٍّ للطالبات', script:'امنحي الطالبات وقتًا لتوقّع سرعة العربة عند القاع. بعد اختيار الإجابة، شغّلي تجربة التحقق.'},
  {time:45, title:'الخلاصة العلمية', script:'مع الاحتكاك تنقص الطاقة الميكانيكية ويزداد مخزون الطاقة الداخلية بالمقدار نفسه. دون احتكاك، تتبادل الطاقة شكلي الحركة والوضع ويظل مجموعهما ثابتًا.'},
];

function App() {
  const [config, setConfig] = useState<Config>(defaultConfig);
  const [mode, setMode] = useState<Mode>('ideal');
  const [rate, setRate] = useState(1);
  const [phase, setPhase] = useState(0);
  const [section, setSection] = useState('home');
  const [revision, setRevision] = useState(0);
  const [lesson, setLesson] = useState<Mode | null>(null);
  const [atBottom, setAtBottom] = useState<Reading | null>(null);
  const [error, setError] = useState(false);
  const [camera, setCamera] = useState({zoom:0, reset:0});
  const [expanded, setExpanded] = useState(false);
  const [question, setQuestion] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [stage, setStage] = useState(0);
  const track = useMemo(() => makeTrack(config.height), [config.height]);
  const configs = useMemo(() => mode === 'compare' ? [{...config, friction:0}, config]
    : [{...config, friction: mode === 'ideal' ? 0 : config.friction}], [config, mode]);
  const states = useRef([initial()]);
  const intro = useRef([initial()]);
  const accumulator = useRef(0);
  const [series, setSeries] = useState(() => [[read(track, {...config, friction:0}, initial())]]);
  const chosen = questions[question];
  const go = (id: string) => {
    setSection(id);
    location.hash = id;
    document.getElementById(id)?.scrollIntoView({behavior:'smooth'});
  };
  useEffect(() => {
    const sync = () => setSection(location.hash.slice(1) || 'home');
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  const handleError = useCallback(() => setError(true), []);
  useEffect(() => {
    let frame = 0, previous = 0;
    const tick = (now: number) => {
      const dt = previous ? Math.min(0.075, (now - previous) / 1000) : 0;
      previous = now;
      intro.current[0] = intro.current[0].done ? initial() :
        advance(track, {...config, friction:0}, intro.current[0], dt);
      frame = requestAnimationFrame(tick);
    };
    if (section === 'home' && phase === 0 && !matchMedia('(prefers-reduced-motion: reduce)').matches) frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [track, config, section, phase]);
  useEffect(() => {
    if (phase !== 1) return;
    let frame = 0, previous = 0, lastSample = 0;
    const tick = (now: number) => {
      accumulator.current += previous ? Math.min(0.073, (now - previous) / 1000) * rate : 0;
      previous = now;
      const crossings: Array<Reading | undefined> = [];
      while (accumulator.current >= FIXED_STEP) {
        states.current = states.current.map((state, i) => {
          const next = advance(track, configs[i], state, FIXED_STEP);
          if (state.s < track.bottom && next.s >= track.bottom) {
            let lo = 0, hi = FIXED_STEP;
            for (let j = 0; j < 30; j++) {
              const mid = (lo + hi) / 2;
              if (advance(track, configs[i], state, mid).s < track.bottom) lo = mid;
              else hi = mid;
            }
            crossings[i] = read(track, configs[i], advance(track, configs[i], state, hi));
          }
          return next;
        });
        accumulator.current -= FIXED_STEP;
      }
      const bottomReading = crossings[0];
      if (bottomReading) setAtBottom(previousReading => previousReading ?? bottomReading);
      const done = states.current.every(state => state.done);
      if (now - lastSample >= 80 || done || crossings.some(Boolean)) {
        lastSample = now;
        const readings = states.current.map((state, i) => read(track, configs[i], state));
        setSeries(old => old.map((rows, i) => {
          const extra: Reading[] = [];
          const crossing = crossings[i];
          if (crossing && crossing.t > rows.at(-1)!.t) extra.push(crossing);
          if (readings[i].t > (extra.at(-1) ?? rows.at(-1)!).t) extra.push(readings[i]);
          return extra.length ? [...rows, ...extra] : rows;
        }));
      }
      if (done) setPhase(3);
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase, rate, track, configs]);

  function reset(nextConfig = config, nextMode = mode, run = false, nextLesson: Mode | null = null) {
    const nextTrack = makeTrack(nextConfig.height);
    const count = nextMode === 'compare' ? 2 : 1;
    states.current = Array.from({length:count}, initial);
    intro.current[0] = initial();
    accumulator.current = 0;
    setConfig(nextConfig);
    setMode(nextMode);
    setAtBottom(null);
    setLesson(nextLesson);
    setRevision(n => n + 1);
    setSeries(states.current.map(state => [read(nextTrack, nextConfig, state)]));
    setPhase(run ? 1 : 0);
  }
  function experiment(nextMode: Mode, nextConfig = config) {
    const resolved = nextMode === 'ideal' || nextConfig.friction > 0 ? nextConfig : {...nextConfig, friction:0.05};
    reset(resolved, nextMode, true, nextMode);
    go('simulation');
  }
  function start() {
    setSection('simulation');
    if (phase === 3) reset(config, mode, true, lesson);
    else setPhase(1);
  }
  function pause() {
    setPhase(2);
    const values = states.current.map((state, i) => read(track, configs[i], state));
    setSeries(old => old.map((rows, i) => values[i].t > rows.at(-1)!.t ? [...rows, values[i]] : rows));
  }
  useEffect(() => {
    if (!expanded) return;
    const dismiss = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', dismiss);
    return () => window.removeEventListener('keydown', dismiss);
  }, [expanded]);
  const readings = series.map(s => s.at(-1)!);
  const budget = config.mass * 10 * config.height;
  const reading = readings[0];
  const slider = (id: keyof Config, label: string, symbol: string, unit: string, min: number, max: number, step: number, value: number, Icon: typeof Weight) =>
    <div className="control-group">
      <div className="control-label"><label htmlFor={id}><Icon size={17}/>{label} <span className="symbol">{symbol}</span></label><output htmlFor={id} dir="ltr">{format(value, id === 'friction' ? 2 : 0)} {unit}</output></div>
      <input id={id} type="range" min={min} max={max} step={step} value={value}
        onChange={event => reset({...config,[id]: +event.target.value}, id === 'friction' && mode === 'ideal' ? 'friction' : mode)}
        style={{'--pct': ((value - min) / (max - min) * 100) + '%'} as React.CSSProperties}/>
      <div className="range-ends" dir="ltr"><span>{min} {unit}</span><span>{max} {unit}</span></div>
    </div>;
  return <>
    <header className="topbar"><div className="shell nav-wrap">
      <a href="#home" className="brand"><span className="brand-icon"><Zap size={21} fill="currentColor"/></span><span>مدينة ملاهي الطاقة<small>ENERGY ADVENTURE PARK</small></span></a>
      <nav aria-label="التنقل الرئيسي">
        {[['home','الرئيسية'],['simulation','المحاكاة'],['learn','القوانين'],['challenges','التحديات']].map(([id,label]) =>
          <a key={id} href={'#'+id} className={section === id ? 'active' : ''}>{label}</a>)}
      </nav>
      <a className="school-nav" href="#school"><GraduationCap size={19}/> وضع العرض المدرسي</a>
    </div></header>
    <main className="shell">
      <section id="home" className="intro">
        <div className="eyebrow"><Atom size={16}/> فيزياء الصف الثاني عشر العلمي <span/> الكويت · الفصل الأول <bdi>2026–2027</bdi></div>
        <h1>مدينة ملاهي <em>الطاقة</em></h1>
        <p>اكتشفي كيف تتحول الطاقة أثناء حركة قطار الملاهي.</p>
        <p className="student-credit">عمل الطالبة سرى أوس أبوعيد</p>
        <div className="intro-actions"><button className="primary" onClick={() => go('simulation')}><Play size={16} fill="currentColor"/> ابدئي التجربة</button>
          <button className="secondary" onClick={() => go('learn')}><BookOpen size={17}/> تعرفي على قوانين الطاقة</button></div>
      </section>

      <section id="simulation" className="simulation">
        <div className="workspace">
          <aside className="panel controls" aria-labelledby="control-heading">
            <div className="block-title"><span className="tile"><Settings2 size={20}/></span><div><h2 id="control-heading">لوحة التحكم</h2><p>اضبطي شروط التجربة</p></div></div>
            {slider('mass','كتلة العربة','m','kg',100,1000,25,config.mass,Weight)}
            {slider('height','الارتفاع الابتدائي','hₐ','m',10,35,1,config.height,Mountain)}
            {slider('friction','معامل الاحتكاك','μ','',0,0.6,0.01,mode === 'ideal' ? 0 : config.friction,Settings2)}
            <fieldset><legend>وضع التجربة</legend><div className="segments">
              {modes.map(option => <button key={option.id} aria-pressed={mode === option.id} onClick={() => reset(config, option.id)}>{option.label}</button>)}
            </div></fieldset>
            <fieldset><legend>سرعة العرض</legend><div className="segments speeds" dir="ltr">{[0.5, 1, 2].map(value =>
              <button key={value} aria-pressed={rate === value} onClick={() => setRate(value)}>×{value}</button>)}</div></fieldset>
            <div className="control-actions">
              {phase === 1 ? <button className="primary launch" onClick={pause}><Pause size={17} fill="currentColor"/> إيقاف مؤقت</button>
              : <button className="primary launch" onClick={start}><Play size={17} fill="currentColor"/> {phase === 2 ? 'استئناف' : 'ابدأ'}</button>}
              <button className="secondary square" aria-label="إعادة التجربة" title="إعادة التجربة" onClick={() => {setSection('simulation'); reset();}}><RotateCcw size={18}/></button>
            </div>
          </aside>
          <div className="scene-column">
            {expanded && <div className="scene-placeholder"/>}
            <div className={'scene' + (expanded ? ' expanded' : '')}>
              <Park track={track} states={section === 'home' && phase === 0 && mode === 'ideal' ? intro : states}
                compare={mode === 'compare'} cameraInput={camera} onError={handleError}/>
              <div className="scene-heading"><span><TrainFront size={17}/> مسار قطار الملاهي</span><small><i className={phase === 1 ? 'running' : ''}/>{section === 'home' && phase === 0 && mode === 'ideal' ? 'معاينة المسار' : labels[phase]}</small></div>
              <div className="scene-points">
                {points.map((p,i) => <span key={p.name}><b>{p.name}</b>{p.label}<bdi>{format(track.points[i * 50].h, 1)} m</bdi></span>)}
              </div>
              <div className="camera-buttons">
                <button aria-label="تكبير" title="تكبير" onClick={() => setCamera(c => ({...c,zoom:c.zoom+1}))}><Plus size={17}/></button>
                <button aria-label="تصغير" title="تصغير" onClick={() => setCamera(c => ({...c,zoom:c.zoom-1}))}><Minus size={17}/></button>
                <button aria-label="إعادة زاوية الكاميرا" title="إعادة زاوية الكاميرا" onClick={() => setCamera(c => ({zoom:0,reset:c.reset+1}))}><RotateCcw size={15}/></button>
                <button aria-label={expanded ? 'إغلاق العرض الموسّع' : 'توسيع المشهد'} title="تبديل العرض الموسّع" onClick={() => setExpanded(!expanded)}><Maximize2 size={16}/></button>
              </div>
              {error && <div className="webgl-error">تعذّر عرض المشهد ثلاثي الأبعاد. تأكدي من تفعيل تسريع الرسومات في المتصفح ثم أعيدي تحميل الصفحة.</div>}
              {mode === 'compare' && <div className="lanes"><span>● الوردية · بدون احتكاك</span><span>● السماوية · مع احتكاك</span></div>}
            </div>
            <div className="telemetry panel">
              <div className="readings-title"><Activity size={17}/> القراءات اللحظية</div>
              {[[Timer,'الزمن',reading.t,'s'],[Gauge,'السرعة',reading.speed,'m/s'],[Mountain,'الارتفاع',reading.h,'m']].map(([Icon,label,n,unit],i) => {
                const Symbol = Icon as typeof Timer;
                const second = readings[1] && [readings[1].t, readings[1].speed, readings[1].h][i];
                return <div className="meter" key={String(label)}><Symbol size={16}/><span>{String(label)}</span><bdi>{format(Number(n),i === 0 ? 2 : 1)}{second !== undefined && ' / ' + format(second,i === 0 ? 2 : 1)} <small>{String(unit)}</small></bdi></div>;
              })}
            </div>
          </div>
        </div>
        {atBottom && <div className="bottom-reading"><span>سرعة العربة {mode === 'compare' ? 'الوردية ' : ''}عند القاع B</span>
          <bdi>{format(atBottom.speed, 2)} m/s</bdi></div>}
        {lesson && (lesson !== 'ideal' || atBottom) && <div className="observation" role="status"><Zap size={20}/>
          {lesson === 'ideal' ? 'عند انخفاض الارتفاع، تقل طاقة الوضع وتزداد طاقة الحركة، بينما يبقى مجموعهما ثابتًا.' : 'الطاقة لم تختفِ؛ وإنما تحول جزء من الطاقة الميكانيكية إلى طاقة داخلية بسبب الاحتكاك.'}</div>}
        <div className="energy-grid">
          {energy.map((item,i) => {
            const Icon = icons[i];
            return <article className="panel energy-card" key={item.key} style={{'--energy':item.color} as React.CSSProperties}>
              <div><span className="energy-icon"><Icon size={17}/></span><h3>{item.label}</h3><bdi className="energy-symbol">{item.symbol}</bdi></div>
              {readings.map((value,lane) => <React.Fragment key={lane}><div className={'energy-value lane-'+lane}><bdi>{format(value[item.key])} <small>J</small></bdi>
                <small>{format(value[item.key] / budget * 100)}%</small></div>
                <div className={'energy-bar lane-'+lane}><i style={{width:Math.min(100,value[item.key]/budget*100)+'%'}}/></div></React.Fragment>)}
            </article>;
          })}
        </div>
        <EnergyChart key={revision} series={series} budget={budget}/>
        <div className="experiment-grid">
          <button className="panel experiment" onClick={() => experiment('ideal')}><span className="tile"><Flag size={20}/></span><span><small>تجربة 1 · بدون احتكاك</small><strong>أين ذهبت الطاقة؟</strong></span><ArrowDownLeft size={19}/></button>
          <button className="panel experiment" onClick={() => experiment('compare',{...config,friction:0.18})}><span className="tile"><Thermometer size={20}/></span><span><small>تجربة 2 · مقارنة</small><strong>هل تختفي الطاقة؟</strong></span><ArrowDownLeft size={19}/></button>
        </div>
      </section>

      <section id="learn" className="lower-section">
        <div className="block-title section-title"><span className="tile"><BookOpen size={22}/></span><div><h2>افهمي الفيزياء</h2><p>الشغل والطاقة (2-1) · حفظ بقاء الطاقة (3-1)</p></div></div>
        <div className="laws">{laws.map((law,i) => {
          const Icon = icons[i];
          return <button className="panel law" key={law.title} onClick={() => experiment(law.mode,
            law.mode === 'compare' ? {...config,friction:0.18} : config)}>
              <span className="tile" style={{color:energy[i].color}}><Icon size={21}/></span><strong>{law.title}</strong>
              <bdi>{law.formula}</bdi><p>{law.body}</p><span className="law-link">شاهدي في المحاكاة <ChevronLeft size={15}/></span>
            </button>;
        })}</div>
        <details className="panel model"><summary>افتراضات المحاكاة</summary><p>نستخدم تسارع جاذبية مقداره <bdi>10 m/s²</bdi>. العربة جسم نقطي على سكة ثابتة، مع إهمال مقاومة الهواء. نمثّل الاحتكاك بقوة ثابتة المقدار <bdi>f = μmg</bdi> تعاكس اتجاه الحركة، ونستخدمها حدًا مبسطًا لبدء الحركة من السكون. تُحسب المسافة على طول السكة، وتقاس الارتفاعات من القاع B. ينتهي المسار عند C، وقد تتوقف العربة أو ترتد قبل بلوغها.</p></details>
      </section>

      <section id="challenges" className="lower-section">
        <div className="block-title section-title"><span className="tile"><Trophy size={22}/></span><div><h2>تحدّي الفيزيائي الصغير</h2><p>توقّعي الإجابة ثم تحققي منها بالمحاكاة.</p></div></div>
        <div className="panel question"><div className="question-nav">
          {questions.map((q,i) => <button key={q.title} className={question===i?'current':''} onClick={() => {setQuestion(i);setAnswer(null);}}>السؤال {i+1} · {q.level}</button>)}
        </div><h3><CircleHelp size={20}/>{chosen.title}</h3>
        <div className="choices">{chosen.choices.map((choice,i) => <button key={choice} aria-pressed={answer===i}
          className={answer === i ? i === chosen.answer ? 'correct' : 'incorrect' : ''}
          onClick={() => setAnswer(i)}><bdi>{choice}</bdi></button>)}</div>
        {answer !== null && <div className="answer" role="status"><strong>{answer === chosen.answer ? 'إجابة صحيحة' : 'إجابة غير صحيحة'}</strong><p>{chosen.why}</p>
          <button className="primary" onClick={() => experiment(chosen.mode, chosen.config)}><Play size={15}/> تحققي بالمحاكاة</button></div>}
        </div>
      </section>

      <section id="school" className="lower-section">
        <div className="block-title section-title"><span className="tile"><GraduationCap size={23}/></span><div><h2>وضع العرض المدرسي</h2><p>نحو خمس دقائق · الانتقال بين المراحل يدوي</p></div></div>
        <div className="panel school-card">
          <div className="stage-tabs">{school.map((item,i) => <button key={item.title} aria-pressed={i===stage} aria-label={item.title} onClick={() => setStage(i)}>{i+1}</button>)}</div>
          <small>المرحلة {stage+1} من {school.length} · {school[stage].time} ثانية</small>
          <h3>{school[stage].title}</h3><p>{school[stage].script}</p>
          <div className="stage-actions">
            <button className="secondary" disabled={stage===0} onClick={() => setStage(stage-1)}>المرحلة السابقة</button>
            {stage === 2 && <button className="secondary" onClick={() => experiment('ideal', defaultConfig)}>شغّلي التجربة</button>}
            {stage === 3 && <button className="secondary" onClick={() => experiment('compare',{...defaultConfig,friction:0.18})}>شاهدي المقارنة</button>}
            {stage === 4 && <button className="secondary" onClick={() => {setQuestion(2);setAnswer(null);go('challenges');}}>افتحي التحدّي</button>}
            <button className="primary" disabled={stage===5} onClick={() => setStage(stage+1)}>المرحلة التالية <ChevronLeft size={17}/></button>
          </div>
        </div>
      </section>
    </main>
    <footer><div className="shell"><span><Zap size={16}/> مدينة ملاهي الطاقة</span><span><ClipboardList size={16}/> مشروع الفيزياء المدرسي · الصف الثاني عشر العلمي</span></div></footer>
  </>;
}

createRoot(document.getElementById('root')!).render(<App/>);
