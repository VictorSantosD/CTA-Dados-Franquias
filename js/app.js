'use strict';
const $ = id => document.getElementById(id);
const fields = ['NomeUnidadeFranqueador', 'NomeUnidade', 'TelefoneComercial1', 'TelefoneComercial1 ajustado', 'Concatena', 'LinkWhatsApp', 'Cep', 'Endereco', 'Complemento', 'Bairro', 'Municipio', 'UF', 'TelefoneComercial2', 'TelefoneComercial3', 'EmailComercial', 'WebsiteCorporativo'];
const str = v => v == null ? '' : String(v).trim();
const norm = v => str(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const digs = v => str(v).replace(/\D/g, '');
const esc = v => str(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const digitsLink = v => { try {
    let u = new URL(str(v));
    if (u.protocol !== 'https:' || u.hostname !== 'wa.me' || u.username || u.password || u.port)
        return '';
    return /^\/([1-9]\d{6,14})\/?$/.exec(u.pathname)?.[1] || '';
}
catch {
    return '';
} };
function validBR(p) { return /^55[1-9][0-9](?:[2-5][0-9]{7}|9[0-9]{8})$/.test(p); }
function phone(v) { let d = digs(v); if (d.length === 10 || d.length === 11)
    return '55' + d; if (d.length >= 12 && d.length <= 15)
    return d; return ''; }
function pretty(v) { const d = digs(v); if (d.length === 10 || d.length === 11)
    return `(${d.slice(0, 2)}) ${d.slice(2, -4)}-${d.slice(-4)}`; return d.length >= 7 ? str(v) : ''; }
function site(v) { let t = str(v); if (!t)
    return ''; try {
    let u = new URL(/^[a-z]+:/i.test(t) ? t : 'https://' + t);
    return ['https:', 'http:'].includes(u.protocol) && u.hostname.includes('.') && !u.username && !u.password ? u.href : '';
}
catch {
    return '';
} }
function linkState(r) { let p = digitsLink(r.LinkWhatsApp); if (!str(r.LinkWhatsApp))
    return { kind: 'bad', label: 'Sem link', p: '' }; if (!p || r.UF && !validBR(p) || p.startsWith('55') && !validBR(p))
    return { kind: 'bad', label: 'Link incompleto ou formato inválido', p: '' }; let t = phone(r.TelefoneComercial1); if (t && t !== p)
    return { kind: 'warn', label: 'Diferente do telefone cadastrado', p }; return { kind: 'ok', label: 'Formato válido', p }; }
let records = [], selected = null, page = 0, imported = false, sourceName = 'Planilha fornecida · versão original', duplicates = new Map(), audit = {};
const pageSize = 9, storageKey = 'ccaa-local-whatsapp-audit-v2';
// A conferência é por unidade e pelo link cadastrado, nunca pelo número compartilhado.
function auditKey(r) { return JSON.stringify([r.NomeUnidadeFranqueador, r.NomeUnidade, r.Municipio, r.UF, r.Endereco, r.LinkWhatsApp, r.auditOccurrence]); }
// Permite testar até links wa.me incompletos, sem abrir endereços de outros sites.
function testUrl(r) { try { const u = new URL(r.LinkWhatsApp); return ['https:', 'http:'].includes(u.protocol) && ['wa.me','api.whatsapp.com','web.whatsapp.com','whatsapp.com','www.whatsapp.com'].includes(u.hostname) && !u.username && !u.password && !u.port ? u.href : ''; } catch { return ''; } }
try {
    audit = JSON.parse(localStorage.getItem(storageKey) || '{}') || {};
}
catch { }
if (typeof audit !== 'object' || Array.isArray(audit))
    audit = {};
function getAudit(r) { return audit[auditKey(r)] || null; }
function setAudit(r, status) { if (!r) return; const key = auditKey(r); if (status === 'pending')
    delete audit[key];
else
    audit[key] = { status, date: new Date().toISOString() }; try {
    localStorage.setItem(storageKey, JSON.stringify(audit));
}
catch {
    toast('Resultado salvo apenas nesta sessão. Exporte o relatório.');
} render(); }
function setBase(rows, name) { records = rows.filter(r => str(r.NomeUnidadeFranqueador) && str(r.NomeUnidade)).map((r, i) => { let a = {}; for (let f of fields)
    a[f] = str(r[f]); a.id = i; a.link = linkState(a); a.search = norm([a.NomeUnidade, a.NomeUnidadeFranqueador, a.Municipio, a.Bairro, a.Endereco, a.UF, a.Cep, a.TelefoneComercial1, a['TelefoneComercial1 ajustado'], a.TelefoneComercial2, a.TelefoneComercial3, a.LinkWhatsApp, a.EmailComercial].join(' ')); a.phones = digs(a.TelefoneComercial1) + ' ' + digs(a.TelefoneComercial2) + ' ' + digs(a.TelefoneComercial3) + ' ' + a.link.p; return a; }).sort((a, b) => a.NomeUnidade.localeCompare(b.NomeUnidade, 'pt-BR')); const occurrences = new Map(); for (const r of records) { const k = auditKey(r); r.auditOccurrence = (occurrences.get(k) || 0) + 1; occurrences.set(k, r.auditOccurrence); } duplicates = new Map(); for (let r of records)
    if (r.link.p)
        duplicates.set(r.link.p, (duplicates.get(r.link.p) || 0) + 1); sourceName = name; page = 0; selected = null; $('query').value = ''; $('filter').value = 'all'; $('uf').innerHTML = '<option value="all">Todos os estados</option>' + [...new Set(records.map(r => r.UF).filter(Boolean))].sort().map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('') + '<option value="none">Sem UF / exterior</option>'; render(); }
function filtered() { const q = norm($('query').value), n = digs(q), uf = $('uf').value, f = $('filter').value; return records.filter(r => { if (uf !== 'all' && (uf === 'none' ? !!r.UF : r.UF !== uf))
    return false; if (q && !q.split(/\s+/).every(t => r.search.includes(t)) && !(n.length >= 3 && /^[\d\s()+.-]+$/.test(q) && r.phones.includes(n)))
    return false; let a = getAudit(r); return f === 'all' || f === 'valid' && r.link.kind === 'ok' || f === 'review' && r.link.kind !== 'ok' || f === 'pending' && !a || f === 'confirmed' && a?.status === 'confirmed' || f === 'failed' && a?.status === 'failed'; }); }
function render() { let list = filtered(), pages = Math.max(1, Math.ceil(list.length / pageSize)); page = Math.min(Math.max(page, 0), pages - 1); let slice = list.slice(page * pageSize, (page + 1) * pageSize); if (!slice.some(r => r.id === selected))
    selected = slice[0]?.id ?? null; let valid = records.filter(r => r.link.kind === 'ok').length, review = records.length - valid, confirmed = records.filter(r => getAudit(r)?.status === 'confirmed').length; $('source').textContent = sourceName + ' • ' + records.length + ' registros'; $('stats').innerHTML = [['all', 'Registros da base', records.length], ['valid', 'Formato válido', valid], ['review', 'Requer revisão', review], ['confirmed', 'Conversa abriu', confirmed], ['failed', 'Não abriu · atualizar', records.filter(r => getAudit(r)?.status === 'failed').length]].map(([k, t, n]) => `<button class="stat ${$('filter').value === k ? 'active' : ''}" data-filter="${k}" aria-pressed="${$('filter').value === k}"><small>${t}</small><strong>${n.toLocaleString('pt-BR')}</strong></button>`).join(''); $('count').textContent = list.length + ' resultado' + (list.length === 1 ? '' : 's'); $('page').textContent = `${page + 1} / ${pages}`; $('prev').disabled = page === 0; $('next').disabled = page >= pages - 1; $('results').innerHTML = slice.length ? slice.map(r => `<button class="result ${r.id === selected ? 'selected' : ''}" data-id="${r.id}" aria-pressed="${r.id === selected}"><div class="rtext"><strong>${esc(r.NomeUnidade)}</strong><small>${esc([r.Municipio, r.UF].filter(Boolean).join(' · ') || 'Localidade não cadastrada')}</small>${getAudit(r)?.status === 'failed' ? '<span class="result-flag">Não abriu · atualizar</span>' : getAudit(r)?.status === 'confirmed' ? '<span class="result-confirmed">Conversa abriu</span>' : ''}</div><span class="dot ${getAudit(r)?.status === 'failed' ? 'bad' : getAudit(r)?.status === 'confirmed' ? 'ok' : r.link.kind}" title="${esc(getAudit(r)?.status === 'failed' ? 'Não abriu — atualizar' : getAudit(r)?.status === 'confirmed' ? 'Conversa abriu' : r.link.label)}"></span><span class="arrow" aria-hidden="true">›</span></button>`).join('') : '<div class="empty">Nenhuma unidade encontrada.<br>Tente outro termo ou filtro.</div>'; renderDetail(records.find(r => r.id === selected)); }
function field(label, val, wide = false, url = '') { let v = str(val); return `<div class="field ${wide ? 'wide' : ''}"><label>${esc(label)}</label><div class="value">${v ? (url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(v)}</a>` : `<span>${esc(v)}</span>`) + `<button class="copy" data-copy="${esc(v)}" aria-label="Copiar ${esc(label)}">Copiar</button>` : '<span class="missing">Não informado</span>'}</div></div>`; }
// Texto padrão de atendimento: edite aqui para mudar a mensagem de todas as unidades.
function buildMessage(r) {
    return `Perfeito! A equipe da unidade ${r.NomeUnidade} já entrará em contato com mais informações sobre valores e horários. 😊\n\nSe preferir, você também pode falar diretamente com eles pelo WhatsApp: ${r.LinkWhatsApp}`;
}
function renderMessage(r) {
    const a = getAudit(r);
    const warning = a?.status === 'failed'
        ? 'Marcada para atualização: o link cadastrado foi mantido na mensagem.'
        : !r.LinkWhatsApp ? 'Não há link cadastrado na base. Marque para atualização.'
        : r.link.kind !== 'ok' ? 'Confira manualmente: ' + r.link.label + '. O link original foi mantido.'
        : a?.status !== 'confirmed' ? 'Link ainda não conferido manualmente.' : '';
    return `<div class="message-section">
    <div class="message-title"><h3><label for="readyMessage">Mensagem pronta</label></h3><button class="btn primary" id="copyMessage" type="button">Copiar mensagem</button></div>
    <textarea class="message-text" id="readyMessage" readonly>${esc(buildMessage(r))}</textarea>
    ${warning ? `<p class="message-note ${r.link.kind !== 'ok' || a?.status === 'failed' ? 'warn' : ''}">${esc(warning)}</p>` : ''}
  </div>`;
}
function renderDetail(r) { if (!r) {
    $('detail').innerHTML = '<div class="empty emptylarge">Selecione uma unidade para consultar seus dados.</div>';
    return;
} let a = getAudit(r), n = duplicates.get(r.link.p) || 0, t = phone(r.TelefoneComercial1), em = r.EmailComercial, emLink = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em) ? 'mailto:' + em : '', web = site(r.WebsiteCorporativo), w = testUrl(r), addr = [r.Endereco, r.Complemento, r.Bairro, r.Municipio, r.UF].filter(Boolean).join(', '), cep = digs(r.Cep), date = a?.date ? new Date(a.date).toLocaleString('pt-BR') : ''; let info = a?.status === 'confirmed' ? 'Conversa abriu' : a?.status === 'failed' ? 'Não abriu' : 'Pendente de conferência'; $('detail').innerHTML = `<div class="detailhead"><span class="pill">${esc(r.UF || 'Sem UF / exterior')}</span><h2>${esc(r.NomeUnidade)}</h2><p>${esc(r.NomeUnidadeFranqueador)}</p><div class="actions">${w ? `<a class="btn whatsapp" href="${esc(w)}" target="_blank" rel="noopener noreferrer">↗ Abrir WhatsApp</a>` : '<button class="btn" disabled>WhatsApp indisponível</button>'}${t ? `<a class="btn" href="tel:+${t}">Ligar</a>` : ''}${emLink ? `<a class="btn" href="${esc(emLink)}">Enviar e-mail</a>` : ''}</div><button class="btn mobileback" id="back">↑ Voltar à pesquisa</button></div><div class="bodydetail">${renderMessage(r)}<div class="section"><h3>Contato</h3><div class="fields">${field('Telefone principal', pretty(r.TelefoneComercial1) || pretty(r['TelefoneComercial1 ajustado']))}${field('Telefone adicional 1', pretty(r.TelefoneComercial2))}${field('Telefone adicional 2', pretty(r.TelefoneComercial3))}${field('E-mail', em)}${field('Site', r.WebsiteCorporativo, true, web)}</div></div><div class="section"><h3>Endereço</h3><div class="fields">${field('Logradouro', r.Endereco, true)}${field('Complemento', r.Complemento)}${field('Bairro', r.Bairro)}${field('Município', r.Municipio)}${field('Estado', r.UF)}${field('CEP', cep.length === 8 ? cep.slice(0, 5) + '-' + cep.slice(5) : r.Cep)}</div>${addr ? `<div class="actions"><a class="btn" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}" target="_blank" rel="noopener noreferrer">Ver endereço no mapa ↗</a><button class="btn" data-copy="${esc(addr)}">Copiar endereço</button></div>` : ''}</div><div class="section audit"><h3>Conferência do WhatsApp</h3><span class="pill ${r.link.kind}">${esc(r.link.label)}</span>${n > 1 ? ` <span class="pill warn">Compartilhado por ${n} registros</span>` : ''}<div class="fields" style="margin-top:13px">${field('Link cadastrado', r.LinkWhatsApp, true, w)}</div><p>Abra o link e confirme manualmente se a conversa carrega. Nenhuma mensagem é enviada por esta página. O formato válido não confirma a existência da conta.</p><div class="audit-status ${a?.status === 'failed' ? 'failed' : ''}">${esc(info)}${a?.status === 'failed' ? ' — atualizar dados da unidade' : ''}${date ? ' • ' + esc(date) : ''}</div><div class="actions"><button class="btn whatsapp" data-audit="confirmed" ${w ? '' : 'disabled'}>✓ Abriu</button><button class="btn fail-btn" data-audit="failed">× Não abriu</button><button class="btn" data-audit="pending" ${a ? '' : 'disabled'}>Limpar</button></div><p>O resultado fica salvo neste navegador, por unidade e link. Não sincroniza com outros atendentes. Exporte as pendências para enviar ao responsável pela atualização.</p></div></div>`; }
let toastTimer;
function toast(msg) { $('toast').textContent = msg; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3200); }
async function copy(v) { try {
    await navigator.clipboard.writeText(v);
    toast('Copiado!');
}
catch {
    let ta = document.createElement('textarea');
    ta.value = v;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    let ok = document.execCommand('copy');
    ta.remove();
    toast(ok ? 'Copiado!' : 'Não foi possível copiar automaticamente.');
} }
$('query').addEventListener('input', () => { page = 0; render(); });
$('clear').onclick = () => { $('query').value = ''; page = 0; render(); $('query').focus(); };
for (let id of ['uf', 'filter'])
    $(id).onchange = () => { page = 0; render(); };
$('stats').onclick = e => { let b = e.target.closest('[data-filter]'); if (b) {
    $('filter').value = b.dataset.filter;
    page = 0;
    render();
} };
$('prev').onclick = () => { page--; render(); };
$('next').onclick = () => { page++; render(); };
$('results').onclick = e => { let b = e.target.closest('[data-id]'); if (b) {
    selected = Number(b.dataset.id);
    render();
    if (matchMedia('(max-width:640px)').matches)
        $('detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
} };
$('detail').onclick = e => { let b = e.target.closest('button'); if (!b)
    return; if (b.id === 'copyMessage') {
    copy($('readyMessage').value);
    return;
} if (b.dataset.copy !== undefined)
    copy(b.dataset.copy); if (b.dataset.audit)
    setAudit(records.find(r => r.id === selected), b.dataset.audit); if (b.id === 'back')
    $('searchpanel').scrollIntoView({ behavior: 'smooth' }); };
function exportCsv(onlyFailed = false) { let heads = ['NomeUnidadeFranqueador', 'NomeUnidade', 'Municipio', 'UF', 'TelefoneComercial1', 'LinkWhatsApp', 'ValidacaoFormato', 'RegistrosMesmoNumero', 'ConferenciaManual', 'DataConferencia']; let protectedCell = v => { let s = str(v); if (/^[=+\-@\t\r]/.test(s))
    s = "'" + s; return '"' + s.replaceAll('"', '""') + '"'; }; let csv = [heads, ...records.filter(r => !onlyFailed || getAudit(r)?.status === 'failed').map(r => [r.NomeUnidadeFranqueador, r.NomeUnidade, r.Municipio, r.UF, r.TelefoneComercial1, r.LinkWhatsApp, r.link.label, duplicates.get(r.link.p) || 0, getAudit(r)?.status === 'confirmed' ? 'Conversa abriu' : getAudit(r)?.status === 'failed' ? 'Não abriu' : 'Pendente', getAudit(r)?.date || ''])].map(row => row.map(protectedCell).join(';')).join('\r\n'); let u = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })); let a = document.createElement('a'); a.href = u; a.download = (onlyFailed ? 'pendencias_whatsapp_' : 'conferencia_whatsapp_') + new Date().toISOString().slice(0, 10) + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); toast('Relatório exportado.'); }
$('exportBtn').onclick = () => exportCsv(false);
$('exportFailedBtn').onclick = () => exportCsv(true);
// Leitor local de XLSX (ZIP + XML OOXML). Não envia arquivos à rede.
const decode = new TextDecoder();
const xml = s => { let d = new DOMParser().parseFromString(s, 'application/xml'); if (d.getElementsByTagName('parsererror').length)
    throw Error('XML inválido na planilha.'); return d; };
const tags = (d, t) => Array.from(d.getElementsByTagNameNS('*', t));
const first = (d, t) => tags(d, t)[0];
const attr = (d, t) => d?.getAttribute(t) || '';
const rid = d => d.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || d.getAttribute('r:id');
function resolve(base, target) { if (target.startsWith('/'))
    return target.slice(1); let a = base.split('/'); a.pop(); for (let p of target.split('/')) {
    if (p === '..')
        a.pop();
    else if (p !== '.' && p)
        a.push(p);
} return a.join('/'); }
function relpath(p) { let a = p.split('/'), f = a.pop(); return [...a, '_rels', f + '.rels'].join('/'); }
function col(s) { let n = 0; for (let c of s.replace(/[^A-Z]/gi, '').toUpperCase())
    n = n * 26 + c.charCodeAt(0) - 64; return n - 1; }
async function readXlsx(file) {
    if (file.size > 50 * 1024 * 1024)
        throw Error('Arquivo maior que 50 MB.');
    let b = await file.arrayBuffer(), v = new DataView(b), bytes = new Uint8Array(b), end = -1;
    let u16 = p => v.getUint16(p, true), u32 = p => v.getUint32(p, true);
    for (let p = b.byteLength - 22; p >= Math.max(0, b.byteLength - 65557); p--) {
        if (u32(p) === 0x06054b50 && p + 22 + u16(p + 20) === b.byteLength) {
            end = p;
            break;
        }
    }
    if (end < 0)
        throw Error('Arquivo não é um XLSX válido.');
    let entries = new Map(), p = u32(end + 16), count = u16(end + 10);
    for (let i = 0; i < count; i++) {
        if (u32(p) !== 0x02014b50)
            throw Error('Estrutura ZIP inválida.');
        let n = u16(p + 28), extra = u16(p + 30), c = u16(p + 32), key = decode.decode(bytes.subarray(p + 46, p + 46 + n));
        entries.set(key, { method: u16(p + 10), size: u32(p + 20), uncompressed: u32(p + 24), off: u32(p + 42) });
        p += 46 + n + extra + c;
    }
    let cache = new Map();
    async function get(path) { if (cache.has(path))
        return cache.get(path); let e = entries.get(path); if (!e)
        throw Error('Arquivo interno ausente: ' + path); if (e.uncompressed > 80 * 1024 * 1024)
        throw Error('Planilha grande demais.'); if (u32(e.off) !== 0x04034b50)
        throw Error('ZIP inválido.'); let start = e.off + 30 + u16(e.off + 26) + u16(e.off + 28), data = bytes.subarray(start, start + e.size), out; if (e.method === 0)
        out = data;
    else if (e.method === 8) {
        if (typeof DecompressionStream === 'undefined')
            throw Error('Use uma versão atual do Chrome ou Edge.');
        out = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    }
    else
        throw Error('Compactação não suportada.'); let s = decode.decode(out); cache.set(path, s); return s; }
    let wp = 'xl/workbook.xml', wb = xml(await get(wp)), wr = xml(await get(relpath(wp))), rels = new Map(tags(wr, 'Relationship').map(x => [attr(x, 'Id'), attr(x, 'Target')]));
    let ss = [];
    let shared = tags(wr, 'Relationship').find(x => attr(x, 'Type').endsWith('/sharedStrings'));
    if (shared)
        ss = tags(xml(await get(resolve(wp, attr(shared, 'Target')))), 'si').map(si => tags(si, 't').map(t => t.textContent).join(''));
    let selectedTable = null, sheetDoc = null;
    for (let sh of tags(wb, 'sheet')) {
        let target = rels.get(rid(sh));
        if (!target)
            continue;
        let path = resolve(wp, target), rp = relpath(path);
        if (!entries.has(rp))
            continue;
        let sr = xml(await get(rp));
        for (let t of tags(sr, 'Relationship').filter(x => attr(x, 'Type').endsWith('/table'))) {
            let td = first(xml(await get(resolve(path, attr(t, 'Target')))), 'table');
            if (norm(attr(td, 'name')) === 'tb_dados' || norm(attr(td, 'displayName')) === 'tb_dados') {
                selectedTable = td;
                sheetDoc = xml(await get(path));
                break;
            }
        }
        if (selectedTable)
            break;
    }
    if (!selectedTable)
        throw Error('A tabela TB_Dados não foi encontrada no Excel.');
    let ref = attr(selectedTable, 'ref'), m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(ref);
    if (!m)
        throw Error('Intervalo da tabela inválido.');
    let startCol = col(m[1]), endCol = col(m[3]), startRow = +m[2] + 1, endRow = +m[4] - (Number(attr(selectedTable, 'totalsRowCount')) || 0);
    let names = tags(selectedTable, 'tableColumn').map(x => attr(x, 'name'));
    let keyMap = names.map(n => fields.find(f => norm(f) === norm(n)));
    for (let f of ['NomeUnidadeFranqueador', 'NomeUnidade', 'TelefoneComercial1', 'LinkWhatsApp'])
        if (!keyMap.includes(f))
            throw Error('Coluna obrigatória ausente: ' + f);
    let rows = [];
    for (let rn of tags(sheetDoc, 'row')) {
        let rownum = +attr(rn, 'r');
        if (rownum < startRow || rownum > endRow)
            continue;
        let r = {};
        for (let c of tags(rn, 'c')) {
            let ci = col(attr(c, 'r'));
            if (ci < startCol || ci > endCol)
                continue;
            let f = keyMap[ci - startCol];
            if (!f)
                continue;
            let t = attr(c, 't'), raw = first(c, 'v')?.textContent || '';
            r[f] = t === 's' ? (ss[Number(raw)] || '') : t === 'inlineStr' ? tags(c, 't').map(x => x.textContent).join('') : t === 'e' ? '' : raw;
            if (f === 'LinkWhatsApp' && !r[f] && first(c, 'f'))
                r._missingFormula = true;
        }
        if (r._missingFormula) {
            let n = phone(r.TelefoneComercial1);
            if (n && n.startsWith('55'))
                r.LinkWhatsApp = 'https://wa.me/' + n;
        }
        if (str(r.NomeUnidadeFranqueador) && str(r.NomeUnidade))
            rows.push(r);
    }
    if (!rows.length)
        throw Error('A tabela não contém unidades.');
    return rows;
}
$('importBtn').onclick = () => $('file').click();
$('file').onchange = async () => { let f = $('file').files[0]; if (!f)
    return; $('notice').textContent = 'Lendo a tabela TB_Dados…'; $('importBtn').disabled = true; try {
    let r = await readXlsx(f);
    setBase(r, f.name + ' · importada nesta sessão');
    $('notice').textContent = 'Base atualizada: ' + r.length + ' registros. O Excel original não foi alterado. A importação usa valores salvos na planilha; mantenha as fórmulas recalculadas.';
    imported = true;
}
catch (e) {
    $('notice').textContent = 'Não foi possível importar. ' + e.message + ' A base anterior foi preservada.';
}
finally {
    $('file').value = '';
    $('importBtn').disabled = false;
} };
setBase(window.CCAA_INITIAL_DATA, sourceName);
