// ============================================================
// STATE
// ============================================================

let allContent = null;
let allMicroActions = [];
let activeFilter = 'all';
let didThis = false;

// Saved when renderToday() runs — used by share canvas
let _shareSlot = null;
let _shareSlotData = null;
let _shareThemeKey = null;

// ============================================================
// TIME HELPERS
// ============================================================

function getCurrentSlot() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 20) return 'afternoon';
  return 'night';
}

function getSlotLabel(slot) {
  const labels = { morning: 'morning', afternoon: 'afternoon', night: 'night' };
  return labels[slot] || slot;
}

// ============================================================
// THEME HELPERS
// ============================================================

function normalizeTheme(theme) {
  const map = {
    'Personal Identity':                    'personal-identity',
    'Health & Body Image':                  'health-body',
    'Burnout':                              'burnout',
    'Financial Knowledge':                  'financial',
    'Social Pressure vs. Authentic Living': 'social',
  };
  return map[theme] || 'personal-identity';
}

function themeDisplayLabel(themeKey) {
  const map = {
    'personal-identity': 'personal identity',
    'health-body':       'health & body',
    'burnout':           'burnout',
    'financial':         'financial',
    'social':            'social pressure',
  };
  return map[themeKey] || themeKey;
}

// ============================================================
// CONTENT HELPERS
// ============================================================

function getTodayData(content) {
  const today = new Date();
  const yyyy  = today.getFullYear();
  const mm    = String(today.getMonth() + 1).padStart(2, '0');
  const dd    = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  // 1. Exact date match (ideal — content generated for this month)
  const exact = content.days.find(d => d.date === todayStr);
  if (exact) return exact;

  // 2. Day-of-month fallback (content generated for a different month)
  //    e.g. today is Feb 19 but content.json covers March — use day 19
  const dayOfMonth = today.getDate();
  const byDayNum = content.days.find(d => d.day === dayOfMonth);
  if (byDayNum) return byDayNum;

  // 3. Last day in the file (e.g. today is the 31st but content only has 30 days)
  return content.days[content.days.length - 1] || null;
}

// Build a flat list of all micro-actions from all days for the explore grid
function buildMicroActions(content) {
  const actions = [];
  for (const day of content.days) {
    const themeKey = normalizeTheme(day.theme);
    for (const slot of ['morning', 'afternoon']) {
      const ma = day[slot] && day[slot].micro_action;
      if (ma && ma.action) {
        actions.push({
          action:      ma.action,
          whose_life:  ma.whose_life || '',
          impact:      ma.impact || '',
          theme:       themeKey,
          day_of_week: day.day_of_week,
          slot,
        });
      }
    }
  }
  return actions;
}

// Fisher-Yates shuffle — called once on load so results stay fixed until refresh
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ============================================================
// SHARE — CANVAS DRAW
// ============================================================

const SHARE_THEME_COLORS = {
  'personal-identity': '#9B8EC4',
  'health-body':       '#85C78A',
  'burnout':           '#E8B070',
  'financial':         '#7BB8E8',
  'social':            '#E88A9E',
};

const SHARE_SLOT_COLORS = {
  morning:   '#F4C97A',
  afternoon: '#E8B070',
  night:     '#9B8EC4',
};

function hexAlpha(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function canvasRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Wraps text and returns the y position after the last line
function canvasWrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let cy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineH;
    } else {
      line = test;
    }
  }
  if (line) { ctx.fillText(line, x, cy); cy += lineH; }
  return cy;
}

