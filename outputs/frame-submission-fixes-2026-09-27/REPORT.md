# 每帧提交量修复：阴影重复提交、失效的抗锯齿、无效的 GTAO 降噪设置

日期：2026-09-27
前序报告：`outputs/level-one-gpu-load-audit-2026-09-27/REPORT.md`（Level 1 高负载排查）
现场：RTX 3070，Chrome 153，Level 1；测量分辨率为模拟本机 4K 的 3858×2298（8.87 MP）

---

## 一、结论

| 改动 | 结果 |
| --- | --- |
| 阴影贴图每帧被画两遍 | **已修**：每帧只刷新一次。该视野 draw call 1319 → 1288，帧时 6.60 → 5.94 ms（省 0.665 ms / 10%） |
| `antialias: true` 在高画质下完全无效 | **已修**：渲染器的 MSAA 只盖到 canvas 背缓冲，而它只收一个全屏四边形；改为按画质分配，并在 composer 末尾补一个 FXAA pass。硬台阶 −62.5%，最强台阶 −97.7%，只有 0.6% 的像素被改动，成本 +0.058 ms |
| `pdSamples = 8 / pdRings = 1` 从未生效 | **已确认并删除**（保留 addon 默认 16 samples / 2 rings）。理由是量出来的：两个设置在帧时上无差异（都在 0.1 ms 噪声内），但 8/1 的降噪确实更脏（0.68% 像素差 >1/255，是同设置重复截图本底 0.003% 的 200 倍） |

---

## 二、阴影贴图每帧画两遍

`WebGLRenderer.render()` 在函数开头无条件调用 `shadowMap.render()`（`WebGLRenderer.js:1698`），而一帧里 `renderer.render()` 被调了不止一次：RenderPass 画一遍场景，GTAO 的 GBuffer pass 又用 `MeshNormalMaterial` 把整个场景画第二遍（`GTAOPass.js:642`）。两次用的是同一组光源变换，产生的阴影贴图完全一样。

改法：

- `src/rendering-pipeline.js` 构造时 `renderer.shadowMap.autoUpdate = false`
- `render()` 里在 `composer.render()` 之前设一次 `renderer.shadowMap.needsUpdate = true`

灯架在 `update()` 里已经移动完毕，所以每帧一次就是正确次数。

实测（Level 1 最重视野，3858×2298，每臂 480 帧，四轮交错）：

| 状态 | draw call | 帧时 mean | 帧时 median |
| --- | --- | --- | --- |
| 旧：每次 render 都刷新 | 1319 | 6.600 ms | 6.2 ms |
| 新：每帧刷新一次 | 1288 | 5.935 ms | 5.6 ms |
| 阴影整个关掉 | 1257 | 5.640 ms | 5.4 ms |

- 该视野的阴影投射者 31 个，旧代码把它们提交两次 → 31 次纯浪费；整个阴影系统 62 次提交，现在只剩 31 次
- 阴影系统总成本 0.96 ms → 0.30 ms，**每帧省 0.665 ms**
- 这条修复没有观感代价：两次渲染的贴图内容在数学上完全相同

---

## 三、抗锯齿实际上没有生效

### 现状

`src/main.js:519` 传了 `antialias: true`，但 three 的 MSAA 只作用于默认帧缓冲。高画质下场景全部渲染进 composer 的离屏 target（`samples` 取 three 默认值 0），canvas 只收到 OutputPass 的一个全屏四边形——**几何边一条都没落在被 MSAA 的缓冲上**。等价于：白付一个多重采样背缓冲，一点抗锯齿都没换到。

低画质不走 composer（`rebuildComposer()` 在没有 `profile.gtao` 时直接返回），场景直接画到 canvas，那里的 MSAA 是真在起作用的。

### 改法

- `antialias: !getGraphicsProfile().gtao`：只在低画质这条"直画 canvas"的路径上保留 MSAA
- composer 末尾（OutputPass 之后）加一个 `ShaderPass(FXAAShader)`，`resolution` uniform 随 `setSize()` 一起更新

### 为什么不是 MSAA

给 composer 的 target 加 `samples: 4` 是对本机不安全的：那是一个全分辨率、半浮点、多重采样的 ping-pong RT 对，样本填充约等于把最贵的一遍乘以四。8.87 MP × 4 = 35 MP 的样本填充，比此前把这块卡顶到掉显示输出的 28.9 MP 测试场景还大。FXAA 实测 +0.058 ms（8.87 MP，仍在噪声内），是这个预算下唯一务实的选择。

### 效果

同一帧开关 FXAA 逐像素对比（Level 1 最重视野）：

