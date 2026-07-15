# Zentao Log Agent

面向开发者的本地禅道日志客户端。它自动读取 Git、HG、SVN 提交记录，总结为按日期和任务拆分的中文工作日志；连接 VPN 后，无需打开禅道网页即可完成预览与填报。

[官方网站](https://wanghuanlab.github.io/DS-OA-Agent/) · [下载最新版本](https://github.com/wanghuanlab/DS-OA-Agent/releases/latest) · [查看发布记录](https://github.com/wanghuanlab/DS-OA-Agent/releases)

![Zentao Log Agent 日志预览](website/assets/app-preview.png)

## 亮点

### 自动检测提交，生成工作总结

选择代码库和填报日期后，应用会自动识别 Git、Mercurial 或 SVN，按提交人筛选提交记录，并使用配置的 LLM 生成简洁的中文工作描述。普通目录会自动忽略，无需手工指定版本库类型。

### 无需打开禅道，连接 VPN 即可填报

应用通过禅道 HTTP 接口完成状态检测、登录、任务获取和日志录入。只要当前电脑能够通过 VPN 访问禅道，就能在一个工作台内完成准备、预览和提交，不必反复打开网页查找任务或逐条填写。

### 本地优先，配置透明可控

项目源代码公开可审查。禅道账号、LLM Key、代码库路径和任务关联均以 JSON 保存在当前用户的本地数据目录，不会写入项目仓库。生成工作总结时，应用只会把必要的提交信息发送给用户自行配置的 LLM 服务。

此外，v1.0.2 支持同一日期添加多条任务、编辑工作描述与耗时，并可根据任务初始预计和累计消耗自动计算预计剩余。

## 下载与安装

前往 [GitHub Releases](https://github.com/wanghuanlab/DS-OA-Agent/releases/latest) 下载对应平台的安装包：

| 平台 | 安装包 |
|------|--------|
| macOS Apple Silicon | `arm64` DMG 或 ZIP |
| macOS Intel | `x64` DMG 或 ZIP |
| Windows 64 位 | 安装版或便携版 EXE |

本项目暂未配置 Apple 和 Windows 代码签名证书，操作系统首次运行时可能显示来源或安全提醒。

代码库检查依赖电脑已安装的命令行工具：Git 仓库需要 `git`，HG 仓库需要 `hg`，SVN 仓库需要 `svn`。

## 使用方式

1. 启动客户端，填写禅道登录地址、账号和任务页地址。
2. 填写 LLM Base URL、API Key 和模型。默认 Base URL 为 `https://api.deepseek.com`，默认模型为 `deepseek-v4-flash`。
3. 选择填报日期和本机代码库目录，检查提交记录并选择提交人。
4. 为每个代码库关联禅道任务。
5. 生成预览，调整每条日志的任务、工作描述与耗时。
6. 点击“立即录入禅道”完成填报。

## 本地开发

```bash
npm install
npm test
npm run desktop
```

启动 Web 模式：

```bash
npm run install:browsers
npm start
```

启动后访问 `http://127.0.0.1:5173`。

## 打包

```bash
npm run build:mac:arm64
npm run build:mac:x64
npm run build:win
```

安装包输出到 `dist/`。macOS 安装包需要在 macOS 上构建，Windows 安装包建议在 Windows 上构建。推送 `v*` 标签后，GitHub Actions 会为三个目标平台构建安装包并创建 GitHub Release。

## 配置与隐私

桌面客户端把配置和预览保存在系统用户数据目录：

- macOS：`~/Library/Application Support/Zentao Log Agent/`
- Windows：`%APPDATA%\Zentao Log Agent\`

Web 模式使用本地 `config/config.json`。该文件已被 Git 忽略，不会进入安装包或远程仓库。仓库只提供不含凭据的 [`config/config.example.json`](config/config.example.json)。

密码和 API Key 会以本地 JSON 形式保存，请保护当前操作系统账户，并避免手动分享用户数据目录。

## 项目结构

```text
desktop/      Electron 主进程与桌面集成
src/          配置、生成、版本库与禅道服务
public/       客户端工作台界面
website/      官方网站静态资源
config/       脱敏配置示例
test/         单元测试
```

## 源代码

仓库公开提供源代码，便于检查本地配置、版本库读取和禅道提交的实现。项目当前尚未附加通用开源许可证；如需复制、修改或再发布，请先联系项目维护者。
