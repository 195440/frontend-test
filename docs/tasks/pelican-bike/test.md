# 鹈鹕骑自行车 SVG 2D 动画：测试报告

## 测试结论

浏览器自动检查 **11 项通过，0 项失败**，并结合实际页面与截图检查，需求中的 AC-01 至 AC-07 在本次目标环境下通过。未发现需要修改 `index.html` 的功能缺陷。

本阶段新增可重复运行的浏览器验收脚本和本报告，更新 README 中的验证说明；只完成测试阶段，不开展评审、推送或合并。

## 环境与范围

- 分支：`task/9bdhh9i1`。
- 被测页面版本：开发提交 `39fd39b`，测试阶段未改变 HTML 页面。
- 浏览器：无头 Chromium `155.0.8059.12`，由平台 Playwright 浏览器工具提供。
- 语法检查：Node.js `v24.21.0`。
- 静态服务：Python `3.11.2`，复用开发阶段的 `127.0.0.1:8000` 服务。
- 浏览器内访问：`http://localhost:8000`；平台预览：`http://localhost:20004`。
- 离线验证：独立浏览器上下文启用 offline，直接访问 `file:///workspace/index.html`。
- 布局视口：1440×900、768×1024、390×844、844×390。
- 未配置项目测试框架、lint、构建或类型检查命令；页面使用原生 JavaScript，因此未虚构这些检查的通过结果。

## 实际执行与结果

| 命令或工具调用 | 结果 |
| --- | --- |
| `node --version`、`python3 --version` | 确认上述环境版本。 |
| 平台 `list_ports`、`expose_preview(name="pelican-bike", port=8000)` | 确认服务已运行并复用已有预览，无重复启动。 |
| 提取内联脚本后执行 `node --check` | 通过，JavaScript 语法无错误。 |
| `node --check tests/pelican-browser.js` | 通过，浏览器验收脚本语法无错误。 |
| `browser_run_code_unsafe(filename="/workspace/tests/pelican-browser.js")` | 最终完整执行返回 `passed: 11`、`failed: 0`。 |
| `browser_evaluate` 保存 `window.__pelicanTestReport` | 最终结构化结果保存到 `.ca/pelican-test-results.json`。 |
| `browser_console_messages(level="error", all=true)` | 当前预览页面无控制台错误或警告；验收脚本同时收集了独立测试页面的未捕获异常与 console error，结果为 0。 |
| `browser_network_requests(static=true)` 与验收脚本的请求监听 | 当前预览页面 GET 请求为 200；测试页面无请求失败、4xx 或 5xx。 |
| `browser_take_screenshot` 及脚本截图 | 保存桌面、手机、四相位、静态与离线证据，均位于 `.ca/screenshots/`。 |
| `git diff --check`、`git diff --cached --check` | 通过，提交前变更格式正常。 |

内联脚本语法检查执行方式：

```sh
set -o pipefail
python3 -c 'from pathlib import Path; html=Path("index.html").read_text(); print(html.split("<script>",1)[1].split("</script>",1)[0])' | node --check
```

