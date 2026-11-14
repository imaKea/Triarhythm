import { describe, it, expect } from 'vitest';
import {
  TRI_RING_LAYOUT,
  getHexagonVertices,
  getEllipseBoundaryPoints,
  layoutToPixels,
  pixelsToLayout
} from '../src/config/layout.config.js';

/**
 * Khoảng cách từ điểm P đến đoạn thẳng AB
 */
function distPointToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);

  let u = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  u = Math.max(0, Math.min(1, u));
  const cx = ax + u * dx;
  const cy = ay + u * dy;
  return Math.hypot(px - cx, py - cy);
}

/**
 * Khoảng cách nhỏ nhất giữa hai đoạn thẳng [A, B] và [C, D]
 */
function distSegmentToSegment(ax, ay, bx, by, cx, cy, dx, dy) {
  // Kiểm tra nếu hai đoạn cắt nhau
  const ccw = (x1, y1, x2, y2, x3, y3) =>
    (y3 - y1) * (x2 - x1) > (y2 - y1) * (x3 - x1);

  const intersects =
    ccw(ax, ay, cx, cy, dx, dy) !== ccw(bx, by, cx, cy, dx, dy) &&
    ccw(ax, ay, bx, by, cx, cy) !== ccw(ax, ay, bx, by, dx, dy);

  if (intersects) return 0;

  return Math.min(
    distPointToSegment(ax, ay, cx, cy, dx, dy),
    distPointToSegment(bx, by, cx, cy, dx, dy),
    distPointToSegment(cx, cy, ax, ay, bx, by),
    distPointToSegment(dx, dy, ax, ay, bx, by)
  );
}

/**
 * Kiểm tra điểm P có nằm trong đa giác lồi/bất kỳ bằng Ray Casting
 */
function isPointInPolygon(px, py, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Khoảng cách nhỏ nhất giữa hai đa giác (hoặc 0 nếu chồng/giao nhau)
 */
function minDistanceBetweenPolygons(polyA, polyB) {
  // 1. Kiểm tra lồng nhau
  if (isPointInPolygon(polyA[0].x, polyA[0].y, polyB)) return 0;
  if (isPointInPolygon(polyB[0].x, polyB[0].y, polyA)) return 0;

  let minDist = Infinity;
  const lenA = polyA.length;
  const lenB = polyB.length;

  for (let i = 0; i < lenA; i++) {
    const a1 = polyA[i];
    const a2 = polyA[(i + 1) % lenA];

    for (let j = 0; j < lenB; j++) {
      const b1 = polyB[j];
      const b2 = polyB[(j + 1) % lenB];

      const d = distSegmentToSegment(a1.x, a1.y, a2.x, a2.y, b1.x, b1.y, b2.x, b2.y);
      if (d === 0) return 0;
      if (d < minDist) minDist = d;
    }
  }

  return minDist;
}

/**
 * Khoảng cách nhỏ nhất từ một tia/đoạn thẳng [Origin -> Target] tới đa giác hình học
 */
function minDistanceRayToPolygon(ox, oy, tx, ty, polygon) {
  let minDist = Infinity;
  const len = polygon.length;

  for (let i = 0; i < len; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % len];
    const d = distSegmentToSegment(ox, oy, tx, ty, p1.x, p1.y, p2.x, p2.y);
    if (d < minDist) minDist = d;
  }

  return minDist;
}

