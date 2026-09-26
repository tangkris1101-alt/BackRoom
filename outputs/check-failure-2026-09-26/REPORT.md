# `npm run check` 相关排查

日期：2026-09-26

## 结论

`npm run check` **本身没有失败**（退出码 0，10 个检查脚本全绿）。真正报错的是**另一条检查**：

```
npm run changelog:check   →   退出码 1
Changelog snapshot is stale. Run: npm.cmd run changelog:sync
```

`src/ui/changelog.js` 是由 `scripts/sync-changelog.mjs` 从 `git log` 生成的前 12 条提交快照，用于游戏内的更新日志弹窗。仓库里有 4 个新提交（由另一会话提交）没有回写：

| commit | 标题 |
|---|---|
| `2564604` | fix: keep the player supported while walking to a platform edge |
| `a1a92f6` | test: build every level scene inside the check chain |
| `d33086a` | feat: add Level 1 workbench drawers |
| `b35967b` | perf: drive the hound stun glow by intensity instead of visibility |

快照最新一条仍是 `3dbe91b`，因此 `--check` 判定过期。该脚本的 `--check` 模式**以非零退出码报告陈旧**，CI 或串行脚本链会因此中断。

## 处理

```
npm run changelog:sync -- \
  --zh 2564604="修复走向平台边缘时角色失去支撑的问题" \
  --zh a1a92f6="把每层场景构建纳入检查链" \
  --zh d33086a="新增 Level 1 工作台抽屉" \
  --zh b35967b="猎犬眩晕辉光改为按强度驱动而非可见性"
```

- 生成 12 条快照（与旧快照同长度），已有条目的中文标题按原样复用，只补了 4 条新条目；
- 随后 `npm run build` 重建独立版，使打包进 UI 的更新日志与仓库一致（这与仓库里 `chore: sync changelog and standalone build` 的既有流程一致）。

## 验证

| 命令 | 结果 |
|---|---|
| `npm run check` | 退出码 0；encoding / content-expansion / material-quality / platform-collision / prop-collision / item-ground-shadows / realism-systems / hands / scenes（16 层 × 2 次构建）/ lights（16 层行走）全部 passed |
| `npm run changelog:check` | 退出码 0，`Changelog snapshot is current (12 entries)` |
| `node --test tests/*.test.mjs` | 21 项全通过 |
| `npm run test:accounts` | 9 项全通过 |
| `npm run build` | 在线版 + 独立版 + 内置检查通过 |

## 关于 `--localstorage-file` 警告（非问题）

运行时会出现：

```
(node:xxxx) Warning: `--localstorage-file` was provided without a valid path
```

来源已确认：**Node 25 自带的 webstorage**。这些脚本（`check-content-expansion`、`check-level-scene-load`、`check-light-count-stability`，以及 `node --test`）会访问全局 `localStorage`，Node 在没有配置持久化文件时就会打印这条警告。项目里没有任何地方传入该标志（全仓库检索为空），它不影响检查结果。若要消除，可在这些脚本的 npm 命令上补 `--localstorage-file=<临时路径>`；本轮未改，避免把环境噪音写进脚本。

## 备注

`changelog:check` 不在 `npm run check` 的链里（`check` = encoding → content-expansion → material-quality → platform-collision → prop-collision → item-ground-shadows → realism-systems → hands → scenes → lights）。如果你希望"一次全查"，可以把 `changelog:check` 也接进 `check` 链尾，或单独在提交前跑一次——要加的话我来改。
