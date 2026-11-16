// 공용 UI: 아이콘, 일러스트, 지도, 토스트, 대화상자
UAM.ui = (function () {
  const L = UAM.logic;

  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const ICONS = {
    swap: '<path d="M7 4v15M7 19l-3-3M7 19l3-3M17 20V5M17 5l-3 3M17 5l3 3"/>',
    pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
    users: '<circle cx="9.5" cy="8.5" r="3.5"/><path d="M3 20c.6-3.8 3.2-5.8 6.5-5.8S15.4 16.2 16 20M16 5.4a3.5 3.5 0 0 1 0 6.2M18 14.8c1.7.9 2.7 2.6 3 5.2"/>',
    bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 21h4"/>',
    ticket: '<path d="M3.5 8.5V6h17v2.5a3.5 3.5 0 0 0 0 7V18h-17v-2.5a3.5 3.5 0 0 0 0-7zM14.5 6v12" stroke-dasharray="none"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21c.8-4.3 3.8-6.5 7.5-6.5s6.7 2.2 7.5 6.5"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    route: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/>',
    shield: '<path d="M12 3l7.5 3v5.5c0 4.6-3.1 8-7.5 9.5-4.4-1.5-7.5-4.9-7.5-9.5V6z"/><path d="M8.8 12l2.3 2.3 4.2-4.4"/>',
    bolt: '<path d="M13 3L5.5 13.5H11L10 21l7.5-10.5H12z"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.2l3.3 2"/>',
    share: '<circle cx="6" cy="12" r="2.6"/><circle cx="17.5" cy="6" r="2.6"/><circle cx="17.5" cy="18" r="2.6"/><path d="M8.4 10.8l6.8-3.6M8.4 13.2l6.8 3.6"/>',
    print: '<path d="M7 8V3.5h10V8M7 17H4.5V9.5a1.5 1.5 0 0 1 1.5-1.5h12a1.5 1.5 0 0 1 1.5 1.5V17H17"/><rect x="7" y="14" width="10" height="6.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"/>',
    cloud: '<path d="M7 18.5a4.2 4.2 0 0 1-.6-8.4 5.6 5.6 0 0 1 10.8 1 3.8 3.8 0 0 1-.6 7.4z"/>',
    rain: '<path d="M7 14.5a4.2 4.2 0 0 1-.6-8.4 5.6 5.6 0 0 1 10.8 1 3.8 3.8 0 0 1-.6 7.4zM9 18l-1 3M13 18l-1 3M17 18l-1 3"/>',
    wind: '<path d="M3 9h11a2.8 2.8 0 1 0-2.7-3.6M3 13h15.5a2.5 2.5 0 1 1-2.4 3.2M3 17h8.5a2.2 2.2 0 1 1-2.1 2.9"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    card: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h3"/>',
    gift: '<rect x="4" y="10" width="16" height="10.5" rx="1.5"/><path d="M3 7.5h18V10H3zM12 7.5v13M12 7.5S10.8 3.5 8.2 3.5a2 2 0 0 0 0 4zM12 7.5s1.2-4 3.8-4a2 2 0 0 1 0 4z"/>'
  };

  const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  function starfield() {
    let dots = '';
    for (let i = 0; i < 110; i++) {
      const x = L.hash(`sx${i}`) % 1440;
      const y = L.hash(`sy${i}`) % 420;
      const r = 0.5 + (L.hash(`sr${i}`) % 12) / 10;
      const o = (0.25 + (L.hash(`so${i}`) % 70) / 100 * (1 - y / 520)).toFixed(2);
      dots += `<circle cx="${x}" cy="${y}" r="${r}" opacity="${o}"/>`;
    }
    return `<svg class="stars" viewBox="0 0 1440 500" preserveAspectRatio="xMidYMin slice" aria-hidden="true">${dots}</svg>`;
  }

  function skyline(seed, minH, maxH, lit) {
    let x = -10;
    let i = 0;
    let shapes = '';
    let windows = '';
    while (x < 1450) {
      const w = 26 + (L.hash(`${seed}w${i}`) % 46);
      const h = minH + (L.hash(`${seed}h${i}`) % (maxH - minH));
      const top = 220 - h;
      shapes += `<rect x="${x}" y="${top}" width="${w}" height="${h}"/>`;
      if (L.hash(`${seed}a${i}`) % 6 === 0) {
        shapes += `<rect x="${x + w / 2 - 1}" y="${top - 16}" width="2" height="16"/>`;
      }
      if (lit) {
        for (let wy = top + 8; wy < 214; wy += 12) {
          for (let wx = x + 5; wx < x + w - 6; wx += 9) {
            if (L.hash(`${seed}${wx}:${wy}`) % 5 === 0) windows += `<rect x="${wx}" y="${wy}" width="4" height="5"/>`;
          }
        }
      }
      x += w + (L.hash(`${seed}g${i}`) % 7);
      i++;
    }
    return `<svg class="skyline skyline-${seed}" viewBox="0 0 1440 220" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><g class="sk-b">${shapes}</g><g class="sk-w">${windows}</g></svg>`;
  }

  // 가상의 4인승 전기 수직이착륙기 측면도
  function aircraft(cls = '') {
    const rotor = (cx, cy) => `<g><rect x="${cx - 1.5}" y="${cy}" width="3" height="11" class="ac-mast"/><ellipse class="ac-rotor" cx="${cx}" cy="${cy}" rx="27" ry="2.6"/></g>`;
    return `<svg class="aircraft ${cls}" viewBox="0 0 260 110" aria-hidden="true">
      <path class="ac-wing" d="M70 28h130l12 7H58z"/>
      ${rotor(72, 13)}${rotor(135, 13)}${rotor(198, 13)}
      <path class="ac-tail" d="M28 47L12 21h15l25 26z"/>
      <path class="ac-body" d="M22 56c6-14 34-21 82-22l66 1c26 2 50 12 63 26 3 4 1 8-4 10-44 13-154 13-188 5-14-3-23-11-19-20z"/>
      <path class="ac-glass" d="M169 40c22 2 39 10 52 21l-53 1c-3-8-3-15 1-22z"/>
      <rect class="ac-glass" x="104" y="43" width="22" height="16" rx="4"/>
      <rect class="ac-glass" x="133" y="43" width="22" height="16" rx="4"/>
      <path class="ac-stripe" d="M30 68c50 8 130 8 190-3l4 3c-58 12-150 13-192 4z"/>
      <path class="ac-skid" d="M78 80l-6 16M172 80l6 16M56 96h142"/>
      <circle class="ac-light" cx="232" cy="62" r="2.4"/>
    </svg>`;
  }

  const MAP = {
    west: { x: 168, y: 196 }, // 인천공항
    east: { x: 446, y: 214 }, // 김포공항
    ctrl: { x: 305, y: 84 }
  };

  function mapPoint(t, origin) {
    const a = origin === 'GMP' ? MAP.east : MAP.west;
    const b = origin === 'GMP' ? MAP.west : MAP.east;
    const c = MAP.ctrl;
    const u = 1 - t;
    return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
  }

  function routeMap({ origin = 'GMP', progress = null, animated = false } = {}) {
    const { west, east, ctrl } = MAP;
    const d = `M${west.x} ${west.y} Q${ctrl.x} ${ctrl.y} ${east.x} ${east.y}`;
    let craft = '';
    if (progress !== null) {
      const p = mapPoint(progress, origin);
      craft = `<g id="map-craft" transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})"><circle r="17" class="m-halo"/><circle r="8" class="m-craft"/></g>`;
    }
    return `<svg class="route-map" viewBox="0 0 640 360" role="img" aria-label="인천공항과 김포공항 사이의 비행 경로 지도">
      <rect width="640" height="360" class="m-sea"/>
      <path class="m-land" d="M300 0H640V360H335C325 335 352 318 342 290 332 262 302 256 308 226 314 196 342 190 340 160 338 130 302 110 298 80 296 50 310 30 300 0z"/>
      <path class="m-land" d="M108 176c20-36 92-42 128-16 24 18 16 60-10 80-36 22-96 18-118-8-12-18-12-38 0-56z"/>
      <path class="m-river" d="M640 262c-60-10-122-72-172-92-48-20-92-62-132-90-20-13-30-26-36-40"/>
      <text x="62" y="316" class="m-label m-faint">서 해</text>
      <text x="560" y="222" class="m-label m-faint">한 강</text>
      <text x="548" y="120" class="m-label">서울</text>
      <text x="382" y="322" class="m-label">송도</text>
      <text x="168" y="238" text-anchor="middle" class="m-label m-faint">영종도</text>
      <path d="${d}" class="m-path"/>
      <path d="${d}" class="m-dash ${animated ? 'is-animated' : ''}"/>
      <circle cx="${west.x}" cy="${west.y}" r="8" class="m-node"/>
      <circle cx="${east.x}" cy="${east.y}" r="8" class="m-node"/>
      <text x="${west.x}" y="${west.y - 18}" text-anchor="middle" class="m-code">ICN</text>
      <text x="${east.x}" y="${east.y + 30}" text-anchor="middle" class="m-code">GMP</text>
      ${craft}
    </svg>`;
  }

  function moveCraft(t, origin) {
    const node = document.getElementById('map-craft');
    if (!node) return;
    const p = mapPoint(t, origin);
    node.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
  }

  function toast(message, kind = '') {
    const box = document.getElementById('toasts');
    const node = document.createElement('div');
    node.className = `toast ${kind}`;
    node.textContent = message;
    box.appendChild(node);
    setTimeout(() => node.remove(), 3400);
  }

  // 확인 대화상자. 확인하면 폼 값(FormData)을, 취소하면 null을 돌려준다.
  function dialog({ title, body = '', confirmLabel = '확인', danger = false }) {
    const el = document.getElementById('modal');
    el.innerHTML = `<form method="dialog" class="modal-form">
      <h2>${esc(title)}</h2>
      <div class="modal-body">${body}</div>
      <div class="modal-actions">
        <button class="btn btn-ghost" value="cancel">닫기</button>
        <button class="btn ${danger ? 'btn-danger-solid' : 'btn-primary'}" value="ok">${esc(confirmLabel)}</button>
      </div>
    </form>`;
    return new Promise((resolve) => {
      el.returnValue = '';
      el.addEventListener('close', () => {
        const form = el.querySelector('form');
        resolve(el.returnValue === 'ok' ? new FormData(form) : null);
      }, { once: true });
      el.showModal();
    });
  }

  function downloadText(filename, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return { esc, icon, starfield, skyline, aircraft, routeMap, moveCraft, toast, dialog, downloadText };
})();
