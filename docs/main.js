/* ===========================================================
   GREEN EYE — scroll-driven image-sequence tour
   Each scene = an image sequence extracted from the source clip;
   the scroll position scrubs the frames.
   =========================================================== */

const SCENES = [
  {
    dir: 'frames/s1', frames: 145,
    key: 'הסלון',
    num: 'סצנה 01',
    title: 'הסלון נפתח<br><em>אל הוואדי</em>',
    text: 'קיר זכוכית שנעלם לגמרי לתוך הקיר, ורצף אחד רציף בין הישיבה הפנימית לפינת האוכל שעל המרפסת.',
    tags: ['פתיחה מלאה', 'תקרה 2.90 מ׳', 'אבן טבעית']
  },
  {
    dir: 'frames/s2', frames: 145,
    key: 'המרחב הפתוח',
    num: 'סצנה 02',
    title: 'מרחב אחד,<br><em>שלושה שימושים</em>',
    text: 'מטבח אי מטראוורטין, ספרייה בעץ אלון בהיר ואזור אירוח — הכול מתחת לאותו קו אור.',
    tags: ['מטבח אי', 'אלון בהיר', 'תאורה נסתרת']
  },
  {
    dir: 'frames/s3', frames: 145,
    key: 'חדר ההורים',
    num: 'סצנה 03',
    title: 'לקום אל<br><em>ראשי העצים</em>',
    text: 'סוויטת הורים פונה מזרחה: אור ראשון נכנס דרך חזית זכוכית מלאה, עם יציאה ישירה למרפסת פרטית.',
    tags: ['חזית מזרח', 'מרפסת פרטית', 'ארונות עץ']
  },
  {
    dir: 'frames/s4', frames: 145,
    key: 'המרפסת',
    num: 'סצנה 04',
    title: 'הנוף<br><em>הוא הקיר הרביעי</em>',
    text: 'מרפסת שמש בעומק 4 מטר מעל היער — פינת אוכל, ישיבה רכה ומעקה זכוכית שלא חוסם דבר.',
    tags: ['עומק 4 מ׳', 'מעקה זכוכית', 'נוף פתוח']
  }
];

const SCRUB_RATIO = 0.84;          // how much of a scene's scroll scrubs frames
const canvas = document.getElementById('seq');
const ctx = canvas.getContext('2d', { alpha: false });
const track = document.getElementById('track');
const stage = document.getElementById('stage');
const loader = document.getElementById('loader');
const loaderFill = document.getElementById('loaderFill');
const loaderPct = document.getElementById('loaderPct');
const navEl = document.getElementById('scenenav');
const capsEl = document.getElementById('captions');
const progressFill = document.getElementById('progressFill');
const hero = document.getElementById('hero');

const pad = n => String(n).padStart(4, '0');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

/* ---------- build DOM for nav + captions ---------- */
const capNodes = SCENES.map((s, i) => {
  const el = document.createElement('article');
  el.className = 'cap';
  el.innerHTML = `
    <div class="cap__num">${s.num}</div>
    <h2>${s.title}</h2>
    <p>${s.text}</p>
    <div class="cap__tags">${s.tags.map(t => `<b>${t}</b>`).join('')}</div>`;
  capsEl.appendChild(el);

  const btn = document.createElement('button');
  btn.innerHTML = `<i></i><span>${s.key}</span>`;
  btn.addEventListener('click', () => {
    window.scrollTo({ top: sceneStart(i) + 4, behavior: 'smooth' });
  });
  navEl.appendChild(btn);
  return el;
});
const navBtns = [...navEl.children];

/* ---------- layout ---------- */
let vh = window.innerHeight, sceneLen = 0, trackTop = 0, totalLen = 0;

function layout() {
  vh = window.innerHeight;
  sceneLen = Math.round(vh * 3.4);
  totalLen = sceneLen * SCENES.length;
  track.style.height = totalLen + 'px';
  trackTop = hero.offsetHeight;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(vh * dpr);
  draw(true);
}
const sceneStart = i => trackTop + i * sceneLen;

/* ---------- image store ---------- */
const store = SCENES.map(s => ({ imgs: new Array(s.frames), loaded: new Array(s.frames).fill(false) }));

