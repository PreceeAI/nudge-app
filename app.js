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
  const yyyy = today.getFullYear();
  const mm   = String(today.getMonth() + 1).padStart(2, '0');
  const dd   = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;
  return content.days.find(d => d.date === todayStr) || null;
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

// ============================================================
// RENDER — TODAY'S NUDGE
// ============================================================

function renderToday(content) {
  const loadingEl = document.getElementById('today-loading');
  const contentEl = document.getElementById('today-content');
  const emptyEl   = document.getElementById('today-empty');
  const errorEl   = document.getElementById('today-error');

  loadingEl.style.display = 'none';

  const day = getTodayData(content);

  if (!day) {
    emptyEl.style.display = 'block';
    return;
  }

  contentEl.style.display = 'block';

  const slot     = getCurrentSlot();
  const slotData = day[slot];
  const themeKey = normalizeTheme(day.theme);

  // Slot badge
  const badge = document.getElementById('slot-badge');
  badge.textContent = getSlotLabel(slot);
  badge.className   = `slot-badge slot-${slot}`;

  // Day context line
  document.getElementById('day-context').textContent =
    `${day.day_of_week} · ${day.day_energy} · ${day.theme}`;

  // Top content (affirmation or question)
  const topEl = document.getElementById('slot-top-content');
  if (slot === 'morning') {
    topEl.innerHTML = `<p class="slot-affirmation">${slotData.affirmation}</p>`;
  } else if (slot === 'afternoon') {
    topEl.innerHTML = `<p class="slot-question">${slotData.recentering_question}</p>`;
  } else {
    topEl.innerHTML = `<p class="slot-question">${slotData.reflection_question}</p>`;
  }

  // Micro-action block
  const ma = slotData.micro_action;
  document.getElementById('micro-action-block').innerHTML = `
    <span class="card-tag tag-${themeKey}">${themeDisplayLabel(themeKey)}</span>
    <h3 class="featured-card__title">${ma.action}</h3>
    <div class="impact-block">
      <span class="impact-label">Changed by:</span>
      <span class="impact-name">${ma.whose_life}</span>
      <p class="impact-text">${ma.impact}</p>
    </div>
  `;

  // Bottom content (quote, permission slip, or release)
  const bottomEl = document.getElementById('slot-bottom-content');
  if (slot === 'morning') {
    const q = slotData.quote;
    bottomEl.innerHTML = `
      <blockquote class="nudge-quote">
        <p class="nudge-quote__text">"${q.text}"</p>
        <cite class="nudge-quote__cite">— ${q.author}, <span class="quote-context">${q.context}</span></cite>
      </blockquote>
    `;
  } else if (slot === 'afternoon') {
    bottomEl.innerHTML = `
      <p class="permission-slip">${slotData.permission_slip}</p>
    `;
  } else {
    bottomEl.innerHTML = `
      <p class="gratitude-nudge">${slotData.gratitude_nudge}</p>
      <p class="release-statement">${slotData.release_statement}</p>
    `;
  }

  // Inspirational story
  renderInspirationStory(day.inspirational_story);
}

function renderInspirationStory(story) {
  if (!story) return;
  const el = document.getElementById('inspiration-story');
  const paragraphs = Array.isArray(story.story)
    ? story.story.map(p => `<p>${p}</p>`).join('')
    : `<p>${story.story}</p>`;

  const initials = story.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  el.innerHTML = `
    <div class="insp-story-header">
      <span class="insp-story-eyebrow">Today's Story</span>
      <div class="insp-story-identity">
        <div class="insp-avatar">${initials}</div>
        <div>
          <h3 class="insp-story-name">${story.name}</h3>
          <p class="insp-story-who">${story.who_she_is}</p>
        </div>
      </div>
    </div>
    <div class="insp-story-body">${paragraphs}</div>
  `;
}

// ============================================================
// RENDER — EXPLORE GRID
// ============================================================

function renderExploreGrid() {
  const grid = document.getElementById('nudge-grid');
  document.getElementById('explore-loading').style.display = 'none';

  const filtered = activeFilter === 'all'
    ? allMicroActions
    : allMicroActions.filter(a => a.theme === activeFilter);

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
        <span class="nudge-card__day">${item.day_of_week} ${item.slot}</span>
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

  // Pick 6 evenly-spaced stories from the month
  const step = Math.floor(content.days.length / 6) || 1;
  const stories = content.days
    .filter((_, i) => i % step === 0)
    .slice(0, 6)
    .map(d => ({ ...d.inspirational_story, theme: d.theme, day_of_week: d.day_of_week }));

  if (stories.length === 0) {
    grid.innerHTML = '<p class="empty-message">Stories will appear here once content is loaded.</p>';
    return;
  }

  grid.innerHTML = stories.map(story => {
    const initials = story.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    const themeKey = normalizeTheme(story.theme);
    const excerpt  = Array.isArray(story.story) ? story.story[0] : story.story;

    return `
      <article class="story-card">
        <span class="story-card__read-time">${themeDisplayLabel(themeKey)}</span>
        <h3 class="story-card__title">${story.name}</h3>
        <p class="story-card__excerpt">${excerpt}</p>
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

    allMicroActions = buildMicroActions(allContent);

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
