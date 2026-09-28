# 人类只是我的兼职

一个面向求职者的 JD 分析网页。输入招聘 JD 和个人情况后，它会给出岗位画像、能力拆解、匹配情况、3 个优先提升方向、今日练习，并支持提交练习结果让 AI 批改。

## 启动

1. 安装 Node.js 18 或更高版本。
2. 在项目目录运行 `npm install`。
3. 复制 `.env.example` 为 `.env`，填入 `OPENAI_API_KEY`（使用真实 AI 时需要）。
4. 运行 `npm start`，浏览器打开 `http://localhost:3000`。

项目现在只使用真实 AI，不再提供模拟分析或模拟批改。没有配置 API Key 时，接口会明确提示配置要求。

支持 OpenAI-compatible API：官方 OpenAI 可不填 `OPENAI_BASE_URL`；其他兼容服务填写其 API 根地址。也支持旧变量名 `OPENAI_API_BASE`，但 `OPENAI_BASE_URL` 优先。

环境变量：

- `OPENAI_API_KEY`：必填，保存在本机 `.env`，不要提交到代码仓库。
- `OPENAI_BASE_URL`：可选，兼容服务的 API 根地址。
- `OPENAI_API_BASE`：可选，兼容旧配置名。
- `OPENAI_MODEL`：模型名称，默认 `gpt-4o-mini`。
- `OPENAI_JSON_MODE`：默认 `true`；兼容服务不支持 `response_format` 时设为 `false`。
- `ANTHROPIC_AUTH_TOKEN`：可替代 `OPENAI_API_KEY`，用于兼容 CC Switch 的环境变量命名；若两项同时存在，优先使用 `OPENAI_API_KEY`。

## 公网部署准备

仓库包含 `render.yaml`，可通过 Render Blueprint 创建公网 Web Service。部署时在 Render 控制台的环境变量/Secret 中填写 API Key，不要把本机 `.env` 上传到仓库。默认部署配置使用 DeepSeek OpenAI-compatible 地址 `https://api.deepseek.com/v1` 和模型 `deepseek-chat`。公网服务会让访问者触发真实模型调用，正式分享前应先配置访问限制或用量保护。

服务端已对同一来源的 AI 请求做基础限流：岗位分析每小时最多 10 次，训练批改每小时最多 20 次。该限制只能减少普通误用，仍建议在 API 服务商后台设置余额告警或消费上限。

部署步骤：

1. 将项目提交到 GitHub 仓库，确认 `.env` 没有被提交。
2. 在 Render 控制台选择 **New > Blueprint**，连接该仓库；Render 会读取根目录的 `render.yaml`。
3. 在 Render 中为 `OPENAI_API_KEY` 填入 Secret。不要把密钥写进 `render.yaml`。
4. 创建服务并等待 `/api/health` 健康检查通过，然后打开 Render 提供的 `onrender.com` 地址。

免费实例长时间没有访问时会休眠，休眠后的第一次打开可能需要等待服务唤醒。