function loadScene(si, onProgress) {
  return new Promise(resolve => {
    const s = SCENES[si], bank = store[si];
    let next = 0, done = 0, inflight = 0;
    const CONC = si === 0 ? 10 : 6;
    const pump = () => {
      while (inflight < CONC && next < s.frames) {
        const i = next++;
        inflight++;
        const img = new Image();
        img.decoding = 'async';
        img.src = `${s.dir}/${pad(i + 1)}.jpg`;
        const finish = () => {
          inflight--; done++;
          bank.imgs[i] = img; bank.loaded[i] = true;
          onProgress && onProgress(done / s.frames);
          if (i === 0 || si === current.scene) draw();
          done === s.frames ? resolve() : pump();
        };
        img.onload = finish;
        img.onerror = () => { inflight--; done++; done === s.frames ? resolve() : pump(); };
      }
    };
    pump();
  });
}

/* nearest already-decoded frame, so scrubbing never blanks out */
function pickFrame(si, idx) {
  const bank = store[si];
  if (bank.loaded[idx]) return bank.imgs[idx];
  for (let d = 1; d < SCENES[si].frames; d++) {
    if (bank.loaded[idx - d]) return bank.imgs[idx - d];
    if (bank.loaded[idx + d]) return bank.imgs[idx + d];
  }
  return null;
}

/* ---------- scroll state ---------- */
const current = { scene: 0, frame: 0 };
let targetY = window.scrollY, smoothY = window.scrollY, lastDrawn = '';

function draw(force) {
  const y = smoothY;
  const local = clamp(y - trackTop, 0, totalLen - 1);
  const si = clamp(Math.floor(local / sceneLen), 0, SCENES.length - 1);
  const t = (local - si * sceneLen) / sceneLen;                 // 0..1 inside scene
  const scrub = clamp(t / SCRUB_RATIO, 0, 1);                   // frame scrub portion
  const frame = Math.round(scrub * (SCENES[si].frames - 1));
  current.scene = si; current.frame = frame;

  const sig = si + ':' + frame;
  if (sig !== lastDrawn || force) {
    lastDrawn = sig;
    const img = pickFrame(si, frame);
    if (img && img.naturalWidth) {
      const cw = canvas.width, ch = canvas.height;
      const r = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
      const w = img.naturalWidth * r, h = img.naturalHeight * r;
      ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
    }
  }

  /* captions */
  const inTrack = y > trackTop - vh * 0.5 && y < trackTop + totalLen;
  capNodes.forEach((el, i) => {
    let a = 0, shift = 26;
    if (i === si && inTrack) {
      const fadeIn = clamp((t - 0.06) / 0.14, 0, 1);
      const fadeOut = 1 - clamp((t - 0.90) / 0.10, 0, 1);
      a = ease(fadeIn) * fadeOut;
      shift = 26 * (1 - ease(fadeIn)) - 18 * (1 - fadeOut);
    }
    el.style.opacity = a.toFixed(3);
    el.style.transform = `translateY(${shift.toFixed(1)}px)`;
  });

  /* ui state */
  navBtns.forEach((b, i) => b.classList.toggle('active', i === si && inTrack));
  navEl.classList.toggle('show', y > trackTop - vh * 0.6 && y < trackTop + totalLen - vh * 0.25);
  stage.classList.toggle('live', y > vh * 0.12);
  progressFill.style.width = (clamp((y - trackTop) / totalLen, 0, 1) * 100).toFixed(2) + '%';
}

function tick() {
  targetY = window.scrollY;
  smoothY += (targetY - smoothY) * 0.16;
  if (Math.abs(targetY - smoothY) < 0.4) smoothY = targetY;
  draw();
  requestAnimationFrame(tick);
}

/* ---------- boot ---------- */
layout();
window.addEventListener('resize', layout);
window.addEventListener('orientationchange', () => setTimeout(layout, 250));

loadScene(0, p => {
  loaderFill.style.width = (p * 100) + '%';
  loaderPct.textContent = Math.round(p * 100) + '%';
}).then(() => {
  loader.classList.add('done');
  draw(true);
  requestAnimationFrame(tick);
  // remaining scenes stream in quietly in the background
  (async () => { for (let i = 1; i < SCENES.length; i++) await loadScene(i); })();
});

