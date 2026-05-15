/* ============================================================
   code.js  —  GB 50017-2017 计算核
   · 整体稳定系数 φb (附录 C)
   · 宽厚比限值 / 板件等级 (§3.5.1)
   · 抗弯强度 (§6.1.1)
   ============================================================ */
window.SB = window.SB || {};

/* ── εk = √(235/fy) ── */
SB.epsilon_k = function(fy) {
  return Math.sqrt(235 / fy);
};

/* ── 整体稳定系数 φb (附录 C.0.1 工字钢; C.0.4 槽钢) ──
   props : 截面特性 (含 type, h, b, tf, A, Wx, iy)
   lb    : 弱轴侧向支承间距 (mm)
   bb    : βb 等效弯矩系数
   fy    : 屈服强度 MPa
*/
SB.calcPhiB = function(props, lb, bb, fy) {
  // 单位换算 → cm
  var iy_cm = props.iy;          // cm
  var lb_cm = lb / 10;           // cm
  var h_cm  = props.h / 10;      // cm
  var t1_cm = props.tf / 10;     // cm
  var A_cm  = props.A;           // cm²
  var Wx_cm = props.Wx;          // cm³

  var lambda_y = lb_cm / iy_cm;
  var epsK = SB.epsilon_k(fy);
  var epsK2 = epsK * epsK;

  // φb 主公式 (工字钢, 附录 C.0.1)
  var coef    = 4320 * bb * epsK2;            // 4320·βb·εk²
  var term1   = coef / (lambda_y * lambda_y); // /λy²
  var term2   = (A_cm * h_cm) / Wx_cm;        // A·h/Wx
  var inner   = (lambda_y * t1_cm) / (4.4 * h_cm);
  var term3   = Math.sqrt(1 + inner * inner); // √(1+...)
  var phib    = term1 * term2 * term3;
  var channelFactor = 1.0;
  if (props.type === 'C') {
    channelFactor = 0.7;
    phib = phib * channelFactor;
  }

  var phib_raw = phib;
  var phib_eff = phib;
  var corrected = false;
  if (phib > 0.6) {
    phib_eff = 1.07 - 0.282 / phib;
    if (phib_eff > 1.0) phib_eff = 1.0;
    corrected = true;
  }

  return {
    // 输入
    lb_mm: lb, lb_cm: +lb_cm.toFixed(1),
    iy_cm: +iy_cm.toFixed(2),
    A_cm:  +A_cm.toFixed(2),
    h_cm:  +h_cm.toFixed(1),
    Wx_cm: +Wx_cm.toFixed(1),
    t1_cm: +t1_cm.toFixed(2),
    fy: fy,
    // 中间项
    lambda_y: +lambda_y.toFixed(2),
    epsK: +epsK.toFixed(3),
    epsK2: +epsK2.toFixed(4),
    bb: +bb.toFixed(3),
    coef: +coef.toFixed(1),                // 4320·βb·εk²
    term1: +term1.toFixed(4),              // coef/λy²
    term2: +term2.toFixed(3),              // A·h/Wx
    inner: +inner.toFixed(4),              // λy·t1/(4.4·h)
    term3: +term3.toFixed(4),              // √(1+inner²)
    channelFactor: channelFactor,
    // 结果
    phib_raw: +phib_raw.toFixed(4),
    phib_eff: +phib_eff.toFixed(4),
    corrected: corrected,
    formula: 'φb = (4320·βb·εk²/λy²)·(A·h/Wx)·√[1+(λy·t1/4.4h)²]' + (props.type === 'C' ? ' × 0.7' : '')
  };
};

/* ── 宽厚比限值 / 截面板件等级 (§3.5.1 表 3.5.1) ──
   工字钢 / 槽钢 受弯构件
   翼缘外伸：S1=9εk, S2=11εk, S3=13εk, S4=15εk, S5=20εk
   腹板纯弯：S1=65εk, S2=72εk, S3=93εk, S4=124εk, S5=250εk
*/
SB.checkLocalBuckling = function(props, fy) {
  var epsK = SB.epsilon_k(fy);

  // 翼缘外伸宽厚比 b1/tf；b1 = (b - tw)/2 (工字钢), b - tw (槽钢)
  var b1 = props.type === 'I' ? (props.b - props.tw) / 2 : (props.b - props.tw);
  var flange_ratio = b1 / props.tf;

  // 腹板高厚比 h0/tw
  var h0 = props.h - 2 * props.tf;
  var web_ratio = h0 / props.tw;

  // 限值
  var flangeLimits = [9, 11, 13, 15, 20].map(function(k){ return +(k * epsK).toFixed(2); });
  var webLimits    = [65, 72, 93, 124, 250].map(function(k){ return +(k * epsK).toFixed(2); });

  function classify(ratio, limits) {
    for (var i = 0; i < limits.length; i++) {
      if (ratio <= limits[i]) return 'S' + (i + 1);
    }
    return '超S5';
  }

  var flange_class = classify(flange_ratio, flangeLimits);
  var web_class    = classify(web_ratio, webLimits);

  // 综合等级取较低者
  var classOrder = ['S1','S2','S3','S4','S5','超S5'];
  var section_class = classOrder[Math.max(classOrder.indexOf(flange_class), classOrder.indexOf(web_class))];

  return {
    epsK: +epsK.toFixed(3),
    flange_ratio: +flange_ratio.toFixed(2),
    flange_limits: flangeLimits,
    flange_class: flange_class,
    web_ratio: +web_ratio.toFixed(2),
    web_limits: webLimits,
    web_class: web_class,
    section_class: section_class,
    pass: section_class !== '超S5'
  };
};

