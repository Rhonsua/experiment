/* 本地配置记忆：保存表单、数据组和行列结构；不保存图片、密钥或计算结果。 */
(() => {
    'use strict';
    if(document.getElementById('lab-config-panel'))return;
    const pages=new Set(['dysteresis-loop.html','elastic-modulus.html','electron-charge-mass.html','electron-work-function.html','expansion.html','grating-spectrum.html','hall-sensor.html','index_b1.html','interference.html','least_squares.html','magnetoresistance.html','meter-modification.html','michelson.html','millikan-oil-drop.html','photoresistor.html','pzg.html','rlc-series-circuit.html','rotational-inertia.html','sound-velocity.html','tension.html','thermal-conductivity.html','viscosity.html','wheatstone-bridge.html']);
    if(!pages.has(location.pathname.split('/').pop()))return;
    function start(){
        if(document.getElementById('lab-config-panel'))return;
        const key='lab-calculator-config:v1:'+location.pathname,prefKey=key+':enabled';
        const host=document.createElement('lab-config-panel');host.id='lab-config-panel';
        const root=host.attachShadow({mode:'open'});
        root.innerHTML=`<style>
          :host{display:block;max-width:1400px;margin:14px auto;color:#293d58;font:14px/1.6 'Microsoft YaHei',sans-serif;box-sizing:border-box}*{box-sizing:border-box}
          .bar{padding:10px 14px;border:1px solid #d8e3f2;border-radius:10px;background:#f5f8ff;display:flex;align-items:center;gap:10px 20px;flex-wrap:wrap}.bar label{display:flex;align-items:center;gap:8px;font-weight:600;cursor:pointer}input{accent-color:#4b6cb7}small{display:block;color:#61728a;font-size:12px}button{font:inherit;cursor:pointer;border:1px solid #c5d2e6;border-radius:7px;padding:7px 12px;background:white;color:#304a70}button:focus-visible,input:focus-visible{outline:3px solid #aac5f1;outline-offset:2px}button:disabled{opacity:.5;cursor:not-allowed}.primary{background:#4b6cb7;border-color:#4b6cb7;color:white}.status{flex:1;min-width:200px}.error{color:#a33e32}
          .overlay[hidden]{display:none!important}.overlay{position:fixed;inset:0;background:#18263e80;z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:18px}.dialog{background:white;border-radius:14px;box-shadow:0 15px 65px #11274744;padding:24px;max-width:520px;width:100%}h2{font-size:20px;margin:0 0 10px}p{margin:10px 0}.actions{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0 12px}.modal-option{display:flex;gap:8px;align-items:center;font-size:13px}
          @media print{:host{display:none!important}}@media(max-width:600px){.bar{gap:8px}.status{min-width:100%;order:3}.dialog{padding:20px}.actions button{flex:1}}
        </style><div class="bar"><label><input id="remember" type="checkbox">记住本页配置</label><div class="status"><span id="status" role="status"></span><small>参数、数据组、行列和模式只存在当前浏览器，不上传；各实验分开保存。</small></div><button id="forget" type="button">忘记本页配置</button></div>
        <div class="overlay" id="prompt" hidden><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="prompt-title" aria-describedby="prompt-description"><h2 id="prompt-title">要恢复上次配置吗？</h2><p id="prompt-description">检测到本页保存的参数和实验数据。请选择恢复，或使用页面默认配置。</p><small id="saved-time"></small><div class="actions"><button id="restore" class="primary" type="button">恢复上次配置</button><button id="defaults" type="button">使用默认配置</button></div><label class="modal-option"><input id="continue-remember" type="checkbox" checked>之后继续记住本页配置</label><small>恢复输入后，请重新点击计算生成结果。</small></section></div>`;
        const header=[...document.body.children].find(el=>el.matches('.header'));
        if(header)header.after(host);else document.body.prepend(host);
        const $=s=>root.querySelector(s),status=$('#status');
        let storage=null,enabled=true,restoring=false,pending=false,dirty=false,timer=null,history=[],pendingControls=new Map(),lateFields=[];
        const restoredDetails=new WeakSet();
        const initialIDs=new Set([...document.querySelectorAll('[id]')].map(el=>el.id).filter(id=>!/(?:\d{8,}|[a-f\d]{8}-[a-f\d-]{12,})/i.test(id)));
        const allowedTypes=new Set(['number','text','checkbox','radio','range','color','date','time','month','week','datetime-local']);
        const fields=()=>[...document.querySelectorAll('input,select,textarea')].filter(isField);
        function isField(el){return Boolean(el&&el.isConnected&&!el.disabled&&!el.readOnly&&el.matches('input,select,textarea')&&(el.tagName!=='INPUT'||allowedTypes.has(el.type))&&!/password|passwd|api.?key|secret|token/i.test(el.id+' '+el.name));}
        function path(el){
            const parts=[];let node=el;
            while(node&&node!==document.body){const siblings=[...node.parentElement.children].filter(s=>s.tagName===node.tagName);parts.unshift(node.tagName.toLowerCase()+':nth-of-type('+(siblings.indexOf(node)+1)+')');node=node.parentElement;}
            return 'body > '+parts.join(' > ');
        }
        function locate(el){
            const descriptor={id:initialIDs.has(el.id)?el.id:'',path:path(el),tag:el.tagName,type:el.type||'',name:el.name||''};
            for(let parent=el.parentElement;parent&&parent!==document.body;parent=parent.parentElement){
                if(initialIDs.has(parent.id)){descriptor.anchor=parent.id;descriptor.relative=descriptor.path.slice(path(parent).length+3);break;}
            }
            return descriptor;
        }
        function readField(el){const descriptor=locate(el);return {...descriptor,value:el.value,checked:el.checked===true,late:Boolean(el.closest('#result-output,#chart-container-box,.chart-box'))};}
        const fieldKey=f=>f.id?'#'+f.id:f.path;
        function resolve(descriptor){
            let el=descriptor.id?document.getElementById(descriptor.id):null;
            const matches=node=>Boolean(node&&node.tagName===descriptor.tag&&(descriptor.tag!=='INPUT'||node.type===descriptor.type));
            if(matches(el))return el;
            if(typeof descriptor.anchor==='string'&&typeof descriptor.relative==='string'){
                try{el=document.getElementById(descriptor.anchor)?.querySelector(':scope > '+descriptor.relative);}catch{el=null;}
                if(matches(el))return el;
            }
            try{el=document.querySelector(descriptor.path);}catch{return null;}
            return matches(el)?el:null;
        }
        function schema(){return fields().map(el=>{const d=locate(el);return [d.id,d.path,d.tag,d.type,d.name].join('|');}).join('\n');}
        function shape(){return fields().map(el=>[el.tagName,el.type,el.id,el.name].join('|')).join('\n');}
        function fingerprint(){return JSON.stringify(fields().map(el=>[el.tagName,el.type,el.id,el.value,el.checked]))+'|'+[...document.querySelectorAll('.main-command-btn,.sub-command-btn,.tab-btn,[role=tab]')].map(el=>el.className+'|'+el.getAttribute('aria-selected')).join(';')+'|'+['#progress','#report','#result-output'].map(s=>document.querySelector(s)?.textContent.slice(0,200)||'').join(';');}
        const baseSchema=schema();
        // 只调用页面已有的增删按钮，以同时还原界面与计算器内部数组。
        function structureRules(){
            const rules=[],find=selector=>document.querySelector(selector);
            function list(key,scope,item,add,remove,tag){
                const parent=()=>typeof scope==='function'?scope():find(scope);
                if(!parent())return;
                const button=(selector,last=false)=>()=>{const nodes=typeof selector==='function'?selector():[...document.querySelectorAll(selector)];return Array.isArray(nodes)?(last?nodes.at(-1):nodes[0]):nodes;};
                rules.push({key,parent,items:()=>[...parent()?.querySelectorAll(item)||[]],add:button(add),remove:button(remove,true),tag});
            }
            const page=location.pathname.split('/').pop();
            const inputList=(key,scope,fn)=>list(key,scope,'input','button[onclick="add'+fn+'()"]','button[onclick="remove'+fn+'()"]','input');
            const rows=(key,scope,add,remove='.remove-row,.remove-row-btn,.del-btn,.remove-btn')=>list(key,scope,'tr',add,()=>[...find(scope)?.querySelectorAll(remove)||[]],'tr');
            const dataRows=(scope,fn)=>list(scope,scope,':scope > .data-row','button[onclick="'+fn+'()"]',()=>[...find(scope)?.querySelectorAll('.remove-btn')||[]],'div');
            if(page==='pzg.html'){
                list('polar-groups','#groups-container',':scope > .group-card','button[onclick="addGroup()"]','.group-card .remove-group-btn','div');
                document.querySelectorAll('#groups-container > .group-card').forEach((_,index)=>{
                    const card=()=>document.querySelectorAll('#groups-container > .group-card')[index];
                    list('polar-vars-'+index,()=>card()?.querySelector('.var-list'),':scope > .var-tag',()=>card()?.querySelector('.add-var-btn'),()=>[...card()?.querySelectorAll('.remove-var-btn')||[]],'span');
                    list('polar-rows-'+index,()=>card()?.querySelector('.data-tbody'),':scope > tr',()=>card()?.querySelector('.add-row-btn'),()=>[...card()?.querySelectorAll('.remove-row-btn')||[]],'tr');
                });
            }
            if(page==='dysteresis-loop.html'){
                list('samples','#samples-container',':scope > .sample-block','#add-sample-btn','#del-sample-btn','div');
                document.querySelectorAll('#samples-container > .sample-block').forEach((_,index)=>{
                    const sample=()=>document.querySelectorAll('#samples-container > .sample-block')[index];
                    list('sample-points-'+index,()=>sample()?.querySelector('tbody'),':scope > tr',()=>sample()?.querySelector('.add-point-btn'),()=>[...sample()?.querySelectorAll('.del-pt-btn')||[]],'tr');
                });
            }
            if(page==='interference.html'||page==='index_b1.html'){
                list('newton-groups','#newton-data-inputs',page==='index_b1.html'?':scope > .newton-group-wrapper':':scope > .newton-group','button[onclick="addNewtonGroup()"]','#newton-data-inputs .remove-btn','div');
                for(const n of [1,2])list('wedge-'+n,'#wedge-group'+n+'-inputs',':scope > .data-row','button[onclick="addWedgePos('+n+')"]','#wedge-group'+n+'-inputs .remove-btn','div');
            }
            if(page==='electron-work-function.html'){inputList('if-rows','#if-container','IfRow');inputList('ua-cols','#ua-container','UaCol');}
            if(page==='michelson.html')list('michelson-groups','#data-groups-container',':scope > .group-box','#add-group-btn','#del-group-btn','div');
            if(page==='meter-modification.html')for(const kind of ['amm','volt','ohm'])rows(kind+'-rows','#'+kind+'-table tbody','[data-add="'+kind+'"]');
            if(page==='rotational-inertia.html')list('inertia-masses','#mass-input-list',':scope > .mass-entry','#add-mass-btn','#remove-mass-btn','div');
            const tables={'thermal-conductivity.html':['cool'],'grating-spectrum.html':['cal','unk'],'sound-velocity.html':['stand','phase','time','move'],'rlc-series-circuit.html':['data']}[page]||[];
            for(const id of tables)rows(id+'-rows','#'+id+'-table tbody',id==='cool'?'#add-cool':'#'+id+'-table .mini-add');
            if(page==='hall-sensor.html')for(const [id,add,remove]of [['bx-data-rows','bx-add-row','bx-del-row'],['iu-data-rows','iu-add-row','iu-del-row'],['speed-t-rows','speed-add','speed-del']])list(id,'#'+id,':scope > div','#'+add,'#'+remove,'div');
            for(const [name,scope,fn]of [['expansion.html','#expansion-data-inputs','addRow'],['magnetoresistance.html','#data-inputs','addRow'],['viscosity.html','#viscosity-data-inputs','addRow'],['tension.html','#calibration-inputs','addCalRow'],['tension.html','#measurement-inputs','addMeasRow']])if(page===name)dataRows(scope,fn);
            if(page==='index_b1.html')for(const [scope,fn]of [['#viscosity-data-inputs','addViscosityRow'],['#expansion-data-inputs','addExpansionRow'],['#tension-calibration-inputs','addTensionCalibrationRow'],['#tension-measurement-inputs','addTensionMeasurementRow']])dataRows(scope,fn);
            return rules;
        }
        const modeSelector='.main-command-btn,.sub-command-btn,.tab-btn,.mode-tab,[role=tab]';
        function modeSnapshot(){return [...document.querySelectorAll(modeSelector)].filter(el=>!el.closest('[hidden],.hidden,[aria-hidden="true"]')&&(el.classList.contains('active')||el.getAttribute('aria-selected')==='true')).map(el=>({target:locate(el),text:actionText(el)}));}
        function restoreModes(data){
            if(!Array.isArray(data.modes))return;
            for(const mode of data.modes.slice(0,30)){
                const el=mode?.target&&resolve(mode.target);
                if(allowedAction(el)&&actionText(el)===mode.text&&!el.classList.contains('active')&&el.getAttribute('aria-selected')!=='true')el.click();
            }
        }
        function restoreStructure(data){
            const explicit=Array.isArray(data.structure)?new Map(data.structure.slice(0,600).filter(s=>s&&typeof s.key==='string'&&Number.isInteger(s.count)&&s.count>=0&&s.count<=3000).map(s=>[s.key,s.count])):null;
            const legacy=!explicit&&data.baseSchema===baseSchema;
            if(!explicit&&!legacy)return 0;
            let missing=0,steps=0;
            const infer=rule=>{
                const prefix=path(rule.parent())+' > '+rule.tag+':nth-of-type(',first=rule.items()[0];
                const offset=first?[...first.parentElement.children].filter(el=>el.tagName===first.tagName).indexOf(first):0;
                let count=0;
                for(const field of data.fields)if(field.path.startsWith(prefix)){const index=Number(field.path.slice(prefix.length).split(')')[0]);if(Number.isInteger(index))count=Math.max(count,index-offset);}
                return count;
            };
            // 先还原外层组，再检查每组的变量列数和数据行数。
            for(let pass=0;pass<2;pass++)for(const rule of structureRules()){
                const target=explicit?explicit.get(rule.key):infer(rule);
                if(target===undefined)continue;
                while(rule.items().length!==target&&steps++<5000){
                    const before=rule.items().length,button=before<target?rule.add():rule.remove();
                    if(!allowedAction(button))break;
                    const operation={kind:'click',target:locate(button),text:actionText(button)};
                    button.click();if(rule.items().length===before)break;history.push(operation);
                }
            }
            const final=structureRules();
            for(const rule of final){const target=explicit?explicit.get(rule.key):infer(rule);if(target!==undefined&&rule.items().length!==target)missing++;}
            if(explicit)for(const key of explicit.keys())if(!final.some(rule=>rule.key===key))missing++;
            return missing;
        }
        function notify(message,error=false){status.textContent=message;status.className=error?'error':'';}
        function appendField(f){const previous=history[history.length-1];if(previous?.kind==='field'&&fieldKey(previous.field)===fieldKey(f))previous.field=f;else history.push({kind:'field',field:f});}
        function flushControls(){for(const f of pendingControls.values())appendField(f);pendingControls.clear();}
        function allowedAction(el){
            if(!el||!el.isConnected||el.closest('a')||!el.matches('button,input[type=button],'+modeSelector))return false;
            if(el.matches(modeSelector))return true;
            if(el.matches('.remove-btn,.del-btn,.remove-row,.remove-row-btn,.remove-group-btn,.remove-var-btn,.del-pt-btn')&&/^[×✕✖−-]$/.test(actionText(el)))return true;
            return /添加|增加|新增|删除|移除|清空|清除|示例|默认|重置|恢复|填充|填入|调整行数/.test(el.textContent||el.value||'');
        }
        function actionText(el){return (el.textContent||el.value||'').replace(/\s+/g,' ').trim().slice(0,180);}
        function validField(f){return f&&typeof f.path==='string'&&f.path.length<2500&&typeof f.id==='string'&&f.id.length<250&&['INPUT','SELECT','TEXTAREA'].includes(f.tag)&&typeof f.value==='string'&&f.value.length<=100000;}
        function applyField(f){
            if(!validField(f))return false;
            const el=resolve(f);if(!isField(el))return false;
            if(el.tagName==='SELECT'&&f.value!==''&&![...el.options].some(option=>option.value===f.value))return false;
            const check=el.type==='checkbox'||el.type==='radio';
            if(el.value===f.value&&(!check||el.checked===f.checked))return true;
            if(check){el.value=f.value;el.checked=f.checked;}else el.value=f.value;
            el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));
            return true;
        }
        function save(){
            clearTimeout(timer);timer=null;
            if(!storage||!enabled||pending||restoring||!dirty)return;
            try{
                const current=fields().map(readField);
                if(current.some(f=>!validField(f))||history.length>5000)throw Error('size');
                const details=[...document.querySelectorAll('details')].map(el=>({...locate(el),open:el.open}));
                const structure=structureRules().map(rule=>({key:rule.key,count:rule.items().length}));
                const data={version:1,page:location.pathname,baseSchema,savedAt:Date.now(),history,fields:current,details,structure,modes:modeSnapshot()};
                const serialized=JSON.stringify(data);if(serialized.length>1800000)throw Error('size');
                storage.setItem(key,serialized);dirty=false;
                notify('已保存本页配置 · '+new Date(data.savedAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}));
            }catch{notify('本次配置未能保存：浏览器存储不可用或数据过大。当前计算不受影响。',true);}
        }
        function schedule(){dirty=true;if(enabled&&!pending&&!restoring){clearTimeout(timer);timer=setTimeout(save,250);}}
        function rememberPreference(value){enabled=value;$('#remember').checked=value;try{storage?.setItem(prefKey,value?'1':'0');}catch{notify('浏览器无法记住保存选项。',true);}}
        document.addEventListener('input',controlEvent,true);document.addEventListener('change',controlEvent,true);
        function controlEvent(event){
            if(restoring||pending||!isField(event.target))return;
            const el=event.target,f=readField(el),beforeSchema=shape();
            const structural=el.tagName==='SELECT'||el.type==='radio'||el.type==='checkbox'||/count|rows|cols|number|num|n-points/i.test(el.id);
            if(structural){flushControls();appendField(f);}else pendingControls.set(fieldKey(f),f);
            queueMicrotask(()=>{if(restoring||pending)return;if(shape()!==beforeSchema)flushControls();schedule();});
        }
        document.addEventListener('click',event=>{
            if(restoring||pending||!(event.target instanceof Element))return;
            const button=event.target.closest('button,input[type=button],'+modeSelector);
            if(!button)return;
            if(allowedAction(button)){
                flushControls();const record={kind:'click',target:locate(button),text:actionText(button)},before=fingerprint();history.push(record);
                queueMicrotask(()=>{if(fingerprint()===before){const index=history.indexOf(record);if(index>=0)history.splice(index,1);}schedule();});
            }else queueMicrotask(()=>{if(!restoring&&!pending)schedule();});
        },true);
        document.addEventListener('toggle',event=>{if(restoredDetails.has(event.target)){restoredDetails.delete(event.target);return;}if(!restoring&&!pending&&event.target.matches?.('details'))schedule();},true);
        let observedShape=shape();
        const lateObserver=new MutationObserver(()=>{
            if(restoring||pending)return;
            if(lateFields.length){restoring=true;lateFields=lateFields.filter(f=>!applyField(f));restoring=false;}
            const currentShape=shape();if(currentShape!==observedShape){observedShape=currentShape;schedule();}
        });
        lateObserver.observe(document.body,{childList:true,subtree:true});
        window.addEventListener('pagehide',save);window.addEventListener('beforeunload',save);
        document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')save();});
        $('#remember').addEventListener('change',()=>{
            rememberPreference($('#remember').checked);
            if(!enabled){try{storage?.removeItem(key);}catch{}notify('已关闭保存；本页当前输入保留，重新进入时使用默认配置。');}
            else{dirty=true;save();}
        });
        $('#forget').addEventListener('click',()=>{rememberPreference(false);try{storage?.removeItem(key);}catch{}notify('已忘记本页保存的配置，当前输入保留。');});
        let saved=null;
        try{
            storage=window.localStorage;
            enabled=storage.getItem(prefKey)!=='0';
            const raw=storage.getItem(key);if(raw&&raw.length<=1800000)saved=JSON.parse(raw);
            const probe=key+':probe';storage.setItem(probe,'1');storage.removeItem(probe);
        }catch{if(!storage){$('#remember').disabled=true;$('#forget').disabled=true;enabled=false;}notify('无法读取本地保存记录；当前计算仍可正常使用。',true);}
        $('#remember').checked=enabled;
        const validSaved=Boolean(saved&&saved.version===1&&saved.page===location.pathname&&Array.isArray(saved.fields)&&saved.fields.length<=6000&&saved.fields.every(validField)&&Array.isArray(saved.history)&&saved.history.length<=5000);
        if(enabled&&validSaved){
            pending=true;host.dataset.pending='true';$('#prompt').hidden=false;
            $('#continue-remember').checked=enabled;
            $('#saved-time').textContent=Number.isFinite(saved.savedAt)?'保存时间：'+new Date(saved.savedAt).toLocaleString('zh-CN'):'';
            notify('请选择恢复上次配置，或使用默认配置。');
            queueMicrotask(()=>$('#restore').focus());
        }else if(status.textContent==='')notify(enabled?'已开启；输入后自动保存，重新进入时可选择恢复。':'已关闭保存，重新进入时使用默认配置。');
        function closePrompt(){pending=false;host.dataset.pending='false';$('#prompt').hidden=true;}
        // 电表升级倍率控件后，按旧表格的完整行序迁移，避免新增控件使无 ID 输入的路径错位。
        function migrateMeterDraft(data){
            if(location.pathname.split('/').pop()!=='meter-modification.html'||typeof data.baseSchema!=='string')return null;
            const prefixes=[...new Set(data.baseSchema.split('\n').map(line=>line.split('|')[1]?.match(/^(.+ > table:nth-of-type\(\d+\)) > /)?.[1]).filter(Boolean))];
            const keys=['amm','volt','ohm'];if(prefixes.length!==keys.length)return null;
            const tables=keys.map((name,index)=>({name,body:document.querySelector('#'+name+'-table tbody'),add:document.querySelector('[data-add="'+name+'"]'),values:data.fields.filter(f=>f.path.startsWith(prefixes[index]+' > '))}));
            if(tables.some(table=>!table.body||!table.add||table.values.length%2||table.values.some(f=>f.tag!=='INPUT'||f.type!=='number')))return null;
            history=[];let missing=0;
            for(const table of tables){
                const count=table.values.length/2;
                while(table.body.rows.length!==count){
                    const button=table.body.rows.length<count?table.add:table.body.lastElementChild?.querySelector('.remove-row');
                    if(!allowedAction(button))return {missing:missing+1,legacy:false};
                    const before=table.body.rows.length,operation={kind:'click',target:locate(button),text:actionText(button)};
                    button.click();if(table.body.rows.length===before)return {missing:missing+1,legacy:false};history.push(operation);
                }
                const inputs=[...table.body.querySelectorAll('input')];
                table.values.forEach((field,index)=>{if(!applyField({...readField(inputs[index]),value:field.value}))missing++;});
            }
            // 仅按仍存在的稳定 ID 恢复仪器参数，已删除的样式控件不能落到别的输入上。
            for(const field of data.fields){
                if(!field.id||!initialIDs.has(field.id)||!isField(document.getElementById(field.id)))continue;
                if(!applyField(field))missing++;
            }
            const legacy=data.fields.some(f=>f.id==='ohm-dial-style');
            if(legacy){const multiplier=document.getElementById('ohm-multiplier');if(multiplier)applyField({...readField(multiplier),value:'1'});}
            for(const [index,name]of ['amm','volt'].entries()){
                const detail=data.details?.find(f=>f.path?.includes('section:nth-of-type('+(index+1)+')'));
                const current=document.querySelector('#'+name+'-section details');
                if(detail&&current&&current.open!==Boolean(detail.open)){restoredDetails.add(current);current.open=Boolean(detail.open);}
            }
            lateFields=[];return {missing,legacy};
        }
        $('#defaults').addEventListener('click',()=>{
            rememberPreference($('#continue-remember').checked);try{storage?.removeItem(key);}catch{}
            closePrompt();history=[];pendingControls.clear();lateFields=[];dirty=false;
            notify(enabled?'已使用默认配置；再次输入后会自动保存。':'已使用默认配置，并关闭本页保存。');$('#remember').focus();
        });
        $('#restore').addEventListener('click',()=>{
            if(!validSaved)return;
            restoring=true;let missing=0,migration=null;const previousConfirm=window.confirm,previousAlert=window.alert;
            try{
                window.confirm=()=>true;window.alert=()=>{};
                if(saved.baseSchema!==baseSchema)migration=migrateMeterDraft(saved);
                if(migration){missing+=migration.missing;}
                else if(saved.baseSchema===baseSchema){
                    for(const operation of saved.history){
                        if(!operation||typeof operation!=='object'){missing++;continue;}
                        if(operation.kind==='field'){if(!applyField(operation.field)&&!operation.field?.late)missing++;}
                        else if(operation.kind==='click'&&operation.target&&typeof operation.text==='string'){
                            const el=resolve(operation.target);
                            if(allowedAction(el)&&actionText(el)===operation.text)el.click();else missing++;
                        }
                    }
                    history=saved.history.slice();
                }else{missing++;history=[];}
                if(!migration){
                const normal=saved.fields.filter(f=>!f.late),controls=normal.filter(f=>f.tag==='SELECT'||f.type==='radio'||f.type==='checkbox'),values=normal.filter(f=>!controls.includes(f));
                restoreModes(saved);
                for(const f of controls)applyField(f);
                missing+=restoreStructure(saved);
                for(const f of controls)applyField(f);
                for(const f of values)applyField(f);
                // 联动参数可能在前一轮更新其他输入，再核对一遍最终值。
                for(const f of normal)if(!applyField(f))missing++;
                lateFields=saved.fields.filter(f=>f.late&&!applyField(f));
                if(Array.isArray(saved.details))for(const detail of saved.details){const el=resolve(detail);if(el?.tagName==='DETAILS'&&el.open!==Boolean(detail.open)){restoredDetails.add(el);el.open=Boolean(detail.open);}}
                }
                rememberPreference($('#continue-remember').checked);if(!enabled)storage?.removeItem(key);
                pendingControls.clear();dirty=false;closePrompt();
            }catch{missing++;closePrompt();}
            finally{window.confirm=previousConfirm;window.alert=previousAlert;restoring=false;}
            notify(missing?'已尽量恢复；页面结构或部分字段有变化，请核对数据行和参数后重新计算。':migration?.legacy?'已恢复实测数据；旧版表盘已换为 ×1，请核对倍率后重新计算。':'已恢复上次输入与模式，请重新点击计算生成结果。',missing>0);
            host.dispatchEvent(new CustomEvent('lab-config:restored',{detail:{partial:missing>0},bubbles:true}));
            $('#remember').focus();
        });
        root.addEventListener('keydown',event=>{
            if(!pending)return;
            if(event.key==='Escape'){event.preventDefault();return;}
            if(event.key==='Tab'){
                const buttons=[$('#restore'),$('#defaults'),$('#continue-remember')],index=buttons.indexOf(root.activeElement);
                if((event.shiftKey&&index<=0)||(!event.shiftKey&&index===buttons.length-1)){event.preventDefault();buttons[event.shiftKey?buttons.length-1:0].focus();}
            }
        });
        document.addEventListener('focusin',()=>{if(pending&&!root.activeElement?.closest('.overlay'))$('#restore').focus();});
        host.dataset.ready='true';
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
