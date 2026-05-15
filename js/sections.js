/* ============================================================
   sections.js  —  GB/T 706 型钢数据 + 截面特性计算
   ============================================================ */
window.SB = window.SB || {};

/* ── 材料强度 (t ≤ 16 mm, GB 50017-2017 表 4.4.1) ── */
SB.MATERIALS = {
  Q235: { fy: 235, f: 215, E: 206000, G: 79000 },
  Q345: { fy: 345, f: 305, E: 206000, G: 79000 },
  Q390: { fy: 390, f: 350, E: 206000, G: 79000 },
  Q420: { fy: 420, f: 380, E: 206000, G: 79000 },
  Q460: { fy: 460, f: 410, E: 206000, G: 79000 },
};

/* ── 热轧工字钢 (GB/T 706-2016) ──
   单位: h,b,tw,tf,r → mm;  A → cm²;  Ix,Iy → cm⁴;  Wx,Wy → cm³;  ix,iy → cm
*/
SB.PROFILES_I = [
  { name:'I10',   h:100, b:68,  tw:4.5, tf:7.6,  r:6.5, A:14.3,  Ix:245,   Iy:26.1,  Wx:49.0,  Wy:7.68,  ix:4.14, iy:1.35 },
  { name:'I12.6', h:126, b:74,  tw:5.0, tf:8.4,  r:7.0, A:18.14, Ix:488,   Iy:34.4,  Wx:77.5,  Wy:9.30,  ix:5.19, iy:1.38 },
  { name:'I14',   h:140, b:80,  tw:5.5, tf:9.1,  r:7.0, A:21.5,  Ix:712,   Iy:45.4,  Wx:102,   Wy:11.4,  ix:5.75, iy:1.45 },
  { name:'I16',   h:160, b:88,  tw:6.0, tf:9.9,  r:8.0, A:26.1,  Ix:1130,  Iy:62.7,  Wx:141,   Wy:14.3,  ix:6.58, iy:1.55 },
  { name:'I18',   h:180, b:94,  tw:6.5, tf:10.7, r:8.0, A:30.6,  Ix:1660,  Iy:81.0,  Wx:185,   Wy:17.2,  ix:7.37, iy:1.63 },
  { name:'I20a',  h:200, b:100, tw:7.0, tf:11.4, r:9.0, A:35.5,  Ix:2370,  Iy:104,   Wx:237,   Wy:20.8,  ix:8.17, iy:1.71 },
  { name:'I20b',  h:200, b:102, tw:9.0, tf:11.4, r:9.0, A:39.5,  Ix:2500,  Iy:115,   Wx:250,   Wy:22.6,  ix:7.96, iy:1.71 },
  { name:'I22a',  h:220, b:110, tw:7.5, tf:12.3, r:9.5, A:42.0,  Ix:3400,  Iy:145,   Wx:309,   Wy:26.4,  ix:9.00, iy:1.86 },
  { name:'I25a',  h:250, b:116, tw:8.0, tf:13.0, r:10,  A:48.5,  Ix:5020,  Iy:185,   Wx:401,   Wy:31.9,  ix:10.2, iy:1.95 },
  { name:'I25b',  h:250, b:118, tw:10,  tf:13.0, r:10,  A:53.5,  Ix:5280,  Iy:202,   Wx:422,   Wy:34.2,  ix:9.93, iy:1.94 },
  { name:'I28a',  h:280, b:122, tw:8.5, tf:13.7, r:10.5,A:55.5,  Ix:7110,  Iy:233,   Wx:508,   Wy:38.2,  ix:11.3, iy:2.05 },
  { name:'I32a',  h:320, b:130, tw:9.5, tf:15.0, r:11,  A:67.1,  Ix:11100, Iy:319,   Wx:692,   Wy:49.0,  ix:12.8, iy:2.18 },
  { name:'I32b',  h:320, b:132, tw:11.5,tf:15.0, r:11,  A:73.4,  Ix:11600, Iy:345,   Wx:725,   Wy:52.3,  ix:12.6, iy:2.17 },
  { name:'I36a',  h:360, b:136, tw:10.0,tf:15.8, r:11.5,A:76.4,  Ix:15700, Iy:394,   Wx:872,   Wy:57.9,  ix:14.3, iy:2.27 },
  { name:'I40a',  h:400, b:142, tw:10.5,tf:16.5, r:12,  A:86.1,  Ix:21700, Iy:487,   Wx:1090,  Wy:68.6,  ix:15.9, iy:2.38 },
  { name:'I40b',  h:400, b:144, tw:12.5,tf:16.5, r:12,  A:95.1,  Ix:22800, Iy:528,   Wx:1140,  Wy:73.3,  ix:15.5, iy:2.36 },
  { name:'I45a',  h:450, b:150, tw:11.5,tf:18.0, r:13,  A:102,   Ix:32200, Iy:654,   Wx:1430,  Wy:87.2,  ix:17.8, iy:2.53 },
  { name:'I50a',  h:500, b:158, tw:12.0,tf:19.0, r:14,  A:117,   Ix:44900, Iy:844,   Wx:1800,  Wy:107,   ix:19.6, iy:2.69 },
  { name:'I56a',  h:560, b:166, tw:12.5,tf:20.0, r:15,  A:135,   Ix:63300, Iy:1090,  Wx:2260,  Wy:131,   ix:21.7, iy:2.84 },
  { name:'I63a',  h:630, b:176, tw:13.0,tf:20.5, r:16,  A:153,   Ix:87700, Iy:1380,  Wx:2780,  Wy:157,   ix:23.9, iy:3.00 },
];

