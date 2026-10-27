# MySQL 8.4 安装与验证

## 当前状态

- MySQL Community Server：8.4.13 LTS
- 安装目录：`D:\mysql`
- 数据目录：`D:\mysql\data`
- 配置文件：`D:\mysql\my.ini`
- Windows 服务：`MySQL84`，Running / Automatic
- 监听地址：`127.0.0.1:3306`
- 字符集：`utf8mb4`
- X Plugin：已关闭
- root 密码文件：`D:\mysql\root-password.txt`

> 密码文件不在项目仓库内，且已限制为当前用户、Administrators、SYSTEM 读取。

## 连接 MySQL

```powershell
# 读取密码到环境变量，避免出现在命令行历史
$env:MYSQL_PWD = (Get-Content D:\mysql\root-password.txt -Raw).Trim()

mysql --protocol=TCP --host=127.0.0.1 --port=3306 --user=root

# 或者直接执行 SQL
mysql --protocol=TCP --host=127.0.0.1 --port=3306 --user=root -e "SELECT VERSION();"

Remove-Item Env:MYSQL_PWD
```

也可以使用交互式输入：

```powershell
mysql --protocol=TCP --host=127.0.0.1 --port=3306 --user=root -p
```

## 服务命令

```powershell
Get-Service MySQL84
Start-Service MySQL84
Stop-Service MySQL84
Restart-Service MySQL84
```

## 常用路径

```text
D:\mysql\bin\mysql.exe
D:\mysql\bin\mysqld.exe
D:\mysql\bin\mysqladmin.exe
D:\mysql\data\mysql-error.log
```

`D:\mysql\bin` 已加入系统 PATH，新开的 PowerShell 可直接执行 `mysql`。

## 验证

```text
MySQL version: 8.4.13
port:          3306
datadir:       D:\mysql\data\
charset:       utf8mb4
service:       Running
```

## 说明

- MySQL 仅监听本机，不允许远程连接。
- X Plugin（33060）已关闭，避免额外端口暴露。
- 项目当前仍使用 SQLite；MySQL 是独立安装，后续迁移 PostgreSQL/MySQL 时可使用。
- 不要把 `root-password.txt` 放进项目目录或提交到 Git。