function _drawCard1Canvas(ctx, x, y, w) {
  let label, text;
  if (_shareSlot === 'morning') {
    label = 'AFFIRMATION';
    text = _shareSlotData.affirmation || '';
  } else if (_shareSlot === 'afternoon') {
    label = 'CHECK IN';
    text = _shareSlotData.recentering_question || '';
  } else {
    label = 'REFLECT';
    text = _shareSlotData.reflection_question || '';
  }

  ctx.font = "700 18px 'DM Sans', sans-serif";
  ctx.fillStyle = '#E8876A';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(label, x, y);
  y += 44;

  // Decorative left bar
  ctx.fillStyle = '#E8876A';
  ctx.fillRect(x, y, 3, 220);

  const isSerif = _shareSlot === 'morning';
  ctx.font = isSerif ? "italic 600 38px 'Playfair Display', serif" : "500 32px 'DM Sans', sans-serif";
  ctx.fillStyle = '#FAF7F5';
  y = canvasWrapText(ctx, text, x + 22, y, w - 22, isSerif ? 54 : 46);
  return y + 20;
}

function _drawCard2Canvas(ctx, x, y, w) {
  const ma = _shareSlotData.micro_action;
  const themeColor = SHARE_THEME_COLORS[_shareThemeKey] || '#E8876A';
  const themeLabel = themeDisplayLabel(_shareThemeKey).toUpperCase();

  // Theme tag pill
  ctx.font = "700 15px 'DM Sans', sans-serif";
  const tagPadX = 18;
  const tagH = 32;
  const tagW = ctx.measureText(themeLabel).width + tagPadX * 2;
  ctx.fillStyle = hexAlpha(themeColor, 0.18);
  canvasRoundRect(ctx, x, y, tagW, tagH, tagH / 2);
  ctx.fill();
  ctx.fillStyle = themeColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(themeLabel, x + tagW / 2, y + tagH / 2);
  y += tagH + 28;

  // Action text
  ctx.font = "600 42px 'Playfair Display', serif";
  ctx.fillStyle = '#FAF7F5';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  y = canvasWrapText(ctx, ma.action || '', x, y, w, 58);
  y += 24;

  // Impact box — measure lines to size it
  ctx.font = "400 15px 'DM Sans', sans-serif";
  const impactLineCount = Math.max(1, Math.ceil(ctx.measureText(ma.impact || '').width / (w - 40)));
  const impBoxH = 20 + 24 + 26 + impactLineCount * 22 + 20;
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  canvasRoundRect(ctx, x, y, w, impBoxH, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(58,52,48,1)';
  ctx.lineWidth = 1;
  canvasRoundRect(ctx, x, y, w, impBoxH, 12);
  ctx.stroke();
  ctx.fillStyle = 'rgba(232,135,106,0.35)';
  ctx.fillRect(x, y, 2, impBoxH);

  const impX = x + 20;
  ctx.font = "700 13px 'DM Sans', sans-serif";
  ctx.fillStyle = '#8A7F78';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('CHANGED BY', impX, y + 18);
  ctx.font = "600 18px 'DM Sans', sans-serif";
  ctx.fillStyle = '#E8876A';
  ctx.fillText(ma.whose_life || '', impX, y + 42);
  ctx.font = "400 15px 'DM Sans', sans-serif";
  ctx.fillStyle = '#8A7F78';
  canvasWrapText(ctx, ma.impact || '', impX, y + 68, w - 40, 22);
  return y + impBoxH + 20;
}

function _drawCard3Canvas(ctx, x, y, w) {
  const sd = _shareSlotData;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  if (_shareSlot === 'morning') {
    const q = sd.quote;
    ctx.font = "700 18px 'DM Sans', sans-serif";
    ctx.fillStyle = '#E8876A';
    ctx.fillText('WISDOM', x, y);
    y += 44;

    ctx.fillStyle = 'rgba(232,135,106,0.35)';
    ctx.fillRect(x, y, 2, 250);

    ctx.font = "italic 400 36px 'Playfair Display', serif";
    ctx.fillStyle = '#FAF7F5';
    y = canvasWrapText(ctx, `"${q.text}"`, x + 22, y, w - 22, 52);
    y += 16;

    ctx.font = "400 18px 'DM Sans', sans-serif";
    ctx.fillStyle = '#8A7F78';
    ctx.fillText(`— ${q.author}`, x + 22, y);

  } else if (_shareSlot === 'afternoon') {
    ctx.font = "700 18px 'DM Sans', sans-serif";
    ctx.fillStyle = '#E8876A';
    ctx.fillText('PERMISSION', x, y);
    y += 44;

    // Measure permission slip to size the box
    ctx.font = "400 30px 'DM Sans', sans-serif";
    const slipLines = Math.max(1, Math.ceil(ctx.measureText(sd.permission_slip || '').width / (w - 48)));
    const slipBoxH = slipLines * 44 + 56;
    ctx.fillStyle = 'rgba(155,142,196,0.08)';
    canvasRoundRect(ctx, x, y, w, slipBoxH, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(155,142,196,0.2)';
    ctx.lineWidth = 1;
    canvasRoundRect(ctx, x, y, w, slipBoxH, 14);
    ctx.stroke();
    ctx.fillStyle = '#FAF7F5';
    canvasWrapText(ctx, sd.permission_slip || '', x + 24, y + 28, w - 48, 44);

  } else {
    ctx.font = "700 18px 'DM Sans', sans-serif";
    ctx.fillStyle = '#E8876A';
    ctx.fillText('RELEASE', x, y);
    y += 44;

    ctx.font = "400 24px 'DM Sans', sans-serif";
    ctx.fillStyle = '#8A7F78';
    y = canvasWrapText(ctx, sd.gratitude_nudge || '', x, y, w, 36);
    y += 16;

    ctx.font = "italic 400 36px 'Playfair Display', serif";
    ctx.fillStyle = '#FAF7F5';
    canvasWrapText(ctx, sd.release_statement || '', x, y, w, 52);
  }
}

function drawShareCard(cardNum) {
  const S = 1080;
  const PAD = 88;
  const W = S - PAD * 2;

  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#130F0E';
  ctx.fillRect(0, 0, S, S);

  // Subtle radial glow
  const grd = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, 580);
  grd.addColorStop(0, 'rgba(232,135,106,0.07)');
  grd.addColorStop(1, 'rgba(232,135,106,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, S, S);

  // Accent top bar
  ctx.fillStyle = '#E8876A';
  ctx.fillRect(0, 0, S, 5);

  // Wordmark top-left
  ctx.font = "700 30px 'Playfair Display', serif";
  ctx.fillStyle = '#E8876A';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('nudge', PAD, PAD + 14);

  // Slot badge top-right
  const slotColor = SHARE_SLOT_COLORS[_shareSlot] || '#E8876A';
  const slotLabel = (_shareSlot || '').toUpperCase();
  ctx.font = "700 16px 'DM Sans', sans-serif";
  const badgePadX = 20;
  const badgeH = 34;
  const badgeW = ctx.measureText(slotLabel).width + badgePadX * 2;
  const badgeX = PAD + W - badgeW;
  const badgeY = PAD + 12;
  ctx.fillStyle = hexAlpha(slotColor, 0.09);
  canvasRoundRect(ctx, badgeX, badgeY, badgeW, badgeH, badgeH / 2);
  ctx.fill();
  ctx.strokeStyle = hexAlpha(slotColor, 0.4);
  ctx.lineWidth = 1.5;
  canvasRoundRect(ctx, badgeX, badgeY, badgeW, badgeH, badgeH / 2);
  ctx.stroke();
  ctx.fillStyle = slotColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(slotLabel, badgeX + badgeW / 2, badgeY + badgeH / 2);

  // Card content
  const cy = PAD + 100;
  if (cardNum === 1) _drawCard1Canvas(ctx, PAD, cy, W);
  else if (cardNum === 2) _drawCard2Canvas(ctx, PAD, cy, W);
  else if (cardNum === 3) _drawCard3Canvas(ctx, PAD, cy, W);

  // Bottom tagline
  ctx.font = "400 18px 'DM Sans', sans-serif";
  ctx.fillStyle = 'rgba(138,127,120,0.7)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('Micro Inspirations, Large Actions', PAD, S - PAD - 62);

  // Bottom wordmark
  ctx.font = "700 54px 'Playfair Display', serif";
  ctx.fillStyle = '#E8876A';
  ctx.fillText('nudge', PAD, S - PAD);

  return canvas;
}

async function shareCard(cardNum) {
  if (typeof navigator.share !== 'function' || !_shareSlotData) return;
  try {
    await document.fonts.ready;
    const canvas = drawShareCard(cardNum);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const file = new File([blob], 'nudge.png', { type: 'image/png' });
    await navigator.share({ files: [file], title: 'nudge' });
  } catch (err) {
    if (err.name !== 'AbortError') console.error('Share failed:', err);
  }
}

// ============================================================
// RENDER — TODAY'S NUDGE
// ============================================================

function renderToday(content) {
  const loadingEl = document.getElementById('today-loading');
  const contentEl = document.getElementById('today-content');
  const emptyEl   = document.getElementById('today-empty');

  loadingEl.style.display = 'none';

  const day = getTodayData(content);
  if (!day) {
    emptyEl.style.display = 'block';
    return;
  }

  contentEl.style.display = 'grid';

  const slot     = getCurrentSlot();
  const slotData = day[slot];
  const themeKey = normalizeTheme(day.theme);

  // Save for share canvas
  _shareSlot     = slot;
  _shareSlotData = slotData;
  _shareThemeKey = themeKey;
  const canShare = typeof navigator.share === 'function';

  // Slot badge + day context
  const badge = document.getElementById('slot-badge');
  badge.textContent = getSlotLabel(slot);
  badge.className   = `slot-badge slot-${slot}`;
  document.getElementById('day-context').textContent =
    `${day.day_of_week} · ${day.day_energy} · ${day.theme}`;

  // --- Card 1: Affirmation or question ---
  const card1 = document.getElementById('today-card-1');
  const shareBtn1 = canShare
    ? '<div class="today-card__actions"><button class="btn-share" data-card="1">Share ↗</button></div>'
    : '';
  if (slot === 'morning') {
    card1.innerHTML = `
      <p class="today-card__label">Affirmation</p>
      <p class="slot-affirmation">${slotData.affirmation}</p>
      ${shareBtn1}
    `;
  } else if (slot === 'afternoon') {
    card1.innerHTML = `
      <p class="today-card__label">Check in</p>
      <p class="slot-question">${slotData.recentering_question}</p>
      ${shareBtn1}
    `;
  } else {
    card1.innerHTML = `
      <p class="today-card__label">Reflect</p>
      <p class="slot-question">${slotData.reflection_question}</p>
      ${shareBtn1}
    `;
  }

  // --- Card 2: Micro-action (primary card) ---
  const ma = slotData.micro_action;
  document.getElementById('today-card-2').innerHTML = `
    <div class="today-card__bar"></div>
    <div class="today-card__body">
      <span class="card-tag tag-${themeKey}">${themeDisplayLabel(themeKey)}</span>
      <h3 class="today-action__title">${ma.action}</h3>
      <div class="impact-block">
        <span class="impact-label">Changed by</span>
        <span class="impact-name">${ma.whose_life}</span>
        <p class="impact-text">${ma.impact}</p>
      </div>
      <div class="today-card__actions">
        <button class="btn-did-this" id="did-this-btn">I did this</button>
        ${canShare ? '<button class="btn-share" data-card="2">Share ↗</button>' : ''}
      </div>
    </div>
  `;
  initDidThis();

  // --- Card 3: Quote / permission slip / release ---
  const card3 = document.getElementById('today-card-3');
  const shareBtn3 = canShare
    ? '<div class="today-card__actions"><button class="btn-share" data-card="3">Share ↗</button></div>'
    : '';
  if (slot === 'morning') {
    const q = slotData.quote;
    card3.innerHTML = `
      <p class="today-card__label">Wisdom</p>
      <blockquote class="nudge-quote">
        <p class="nudge-quote__text">"${q.text}"</p>
        <cite class="nudge-quote__cite">— ${q.author}, <span class="quote-context">${q.context}</span></cite>
      </blockquote>
      ${shareBtn3}
    `;
  } else if (slot === 'afternoon') {
    card3.innerHTML = `
      <p class="today-card__label">Permission</p>
      <p class="permission-slip">${slotData.permission_slip}</p>
      ${shareBtn3}
    `;
  } else {
    card3.innerHTML = `
      <p class="today-card__label">Release</p>
      <p class="gratitude-nudge">${slotData.gratitude_nudge}</p>
      <p class="release-statement">${slotData.release_statement}</p>
      ${shareBtn3}
    `;
  }

  // Wire up share buttons (mobile only — navigator.share is undefined on desktop)
  if (canShare) {
    document.querySelectorAll('.btn-share').forEach(btn => {
      btn.addEventListener('click', () => shareCard(+btn.dataset.card));
    });
  }

  // Inspirational story (full-width, same card style as stories section)
  renderInspirationStory(day.inspirational_story);
}

function renderInspirationStory(story) {
  if (!story) return;
  const el       = document.getElementById('inspiration-story');
  const initials = story.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const paras    = Array.isArray(story.story) ? story.story : [story.story];
  const first    = paras[0];
  const rest     = paras.slice(1).map(p => `<p class="story-card__para">${p}</p>`).join('');

  el.innerHTML = `
    <article class="story-card story-card--today">
      <span class="story-card__read-time">Today's Story</span>
      <h3 class="story-card__title">${story.name}</h3>
      <div class="story-card__full-text">
        <p class="story-card__para">${first}</p>
        <div class="story-extra" id="story-extra">${rest}</div>
        <button class="btn-read-more" id="read-more-btn">Read more</button>
      </div>
      <div class="story-card__author">
        <div class="author-avatar">${initials}</div>
        <div class="author-info">
          <p class="author-name">${story.name}</p>
          <p class="author-role">${story.who_she_is}</p>
        </div>
      </div>
    </article>
  `;

  document.getElementById('read-more-btn').addEventListener('click', function () {
    const extra  = document.getElementById('story-extra');
    const isOpen = extra.classList.contains('is-open');
    extra.classList.toggle('is-open', !isOpen);
    this.textContent = isOpen ? 'Read more' : 'Read less';
  });
}

// ============================================================
// RENDER — EXPLORE GRID
// ============================================================

function renderExploreGrid() {
  const grid = document.getElementById('nudge-grid');
  document.getElementById('explore-loading').style.display = 'none';

  // "all" shows 2 from each category (10 total); a specific category shows 3
  let filtered;
  if (activeFilter === 'all') {
    const themes = ['personal-identity', 'health-body', 'burnout', 'financial', 'social'];
    filtered = themes.flatMap(t =>
      allMicroActions.filter(a => a.theme === t).slice(0, 2)
    );
  } else {
    filtered = allMicroActions.filter(a => a.theme === activeFilter).slice(0, 3);
  }

  if (filtered.length === 0) {
    grid.innerHTML = '<p class="empty-message">No actions found for this category yet.</p>';
    return;
  }

  grid.innerHTML = filtered.map((item, idx) => `
    <div class="nudge-card">
      <span class="card-tag tag-${item.theme}">${themeDisplayLabel(item.theme)}</span>
      <p class="nudge-card__action">${item.action}</p>
      <div class="nudge-impact">
        <p class="nudge-impact__who">${item.whose_life}</p>
        <p class="nudge-impact__text">${item.impact}</p>
      </div>
      <div class="nudge-card__footer">
        <button
          class="check-btn"
          data-idx="${idx}"
          aria-label="Mark as done"
          title="Mark done"
        >○</button>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.check-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const done = btn.classList.contains('done');
      btn.textContent = done ? '○' : '✓';
      btn.classList.toggle('done', !done);
      btn.setAttribute('aria-label', done ? 'Mark as done' : 'Mark as not done');
    });
  });
}

// ============================================================
// RENDER — STORIES
// ============================================================

function renderStories(content) {
  const grid = document.getElementById('stories-grid');
  document.getElementById('stories-loading').style.display = 'none';

  // Pick up to 6 stories, deduplicating by woman's name
  const seen = new Set();
  const stories = [];
  for (const day of content.days) {
    if (stories.length >= 6) break;
    const s = day.inspirational_story;
    if (s && s.name && !seen.has(s.name)) {
      seen.add(s.name);
      stories.push({ ...s, theme: day.theme, day_of_week: day.day_of_week });
    }
  }

  if (stories.length === 0) {
    grid.innerHTML = '<p class="empty-message">Stories will appear here once content is loaded.</p>';
    return;
  }

  grid.innerHTML = stories.map((story, i) => {
    const initials = story.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    const themeKey = normalizeTheme(story.theme);
    const paras    = Array.isArray(story.story) ? story.story : [story.story];
    const first    = paras[0];
    const rest     = paras.slice(1).map(p => `<p class="story-card__para">${p}</p>`).join('');

    return `
      <article class="story-card">
        <span class="story-card__read-time">${themeDisplayLabel(themeKey)}</span>
        <h3 class="story-card__title">${story.name}</h3>
        <div class="story-card__text-wrap">
          <p class="story-card__excerpt">${first}</p>
          <div class="story-extra" id="grid-story-extra-${i}">${rest}</div>
          <button class="btn-read-more" data-story-idx="${i}">Read more</button>
        </div>
        <div class="story-card__author">
          <div class="author-avatar">${initials}</div>
          <div class="author-info">
            <p class="author-name">${story.name}</p>
            <p class="author-role">${story.who_she_is}</p>
          </div>
        </div>
      </article>
    `;
  }).join('');

  grid.querySelectorAll('.btn-read-more[data-story-idx]').forEach(btn => {
    btn.addEventListener('click', function () {
      const idx    = this.dataset.storyIdx;
      const extra  = document.getElementById(`grid-story-extra-${idx}`);
      const isOpen = extra.classList.contains('is-open');
      extra.classList.toggle('is-open', !isOpen);
      this.textContent = isOpen ? 'Read more' : 'Read less';
    });
  });
}

// ============================================================
// FILTER PILLS
// ============================================================

function initFilters() {
  const pills = document.querySelectorAll('#filter-pills .pill');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      activeFilter = pill.dataset.filter;
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      renderExploreGrid();
    });
  });
}

// ============================================================
// DID THIS BUTTON
// ============================================================

function initDidThis() {
  const btn = document.getElementById('did-this-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    didThis = !didThis;
    btn.textContent = didThis ? 'Done! Come back next time ✓' : 'I did this';
    btn.classList.toggle('done', didThis);
  });
}

// ============================================================
// HERO BUTTONS
// ============================================================

function initHeroButtons() {
  const smoothTo = id => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  document.getElementById('nudge-me-btn')?.addEventListener('click',  () => smoothTo('today'));
  document.getElementById('explore-btn')?.addEventListener('click',   () => smoothTo('explore'));
  document.getElementById('nav-nudge-btn')?.addEventListener('click', () => smoothTo('today'));
}

// ============================================================
// INIT
// ============================================================

async function init() {
  try {
    const res = await fetch('./content.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allContent = await res.json();

    allMicroActions = shuffle(buildMicroActions(allContent));

    renderToday(allContent);
    renderExploreGrid();
    renderStories(allContent);

  } catch (err) {
    console.error('Could not load content.json:', err);

    document.getElementById('today-loading').style.display = 'none';
    document.getElementById('today-error').style.display   = 'block';
    document.getElementById('explore-loading').style.display = 'none';
    document.getElementById('stories-loading').style.display = 'none';

    document.getElementById('nudge-grid').innerHTML =
      '<p class="empty-message">Run <code>python generate_content.py</code> to generate this month\'s content.</p>';
    document.getElementById('stories-grid').innerHTML = '';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  init();
  initFilters();
  initDidThis();
  initHeroButtons();
});