describe('Geometry Unit Tests - Vòng tam giác ngược triRing9', () => {
  const SAMPLES = 72; // Độ phân giải lấy mẫu elip

  // Danh sách đa giác 9 ô Tap
  const tapPolygons = TRI_RING_LAYOUT.tapLanes.map(lane => ({
    lane: lane.lane,
    label: `Tap Lane ${lane.lane} (${lane.label})`,
    center: { x: lane.x, y: lane.y },
    poly: getEllipseBoundaryPoints(lane, SAMPLES)
  }));

  // Danh sách đa giác 3 Slide Node
  const nodePolygons = TRI_RING_LAYOUT.slideNodes.map(node => ({
    id: node.id,
    label: `Slide Node S${node.id} (${node.name})`,
    center: { x: node.x, y: node.y },
    poly: getHexagonVertices(node.x, node.y, node.radius)
  }));

  it('(1) Không có hai ô Tap nào chồng lên nhau và khoảng hở giữa chúng >= 0.03', () => {
    let minGapBetweenTaps = Infinity;
    const violations = [];

    for (let i = 0; i < tapPolygons.length; i++) {
      for (let j = i + 1; j < tapPolygons.length; j++) {
        const gap = minDistanceBetweenPolygons(tapPolygons[i].poly, tapPolygons[j].poly);
        if (gap < minGapBetweenTaps) minGapBetweenTaps = gap;

        if (gap < 0.03) {
          violations.push({
            pair: `${tapPolygons[i].label} <-> ${tapPolygons[j].label}`,
            gap: gap.toFixed(4)
          });
        }
      }
    }

    expect(violations, `Phát hiện ô Tap bị chồng/quá sát: ${JSON.stringify(violations)}`).toEqual([]);
    expect(minGapBetweenTaps).toBeGreaterThanOrEqual(0.03);
    console.log(`[Geometry] Khoảng cách nhỏ nhất giữa các cặp ô Tap: ${minGapBetweenTaps.toFixed(4)} >= 0.03 (ĐẠT)`);
  });

  it('(1b) Không có ô Tap nào chồng lên Slide Node (hexagon) và khoảng hở >= 0.03', () => {
    let minGapTapNode = Infinity;
    const violations = [];

    for (const tap of tapPolygons) {
      for (const node of nodePolygons) {
        const gap = minDistanceBetweenPolygons(tap.poly, node.poly);
        if (gap < minGapTapNode) minGapTapNode = gap;

        if (gap < 0.03) {
          violations.push({
            pair: `${tap.label} <-> ${node.label}`,
            gap: gap.toFixed(4)
          });
        }
      }
    }

    expect(violations, `Phát hiện ô Tap và Slide Node bị chồng/quá sát: ${JSON.stringify(violations)}`).toEqual([]);
    expect(minGapTapNode).toBeGreaterThanOrEqual(0.03);
    console.log(`[Geometry] Khoảng cách nhỏ nhất giữa ô Tap và Slide Node: ${minGapTapNode.toFixed(4)} >= 0.03 (ĐẠT)`);
  });

  it('(2) In khoảng cách tối thiểu từ mỗi tia bay (origin -> tâm đích) tới các ô khác', () => {
    const origin = TRI_RING_LAYOUT.origin;
    const allTargets = [
      ...tapPolygons.map(t => ({ id: `Tap ${t.lane} (${t.label})`, center: t.center, poly: t.poly })),
      ...nodePolygons.map(n => ({ id: `Node S${n.id}`, center: n.center, poly: n.poly }))
    ];

    console.log('\n======================================================================');
    console.log(' BẢNG KHOẢNG CÁCH TỐI THIỂU TỪ TIA BAY (ORIGIN -> ĐÍCH) TỚI CÁC Ô KHÁC');
    console.log('======================================================================');

    const clearanceResults = [];

    for (let i = 0; i < allTargets.length; i++) {
      const target = allTargets[i];
      let minRayDist = Infinity;
      let closestOther = '';

      for (let j = 0; j < allTargets.length; j++) {
        if (i === j) continue;
        const other = allTargets[j];
        const dist = minDistanceRayToPolygon(origin.x, origin.y, target.center.x, target.center.y, other.poly);
        if (dist < minRayDist) {
          minRayDist = dist;
          closestOther = other.id;
        }
      }

      clearanceResults.push({
        target: target.id,
        minDistanceToOther: minRayDist,
        closestObstacle: closestOther
      });

      console.log(`Tia -> ${target.id.padEnd(20)}: min clearance = ${minRayDist.toFixed(4)} (gần nhất: ${closestOther})`);
      expect(minRayDist).toBeGreaterThan(0);
    }
    console.log('======================================================================\n');
  });

  it('Hàm layoutToPixels và pixelsToLayout là nghịch đảo chính xác của nhau', () => {
    const w = 1280;
    const h = 720;
    const testPoints = [
      { x: 0, y: 0 },
      { x: -1.0, y: -0.577 },
      { x: 1.0, y: -0.577 },
      { x: 0, y: 1.155 },
      { x: 0.56, y: -0.577 },
      { x: -0.78, y: -0.196 }
    ];

    for (const pt of testPoints) {
      const pix = layoutToPixels(pt.x, pt.y, w, h);
      const rev = pixelsToLayout(pix.x, pix.y, w, h);
      expect(rev.x).toBeCloseTo(pt.x, 5);
      expect(rev.y).toBeCloseTo(pt.y, 5);
    }
  });
});