/* ===========================================================
   טופס השארת פרטים
   -----------------------------------------------------------
   LEAD_ENDPOINT — כתובת שאליה נשלחות הפניות (Formspree / Netlify
   Forms / Google Apps Script / כל API שמקבל JSON ב-POST).
   LEAD_EMAIL    — אם אין endpoint, הטופס ייפתח כמייל מוכן לשליחה.
   כל עוד שניהם ריקים, הטופס מאמת את השדות ומציג אישור בלבד,
   והפנייה נשמרת מקומית בדפדפן (localStorage) כדי שלא תאבד.
   =========================================================== */
const LEAD_ENDPOINT = '';
const LEAD_EMAIL = '';

const leadForm = document.getElementById('leadForm');
if (leadForm) {
  const errorBox = document.getElementById('leadError');
  const thanks = document.getElementById('leadThanks');
  const thanksName = document.getElementById('leadThanksName');
  const again = document.getElementById('leadAgain');

  const markInvalid = (el, bad) => {
    const holder = el.type === 'checkbox' ? el.parentElement : el;
    holder.classList.toggle('invalid', bad);
  };

  const validate = d => {
    const f = leadForm.elements;
    const digits = (d.phone || '').replace(/\D/g, '');
    const checks = [
      [f.name, d.name.trim().length >= 2, 'חסר שם מלא'],
      [f.phone, digits.length >= 9 && digits.length <= 12, 'מספר הטלפון לא נראה תקין'],
      [f.email, !d.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email), 'כתובת האימייל לא תקינה'],
      [f.consent, f.consent.checked, 'צריך לאשר קבלת מידע על הפרויקט']
    ];
    let msg = '';
    checks.forEach(([el, ok, why]) => { markInvalid(el, !ok); if (!ok && !msg) msg = why; });
    return msg;
  };

  const remember = payload => {
    try {
      const all = JSON.parse(localStorage.getItem('greeneye.leads') || '[]');
      all.push(payload);
      localStorage.setItem('greeneye.leads', JSON.stringify(all.slice(-50)));
    } catch (e) { /* פרטיות/מצב פרטי — לא קריטי */ }
  };

  leadForm.addEventListener('submit', async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(leadForm).entries());
    data.consent = leadForm.elements.consent.checked;

    const problem = validate(data);
    errorBox.hidden = !problem;
    errorBox.textContent = problem;
    if (problem) return;

    const payload = { ...data, page: location.href, at: new Date().toISOString() };
    remember(payload);

    const btn = leadForm.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'שולח…';

    try {
      if (LEAD_ENDPOINT) {
        const res = await fetch(LEAD_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(res.status);
      } else if (LEAD_EMAIL) {
        const body = `שם: ${data.name}\nטלפון: ${data.phone}\nאימייל: ${data.email || '—'}\nגודל דירה: ${data.rooms || '—'}\nהערה: ${data.note || '—'}`;
        location.href = `mailto:${LEAD_EMAIL}?subject=${encodeURIComponent('פנייה מאתר GREEN EYE')}&body=${encodeURIComponent(body)}`;
      } else {
        console.warn('[GREEN EYE] לא הוגדר יעד לטופס — הפנייה נשמרה מקומית בלבד. הגדירו LEAD_ENDPOINT ב-main.js.');
      }
      thanksName.textContent = `${data.name.trim().split(' ')[0]}, נחזור אליכם בהקדם עם כל החומרים.`;
      leadForm.hidden = true;
      thanks.hidden = false;
    } catch (err) {
      errorBox.hidden = false;
      errorBox.textContent = 'השליחה נכשלה. אפשר לנסות שוב או להתקשר אלינו.';
    } finally {
      btn.disabled = false; btn.textContent = 'שליחה';
    }
  });

  leadForm.addEventListener('input', e => markInvalid(e.target, false));

  again.addEventListener('click', () => {
    leadForm.reset();
    leadForm.hidden = false;
    thanks.hidden = true;
    errorBox.hidden = true;
  });
}
