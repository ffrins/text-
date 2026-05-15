/* ============================================================
   loadcases.js  —  GB 50017-2017 附录 C 表 C.0.1 荷载工况库
   包含 βb 系数表 / 弯矩图函数 / 最大弯矩计算
   ============================================================ */
window.SB = window.SB || {};

/* ── 工况元数据 ──
   id          : 工况唯一标识
   support     : 'simply' / 'cantilever'
   label       : 中文显示名
   params      : 需要输入的荷载参数 [{key, label, unit, default}]
   loadHeight  : 是否考虑荷载作用位置（true/false）
   bb          : { topFlange:{ξ_low,ξ_high}, center:{...}, bottomFlange:{...} }
                 βb 系数，按 ξ = l1·t1/(b1·h) 分段；ξ < ξ_low 取 low，ξ ≥ ξ_high 取 high
   maxMoment   : (params, L) => {Mmax: kN·m, xMax: mm, momentFn:(x)=>kN·m}
*/

SB.LOAD_CASES = [
  /* ───────── 简支梁 ───────── */
  {
    id: 'pure_bending',
    support: 'simply',
    label: '纯弯（两端等弯矩 M）',
    params: [{ key:'M', label:'M', unit:'kN·m', default:100 }],
    loadHeight: false,
    bb: { center:{low:1.0,high:1.0}, top:{low:1.0,high:1.0}, bottom:{low:1.0,high:1.0} },
    maxMoment: function(p, L) {
      return {
        Mmax: p.M,
        xMax: L / 2,
        momentFn: function(x) { return p.M; }
      };
    }
  },
  {
    id: 'end_moments',
    support: 'simply',
    label: '不等端弯矩 M₁、M₂（M₁≥|M₂|，同号取正）',
    params: [
      { key:'M1', label:'M₁ (大端)', unit:'kN·m', default:100 },
      { key:'M2', label:'M₂ (小端)', unit:'kN·m', default:50 }
    ],
    loadHeight: false,
    bb: 'formula_end_moments',  // 特殊处理：βb = 0.65 + 0.35·M2/M1
    maxMoment: function(p, L) {
      var fn = function(x) { return p.M1 - (p.M1 - p.M2) * x / L; };
      var Mmax = Math.max(Math.abs(p.M1), Math.abs(p.M2));
      var xMax = Math.abs(p.M1) >= Math.abs(p.M2) ? 0 : L;
      return { Mmax: Mmax, xMax: xMax, momentFn: fn };
    }
  },
  {
    id: 'midspan_P',
    support: 'simply',
    label: '跨中集中荷载 P',
    params: [{ key:'P', label:'P', unit:'kN', default:50 }],
    loadHeight: true,
    bb: { center:{low:1.07,high:1.07}, top:{low:0.73,high:0.73}, bottom:{low:1.40,high:1.40} },
    maxMoment: function(p, L) {
      var fn = function(x) { return x <= L/2 ? p.P * x / 2 : p.P * (L - x) / 2; };
      return { Mmax: p.P * L / 4 / 1000, xMax: L / 2, momentFn: function(x){return fn(x)/1000;} };
    }
  },
  {
    id: 'third_point',
    support: 'simply',
    label: '三分点集中荷载 P（两个 P）',
    params: [{ key:'P', label:'P', unit:'kN', default:30 }],
    loadHeight: true,
    bb: { center:{low:1.15,high:1.15}, top:{low:0.81,high:0.81}, bottom:{low:1.30,high:1.30} },
    maxMoment: function(p, L) {
      var a = L / 3;
      var fn = function(x) {
        if (x <= a) return p.P * x;
        if (x <= 2*a) return p.P * a;
        return p.P * (L - x);
      };
      return { Mmax: p.P * a / 1000, xMax: L / 2, momentFn: function(x){return fn(x)/1000;} };
    }
  },
  {
    id: 'udl',
    support: 'simply',
    label: '均布荷载 q',
    params: [{ key:'q', label:'q', unit:'kN/m', default:20 }],
    loadHeight: true,
    bb: { center:{low:1.13,high:1.13}, top:{low:0.69,high:0.69}, bottom:{low:1.40,high:1.40} },
    maxMoment: function(p, L) {
      var Lm = L / 1000;
      var fn = function(x) {
        var xm = x / 1000;
        return p.q * xm * (Lm - xm) / 2;
      };
      return { Mmax: p.q * Lm * Lm / 8, xMax: L / 2, momentFn: fn };
    }
  },
  {
    id: 'udl_plus_endM',
    support: 'simply',
    label: '均布 q + 端弯矩 M（同侧加压）',
    params: [
      { key:'q', label:'q', unit:'kN/m', default:15 },
      { key:'Me', label:'M (端弯矩)', unit:'kN·m', default:30 }
    ],
    loadHeight: true,
    bb: { center:{low:1.0,high:1.0}, top:{low:0.95,high:0.95}, bottom:{low:1.10,high:1.10} },
    maxMoment: function(p, L) {
      var Lm = L / 1000;
      var fn = function(x) {
        var xm = x / 1000;
        return p.q * xm * (Lm - xm) / 2 + p.Me * (1 - xm / Lm);
      };
      // 数值寻最大
      var Mmax = 0, xMax = 0;
      for (var i = 0; i <= 100; i++) {
        var x = L * i / 100;
        var m = Math.abs(fn(x));
        if (m > Mmax) { Mmax = m; xMax = x; }
      }
      return { Mmax: Mmax, xMax: xMax, momentFn: fn };
    }
  },

  /* ───────── 悬臂梁 ───────── */
  {
    id: 'cant_tip_P',
    support: 'cantilever',
    label: '悬臂端部集中荷载 P',
    params: [{ key:'P', label:'P', unit:'kN', default:20 }],
    loadHeight: true,
    bb: { center:{low:0.60,high:0.60}, top:{low:0.60,high:0.60}, bottom:{low:0.60,high:0.60} },
    maxMoment: function(p, L) {
      var Lm = L / 1000;
      var fn = function(x) {
        var xm = x / 1000;
        return p.P * (Lm - xm);
      };
      return { Mmax: p.P * Lm, xMax: 0, momentFn: fn };
    }
  },
  {
    id: 'cant_udl',
    support: 'cantilever',
    label: '悬臂均布荷载 q',
    params: [{ key:'q', label:'q', unit:'kN/m', default:15 }],
    loadHeight: true,
    bb: { center:{low:0.80,high:0.80}, top:{low:0.80,high:0.80}, bottom:{low:0.80,high:0.80} },
    maxMoment: function(p, L) {
      var Lm = L / 1000;
      var fn = function(x) {
        var xm = x / 1000;
        return p.q * Math.pow(Lm - xm, 2) / 2;
      };
      return { Mmax: p.q * Lm * Lm / 2, xMax: 0, momentFn: fn };
    }
  },
  {
    id: 'cant_tipM',
    support: 'cantilever',
    label: '悬臂端弯矩 M',
    params: [{ key:'M', label:'M', unit:'kN·m', default:50 }],
    loadHeight: false,
    bb: { center:{low:1.0,high:1.0}, top:{low:1.0,high:1.0}, bottom:{low:1.0,high:1.0} },
    maxMoment: function(p, L) {
      return { Mmax: p.M, xMax: 0, momentFn: function(x){ return p.M; } };
    }
  },
];

