# Ollama 安装与验证

## 当前状态

- 版本：Ollama 0.40.11
- 安装目录：`D:\ollama`
- 主程序：`D:\ollama\ollama.exe`
- 模型目录：`D:\ollama\models`
- 服务地址：`127.0.0.1:11434`
- 启动方式：手动运行 `ollama serve`（当前不是 Windows 服务）
- 已测试模型：`qwen2.5:0.5b`（397 MB）
- 推理设备：CPU

> 当前机器为 Windows 10 Pro 22H2，Ollama 日志显示使用 CPU 推理。
> GTX 960M 2GB 显卡未被采用，`ollama ps` 显示 `100% CPU`。

## 安装方式

使用官方 GitHub Release 的 Windows 便携 ZIP：

```text
https://github.com/ollama/ollama/releases/download/v0.40.11/ollama-windows-amd64.zip
```

下载后解压到 `D:\ollama`，没有使用默认的
`%LOCALAPPDATA%\Programs\Ollama` 目录，也没有注册安装器卸载项。

原始 ZIP 保存在：

```text
D:\ollama-setup\ollama-windows-amd64.zip
```

如果不需要保留安装包，可以在确认运行正常后删除，以释放约 1.5 GB 空间。

## 环境变量

已设置当前用户级环境变量：

```text
OLLAMA_MODELS=D:\ollama\models
```

并把 `D:\ollama` 加入当前用户 PATH。新开的 PowerShell 可以直接执行：

```powershell
ollama --version
ollama list
```

如果旧终端找不到 `ollama`，重新打开终端即可。

## 启动服务

如果 11434 端口尚未监听：

```powershell
$env:OLLAMA_MODELS = 'D:\ollama\models'

Start-Process 'D:\ollama\ollama.exe' `
  -ArgumentList 'serve' `
  -WindowStyle Hidden `
  -RedirectStandardOutput 'D:\ollama\serve.out.log' `
  -RedirectStandardError 'D:\ollama\serve.err.log'
```

检查：

```powershell
Get-NetTCPConnection -LocalPort 11434 -State Listen
Invoke-RestMethod http://127.0.0.1:11434/api/tags
```

正常时只监听：

```text
127.0.0.1:11434
```

## 停止服务

先找到监听 11434 的进程，再停止它：

```powershell
$serverPid = (Get-NetTCPConnection -LocalPort 11434 -State Listen |
  Select-Object -First 1 -ExpandProperty OwningProcess)
Stop-Process -Id $serverPid -Force
```

## 使用模型

```powershell
# 查看已安装模型
ollama list

# 拉取小模型（约 397 MB）
ollama pull qwen2.5:0.5b

# 命令行对话
ollama run qwen2.5:0.5b "你好，简单介绍一下你自己"

# 查看当前加载的模型和推理设备
ollama ps
```

当前测试结果：

```text
qwen2.5:0.5b
ID: a8b0c5157701
SIZE: 486 MB (运行时)
PROCESSOR: 100% CPU
CONTEXT: 4096
```

## OpenAI 兼容接口

Ollama 提供兼容接口：

```text
http://127.0.0.1:11434/v1
```

示例：

```powershell
$body = @{
  model = 'qwen2.5:0.5b'
  messages = @(
    @{ role = 'user'; content = '用一句话介绍你自己' }
  )
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Uri 'http://127.0.0.1:11434/v1/chat/completions' `
  -Method Post `
  -ContentType 'application/json' `
  -Body $body
```

## 日志

```text
D:\ollama\serve.out.log
D:\ollama\serve.err.log
```

启动异常时先查看 `serve.err.log` 的最后几十行：

```powershell
Get-Content 'D:\ollama\serve.err.log' -Tail 50
```

## 注意事项

- 服务默认只监听 `127.0.0.1`，没有身份认证，不要直接暴露到公网。
- 当前没有配置开机自启。电脑重启后需要重新执行启动命令。
- 模型存放在 D 盘；更换模型目录后必须重启 Ollama 服务才会生效。
- 机器只有 8 GB 内存，建议优先使用 0.5B～1.5B 级别的小模型。
- 老显卡和旧驱动下走 CPU 更稳定；不要同时加载多个大模型。

## 可选：配置开机自启

如果希望登录 Windows 后自动启动 Ollama，可以创建“登录时运行”的计划任务：

```powershell
$action = New-ScheduledTaskAction `
  -Execute 'D:\ollama\ollama.exe' `
  -Argument 'serve'

$trigger = New-ScheduledTaskTrigger -AtLogOn

Register-ScheduledTask `
  -TaskName 'Ollama Serve' `
  -Action $action `
  -Trigger $trigger `
  -Description 'Start Ollama on user logon' `
  -Force
```

删除自启任务：

```powershell
Unregister-ScheduledTask -TaskName 'Ollama Serve' -Confirm:$false
```

> 计划任务启动时可能拿不到交互式终端的环境变量，建议在任务中显式设置
> `OLLAMA_MODELS=D:\ollama\models`，或使用包装脚本后再注册。
