// 矩形区域判定工具 — 多个关卡用 BRIGHT/DARK/SUPPLY 等 zone 描述布局。

export function isInRect(col, row, zone) {
  return (
    col >= zone.col &&
    col < zone.col + zone.width &&
    row >= zone.row &&
    row < zone.row + zone.height
  );
}

export function isInAnyZone(col, row, zones) {
  return zones.some((zone) => isInRect(col, row, zone));
}