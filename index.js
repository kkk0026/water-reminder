/**
 * 喝水提醒 - SillyTavern 原生扩展
 * 版本: 1.0.3
 * 安装: 酒馆设置 → 扩展 → 粘贴 GitHub 仓库地址 → 安装
 */

(function () {
  'use strict';

  // ========== 扩展路径（酒馆约定） ==========
  const extensionName = "water-reminder";
  const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

  // ========== 配置（localStorage） ==========
  const LS_KEY = '__wrCfg';
  const DEFAULT_CFG = {
    enabled: true,
    intervalPreset: 30,
    intervalCustom: 45,
    alertMode: 'tritone',
    lastDrink: Date.now(),
  };
  function loadCfg() { try { return { ...DEFAULT_CFG, ...JSON.parse(localStorage.getItem(LS_KEY)) }; } catch { return { ...DEFAULT_CFG }; } }
  function saveCfg() { try { localStorage.setItem(LS_KEY, JSON.stringify(CFG)); } catch {} }
  let CFG = loadCfg();

  function getIntervalMin() {
    return CFG.intervalPreset === 0 ? CFG.intervalCustom : CFG.intervalPreset;
  }

  // ========== Toast & Intro HTML（运行时注入到 body） ==========
  const TOAST_CSS = `
.__wr_toast{position:fixed;top:20px;left:50%;transform:translateX(-50%) translateY(-20px);
  width:340px;padding:14px 18px;
  background:rgba(255,255,255,.04);
  backdrop-filter:blur(24px) saturate(180%);
  -webkit-backdrop-filter:blur(24px) saturate(180%);
  border:1px solid rgba(255,255,255,.08);
  border-radius:16px;
  box-shadow:0 8px 32px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.06);
  opacity:0;pointer-events:none;z-index:9999999;
  transition:all .4s cubic-bezier(.2,.8,.2,1);
  display:flex;align-items:center;gap:14px;color:#fff;
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","PingFang SC",system-ui,sans-serif;}
.__wr_toast.show{opacity:1;transform:translateX(-50%) translateY(0);pointer-events:auto;}
.__wr_toast .__wr_pulse{position:absolute;top:14px;left:14px;width:8px;height:8px;border-radius:50%;
  background:#38bdf8;opacity:.6;animation:__wr_pulse_dot 2s ease-out infinite;}
@keyframes __wr_pulse_dot{0%{transform:scale(1);opacity:.6;}100%{transform:scale(3.5);opacity:0;}}
.__wr_toast .__wr_dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;
  background:linear-gradient(135deg,#38bdf8,#0ea5e9);
  box-shadow:0 0 12px rgba(56,189,248,.6);}
.__wr_toast .__wr_content{flex:1;min-width:0;}
.__wr_toast .__wr_title{font-size:13px;font-weight:600;letter-spacing:.3px;}
.__wr_toast .__wr_sub{font-size:11px;opacity:.5;margin-top:2px;}
.__wr_toast .__wr_btn_group{display:flex;gap:6px;flex-shrink:0;}
.__wr_toast .__wr_mini{padding:6px 12px;border-radius:8px;border:none;font-size:11px;font-weight:500;cursor:pointer;transition:all .15s;}
.__wr_toast .__wr_mini.primary{background:linear-gradient(135deg,#38bdf8,#0284c7);color:#fff;}
.__wr_toast .__wr_mini.primary:hover{filter:brightness(1.15);}
.__wr_toast .__wr_mini.ghost{background:transparent;color:rgba(255,255,255,.5);
  border:1px solid rgba(255,255,255,.08);}
.__wr_toast .__wr_mini.ghost:hover{color:#fff;border-color:rgba(255,255,255,.2);}
.__wr_intro{position:fixed;bottom:30px;left:50%;transform:translateX(-50%);
  background:rgba(0,0,0,.85);color:#fff;padding:10px 16px;border-radius:20px;
  font-size:12px;z-index:9999999;opacity:0;transition:opacity .5s;
  backdrop-filter:blur(10px);}
.__wr_intro.show{opacity:1;}
`;

  const TOAST_HTML = `
<div class="__wr_toast" id="__wrToast">
  <span class="__wr_pulse"></span>
  <span class="__wr_dot"></span>
  <div class="__wr_content">
    <div class="__wr_title">该喝水啦</div>
    <div class="__wr_sub" id="__wrToastSub">距离上次喝水已经过去很久了</div>
  </div>
  <div class="__wr_btn_group">
    <button class="__wr_mini ghost" id="__wrToastLater">稍后</button>
    <button class="__wr_mini ghost" id="__wrToastCfg">⚙️</button>
    <button class="__wr_mini primary" id="__wrToastDrink">已喝水</button>
  </div>
</div>
<div class="__wr_intro" id="__wrIntro">💧 喝水提醒已启动，${getIntervalMin()} 分钟后第一次提醒</div>
`;

  function waitBody(cb) {
    if (document.body) cb();
    else new MutationObserver((mut, obs) => {
      if (document.body) { obs.disconnect(); cb(); }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  waitBody(async () => {
    // 注入 Toast CSS + HTML（到 body）
    const style = document.createElement('style');
    style.textContent = TOAST_CSS;
    document.head.appendChild(style);
    document.body.insertAdjacentHTML('beforeend', TOAST_HTML);

    // 加载 settings.html 并注入到酒馆扩展设置面板
    try {
      const resp = await fetch(`${extensionFolderPath}/settings.html`);
      if (resp.ok) {
        const html = await resp.text();
        // 酒馆有 #extensions_settings 和 #extensions_settings2 两个容器
        const target = document.querySelector('#extensions_settings2') ||
                       document.querySelector('#extensions_settings') ||
                       document.querySelector('[data-tab="extensions"]');
        if (target) {
          target.insertAdjacentHTML('afterbegin', html);
          console.log('[喝水提醒] 设置面板已注入');
        } else {
          console.warn('[喝水提醒] 未找到扩展设置容器，设置面板将在首次打开设置时尝试注入');
        }
      } else {
        console.error('[喝水提醒] 加载 settings.html 失败:', resp.status);
      }
    } catch (e) {
      console.error('[喝水提醒] fetch settings.html 异常:', e);
    }

    init();
  });

  // ========== 主逻辑 ==========
  function init() {
    const toast = document.getElementById('__wrToast');
    const toastDrink = document.getElementById('__wrToastDrink');
    const toastLater = document.getElementById('__wrToastLater');
    const toastCfg = document.getElementById('__wrToastCfg');
    const intro = document.getElementById('__wrIntro');

    function q(id) { return document.getElementById(id); }

    // --- 事件绑定（settings.html 可能稍后才渲染，轮询等待） ---
    function tryBindSettings() {
      const drawer = q('__wrDrawer');
      if (!drawer || drawer.dataset.bound) return false;
      drawer.dataset.bound = '1';

      // 抽屉开关
      drawer.querySelector('.__wr_drawer-toggle').addEventListener('click', () => drawer.classList.toggle('open'));

      // 启用开关
      q('__wrEnabled').addEventListener('change', (e) => {
        CFG.enabled = e.target.checked;
        if (CFG.enabled) CFG.lastDrink = Date.now();
        saveCfg();
        refreshDrawer();
      });

      // radio
      document.querySelectorAll('input[name="wrInterval"]').forEach(r => {
        r.addEventListener('change', () => {
          CFG.intervalPreset = parseInt(r.value);
          saveCfg();
          refreshDrawer();
          updateCountdown();
        });
      });

      // 自定义输入
      q('__wrCustomMin').addEventListener('change', (e) => {
        let v = parseInt(e.target.value);
        if (isNaN(v) || v < 5) v = 5;
        if (v > 360) v = 360;
        CFG.intervalCustom = v;
        saveCfg();
        updateCountdown();
      });

      // 提醒方式
      q('__wrAlertMode').addEventListener('change', (e) => {
        CFG.alertMode = e.target.value;
        saveCfg();
      });

      // 试听
      q('__wrTestAlert').addEventListener('click', () => triggerAlert());

      // 喝水按钮
      q('__wrDrinkNow').addEventListener('click', () => {
        CFG.lastDrink = Date.now();
        saveCfg();
        hideToast();
        updateCountdown();
      });

      refreshDrawer();
      return true;
    }

    function refreshDrawer() {
      const status = CFG.enabled ? '🟢' : '⚫';
      q('__wrStatus').textContent = `· ${getIntervalMin()}分钟 · ${status}`;
      const el = q('__wrEnabled'); if (el) el.checked = CFG.enabled;
      document.querySelectorAll('input[name="wrInterval"]').forEach(r => {
        const checked = (parseInt(r.value) === CFG.intervalPreset);
        r.checked = checked;
        const lbl = r.closest('label');
        if (lbl) lbl.classList.toggle('selected', checked);
      });
      const cm = q('__wrCustomMin'); if (cm) cm.value = CFG.intervalCustom;
      const cr = q('__wrCustomRow'); if (cr) cr.classList.toggle('show', CFG.intervalPreset === 0);
      const am = q('__wrAlertMode'); if (am) am.value = CFG.alertMode;
    }

    // 定时等待设置面板渲染
    const bindTimer = setInterval(() => {
      tryBindSettings();
      if (q('__wrDrawer') && q('__wrDrawer').dataset.bound) clearInterval(bindTimer);
    }, 300);
    setTimeout(() => clearInterval(bindTimer), 15000);

    // toast 按钮
    toastDrink.addEventListener('click', () => {
      CFG.lastDrink = Date.now();
      saveCfg();
      hideToast();
      if (q('__wrDrawer')) refreshDrawer();
      updateCountdown();
    });
    toastLater.addEventListener('click', () => {
      hideToast();
      CFG.lastDrink = Date.now() - (getIntervalMin() * 60 * 1000) + (10 * 60 * 1000);
      saveCfg();
    });
    toastCfg.addEventListener('click', () => {
      const drawer = q('__wrDrawer');
      if (drawer) { drawer.classList.add('open'); drawer.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      else alert('请打开酒馆【设置 → 扩展】面板查找"喝水提醒"');
    });

    // 首次加载提示
    intro.classList.add('show');
    setTimeout(() => intro.classList.remove('show'), 3500);

    // 全局配置入口
    window.__wrConfig = () => {
      const drawer = q('__wrDrawer');
      if (drawer) { drawer.classList.add('open'); drawer.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      else alert('设置面板还没加载出来');
    };

    // 主循环：每秒检查
    let lastRemindedAt = 0;
    setInterval(() => {
      updateCountdown();
      if (!CFG.enabled) return;
      const now = Date.now();
      const intervalMs = getIntervalMin() * 60 * 1000;
      if (now - CFG.lastDrink >= intervalMs) {
        if (now - lastRemindedAt >= 60000) {
          showToast();
          triggerAlert();
          lastRemindedAt = now;
        }
      } else {
        hideToast();
      }
    }, 1000);

    function updateCountdown() {
      const el = q('__wrCount');
      if (!el) return;
      const r = getIntervalMin() * 60000 - (Date.now() - CFG.lastDrink);
      if (r <= 0) el.textContent = '该喝了！';
      else {
        const m = Math.floor(r / 60000), s = Math.floor((r % 60000) / 1000);
        el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      }
    }

    function showToast() { toast.classList.add('show'); }
    function hideToast() { toast.classList.remove('show'); }

    // ========== 声音 & 震动 ==========
    let audioCtx = null;
    function warmAudio() {
      try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      } catch {}
    }
    function playTriTone() {
      warmAudio(); if (!audioCtx) return;
      [784, 659, 523].forEach((freq, i) => {
        const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
        osc.type = 'sine'; osc.frequency.value = freq;
        const t0 = audioCtx.currentTime + i * 0.18;
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(0.35, t0 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(t0); osc.stop(t0 + 0.2);
      });
    }
    function playRebound() {
      warmAudio(); if (!audioCtx) return;
      // 音1: 820→380Hz 下滑 0.12s
      const o1 = audioCtx.createOscillator(), g1 = audioCtx.createGain();
      o1.type = 'sine'; o1.frequency.setValueAtTime(820, audioCtx.currentTime);
      o1.frequency.exponentialRampToValueAtTime(380, audioCtx.currentTime + 0.12);
      g1.gain.setValueAtTime(0, audioCtx.currentTime);
      g1.gain.linearRampToValueAtTime(0.4, audioCtx.currentTime + 0.02);
      g1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
      o1.connect(g1); g1.connect(audioCtx.destination);
      o1.start(); o1.stop(audioCtx.currentTime + 0.13);
      // 音2: 0.16s 后 500→960Hz 上滑 0.1s
      const t2 = audioCtx.currentTime + 0.16;
      const o2 = audioCtx.createOscillator(), g2 = audioCtx.createGain();
      o2.type = 'sine'; o2.frequency.setValueAtTime(500, t2);
      o2.frequency.exponentialRampToValueAtTime(960, t2 + 0.1);
      g2.gain.setValueAtTime(0, t2);
      g2.gain.linearRampToValueAtTime(0.35, t2 + 0.02);
      g2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.1);
      o2.connect(g2); g2.connect(audioCtx.destination);
      o2.start(t2); o2.stop(t2 + 0.12);
    }
    function vibrate() {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate([300, 100, 300, 100, 300]); } catch {}
      }
    }
    function triggerAlert() {
      warmAudio();
      const m = CFG.alertMode;
      if (m === 'tritone') playTriTone();
      else if (m === 'rebound') playRebound();
      else if (m === 'vibrate') vibrate();
      else if (m === 'tritone+vibrate') { vibrate(); setTimeout(playTriTone, 200); }
      else if (m === 'rebound+vibrate') { vibrate(); setTimeout(playRebound, 200); }
    }

    console.log('[喝水提醒] 已加载 · 间隔', getIntervalMin(), '分钟 · 模式', CFG.alertMode);
  }
})();