/* ── 抗弯强度 (§6.1.1) ──
   σ = Mx / (γx · Wnx) ≤ f
   γx (截面塑性发展系数): S1/S2/S3=1.05, S4=1.0, S5=不允许塑性发展取1.0
   注：教学简化，槽钢 γx = 1.05 (沿对称轴弯曲)
*/
SB.checkStrength = function(Mmax_kNm, props, f, section_class) {
  var Mx_Nmm = Mmax_kNm * 1e6;   // N·mm
  var Wnx_mm3 = props.Wx * 1000; // cm³ → mm³

  var gamma_x;
  if (section_class === 'S1' || section_class === 'S2' || section_class === 'S3') gamma_x = 1.05;
  else gamma_x = 1.0;

  var sigma = Mx_Nmm / (gamma_x * Wnx_mm3);    // MPa
  var ratio = sigma / f;
  return {
    gamma_x: gamma_x,
    sigma: +sigma.toFixed(2),
    f: f,
    ratio: +ratio.toFixed(3),
    pass: sigma <= f,
    formula: 'σ = Mx/(γx·Wnx) ≤ f'
  };
};

/* ── 整体稳定承载力 / 应力比 ──
   σ_stab = Mx / (φb · Wx) ≤ f
*/
SB.checkStability = function(Mmax_kNm, props, phib_eff, f) {
  var Mx_Nmm = Mmax_kNm * 1e6;
  var Wx_mm3 = props.Wx * 1000;
  var sigma = Mx_Nmm / (phib_eff * Wx_mm3);
  var Mb_kNm = phib_eff * props.Wx * f / 1000;  // kN·m
  return {
    sigma: +sigma.toFixed(2),
    Mb: +Mb_kNm.toFixed(2),
    ratio: +(sigma / f).toFixed(3),
    pass: sigma <= f,
    formula: 'σ = Mx/(φb·Wx) ≤ f'
  };
};

/* ── 一键完整分析 ── */
SB.runAnalysis = function(input) {
  // input: {sectionType, sectionSource, profileName, customParams, grade,
  //         L, l1, l2, supportType, loadCaseId, loadParams, loadPos}

  var props = SB.getSectionProps(input.sectionType, input.sectionSource, input.profileName, input.customParams);
  if (!props) return { error: '截面参数无效' };

  var mat = SB.MATERIALS[input.grade];
  if (!mat) return { error: '材料牌号无效' };

  var loadCase = SB.getLoadCase(input.loadCaseId);
  if (!loadCase) return { error: '荷载工况无效' };

  // 弯矩
  var M = loadCase.maxMoment(input.loadParams, input.L);

  // βb
  var bb = SB.calcBetaB(loadCase, input.loadPos, props, input.l1, input.loadParams);

  // φb
  var ltb = SB.calcPhiB(props, input.l2, bb, mat.fy);

  // 局部屈曲
  var local = SB.checkLocalBuckling(props, mat.fy);

  // 强度
  var strength = SB.checkStrength(M.Mmax, props, mat.f, local.section_class);

  // 稳定
  var stability = SB.checkStability(M.Mmax, props, ltb.phib_eff, mat.f);

  // 综合
  var summary = {
    pass: strength.pass && stability.pass && local.pass,
    governing: !stability.pass ? '整体稳定' : (!strength.pass ? '抗弯强度' : (!local.pass ? '局部屈曲' : '无')),
    maxRatio: Math.max(strength.ratio, stability.ratio)
  };

  return {
    input: input,
    props: props,
    mat: mat,
    loadCase: loadCase,
    moment: M,
    ltb: ltb,
    local: local,
    strength: strength,
    stability: stability,
    summary: summary
  };
};
