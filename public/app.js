const homeView = document.querySelector('#homeView');
const resultView = document.querySelector('#resultView');
const trainingView = document.querySelector('#trainingView');
const growthView = document.querySelector('#growthView');
const form = document.querySelector('#analyzeForm');
const resultContent = document.querySelector('#resultContent');
const trainingContent = document.querySelector('#trainingContent');
const growthContent = document.querySelector('#growthContent');
const toast = document.querySelector('#toast');
let latest = JSON.parse(localStorage.getItem('careerAgentLatest') || 'null');
let latestMode = localStorage.getItem('careerAgentMode') || 'demo';
let records = JSON.parse(localStorage.getItem('careerAgentRecords') || '[]');

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const list = (items, empty = '暂无信息') => items?.length ? `<ul class="list">${items.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>` : `<p>${empty}</p>`;
const chips = (items, color = '') => items?.length ? `<div class="chips">${items.map((item) => `<span class="chip ${color}">${esc(item)}</span>`).join('')}</div>` : '<p>暂无信息</p>';
function showToast(message) { toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3500); }
function saveState() { localStorage.setItem('careerAgentLatest', JSON.stringify(latest)); localStorage.setItem('careerAgentMode', latestMode); localStorage.setItem('careerAgentRecords', JSON.stringify(records)); }
function showView(id) { [homeView, resultView, trainingView, growthView].forEach((view) => view.classList.toggle('hidden', view.id !== id)); if (id === 'trainingView') renderTraining(); if (id === 'growthView') renderGrowth(); window.scrollTo({ top: 0, behavior: 'smooth' }); }

function render(data, mode) {
  latest = data; latestMode = mode; saveState();
  const p = data.jobProfile, b = data.abilityBreakdown, m = data.match;
  const matchDetails = data.matchDetails?.length ? `<div class="match-details">${data.matchDetails.map((item) => { const statusText = { ready: '已具备', partial: '部分具备', missing: '暂时缺少' }[item.status] || '暂时缺少'; const statusClass = { ready: 'green', partial: 'yellow', missing: '' }[item.status] || ''; return `<div class="match-row"><div><strong>${esc(item.ability)}</strong><p>${esc(item.evidence || '暂无具体依据')}</p></div><span class="chip ${statusClass}">${statusText}</span></div>`; }).join('')}</div>` : '';
  const priorities = data.priorities?.length ? data.priorities.map((item, i) => `<div class="priority"><h4>${i + 1}. ${esc(item.title)}</h4><p><strong>为什么重要：</strong>${esc(item.whyImportant)}</p><p><strong>为什么现在优先：</strong>${esc(item.whyNow)}</p><p><strong>我需要补什么：</strong>${esc(item.learn)}</p><p><strong>基本掌握标准：</strong>${esc(item.target)}</p></div>`).join('') : '<p>目前缺少足够信息，请补充你的经历后再分析。</p>';
  resultContent.innerHTML = `<div class="result-grid"><article class="section-card wide"><div class="section-label">01 / 岗位画像</div><div class="job-title">${esc(p.title)}</div><h4>核心职责</h4>${list(p.responsibilities)}<h4>核心能力</h4>${chips(p.abilities)}</article><article class="section-card wide"><div class="section-label">02 / JD 能力拆解</div><div class="ability-columns"><div class="ability-column"><h4>必须具备</h4>${chips(b.mustHave, 'yellow')}</div><div class="ability-column"><h4>加分项</h4>${chips(b.bonus, 'green')}</div><div class="ability-column"><h4>可以后学</h4>${chips(b.learnLater)}</div></div></article><article class="section-card wide"><div class="section-label">03 / 我的匹配情况</div><h4>已具备</h4>${chips(m.ready, 'green')}<h4>部分具备</h4>${chips(m.partial, 'yellow')}<h4>暂时缺少</h4>${chips(m.missing)}${matchDetails}</article><article class="section-card wide"><div class="section-label">04 / 最优先提升的 3 件事</div>${priorities}</article><article class="section-card wide task-card"><div class="section-label">05 / 今日任务</div><h3>${esc(data.todayTask.title)}</h3><p>${esc(data.todayTask.why)}</p>${list(data.todayTask.steps)}<div class="task-standard"><strong>完成标准：</strong>${esc(data.todayTask.standard)}</div><button class="secondary-action" id="startTrainingButton">开始今日训练 <span>→</span></button></article><article class="section-card wide"><div class="section-label">06 / 下一步</div><p>${esc(data.nextStep)}</p></article></div>`;
  document.querySelector('#modeBadge').textContent = mode === 'ai' ? 'AI 模式' : '演示模式'; document.querySelector('#resultTitle').textContent = p.title === '未识别岗位' ? '岗位拆解结果' : `${p.title} · 拆解结果`; document.querySelector('#startTrainingButton').addEventListener('click', () => showView('trainingView')); showView('resultView');
}

