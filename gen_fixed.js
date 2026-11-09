// 固定起终点：整数圈，终点回到起点
const Y = require('./core.js');
const fs = require('fs');
const path = require('path');

const CENTER = { lat: 28.345304, lng: 112.794749 };  // 长沙工业学院·操场中心（WGS-84）
const R = 40.2, L = 84.39, ROT = 90;
const PER = 2 * L + 2 * Math.PI * R;      // 单圈弧长
const LAPS = 5;
const TOTAL = PER * LAPS;                  // 5 圈 ≈ 2106.8 m
const SPEED = 1000 / 500;                  // 8'20"/km = 2.0 m/s
const HZ = 1;

function pointAt(dist) {
  const d = ((dist % PER) + PER) % PER;
  let x, y;
  if (d < L) { x = -L/2 + d; y = -R; }
  else if (d < L + Math.PI*R) { const a = (d-L)/R; x = L/2 + R*Math.sin(a); y = -R*Math.cos(a); }
  else if (d < 2*L + Math.PI*R) { x = L/2 - (d-L-Math.PI*R); y = R; }
  else { const a = (d-2*L-Math.PI*R)/R; x = -L/2 - R*Math.sin(a); y = R*Math.cos(a); }
  return { x, y };
}

const rows = [];
const n = Math.round(TOTAL / SPEED * HZ);
for (let i = 0; i < n; i++) {
  const t = i;
  const dist = Math.min(TOTAL, (i / HZ) * SPEED);
  const p = pointAt(dist);
  const g = Y.offset(CENTER.lat, CENTER.lng, p.y, p.x);
  rows.push({ t, dist: +dist.toFixed(2), speed: +SPEED.toFixed(3), pace: +(330/60).toFixed(3), lat: +g.lat.toFixed(7), lng: +g.lng.toFixed(7), lane: 0 });
}
// 终点精确回到起点
const end = rows[rows.length - 1];
const start = rows[0];
if (end.lat !== start.lat || end.lng !== start.lng) {
  rows.push({ t: rows.length, dist: +TOTAL.toFixed(2), speed: +SPEED.toFixed(3), pace: 5.5, lat: start.lat, lng: start.lng, lane: 0 });
}
const hdr = 't,dist,speed,pace,lat,lng,lane';
fs.writeFileSync(path.join(__dirname, 'run_fixed.csv'), hdr + '\n' + rows.map(r => [r.t,r.dist,r.speed,r.pace,r.lat,r.lng,r.lane].join(',')).join('\n'));
console.log('固定路线：' + LAPS + ' 圈 = ' + TOTAL.toFixed(0) + 'm，' + rows.length + ' 点，约 ' + Math.round(TOTAL/SPEED/60) + ' 分 ' + Math.round(TOTAL/SPEED%60) + ' 秒');
console.log('起点 = 终点 = ' + start.lat + ',' + start.lng);
