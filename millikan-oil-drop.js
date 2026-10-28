/* 密里根油滴实验：教材式（3-4-10）与黑板的 5×5 静态测量。 */
(() => {
    'use strict';
    const $=s=>document.querySelector(s),mean=a=>a.reduce((s,v)=>s+v/a.length,0);
    const sup=v=>String(v).split('').map(c=>({'-':'⁻','+':'','0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'}[c]??c)).join('');
    const sci=(v,d=4)=>{if(!Number.isFinite(v))return '—';if(v===0)return '0';const [m,e]=v.toExponential(d-1).split('e');return m+'×10'+sup(Number(e));};
    const plain=v=>Number.isFinite(v)?String(Number(v.toPrecision(10))):'—';
    const read=id=>{const raw=$('#'+id).value.trim();return raw===''?NaN:Number(raw);};
    const defaults={'plate-distance':5,'fall-distance':1.6,density:979,gravity:9.7988,viscosity:1.83e-5,pressure:101325,'slip-b':0.00823,reference:1.602e-19};
    const labels={'plate-distance':'极板间距 d','fall-distance':'下落距离 ℓ',density:'油的密度 ρ',gravity:'重力加速度 g',viscosity:'空气黏度 η',pressure:'大气压强 p','slip-b':'修正常数 b',reference:'参考元电荷 e₀'};
    // 列是油滴，行是重复次数；疑读值通过照片说明明确列出。
    const photoU=[27,173,16,195,85];
    const photoTimes=[[20.46,20.16,20.14,20.17,20.36],[19.53,19.26,19.71,19.35,19.77],[15.70,15.41,15.81,15.13,15.51],[11.41,11.36,11.45,11.12,11.40],[5.38,5.66,5.39,5.31,5.40]];
    let ready=false;
    $('#measurement-head').innerHTML='<tr><th rowspan="2">重复次数</th>'+Array.from({length:5},(_,i)=>'<th colspan="2">油滴 '+(i+1)+'</th>').join('')+'</tr><tr>'+Array.from({length:5},()=>'<th>U / V</th><th>t / s</th>').join('')+'</tr>';
    for(let j=1;j<=5;j++){
        const tr=document.createElement('tr');tr.innerHTML='<th scope="row">'+j+'</th>';
        for(let i=1;i<=5;i++)for(const type of ['U','t']){const td=document.createElement('td'),input=document.createElement('input');input.id='drop'+i+'-'+type+j;input.type='number';input.step='any';input.min='0';input.setAttribute('aria-label','油滴'+i+'第'+j+'次'+(type==='U'?'平衡电压 U / V':'下落时间 t / s'));td.append(input);tr.append(td);}$('#measurement-body').append(tr);
    }
    $('#measurement-foot').innerHTML='<tr><th scope="row">平均值</th>'+Array.from({length:5},(_,i)=>'<td class="computed" id="mean-U'+(i+1)+'">—</td><td class="computed" id="mean-t'+(i+1)+'">—</td>').join('')+'</tr>';
    function invalidate(){ready=false;$('#metrics').replaceChildren();$('#result-table').replaceChildren();$('#validation').replaceChildren();$('#formatted-report').replaceChildren();$('#formatted-report').hidden=true;$('#report').hidden=false;$('#report').textContent='数据或设置已修改，请重新计算。';$('#copy-status').textContent='';for(const id of ['copy-btn','download-btn','print-btn'])$('#'+id).disabled=true;}
    function collect(){const rows=[],errors=[],params={};for(const id of Object.keys(defaults)){params[id]=read(id);if(!(params[id]>0)||!Number.isFinite(params[id]))errors.push(labels[id]+'须完整填写且大于 0。');}
        for(let i=1;i<=5;i++){const U=[],t=[];for(let j=1;j<=5;j++){U.push(read('drop'+i+'-U'+j));t.push(read('drop'+i+'-t'+j));}for(const [key,values] of [['U',U],['t',t]])for(let j=0;j<5;j++)if(!(values[j]>0)||!Number.isFinite(values[j]))errors.push('油滴 '+i+' 第 '+(j+1)+' 次 '+key+' 须完整填写且大于 0。');rows.push({i,U,t,avgU:mean(U),avgT:mean(t)});}return {rows,errors,params};}
    function preview(){const {rows}=collect();let count=0;for(const r of rows){for(const [key,values,avg] of [['U',r.U,r.avgU],['t',r.t,r.avgT]])$('#mean-'+key+r.i).textContent=values.every(v=>Number.isFinite(v)&&v>0)?plain(avg):'—';if([...r.U,...r.t].every(v=>Number.isFinite(v)&&v>0))count++;}$('#progress').textContent='已完成 '+count+' / 5 颗油滴（每颗 5 对 U、t）。'+($('#data-source').value==='photo'?' 当前为照片转录，请核对后使用。':'');}
    $('#experiment-inputs').addEventListener('input',()=>{invalidate();preview();});
    $('#experiment-inputs').addEventListener('change',()=>{invalidate();preview();});
    function metric(label,value,raw,id){const box=document.createElement('div');box.className='metric';const title=document.createElement('span'),strong=document.createElement('strong');title.textContent=label;strong.textContent=value;strong.dataset.result=id;strong.dataset.value=raw;box.append(title,strong);$('#metrics').append(box);}
    // 原生 MathML 排版，无外部脚本或字体请求；TXT 与复制保留原始可读文本。
    function renderReport(lines,rows,p){
        const host=$('#formatted-report'),escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
        const tag=(name,body)=>'<'+name+'>'+body+'</'+name+'>',mi=s=>tag('mi',escape(s)),mn=s=>tag('mn',escape(s)),mo=s=>tag('mo',escape(s)),row=(...x)=>tag('mrow',x.join(''));
        const frac=(a,b)=>tag('mfrac',row(a)+row(b)),root=a=>tag('msqrt',row(a)),pow=(a,b)=>tag('msup',row(a)+row(b)),sub=(a,b)=>tag('msub',mi(a)+(/^\d+$/.test(String(b))?mn(b):mi(b))),bar=a=>'<mover accent="true">'+mi(a)+mo('¯')+'</mover>';
        const add=a=>a.join(mo('+')),mul=(...a)=>a.join(mo('×')),eq=(...a)=>a.join(mo('=')),bracket=a=>row(mo('('),a,mo(')')),unit=s=>'<mtext> '+escape(s)+'</mtext>';
        const num=(v,digits=8)=>{if(v===0)return mn(0);if(Math.abs(v)>=1e5||Math.abs(v)<.001){const [a,b]=v.toExponential(digits-1).split('e');return mul(mn(digits===4?a:Number(a)),pow(mn(10),mn(Number(b))));}return mn(Number(v.toPrecision(digits)));};
        const v= sub('v','f'),r0=sub('r',0),e0=sub('e',0),avgU=bar('U'),avgT=bar('t'),avgE=bar('e'),half=frac(mn(3),mn(2));
        const qFormula=eq(mi('q'),mul(frac(row(mn(18),mi('π')),root(row(mn(2),mi('ρ'),mi('g')))),pow(row(mo('['),frac(row(mi('η'),mi('ℓ')),row(avgT,bracket(row(mn(1),mo('+'),frac(mi('b'),row(mi('p'),r0)))))),mo(']')),half),frac(mi('d'),avgU)));
        const nFormula=eq(mi('n'),row('<mi mathvariant="normal">round</mi>',bracket(frac(mi('q'),e0))));
        const equation=(content,label)=>{const div=document.createElement('div');div.className='math-line';div.tabIndex=0;div.setAttribute('aria-label','公式，可横向滚动');div.innerHTML='<math xmlns="http://www.w3.org/1998/Math/MathML" display="block" aria-label="'+escape(label)+'">'+content+'</math>';host.append(div);};
        let current=null,meanStep=0;
        for(let index=0;index<lines.length;index++){
            const line=lines[index],drop=line.match(/^油滴 (\d+)：$/);if(drop)current=rows[Number(drop[1])-1];
            let math=null;
            if(line.startsWith('平衡：')){equation(eq(row(mi('m'),mi('g')),frac(row(mi('q'),mi('U')),mi('d'))),'平衡条件');equation(eq(row(mn(6),mi('π'),mi('η′'),mi('r'),v),row(mi('m'),mi('g'))),'匀速下落受力平衡');math=eq(mi('m'),row(frac(mn(4),mn(3)),mi('π'),mi('ρ'),pow(mi('r'),mn(3))));}
            else if(line.startsWith('v_f = ℓ/t̄')){equation(eq(v,frac(mi('ℓ'),avgT)),'匀速下落速度');equation(eq(r0,root(frac(row(mn(9),mi('η'),mi('ℓ')),row(mn(2),mi('ρ'),mi('g'),avgT)))),'未修正半径');equation(eq(mi('C'),row(mn(1),mo('+'),frac(mi('b'),row(mi('p'),r0)))),'滑移修正因子');math=eq(mi('η′'),frac(mi('η'),mi('C')));}
            else if(line.startsWith('q = (18π/'))math=qFormula;
            else if(line.startsWith('n = round(q/e₀)，')){equation(nFormula,'取最近整数确定电荷数');math=eq(mi('e'),frac(mi('q'),mi('n')));}
            else if(current&&line.startsWith('Ū = ('))math=eq(avgU,frac(add(current.U.map(x=>num(x))),mn(5)),row(num(current.avgU),unit('V')));
            else if(current&&line.startsWith('t̄ = ('))math=eq(avgT,frac(add(current.t.map(x=>num(x))),mn(5)),row(num(current.avgT),unit('s')));
            else if(current&&line.startsWith('v_f = '))math=eq(v,frac(num(p.l),num(current.avgT)),row(num(current.v,4),unit('m/s')));
            else if(current&&line.startsWith('r₀ = √[')){math=eq(r0,root(frac(mul(mn(9),num(p.eta),num(p.l)),mul(mn(2),num(p.rho),num(p.g),num(current.avgT)))),row(num(current.r0,4),unit('m')));index++;}
            else if(current&&line.startsWith('C = 1 + '))math=eq(mi('C'),row(mn(1),mo('+'),frac(num(p.b),mul(num(p.pressure),num(current.r0)))),num(current.correction));
            else if(current&&line.startsWith('η′ = η/C')){equation(eq(mi('η′'),frac(mi('η'),mi('C')),row(num(current.eta,4),unit('kg·m⁻¹·s⁻¹'))),'修正后的空气黏度');math=row(mi('r'),mo('≈'),frac(r0,root(mi('C'))),mo('='),num(current.radius,4),unit('m'));}
            else if(current&&line.startsWith('q = 18π/')){math=eq(mi('q'),mul(frac(row(mn(18),mi('π')),root(mul(mn(2),num(p.rho),num(p.g)))),pow(row(mo('['),frac(mul(num(p.eta),num(p.l)),mul(num(current.avgT),num(current.correction))),mo(']')),half),frac(num(p.d),num(current.avgU))),row(num(current.q,4),unit('C')));index+=3;}
            else if(current&&line.startsWith('q/e₀ = ')){equation(eq(frac(mi('q'),e0),num(current.ratio)),'总电荷除以参考元电荷');math=eq(mi('n'),row('<mi mathvariant="normal">round</mi>',bracket(frac(mi('q'),e0))),mn(current.n));}
            else if(current&&/^e\d+ = q\/n/.test(line))math=eq(sub('e',current.i),frac(mi('q'),mi('n')),frac(num(current.q),mn(current.n)),row(num(current.e,4),unit('C')));
            else if(line.startsWith('ē = (e₁')){meanStep=1;current=null;math=eq(avgE,frac(add(rows.map(r=>sub('e',r.i))),mn(5)));}
            else if(meanStep===1&&line.startsWith('  = (')){meanStep=2;math=eq(avgE,mul(frac(add(rows.map(r=>num(r.e/1e-19))),mn(5)),pow(mn(10),mn(-19))),row(num(p.avg,4),unit('C')));index++;}
            else if(line.startsWith('Δe = ē − e₀'))math=eq(row(mi('Δ'),mi('e')),row(avgE,mo('−'),e0),row(num(p.avg),mo('−'),num(p.e0)),row(num(p.delta,4),unit('C')));
            else if(line.startsWith('|Δe| = '))math=eq(row(mo('|'),mi('Δ'),mi('e'),mo('|')),row(num(p.absolute,4),unit('C')));
            else if(line.startsWith('E = |Δe|/'))math=eq(mi('E'),mul(frac(row(mo('|'),mi('Δ'),mi('e'),mo('|')),e0),row(mn(100),mo('%'))),row(num(Number(p.relative.toPrecision(4))),mo('%')));
            else if(line.startsWith('近似保持半径')){const el=document.createElement('p');el.className='report-line';el.textContent='近似保持半径及修正黏度不变：';host.append(el);equation(eq(row(mi('m'),frac(row(mi('d'),mi('v')),row(mi('d'),mi('t')))),row(mi('m'),mi('g'),mo('−'),mi('k'),mi('v'))),'下落运动微分方程');math=eq(mi('k'),row(mn(6),mi('π'),mi('η′'),mi('r')));}
            else if(line.startsWith('τ = m/k')){equation(eq(mi('τ'),frac(mi('m'),mi('k')),frac(v,mi('g'))),'速度弛豫时间');math=eq(row(mi('v'),bracket(mi('t'))),row(v,bracket(row(mn(1),mo('−'),pow(mi('e'),row(mo('−'),frac(mi('t'),mi('τ'))))))));}
            else if(line.startsWith('x(t) = '))math=eq(row(mi('x'),bracket(mi('t'))),row(v,mo('['),mi('t'),mo('−'),mi('τ'),bracket(row(mn(1),mo('−'),pow(mi('e'),row(mo('−'),frac(mi('t'),mi('τ')))))),mo(']')));
            else if(line.startsWith('t₉₉ = ')){equation(eq(sub('t',99),row(mi('τ'),'<mi mathvariant="normal">ln</mi>',mn(100))),'达到百分之九十九终速的时间');math=eq(sub('x',99),row(v,mi('τ'),bracket(row('<mi mathvariant="normal">ln</mi>',mn(100),mo('−'),mn('0.99')))));}
            else if(line.startsWith('1. 平衡电压未调准')){const el=document.createElement('p');el.className='report-line';el.textContent='1. 平衡电压未调准、油滴漂移或仪器未调平会影响 U；其他量不变时：';host.append(el);math=row(mi('q'),mo('∝'),frac(mn(1),mi('U')));}
            else if(line.startsWith('2. 计时反应')){const el=document.createElement('p');el.className='report-line';el.textContent='2. 计时反应、布朗运动及过早开始计时会影响 t；需避开初始加速段。忽略修正变化时：';host.append(el);math=row(mi('q'),mo('∝'),pow(mi('t'),row(mo('−'),half)));}
            else if(line.startsWith('设 q/e₀ = ')){equation(eq(frac(mi('q'),e0),row(mi('n'),mo('+'),mi('ε'))),'取整前的电荷数');equation(row(mo('|'),mi('ε'),mo('|'),mo('≤'),frac(mn(1),mn(2))),'最近整数取整误差界限');math=eq(frac(row(frac(mi('q'),mi('n')),mo('−'),e0),e0),frac(mi('ε'),mi('n')));}
            else if(line.startsWith('由此 |e − e₀|/e₀ ≤ ')){equation(row(frac(row(mo('|'),mi('e'),mo('−'),e0,mo('|')),e0),mo('≤'),frac(mn(1),row(mn(2),mi('n')))),'元电荷验证法误差上界');const el=document.createElement('p');el.className='report-line';el.textContent=line.slice(line.indexOf('。')+1);host.append(el);continue;}
            if(math){equation(math,line);continue;}
            if(!line)continue;
            const heading=/^(密里根油滴实验|[一二]、|各颗油滴|油滴 \d+：$|平均值与误差$|误差分析参考$|黑板指定思考题|[124]\. |结论$)/.test(line),el=document.createElement(heading?'h3':'p');el.className=heading?'report-heading':'report-line';if(index===0)el.classList.add('report-title');el.textContent=line;host.append(el);
        }
        $('#report').hidden=true;host.hidden=false;
    }
    function generate(){invalidate();preview();const {rows,errors,params:p}=collect();if(errors.length){$('#validation').className='status error';const list=document.createElement('ul');for(const msg of errors){const li=document.createElement('li');li.textContent=msg;list.append(li);}$('#validation').append(list);$('#report').textContent='记录或参数尚未齐全，未生成完整实验结果。';return;}
        const d=p['plate-distance']*1e-3,l=p['fall-distance']*1e-3,rho=p.density,g=p.gravity,eta=p.viscosity,pressure=p.pressure,b=p['slip-b'],e0=p.reference;
        for(const r of rows){r.v=l/r.avgT;r.r0=Math.sqrt(9*eta*l/(2*rho*g*r.avgT));r.correction=1+b/(pressure*r.r0);r.eta=eta/r.correction;r.radius=r.r0/Math.sqrt(r.correction);r.q=18*Math.PI/Math.sqrt(2*rho*g)*Math.pow(eta*l/(r.avgT*r.correction),1.5)*d/r.avgU;r.ratio=r.q/e0;r.n=Math.round(r.ratio);r.e=r.q/r.n;r.tau=r.v/g;r.distance99=r.v*r.tau*(Math.log(100)-.99);
            if(![r.v,r.r0,r.correction,r.radius,r.q,r.e,r.distance99].every(v=>Number.isFinite(v)&&v>0)||!Number.isSafeInteger(r.n)||r.n<1)errors.push('油滴 '+r.i+' 的结果超出可计算范围或 round(q/e₀) 小于 1，请核对单位、U、t 与参考值。');}
        if(errors.length){$('#validation').className='status error';$('#validation').textContent=errors.join(' ');$('#report').textContent='未生成结果，请修正上述数据。';return;}
        const avg=mean(rows.map(r=>r.e)),delta=avg-e0,absolute=Math.abs(delta),relative=absolute/e0*100;
        if(![avg,delta,absolute,relative].every(Number.isFinite)){$('#validation').className='status error';$('#validation').textContent='汇总结果超出可计算范围，请核对参数。';return;}
        $('#validation').className='status';$('#validation').textContent='5 颗油滴均已计算；n 由未舍入的 q/e₀ 四舍五入得到。'+(rows.some(r=>r.n>=20)?' 存在较大电荷数，注意思考题 4 中的验证法局限。':'');
        metric('平均元电荷 ē',sci(avg)+' C',avg,'mean-e');metric('有符号偏差 Δe = ē − e₀',sci(delta)+' C',delta,'delta-e');metric('绝对误差 |Δe|',sci(absolute)+' C',absolute,'absolute-error');metric('相对误差 E',plain(Number(relative.toPrecision(4)))+' %',relative,'relative-error');
        const table=document.createElement('table');table.className='result-table';table.innerHTML='<thead><tr><th>油滴</th><th>Ū / V</th><th>t̄ / s</th><th>r₀ / μm</th><th>q / C</th><th>q/e₀</th><th>n</th><th>e=q/n / C</th></tr></thead><tbody>'+rows.map(r=>'<tr><th>'+r.i+'</th><td>'+plain(r.avgU)+'</td><td>'+plain(r.avgT)+'</td><td>'+sci(r.r0*1e6)+'</td><td>'+sci(r.q)+'</td><td>'+plain(r.ratio)+'</td><td>'+r.n+'</td><td>'+sci(r.e)+'</td></tr>').join('')+'</tbody>';$('#result-table').append(table);
        const lines=['密里根油滴实验——静态平衡法数据处理','按课堂黑板：5 颗油滴，每颗重复 5 次；采用元电荷验证法。',$('#data-source').value==='photo'?'数据来源：本次手写照片转录；第 1 颗 27 V、第 3 颗 16 V 已经本人确认，其余读数请核对。':'数据来源：手动录入／已核对的测量数据。','一、实验条件','d = '+plain(p['plate-distance'])+' mm = '+sci(d,8)+' m；ℓ = '+plain(p['fall-distance'])+' mm = '+sci(l,8)+' m。','ρ = '+plain(rho)+' kg·m⁻³，g = '+plain(g)+' m·s⁻²。','η = '+sci(eta,8)+' kg·m⁻¹·s⁻¹；p = '+plain(pressure)+' Pa；b = '+plain(b)+' Pa·m。','e₀ = '+sci(e0,8)+' C。','忽略空气浮力；修正项使用未修正半径 r₀，按教材近似处理。','各组先取 U、t 平均值，再算电荷；内部保留精度，显示 4 位有效数字。',''];
        if($('#include-principle').checked)lines.push('二、原理','平衡：mg = qU/d；匀速下落：6πη′rv_f = mg；m = 4πρr³/3。','v_f = ℓ/t̄，r₀ = √[9ηℓ/(2ρgt̄)]，C = 1 + b/(pr₀)，η′ = η/C。','q = (18π/√(2ρg)) × [ηℓ/(t̄C)]^(3/2) × d/Ū。','C 中的 r₀ 按教材式（3-4-11）求出，不能把 r₀ 当成已修正半径。','n = round(q/e₀)，e = q/n。','');
        lines.push('各颗油滴的测量记录与代入过程');
        for(const r of rows){lines.push('油滴 '+r.i+'：');for(let j=0;j<5;j++)lines.push('第 '+(j+1)+' 次：U = '+plain(r.U[j])+' V，t = '+plain(r.t[j])+' s。');lines.push('Ū = ('+r.U.map(plain).join(' + ')+')/5 = '+plain(r.avgU)+' V。','t̄ = ('+r.t.map(plain).join(' + ')+')/5 = '+plain(r.avgT)+' s。','v_f = '+sci(l,8)+' / '+plain(r.avgT)+' = '+sci(r.v)+' m/s。','r₀ = √[9 × '+sci(eta,8)+' × '+sci(l,8)+' / (2 × '+plain(rho)+' × '+plain(g)+' × '+plain(r.avgT)+')]','   = '+sci(r.r0)+' m。','C = 1 + '+plain(b)+' / ('+plain(pressure)+' × '+sci(r.r0,8)+') = '+plain(r.correction)+'。','η′ = η/C = '+sci(r.eta)+' kg·m⁻¹·s⁻¹；修正半径 r ≈ r₀/√C = '+sci(r.radius)+' m。','q = 18π/√(2 × '+plain(rho)+' × '+plain(g)+')','    × ['+sci(eta,8)+' × '+sci(l,8)+' / ('+plain(r.avgT)+' × '+plain(r.correction)+')]^(3/2)','    × '+sci(d,8)+' / '+plain(r.avgU),'  = '+sci(r.q)+' C。','q/e₀ = '+plain(r.ratio)+'，n = round(q/e₀) = '+r.n+'。','e'+r.i+' = q/n = '+sci(r.q,8)+' / '+r.n+' = '+sci(r.e)+' C。','');}
        lines.push('平均值与误差','ē = (e₁ + e₂ + e₃ + e₄ + e₅)/5','  = ('+rows.map(r=>(r.e/1e-19).toFixed(8)).join(' + ')+')/5 × 10⁻¹⁹','  = '+sci(avg)+' C。','Δe = ē − e₀ = '+sci(avg,8)+' − '+sci(e0,8)+' = '+sci(delta)+' C。','|Δe| = '+sci(absolute)+' C。','E = |Δe|/e₀ × 100% = '+plain(Number(relative.toPrecision(4)))+'%。','说明：上式 Δe 是有符号偏差；绝对误差取其绝对值，不等同于测量不确定度。','');
        if($('#include-analysis').checked)lines.push('误差分析参考','1. 平衡电压未调准、油滴漂移或仪器未调平会影响 U；其他量不变时 q∝1/U。','2. 计时反应、布朗运动及过早开始计时会影响 t；忽略修正变化时 q∝t^(−3/2)，需避开初始加速段。','3. 油滴挥发会改变半径，应每次重新核对平衡电压；温度、气压与 η、ρ 的取值也会影响结果。','4. 五颗油滴的 e 等权平均；程序不会剔除偏差较大的油滴，也不会修改原始数据以贴近参考值。','');
        if($('#include-questions').checked){const maxD=Math.max(...rows.map(r=>r.distance99));lines.push('黑板指定思考题 1、2、4（参考）','1. 油滴过大或过小的影响','过大的油滴下落较快，计时相对误差较大，可能需要较高电压；通常带电数较多，取整验证的辨别能力下降。过小的油滴布朗运动明显、成像不易辨认，挥发相对影响较大，黏度滑移修正也更显著。宜选择清晰、稳定且能方便平衡和计时的油滴。','2. 初始加速段需要多长距离','近似保持半径及修正黏度不变，m dv/dt = mg − kv，k = 6πη′r。','τ = m/k = v_f/g，v(t) = v_f(1 − exp(−t/τ))。','x(t) = v_f[t − τ(1 − exp(−t/τ))]。','严格达到终速需要无限长时间；取达到 99% 终速作为匀速判据：','t₉₉ = τ ln100，x₉₉ = v_f τ(ln100 − 0.99)。',...rows.map(r=>'油滴 '+r.i+'：τ = '+sci(r.tau)+' s，x₉₉ = '+sci(r.distance99)+' m。'),'本组最大 x₉₉ = '+sci(maxD)+' m，相比计时距离 ℓ = '+sci(l)+' m，约占 '+plain(maxD/l*100)+'%。','因此只要在 0 线前留出足够预落距离，就可避开这段加速；实际影响仍取决于释放位置与计时操作。','4. 带电数较多时元电荷验证法的弊端','设 q/e₀ = n + ε，取最近整数后 |ε|≤1/2，则 (q/n − e₀)/e₀ = ε/n。','由此 |e − e₀|/e₀ ≤ 1/(2n)。n 很大时，即使 q 的误差明显，算出的 e 也容易接近 e₀；小误差还可能使 n 错一位。','因 n 是借助已知 e₀ 决定的，这种方法依赖参考值，不能以很小的最终相对误差独立证明量子化；应优先选带电数较少且可稳定观察的油滴。','');}
        lines.push('结论','本次静态法测得平均元电荷大小 ē = '+sci(avg)+' C，与所用参考值的相对误差为 '+plain(Number(relative.toPrecision(4)))+'%。','该结论属于使用已知元电荷判定 n 后的验证结果。');
        $('#report').textContent=lines.join('\n');renderReport(lines,rows,{d,l,rho,g,eta,pressure,b,e0,avg,delta,absolute,relative});ready=true;for(const id of ['copy-btn','download-btn','print-btn'])$('#'+id).disabled=false;
    }
    $('#calculate-btn').addEventListener('click',generate);
    $('#photo-btn').addEventListener('click',()=>{if([...document.querySelectorAll('#measurement-table input')].some(el=>el.value!=='')&&!confirm('载入照片会替换测量数据并恢复本实验默认参数，继续吗？'))return;for(const [id,value] of Object.entries(defaults))$('#'+id).value=value;for(let i=1;i<=5;i++)for(let j=1;j<=5;j++){$('#drop'+i+'-U'+j).value=photoU[i-1];$('#drop'+i+'-t'+j).value=photoTimes[i-1][j-1];}$('#data-source').value='photo';$('#experiment-inputs').dispatchEvent(new Event('input',{bubbles:true}));});
    $('#clear-btn').addEventListener('click',()=>{if(!confirm('清空 5 颗油滴的全部 U、t 记录？'))return;document.querySelectorAll('#measurement-table input').forEach(el=>el.value='');$('#data-source').value='manual';$('#experiment-inputs').dispatchEvent(new Event('input',{bubbles:true}));});
    $('#copy-btn').addEventListener('click',async()=>{if(!ready)return;try{await navigator.clipboard.writeText($('#report').textContent);$('#copy-status').textContent='完整过程已复制。';}catch{$('#copy-status').textContent='浏览器未允许自动复制，请使用“下载过程 TXT”保存完整过程。';}});
    $('#download-btn').addEventListener('click',()=>{if(!ready)return;const url=URL.createObjectURL(new Blob(['\uFEFF'+$('#report').textContent],{type:'text/plain;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='密里根油滴实验_详细计算过程.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
    $('#print-btn').addEventListener('click',()=>{if(ready)window.print();});
    preview();
})();