/* ── 根据 id 获取工况 ── */
SB.getLoadCase = function(id) {
  for (var i = 0; i < SB.LOAD_CASES.length; i++) {
    if (SB.LOAD_CASES[i].id === id) return SB.LOAD_CASES[i];
  }
  return null;
};

/* ── 计算 βb 系数 (附录 C 表 C.0.1) ──
   loadCase  : 工况对象
   loadPos   : 'top' / 'center' / 'bottom'
   props     : 截面特性
   l1        : 强轴侧向支承间距 mm
   params    : 荷载参数
*/
SB.calcBetaB = function(loadCase, loadPos, props, l1, params) {
  // 特殊：不等端弯矩
  if (loadCase.bb === 'formula_end_moments') {
    var M1 = params.M1 || 1;
    var M2 = params.M2 || 0;
    // 符号约定: M1>0; 同号取 M2 正, 反号取负; M1≥|M2|
    var ratio = M2 / M1;
    var bb = 0.65 + 0.35 * ratio;
    return Math.min(Math.max(bb, 0.2), 1.0);
  }
  // 常规：根据荷载作用位置查表
  var posKey = loadPos === 'top' ? 'top' : (loadPos === 'bottom' ? 'bottom' : 'center');
  var entry = loadCase.bb[posKey];
  if (!entry) return 1.0;

  // ξ = l1·t1 / (b1·h)；b1 = b/2 (工字钢), b/1 (槽钢简化)
  var t1 = props.tf;       // mm
  var h  = props.h;        // mm
  var b1 = props.type === 'I' ? props.b / 2 : props.b;  // mm
  var xi = (l1 * t1) / (b1 * h);

  // 简化处理：按 ξ ≥ 2.0 取 high, ξ ≤ 0.6 取 low，中间线性插值
  if (xi <= 0.6) return entry.low;
  if (xi >= 2.0) return entry.high;
  var t = (xi - 0.6) / (2.0 - 0.6);
  return entry.low + t * (entry.high - entry.low);
};

/* ── 按支座类型筛选工况 ── */
SB.getCasesBySupport = function(support) {
  return SB.LOAD_CASES.filter(function(c){ return c.support === support; });
};
