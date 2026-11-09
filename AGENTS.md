# AGENTS.md

> 给 AI 编码助手的部署说明。人类读者看 [`README.md`](README.md) 和 [`从零安装.md`](从零安装.md)。

**你是谁**：你在一台 Windows 电脑上，任务是把本仓库跑起来，让坐标能喂进用户已经装好的雷电模拟器。

**先分清两件事**：

- 这台机器**以前部署过**（项目目录存在、`python doctor.py` 能出结果）→ 走 [`更新说明.md`](更新说明.md)，**只换代码，不重装环境**。
- 从没部署过 → 按本文档走。

**最终目标**：用户双击 `一键刷跑.vbs`，界面能起来，点「开始跑」后模拟器里的定位在操场上动。

**完成判定**：`python doctor.py` 退出码 0，且最后一行是「全部达标，环境与目标一致，可以直接用」。达不到就不要报告完成。

---

## 一、边界：这些东西不归你管

模拟器和 App 是**用户自己负责**的。你不要去装模拟器、不要下载 APK、不要教用户怎么配雷电。

你要做的只是：

1. 确认 Python / Node 在
2. 确认雷电 9 在、在运行、ADB 通
3. 确认运动世界装着
4. 起界面，让用户自己点

缺哪样，**告诉用户缺什么，让他自己去弄**，别自己动手装。

---

## 二、探测环境

```bat
python --version
python -c "import tkinter; print('tk ok')"
node --version
```

- `python` 不存在或没有 tkinter → 让用户装 Python 3.10+ 标准版，勾 Add to PATH
- `node` 不存在 → 让用户装 Node 16+

然后一次看全貌：

```bat
python doctor.py
```

- 全绿 → 跳到第五节
- 有红色 `✗` → 只处理报红的项
- 命令本身报错 → 说明不在仓库目录里跑，先 `cd` 过去

---

## 三、模拟器（只检查，不安装）

`doctor.py` 会自己找 `ldconsole.exe`，内置排除雷电 14。你要确认的是：

```bat
python -c "import glob;print('\n'.join(glob.glob('D:/leidian/*/ldconsole.exe')+glob.glob('C:/LDPlayer/*/ldconsole.exe')))"
```

- 找到了 9.x → 继续
- 只找到 14，或者什么都没有 → 告诉用户自己装雷电 9.5.x。**不要**用 `LDCONSOLE` 指到 14，也别试图修 14，它的 `ldcam.exe` 是坏的
- 版本判断：

```bat
powershell -NoProfile -Command "(Get-Item '<雷电目录>\dnplayer.exe').VersionInfo.FileVersion"
```

必须以 `9.` 开头。

参数不对时（分辨率、CPU、内存、Root、ADB、帧率），先 `ldconsole.exe quitall` 关掉模拟器，再：

```bat
python apply_config.py --dry-run
python apply_config.py
```

**不要**手动改 `vms/config/*.config` 里的 IMEI / IMSI / AndroidID / MAC，那是设备指纹。

---

## 四、业务 App 和相机（检查 + 提示，不代装）

装没装运动世界：

```bat
<雷电目录>\adb.exe -s emulator-5554 shell pm list packages | findstr zjwh
```

要看到 `package:com.zjwh.android_wh_physicalfitness`。没有就让用户自己从学校渠道装，仓库不发这个包。

相机设备数：

```bat
<雷电目录>\adb.exe -s emulator-5554 shell dumpsys media.camera
```

`Number of camera devices:` 应该是 **2**。是 0 就让用户回雷电 GUI 检查「设置 → 相机」有没有选电脑摄像头（这一步配置不落盘，只能手点，你代劳不了）。

用户报「画面发青」时，让他双击 `检查相机.bat` 看结论，别自己猜。

---

## 五、验收

```bat
python doctor.py
```

看到「全部达标」之后，起界面确认能用：

```bat
一键刷跑.vbs
```

顺手建桌面快捷方式：

```bat
python install_shortcut.py
```

然后告诉用户：里程填 2110、配速填 `8'20"`（学校要求不慢于 8'30"）、点开始跑。

---

## 六、失败处理

| 现象 | 判断 | 处理 |
|---|---|---|
| `doctor.py` 报版本 14.x | 版本不对 | 让用户换雷电 9 |
| `adb devices` 为空 | ADB 没起 | 让用户用桌面图标重启雷电，确认 ADB 调试已开 |
| 相机设备数 0 | 相机没挂上 | 检查 GUI 是否选了设备 → 是否装了相机修复包 → 摄像头是否被别的程序独占 |
| 位置不动 | 注入通道没通 | 看界面日志第一行用的是哪台模拟器；手动 `ldconsole locate` 试一次 |
| 提示「不在围栏内」 | 坐标系错 | 坐标必须是 WGS-84，不是地图里复制的 GCJ-02 |
| `apply_config.py` 找不到配置 | 雷电没启动过 | 启动一次让它生成 `vms/config/*.config` |

---

## 七、禁止事项

- 不要往仓库里加模拟器镜像（几十 GB）、不要提交任何 APK
- 不要升级到雷电 14
- 不要改设备指纹
- 不要为了让 `doctor.py` 变绿去改判定阈值，那是验收标准
- 不要在模拟器运行中改实例配置
- 只在本机模拟器里注入，别接到真实手机

---

## 八、结构速查

```
一键刷跑.vbs        主入口，无黑框
run_gui.py          图形界面主程序（tkinter）
gen_run.js          随机轨迹生成
gen_fixed.js        固定路线生成
core.js             跑道几何与配速曲线
validate_run.js     轨迹自检
doctor.py           环境体检 / 验收
apply_config.py     一键对齐实例参数
检查相机.bat / .py   相机真假诊断
apks/               相机修复包（相机挂了才用）
index.html          配速规划台，离线可用
```

默认参数（学校要求）在 `run_gui.py` 顶部：`CENTER_LAT/LNG`、`LAPS`、`PACE_SEC`。
学校要求变了就改这三个，别改噪声参数。

原理见 `技术原理.md`。