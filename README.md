# DS-OA-Agent

本地禅道工作日志 Agent。基于 LLM 从代码仓库或长文本生成每日工作日志，提供 Web 控制台预览与编辑，并通过 Playwright 自动提交到禅道。

## 功能

- 本地 Web 控制台：配置禅道账号、LLM、报告周期与数据来源
- 日志生成：支持 Git / HG / SVN 提交记录汇总，或长文本拆分
- 预览编辑：按天生成中文工作日志，提交前可修改
- 定时任务：默认每周五 16:00 生成预览、17:00 自动提交（Asia/Shanghai）
- 浏览器自动化：Playwright 登录禅道并填写日志

## 快速开始

```bash
npm install
npm run install:browsers
npm start
```

启动后访问 `http://127.0.0.1:5173`，在控制台中填写配置并生成预览。

## 配置

配置文件路径：`config/config.json`

首次启动时会从默认值创建。主要配置项：

| 模块 | 说明 |
|------|------|
| `zentao` | 禅道登录地址、账号、任务页 |
| `llm` | LLM API 地址、密钥、模型 |
| `report` | 报告周期、代码仓库或长文本来源 |
| `schedule` | 定时预览与自动提交 |
| `automation` | 无头模式、错误时保留浏览器等 |

> 密码与 API Key 仅保存在本地 JSON 文件中，请勿将含敏感信息的配置提交到远程仓库。

## 脚本

| 命令 | 说明 |
|------|------|
| `npm start` | 启动本地服务 |
| `npm test` | 运行单元测试 |
| `npm run install:browsers` | 安装 Playwright Chromium |

## 项目结构

```
src/          核心服务：配置、生成、调度、禅道自动化
public/       Web 控制台静态资源
config/       本地配置文件
test/         单元测试
docs/         设计与实现文档
```

## 文档

- [设计说明](docs/superpowers/specs/2026-07-07-zentao-log-agent-design.md)
- [实现计划](docs/superpowers/plans/2026-07-07-zentao-log-agent.md)

## License

Private — wanghuanlab
