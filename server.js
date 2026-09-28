const { createApp } = require('./app');

const port = Number(process.env.PORT) || 3000;
const app = createApp();
app.listen(port, () => console.log(`AI 求职拆解 Agent 已启动：http://localhost:${port}`));
