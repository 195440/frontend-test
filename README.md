# frontend-test

一个可直接打开的 HTML 页面：SVG 绘制鹈鹕骑自行车的海边二维动画。

## 打开页面

下载或克隆项目后，在浏览器中直接打开根目录的 `index.html`。CSS、SVG 和 JavaScript 均包含在这个文件中，不需要安装依赖、构建或连接网络。

也可以在项目目录启动静态服务：

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

然后访问 `http://localhost:8000`。云端工作台中的预览地址由平台发布。

## 动画与控制

- 普通模式下自动播放，鹈鹕双脚交替踩踏，车轮转动，路面向后移动。
- 点击“暂停动画”保留当前姿态，点击“播放动画”继续；按钮支持键盘 Tab、Enter 和空格操作。
- 系统启用“减少动态效果”时默认保持静态，仍可手动播放。运行中切换为减少动态会暂停，关闭该偏好后保持当前播放选择。
- 页面隐藏时暂停调度，返回后根据播放选择恢复；不累计后台时间。
- 禁用 JavaScript 时仍显示完整静态插画，播放按钮隐藏。

SVG 使用固定坐标系等比缩放，支持桌面和手机布局。动画使用浏览器原生 `requestAnimationFrame`，没有外部图片、字体、第三方脚本或后端接口。

## 任务文档

- [需求分析](docs/tasks/pelican-bike/requirement.md)
- [设计方案](docs/tasks/pelican-bike/design.md)
- [测试报告](docs/tasks/pelican-bike/test.md)

## 验证

仓库没有构建、lint 或类型检查配置。已补充 [浏览器验收脚本](tests/pelican-browser.js)，供云端工作台已有的 Playwright 浏览器执行，不需要给页面安装依赖。

启动上述静态服务后，用浏览器工具 `browser_run_code_unsafe` 加载 `tests/pelican-browser.js`。脚本返回各项检查结果与通过／失败计数；截图保存到 `.ca/screenshots/`。脚本依赖浏览器工具提供的 `page`，不能通过直接运行 Node 来执行验收。

可以单独检查脚本语法：

```sh
node --check tests/pelican-browser.js
```

完整执行步骤、结果和验证限制见测试报告。
