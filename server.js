const path = require('path');
const express = require('express');
const dotenv = require('dotenv');
const OpenAI = require('openai');

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3000;
const apiKey = String(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || '').trim();
const baseURL = String(process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE || '').trim();
const model = String(process.env.OPENAI_MODEL || 'gpt-4o-mini').trim();
const useJsonResponse = String(process.env.OPENAI_JSON_MODE || 'true').toLowerCase() !== 'false';
const client = apiKey ? new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) }) : null;

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
  });
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor/exceljs', express.static(path.join(__dirname, 'node_modules', 'exceljs', 'dist')));

function createRateLimiter({ windowMs, max }) {
  const requests = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const recent = (requests.get(key) || []).filter((time) => now - time < windowMs);
    if (recent.length >= max) {
      const retryAfter = Math.max(1, Math.ceil((windowMs - (now - recent[0])) / 1000));
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: `请求过于频繁，请在 ${Math.ceil(retryAfter / 60)} 分钟后再试。` });
    }
    recent.push(now);
    requests.set(key, recent);
    if (requests.size > 10000) {
      for (const [requestKey, times] of requests) {
        if (!times.some((time) => now - time < windowMs)) requests.delete(requestKey);
      }
    }
    next();
  };
}

const analyzeLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10 });
const feedbackLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 20 });

const outputSchema = {
  jobProfile: { title: '', responsibilities: [], abilities: [] },
  abilityBreakdown: { mustHave: [], bonus: [], learnLater: [] },
  match: { ready: [], partial: [], missing: [] },
  matchDetails: [],
  priorities: [],
  todayTask: { title: '', why: '', steps: [], standard: '' },
  nextStep: ''
};

function cleanJson(text) {
  const trimmed = String(text || '').trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('AI 返回的内容不是有效 JSON');
  return JSON.parse(trimmed.slice(start, end + 1));
}

