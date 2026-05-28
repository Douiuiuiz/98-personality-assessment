/**
 * 应用控制器：四选一点击交互、计时器、速度检测、报告渲染
 */
const App = (() => {
  const STORAGE_KEY = 'likert_assessment_v1';
  const TOTAL = 60;
  const TIME_LIMIT = 45 * 60;      // 45分钟倒计时
  const SPEED_WARN = 3 * 1000;     // 3秒内答题提醒
  const SPEED_WARN_LIMIT = 3;      // 累计3次后严厉提醒

  let state = {
    currentIdx: 0,
    answers: {},                   // { questionId: 1|2|3|4 }
    completed: false,
    timeRemaining: TIME_LIMIT,
    questionStartTime: Date.now(),
    speedWarnings: 0,
  };

  let timerInterval = null;
  let radarChart = null;

  // ========== 持久化 ==========
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { return null; }
  }
  function clearStore() { localStorage.removeItem(STORAGE_KEY); }

  // ========== 页面切换 ==========
  function showPage(name) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${name}`).classList.add('active');
  }

  // ========== Toast ==========
  function showToast(msg, type) {
    type = type || 'error';
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = 'toast-item ' + type;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  // ========== 计时器 ==========
  function startTimer() {
    stopTimer();
    updateTimerDisplay();
    timerInterval = setInterval(() => {
      state.timeRemaining--;
      updateTimerDisplay();
      if (state.timeRemaining <= 0) {
        stopTimer();
        showToast('⏰ 时间到！测评已自动提交', 'info');
        setTimeout(() => forceSubmit(), 1500);
      }
      save();
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }

  function updateTimerDisplay() {
    const mins = Math.floor(state.timeRemaining / 60);
    const secs = state.timeRemaining % 60;
    const text = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
    const el = document.getElementById('timer-text');
    if (el) {
      el.textContent = text;
      el.className = 'timer-text';
      if (state.timeRemaining <= 60) el.classList.add('danger');
      else if (state.timeRemaining <= 300) el.classList.add('warning');
    }
  }

  function forceSubmit() {
    // 自动填充未答题（默认选"较符合"=3）
    for (const q of QUESTION_BANK) {
      if (!state.answers[q.id]) state.answers[q.id] = 3;
    }
    state.completed = true;
    save();
    showReport();
  }

  // ========== 初始化 ==========
  function init() {
    const saved = load();
    if (saved && saved.completed) {
      state = saved;
      showReportFromSaved();
    } else if (saved && !saved.completed && Object.keys(saved.answers).length > 0) {
      state = saved;
      showWelcome();
      document.getElementById('resume-hint').style.display = 'block';
    } else {
      clearStore();
      showWelcome();
    }
  }

  function showWelcome() {
    stopTimer();
    showPage('welcome');
    const saved = load();
    if (saved && !saved.completed && Object.keys(saved.answers || {}).length > 0) {
      document.getElementById('resume-hint').style.display = 'block';
    }
  }

  function startAssessment() {
    clearStore();
    state = { currentIdx: 0, answers: {}, completed: false, timeRemaining: TIME_LIMIT, questionStartTime: Date.now(), speedWarnings: 0 };
    showPage('assessment');
    startTimer();
    renderProgressDots();
    renderQuestion();
  }

  function resumeAssessment() {
    const saved = load();
    if (!saved || saved.completed) return startAssessment();
    state = saved;
    showPage('assessment');
    startTimer();
    renderProgressDots();
    renderQuestion();
  }

  // ========== 进度指示器 ==========
  function renderProgressDots() {
    const container = document.getElementById('progress-dots');
    let html = '';
    for (let i = 0; i < TOTAL; i++) {
      const qId = QUESTION_BANK[i].id;
      const answered = !!state.answers[qId];
      const current = i === state.currentIdx;
      let cls = 'progress-dot';
      if (answered) cls += ' answered';
      if (current) cls += ' current';
      html += `<span class="${cls}" title="第${i+1}题"></span>`;
    }
    container.innerHTML = html;
  }

  function updateProgressDots() {
    const dots = document.querySelectorAll('.progress-dot');
    dots.forEach((dot, i) => {
      const qId = QUESTION_BANK[i].id;
      dot.className = 'progress-dot';
      if (state.answers[qId]) dot.classList.add('answered');
      if (i === state.currentIdx) dot.classList.add('current');
    });
  }

  // ========== 渲染题目 ==========
  function renderQuestion() {
    const q = QUESTION_BANK[state.currentIdx];
    state.questionStartTime = Date.now();

    document.getElementById('q-current').textContent = state.currentIdx + 1;
    document.getElementById('question-text').textContent = q.text;

    // 高亮已选选项
    const selectedVal = state.answers[q.id];
    document.querySelectorAll('.option-btn').forEach(btn => {
      const val = parseInt(btn.dataset.value);
      btn.classList.toggle('selected', val === selectedVal);
    });

    // 进度条
    const answered = Object.keys(state.answers).length;
    document.getElementById('progress-bar').style.width = Math.round((answered / TOTAL) * 100) + '%';
    document.getElementById('question-counter').textContent = `${state.currentIdx + 1}/${TOTAL}`;

    // 上一题按钮
    document.getElementById('btn-prev').style.visibility = state.currentIdx === 0 ? 'hidden' : 'visible';

    // 下一题按钮
    updateNextButton();

    updateProgressDots();
  }

  function updateNextButton() {
    const qId = QUESTION_BANK[state.currentIdx].id;
    const answered = !!state.answers[qId];
    const btn = document.getElementById('btn-next');
    btn.disabled = !answered;
    if (state.currentIdx === TOTAL - 1) {
      btn.textContent = '查看报告';
    } else {
      btn.textContent = '下一题';
    }
  }

  // ========== 选择选项 ==========
  function selectOption(value) {
    if (state.completed) return;
    const qId = QUESTION_BANK[state.currentIdx].id;

    // 如果已选相同值，取消选择
    if (state.answers[qId] === value) {
      delete state.answers[qId];
    } else {
      state.answers[qId] = value;
    }

    save();
    renderQuestion();
  }

  // ========== 导航 + 速度检测 ==========
  function nextQuestion() {
    const qId = QUESTION_BANK[state.currentIdx].id;
    if (!state.answers[qId]) return;

    // 速度检测
    const elapsed = Date.now() - state.questionStartTime;
    if (elapsed < SPEED_WARN) {
      state.speedWarnings++;
      if (state.speedWarnings >= SPEED_WARN_LIMIT) {
        showToast('⚠️ 你已多次快速作答，请认真阅读每道题目后再做选择', 'warn');
      } else {
        showToast('请认真阅读题目，不必急于作答', 'warn');
      }
      save();
    }

    if (state.currentIdx < TOTAL - 1) {
      state.currentIdx++;
      renderQuestion();
      save();
    } else {
      state.completed = true;
      stopTimer();
      save();
      showReport();
    }
  }

  function goToPrev() {
    if (state.currentIdx <= 0) return;
    state.currentIdx--;
    state.questionStartTime = Date.now();
    renderQuestion();
    save();
  }

  // ========== 报告 ==========
  function showReport() {
    const result = runFullScoring(state.answers);
    showPage('report');
    renderReport(result);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showReportFromSaved() {
    showReport();
  }

  function renderReport(result) {
    const { typeResult, aspects, percentiles } = result;

    document.getElementById('report-type-badge').textContent = typeResult.primary.name + ' · ' + typeResult.secondary.name;
    document.getElementById('report-summary').textContent = typeResult.summary;

    // Aspect overview
    const colors = { "抱负能量": '#EF4444', "思维模式": '#3B82F6', "情绪适应": '#10B981', "人际互动": '#F59E0B', "任务执行": '#8B5CF6' };
    document.getElementById('report-aspects').innerHTML = Object.entries(aspects).map(([n, s]) =>
      `<div class="aspect-card"><div class="aspect-card-label">${n}</div><div class="aspect-card-score" style="color:${colors[n]}">${s}</div><div class="aspect-card-bar"><div class="aspect-card-bar-fill" style="width:${s}%;background:${colors[n]}"></div></div><div class="aspect-card-tag">${s>=55?'偏高':s<=45?'偏低':'均衡'}</div></div>`
    ).join('');

    // Radar
    renderRadarChart(aspects);

    // Aspect details
    document.getElementById('report-aspect-details').innerHTML = Object.entries(ASPECTS).map(([an, ad]) => {
      const dims = ad.dims.map(d => ({ name: d, score: percentiles[d]||50 })).sort((a,b) => b.score - a.score);
      const avg = Math.round(dims.reduce((s,d)=>s+d.score,0)/dims.length);
      const tags = dims.map(d => `<span class="dim-tag ${d.score>=60?'high':d.score<=40?'low':'mid'}">${d.name} ${d.score}</span>`).join('');
      return `<div class="aspect-detail-card"><div class="aspect-detail-header"><span class="aspect-detail-name" style="color:${colors[an]}">${an}</span><span class="aspect-detail-avg">综合 <strong style="color:${colors[an]}">${avg}</strong></span></div><div class="aspect-detail-desc">${ad.desc}</div><div class="dim-tags">${tags}</div></div>`;
    }).join('');

    // Company cards
    renderCompanyCards(result);

    // Consistency
    const { consistency } = result;
    const icons = { high: '✅', moderate: 'ℹ️', low: '⚠️', poor: '❌' };
    const cc = { high: '#166534', moderate: '#854D0E', low: '#DC2626', poor: '#991B1B' };
    const bgs = { high: '#DCFCE7', moderate: '#FEF3C7', low: '#FEE2E2', poor: '#FEE2E2' };
    const warnsText = consistency.warnings && consistency.warnings.length ? `<div class="consistency-dims">关注项：${consistency.warnings.join('、')}</div>` : '';
    document.getElementById('consistency-card').innerHTML = `<div class="consistency-level" style="color:${cc[consistency.level]}"><span>${icons[consistency.level]}</span>${consistency.label}<span style="font-size:12px;padding:2px 8px;border-radius:10px;background:${bgs[consistency.level]};color:${cc[consistency.level]}">不一致计数 ${consistency.inconsistencyCount}</span></div><div class="consistency-detail">${consistency.detail}</div>${warnsText}`;

    // Advice
    document.getElementById('advice-list').innerHTML = result.advice.map(a => `<div class="advice-item"><h3>${a.title}</h3><p>${a.content}</p></div>`).join('');

    // Tips
    document.getElementById('tips-list').innerHTML = ASSESSMENT_TIPS.map(t => `<div class="tip-card"><h3>${t.title}</h3><p>${t.content}</p></div>`).join('');
  }

  function renderRadarChart(aspects) {
    if (radarChart) { radarChart.destroy(); radarChart = null; }
    const ctx = document.getElementById('radar-chart').getContext('2d');
    radarChart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: Object.keys(aspects),
        datasets: [{
          data: Object.values(aspects),
          backgroundColor: 'rgba(79,70,229,0.1)',
          borderColor: 'rgba(79,70,229,1)',
          borderWidth: 2.5,
          pointBackgroundColor: 'rgba(79,70,229,1)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 5,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: true,
        scales: { r: { beginAtZero: false, min: 0, max: 100, ticks: { stepSize: 20, backdropColor: 'transparent', font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.06)' }, angleLines: { color: 'rgba(0,0,0,0.06)' }, pointLabels: { font: { size: 13, weight: '600' } } } },
        plugins: { legend: { display: false } }
      }
    });
  }

  function renderCompanyCards(result) {
    const { companyResult } = result;
    const ranked = companyResult.ranked;
    const icons = { "字节跳动": '🟢', "腾讯": '🔵', "阿里巴巴": '🟠', "美团": '🟡', "拼多多": '🔴', "滴滴": '🚗', "小红书": '📕', "快手": '🎬', "京东": '🐕', "百度": '🐾', "网易": '🎮', "得物": '👟' };

    document.getElementById('company-cards').innerHTML = ranked.map(([company, data], idx) => {
      const rankLabel = idx === 0 ? '最佳' : idx === 1 ? '第二' : idx === 2 ? '第三' : (idx + 1) + '';
      const rankCls = idx === 0 ? '' : idx === 1 ? 'second' : '';
      const circleCls = data.matchPercent >= 75 ? 'high' : data.matchPercent >= 50 ? 'medium' : 'low';
      let detailsHtml = '';
      if (data.matchDetails.length) {
        detailsHtml += `<div class="match-label">✅ 匹配</div>`;
        data.matchDetails.slice(0, 3).forEach(d => { detailsHtml += `<div class="item">${d.dim}(${d.score})</div>`; });
      }
      if (data.mismatchDetails.length) {
        detailsHtml += `<div class="mismatch-label">⚠️ 差异</div>`;
        data.mismatchDetails.slice(0, 3).forEach(d => { detailsHtml += `<div class="item">${d.dim}(${d.score})</div>`; });
      }
      return `<div class="company-card ${idx===0?'best-match':''}"><div class="company-card-rank ${rankCls}">${rankLabel}</div><div class="company-card-icon">${icons[company]||'🏢'}</div><div class="company-name">${company}</div><div class="company-match-circle ${circleCls}">${data.matchPercent}%</div><div class="company-match-details">${detailsHtml}</div></div>`;
    }).join('');
  }

  function restart() {
    stopTimer();
    clearStore();
    showWelcome();
  }

  // ========== 键盘快捷键 ==========
  document.addEventListener('keydown', (e) => {
    if (state.completed) return;
    if (!document.getElementById('page-assessment').classList.contains('active')) return;

    switch (e.key) {
      case '1': selectOption(1); break;
      case '2': selectOption(2); break;
      case '3': selectOption(3); break;
      case '4': selectOption(4); break;
      case 'ArrowRight': nextQuestion(); break;
      case 'ArrowLeft': goToPrev(); break;
      case 'Enter':
        const qId = QUESTION_BANK[state.currentIdx].id;
        if (state.answers[qId]) nextQuestion();
        break;
    }
  });

  // ========== 初始化 ==========
  document.addEventListener('DOMContentLoaded', () => {
    init();
  });

  return {
    init, startAssessment, resumeAssessment, selectOption, nextQuestion, goToPrev, restart,
    get state() { return state; }
  };
})();