| 指标 | 关 | 开 | 变化 |
| --- | --- | --- | --- |
| 平均 \|Laplacian\| | 0.330 | 0.285 | −13.6% |
| 硬台阶（\|lap\|>16） | 16,253 | 13,617 | −16.2% |
| 硬台阶（\|lap\|>32） | 5,566 | 2,085 | **−62.5%** |
| 硬台阶（\|lap\|>64） | 469 | 11 | **−97.7%** |
| 受影响像素（差 >1/255） | — | 0.60% | 其余画面未动 |
| 平均亮度 | 82.385 | 82.386 | 无偏移 |

只有 0.6% 的像素被改动 ⇒ 这不是"整体变糊"，而是把最刺眼的台阶磨掉了。对照图：`evidence/aa-compare.png`（第一人称手臂轮廓，4×）。

---

## 四、`pdSamples = 8 / pdRings = 1`：量完决定不启用

### 这两行本来就没生效

`pdSamples` / `pdRings` 在 r184 的 GTAOPass 里是**普通属性**（`GTAOPass.js:138`），shader 的 defines 只在 `updatePdMaterial()` 里生成。原来的写法只是赋值，编译出来的仍是 addon 默认的 `SAMPLES: 16` + 2 rings（实测 `defines.SAMPLE_VECTORS` 有 16 组向量）。

### 帧时：没有可测量的差别

3858×2298，每臂 480 帧，四轮交错：

| 设置 | 帧时 mean |
| --- | --- |
| 16 samples / 2 rings | 5.739 ms |
| 8 samples / 1 ring | 5.833 ms |
| 4 samples / 1 ring | 5.916 ms |

差异全在 ±0.1 ms 噪声内，而且"更省"的一侧还偏慢 ⇒ 没有收益可拿。原因与前序报告一致：composer 是**提交受限**而非填充受限（分辨率涨 7.8× 只带来 1.7× 时间），降噪是半分辨率的四边形，本来就不在关键路径上。

### 画质：8/1 确实更脏

把 AO 缓冲单独输出（`GTAOPass.OUTPUT.Denoise`）比，再取最终画面比，最差姿态下：

| 对比 | 平均差 | 最大差 | 差 >1/255 的像素 |
| --- | --- | --- | --- |
| 同设置重复截图（本底） | 0.0113 | 4/255 | 0.0030% |
| 8/1 vs 16/2（最终画面） | 0.0757 | 37/255 | 0.6839% |

**比本底高约 7 倍（像素计数高 200 倍）**，差异形态是散点（AO 噪点）而不是结构位移，见 `evidence/p7-compare.png`。

### 决定

保持 addon 默认 16 samples / 2 rings，并删掉那两行会造成误解的赋值，把结论写进注释。理由：收益量不出来，代价量得出来。

（若将来要上更弱的 GPU，正确改法是 `gtaoPass.updatePdMaterial({ samples: 8, rings: 1 })`，而不是直接给属性赋值。）

---

## 五、验证链

- `npm run check` 全绿（编码 / 内容 / 材质 / 平台碰撞 / 道具碰撞 / 地面阴影 / 真实度 / 手部 / 人体 / 线轴 / 自适应画质 / 32 次场景构建 / 16 关光源稳定性）
- `scripts/check-realism-systems.mjs` 新增断言：`shadowMap.autoUpdate = false`、`shadowMap.needsUpdate = true`、`composer.addPass(fxaaPass)`、FXAA resolution 更新、`antialias: !getGraphicsProfile().gtao`——防止这四条被改回去
- `node --test tests/*.test.mjs` → 24 pass / 0 fail
- `npm run build` 通过：standalone buildId `7f7ce66ab841`，24.80 MiB；web 入口 1814.5 KiB / gzip 447.1 KiB
- 真机（不是探针页）跑通两档画质，控制台 0 报错：
  - 高画质：`antialias=true gtao=true shadows=true drawCalls=974 fps=60`（`evidence/e2e-gameplay.png`）
  - 低画质：`antialias=false gtao=false shadows=false drawCalls=793`（无 composer，走 MSAA 路径）

---

## 六、复现与测量方法（临时探针已删除）

- 探针页 `tests/tmp-render-audit.html`：真实 `createBackroomsScene(1)` + 真实 `createRenderingPipeline`，通过给 `EffectComposer.prototype.render` / `GTAOPass.prototype.render` 打补丁拿到 pass 实例，从而在运行时 A/B 单个 pass
- Chrome 独立实例（`--remote-debugging-port`）+ Node 内置 WebSocket 直接说 CDP
- 帧时：`pipeline.render()` 后接 `gl.finish()`；每个 A/B 交错多轮取均值，避免热漂移落到单臂
- 画质：CDP 截图 + numpy 逐像素；**任何 A/B 都必须先测"同设置重复截图"的本底**，否则会把场景自身的动画差异当成改动效果
- 视野选择：先扫 45×33 网格找最重视野（col 3 / row 30 → 1288 draw call，最轻处 37，差 35×）