/* ── 热轧槽钢 (GB/T 706-2016) ──
   z0: 形心到腹板外侧距离 (cm)
*/
SB.PROFILES_C = [
  { name:'[5',    h:50,  b:37, tw:4.5, tf:7.0, r:6.0, A:6.93,  Ix:26.1,  Iy:5.57,  Wx:10.4, Wy:2.17, ix:1.94, iy:0.90, z0:1.37 },
  { name:'[6.3',  h:63,  b:40, tw:4.8, tf:7.5, r:6.5, A:8.45,  Ix:47.7,  Iy:7.86,  Wx:15.2, Wy:2.79, ix:2.38, iy:0.96, z0:1.37 },
  { name:'[8',    h:80,  b:43, tw:5.0, tf:8.0, r:7.0, A:10.2,  Ix:82.0,  Iy:10.8,  Wx:20.5, Wy:3.53, ix:2.83, iy:1.03, z0:1.37 },
  { name:'[10',   h:100, b:48, tw:5.3, tf:8.5, r:7.5, A:12.7,  Ix:145,   Iy:15.5,  Wx:29.0, Wy:4.49, ix:3.37, iy:1.11, z0:1.47 },
  { name:'[12.6', h:126, b:53, tw:5.5, tf:9.0, r:8.0, A:15.7,  Ix:267,   Iy:21.8,  Wx:42.4, Wy:5.63, ix:4.12, iy:1.18, z0:1.52 },
  { name:'[14a',  h:140, b:58, tw:6.0, tf:9.5, r:8.0, A:19.2,  Ix:394,   Iy:30.4,  Wx:56.3, Wy:7.09, ix:4.53, iy:1.26, z0:1.57 },
  { name:'[16a',  h:160, b:63, tw:6.5, tf:10.0,r:8.5, A:22.5,  Ix:576,   Iy:40.2,  Wx:72.0, Wy:8.56, ix:5.06, iy:1.34, z0:1.64 },
  { name:'[18a',  h:180, b:68, tw:7.0, tf:10.5,r:9.0, A:25.7,  Ix:808,   Iy:52.4,  Wx:89.8, Wy:10.3, ix:5.61, iy:1.43, z0:1.72 },
  { name:'[20a',  h:200, b:73, tw:7.0, tf:11.0,r:9.0, A:28.8,  Ix:1100,  Iy:66.8,  Wx:110,  Wy:12.2, ix:6.18, iy:1.52, z0:1.80 },
  { name:'[22a',  h:220, b:77, tw:7.0, tf:11.5,r:9.5, A:31.8,  Ix:1430,  Iy:80.6,  Wx:130,  Wy:13.8, ix:6.71, iy:1.59, z0:1.85 },
  { name:'[25a',  h:250, b:78, tw:7.0, tf:12.0,r:10,  A:34.9,  Ix:1950,  Iy:88.0,  Wx:156,  Wy:14.8, ix:7.48, iy:1.59, z0:1.77 },
  { name:'[28a',  h:280, b:82, tw:7.5, tf:12.5,r:10.5,A:39.4,  Ix:2700,  Iy:108,   Wx:193,  Wy:17.2, ix:8.29, iy:1.66, z0:1.84 },
  { name:'[32a',  h:320, b:88, tw:8.0, tf:13.5,r:11,  A:46.8,  Ix:4060,  Iy:142,   Wx:254,  Wy:20.9, ix:9.32, iy:1.74, z0:1.90 },
  { name:'[36a',  h:360, b:96, tw:9.0, tf:14.5,r:11.5,A:55.6,  Ix:5950,  Iy:192,   Wx:331,  Wy:25.8, ix:10.4, iy:1.86, z0:2.00 },
  { name:'[40a',  h:400, b:100,tw:10.5,tf:15.0,r:12,  A:64.3,  Ix:8070,  Iy:235,   Wx:404,  Wy:29.9, ix:11.2, iy:1.91, z0:2.02 },
];