function renderTraining() {
  if (!latest) { trainingContent.innerHTML = '<article class="section-card"><h3>还没有训练任务</h3><p>先完成一次岗位分析，系统才能为你生成今日训练。</p><button class="secondary-action" data-view="homeView">去做岗位分析 →</button></article>'; return; }
  trainingContent.innerHTML = `<article class="section-card training-card"><div class="section-label">TODAY / 只做这一件事</div><h3>${esc(latest.todayTask.title)}</h3><h4>今日训练目标</h4><p>${esc(latest.todayTask.why)}</p><h4>训练任务</h4>${list(latest.todayTask.steps)}<h4>完成要求</h4><div class="task-standard light-standard">${esc(latest.todayTask.standard)}</div><form id="trainingForm" class="feedback-form light-form"><div class="submission-label"><label for="trainingSubmission">提交你的练习结果</label><div class="submission-actions"><button type="button" class="paste-button" id="pasteTableButton">粘贴表格</button><button type="button" class="paste-button" id="chooseWorkbookButton">选择 Excel 文件</button><input id="workbookFile" type="file" accept=".xlsx" hidden></div></div><textarea id="trainingSubmission" required minlength="5" placeholder="粘贴你的产出，或选择 Excel 文件导入工作表……"></textarea><p class="paste-hint" id="importHint">可以直接粘贴单元格，也可以选择 .xlsx 文件导入。</p><button class="primary-button" type="submit"><span>提交训练</span><b>→</b></button></form><div id="feedbackResult" class="feedback-result hidden"></div></article>`;
  document.querySelector('#trainingForm').addEventListener('submit', submitTraining);
  const submission = document.querySelector('#trainingSubmission');
  submission.addEventListener('paste', handlePaste);
  document.querySelector('#pasteTableButton').addEventListener('click', pasteFromClipboard);
  const workbookInput = document.querySelector('#workbookFile');
  document.querySelector('#chooseWorkbookButton').addEventListener('click', () => workbookInput.click());
  workbookInput.addEventListener('change', importWorkbook);
}

async function importWorkbook(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!window.ExcelJS) { showToast('Excel 读取组件未加载，请刷新网页重试'); return; }
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sections = workbook.worksheets.map((sheet) => {
      const rows = [];
      sheet.eachRow({ includeEmpty: false }, (row) => rows.push(row.values.slice(1)));
      const content = rows.map((row) => row.map((cell) => {
        const value = cell && typeof cell === 'object' ? (cell.text ?? cell.result ?? cell.hyperlink ?? '') : cell;
        return String(value ?? '').replace(/[\t\r\n]+/g, ' ').trim();
      }).join('\t')).filter((row) => row.replace(/\t/g, '').trim()).join('\n');
      return content ? `【工作表：${sheet.name}】\n${content}` : '';
    }).filter(Boolean);
    if (!sections.length) { showToast('这个文件里没有可读取的单元格内容'); return; }
    const field = document.querySelector('#trainingSubmission');
    const imported = sections.join('\n\n');
    field.value = field.value.trim() ? `${field.value.trim()}\n\n${imported}` : imported;
    document.querySelector('#importHint').textContent = `已从「${file.name}」导入 ${sections.length} 个工作表，可在下方检查和编辑。`;
    field.focus();
  } catch (error) {
    showToast('读取 Excel 失败，请确认文件未损坏后重试');
  } finally {
    event.target.value = '';
  }
}

function tableHtmlToText(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const rows = [...doc.querySelectorAll('tr')].map((row) => [...row.querySelectorAll('th,td')].map((cell) => cell.innerText.replace(/\s+/g, ' ').trim()).join('\t'));
  return rows.filter(Boolean).join('\n');
}