function asList(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function normalize(result) {
  const profile = result.jobProfile || {};
  const breakdown = result.abilityBreakdown || {};
  const match = result.match || {};
  return {
    jobProfile: {
      title: String(profile.title || '未识别岗位'),
      responsibilities: asList(profile.responsibilities),
      abilities: asList(profile.abilities)
    },
    abilityBreakdown: {
      mustHave: asList(breakdown.mustHave),
      bonus: asList(breakdown.bonus),
      learnLater: asList(breakdown.learnLater)
    },
    match: { ready: asList(match.ready), partial: asList(match.partial), missing: asList(match.missing) },
    matchDetails: Array.isArray(result.matchDetails) ? result.matchDetails.slice(0, 30).map((item) => ({
      ability: String(item.ability || ''),
      status: ['ready', 'partial', 'missing'].includes(item.status) ? item.status : 'missing',
      evidence: String(item.evidence || '')
    })).filter((item) => item.ability) : [],
    priorities: Array.isArray(result.priorities) ? result.priorities.slice(0, 3).map((item) => ({
      title: String(item.title || ''),
      whyImportant: String(item.whyImportant || ''),
      whyNow: String(item.whyNow || ''),
      learn: String(item.learn || ''),
      target: String(item.target || '')
    })) : [],
    todayTask: {
      title: String((result.todayTask || {}).title || ''),
      why: String((result.todayTask || {}).why || ''),
      steps: asList((result.todayTask || {}).steps),
      standard: String((result.todayTask || {}).standard || '')
    },
    nextStep: String(result.nextStep || '')
  };
}

async function analyzeWithAI(jd, situation) {
  const system = `你是一个务实的求职教练。请只输出 JSON，不要 Markdown，不要解释。根据招聘 JD 和求职者情况，完成拆解。输出字段必须严格为：${JSON.stringify(outputSchema)}。要求：岗位画像简洁；能力使用具体、可验证的名词；能力必须先从 JD 提取，再分为必须具备、加分项、可以后学，不能把用户自述中独有的内容误当作 JD 要求；对每一项核心能力都必须在 matchDetails 中出现且只出现一次，status 只能是 ready、partial、missing，分别对应已具备、部分具备、暂时缺少，evidence 必须引用或概括用户情况中的依据；再将能力名称放入 match.ready、match.partial、match.missing，不能漏项。最优先提升必须最多 3 件，优先选择 missing，其次 partial；每件包含 whyImportant、whyNow、learn、target，分别回答为什么重要、为什么现在优先、具体应该补什么、达到什么程度算基本掌握。今日任务只有一个，必须直接针对第一项提升能力，30-60 分钟可做、有实际操作、有明确完成标准；nextStep 必须说明用户下一轮提交产出、过程、结果和疑问。如果用户信息不足，明确写入匹配依据，不能臆测。`;
  const messages = [{ role: 'system', content: system }, { role: 'user', content: `招聘 JD：\n${jd}\n\n我的情况：\n${situation || '未填写，请明确指出需要补充的信息。'}` }];
  const completion = await createChatCompletion({ messages });
  return normalize(cleanJson(completion.choices[0]?.message?.content));
}

async function createChatCompletion({ messages }) {
  const request = { model, temperature: 0.2, messages };
  if (useJsonResponse) request.response_format = { type: 'json_object' };
  try {
    return await client.chat.completions.create(request);
  } catch (error) {
    // Some OpenAI-compatible providers reject response_format. Retry once with JSON-only prompting.
    if (useJsonResponse && /response_format|unsupported|unknown parameter|not support/i.test(String(error.message || ''))) {
      delete request.response_format;
      return client.chat.completions.create(request);
    }
    throw error;
  }
}

function requireAI(res) {
  if (client) return true;
  res.status(503).json({ error: '尚未配置真实 AI。请在项目根目录的 .env 中填写 OPENAI_API_KEY，然后重启服务。' });
  return false;
}

app.get('/api/health', (req, res) => {
  if (!client) return res.status(503).json({ ok: false, aiConfigured: false });
  res.json({ ok: true, aiConfigured: true });
});

app.post('/api/analyze', analyzeLimiter, async (req, res) => {
  const jd = String(req.body?.jd || '').trim();
  const situation = String(req.body?.situation || '').trim();
  if (jd.length < 20) return res.status(400).json({ error: '请至少输入 20 个字的招聘 JD。' });
  if (jd.length > 30000) return res.status(400).json({ error: '招聘 JD 内容过长，请控制在 30000 字以内。' });
  if (situation.length > 20000) return res.status(400).json({ error: '个人情况内容过长，请控制在 20000 字以内。' });
  if (!requireAI(res)) return;
  try {
    const result = await analyzeWithAI(jd, situation);
    res.json({ mode: 'ai', result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: `分析失败：${error.message || '请稍后重试'}` });
  }
});

app.post('/api/feedback', feedbackLimiter, async (req, res) => {
  const { task, submission, context } = req.body || {};
  if (!submission || String(submission).trim().length < 5) return res.status(400).json({ error: '请先填写你的练习结果。' });
  if (String(submission).length > 100000) return res.status(400).json({ error: '练习内容过长，请控制在 100000 字以内。' });
  if (!requireAI(res)) return;
  try {
    const prompt = `你是求职教练。请根据今日任务、原分析和用户提交内容进行具体批改，只返回 JSON：{"evaluation":"总体评价","strengths":["做得好的地方"],"problems":["存在的问题"],"unsupported":["哪些判断缺少依据"],"professional":["哪些地方可以更专业"],"suggestion":"一个具体修改建议","nextTask":"下一步训练任务"}。不要泛泛鼓励，每条都尽量指出用户提交中的具体内容和下一步动作；如果提交信息不足，明确指出缺少什么。\n今日任务：${task}\n原分析：${JSON.stringify(context)}\n用户提交：${submission}`;
    const completion = await createChatCompletion({ messages: [{ role: 'user', content: prompt }] });
    const feedback = JSON.parse(completion.choices[0].message.content);
    res.json({ mode: 'ai', feedback: {
      evaluation: String(feedback.evaluation || ''),
      strengths: asList(feedback.strengths),
      problems: asList(feedback.problems),
      unsupported: asList(feedback.unsupported),
      professional: asList(feedback.professional),
      suggestion: String(feedback.suggestion || ''),
      nextTask: String(feedback.nextTask || '')
    } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: `批改失败：${error.message || '请稍后重试'}` });
  }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(port, () => console.log(`AI 求职拆解 Agent 已启动：http://localhost:${port}`));
