# Ollama 安装与验证

## 当前状态

- 版本：Ollama 0.40.11
- 安装目录：`D:\ollama`
- 托盘程序：`D:\ollama\ollama app.exe`
- 命令行程序：`D:\ollama\ollama.exe`
- 模型目录：`D:\ollama\models`
- 服务地址：`127.0.0.1:11434`
- 启动方式：官方托盘应用，已配置登录自启
- 桌面快捷方式：`C:\Users\Administrator\Desktop\Ollama.lnk`
- 已测试模型：`qwen2.5:0.5b`（397 MB）
- 推理设备：CPU

> 当前机器为 Windows 10 Pro 22H2，Ollama 日志显示使用 CPU 推理。
> GTX 960M 2GB 显卡未被采用，`ollama ps` 显示 `100% CPU`。

## 安装方式

使用官方 Windows 安装器，并指定安装到 D 盘：

```powershell
OllamaSetup.exe /DIR="D:\ollama"
```

安装包保存在：

```text
D:\ollama-setup\OllamaSetup.exe
```

安装器会创建：

```text
D:\ollama\ollama app.exe       官方托盘程序
D:\ollama\ollama.exe           命令行程序
D:\ollama\app.ico              图标
D:\ollama\unins000.exe         卸载程序
```

同时创建开始菜单、启动项和卸载信息。之前的便携 ZIP 只包含命令行程序，
没有托盘应用，因此桌面上曾使用过临时 PowerShell 脚本；现在脚本已删除，
快捷方式已替换为官方 `ollama app.exe`。

## 环境变量

当前用户级变量：

```text
OLLAMA_MODELS=D:\ollama\models
```

`D:\ollama` 已加入用户和系统 PATH。新开的 PowerShell 可以直接执行：

```powershell
ollama --version
ollama list
```

> 注意：托盘程序内部通过 PATH 查找 `ollama.exe`。如果 PATH 中没有
> `D:\ollama`，会出现“托盘图标存在但 11434 端口没有服务”的现象。
> 修改 PATH 后需要重启 Explorer 或重新登录，让新环境生效。

## 桌面快捷方式

官方快捷方式：

```text
C:\Users\Administrator\Desktop\Ollama.lnk
```

指向：

```text
Target:     D:\ollama\ollama app.exe
WorkingDir: D:\ollama
Icon:       D:\ollama\app.ico
```

双击后会启动官方 Ollama 托盘应用，同时启动本地模型服务，不再经过脚本。

开始菜单和登录启动项：

```text
%APPDATA%\Microsoft\Windows\Start Menu\Programs\Ollama.lnk
%APPDATA%\Microsoft\Windows\Start Menu\Programs\Ollama\Ollama.lnk
%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Ollama.lnk
```

## 验证服务

```powershell
Get-NetTCPConnection -LocalPort 11434 -State Listen
Invoke-RestMethod http://127.0.0.1:11434/api/tags
```

正常时只监听：

```text
127.0.0.1:11434
```

托盘程序运行后，任务栏通知区域会出现 Ollama 图标。

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

官方托盘应用的日志：

```text
%LOCALAPPDATA%\Ollama\app.log
%LOCALAPPDATA%\Ollama\server.log
```

查看服务日志：

```powershell
Get-Content "$env:LOCALAPPDATA\Ollama\server.log" -Tail 50
```

之前便携版留下的 `D:\ollama\serve.out.log` 和 `serve.err.log` 已不再使用。

## 停止与重启

优先使用托盘图标菜单退出 Ollama。也可以停止进程后重新双击桌面快捷方式：

```powershell
Get-Process 'ollama app','ollama' -ErrorAction SilentlyContinue |
  Stop-Process -Force
```

重启：

```powershell
Start-Process 'D:\ollama\ollama app.exe'
```

## 故障排查

如果桌面快捷方式能打开 Ollama 窗口，但模型服务不可用：

1. 检查 11434 端口：

```powershell
Get-NetTCPConnection -LocalPort 11434 -State Listen
```

2. 检查 PATH 是否包含 `D:\ollama`：

```powershell
[Environment]::GetEnvironmentVariable('Path','User')
[Environment]::GetEnvironmentVariable('Path','Machine')
```

3. 检查服务日志：

```powershell
Get-Content "$env:LOCALAPPDATA\Ollama\server.log" -Tail 50
```

4. 修改 PATH 后重启 Explorer 或重新登录，再双击桌面快捷方式。

## 注意事项

- 服务默认只监听 `127.0.0.1`，没有身份认证，不要直接暴露到公网。
- 官方安装器已配置登录自启，不需要额外的计划任务。
- 模型存放在 D 盘；更换模型目录后必须重启 Ollama 服务才会生效。
- 机器只有 8 GB 内存，建议优先使用 0.5B～1.5B 级别的小模型。
- 老显卡和旧驱动下走 CPU 更稳定；不要同时加载多个大模型。
