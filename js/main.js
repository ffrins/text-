/* ============================================================
   main.js  —  入口：UI 绑定 · 计算调度 · 结果渲染
   ============================================================ */
(function() {
  'use strict';

  /* ── DOM 引用 ── */
  var $ = function(id){ return document.getElementById(id); };
  var $$ = function(sel){ return document.querySelectorAll(sel); };

  var elProfileWrap = $('profile-select-wrap');
  var elCustomWrap  = $('custom-inputs');
  var elProfileSel  = $('profileSelect');
  var elMaterial    = $('materialGrade');
  var elLoadCase    = $('loadCaseSelect');
  var elLoadParams  = $('load-params');
  var elScaleSlider = $('inp-scale');
  var elScaleVal    = $('scale-val');
  var elChkMoment   = $('chk-moment');
  var elChkAnim     = $('chk-anim');
  var elChkAxes     = $('chk-axes');
  var elBtnCalc     = $('btn-calc');
  var elBtnReset    = $('btn-reset');
  var elPlaceholder = $('results-placeholder');
  var elResultsCont = $('results-container');

  /* ── 工具函数 ── */
  function radio(name) {
    var el = document.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : '';
  }
  function num(id, fallback) {
    var v = parseFloat($(id) ? $(id).value : NaN);
    return isNaN(v) ? (fallback || 0) : v;
  }
  function fmt(v, d) { return (+v).toFixed(d === undefined ? 2 : d); }

  /* ── 填充型钢下拉 ── */
  function populateProfiles() {
    elProfileSel.innerHTML = '';
    var type = radio('sectionType');
    var list = type === 'I' ? SB.PROFILES_I : SB.PROFILES_C;
    list.forEach(function(p) {
      var opt = document.createElement('option');
      opt.value = p.name;
      opt.textContent = p.name + ' (' + p.h + '×' + p.b + ')';
      elProfileSel.appendChild(opt);
    });
  }

  /* ── 填充工况下拉 ── */
  function populateLoadCases() {
    var support = radio('supportType');
    var cases = SB.getCasesBySupport(support);
    elLoadCase.innerHTML = '';
    cases.forEach(function(c) {
      var opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.label;
      elLoadCase.appendChild(opt);
    });
    updateLoadParams();
  }

  /* ── 动态荷载参数输入框 ── */
  function updateLoadParams() {
    elLoadParams.innerHTML = '';
    var lc = SB.getLoadCase(elLoadCase.value);
    if (!lc) return;
    lc.params.forEach(function(p) {
      var div = document.createElement('div');
      div.innerHTML =
        '<label class="field-label">' + p.label + ' (' + p.unit + ')</label>' +
        '<input id="lp-' + p.key + '" type="number" class="field-input" value="' + p.default + '">';
      elLoadParams.appendChild(div);
    });
  }

  /* ── 截面来源切换 ── */
  function toggleSectionSource() {
    var src = radio('sectionSrc');
    elProfileWrap.style.display = src === 'table' ? '' : 'none';
    elCustomWrap.style.display  = src === 'custom' ? '' : 'none';
    elCustomWrap.classList.toggle('hidden', src !== 'custom');
    drawSectionSVG();
  }

  /* ── 截面示意图 SVG (自定义模式下随输入实时更新) ── */
  function drawSectionSVG() {
    var svg = document.getElementById('section-svg');
    if (!svg) return;
    var type = radio('sectionType');
    var h  = num('inp-h', 200);
    var b  = num('inp-b', 100);
    var tw = num('inp-tw', 7);
    var tf = num('inp-tf', 11.4);

    // 视图 200×200，留 30px 边距给标注
    var pad = 30, drawW = 140, drawH = 140;
    var scale = Math.min(drawW / b, drawH / h);
    var sw = b * scale, sh = h * scale, stw = tw * scale, stf = tf * scale;
    var cx = 100, cy = 100; // 中心

    var x1 = cx - sw/2, y1 = cy - sh/2;
    var pathD;
    if (type === 'I') {
      // 工字钢路径
      pathD =
        'M' + x1 + ',' + y1 +
        ' h' + sw +
        ' v' + stf +
        ' h' + (-(sw - stw)/2) +
        ' v' + (sh - 2*stf) +
        ' h' + ((sw - stw)/2) +
        ' v' + stf +
        ' h' + (-sw) +
        ' v' + (-stf) +
        ' h' + ((sw - stw)/2) +
        ' v' + (-(sh - 2*stf)) +
        ' h' + (-(sw - stw)/2) +
        ' Z';
    } else {
      // 槽钢路径 (开口朝右)
      pathD =
        'M' + x1 + ',' + y1 +
        ' h' + sw +
        ' v' + stf +
        ' h' + (-(sw - stw)) +
        ' v' + (sh - 2*stf) +
        ' h' + (sw - stw) +
        ' v' + stf +
        ' h' + (-sw) +
        ' Z';
    }

    // 标注线
    var dimY1 = y1 + sh + 10;       // h 的横向标注线 (右侧)
    var dimXR = x1 + sw + 12;       // h 标注线 x
    var dimXTop = y1 - 10;          // b 标注线 y
    svg.innerHTML =
      '<rect x="5" y="5" width="190" height="190" fill="none" stroke="#1e293b" stroke-width="0.5"/>' +
      '<path class="sec-fill" d="' + pathD + '"/>' +
      // h 标注 (右侧)
      '<line class="dim-line" x1="' + dimXR + '" y1="' + y1 + '" x2="' + dimXR + '" y2="' + (y1+sh) + '"/>' +
      '<line class="dim-line" x1="' + (dimXR-3) + '" y1="' + y1 + '" x2="' + (dimXR+3) + '" y2="' + y1 + '"/>' +
      '<line class="dim-line" x1="' + (dimXR-3) + '" y1="' + (y1+sh) + '" x2="' + (dimXR+3) + '" y2="' + (y1+sh) + '"/>' +
      '<text class="dim-text" x="' + (dimXR+5) + '" y="' + (cy+3) + '">h=' + h + '</text>' +
      // b 标注 (顶部)
      '<line class="dim-line" x1="' + x1 + '" y1="' + dimXTop + '" x2="' + (x1+sw) + '" y2="' + dimXTop + '"/>' +
      '<line class="dim-line" x1="' + x1 + '" y1="' + (dimXTop-3) + '" x2="' + x1 + '" y2="' + (dimXTop+3) + '"/>' +
      '<line class="dim-line" x1="' + (x1+sw) + '" y1="' + (dimXTop-3) + '" x2="' + (x1+sw) + '" y2="' + (dimXTop+3) + '"/>' +
      '<text class="dim-text" x="' + (cx-10) + '" y="' + (dimXTop-2) + '">b=' + b + '</text>' +
      // tw 引出 (中间腹板)
      '<line class="dim-line" x1="' + cx + '" y1="' + cy + '" x2="' + (x1-15) + '" y2="' + (cy+20) + '"/>' +
      '<text class="dim-text" x="' + (x1-32) + '" y="' + (cy+22) + '">tw=' + tw + '</text>' +
      // tf 引出 (上翼缘)
      '<line class="dim-line" x1="' + (x1+sw*0.75) + '" y1="' + (y1+stf/2) + '" x2="' + (x1+sw+20) + '" y2="' + (y1-15) + '"/>' +
      '<text class="dim-text" x="' + (x1+sw+8) + '" y="' + (y1-18) + '">tf=' + tf + '</text>';
  }

  /* ── 读取完整输入 ── */
  function readInput() {
    var sectionType = radio('sectionType');
    var sectionSrc  = radio('sectionSrc');
    var profileName = elProfileSel.value;
    var customParams = {
      h:  num('inp-h', 200),
      b:  num('inp-b', 100),
      tw: num('inp-tw', 7),
      tf: num('inp-tf', 11.4),
      r:  num('inp-r', 9)
    };

    // 读取荷载参数
    var lc = SB.getLoadCase(elLoadCase.value);
    var loadParams = {};
    if (lc) {
      lc.params.forEach(function(p) {
        loadParams[p.key] = num('lp-' + p.key, p.default);
      });
    }

    return {
      sectionType:  sectionType,
      sectionSource: sectionSrc,
      profileName:  profileName,
      customParams: customParams,
      grade:        elMaterial.value,
      L:            num('inp-L', 6000),
      l1:           num('inp-l1', 6000),
      l2:           num('inp-l2', 6000),
      supportType:  radio('supportType'),
      loadCaseId:   elLoadCase.value,
      loadParams:   loadParams,
      loadPos:      radio('loadPos')
    };
  }

  /* ── 结果渲染 ── */
  function renderResults(res) {
    elPlaceholder.classList.add('hidden');
    elResultsCont.classList.remove('hidden');

    // ─ 综合判定 ─
    var sumEl = $('summary-content');
    if (res.summary.pass) {
      sumEl.innerHTML = '<span class="badge-ok text-base px-4 py-1">✓ 通过</span>' +
        '<div class="text-xs text-gray-400 mt-2">最大应力比 ' + fmt(res.summary.maxRatio, 3) + '</div>';
      $('card-summary').style.borderColor = '#22c55e';
    } else {
      sumEl.innerHTML = '<span class="badge-ng text-base px-4 py-1">✗ 不通过</span>' +
        '<div class="text-xs text-gray-400 mt-2">控制因素: ' + res.summary.governing +
        ' · 应力比 ' + fmt(res.summary.maxRatio, 3) + '</div>';
      $('card-summary').style.borderColor = '#ef4444';
    }

    // ─ 截面特性 ─
    var p = res.props;
    $('card-section').innerHTML = resultTable([
      ['截面类型', p.type === 'I' ? '工字钢' : '槽钢'],
      ['h', fmt(p.h, 1) + ' mm'],
      ['b', fmt(p.b, 1) + ' mm'],
      ['t_w', fmt(p.tw, 1) + ' mm'],
      ['t_f', fmt(p.tf, 1) + ' mm'],
      ['A', fmt(p.A) + ' cm²'],
      ['I_x', fmt(p.Ix, 1) + ' cm⁴'],
      ['I_y', fmt(p.Iy, 1) + ' cm⁴'],
      ['W_x', fmt(p.Wx, 1) + ' cm³'],
      ['W_y', fmt(p.Wy, 1) + ' cm³'],
      ['i_x', fmt(p.ix) + ' cm'],
      ['i_y', fmt(p.iy) + ' cm'],
      ['I_t', fmt(p.It, 3) + ' cm⁴'],
      ['I_w', fmt(p.Iw, 1) + ' cm⁶'],
    ]);

    // ─ 整体稳定 LTB ─
    var ltb = res.ltb;
    var stab = res.stability;
    $('card-ltb').innerHTML =
      '<div class="result-section-title">① 输入参数</div>' +
      resultTable([
        ['l_b (弱轴)', fmt(ltb.lb_mm, 0) + ' mm = ' + fmt(ltb.lb_cm, 1) + ' cm'],
        ['i_y', fmt(ltb.iy_cm, 2) + ' cm'],
        ['A', fmt(ltb.A_cm, 2) + ' cm²'],
        ['h', fmt(ltb.h_cm, 1) + ' cm'],
        ['W_x', fmt(ltb.Wx_cm, 1) + ' cm³'],
        ['t₁ = t_f', fmt(ltb.t1_cm, 2) + ' cm'],
        ['f_y', fmt(ltb.fy, 0) + ' MPa'],
      ]) +
      '<div class="result-section-title">② 中间参数</div>' +
      resultTable([
        ['λ_y = l_b/i_y', fmt(ltb.lb_cm, 1) + ' / ' + fmt(ltb.iy_cm, 2) + ' = ' + fmt(ltb.lambda_y)],
        ['ε_k = √(235/f_y)', fmt(ltb.epsK, 3)],
        ['ε_k²', fmt(ltb.epsK2, 4)],
        ['β_b (附录 C)', fmt(ltb.bb, 3)],
      ]) +
      '<div class="result-section-title">③ φ_b 分项</div>' +
      resultTable([
        ['4320·β_b·ε_k²', fmt(ltb.coef, 1)],
        ['÷ λ_y²', fmt(ltb.term1, 4)],
        ['A·h/W_x', fmt(ltb.term2, 3)],
        ['λ_y·t₁/(4.4·h)', fmt(ltb.inner, 4)],
        ['√(1+□²)', fmt(ltb.term3, 4)],
      ].concat(ltb.channelFactor < 1 ? [['槽钢折减 ×0.7', '附录 C.0.4']] : [])) +
      '<div class="result-section-title">④ 结果</div>' +
      resultTable([
        ['φ_b (计算值)', fmt(ltb.phib_raw, 4)],
        ['φ_b\' (修正后)', fmt(ltb.phib_eff, 4) + (ltb.corrected ? ' (>0.6 已修正)' : '')],
        ['M_max', fmt(res.moment.Mmax) + ' kN·m'],
        ['σ = M/(φ_b·W_x)', fmt(stab.sigma) + ' MPa'],
        ['f', fmt(stab.f) + ' MPa'],
        ['应力比', fmt(stab.ratio, 3) + (stab.pass ? ' ≤ 1.0 ✓' : ' > 1.0 ✗')],
        ['M_b = φ_b·W_x·f', fmt(stab.Mb) + ' kN·m'],
      ]) + statusBadge(stab.pass) +
      '<div class="muted">GB 50017-2017 §6.2 + 附录 C.0.1' + (ltb.channelFactor < 1 ? ' + C.0.4' : '') + '</div>';

    // ─ 局部屈曲 ─
    var loc = res.local;
    $('card-local').innerHTML = resultTable([
      ['ε_k', fmt(loc.epsK, 3)],
      ['翼缘 b₁/t_f', fmt(loc.flange_ratio) + (loc.flange_class.indexOf('超') >= 0 ? ' ✗' : ' ✓')],
      ['翼缘限值 [S1–S5]', loc.flange_limits.map(function(v){return fmt(v,1);}).join(' / ')],
      ['翼缘等级', loc.flange_class],
      ['腹板 h₀/t_w', fmt(loc.web_ratio) + (loc.web_class.indexOf('超') >= 0 ? ' ✗' : ' ✓')],
      ['腹板限值 [S1–S5]', loc.web_limits.map(function(v){return fmt(v,1);}).join(' / ')],
      ['腹板等级', loc.web_class],
      ['截面等级', loc.section_class],
    ]) + statusBadge(loc.pass) + '<div class="muted">GB 50017-2017 §3.5.1 表 3.5.1</div>';

    // ─ 抗弯强度 ─
    var str = res.strength;
    $('card-strength').innerHTML = resultTable([
      ['M_max', fmt(res.moment.Mmax) + ' kN·m'],
      ['γ_x (塑性系数)', fmt(str.gamma_x)],
      ['σ = M/(γ_x·W_x)', fmt(str.sigma) + ' MPa'],
      ['f', fmt(str.f) + ' MPa'],
      ['应力比', fmt(str.ratio, 3) + (str.pass ? ' ≤ 1.0 ✓' : ' > 1.0 ✗')],
    ]) + statusBadge(str.pass) + '<div class="muted">GB 50017-2017 §6.1.1</div>';

    // ─ 公式 ─
    renderFormulas(res);
  }

  /* 公式详情 (KaTeX) */
  function renderFormulas(res) {
    var el = $('card-formulas');
    var ltb = res.ltb;
    var html = '<div class="space-y-3 text-xs">';

    // φb 公式
    html += '<div class="font-semibold text-blue-400 mb-1">整体稳定系数 φ_b</div>';
    html += '<div id="katex-phib"></div>';
    html += '<div class="text-gray-400 mt-1">代入值：λ_y=' + fmt(ltb.lambda_y) +
      ', β_b=' + fmt(ltb.bb, 3) +
      ', ε_k=' + fmt(ltb.epsK, 3) +
      ', A=' + fmt(res.props.A) + ' cm², h=' + fmt(res.props.h/10) + ' cm' +
      ', W_x=' + fmt(res.props.Wx, 1) + ' cm³, t₁=' + fmt(res.props.tf/10) + ' cm</div>';
    html += '<div class="text-gray-400">φ_b=' + fmt(ltb.phib_raw, 4) + '</div>';
    if (ltb.corrected) {
      html += '<div id="katex-phib2"></div>';
      html += '<div class="text-gray-400">φ_b\'=' + fmt(ltb.phib_eff, 4) + '</div>';
    }

    // 强度公式
    html += '<div class="font-semibold text-blue-400 mt-3 mb-1">抗弯强度</div>';
    html += '<div id="katex-str"></div>';

    html += '</div>';
    el.innerHTML = html;

    // 延迟渲染 KaTeX（需要等 katex 加载）
    setTimeout(function() {
      try {
        var formulaStr = res.props.type === 'C'
          ? '\\varphi_b = \\frac{4320\\,\\beta_b\\,\\varepsilon_k^2}{\\lambda_y^2} \\cdot \\frac{A\\,h}{W_x} \\cdot \\sqrt{1+\\left(\\frac{\\lambda_y\\,t_1}{4.4\\,h}\\right)^2} \\times 0.7'
          : '\\varphi_b = \\frac{4320\\,\\beta_b\\,\\varepsilon_k^2}{\\lambda_y^2} \\cdot \\frac{A\\,h}{W_x} \\cdot \\sqrt{1+\\left(\\frac{\\lambda_y\\,t_1}{4.4\\,h}\\right)^2}';
        if (window.katex && $('katex-phib')) {
          katex.render(formulaStr, $('katex-phib'), { displayMode: true });
        }
        if (ltb.corrected && window.katex && $('katex-phib2')) {
          katex.render("\\varphi_b' = 1.07 - \\frac{0.282}{\\varphi_b} \\leq 1.0", $('katex-phib2'), { displayMode: true });
        }
        if (window.katex && $('katex-str')) {
          katex.render("\\sigma = \\frac{M_x}{\\gamma_x \\cdot W_{nx}} \\leq f", $('katex-str'), { displayMode: true });
        }
      } catch(e) { /* katex not loaded yet */ }
    }, 300);
  }

  function resultTable(rows) {
    return '<div class="divide-y divide-gray-700">' +
      rows.map(function(r) {
        return '<div class="result-row"><span class="result-label">' + r[0] + '</span><span class="result-val">' + r[1] + '</span></div>';
      }).join('') + '</div>';
  }

  function statusBadge(pass) {
    return '<div class="mt-2 text-center">' +
      (pass ? '<span class="badge-ok">✓ 满足要求</span>' : '<span class="badge-ng">✗ 不满足要求</span>') +
      '</div>';
  }

  /* ── 计算主流程 ── */
  function runCalc() {
    var input = readInput();
    var results = SB.runAnalysis(input);
    if (results.error) {
      alert('错误: ' + results.error);
      return;
    }
    renderResults(results);
    updateHUD(input, results);

    // 可视化选项
    var scaleVal = parseInt(elScaleSlider.value, 10);
    var ds = scaleVal === 0 ? 1.0 : scaleVal / 50;

    SB.scene.update(input, results, {
      deformScale: ds,
      showAnim:    elChkAnim.checked,
      showMoment:  elChkMoment.checked,
      showAxes:    elChkAxes.checked
    });
  }

  /* ── 画布 HUD ── */
  function updateHUD(input, results) {
    var p = results.props;
    var info = $('canvas-info');
    var legend = $('canvas-legend');
    if (info) {
      var sectionName = input.sectionSource === 'table' ? input.profileName
        : (input.sectionType === 'I' ? '工字钢(自定义)' : '槽钢(自定义)');
      info.innerHTML =
        '<div class="ci-title">' + sectionName + ' · ' + input.grade + '</div>' +
        row('h × b', fmt(p.h,0) + ' × ' + fmt(p.b,0) + ' mm') +
        row('t_w / t_f', fmt(p.tw,1) + ' / ' + fmt(p.tf,1) + ' mm') +
        row('A', fmt(p.A) + ' cm²') +
        row('W_x', fmt(p.Wx,1) + ' cm³') +
        row('L', fmt(input.L,0) + ' mm') +
        row('l₁ (强轴)', fmt(input.l1,0) + ' mm') +
        row('l₂ (弱轴=l_b)', fmt(input.l2,0) + ' mm') +
        row('支座', input.supportType === 'simply' ? '简支' : '悬臂') +
        row('工况', results.loadCase.label.length > 16
            ? results.loadCase.label.substring(0,16)+'…' : results.loadCase.label) +
        row('M_max', fmt(results.moment.Mmax) + ' kN·m') +
        row('φ_b', fmt(results.ltb.phib_eff, 3)) +
        row('应力比', fmt(results.summary.maxRatio, 3) + (results.summary.pass ? ' ✓' : ' ✗'));
    }
    if (legend) {
      legend.innerHTML =
        '<div style="color:#60a5fa;font-weight:700;font-size:12px;margin-bottom:4px">图例</div>' +
        '<div class="lg-item"><span class="lg-dot" style="background:#3b82f6"></span>钢梁（变形）</div>' +
        '<div class="lg-item"><span class="lg-dot" style="background:#ef4444"></span>固定支座/铰</div>' +
        '<div class="lg-item"><span class="lg-dot" style="background:#f59e0b"></span>滚动支座</div>' +
        '<div class="lg-item"><span class="lg-dot" style="background:#fbbf24"></span>荷载箭头</div>' +
        '<div class="lg-item"><span class="lg-dot" style="background:#60a5fa"></span>弯矩图</div>' +
        '<div class="lg-item"><span class="lg-dot" style="background:#22c55e"></span>原始未变形外形</div>';
    }
  }
  function row(k, v) {
    return '<div class="ci-row"><span class="ci-key">' + k + '</span><span class="ci-val">' + v + '</span></div>';
  }

  /* ── 重置 ── */
  function resetAll() {
    $$('input[name="sectionType"]')[0].checked = true;
    $$('input[name="sectionSrc"]')[0].checked = true;
    $$('input[name="supportType"]')[0].checked = true;
    $$('input[name="loadPos"]')[1].checked = true;
    elMaterial.value = 'Q345';
    $('inp-L').value = 6000;
    $('inp-l1').value = 6000;
    $('inp-l2').value = 6000;
    $('inp-h').value = 200;
    $('inp-b').value = 100;
    $('inp-tw').value = 7;
    $('inp-tf').value = 11.4;
    $('inp-r').value = 9;
    elScaleSlider.value = 0;
    elScaleVal.textContent = '自动';
    elChkMoment.checked = true;
    elChkAnim.checked = true;
    elChkAxes.checked = true;
    populateProfiles();
    populateLoadCases();
    toggleSectionSource();
    elPlaceholder.classList.remove('hidden');
    elResultsCont.classList.add('hidden');
  }

  /* ── 事件绑定 ── */
  function bind() {
    // 截面类型变化 → 重新填充型钢表 + 刷新 SVG
    $$('input[name="sectionType"]').forEach(function(el) {
      el.addEventListener('change', function() {
        populateProfiles();
        drawSectionSVG();
      });
    });
    // 截面来源切换
    $$('input[name="sectionSrc"]').forEach(function(el) {
      el.addEventListener('change', toggleSectionSource);
    });
    // 自定义截面参数 → 实时刷新 SVG
    ['inp-h','inp-b','inp-tw','inp-tf','inp-r'].forEach(function(id) {
      var el = $(id);
      if (el) el.addEventListener('input', drawSectionSVG);
    });
    // 支座类型 → 重新填充工况
    $$('input[name="supportType"]').forEach(function(el) {
      el.addEventListener('change', populateLoadCases);
    });
    // 工况变化 → 更新参数输入框
    elLoadCase.addEventListener('change', updateLoadParams);

    // 变形放大
    elScaleSlider.addEventListener('input', function() {
      var v = parseInt(this.value, 10);
      elScaleVal.textContent = v === 0 ? '自动' : (v / 50).toFixed(1) + '×';
      SB.scene.setOptions({ deformScale: v === 0 ? 1.0 : v / 50 });
    });
    // 复选框实时
    elChkMoment.addEventListener('change', function() { SB.scene.setOptions({ showMoment: this.checked }); });
    elChkAnim.addEventListener('change', function()   { SB.scene.setOptions({ showAnim: this.checked }); });
    elChkAxes.addEventListener('change', function()    { SB.scene.setOptions({ showAxes: this.checked }); });

    // 按钮
    elBtnCalc.addEventListener('click', runCalc);
    elBtnReset.addEventListener('click', resetAll);
  }

  /* ── 折叠/展开结果卡片 ── */
  window.toggleCard = function(titleEl) {
    var body = titleEl.nextElementSibling;
    if (body) body.classList.toggle('closed');
    var arrow = titleEl.querySelector('span');
    if (arrow) arrow.textContent = body.classList.contains('closed') ? '▶' : '▼';
  };

  /* ── 初始化 ── */
  function initApp() {
    populateProfiles();
    populateLoadCases();
    toggleSectionSource();
    SB.scene.init($('three-canvas'));
    bind();
    // 自动跑一次，让画布有内容
    setTimeout(runCalc, 100);
  }

  // 等 DOM 就绪
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
