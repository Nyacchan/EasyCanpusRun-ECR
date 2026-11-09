// 自检：这条数据流像不像真人跑的
const Y = require('./core.js');
const { CENTER, R, L } = require('./gen_run.js');
const fs = require('fs');
const path = require('path');

// 用法: node validate_run.js [csv路径]
// 不传参则读脚本同目录下的 run_stream.csv
const argFile = process.argv[2];
const csvPath = argFile ? path.resolve(argFile) : path.join(__dirname, 'run_stream.csv');

if (!fs.existsSync(csvPath)) {
  console.error('找不到数据文件: ' + csvPath);
  console.error('用法: node validate_run.js [csv路径]');
  console.error('      或先生成一份: node gen_run.js --m=2110 --out=run_stream.csv');
  process.exit(1);
}

const lines = fs.readFileSync(csvPath, 'utf8').trim().split('\n').slice(1);
const rows = lines.map(l => {
  const [t, dist, speed, pace, lat, lng, lane] = l.split(',').map(Number);
  return { t, dist, speed, pace, lat, lng, lane };
});

const pass = [], fail = [];
const chk = (ok, name, detail) => (ok ? pass : fail).push(name + (detail ? '  ' + detail : ''));

// 期望配速（秒/公里）。gen_run.js 默认 basePace=495，弯道降速 4.5% 后平均约 508（8'28"）
// 想校验别的配速：node validate_run.js x.csv 530
const EXPECT_PACE = Number(process.argv[3] || 0) || 495 * 1.027;
const EXPECT_SPEED = 1000 / EXPECT_PACE;

// 1) 步进距离
const steps = [];
for (let i = 1; i < rows.length; i++) {
  steps.push(Y.haversine(rows[i - 1], rows[i]));
}
const mean = steps.reduce((a, b) => a + b, 0) / steps.length;
const sd = Math.sqrt(steps.reduce((a, b) => a + (b - mean) ** 2, 0) / steps.length);
chk(mean > EXPECT_SPEED * 0.8 && mean < EXPECT_SPEED * 1.25, '步进距离合理',
  'mean=' + mean.toFixed(2) + 'm sd=' + sd.toFixed(2) + 'm 期望≈' + EXPECT_SPEED.toFixed(2) + 'm');
chk(sd < 0.45, '步进抖动小（不跳点）', 'sd=' + sd.toFixed(3) + 'm');
chk(Math.min(...steps) > EXPECT_SPEED * 0.6 && Math.max(...steps) < EXPECT_SPEED * 1.6, '无异常步长',
  'min=' + Math.min(...steps).toFixed(2) + ' max=' + Math.max(...steps).toFixed(2));

// 2) 横向偏离：到跑道中心线的距离
const { pointAt } = require('./gen_run.js');
let maxOff = 0;
for (const r of rows) {
  // 用最近点搜索估算到中心线距离
  let best = 1e9;
  for (let d = 0; d < 2 * L + 2 * Math.PI * R; d += 0.5) {
    const p = pointAt(d);
    const g = Y.offset(CENTER.lat, CENTER.lng, p.y, p.x);
    const m = Y.haversine(g, r) ;
    if (m < best) best = m;
  }
  if (best > maxOff) maxOff = best;
}
// 一条跑道宽 1.22 m，半道宽 0.61 m；再加上车道漂移 0.28 m 和 GPS 抖动，
// 一条道内跑到 0.95 m 仍属正常，超过就是明显换道了
chk(maxOff < 0.95, '始终贴在同一条道上（不换道）', '最大横向偏离 ' + maxOff.toFixed(2) + 'm (上限 0.95m)');

// 3) 配速
const totalM = rows[rows.length - 1].dist;
const totalT = rows[rows.length - 1].t;
const pace = totalT / (totalM / 1000);
const fmtPace = s => Math.floor(s / 60) + "'" + String(Math.round(s % 60)).padStart(2, '0') + '"';
chk(pace > EXPECT_PACE - 30 && pace < EXPECT_PACE + 30 && pace > 380 && pace < 560,
  '整体配速接近 ' + fmtPace(EXPECT_PACE), fmtPace(pace) + '/km');

// 4) 每公里分段
const splits = [];
let acc = 0, lastT = 0;
for (let i = 1; i < rows.length; i++) {
  acc += steps[i - 1];
  if (acc >= 1000) { splits.push(rows[i].t - lastT); lastT = rows[i].t; acc = 0; }
}
if (splits.length) {
  chk(Math.max(...splits) - Math.min(...splits) < 90, '分段配速稳定', splits.map(fmtPace).join(' / '));
}

// 5) 速度范围
const sp = rows.map(r => r.speed);
chk(Math.min(...sp) > EXPECT_SPEED * 0.75 && Math.max(...sp) < EXPECT_SPEED * 1.45, '瞬时速度合理',
  Math.min(...sp).toFixed(2) + '~' + Math.max(...sp).toFixed(2) + ' m/s 期望≈' + EXPECT_SPEED.toFixed(2));

// 6) 采样频率
const dts = [];
for (let i = 1; i < rows.length; i++) dts.push(rows[i].t - rows[i - 1].t);
chk(Math.abs(dts.reduce((a, b) => a + b, 0) / dts.length - 1) < 0.01, '1 Hz 采样', '平均 ' + (dts.reduce((a, b) => a + b, 0) / dts.length).toFixed(3) + 's');

console.log('=== 自检结果 ===');
pass.forEach(p => console.log('  [通过] ' + p));
fail.forEach(f => console.log('  [失败] ' + f));
console.log('\n合计 ' + (pass.length + fail.length) + ' 项，通过 ' + pass.length + '，失败 ' + fail.length);
process.exit(fail.length ? 1 : 0);
