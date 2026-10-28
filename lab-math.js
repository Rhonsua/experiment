/* 实验公式显示层：MathML 本地排版。计算代码和原始输出保持独立。 */
(() => {
    'use strict';
    if(window.LabMath)return;
    const NS='http://www.w3.org/1998/Math/MathML',page=location.pathname.split('/').pop();
    const catalogue={
        'rotational-inertia.html':['J = mR(g-Rβ_有)/(β_有+abs(β_无))','J_试样 = J_总-J_0','ΔJ = J_2-J_1'],
        'wheatstone-bridge.html':['R_x = (R_1/R_2)R_0','R_x = sqrt(R_0 R_0′)','S = ΔI/(ΔR/R_0)','ΔR_0 = Σ(R_i f_i)+mb'],
        'meter-modification.html':['Δ = M-M_s','S = a/M','Δ_s = M_s K_s/100','Δ_合 = sqrt(abs(Δ)_max^2+Δ_s^2)','K_计算 = (Δ_合/M)×100%'],
        'thermal-conductivity.html':['λ = mc×((2h_P+R_P)/(2h_P+2R_P))×(1/(πR^2))×(h/(T_1-T_2))×abs(dT/dt)'],
        'rlc-series-circuit.html':['abs(Z) = sqrt(R^2+(ωL-1/(ωC))^2)','f_0 = 1/(2πsqrt(LC))','Q = (1/R)sqrt(L/C)','φ_R = -arctan((ωL-1/(ωC))/R)','2Δf_(0.7) = f_0/Q'],
        'sound-velocity.html':['v = fλ','Δφ = 2πx/λ','v = Δx/Δt','v_理 = 331.45sqrt(1+t/273.15)'],
        'grating-spectrum.html':['dsin(θ) = kλ','d = λ_0/sin(θ)','λ = dsin(θ)','θ = abs(φ_(+1)-φ_(-1))/2'],
        'photoresistor.html':['I_ph = U_R/R','U′ = U-U_R','R_p = U′/I_ph'],
        'elastic-modulus.html':['Y = 4FL/(πd^2ΔL)','ΔL = bΔx/(2D)','Y = 8mgLD/(πd^2 bΔx)'],
        'electron-charge-mass.html':['e/m = (9.88×10^6 U)/(D^2 I^2)','D = (D_2-D_1)×10^(-3)'],
        'least_squares.html':['y = ax+b','a = L_(xy)/L_(xx)','b = bar(y)-abar(x)','r = L_(xy)/sqrt(L_(xx)L_(yy))','y = Ax^k'],
        'viscosity.html':['η = ((ρ-ρ_0)gd^2)/(18v(1+Kd/D))','v = L/t'],
        'expansion.html':['ΔL = αL_0ΔT','α = a/L_0'],
        'tension.html':['U = kmg+b','α = δU/(π(D_外+D_内)k)'],
        'interference.html':['R = (D_m^2-D_n^2)/(4λ(m-n))','Δx = abs(x_2-x_1)/k','d = λL/(2Δx)'],
        'magnetoresistance.html':['ΔR/R = (R-R_0)/R_0','ΔR/R = aB^2+b','ΔR/R = kB+c'],
        'electron-work-function.html':['T = 920+1600I_f','lg(I_s′) = A+B sqrt(U_a)','lg(I_s/T^2) = A′+B′/T','φ = abs(B′)/5039'],
        'hall-sensor.html':['U = aI+b','N = 60/T'],
        'michelson.html':['λ = 2Δd/ΔN','Δd = abs(d_2-d_1)','ΔN = abs(N_2-N_1)'],
        'dysteresis-loop.html':['H = N_1 U_x/(lR_1)','B = R_2 CU_y/(N_2 S)'],
        'pzg.html':['I = I_0 cos^2(θ-θ_0)']
    };
    if(!catalogue[page])return;
    const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
    const tag=(n,...c)=>'<'+n+'>'+c.join('')+'</'+n+'>',row=(...c)=>tag('mrow',...c),mo=s=>tag('mo',escape(s)),mi=s=>tag('mi',escape(s)),mn=s=>tag('mn',escape(s));
    const scriptChars={'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9','₊':'+','₋':'-','ₓ':'x','ᵧ':'y','ᵣ':'r','ₛ':'s','ₙ':'n','ₘ':'m','ₚ':'p','⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁺':'+','⁻':'-'};
    const functions=['arctan','arcsin','arccos','sqrt','round','exp','sin','cos','tan','cot','abs','bar','log','lg','ln'];
    const unitAtom='(?:kg|mm|cm|nm|μm|µm|kΩ|MΩ|mV|mA|mH|μF|µF|kHz|MHz|Hz|Pa|rad|RPM|eV|[AVFHWKCsTNgmΩ])(?:\\^\\([-+−]?\\d+\\)|[⁻⁺⁰¹²³⁴⁵⁶⁷⁸⁹]+)?';
    const unitPattern=new RegExp('^'+unitAtom+'(?:[·⋅*/]'+unitAtom+')*(?=\\s*(?:=|≈|$))');
    function unitMarkup(value){const pattern=/([A-Za-zμµΩ]+)(?:\^\(([-+−]?\d+)\)|([⁻⁺⁰¹²³⁴⁵⁶⁷⁸⁹]+))/g;let from=0,out='<mspace width=".25em"/>';for(const found of value.matchAll(pattern)){out+=tag('mtext',escape(value.slice(from,found.index)));const exponent=found[2]||[...found[3]].map(c=>scriptChars[c]).join('');out+=tag('msup',tag('mtext',escape(found[1])),mn(exponent));from=found.index+found[0].length;}return row(out,tag('mtext',escape(value.slice(from))));}
    function tokens(source){const t=[];let i=0;while(i<source.length){const s=source.slice(i),ch=s[0];if(/\s/.test(ch)){i++;continue;}let m=s.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);if(m){t.push({type:'number',text:m[0]});i+=m[0].length;continue;}
        if(i>0&&/[\s\d]/.test(source[i-1])){const unit=s.match(unitPattern);if(unit){t.push({type:'unit',text:unit[0]});i+=unit[0].length;continue;}}
        const f=functions.find(f=>s.startsWith(f));if(f){t.push({type:'function',text:f});i+=f.length;continue;}
        if(/[₀-₉₊₋ₓᵧᵣₛₙₘₚ⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]/.test(ch)){const type=/[₀-₉₊₋ₓᵧᵣₛₙₘₚ]/.test(ch)?'_':'^';let v='';while(i<source.length&&scriptChars[source[i]]&&(/[₀-₉₊₋ₓᵧᵣₛₙₘₚ]/.test(source[i])===(type==='_')))v+=scriptChars[source[i++]];t.push({type,text:v});continue;}
        if(/[A-Za-z\u0370-\u03ff∑Σℓ]/.test(ch)){t.push({type:'variable',text:ch});i++;continue;}
        if(/[有无总空合理实测试样外内计算仪标]/.test(ch)){let v='';while(i<source.length&&/[有无总空合理实测试样外内计算仪标]/.test(source[i]))v+=source[i++];t.push({type:'label',text:v});continue;}
        const operators={'−':'-','–':'-','×':'*','·':'*','⋅':'*','÷':'/','√':'sqrt','∝':'∝','≈':'≈','≤':'≤','≥':'≥','→':'→','±':'±','½':'half','′':'prime',"'":'prime','̄':'bar'};
        if(operators[ch]){t.push({type:operators[ch],text:ch});i++;continue;}
        if('+-*/^_=()[]{}|<>%°'.includes(ch)){t.push({type:ch,text:ch});i++;continue;}
        throw Error('unsupported character');
    }return t;}
    function parse(source){try{source=source.replace(/_([A-Za-z\u0370-\u03ff][A-Za-z\u0370-\u03ff0-9]*|[有无总空合理实测试样外内计算仪标]+)/g,'_($1)');const ts=tokens(source);let pos=0;if(!ts.length||ts.length>800)return null;
        const peek=()=>ts[pos],take=()=>ts[pos++],starts=t=>t&&['number','variable','function','(','[','{','sqrt','half'].includes(t.type);
        function atom(){const t=take();if(!t)throw Error('missing operand');let out;
            if(t.type==='number'){const e=t.text.match(/^(.+)[eE]([+-]?\d+)$/);out=e?row(mn(e[1]),mo('×'),tag('msup',mn(10),mn(Number(e[2])))):mn(t.text);}
            else if(t.type==='variable')out=mi(t.text);
            else if(t.type==='label')out=tag('mtext',escape(t.text));
            else if(t.type==='half')out=tag('mfrac',mn(1),mn(2));
            else if(t.type==='+'||t.type==='-')out=row(mo(t.type==='-'?'−':'+'),atom());
            else if(['(','[','{','|'].includes(t.type)){const end={'(':')','[':']','{':'}','|':'|'}[t.type],inside=expression(0,end);if(take()?.type!==end)throw Error('unclosed group');out=row(mo(t.type),inside,mo(end));}
            else if(t.type==='sqrt'||t.type==='function'&&['sqrt','abs','bar'].includes(t.text)){const kind=t.type==='sqrt'?'sqrt':t.text;let inside;if(peek()?.type==='('||peek()?.type==='['){const open=take().type,end=open==='('?')':']';inside=expression(0,end);if(take()?.type!==end)throw Error('unclosed function');}else inside=atom();out=kind==='sqrt'?tag('msqrt',inside):kind==='abs'?row(mo('|'),inside,mo('|')):'<mover accent="true">'+inside+mo('¯')+'</mover>';}
            else if(t.type==='function')out='<mi mathvariant="normal">'+escape(t.text)+'</mi>';
            else throw Error('invalid operand');
            while(peek()&&['_','^','prime','bar','label','%','°'].includes(peek().type)){const suffix=take();if(suffix.type==='prime')out=tag('msup',out,mo('′'));else if(suffix.type==='bar')out='<mover accent="true">'+out+mo('¯')+'</mover>';else if(suffix.type==='%'||suffix.type==='°')out=row(out,mo(suffix.type));else if(suffix.type==='label')out=tag('msub',out,tag('mtext',escape(suffix.text)));else{let value;if(suffix.text!==suffix.type)value=/^[+-]?\d+$/.test(suffix.text)?mn(suffix.text):mi(suffix.text);else if(peek()?.type==='('){take();value=expression(0,')');if(take()?.type!==')')throw Error('unclosed script');}else{const next=take();if(next&&suffix.type==='^'&&['+','-'].includes(next.type)&&peek()?.type==='number'){value=row(mo(next.type==='-'?'−':'+'),mn(take().text));out=tag('msup',out,value);continue;}if(!next||!['number','variable','label'].includes(next.type))throw Error('invalid script');let v=next.text;if(next.type==='variable')while(peek()?.type==='variable')v+=take().text;value=next.type==='number'?mn(v):next.type==='label'?tag('mtext',escape(v)):mi(v);}out=tag(suffix.type==='_'?'msub':'msup',out,value);}}
            return out;
        }
        function expression(min=0,end=null){let left=atom();while(peek()&&peek().type!==end){const next=peek(),implicit=starts(next),rank=implicit?30:['*','/'].includes(next.type)?20:next.type==='unit'?15:['+','-','±'].includes(next.type)?10:['=','≈','∝','<','>','≤','≥','→'].includes(next.type)?5:-1;if(rank<min)break;if(!implicit)take();if(next.type==='unit'){left=row(left,unitMarkup(next.text));continue;}const right=expression(rank+1,end);left=next.type==='/'&&!implicit?tag('mfrac',left,right):row(left,implicit?'':mo(next.type==='*'?'×':next.type==='-'?'−':next.type),right);}return left;}
        const result=expression();if(pos!==ts.length)return null;return result;
    }catch{return null;}}
    function math(source,body=parse(source)){if(!body)return null;const node=document.createElementNS(NS,'math');node.setAttribute('aria-label',source);node.setAttribute('data-lab-source',source);node.innerHTML=body;return node;}
    // 排版不能重新解释原稿的运算顺序。括号组保留；不完整或不支持的片段保留原文。
    const candidate=/[A-Za-z0-9\u0370-\u03ff∑Σℓ√₀-₉₊₋ₓᵧᵣₛₙₘₚ⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻̄½′+\-−–×·⋅÷*/^_=≈∝≤≥→±()[\]{}|<>%°.'\s有无总空合理实测试样外内计算仪标]+/gu;
    function renderText(text){const fragment=document.createDocumentFragment();let from=0,count=0;for(const found of text.matchAll(candidate)){const source=found[0],trim=source.trim();if(!/[=≈∝≤≥_^√]/.test(trim)||!/[A-Za-z\u0370-\u03ff]/.test(trim))continue;const onlyUnit=trim.match(unitPattern);const node=math(trim,onlyUnit?.[0]===trim?unitMarkup(trim):parse(trim));if(!node)continue;fragment.append(document.createTextNode(text.slice(from,found.index)),document.createTextNode(source.slice(0,source.indexOf(trim))),node,document.createTextNode(source.slice(source.indexOf(trim)+trim.length)));from=found.index+source.length;count++;}fragment.append(document.createTextNode(text.slice(from)));return {fragment,count};}
    function sourceText(node){if(node.nodeType===3)return node.textContent;if(node.nodeType===11)return [...node.childNodes].map(sourceText).join('');if(node.nodeType!==1)return '';if(node.tagName==='BR')return '\n';if(node.tagName==='SUP')return '^('+node.textContent+')';if(node.tagName==='SUB')return '_('+node.textContent+')';const block=/^(?:P|DIV|H[1-6])$/.test(node.tagName);return (block?'\n':'')+[...node.childNodes].map(sourceText).join('')+(block?'\n':'');}
    const records=new Map();
    function renderSource(source){if(source.closest('[data-lab-math-view],#lab-principles')||source.querySelector('input,button,select,textarea,table,canvas,svg,math'))return;
        const text=sourceText(source),previous=records.get(source);if(previous?.text===text)return;if(previous){previous.view.remove();source.hidden=previous.hidden;source.removeAttribute('data-lab-math-source');records.delete(source);}const view=document.createElement('div');view.className=source.className+' lab-math-view';view.dataset.labMathView='true';let count=0;
        for(const line of text.split(/\r?\n/)){const result=renderText(line);count+=result.count;const p=document.createElement('div');p.className='lab-math-line';p.append(result.fragment);if(line.trim().startsWith('【'))p.classList.add('lab-math-heading');view.append(p);}
        if(!count)return;const hidden=source.hidden;source.hidden=true;source.dataset.labMathSource='true';source.after(view);records.set(source,{text,view,hidden});
    }
    const selectors='.formula,.formula-line,.result-equation,.detail-box,.uncertainty-box,#calculation-steps,#report,.badge-note,#result-output > p';
    let observer,pending=false;
    function refresh(){pending=false;observer?.disconnect();for(const [source,r] of records)if(!source.isConnected){r.view.remove();records.delete(source);}for(const source of document.querySelectorAll(selectors)){if(source.closest('[data-lab-math-view]'))continue;if(source.parentElement?.closest(selectors))continue;renderSource(source);}observer?.observe(document.body,{childList:true,subtree:true,characterData:true});}
    function start(){const style=document.createElement('style');style.id='lab-math-styles';style.textContent=`
        #lab-principles{box-sizing:border-box;max-width:1400px;margin:16px auto;padding:16px 20px;background:#f6f8fe;border:1px solid #dbe4f0;border-radius:12px;color:#26374e;font:15px/1.7 'Microsoft YaHei',sans-serif}#lab-principles summary{font-weight:600;cursor:pointer;color:#4b6cb7}#lab-principles .lab-math-line{padding:10px 3px;text-align:center}#lab-principles math{font-size:1.16em}.lab-math-view{white-space:normal;min-width:0;max-width:100%;overflow:hidden}.lab-math-line{max-width:100%;min-height:.6em;overflow-x:auto;padding:7px 2px;line-height:1.8;white-space:pre-wrap;box-sizing:border-box;break-inside:avoid}.lab-math-line math{font:1.1em 'Cambria Math',math;white-space:normal;margin:0 2px;vertical-align:middle}.lab-math-heading{font-weight:600;margin-top:8px}.lab-math-view[hidden],[data-lab-math-source]{display:none!important}@media print{#lab-principles{break-inside:avoid;margin:8pt 0;padding:8pt;border-color:#aaa}.lab-math-line{overflow:visible;padding:4pt 0;white-space:pre-wrap}.lab-math-line math{font-size:calc(.9em * var(--lab-print-scale,1))}#result-output,.result-output,.detail-box{max-height:none!important;height:auto!important;overflow:visible!important}.container{display:block!important}.lab-math-view{overflow:visible}#lab-config-panel,#lab-image-import,#lab-feedback{display:none!important}}`;
        // 公式会增加行高，步骤框和结果区须随内容增长；横向滚动只交给单条长公式。
        style.textContent+=`[data-lab-math-view]{height:auto!important;max-height:none!important;overflow:visible!important}#result-output:has([data-lab-math-view]),.result-output:has([data-lab-math-view]),.results-panel:has([data-lab-math-view]){height:auto!important;max-height:none!important;overflow:visible!important}.lab-math-line{overflow-x:auto;min-width:0;max-width:100%}`;
        document.head.append(style);const box=document.createElement('details');box.id='lab-principles';box.open=true;const summary=document.createElement('summary');summary.textContent='📐 实验原理公式';box.append(summary);for(const source of catalogue[page]){const line=document.createElement('div');line.className='lab-math-line';const node=math(source);if(node){line.append(node);box.append(line);}else{line.textContent=source;box.append(line);}}
        const header=document.querySelector('.header');if(header)header.after(box);else document.body.prepend(box);
        const printDetails=new Map();observer=new MutationObserver(mutations=>{if(mutations.every(m=>m.target.nodeType===1&&m.target.closest?.('[data-lab-math-view],#lab-principles')))return;if(!pending){pending=true;queueMicrotask(refresh);}});refresh();window.addEventListener('beforeprint',()=>{refresh();for(const details of document.querySelectorAll('details'))if(details.querySelector('[data-lab-math-view]')){if(!printDetails.has(details))printDetails.set(details,details.open);details.open=true;}for(const node of document.querySelectorAll('.lab-math-line math'))node.style.setProperty('--lab-print-scale',String(Math.min(1,620/node.getBoundingClientRect().width)));});window.addEventListener('afterprint',()=>{for(const [details,open] of printDetails)details.open=open;printDetails.clear();});
    }
    window.LabMath=Object.freeze({parse,refresh,catalogue});
    document.addEventListener('copy',event=>{const selection=getSelection();if(!selection?.rangeCount||selection.isCollapsed)return;const fragment=selection.getRangeAt(0).cloneContents();if(!fragment.querySelector('math[data-lab-source]'))return;fragment.querySelectorAll('math[data-lab-source]').forEach(node=>node.replaceWith(document.createTextNode(node.dataset.labSource)));event.clipboardData?.setData('text/plain',sourceText(fragment).trim());if(event.clipboardData)event.preventDefault();});
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
