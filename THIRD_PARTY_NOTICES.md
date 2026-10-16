# 参考与依赖

本项目独立实现WPF/Python/SQLite宿主与个人学习数据模型，未复制完整在线学习网站。

- Microsoft [WebView2Samples](https://github.com/MicrosoftEdge/WebView2Samples)：只参考WPF初始化及宿主边界；SDK固定 `Microsoft.Web.WebView2 1.0.4191.47`，沿用本机英语工具已使用的版本。
- [Exercism C++](https://exercism.org/tracks/cpp/exercises) 与 [freeCodeCamp](https://www.freecodecamp.org/learn)：仅作为信息层级、课程目录与搜索交互参考。用户明确不要求复刻。最终用章节筛选及分页卡片目录解决横向长栏的定位问题；没有复制其品牌、整站代码、注册或判题流程。
- [Marked](https://github.com/markedjs/marked) `15.0.12`：MIT，渲染现有Markdown；[许可证](app/vendor/MARKED-LICENSE.md)。
- [DOMPurify](https://github.com/cure53/DOMPurify) `3.2.6`：Apache-2.0 OR MPL-2.0，清洗Markdown生成的HTML；[许可证](app/vendor/DOMPURIFY-LICENSE)。
- [PrismJS](https://github.com/PrismJS/prism) `1.30.0`：MIT，只打包core/clike/c/cpp；[许可证](app/vendor/PRISM-LICENSE)。
- [PyMuPDF](https://pymupdf.readthedocs.io/) `1.28.0`：本机资料导入时渲染PDF，运行时日常阅读无需加载；AGPL/商业双许可。此交付用于个人本地使用，若对外分发需另行核对其许可义务。

浏览器组件已本地打包，不使用运行时CDN。`app/vendor/manifest.json` 记录固定下载URL和文件SHA-256。未运行第三方npm生命周期脚本。图标为本项目原创几何图案。

## 动效参考与许可

- [alexruix / tame-fly-42](https://uiverse.io/alexruix/tame-fly-42)：MIT。`app/motion.css` 的小球跳台阶加载动画依据该作品改写，缩放尺寸并适配暖纸配色；WPF启动页以原生图形重新实现同一意象。许可全文如下。
- React Bits 的 [Animated Content](https://reactbits.dev/animations/animated-content)、[Spotlight Card](https://reactbits.dev/components/spotlight-card) 和 [Stepper](https://reactbits.dev/components/stepper)：参考内容依次入场、指针聚光及状态步骤的交互思路，使用原生 Web Animations API/CSS 独立实现，未引入 React、GSAP 或第三方脚本。
- [MotionSites](https://motionsites.ai/)：参考公开首页呈现的柔和光感与界面层次。未复制付费模板、视频或提示词；本项目没有运行时联网依赖。

MIT License — Copyright - 2026 alexruix (Alex Ruiz)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