/* ── 根据几何参数计算截面特性（自定义截面时） ── */
SB.computeCustomProps = function(type, p) {
  var h  = p.h;          // mm
  var b  = p.b;          // mm
  var tw = p.tw;         // mm
  var tf = p.tf;         // mm
  var r  = p.r || 0;     // mm

  // 单位统一 → cm 计算
  var hc = h / 10, bc = b / 10, twc = tw / 10, tfc = tf / 10, rc = r / 10;
  var h0c = hc - 2 * tfc;  // 腹板净高 cm

  var A, Ix, Iy, Wx, Wy, ix, iy;

  if (type === 'I') {
    // 双轴对称工字钢 (忽略圆角简化)
    A  = 2 * bc * tfc + h0c * twc;
    Ix = (bc * Math.pow(hc, 3) - (bc - twc) * Math.pow(h0c, 3)) / 12;
    Iy = (2 * tfc * Math.pow(bc, 3) + h0c * Math.pow(twc, 3)) / 12;
    Wx = 2 * Ix / hc;
    Wy = 2 * Iy / bc;
    ix = Math.sqrt(Ix / A);
    iy = Math.sqrt(Iy / A);
  } else {
    // 槽钢 (简化，单轴对称)
    A  = 2 * bc * tfc + h0c * twc;
    Ix = (twc * Math.pow(hc, 3) + 2 * bc * Math.pow(tfc, 3)) / 12
       + 2 * bc * tfc * Math.pow((hc - tfc) / 2, 2);
    // 简化 Ix
    Ix = (twc * Math.pow(h0c, 3)) / 12
       + 2 * (bc * Math.pow(tfc, 3) / 12 + bc * tfc * Math.pow((h0c + tfc) / 2, 2));

    // Iy: 腹板 + 两翼缘 (翼缘关于腹板外侧偏心)
    var yc_web = twc / 2;
    var yc_flange = bc / 2;
    // 形心 y0 从腹板外侧
    var y0 = (h0c * twc * twc / 2 + 2 * bc * tfc * bc / 2) / A;
    Iy = (h0c * Math.pow(twc, 3) / 12 + h0c * twc * Math.pow(y0 - twc / 2, 2))
       + 2 * (tfc * Math.pow(bc, 3) / 12 + bc * tfc * Math.pow(bc / 2 - y0, 2));

    Wx = 2 * Ix / hc;
    Wy = Iy / Math.max(y0, bc - y0);
    ix = Math.sqrt(Ix / A);
    iy = Math.sqrt(Iy / A);
  }

  // 扭转常数 It (薄壁近似) cm⁴
  var It = (2 * bc * Math.pow(tfc, 3) + h0c * Math.pow(twc, 3)) / 3;

  // 翘曲常数 Iw cm⁶ (工字钢)
  var Iw;
  if (type === 'I') {
    Iw = Iy * Math.pow(hc - tfc, 2) / 4;
  } else {
    // 槽钢翘曲常数简化
    Iw = (Math.pow(hc - tfc, 2) * Iy) / 4 * 0.5; // 粗略近似
  }

  return {
    type: type,
    h: h, b: b, tw: tw, tf: tf, r: r,
    A: +A.toFixed(2),
    Ix: +Ix.toFixed(1),
    Iy: +Iy.toFixed(2),
    Wx: +Wx.toFixed(1),
    Wy: +Wy.toFixed(2),
    ix: +ix.toFixed(2),
    iy: +iy.toFixed(2),
    It: +It.toFixed(3),
    Iw: +Iw.toFixed(1),
    z0: type === 'C' ? +(Iy > 0 ? y0 : 0).toFixed(2) : 0,
  };
};

/* ── 从型钢表取截面，并补充 It / Iw ── */
SB.getProfileProps = function(type, name) {
  var list = type === 'I' ? SB.PROFILES_I : SB.PROFILES_C;
  var p = null;
  for (var i = 0; i < list.length; i++) {
    if (list[i].name === name) { p = Object.assign({}, list[i]); break; }
  }
  if (!p) return null;
  p.type = type;

  // 补充 It / Iw（薄壁近似，单位 cm）
  var hc = p.h / 10, bc = p.b / 10, twc = p.tw / 10, tfc = p.tf / 10;
  var h0c = hc - 2 * tfc;
  p.It = +((2 * bc * Math.pow(tfc, 3) + h0c * Math.pow(twc, 3)) / 3).toFixed(3);
  if (type === 'I') {
    p.Iw = +(p.Iy * Math.pow(hc - tfc, 2) / 4).toFixed(1);
  } else {
    p.Iw = +(Math.pow(hc - tfc, 2) * p.Iy / 4 * 0.5).toFixed(1);
  }
  return p;
};

/* ── 获取截面特性（统一入口）── */
SB.getSectionProps = function(type, source, profileName, customParams) {
  if (source === 'table') {
    return SB.getProfileProps(type, profileName);
  } else {
    return SB.computeCustomProps(type, customParams);
  }
};
