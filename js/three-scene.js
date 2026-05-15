/* ============================================================
   three-scene.js  —  Three.js 3D 场景
   坐标系：X = 梁轴向, Y = 截面高度方向(竖向), Z = 弱轴方向(侧向)
   LTB 变形 = 侧向位移 v(沿 Z) + 扭转 θ(绕 X)
   ============================================================ */
window.SB = window.SB || {};

SB.scene = (function() {
  var scene, camera, renderer, controls;
  var beamGroup, supportGroup, loadGroup, momentGroup, axesGroup, gridHelper;
  var dimensionGroup, shadowGroup;
  var beamMesh = null, wireMesh = null;
  var sliceCount = 60;
  var animTime = 0;
  var currentInput = null;
  var deformScale = 1.0;
  var showAnim = true;
  var initialized = false;
  var tScale = 1.0;   // 横向(y/z)视觉放大,让长梁不会像铅笔

  /* 自动算横向放大: 让截面高度视觉上约为梁长的 1/12, 限制 1~5x */
  function computeTScale(L, h) {
    var ideal = L / 12;
    return Math.max(1.0, Math.min(ideal / h, 5.0));
  }

  /* ─── 初始化 ─── */
  function init(canvas) {
    if (initialized) return;
    initialized = true;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e1a);
    scene.fog = new THREE.Fog(0x0a0e1a, 8000, 30000);

    var rect = canvas.parentElement.getBoundingClientRect();
    var w = Math.max(rect.width  | 0, 400);
    var h = Math.max(rect.height | 0, 300);
    camera = new THREE.PerspectiveCamera(45, w / h, 1, 200000);
    camera.position.set(4000, 2000, 4500);

    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(w, h, false);

    controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0, 0);

    // ─ 灯光 ─
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    var d1 = new THREE.DirectionalLight(0xffffff, 0.75);
    d1.position.set(3000, 5000, 2500);
    scene.add(d1);
    var d2 = new THREE.DirectionalLight(0x88aaff, 0.35);
    d2.position.set(-3000, 2000, -2500);
    scene.add(d2);

    // ─ 地面网格 ─
    gridHelper = new THREE.GridHelper(20000, 40, 0x334155, 0x1e293b);
    gridHelper.position.y = -2500;
    scene.add(gridHelper);

    // ─ 分组 ─
    beamGroup      = new THREE.Group(); scene.add(beamGroup);
    shadowGroup    = new THREE.Group(); scene.add(shadowGroup);
    supportGroup   = new THREE.Group(); scene.add(supportGroup);
    loadGroup      = new THREE.Group(); scene.add(loadGroup);
    momentGroup    = new THREE.Group(); scene.add(momentGroup);
    dimensionGroup = new THREE.Group(); scene.add(dimensionGroup);
    axesGroup      = new THREE.Group(); scene.add(axesGroup);

    window.addEventListener('resize', onResize);
    animate();
  }

  function onResize() {
    if (!renderer) return;
    var canvas = renderer.domElement;
    var rect = canvas.parentElement.getBoundingClientRect();
    var w = Math.max(rect.width  | 0, 100);
    var h = Math.max(rect.height | 0, 100);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  /* ─── 清理 Group ─── */
  function clear(group) {
    while (group.children.length > 0) {
      var c = group.children[0];
      group.remove(c);
      if (c.geometry) c.geometry.dispose();
      if (c.material) {
        if (Array.isArray(c.material)) c.material.forEach(function(m){m.dispose();});
        else c.material.dispose();
      }
    }
  }

  /* ─── 截面 2D 轮廓（YZ 平面） ───
       返回闭合多边形顶点列表 {y, z}, y=竖向, z=侧向
       y/z 已使中心位于原点(工字钢)或近似中心(槽钢)
  */
  function makeSection2D(props) {
    var h = props.h, b = props.b, tw = props.tw, tf = props.tf;
    var pts = [];
    if (props.type === 'I') {
      // 工字钢：逆时针外轮廓
      pts = [
        [ b/2, -h/2], [ b/2, -h/2+tf],
        [ tw/2, -h/2+tf], [ tw/2,  h/2-tf],
        [ b/2,  h/2-tf], [ b/2,  h/2],
        [-b/2,  h/2], [-b/2,  h/2-tf],
        [-tw/2, h/2-tf], [-tw/2, -h/2+tf],
        [-b/2, -h/2+tf], [-b/2, -h/2]
      ];
    } else {
      // 槽钢：腹板在左侧, 翼缘向右开口；近似居中
      var off = -b / 3;  // 视觉居中偏移
      pts = [
        [off+b, -h/2], [off+b, -h/2+tf],
        [off+tw, -h/2+tf], [off+tw,  h/2-tf],
        [off+b,  h/2-tf], [off+b,  h/2],
        [off,    h/2], [off,    -h/2]
      ];
    }
    return pts.map(function(p){ return { z: p[0] * tScale, y: p[1] * tScale }; });
  }

  /* ─── 一阶 LTB 形函数 ───
       xi ∈ [0,1] → {v, t}, 已归一化到 [0,1]
  */
  function buckleShape(xi, supportType) {
    if (supportType === 'cantilever') {
      var s = 1 - Math.cos(Math.PI * xi / 2);
      return { v: s, t: s };
    }
    var s2 = Math.sin(Math.PI * xi);
    return { v: s2, t: s2 };
  }

  /* ─── 构建梁实体 ─── */
  function buildBeam(input, props) {
    clear(beamGroup);
    var L = input.L;
    var section = makeSection2D(props);
    var nSec = section.length;
    var nSlices = sliceCount + 1;

    var positions = new Float32Array(nSlices * nSec * 3);
    var original  = new Float32Array(nSlices * nSec * 3);

    for (var i = 0; i < nSlices; i++) {
      var x = (i / sliceCount) * L - L / 2;
      for (var j = 0; j < nSec; j++) {
        var idx = (i * nSec + j) * 3;
        positions[idx]     = x;
        positions[idx + 1] = section[j].y;
        positions[idx + 2] = section[j].z;
        original[idx]      = x;
        original[idx + 1]  = section[j].y;
        original[idx + 2]  = section[j].z;
      }
    }

    var indices = [];
    for (var i = 0; i < sliceCount; i++) {
      for (var j = 0; j < nSec; j++) {
        var a = i * nSec + j;
        var b = i * nSec + ((j + 1) % nSec);
        var c = (i + 1) * nSec + ((j + 1) % nSec);
        var d = (i + 1) * nSec + j;
        indices.push(a, b, c, a, c, d);
      }
    }

    var geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();

    var mat = new THREE.MeshPhongMaterial({
      color: 0x3b82f6,
      specular: 0x6699ff,
      shininess: 35,
      side: THREE.DoubleSide,
      flatShading: false
    });

    beamMesh = new THREE.Mesh(geom, mat);
    beamMesh.userData = {
      original: original,
      nSlices: nSlices,
      nSec: nSec,
      L: L,
      supportType: input.supportType
    };
    beamGroup.add(beamMesh);

    // 线框增强
    var wireGeom = new THREE.WireframeGeometry(geom);
    wireMesh = new THREE.LineSegments(wireGeom,
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12 }));
    beamGroup.add(wireMesh);
  }

  /* ─── 应用变形（每帧） ─── */
  function applyDeformation(t) {
    if (!beamMesh) return;
    var u = beamMesh.userData;
    var orig = u.original;
    var pos  = beamMesh.geometry.attributes.position.array;

    var ampZ = u.L * 0.04 * deformScale * tScale;
    var ampT = 0.18 * deformScale;
    var pulse = showAnim ? (0.6 + 0.4 * Math.sin(t * 1.8)) : 1.0;

    for (var i = 0; i < u.nSlices; i++) {
      var xi = i / (u.nSlices - 1);
      var sh = buckleShape(xi, u.supportType);
      var dz = ampZ * sh.v * pulse;
      var dth = ampT * sh.t * pulse;
      var ct = Math.cos(dth), st = Math.sin(dth);
      for (var j = 0; j < u.nSec; j++) {
        var idx = (i * u.nSec + j) * 3;
        var x0 = orig[idx], y0 = orig[idx + 1], z0 = orig[idx + 2];
        var y1 = y0 * ct - z0 * st;
        var z1 = y0 * st + z0 * ct + dz;
        pos[idx]     = x0;
        pos[idx + 1] = y1;
        pos[idx + 2] = z1;
      }
    }
    beamMesh.geometry.attributes.position.needsUpdate = true;
    beamMesh.geometry.computeVertexNormals();

    // 更新线框
    if (wireMesh) {
      beamGroup.remove(wireMesh);
      wireMesh.geometry.dispose();
      var wg = new THREE.WireframeGeometry(beamMesh.geometry);
      wireMesh = new THREE.LineSegments(wg,
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12 }));
      beamGroup.add(wireMesh);
    }
  }

  /* ─── 支座 ─── */
  function buildSupports(input, props) {
    clear(supportGroup);
    var L = input.L;
    var matFix = new THREE.MeshPhongMaterial({ color: 0xef4444, shininess: 10 });
    var matRol = new THREE.MeshPhongMaterial({ color: 0xf59e0b, shininess: 10 });
    var supSize = Math.max(props.b * tScale * 1.2, 200);
    var yBase = -props.h * tScale / 2;

    if (input.supportType === 'simply') {
      [[-L/2, true], [L/2, false]].forEach(function(it) {
        var x = it[0];
        var fixed = it[1];
        // 三棱锥
        var geo = new THREE.ConeGeometry(supSize * 0.6, supSize, 3);
        var m = new THREE.Mesh(geo, fixed ? matFix : matRol);
        m.rotation.x = Math.PI;
        m.position.set(x, yBase - supSize/2, 0);
        supportGroup.add(m);
        // 底座
        var base = new THREE.Mesh(
          new THREE.BoxGeometry(supSize * 1.5, supSize * 0.15, supSize * 1.3),
          new THREE.MeshPhongMaterial({ color: 0x64748b })
        );
        base.position.set(x, yBase - supSize * 1.08, 0);
        supportGroup.add(base);
        if (!fixed) {
          // 滚珠
          [-supSize*0.4, 0, supSize*0.4].forEach(function(dz) {
            var ball = new THREE.Mesh(new THREE.SphereGeometry(supSize*0.08, 12, 8), matRol);
            ball.position.set(x, yBase - supSize*0.98, dz);
            supportGroup.add(ball);
          });
        }
      });
    } else {
      // 悬臂：固定端在 x = -L/2
      var wallH = props.h * tScale * 2.5;
      var wallW = props.b * tScale * 3;
      var wall = new THREE.Mesh(
        new THREE.BoxGeometry(80, wallH, wallW),
        new THREE.MeshPhongMaterial({ color: 0x64748b })
      );
      wall.position.set(-L/2 - 40, 0, 0);
      supportGroup.add(wall);
      // 阴影线
      var hashStep = wallH / 9;
      for (var i = -4; i <= 4; i++) {
        var line = new THREE.Mesh(
          new THREE.BoxGeometry(150, 5, 5),
          new THREE.MeshBasicMaterial({ color: 0x94a3b8 })
        );
        line.position.set(-L/2 - 120, i * hashStep, 0);
        line.rotation.z = Math.PI / 4;
        supportGroup.add(line);
      }
    }
  }

  /* ─── 荷载箭头 ─── */
  function buildLoads(input, props, results) {
    clear(loadGroup);
    var L = input.L;
    var lc = results.loadCase;
    var h = props.h * tScale;
    var yApply = input.loadPos === 'top' ? h/2 : (input.loadPos === 'bottom' ? -h/2 : 0);
    var len = Math.max(h * 1.2, 400);

    function downArrow(x) {
      var head = 0.3, headW = 80;
      var ah = new THREE.ArrowHelper(
        new THREE.Vector3(0, -1, 0),
        new THREE.Vector3(x - L/2, yApply + len, 0),
        len,
        0xfbbf24,
        len * head,
        headW
      );
      loadGroup.add(ah);
    }

    function momentArc(x, dir) {
      // 弯矩用圆弧 + 双箭头
      var radius = Math.max(h * 0.8, 200);
      var curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 1.5, false, 0);
      var pts3 = curve.getPoints(40).map(function(p) {
        return new THREE.Vector3(x - L/2, p.y, p.x * dir);
      });
      var g = new THREE.BufferGeometry().setFromPoints(pts3);
      var line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xfbbf24 }));
      loadGroup.add(line);
      // 箭头尖
      var tip = pts3[pts3.length - 1];
      var prev = pts3[pts3.length - 2];
      var d = new THREE.Vector3().subVectors(tip, prev).normalize();
      var arr = new THREE.ArrowHelper(d, prev, tip.distanceTo(prev) * 2, 0xfbbf24, 60, 40);
      loadGroup.add(arr);
    }

    var id = lc.id;
    if (id === 'midspan_P') downArrow(L/2);
    else if (id === 'cant_tip_P') downArrow(L);
    else if (id === 'third_point') { downArrow(L/3); downArrow(2*L/3); }
    else if (id === 'udl' || id === 'cant_udl') {
      var n = 12;
      for (var i = 1; i <= n; i++) downArrow(L * i / (n + 1));
    } else if (id === 'udl_plus_endM') {
      var n2 = 10;
      for (var k = 1; k <= n2; k++) downArrow(L * k / (n2 + 1));
      momentArc(0, 1);
    } else if (id === 'pure_bending') {
      momentArc(0, 1); momentArc(L, -1);
    } else if (id === 'end_moments') {
      momentArc(0, 1); momentArc(L, -1);
    } else if (id === 'cant_tipM') {
      momentArc(L, 1);
    }
  }

  /* ─── 弯矩图 ─── */
  function buildMoment(input, props, results) {
    clear(momentGroup);
    if (!results.moment) return;
    var L = input.L;
    var nSeg = 60;
    var Mmax = 0;
    var samples = [];
    for (var i = 0; i <= nSeg; i++) {
      var x = L * i / nSeg;
      var m = results.moment.momentFn(x);
      samples.push({ x: x - L/2, m: m });
      if (Math.abs(m) > Mmax) Mmax = Math.abs(m);
    }
    if (Mmax < 1e-6) return;
    var scale = (props.h * tScale * 4) / Mmax;
    var yOff = props.h * tScale / 2 + props.h * tScale * 3;

    var pts = samples.map(function(s){ return new THREE.Vector3(s.x, yOff - s.m * scale, 0); });
    var base = samples.map(function(s){ return new THREE.Vector3(s.x, yOff, 0); });

    // 弯矩曲线
    var lineG = new THREE.BufferGeometry().setFromPoints(pts);
    momentGroup.add(new THREE.Line(lineG,
      new THREE.LineBasicMaterial({ color: 0x60a5fa, linewidth: 2 })));

    // 基线
    var baseG = new THREE.BufferGeometry().setFromPoints(base);
    momentGroup.add(new THREE.Line(baseG,
      new THREE.LineBasicMaterial({ color: 0x475569 })));

    // 填充
    var verts = [];
    for (var k = 0; k < nSeg; k++) {
      verts.push(pts[k].x, pts[k].y, 0,
                 pts[k+1].x, pts[k+1].y, 0,
                 base[k].x, base[k].y, 0,
                 pts[k+1].x, pts[k+1].y, 0,
                 base[k+1].x, base[k+1].y, 0,
                 base[k].x, base[k].y, 0);
    }
    var fillGeom = new THREE.BufferGeometry();
    fillGeom.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    momentGroup.add(new THREE.Mesh(fillGeom,
      new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.25, side: THREE.DoubleSide })));

    // 标注 Mmax
    var maxIdx = 0, maxM = 0;
    samples.forEach(function(s, i){ if (Math.abs(s.m) > maxM) { maxM = Math.abs(s.m); maxIdx = i; } });
    var labelPos = pts[maxIdx];
    var sprite = makeTextSprite('M_max = ' + Mmax.toFixed(1) + ' kN·m', 0x60a5fa);
    sprite.position.set(labelPos.x, labelPos.y + 200, 0);
    momentGroup.add(sprite);
  }

  /* ─── 未变形外形 (绿色线框, 静止参照) ─── */
  function buildShadow(input, props) {
    clear(shadowGroup);
    var L = input.L;
    var section = makeSection2D(props);
    var nSec = section.length;
    var hs = props.h * tScale, bs = props.b * tScale;
    var positions = [];
    [-L/2, 0, L/2].forEach(function(x) {
      for (var j = 0; j < nSec; j++) {
        var a = section[j];
        var b = section[(j + 1) % nSec];
        positions.push(x, a.y, a.z, x, b.y, b.z);
      }
    });
    // 顶部/底部/左/右四条沿轴线
    var corners = [
      [ bs/2,  hs/2], [-bs/2,  hs/2],
      [ bs/2, -hs/2], [-bs/2, -hs/2]
    ];
    if (props.type === 'C') {
      var off = -bs / 3;
      corners = [
        [off+bs,  hs/2], [off,  hs/2],
        [off+bs, -hs/2], [off, -hs/2]
      ];
    }
    corners.forEach(function(c) {
      positions.push(-L/2, c[1], c[0], L/2, c[1], c[0]);
    });
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    var m = new THREE.LineBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.45 });
    shadowGroup.add(new THREE.LineSegments(g, m));
  }

  /* ─── 尺寸标注 ─── */
  function buildDimensions(input, props) {
    clear(dimensionGroup);
    var L = input.L;
    var l1 = input.l1, l2 = input.l2;
    var hs = props.h * tScale, bs = props.b * tScale;
    var gap = Math.max(hs * 0.6, 300);
    var yDimL  = -hs/2 - gap * 3;
    var yDimL1 = -hs/2 - gap * 2;
    var yDimL2 = -hs/2 - gap;
    var zDim   = bs/2 + gap;

    // 工具：直线
    function lineSeg(p1, p2, color) {
      var g = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      dimensionGroup.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: color })));
    }
    function tick(x, y, z, dy, color) {
      lineSeg(new THREE.Vector3(x, y - dy/2, z), new THREE.Vector3(x, y + dy/2, z), color);
    }
    function label(text, x, y, z, color) {
      dimensionGroup.add(makeDimLabel(text, x, y, z, color));
    }

    // L
    lineSeg(new THREE.Vector3(-L/2, yDimL, zDim), new THREE.Vector3(L/2, yDimL, zDim), 0xfbbf24);
    tick(-L/2, yDimL, zDim, 240, 0xfbbf24);
    tick( L/2, yDimL, zDim, 240, 0xfbbf24);
    label('L = ' + L.toFixed(0) + ' mm', 0, yDimL - 250, zDim, '#fbbf24');

    // l1 (强轴)
    if (Math.abs(l1 - L) > 1) {
      var x1a = -L/2, x1b = -L/2 + l1;
      lineSeg(new THREE.Vector3(x1a, yDimL1, zDim), new THREE.Vector3(x1b, yDimL1, zDim), 0x86efac);
      tick(x1a, yDimL1, zDim, 180, 0x86efac);
      tick(x1b, yDimL1, zDim, 180, 0x86efac);
      label('l₁ = ' + l1.toFixed(0), (x1a+x1b)/2, yDimL1 - 200, zDim, '#86efac');
    } else {
      lineSeg(new THREE.Vector3(-L/2, yDimL1, zDim), new THREE.Vector3(L/2, yDimL1, zDim), 0x86efac);
      tick(-L/2, yDimL1, zDim, 180, 0x86efac);
      tick( L/2, yDimL1, zDim, 180, 0x86efac);
      label('l₁ = ' + l1.toFixed(0), 0, yDimL1 - 200, zDim, '#86efac');
    }

    // l2 (弱轴 / lb)
    lineSeg(new THREE.Vector3(-L/2, yDimL2, zDim), new THREE.Vector3(-L/2 + l2, yDimL2, zDim), 0x60a5fa);
    tick(-L/2, yDimL2, zDim, 180, 0x60a5fa);
    tick(-L/2 + l2, yDimL2, zDim, 180, 0x60a5fa);
    label('l₂=l_b=' + l2.toFixed(0), (-L/2 + l2/2), yDimL2 - 200, zDim, '#60a5fa');

    // 截面尺寸 h (右端面)
    var xEnd = L/2 + Math.max(bs * 0.5, 300);
    lineSeg(new THREE.Vector3(xEnd, -hs/2, zDim), new THREE.Vector3(xEnd,  hs/2, zDim), 0xfca5a5);
    lineSeg(new THREE.Vector3(L/2,  -hs/2, zDim), new THREE.Vector3(xEnd, -hs/2, zDim), 0xfca5a5);
    lineSeg(new THREE.Vector3(L/2,   hs/2, zDim), new THREE.Vector3(xEnd,  hs/2, zDim), 0xfca5a5);
    label('h=' + props.h.toFixed(0), xEnd + 250, 0, zDim, '#fca5a5');

    // 截面尺寸 b (右端面顶部)
    var yTop = hs/2 + Math.max(hs * 0.4, 250);
    var bHalf = bs / 2;
    lineSeg(new THREE.Vector3(L/2, yTop, -bHalf), new THREE.Vector3(L/2, yTop, bHalf), 0xfca5a5);
    lineSeg(new THREE.Vector3(L/2, hs/2, -bHalf), new THREE.Vector3(L/2, yTop, -bHalf), 0xfca5a5);
    lineSeg(new THREE.Vector3(L/2, hs/2,  bHalf), new THREE.Vector3(L/2, yTop,  bHalf), 0xfca5a5);
    label('b=' + props.b.toFixed(0), L/2, yTop + 200, 0, '#fca5a5');
  }

  function makeDimLabel(text, x, y, z, colorStr) {
    var canvas = document.createElement('canvas');
    canvas.width = 384; canvas.height = 96;
    var ctx = canvas.getContext('2d');
    ctx.font = 'bold 40px Consolas, monospace';
    ctx.fillStyle = colorStr;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 192, 48);
    var tex = new THREE.CanvasTexture(canvas);
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    sp.scale.set(1200, 300, 1);
    sp.position.set(x, y, z);
    return sp;
  }

  /* ─── 坐标轴 ─── */
  function buildAxes(input, props) {
    clear(axesGroup);
    var hs = props.h * tScale;
    var origin = new THREE.Vector3(-input.L/2 - 700, -hs/2 - hs*2, 0);
    var size = Math.max(input.L * 0.1, 700);
    axesGroup.add(new THREE.ArrowHelper(new THREE.Vector3(1,0,0), origin, size, 0xef4444, 150, 60));
    axesGroup.add(new THREE.ArrowHelper(new THREE.Vector3(0,1,0), origin, size, 0x22c55e, 150, 60));
    axesGroup.add(new THREE.ArrowHelper(new THREE.Vector3(0,0,1), origin, size, 0x3b82f6, 150, 60));
    // 标签
    axesGroup.add(makeAxisLabel('x (轴向)', origin.x + size + 100, origin.y, origin.z, '#ef4444'));
    axesGroup.add(makeAxisLabel('y (强轴)', origin.x, origin.y + size + 100, origin.z, '#22c55e'));
    axesGroup.add(makeAxisLabel('z (弱轴)', origin.x, origin.y, origin.z + size + 100, '#3b82f6'));
  }

  /* ─── 文字 Sprite ─── */
  function makeTextSprite(text, color) {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    canvas.width = 512; canvas.height = 128;
    ctx.font = 'bold 56px sans-serif';
    ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 64);
    var tex = new THREE.CanvasTexture(canvas);
    var sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    sprite.scale.set(1500, 375, 1);
    return sprite;
  }
  function makeAxisLabel(text, x, y, z, colorStr) {
    var canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    var ctx = canvas.getContext('2d');
    ctx.font = 'bold 38px sans-serif';
    ctx.fillStyle = colorStr;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);
    var tex = new THREE.CanvasTexture(canvas);
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    sp.scale.set(800, 200, 1);
    sp.position.set(x, y, z);
    return sp;
  }

  /* ─── 一键刷新 ─── */
  function update(input, results, options) {
    currentInput = input;
    options = options || {};
    if ('deformScale' in options) deformScale = options.deformScale;
    if ('showAnim' in options) showAnim = options.showAnim;

    // 计算横向放大系数（让梁看起来比例合理）
    tScale = computeTScale(input.L, results.props.h);

    buildBeam(input, results.props);
    buildShadow(input, results.props);
    buildSupports(input, results.props);
    buildLoads(input, results.props, results);
    buildMoment(input, results.props, results);
    buildDimensions(input, results.props);
    buildAxes(input, results.props);

    if ('showMoment' in options) momentGroup.visible = options.showMoment;
    if ('showAxes' in options) axesGroup.visible = options.showAxes;

    // 自动适配相机
    var L = input.L;
    camera.position.set(L * 0.55, L * 0.45, L * 0.9);
    controls.target.set(0, 0, 0);
    controls.update();
  }

  function setOptions(opts) {
    if ('deformScale' in opts) deformScale = opts.deformScale;
    if ('showAnim' in opts) showAnim = opts.showAnim;
    if ('showMoment' in opts && momentGroup) momentGroup.visible = opts.showMoment;
    if ('showAxes' in opts && axesGroup) axesGroup.visible = opts.showAxes;
  }

  /* ─── 动画循环 ─── */
  function animate() {
    requestAnimationFrame(animate);
    animTime += 0.016;
    applyDeformation(animTime);
    if (controls) controls.update();
    if (renderer && scene && camera) renderer.render(scene, camera);
  }

  return { init: init, update: update, setOptions: setOptions };
})();
