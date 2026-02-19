// ============================================================
// STATE
// ============================================================

let allContent = null;
let allMicroActions = [];
let activeFilter = 'all';
let didThis = false;

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

  // Slot badge + day context
  const badge = document.getElementById('slot-badge');
  badge.textContent = getSlotLabel(slot);
  badge.className   = `slot-badge slot-${slot}`;
  document.getElementById('day-context').textContent =
    `${day.day_of_week} · ${day.day_energy} · ${day.theme}`;

  // --- Card 1: Affirmation or question ---
  const card1 = document.getElementById('today-card-1');
  if (slot === 'morning') {
    card1.innerHTML = `
      <p class="today-card__label">Affirmation</p>
      <p class="slot-affirmation">${slotData.affirmation}</p>
    `;
  } else if (slot === 'afternoon') {
    card1.innerHTML = `
      <p class="today-card__label">Check in</p>
      <p class="slot-question">${slotData.recentering_question}</p>
    `;
  } else {
    card1.innerHTML = `
      <p class="today-card__label">Reflect</p>
      <p class="slot-question">${slotData.reflection_question}</p>
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
      <button class="btn-did-this" id="did-this-btn">I did this</button>
    </div>
  `;
  initDidThis();

  // --- Card 3: Quote / permission slip / release ---
  const card3 = document.getElementById('today-card-3');
  if (slot === 'morning') {
    const q = slotData.quote;
    card3.innerHTML = `
      <p class="today-card__label">Wisdom</p>
      <blockquote class="nudge-quote">
        <p class="nudge-quote__text">"${q.text}"</p>
        <cite class="nudge-quote__cite">— ${q.author}, <span class="quote-context">${q.context}</span></cite>
      </blockquote>
    `;
  } else if (slot === 'afternoon') {
    card3.innerHTML = `
      <p class="today-card__label">Permission</p>
      <p class="permission-slip">${slotData.permission_slip}</p>
    `;
  } else {
    card3.innerHTML = `
      <p class="today-card__label">Release</p>
      <p class="gratitude-nudge">${slotData.gratitude_nudge}</p>
      <p class="release-statement">${slotData.release_statement}</p>
    `;
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