静态服务的启动命令为：

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory /workspace
```

本次复用了该服务，没有重新启动。测试后保留服务和预览供用户查看。

## 浏览器检查结果

| 编号 | 检查内容 | 结果与主要证据 |
| --- | --- | --- |
| T-01 | HTML、内联 SVG 和无障碍描述 | 通过。HTML 返回 200；主体 SVG 包含 50 个路径，XML 解析无错误，无重复 ID，无外链脚本、样式或 SVG 图片资源；名称和描述包含鹈鹕及喉囊信息。 |
| T-02 | 至少三个真实动画周期与连续接触 | 通过。真实时间采样约 8.114 秒、474 帧，观测到 3 次周期边界，覆盖全部四象限。腿末端、曲柄端点和脚部锚点的最大距离为 0；双脚中点相对曲柄中心的误差为 0。 |
| T-03 | 暂停、继续及键盘操作 | 通过。Tab 聚焦播放按钮并呈现实线焦点框；Enter 暂停后所有采样部件保持不变；空格继续后姿态变化。 |
| T-04 | 减少动态默认状态、手动播放及实时偏好变化 | 通过。默认静止；允许主动播放；切换到减少动态时暂停；关闭偏好后不自动重新播放。 |
| T-05 | 踩踏四方向、周期边界和移动方向 | 通过。受控时间依次验证右、下、左、上以及返回右侧。周期起点与终点脚坐标一致；轮辐顺时针旋转，路面向左移动。 |
| T-06 | 重复控制与单循环 | 通过。连续切换 12 次后，受控 256 毫秒内车轮增加 72°，监听到 16 次轮辐 transform 更新，没有额外循环导致的多次渲染或加速。 |
| T-07 | 页面可见性与用户暂停状态 | 通过模拟检查。模拟隐藏 3000 毫秒时姿态保持；恢复首帧不累计隐藏时间，随后继续播放；用户主动暂停在隐藏和返回后仍被保留。 |
| T-08 | 四种视口与主体边界 | 通过。四种视口的文档宽度均等于视口宽度，SVG 保持原始比例，鹈鹕、羽翼、自行车及双腿均在安全边界内，按钮高度为 44 像素。横屏较矮视口可以正常纵向滚动查看完整插画。 |
| T-09 | 禁用 JavaScript | 通过。主体和双轮完整可见，姿态稳定，播放按钮隐藏，没有不可用控件。 |
| T-10 | 离线直接打开 HTML | 通过。禁用网络后，file 页面加载正常、播放按钮正常初始化、脚部姿态持续变化，无需 HTTP 服务。 |
| T-11 | 脚本异常与请求错误 | 通过。测试页面的未捕获异常、控制台 error 和失败请求均为 0。 |

T-02 同时记录到单次采样间的脚部位移最大约 4.686 个 SVG 单位、膝部位移最大约 3.893 个 SVG 单位，低于连续性阈值；轮辐和路面分别出现 444 和 474 个不同位置。该结果用于证实持续运动及排查跳变，不作为性能基准。

T-05 中，下方采样脚部约为 `(475.586, 490.994)`，上方约为 `(474.414, 435.006)`；受控帧以 16 毫秒步进，四分之一周期允许小于 1.4 个 SVG 单位的采样偏差。周期起点和终点均为 `(503, 463)`。

## 视觉检查与需求对应

已查看实际浏览器页面和桌面、手机、平板、横屏、四个踩踏相位及禁用脚本截图。鹈鹕的长嘴、饱满喉囊、颈部和蹼足清楚可辨；自行车双轮、车架、座垫和车把完整。羽翼与车把接触，身体位于座垫上方，前后腿以图层区分；四个踩踏方位未出现明显脱离或异常穿插。

| 需求标准 | 依据 | 本次结果 |
| --- | --- | --- |
| AC-01：HTML 页面 | T-01、T-10 | 通过，HTTP 与离线 file 两种打开方式正常。 |
| AC-02：SVG 绘制 | T-01 | 通过，实际内联 SVG 绘制主体。 |
| AC-03：鹈鹕辨识度 | 视觉检查及 T-01 | 通过，关键外形清楚。 |
| AC-04：自行车与骑行姿态 | 视觉检查、T-02、T-05 | 通过，姿态合理，腿足端点与踏板保持一致。 |
| AC-05：二维骑行动画 | T-02、T-05 | 通过，真实采样和四相位证据共同确认。 |
| AC-06：动画连续性 | T-02、T-05、T-06 | 通过，三个周期内持续协调，无明显跳变或额外循环。 |
| AC-07：展示完整性 | T-08、视觉检查 | 通过，四种目标视口中无横向溢出，主体未被 SVG 裁切。 |

## 测试过程中的修正

修正内容均位于测试脚本，没有修改页面：

1. 初版受控时钟安装在工具页面所在的浏览器上下文，影响了工具自身的取样并导致返回超时。恢复时钟后，将真实时间测试与受控时钟测试分别放入独立上下文，测试后关闭这些上下文；同时保留分项结果和耗时，便于中断后诊断。最终调用正常返回。
2. 初版实时动态偏好测试在同一渲染间隔内连续覆盖两次偏好，Chromium 合并了变化，造成测试未观测到 change 事件。改为等待两个渲染帧后再切换回减少动态，并等待按钮更新。修正后该项通过，符合用户实际切换偏好的行为。
3. 重复播放控制检查补充 MutationObserver，除运动速度外还直接统计渲染次数，检测重复循环。

## 证据与复现

可提交的复现脚本为 `tests/pelican-browser.js`，使用平台已有的 Playwright `page` 和 Chromium，不为展示页面新增运行时依赖。它是浏览器工具函数，不是直接用 Node 执行的测试程序。

复现步骤：

1. 在 `/workspace` 启动或复用上述静态服务，并通过 `expose_preview` 保留预览。
2. 确保 `.ca/screenshots/` 存在。
3. 调用 `browser_run_code_unsafe`，`filename` 为 `/workspace/tests/pelican-browser.js`。
4. 查看返回的 `checks`、`passed` 和 `failed`；需要保存结果时，用 `browser_evaluate` 读取 `window.__pelicanTestReport`，输出文件设为 `.ca/pelican-test-results.json`。
5. 结合截图检查角色辨识度及动作自然程度，不仅依靠自动坐标断言。

本次结构化结果位于 `.ca/pelican-test-results.json`。截图如下，均不提交 git：

- `.ca/screenshots/pelican-live-test.png`：正常播放的桌面页面。
- `.ca/screenshots/pelican-1440x900-test.png`、`pelican-768x1024-test.png`、`pelican-390x844-test.png`、`pelican-844x390-test.png`：四种布局。
- `.ca/screenshots/pelican-phase-right-test.png`、`pelican-phase-down-test.png`、`pelican-phase-left-test.png`、`pelican-phase-up-test.png`：四个踩踏方位。
- `.ca/screenshots/pelican-no-javascript-test.png`：禁用脚本的静态插画。
- `.ca/screenshots/pelican-offline-file-test.png`：离线 file 页面。

## 验证限制与遗留项

- 只在上述 Chromium 环境验证，没有实际测试 Firefox、Safari 或手机设备的浏览器。
- 无头 Chromium 中切换页签后，页面仍报告为可见；尝试的可见性覆盖协议也不受该版本支持。因此 T-07 明确采用属性与事件模拟验证调度逻辑，未宣称通过真实操作系统页签切换验证。
- 无障碍验证覆盖 SVG 名称／描述、按钮键盘操作及焦点样式，没有进行屏幕阅读器实机测试。
- 本次目标范围内无未修复的功能缺陷；上述限制应在后续评审中保留。
