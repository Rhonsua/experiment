(() => {
    'use strict';
    if (document.getElementById('lab-feedback')) return;
    const source = document.currentScript?.src || new URL('feedback.js', location.href).href;
    const endpoint = new URL('api/feedback.php', source).href;
    const host = document.createElement('div');
    host.id = 'lab-feedback';
    const shadow = host.attachShadow({mode:'open'});
    shadow.innerHTML = `
        <link rel="stylesheet" href="${new URL('feedback.css?v=6.5.7',source).href}">
        <button id="open" type="button" aria-haspopup="dialog">💬 意见反馈</button>
        <dialog aria-labelledby="feedback-title"><div class="head"><h2 id="feedback-title">意见反馈</h2><button id="close" type="button" aria-label="关闭反馈窗口">×</button></div>
        <form novalidate>
            <p class="help">欢迎报告计算、显示问题，或提出改进建议。</p>
            <p class="help page">当前页面：<span id="page"></span></p>
            <label for="category">反馈类型</label><select id="category"><option value="calculation">计算问题</option><option value="display">显示或操作问题</option><option value="suggestion">功能建议</option><option value="other">其他反馈</option></select>
            <label for="message">具体内容（必填）</label><textarea id="message" placeholder="例如：哪个实验、输入了什么数据、实际结果与预期有什么不同……" maxlength="4000" required></textarea><p class="counter"><span id="count">0</span> / 2000 字</p>
            <label for="contact">联系方式（选填）</label><input id="contact" type="text" autocomplete="off" maxlength="200" placeholder="邮箱、QQ 或其他方便联系的方式">
            <input id="website" type="hidden" value="" autocomplete="off">
            <p class="help">提交的内容、当前页面和选填的联系方式会发送给站长，仅用于处理反馈。请勿填写密码、API Key 等敏感内容。</p>
            <div class="actions"><button id="submit" type="submit">提交反馈</button><button id="cancel" type="button">关闭</button></div>
            <p id="status" role="status" aria-live="polite"></p>
        </form></dialog>`;
    document.body.appendChild(host);
    const $ = selector => shadow.querySelector(selector);
    const dialog = $('dialog'), form = $('form'), submit = $('#submit');
    const count = text => [...text].length;
    let busy=false, until=0, token='', fingerprint='', timer=null;
    $('#page').textContent = document.title || location.pathname;
    function status(message,error=false) { $('#status').textContent=message;$('#status').classList.toggle('error',error); }
    function updateButton() {
        const wait=Math.max(0,Math.ceil((until-Date.now())/1000));
        submit.disabled=busy||wait>0;
        submit.textContent=busy?'正在提交…':wait>0?`请等待 ${wait} 秒`:'提交反馈';
        if(!busy&&wait===0&&timer!==null){clearInterval(timer);timer=null;}
    }
    function cooldown(seconds) {
        until=Date.now()+Math.max(0,Math.min(3600,Number(seconds)||0))*1000;
        if(timer===null)timer=setInterval(updateButton,1000);
        updateButton();
    }
    $('#open').addEventListener('click',()=>{
        if(typeof dialog.showModal!=='function'){status('当前浏览器不支持反馈窗口，请使用新版浏览器。',true);return;}
        if(!dialog.open)dialog.showModal();
        updateButton();
    });
    for(const selector of ['#close','#cancel'])$(selector).addEventListener('click',()=>dialog.close());
    $('#message').addEventListener('input',()=>{$('#count').textContent=count($('#message').value);});
    form.addEventListener('submit',async event=>{
        event.preventDefault();
        if(busy||Date.now()<until)return;
        if(!['http:','https:'].includes(location.protocol)){status('请通过网站网址打开页面后提交反馈。',true);return;}
        const message=$('#message').value.trim(),contact=$('#contact').value.trim();
        if(count(message)<2||count(message)>2000){status('请填写 2～2000 字的具体反馈内容。',true);$('#message').focus();return;}
        if(count(contact)>100||/[\r\n]/.test(contact)){status('联系方式请控制在 100 字以内，且不要换行。',true);$('#contact').focus();return;}
        const payload={category:$('#category').value,message,contact,page:location.pathname==='/'?'/index.html':location.pathname,title:[...document.title].slice(0,120).join(''),website:$('#website').value};
        const nextFingerprint=JSON.stringify(payload);
        if(nextFingerprint!==fingerprint||!token){
            try{token=Array.from(crypto.getRandomValues(new Uint8Array(16)),value=>value.toString(16).padStart(2,'0')).join('');}
            catch{status('当前浏览器无法准备反馈请求，请更新浏览器后重试。',true);return;}
            fingerprint=nextFingerprint;
        }
        payload.request_id=token;
        busy=true;status('正在提交反馈，请稍候…');updateButton();
        const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),30000);
        try{
            const response=await fetch(endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});
            let data;
            try{data=await response.json();}catch{throw new Error('反馈服务暂时无法响应，请稍后重试。');}
            if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('反馈服务返回内容无效，请稍后重试。');
            if(data.retry_after)cooldown(data.retry_after);
            if(!response.ok||data.ok!==true)throw new Error(data.error||'提交失败，请稍后重试。');
            const receipt=typeof data.receipt==='string'?data.receipt:'';
            status('反馈已提交，谢谢你的建议！'+(receipt?'\n反馈编号：'+receipt:''));
            $('#message').value='';$('#contact').value='';$('#count').textContent='0';token='';fingerprint='';
            cooldown(data.retry_after||60);
        }catch(error){
            status(error.name==='AbortError'?'提交超时，内容已保留。请稍后重试，重复请求会核对反馈编号。':error instanceof TypeError?'无法连接反馈服务，内容已保留，请稍后重试。':error.message,true);
        }finally{clearTimeout(timeout);busy=false;updateButton();}
    });
})();
