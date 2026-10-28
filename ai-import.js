/* 图片抄录与填表：独立于各实验的计算代码。 */
(() => {
    'use strict';
    if (document.getElementById('lab-image-import')) return;
    const scriptURL = document.currentScript?.src || new URL('ai-import.js', location.href).href;
    const endpoint = new URL('api/image-extract.php', scriptURL).href;
    const host = document.createElement('div');
    host.id = 'lab-image-import';
    document.body.append(host);
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <link rel="stylesheet" href="${new URL('ai-import.css?v=6.5.4', scriptURL).href}">
      <button type="button" id="open" aria-haspopup="dialog">📷 图片填表</button>
      <dialog aria-labelledby="heading">
        <div class="head"><h2 id="heading">图片识别填表</h2><button type="button" id="close" aria-label="关闭图片填表">×</button></div>
        <div class="body">
          <p class="help">先在实验页切换到对应方法，按照片增减组数、变量和数据行，再上传清晰的表格照片。只填当前显示的数字输入框。</p>
          <label class="field-label" for="area">导入区域</label><select id="area"></select>
          <div class="field-label" id="upload-label">实验数据图片</div>
          <div id="drop-zone" role="group" aria-labelledby="upload-label" aria-disabled="false">
            <strong class="drop-title">📷 把图片拖到这里</strong>
            <span class="drop-hint">每次一张，支持 JPG、PNG、WebP，也可以点击选择</span>
            <button type="button" id="choose">选择图片</button>
            <input id="file" type="file" accept="image/jpeg,image/png,image/webp" hidden>
            <small id="filename">尚未选择图片</small>
          </div>
          <div class="image-box" hidden><img id="photo" alt="本次待识别的实验数据图片"></div>
          <p class="help">点击识别后，图片和当前表格的字段说明会发送至 DeepSeek。照片不保存在本站；请裁剪掉姓名、学号等无关内容。同一访问 IP 每 60 秒可提交一张。</p>
          <button type="button" class="primary" id="recognize" disabled>发送至 DeepSeek 并识别</button>
          <p id="status" role="status" aria-live="polite">正在检查识别服务…</p>
          <section id="preview" hidden aria-labelledby="preview-title">
            <h3 id="preview-title">核对识别结果</h3>
            <p id="summary" class="notice"></p>
            <ul id="warnings"></ul>
            <div class="table-scroll"><table><thead><tr><th>填入</th><th>目标输入框</th><th>原值</th><th>识别值（可修改）</th><th>核对提示</th></tr></thead><tbody id="rows"></tbody></table></div>
            <label class="ack"><input type="checkbox" id="ack">我已核对行号、数值和单位，未勾选的输入框将保留原值（可能含示例数据）。</label>
            <button type="button" class="primary" id="apply" disabled>确认填入选中数据</button>
          </section>
          <button type="button" id="undo" hidden>撤销本次填入</button>
        </div>
      </dialog>`;
    const $ = selector => root.querySelector(selector);
    const dialog = $('dialog');
    const dropZone = $('#drop-zone');
    let dragDepth = 0;
    let fields = [], snapshot = null, previewRows = [], imageBlob = null, imageURL = '', imageVersion = 0;
    let busy = false, preparing = false, ready = false, deadline = 0, undoRecord = null, timer = null;
    const storageKey = 'lab-image-import-cooldown';
    const excluded = new Set(['polar-radius-scale', 'data-count']);
    const tidy = (value, max = 160) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
    const isVisible = el => !el.disabled && !el.readOnly && !el.closest('[hidden]') &&
        el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';

    function pathFor(el) {
        const parts = [];
        while (el && el !== document.documentElement) {
            if (el.id && document.getElementById(el.id) === el) {
                parts.unshift('#' + CSS.escape(el.id));
                break;
            }
            const siblings = el.parentElement ? [...el.parentElement.children].filter(n => n.tagName === el.tagName) : [el];
            parts.unshift(el.tagName.toLowerCase() + ':nth-of-type(' + (siblings.indexOf(el) + 1) + ')');
            el = el.parentElement;
        }
        return parts.join(' > ');
    }

    function sectionFor(el) {
        const card = el.closest('.group-card, .sample-card');
        const name = card?.querySelector('.group-name-input')?.value;
        if (name) return tidy(name) + '（第 ' + ([...document.querySelectorAll('.group-card')].indexOf(card) + 1) + ' 组）';
        let current = el;
        while (current && current !== document.body) {
            let prev = current.previousElementSibling;
            while (prev) {
                if (/^H[1-5]$/.test(prev.tagName)) return tidy(prev.textContent);
                prev = prev.previousElementSibling;
            }
            current = current.parentElement;
            const heading = current && [...current.children].find(c => /^H[1-5]$/.test(c.tagName));
            if (heading) return tidy(heading.textContent);
        }
        return tidy(document.querySelector('h1,h2')?.textContent || document.title);
    }

    function tableHeading(cell) {
        const table = cell.closest('table');
        const dataRow = cell.parentElement;
        const col = [...dataRow.children].slice(0, [...dataRow.children].indexOf(cell)).reduce((sum, c) => sum + (c.colSpan || 1), 0);
        const grid = [], titles = [];
        let headerRows = [...table.querySelectorAll('thead tr')];
        if (!headerRows.length) headerRows = [...table.rows].filter(row => row.querySelector('th') && !row.querySelector('input'));
        for (let r = 0; r < headerRows.length; r++) {
            grid[r] ||= [];
            let c = 0;
            for (const th of headerRows[r].children) {
                while (grid[r][c]) c++;
                const text = tidy(th.textContent);
                for (let y = 0; y < (th.rowSpan || 1); y++) {
                    grid[r + y] ||= [];
                    for (let x = 0; x < (th.colSpan || 1); x++) grid[r + y][c + x] = text;
                }
                c += th.colSpan || 1;
            }
            if (grid[r][col]) titles.push(grid[r][col]);
        }
        return [...new Set(titles)].join(' / ');
    }

    function describe(el, index) {
        const section = sectionFor(el);
        const cell = el.closest('td,th');
        const row = el.closest('tr,.data-row,.input-row');
        let label = tidy(el.labels?.[0]?.textContent || '');
        let position = '';
        if (cell) {
            const table = cell.closest('table');
            const rows = [...table.rows].filter(r => r.querySelector('input,textarea'));
            const rowLabel = tidy([...cell.parentElement.children].find(c => !c.querySelector('input,textarea,button'))?.textContent, 70);
            label = [tableHeading(cell), label, el.placeholder, tidy(cell.textContent, 50)].filter(Boolean).join(' / ');
            position = `第 ${rows.indexOf(cell.parentElement) + 1} 行${rowLabel ? '（' + rowLabel + '）' : ''}`;
            const inCell = [...cell.querySelectorAll('input,textarea')];
            if (inCell.length > 1) position += `，本格第 ${inCell.indexOf(el) + 1} 个数值`;
        } else {
            const parent = el.closest('.input-group,.input-row,.param-row') || el.parentElement;
            label ||= tidy(parent?.textContent, 160);
            label = [label, el.placeholder].filter(Boolean).join(' / ');
            if (row) {
                const siblings = [...row.parentElement.children].filter(r => r.matches('tr,.data-row,.input-row'));
                position = `第 ${siblings.indexOf(row) + 1} 行，第 ${[...row.querySelectorAll('input,textarea')].indexOf(el) + 1} 个数值`;
            }
        }
        if (!position) {
            const siblings = [...el.parentElement.querySelectorAll('input[type="number"],textarea')];
            if (siblings.length > 1) position = `同一区域第 ${siblings.indexOf(el) + 1} 个数值`;
        }
        return {
            id: 'f' + index, kind: el.tagName === 'TEXTAREA' ? 'list' : 'number',
            label: tidy(label || el.id || el.name || el.className || '数据'), section, position,
            hint: tidy([el.id, el.name, el.className, el.title, el.getAttribute('data-field'), el.getAttribute('aria-label')].filter(Boolean).join(' ')),
            path: pathFor(el), original: el.value, el,
        };
    }

    function collectFields() {
        return [...document.querySelectorAll('input[type="number"],textarea')]
            .filter(el => !excluded.has(el.id) && isVisible(el)).map(describe);
    }

    function pageStamp() {
        return JSON.stringify([...document.querySelectorAll('input,textarea,select')]
            .filter(el => !el.readOnly && !el.disabled)
            .map(el => [pathFor(el), el.type, el.value, el.checked]));
    }

    function numeric(value, kind) {
        if (typeof value !== 'string' && typeof value !== 'number') return null;
        value = String(value).trim().replace(/[０-９]/g, ch => String(ch.charCodeAt(0) - 0xff10))
            .replace(/[−－]/g, '-').replace(/＋/g, '+').replace(/．/g, '.');
        const parts = kind === 'list' ? value.split(/[\s,;，；]+/).filter(Boolean) : [value];
        if (!parts.length || parts.length > 1000 || value.length > (kind === 'list' ? 12000 : 100)) return null;
        if (parts.some(s => !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s) || !Number.isFinite(Number(s)))) return null;
        return parts.join(' ');
    }

    function setStatus(text, error = false) {
        $('#status').textContent = text;
        $('#status').classList.toggle('error', error);
    }

    function remaining() { return Math.max(0, Math.ceil((deadline - Date.now()) / 1000)); }
    function rememberCooldown(seconds) {
        if (Number.isFinite(seconds) && seconds > 0) deadline = Math.max(deadline, Date.now() + seconds * 1000);
        try { localStorage.setItem(storageKey, String(deadline)); } catch (_) { /* 私密模式仍由服务器限频。 */ }
        updateButtons();
    }

    function updateButtons() {
        const wait = remaining();
        $('#recognize').disabled = busy || preparing || !ready || !imageBlob || wait > 0 || fields.length === 0;
        $('#recognize').textContent = preparing ? '正在准备图片…' : busy ? '正在识别，请稍候…' : wait > 0 ? `请等待 ${wait} 秒` : '发送至 DeepSeek 并识别';
        $('#file').disabled = busy || preparing;
        $('#choose').disabled = busy || preparing;
        dropZone.setAttribute('aria-disabled', String(busy || preparing));
        $('#area').disabled = busy;
        $('#apply').disabled = !$('#ack').checked || !previewRows.some(r => r.check.checked) || busy;
    }

    function clearPreview() {
        $('#preview').hidden = true;
        $('#rows').replaceChildren();
        $('#warnings').replaceChildren();
        $('#ack').checked = false;
        previewRows = [];
        snapshot = null;
        updateButtons();
    }

    async function checkService() {
        if (!/^https?:$/.test(location.protocol)) {
            ready = false;
            setStatus('本地双击 HTML 无法调用识别服务。请通过启用了 PHP 的站点网址或本地 PHP 预览打开。', true);
            updateButtons();
            return;
        }
        try {
            const response = await fetch(endpoint, { mode: 'same-origin', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000) });
            const data = await response.json();
            if (!response.ok || data.ok !== true) throw new Error(data.error || '无法连接识别服务。');
            ready = data.ready === true;
            rememberCooldown(Number(data.retry_after) || 0);
            if (!busy && !snapshot) setStatus(data.message || (ready ? '服务已就绪，请选择图片。' : '识别服务尚未配置。'), !ready);
        } catch (_) {
            ready = false;
            setStatus('无法连接识别服务。请确认网站已上传 api 目录，并启用 PHP 8.2 或以上版本。', true);
        }
        updateButtons();
    }

    async function prepareImage(file) {
        const version = ++imageVersion;
        clearPreview();
        imageBlob = null;
        preparing = true;
        $('#filename').textContent = '正在准备：' + tidy(file?.name || '拖入的图片');
        updateButtons();
        let sourceURL = '';
        try {
            if (!file || file.size < 1 || file.size > 20 * 1024 * 1024) throw new Error('请选择一张 20 MB 以内的图片。');
            const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
            const jpeg = bytes[0] === 255 && bytes[1] === 216;
            const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
            const webp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
            if (!jpeg && !png && !webp) throw new Error('请使用 JPG、PNG 或 WebP 图片，HEIC 请先转换为 JPG。');
            sourceURL = URL.createObjectURL(file);
            const image = new Image();
            image.src = sourceURL;
            await image.decode();
            if (image.naturalWidth * image.naturalHeight > 40000000) throw new Error('图片尺寸太大，请先裁剪到需要识别的表格。');
            const scale = Math.min(1, 2400 / Math.max(image.naturalWidth, image.naturalHeight));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            let blob = null;
            for (const quality of [0.92, 0.8, 0.65]) {
                blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
                if (blob && blob.size <= 1800000) break;
            }
            if (!blob || blob.size > 1800000) throw new Error('图片内容太大，请裁剪后重试，避免表格文字被过度压缩。');
            if (version !== imageVersion) return;
            if (imageURL) URL.revokeObjectURL(imageURL);
            imageURL = URL.createObjectURL(blob);
            $('#photo').src = imageURL;
            $('.image-box').hidden = false;
            imageBlob = blob;
            $('#filename').textContent = '已选择：' + tidy(file.name || '拖入的图片');
            setStatus('图片已准备好。请确认导入区域和表格行数，再点击识别。');
        } catch (error) {
            if (version === imageVersion) {
                $('.image-box').hidden = true;
                $('#filename').textContent = '未选择有效图片，请重新拖入或选择';
                setStatus(error.message || '图片无法读取，请换一张图片。', true);
            }
        } finally {
            if (sourceURL) URL.revokeObjectURL(sourceURL);
            if (version === imageVersion) preparing = false;
            updateButtons();
        }
    }

    function selectFiles(list) {
        if (busy || preparing) {
            setStatus(busy ? '当前图片正在识别，请完成后再上传下一张。' : '图片正在准备，请稍候再上传。', true);
            return;
        }
        const files = Array.from(list || []);
        if (files.length !== 1) {
            setStatus(files.length > 1 ? '每次只能上传一张图片，请重新拖入一张。' : '请拖入一张图片文件，不支持文件夹或链接。', true);
            return;
        }
        // 清空隐藏的选择器，使再次选择同一张图片也能触发 change。
        $('#file').value = '';
        prepareImage(files[0]);
    }

    function isFileDrag(event) {
        return Array.from(event.dataTransfer?.types || []).includes('Files') || !!event.dataTransfer?.files?.length;
    }

    function resetDrag() {
        dragDepth = 0;
        dropZone.classList.remove('drag-over');
    }

    function chosenFields() {
        const area = $('#area').value;
        return fields.filter(f => area === 'all' || f.section === area);
    }

    function showPreview(data) {
        const byId = new Map(snapshot.fields.map(f => [f.id, f]));
        const seen = new Set();
        const warnings = Array.isArray(data.warnings) ? data.warnings.filter(w => typeof w === 'string').slice(0, 30) : [];
        let validCount = 0;
        for (const result of data.fields || []) {
            const field = byId.get(result.id);
            if (!field || seen.has(result.id)) continue;
            seen.add(result.id);
            const value = numeric(result.value, field.kind);
            const tr = document.createElement('tr');
            const check = document.createElement('input');
            check.type = 'checkbox';
            check.setAttribute('aria-label', '填入 ' + field.label + ' ' + field.position);
            check.checked = value !== null && result.confidence === 'high';
            check.disabled = value === null;
            const input = document.createElement(field.kind === 'list' ? 'textarea' : 'input');
            if (field.kind === 'number') { input.type = 'text'; input.inputMode = 'decimal'; }
            input.value = value ?? '';
            input.setAttribute('aria-label', '识别值 ' + field.label + ' ' + field.position);
            input.placeholder = '未识别，请核对后填写';
            const target = document.createElement('div');
            const strong = document.createElement('strong'); strong.textContent = field.label;
            const detail = document.createElement('small'); detail.textContent = [field.section, field.position].filter(Boolean).join(' · ');
            target.append(strong, detail);
            const note = document.createElement('div');
            const confidence = document.createElement('strong');
            confidence.textContent = value === null ? '未识别' : result.confidence === 'high' ? '请核对' : '需人工核对';
            confidence.className = result.confidence === 'high' && value !== null ? '' : 'uncertain';
            const source = document.createElement('small'); source.textContent = tidy(result.source, 200);
            note.append(confidence, source);
            for (const child of [check, target, field.original, input, note]) {
                const td = document.createElement('td');
                if (typeof child === 'string') td.textContent = child; else td.append(child);
                tr.append(td);
            }
            $('#rows').append(tr);
            const entry = { field, check, input };
            previewRows.push(entry);
            if (value !== null) validCount++;
            input.addEventListener('input', () => {
                const valid = numeric(input.value, field.kind) !== null;
                check.disabled = !valid; check.checked = valid;
                input.setCustomValidity(valid || !input.value ? '' : '请填写有效数字，不要包含单位或缺失值。');
                $('#ack').checked = false;
                updateButtons();
            });
            check.addEventListener('change', () => { $('#ack').checked = false; updateButtons(); });
        }
        $('#summary').textContent = `当前导入区域共 ${snapshot.fields.length} 个输入框，识别出 ${validCount} 个有效值。只会填入勾选的字段；其余输入框保持原值，请特别检查示例数据是否仍被保留。`;
        if (!validCount) warnings.push('没有识别到可直接填入的数值。请检查照片、当前方法、组别和表格行数。');
        for (const warning of warnings) { const li = document.createElement('li'); li.textContent = warning; $('#warnings').append(li); }
        $('#preview').hidden = false;
        $('#ack').checked = false;
        updateButtons();
    }

    async function recognize() {
        if (busy || preparing || !ready || !imageBlob || remaining() > 0) return;
        const selected = chosenFields();
        if (!selected.length || selected.length > 600) { setStatus('请选择一个包含 1 至 600 个数字输入框的数据区域。', true); return; }
        clearPreview();
        snapshot = { fields: selected, stamp: pageStamp(), before: collectFields() };
        const schema = { title: tidy(document.title), fields: selected.map(({ id, kind, label, section, position, hint }) => ({ id, kind, label, section, position, hint })) };
        const form = new FormData();
        form.append('schema', JSON.stringify(schema));
        form.append('image', imageBlob, 'experiment.jpg');
        busy = true;
        setStatus('正在识别，通常需要几秒到一分钟，请稍候…');
        // 请求是否到达服务器不确定时，也先保留本地冷却；服务器是最终判定方。
        rememberCooldown(60);
        try {
            const response = await fetch(endpoint, { method: 'POST', body: form, mode: 'same-origin', redirect: 'error', signal: AbortSignal.timeout(115000) });
            const data = await response.json();
            rememberCooldown(Number(data.retry_after) || 0);
            if (!response.ok || data.ok !== true) throw new Error(data.error || '识别失败，请稍后重试。');
            if (!Array.isArray(data.fields)) throw new Error('识别结果格式异常，没有写入数据。');
            showPreview(data);
            setStatus('识别完成。核对并勾选数据，确认后才会填入原表格。');
        } catch (error) {
            snapshot = null;
            setStatus(error.name === 'TimeoutError' || error.name === 'AbortError' ? '识别超时，没有写入数据。请稍后重试或裁剪图片。' : error.message || '识别失败，没有写入数据。', true);
        } finally { busy = false; updateButtons(); }
    }

    function writeField(field, value) {
        // 某些页面修改一个轴值后会重建表格；每次按原位置重新查找输入框。
        const el = document.querySelector(field.path);
        if (!el || el.readOnly || el.disabled) throw new Error('页面表格发生变化，请重新识别。');
        if (el.type === 'number' && value !== '') value = value.replace(/^\+/, '').replace(/\.(?=[eE]|$)/, '');
        el.value = value;
        if (value !== '' && el.value === '') throw new Error('数值不能写入当前输入框。');
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function restore(before) {
        for (const field of before) writeField(field, field.original);
    }

    function apply() {
        if (!snapshot || !$('#ack').checked) return;
        if (pageStamp() !== snapshot.stamp) {
            clearPreview();
            setStatus('实验页的数据、方法或表格已改变，请重新识别，避免覆盖你刚修改的数据。', true);
            return;
        }
        const chosen = previewRows.filter(row => row.check.checked);
        const prepared = chosen.map(row => ({ ...row, value: numeric(row.input.value, row.field.kind) }));
        if (!prepared.length || prepared.some(row => row.value === null)) { setStatus('请先修正选中字段的数值。', true); return; }
        let countField = null, countValue = null;
        if (location.pathname.endsWith('/least_squares.html')) {
            const lists = prepared.filter(row => row.field.kind === 'list');
            if (lists.length) {
                const lengths = lists.map(row => row.value.split(' ').length);
                if (new Set(lengths).size > 1) { setStatus('x、y 的数据个数不同，请补齐原始数据或取消填入。', true); return; }
                const visibleLists = snapshot.fields.filter(field => field.kind === 'list');
                countField = document.getElementById('data-count');
                countValue = String(lengths[0]);
                if (visibleLists.length !== lists.length && countField.value !== countValue) {
                    setStatus('仅导入一列且数据个数发生变化，请同时核对并导入另一列，避免截断或补 0。', true); return;
                }
            }
        }
        const before = snapshot.before;
        if (countField) before.push({ path: '#data-count', original: countField.value });
        try {
            // 按页面顺序逐项写入并触发正常编辑事件，保持页面的数据模型同步。
            const byOrder = new Map(snapshot.fields.map((field, i) => [field.id, i]));
            prepared.sort((a, b) => byOrder.get(a.field.id) - byOrder.get(b.field.id));
            for (const row of prepared) writeField(row.field, row.value);
            if (countField) writeField({ path: '#data-count' }, countValue);
            undoRecord = { before, after: pageStamp() };
            $('#undo').hidden = false;
            clearPreview();
            setStatus(`已填入 ${prepared.length} 个字段${countField ? '，数据个数 n 已同步为 ' + countValue : ''}。请检查原表格后，使用页面原有按钮计算。`);
            dialog.close();
        } catch (_) {
            try { restore(before); } catch (_) { /* 页面结构变化时不继续覆盖其他位置。 */ }
            clearPreview();
            setStatus('填入时表格发生变化，已尝试恢复原值，请检查数据后重新识别。', true);
        }
    }

    $('#open').addEventListener('click', () => {
        fields = collectFields();
        const oldArea = $('#area').value;
        $('#area').replaceChildren();
        const all = new Option('当前页面全部可填写数据（' + fields.length + ' 个输入框）', 'all');
        $('#area').append(all);
        for (const section of new Set(fields.map(field => field.section))) {
            $('#area').append(new Option(section + '（' + fields.filter(f => f.section === section).length + ' 个）', section));
        }
        if ([...$('#area').options].some(option => option.value === oldArea)) $('#area').value = oldArea;
        if (snapshot && snapshot.stamp !== pageStamp()) clearPreview();
        dialog.showModal();
        if (!timer) timer = setInterval(updateButtons, 1000);
        if (!fields.length) setStatus('当前方法没有可填写的数字输入框，请先切换实验方法。', true);
        else if (!busy) checkService();
        updateButtons();
    });
    $('#close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
    dialog.addEventListener('close', () => { if (timer) clearInterval(timer); timer = null; resetDrag(); $('#open').focus(); });
    $('#choose').addEventListener('click', () => $('#file').click());
    $('#file').addEventListener('change', () => { if ($('#file').files.length) selectFiles($('#file').files); });
    dropZone.addEventListener('dragenter', event => {
        event.preventDefault();
        if (isFileDrag(event) && !busy && !preparing) {
            dragDepth++;
            dropZone.classList.add('drag-over');
        }
    });
    dropZone.addEventListener('dragover', event => {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = isFileDrag(event) && !busy && !preparing ? 'copy' : 'none';
    });
    dropZone.addEventListener('dragleave', () => {
        dragDepth = Math.max(0, dragDepth - 1);
        if (!dragDepth) dropZone.classList.remove('drag-over');
    });
    dropZone.addEventListener('drop', event => {
        event.preventDefault();
        event.stopPropagation();
        resetDrag();
        selectFiles(event.dataTransfer?.files);
    });
    // 弹窗打开时，误拖到上传区域外也不能让浏览器直接打开文件、丢失表格数据。
    for (const type of ['dragover', 'drop']) document.addEventListener(type, event => {
        if (!dialog.open || !isFileDrag(event)) return;
        event.preventDefault();
        if (type === 'drop') {
            resetDrag();
            setStatus('请把图片拖入虚线框中的上传区域。', true);
        }
    });
    window.addEventListener('dragend', resetDrag);
    $('#area').addEventListener('change', clearPreview);
    $('#recognize').addEventListener('click', recognize);
    $('#ack').addEventListener('change', updateButtons);
    $('#apply').addEventListener('click', apply);
    $('#undo').addEventListener('click', () => {
        if (!undoRecord) return;
        if (pageStamp() !== undoRecord.after) { setStatus('填入后页面已有其他修改，不能直接撤销，以免覆盖后续数据。', true); return; }
        try {
            restore(undoRecord.before);
            undoRecord = null;
            $('#undo').hidden = true;
            clearPreview();
            setStatus('已恢复填入前的数据。');
        } catch (_) { setStatus('表格结构发生变化，请手动核对需要恢复的数据。', true); }
    });
    try { const stored = Number(localStorage.getItem(storageKey)); if (stored > Date.now() && stored < Date.now() + 3600000) deadline = stored; } catch (_) { /* 服务器仍会限频。 */ }
    window.addEventListener('storage', event => { if (event.key === storageKey) { deadline = Math.max(deadline, Number(event.newValue) || 0); updateButtons(); } });
})();