function handlePaste(event) {
  const html = event.clipboardData?.getData('text/html') || '';
  if (!html || !/<table[\s>]/i.test(html)) return;
  const tableText = tableHtmlToText(html);
  if (!tableText) return;
  event.preventDefault();
  const field = event.target;
  const start = field.selectionStart ?? field.value.length;
  const end = field.selectionEnd ?? field.value.length;
  field.value = `${field.value.slice(0, start)}${tableText}${field.value.slice(end)}`;
  field.selectionStart = field.selectionEnd = start + tableText.length;
}

async function pasteFromClipboard() {
  const field = document.querySelector('#trainingSubmission');
  try {
    if (navigator.clipboard?.read) {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        if (item.types.includes('text/html')) {
          const blob = await item.getType('text/html');
          const tableText = tableHtmlToText(await blob.text());
          if (tableText) { field.value = field.value ? `${field.value}\n${tableText}` : tableText; field.focus(); return; }
        }
      }
    }
    const text = await navigator.clipboard.readText();
    if (text) { field.value = field.value ? `${field.value}\n${text}` : text; field.focus(); return; }
    showToast('剪贴板里没有可粘贴的内容');
  } catch (error) {
    field.focus();
    showToast('浏览器没有授权读取剪贴板，请点击输入框后按 Ctrl+V');
  }
}
function renderGrowth() { const title = latest?.jobProfile?.title || '尚未选择岗位'; const current = latest?.priorities?.[0]?.title || latest?.match?.missing?.[0] || '完成一次岗位分析后生成'; const recent = records.slice(0, 3); growthContent.innerHTML = `<div class="growth-grid"><article class="growth-stat"><span>已完成训练</span><strong>${records.length}</strong><small>次</small></article><article class="growth-stat"><span>当前训练岗位</span><strong class="growth-title">${esc(title)}</strong></article><article class="growth-stat"><span>当前需要提升</span><strong class="growth-title">${esc(current)}</strong></article></div><article class="section-card recent-card"><div class="section-label">RECENT / 最近训练内容</div>${recent.length ? `<div class="recent-list">${recent.map((item) => `<div class="recent-row"><div><strong>${esc(item.task)}</strong><p>${esc(item.preview)}</p></div><time>${esc(item.date)}</time></div>`).join('')}</div>` : '<p>完成第一次训练后，这里会留下你的练习记录。</p>'}</article>`; }
function renderFeedback(feedback, target) { target.classList.remove('hidden'); target.innerHTML = `<strong>${esc(feedback.evaluation)}</strong><div class="feedback-sections"><div><b>做得好的地方</b>${list(feedback.strengths)}</div><div><b>存在的问题</b>${list(feedback.problems)}</div><div><b>缺少依据的判断</b>${list(feedback.unsupported)}</div><div><b>可以更专业的地方</b>${list(feedback.professional)}</div></div><div class="suggestion"><b>具体修改建议：</b>${esc(feedback.suggestion)}</div><div class="next-task"><b>下一步训练：</b>${esc(feedback.nextTask)}</div>`; }
async function submitTraining(event) { event.preventDefault(); const formElement = event.target; const button = formElement.querySelector('button[type="submit"]'); const submission = document.querySelector('#trainingSubmission').value; button.disabled = true; button.querySelector('span').textContent = '批改中…'; try { const response = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task: latest.todayTask.title, submission, context: latest }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error); records.unshift({ task: latest.todayTask.title, preview: submission.slice(0, 80), date: new Date().toLocaleDateString('zh-CN') }); saveState(); renderFeedback(payload.feedback, document.querySelector('#feedbackResult')); } catch (error) { showToast(error.message); } finally { button.disabled = false; button.querySelector('span').textContent = '提交训练'; } }
form.addEventListener('submit', async (event) => { event.preventDefault(); const button = form.querySelector('button'); button.disabled = true; button.querySelector('span').textContent = '拆解中…'; try { const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jd: document.querySelector('#jd').value, situation: document.querySelector('#situation').value }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error); render(payload.result, payload.mode); } catch (error) { showToast(error.message); } finally { button.disabled = false; button.querySelector('span').textContent = '开始拆解'; } });
document.addEventListener('click', (event) => { const target = event.target.closest('[data-view]'); if (target) { const view = target.dataset.view; if (view === 'resultView' && latest) render(latest, latestMode); else showView(view); } });
if (latest) render(latest, latestMode); else showView('homeView');
