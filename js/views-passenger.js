// 승객용 화면: 홈, 검색 결과, 예약·결제, 탑승권, 내 여정, 마이, 알림
UAM.views = (function () {
  const C = UAM.config;
  const L = UAM.logic;
  const S = UAM.store;
  const U = UAM.ui;
  const { esc, icon } = U;
  const app = document.getElementById('app');
  const port = (code) => UAM.vertiports[code];
  const filters = { period: 'all', sort: 'time', onlyOpen: false };
  const sim = { code: null, timer: 0, raf: 0 };
  const points = (n) => `${Number(n).toLocaleString('ko-KR')}P`;

  function readSearch(q) {
    const from = L.place(q.get('from'));
    const to = L.place(q.get('to'));
    const date = q.get('date');
    const pax = Number(q.get('pax'));
    const validRoute = from && to && from.side !== to.side;
    const validDate = L.bookingDates().includes(date);
    const validPax = Number.isInteger(pax) && pax >= 1 && pax <= C.seatsPerFlight;
    return validRoute && validDate && validPax ? { from, to, date, pax } : null;
  }

  const searchQuery = (s, date = s.date) => `from=${s.from.id}&to=${s.to.id}&date=${date}&pax=${s.pax}`;

  function placeOptions(side, selected) {
    return UAM.places.filter((p) => p.side === side)
      .map((p) => `<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>${esc(p.name)}</option>`)
      .join('');
  }

  function allPlaceOptions(selected) {
    return ['GMP', 'ICN'].map((side) =>
      `<optgroup label="${port(side).short} 권역">${placeOptions(side, selected)}</optgroup>`).join('');
  }

  function syncDestination(keep) {
    const from = L.place(document.getElementById('from').value);
    const toSide = L.otherSide(from.side);
    document.getElementById('to').innerHTML = placeOptions(toSide, keep || (toSide === 'ICN' ? 'icn-t1' : 'gmp-terminal'));
  }

  function swapPlaces() {
    const fromSelect = document.getElementById('from');
    const toSelect = document.getElementById('to');
    const oldFrom = fromSelect.value;
    fromSelect.value = toSelect.value;
    syncDestination(oldFrom);
  }

  function home() {
    const dates = L.bookingDates();
    const firstOpen = dates.find((d) => L.listFlights(d, 'GMP').some((f) => L.isBookable(f)));
    const features = [
      ['route', '문 앞에서 문 앞까지', '연계 택시와 UAM 좌석을 한 번에 예약하고 결제합니다.'],
      ['clock', '30분마다 출발', '07:00부터 20:30까지, 원하는 시간에 바로 탑승하세요.'],
      ['shield', '결항 자동 보상', '운항사 사유로 결항되면 전액 환불과 보상 쿠폰을 자동으로 드려요.'],
      ['bolt', '조용한 전기 비행', '전기 추진 4인승 기체로 공항 사이를 곧장 날아갑니다.']
    ];
    app.innerHTML = `
      <section class="hero">
        ${U.starfield()}
        <div class="hero-flight">${U.aircraft('hero-aircraft')}</div>
        ${U.skyline('far', 40, 130, false)}
        ${U.skyline('near', 24, 96, true)}
        <div class="hero-copy">
          <p class="eyebrow"><span class="pulse" aria-hidden="true"></span>GMP ↔ ICN 에어 셔틀</p>
          <h1>도로 위 45분을<br><em>하늘 위 ${C.flightMin}분</em>으로</h1>
          <p class="lede">김포공항과 인천공항 사이, 막히지 않는 길이 열립니다.</p>
        </div>
      </section>
      <div class="search-wrap">
        <form class="search-bar" data-form="search" novalidate>
          <label class="sb-field">${icon('pin')}<span>출발지</span><select name="from" id="from">${allPlaceOptions('gmp-terminal')}</select></label>
          <button type="button" class="swap" data-act="swap" aria-label="출발지와 도착지 바꾸기">${icon('swap')}</button>
          <label class="sb-field">${icon('pin')}<span>도착지</span><select name="to" id="to">${placeOptions('ICN', 'icn-t1')}</select></label>
          <label class="sb-field">${icon('calendar')}<span>날짜</span><select name="date">${dates.map((d) => `<option value="${d}" ${d === firstOpen ? 'selected' : ''}>${L.formatDate(d)}</option>`).join('')}</select></label>
          <label class="sb-field">${icon('users')}<span>인원</span><select name="pax">${[1, 2, 3, 4].map((n) => `<option value="${n}">${n}명</option>`).join('')}</select></label>
          <button class="btn btn-primary sb-submit" type="submit">${icon('search')}항공편 검색</button>
        </form>
      </div>

      <section class="section stats" aria-label="서비스 요약">
        <div><b>${C.flightMin}<small>분</small></b><span>공항 간 비행 시간</span></div>
        <div><b>${C.intervalMin}<small>분</small></b><span>출발 간격</span></div>
        <div><b>${C.seatsPerFlight}<small>석</small></b><span>전 좌석 창가</span></div>
        <div><b>${L.listFlights(firstOpen || dates[0], 'GMP').length * 2}<small>편</small></b><span>하루 운항</span></div>
      </section>

      <section class="section">
        <p class="kicker">WHY 하늘콜</p>
        <h2 class="section-head">공항 이동의 번거로움을 없앴습니다</h2>
        <div class="feature-grid">
          ${features.map(([ic, t, d]) => `<article class="feature"><span class="feature-ico">${icon(ic)}</span><h3>${t}</h3><p>${d}</p></article>`).join('')}
        </div>
      </section>

      <section class="section split">
        <div class="map-frame">${U.routeMap({ animated: true })}</div>
        <div>
          <p class="kicker">ROUTE</p>
          <h2 class="section-head">공항과 공항을 잇는 하늘길</h2>
          <p class="body-copy">김포공항을 떠나 영종대교 상공을 지나 인천공항 버티포트에 내립니다. 체크인부터 도착까지 모든 과정을 앱에서 실시간으로 확인할 수 있어요.</p>
          <a class="text-link" href="#/flights?from=gmp-terminal&to=icn-t1&date=${firstOpen || dates[0]}&pax=1">이 노선 항공편 보기 →</a>
        </div>
      </section>

      <section class="aircraft-band">
        <div class="section split split-rev">
          <div>
            <p class="kicker kicker-light">AIRCRAFT</p>
            <h2 class="section-head">하늘콜 A4</h2>
            <p class="body-copy light">조종사 1명과 승객 4명이 탑승하는 가상의 전기 수직이착륙기입니다.</p>
            <dl class="specs">
              <div><dt>순항 속도</dt><dd>180<small>km/h</small></dd></div>
              <div><dt>순항 고도</dt><dd>450<small>m</small></dd></div>
              <div><dt>탑재 중량</dt><dd>${C.payloadKg}<small>kg</small></dd></div>
            </dl>
          </div>
          <div class="aircraft-stage">${U.aircraft('band-aircraft')}</div>
        </div>
      </section>

      <section class="section promo">
        <span class="promo-ico">${icon('gift')}</span>
        <div><h2>첫 탑승 10% 할인</h2><p>신규 고객에게 쿠폰과 ${points(C.welcomePoints)}를 드려요. 결제 화면에서 바로 적용됩니다.</p></div>
        <a class="btn btn-dark" href="#/account">내 혜택 보기</a>
      </section>

      <section class="section faq">
        <p class="kicker">FAQ</p>
        <h2 class="section-head">자주 묻는 질문</h2>
        ${UAM.faqs.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}
      </section>`;
    syncDestination();
  }

  function seatDots(view) {
    const dots = Array.from({ length: C.seatsPerFlight }, (_, i) =>
      `<i class="${i < view.seatsSold ? 'taken' : ''}"></i>`).join('');
    return `<span class="seat-dots" aria-hidden="true">${dots}</span>`;
  }

  function blockedReason(view, s) {
    if (view.status === 'cancelled') return '결항';
    if (!L.isBookable(view.flight)) return '예약 마감';
    if (view.seatsLeft === 0) return '매진';
    if (view.seatsLeft < s.pax) return '좌석 부족';
    return '';
  }

  function flightCard(view, s) {
    const f = view.flight;
    const blocked = blockedReason(view, s);
    const w = L.weather(f);
    const tags = [
      f.peak ? '<span class="tag">혼잡 시간대</span>' : '',
      view.status === 'delayed' ? `<span class="tag tag-warn">${C.delayMin}분 지연</span>` : '',
      w.risk === '높음' ? '<span class="tag tag-warn">결항 가능성 높음</span>' : ''
    ].join('');

    return `<li class="flight ${blocked ? 'is-blocked' : ''}">
      <div class="flight-time">
        <div><b>${L.minToTime(view.departMin)}</b><span>${f.origin}</span></div>
        <div class="flight-path" aria-hidden="true"><i></i><span>${C.flightMin}분</span></div>
        <div><b>${L.minToTime(view.departMin + C.flightMin)}</b><span>${f.dest}</span></div>
      </div>
      <div class="flight-meta">
        <div class="flight-tags"><span class="flight-code">${f.code}</span>${tags}</div>
        <div class="flight-env">
          <span>${icon(w.icon)}${w.label} · 바람 ${w.wind}km/h</span>
          <span>${seatDots(view)}${view.status === 'cancelled' ? '운항 없음' : `${view.seatsLeft}석 남음`}</span>
        </div>
      </div>
      <div class="flight-buy">
        <div><b class="price">${L.won(f.price)}</b><span class="muted small">1인 편도</span></div>
        ${blocked ? `<span class="btn btn-disabled">${blocked}</span>` : `<a class="btn btn-primary" href="#/book/${f.id}?${searchQuery(s)}">선택</a>`}
      </div>
    </li>`;
  }

  function filteredViews(s) {
    let views = L.listFlights(s.date, s.from.side).map(S.flightView)
      .filter((v) => L.isBookable(v.flight) || v.status === 'cancelled');
    const hourOf = (v) => v.flight.departMin / 60;
    if (filters.period === 'am') views = views.filter((v) => hourOf(v) < 12);
    if (filters.period === 'pm') views = views.filter((v) => hourOf(v) >= 12 && hourOf(v) < 17);
    if (filters.period === 'eve') views = views.filter((v) => hourOf(v) >= 17);
    if (filters.onlyOpen) views = views.filter((v) => !blockedReason(v, s));
    if (filters.sort === 'price') views = views.slice().sort((a, b) => a.flight.price - b.flight.price || a.departMin - b.departMin);
    return views;
  }

  function refreshFlightList(s) {
    const box = document.getElementById('flight-results');
    const views = filteredViews(s);
    document.getElementById('flight-count').textContent = `${views.length}편`;
    box.innerHTML = views.length
      ? `<ul class="flight-list">${views.map((v) => flightCard(v, s)).join('')}</ul>`
      : '<div class="card empty">조건에 맞는 항공편이 없습니다. 필터나 날짜를 바꿔 보세요.</div>';
  }

  function pageBand(title, sub, back) {
    return `<div class="page-band">${U.starfield()}<div class="page-band-inner">
      ${back ? `<a class="back" href="${back[0]}">← ${back[1]}</a>` : ''}
      <h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}
    </div></div>`;
  }

  function steps(current) {
    const names = ['항공편 선택', '정보·좌석·결제', '탑승권'];
    return `<ol class="steps">${names.map((n, i) => `<li class="${i < current ? 'done' : i === current ? 'current' : ''}" ${i === current ? 'aria-current="step"' : ''}><i>${i < current ? icon('check') : i + 1}</i><span>${n}</span></li>`).join('')}</ol>`;
  }

  function flights(query) {
    const s = readSearch(query);
    if (!s) return invalid('검색 조건이 올바르지 않습니다.');
    const compare = L.estimate(s.from, s.to);
    const maxMin = Math.max(...compare.map((o) => o.minutes));
    const iconFor = { uam: 'bolt', car: 'route', rail: 'ticket' };
    const periods = [['all', '전체'], ['am', '오전'], ['pm', '오후'], ['eve', '저녁']];

    app.innerHTML = `
      ${pageBand(`${esc(s.from.name)} → ${esc(s.to.name)}`, `${L.formatDate(s.date)} · ${s.pax}명 · ${port(s.from.side).short} 출발`, ['#/', '검색 다시 하기'])}
      <div class="page">
        ${steps(0)}
        <section aria-labelledby="cmp">
          <h2 id="cmp" class="section-title">이동 수단 비교</h2>
          <div class="compare">
            ${compare.map((o) => `<div class="compare-item ${o.key === 'uam' ? 'is-uam' : ''}">
              <div class="compare-top"><span class="compare-label">${icon(iconFor[o.key])}${o.label}</span>${o.fastest ? '<span class="tag tag-good">가장 빠름</span>' : ''}</div>
              <b class="compare-min">${L.duration(o.minutes)}</b>
              <span class="compare-bar" aria-hidden="true"><i style="width:${Math.round((o.minutes / maxMin) * 100)}%"></i></span>
              <span class="compare-price">${L.won(o.price)}</span>
              <span class="muted small">${o.note}</span>
            </div>`).join('')}
          </div>
          <p class="muted small note">혼잡하지 않은 시간대를 가정한 추정치입니다. UAM 시간에는 수속 ${C.checkinMin}분이 포함됩니다.</p>
        </section>

        <section aria-labelledby="fl">
          <h2 id="fl" class="section-title">항공편 선택 <span class="count" id="flight-count"></span></h2>
          <div class="date-chips">
            ${L.bookingDates().map((d) => { const dt = L.parseDate(d); const label = L.formatDate(d).match(/\((.)\)/)[1];
              return `<a class="chip ${d === s.date ? 'is-active' : ''}" ${d === s.date ? 'aria-current="date"' : ''} href="#/flights?${searchQuery(s, d)}"><small>${label}</small><b>${dt.getMonth() + 1}/${dt.getDate()}</b></a>`; }).join('')}
          </div>
          <div class="filters">
            <div class="segmented" role="group" aria-label="시간대">
              ${periods.map(([k, t]) => `<button type="button" data-act="filter-period" data-value="${k}" aria-pressed="${filters.period === k}">${t}</button>`).join('')}
            </div>
            <label class="inline-select">정렬<select data-change="filter-sort"><option value="time" ${filters.sort === 'time' ? 'selected' : ''}>출발 시간순</option><option value="price" ${filters.sort === 'price' ? 'selected' : ''}>낮은 가격순</option></select></label>
            <label class="check check-inline"><input type="checkbox" data-change="filter-open" ${filters.onlyOpen ? 'checked' : ''}><span>예약 가능한 편만</span></label>
          </div>
          <div id="flight-results"></div>
        </section>
      </div>`;
    refreshFlightList(s);
  }

  function paxFields(i, prof) {
    const first = i === 0;
    return `<fieldset class="pax">
      <legend>탑승객 ${i + 1}</legend>
      <div class="pax-grid">
        <label>이름<input name="name${i}" maxlength="20" autocomplete="${first ? 'name' : 'off'}" value="${first ? esc(prof.name) : ''}"></label>
        <label>체중 (kg)<input name="weight${i}" type="number" inputmode="numeric" min="20" max="160" value="${first ? esc(prof.weight) : ''}"></label>
        <label>수하물<select name="bag${i}">${UAM.bags.map((b) => `<option value="${b.kg}">${b.label}</option>`).join('')}</select></label>
      </div>
    </fieldset>`;
  }

  function cabin(view, pax) {
    const free = UAM.seats.filter((s) => !view.takenSeats.includes(s));
    const picked = free.slice(0, pax);
    return `<div class="cabin" role="group" aria-label="좌석 선택">
      <div class="cabin-nose"><span>조종석</span></div>
      <div class="cabin-seats">
        ${UAM.seats.map((s) => { const taken = view.takenSeats.includes(s);
          return `<label class="seat ${taken ? 'is-taken' : ''}"><input type="checkbox" name="seat" value="${s}" ${taken ? 'disabled' : ''} ${picked.includes(s) ? 'checked' : ''}><span>${s}${taken ? '<small>예약됨</small>' : ''}</span></label>`; }).join('')}
      </div>
      <div class="cabin-tail"></div>
    </div>`;
  }

  function book(id, query) {
    const s = readSearch(query);
    const flight = L.getFlight(id);
    if (!s || !flight || flight.origin !== s.from.side || flight.date !== s.date) return invalid('예약 정보를 찾을 수 없습니다.');

    const view = S.flightView(flight);
    const seatTotal = flight.price * s.pax;
    const ground = L.groundFare(s.from) + L.groundFare(s.to);
    const wallet = S.wallet();
    const usable = wallet.coupons.filter((c) => !c.used);

    app.innerHTML = `
      ${pageBand('탑승 정보 입력', `${L.formatDate(flight.date)} ${L.minToTime(view.departMin)} · ${flight.code}`, [`#/flights?${searchQuery(s)}`, '항공편 다시 선택'])}
      <div class="page">
        ${steps(1)}
        <form class="two-col" data-form="book" data-flight="${flight.id}" data-from="${s.from.id}" data-to="${s.to.id}" data-pax="${s.pax}" data-seat-total="${seatTotal}" data-ground="${ground}" novalidate>
          <div class="stack">
            <section class="card">
              <h2>탑승객 정보</h2>
              ${Array.from({ length: s.pax }, (_, i) => paxFields(i, S.profile())).join('')}
              <p class="muted small">기체 안전을 위해 총 중량을 확인합니다. 이 편의 남은 탑재 중량은 ${view.kgLeft}kg입니다.</p>
              <label class="check"><input type="checkbox" name="agree"><span>체중 정보를 운항 안전 계산에 사용하는 데 동의합니다.</span></label>
            </section>

            <section class="card">
              <h2>좌석 선택 <span class="muted small" id="seat-count"></span></h2>
              <div class="seat-layout">
                ${cabin(view, s.pax)}
                <ul class="seat-legend">
                  <li><i class="lg lg-free"></i>선택 가능</li>
                  <li><i class="lg lg-picked"></i>내 좌석</li>
                  <li><i class="lg lg-taken"></i>예약됨</li>
                  <li class="muted small">모든 좌석이 창가입니다.</li>
                </ul>
              </div>
            </section>

            <section class="card">
              <h2>결제 수단</h2>
              <div class="pay-methods">
                ${UAM.paymentMethods.map((m, i) => `<label class="pay"><input type="radio" name="method" value="${m.id}" ${i === 0 ? 'checked' : ''}><span>${icon('card')}${m.label}</span></label>`).join('')}
              </div>
              <p class="muted small">데모이므로 카드 번호를 입력하지 않으며 실제로 청구되지 않습니다.</p>
            </section>
          </div>

          <aside class="card summary sticky">
            <h2>결제 금액</h2>
            <dl>
              <dt>구간</dt><dd>${flight.origin} → ${flight.dest}</dd>
              <dt>출발지</dt><dd>${esc(s.from.name)}</dd>
              <dt>도착지</dt><dd>${esc(s.to.name)}</dd>
              <dt>항공 운임</dt><dd>${L.won(flight.price)} × ${s.pax}</dd>
              <dt>연계 택시</dt><dd>${ground ? L.won(ground) : '필요 없음'}</dd>
            </dl>
            <div class="benefits">
              <label>쿠폰
                <select name="coupon" id="coupon-select"><option value="">사용 안 함</option>${usable.map((c) => `<option value="${esc(c.id)}">${esc(c.title)}</option>`).join('')}</select>
              </label>
              <div class="inline-form">
                <label class="sr-only" for="promo-input">쿠폰 코드</label>
                <input id="promo-input" placeholder="쿠폰 코드 입력" autocomplete="off">
                <button type="button" class="btn btn-ghost" data-act="promo-checkout">등록</button>
              </div>
              <label>포인트 <span class="muted small">보유 ${points(wallet.points)}</span>
                <div class="inline-form"><input name="points" type="number" min="0" max="${wallet.points}" step="100" inputmode="numeric" value="0"><button type="button" class="btn btn-ghost" data-act="points-all">전액</button></div>
              </label>
            </div>
            <dl class="discounts">
              <dt>쿠폰 할인</dt><dd id="sum-discount">0원</dd>
              <dt>포인트 사용</dt><dd id="sum-points">0원</dd>
            </dl>
            <p class="total"><span>총 결제 금액</span><b id="sum-total">${L.won(seatTotal + ground)}</b></p>
            <p class="form-error" id="book-error" role="alert" hidden></p>
            <button class="btn btn-primary btn-block btn-lg" type="submit" id="pay-button">결제하기</button>
            <p class="muted small refund-note">출발 24시간 전까지 무료 취소, 2시간 전까지 50% 환불, 이후 환불 불가. 운항사 사유 결항은 전액 환불됩니다.</p>
          </aside>
        </form>
      </div>`;
    updateCheckout(app.querySelector('[data-form=book]'));
  }

  function checkoutPrice(form) {
    const wallet = S.wallet();
    const coupon = wallet.coupons.find((c) => c.id === form.coupon.value && !c.used) || null;
    const requested = Math.min(Number(form.points.value) || 0, wallet.points);
    return L.priceBreakdown({
      seatTotal: Number(form.dataset.seatTotal), ground: Number(form.dataset.ground), coupon, points: requested
    });
  }

  function updateCheckout(form) {
    const price = checkoutPrice(form);
    document.getElementById('sum-discount').textContent = price.discount ? `-${L.won(price.discount)}` : '0원';
    document.getElementById('sum-points').textContent = price.pointsUsed ? `-${L.won(price.pointsUsed)}` : '0원';
    document.getElementById('sum-total').textContent = L.won(price.paid);
    document.getElementById('pay-button').textContent = `${L.won(price.paid)} 결제하기`;
    const picked = form.querySelectorAll('[name=seat]:checked').length;
    document.getElementById('seat-count').textContent = `${picked}/${form.dataset.pax}석 선택됨`;
  }

  // 인원보다 많이 고르면 가장 먼저 고른 좌석을 해제한다.
  function changeSeat(form, input) {
    const pax = Number(form.dataset.pax);
    if (input.checked) {
      const others = [...form.querySelectorAll('[name=seat]:checked')].filter((n) => n !== input);
      if (others.length >= pax) others[0].checked = false;
    }
    updateCheckout(form);
  }

  function promoCheckout() {
    const input = document.getElementById('promo-input');
    const result = S.redeemPromo(input.value);
    if (!result.ok) return U.toast(result.error, 'toast-bad');
    const select = document.getElementById('coupon-select');
    select.insertAdjacentHTML('beforeend', `<option value="${esc(result.coupon.id)}">${esc(result.coupon.title)}</option>`);
    select.value = result.coupon.id;
    input.value = '';
    updateCheckout(input.form);
    U.toast('쿠폰을 적용했습니다.');
  }

  function pointsAll() {
    const form = app.querySelector('[data-form=book]');
    form.points.value = '0';
    const before = checkoutPrice(form);
    form.points.value = String(Math.min(S.wallet().points, before.paid));
    updateCheckout(form);
  }

  function submitBook(form) {
    const showError = (message) => {
      const node = document.getElementById('book-error');
      node.textContent = message;
      node.hidden = false;
    };
    const count = Number(form.dataset.pax);
    const fd = new FormData(form);
    const passengers = [];
    for (let i = 0; i < count; i++) {
      const name = String(fd.get(`name${i}`) || '').trim();
      const weight = Number(fd.get(`weight${i}`));
      if (!name) return showError(`탑승객 ${i + 1}의 이름을 입력해 주세요.`);
      if (!Number.isFinite(weight) || weight < 20 || weight > 160) {
        return showError(`탑승객 ${i + 1}의 체중을 20~160kg 사이로 입력해 주세요.`);
      }
      passengers.push({ name, weight, bag: Number(fd.get(`bag${i}`)) });
    }
    if (!fd.get('agree')) return showError('체중 정보 사용에 동의해 주세요.');
    const seats = fd.getAll('seat');
    if (seats.length !== count) return showError(`좌석을 ${count}개 선택해 주세요.`);

    const input = {
      flightId: form.dataset.flight,
      fromId: form.dataset.from,
      toId: form.dataset.to,
      passengers,
      seats,
      couponId: String(fd.get('coupon') || ''),
      points: Math.max(0, Math.floor(Number(fd.get('points')) || 0)),
      method: String(fd.get('method'))
    };

    const paying = document.getElementById('paying');
    const button = document.getElementById('pay-button');
    button.disabled = true;
    paying.hidden = false;
    setTimeout(() => {
      paying.hidden = true;
      button.disabled = false;
      const result = S.createBooking(input);
      if (!result.ok) return showError(result.error);
      U.toast('결제가 완료되었습니다.');
      location.hash = `#/booking/${result.booking.code}`;
    }, C.paymentDelayMs);
  }

  function stageLabels(from) {
    return ['예약 확정', from.walk ? '버티포트로 이동' : '연계 택시 탑승', '버티포트 도착', '체크인 완료', '기체 탑승', '비행 중', '도착'];
  }

  // 스캔되지 않는 장식용 패턴. 실제 서비스에서는 QR 라이브러리로 교체한다.
  function demoQr(code) {
    const size = 21;
    const inFinder = (x, y) => (x < 7 && y < 7) || (x >= 14 && y < 7) || (x < 7 && y >= 14);
    const finderOn = (x, y) => {
      const fx = x >= 14 ? x - 14 : x;
      const fy = y >= 14 ? y - 14 : y;
      return fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4);
    };
    let rects = '';
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const on = inFinder(x, y) ? finderOn(x, y) : L.hash(`${code}:${x}:${y}`) % 2 === 0;
        if (on) rects += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
      }
    }
    return `<svg class="qr" viewBox="0 0 ${size} ${size}" aria-hidden="true">${rects}</svg>`;
  }

  function bookingStatus(b, view) {
    if (b.status === 'cancelled_flight') return '<span class="tag tag-bad">결항</span>';
    if (b.status === 'cancelled_user') return '<span class="tag">취소됨</span>';
    if (b.stage >= S.STAGE_LAST) return '<span class="tag tag-good">이용 완료</span>';
    if (view.status === 'delayed') return `<span class="tag tag-warn">${C.delayMin}분 지연</span>`;
    return `<span class="tag tag-good">${stageLabels(L.place(b.fromId))[b.stage]}</span>`;
  }

  function telemetry(t) {
    const lift = Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
    return {
      alt: Math.round(450 * Math.min(1, lift * 2)),
      speed: Math.round(180 * Math.min(1, lift * 1.6)),
      left: Math.ceil(C.flightMin * (1 - t)),
      battery: Math.round(96 - 18 * t)
    };
  }

  function telemetryCells(t) {
    const v = telemetry(t);
    return `<div><span>고도</span><b id="tm-alt">${v.alt}m</b></div>
      <div><span>속도</span><b id="tm-speed">${v.speed}km/h</b></div>
      <div><span>남은 시간</span><b id="tm-left">${v.left}분</b></div>
      <div><span>배터리</span><b id="tm-battery">${v.battery}%</b></div>`;
  }

  function booking(code) {
    const b = S.findBooking(code);
    if (!b) return invalid('예약을 찾을 수 없습니다. 다른 브라우저에서 만든 예약은 여기에 표시되지 않습니다.');

    const flight = L.getFlight(b.flightId);
    const view = S.flightView(flight);
    const from = L.place(b.fromId);
    const to = L.place(b.toId);
    const dep = view.departMin;
    const arr = dep + C.flightMin;
    const active = b.status === 'confirmed';
    const labels = stageLabels(from);
    const flying = b.stage === S.STAGE_FLYING;
    const progress = b.stage < S.STAGE_FLYING ? 0 : flying ? 0.55 : 1;
    const refundPercent = Math.round(L.refundRate(flight) * 100);
    const running = sim.code === b.code;
    const method = (UAM.paymentMethods.find((m) => m.id === b.method) || {}).label || '';

    const itinerary = [
      [dep - C.checkinMin - from.carMin, from.walk ? `${from.name}에서 버티포트로 이동` : `${from.name}에서 연계 택시 탑승`, 'route'],
      [dep - C.checkinMin, `${port(flight.origin).name} 수속`, 'shield'],
      [dep, `${flight.code}편 출발`, 'bolt'],
      [arr, `${port(flight.dest).name} 도착`, 'pin'],
      [arr + C.egressMin + to.carMin, `${to.name} 도착 예정`, 'check']
    ];

    let notice = '';
    if (b.status === 'cancelled_flight') {
      notice = `<div class="notice notice-bad" role="status">
        <b>${esc(b.reason)}(으)로 항공편이 결항되었습니다.</b>
        <p>${L.won(b.refund)}이 자동 환불되었고, ${L.won(b.couponGranted)} 보상 쿠폰이 지급되었습니다.</p>
        <a class="btn btn-ghost" href="#/flights?from=${from.id}&to=${to.id}&date=${flight.date}&pax=${b.passengers.length}">다른 항공편 찾기</a>
      </div>`;
    } else if (b.status === 'cancelled_user') {
      notice = `<div class="notice" role="status"><b>예약이 취소되었습니다.</b><p>환불 금액은 ${L.won(b.refund)}이며, 사용한 쿠폰과 포인트는 복구되었습니다.</p></div>`;
    } else if (view.status === 'delayed') {
      notice = `<div class="notice notice-warn" role="status"><b>항공편이 ${C.delayMin}분 지연되었습니다.</b><p>아래 일정은 지연을 반영한 시각입니다.</p></div>`;
    } else if (b.stage >= S.STAGE_LAST) {
      notice = `<div class="notice notice-good" role="status"><b>이용해 주셔서 감사합니다.</b><p>${points(b.earned)}가 적립되었습니다.</p></div>`;
    }

    app.innerHTML = `
      ${pageBand(active ? '탑승권' : '예약 내역', `예약번호 ${b.code}`, ['#/trips', '내 여정'])}
      <div class="page">
        ${active && b.stage === 0 ? steps(2) : ''}
        ${notice}
        <div class="two-col">
          <div class="stack">
            <article class="pass ${active ? '' : 'is-void'}" aria-label="탑승권">
              <div class="pass-main">
                ${U.starfield()}
                <div class="pass-top"><span class="brand-small">하늘콜</span>${bookingStatus(b, view)}</div>
                <div class="pass-route">
                  <div><b>${flight.origin}</b><span>${port(flight.origin).short} ${L.minToTime(dep)}</span></div>
                  <span class="pass-arrow" aria-hidden="true">${U.aircraft('pass-aircraft')}</span>
                  <div class="right"><b>${flight.dest}</b><span>${port(flight.dest).short} ${L.minToTime(arr)}</span></div>
                </div>
                <dl class="pass-info">
                  <div><dt>날짜</dt><dd>${L.formatDate(flight.date)}</dd></div>
                  <div><dt>편명</dt><dd>${flight.code}</dd></div>
                  <div><dt>수속 시작</dt><dd>${L.minToTime(dep - C.checkinMin)}</dd></div>
                  <div><dt>좌석</dt><dd>${b.seats.join(', ')}</dd></div>
                  <div class="wide"><dt>탑승객</dt><dd>${b.passengers.map((p) => esc(p.name)).join(', ')}</dd></div>
                </dl>
              </div>
              <div class="pass-stub">
                ${demoQr(b.code)}
                <b class="pass-code">${b.code}</b>
                <span class="muted small">데모용 패턴이라 스캔되지 않습니다</span>
              </div>
            </article>

            ${active ? `<div class="pass-actions no-print">
              <button class="btn btn-ghost" data-act="ics" data-code="${b.code}">${icon('calendar')}캘린더 저장</button>
              <button class="btn btn-ghost" data-act="share" data-code="${b.code}">${icon('share')}일정 공유</button>
              <button class="btn btn-ghost" data-act="print">${icon('print')}인쇄·영수증</button>
              <a class="btn btn-ghost" href="#/flights?from=${to.id}&to=${from.id}&date=${flight.date}&pax=${b.passengers.length}">${icon('swap')}돌아오는 편</a>
            </div>
            <section class="card live no-print">
              <div class="live-head"><h2>실시간 현황</h2>${flying || running ? '<span class="tag tag-live"><i></i>LIVE</span>' : ''}</div>
              <div class="map-frame">${U.routeMap({ origin: flight.origin, progress })}</div>
              <div class="telemetry">${telemetryCells(progress)}</div>
              <ol class="stages">
                ${labels.map((l, i) => `<li class="${i < b.stage ? 'done' : i === b.stage ? 'current' : ''}" ${i === b.stage ? 'aria-current="step"' : ''}><i></i><span>${l}</span></li>`).join('')}
              </ol>
              ${b.stage < S.STAGE_LAST ? `<div class="live-actions">
                <button class="btn btn-primary" data-act="sim-run" data-code="${b.code}" ${running ? 'disabled' : ''}>${running ? '시뮬레이션 진행 중' : '여정 자동 재생'}</button>
                <button class="btn btn-ghost" data-act="advance" data-code="${b.code}" ${running ? 'disabled' : ''}>다음 단계: ${labels[b.stage + 1]}</button>
              </div>` : ''}
            </section>` : ''}
          </div>
          <aside class="card summary sticky">
            <h2>이동 일정</h2>
            <ul class="itinerary">
              ${itinerary.map(([m, t, ic]) => `<li><time>${L.minToTime(m)}</time><i>${icon(ic)}</i><span>${esc(t)}</span></li>`).join('')}
            </ul>
            <h2>결제 내역</h2>
            <dl>
              <dt>항공 운임</dt><dd>${L.won(b.seatTotal)}</dd>
              <dt>연계 택시</dt><dd>${b.ground ? L.won(b.ground) : '필요 없음'}</dd>
              ${b.discount ? `<dt>${esc(b.couponTitle)}</dt><dd>-${L.won(b.discount)}</dd>` : ''}
              ${b.pointsUsed ? `<dt>포인트</dt><dd>-${L.won(b.pointsUsed)}</dd>` : ''}
              <dt>결제 수단</dt><dd>${esc(method)}</dd>
            </dl>
            <p class="total"><span>결제 금액</span><b>${L.won(b.total)}</b></p>
            ${active && b.stage < S.STAGE_CHECKED_IN ? `<button class="btn btn-ghost btn-block no-print" data-act="cancel-booking" data-code="${b.code}" data-percent="${refundPercent}">예약 취소 (현재 ${refundPercent}% 환불)</button>` : ''}
          </aside>
        </div>
      </div>`;
  }

  function stopSim() {
    clearTimeout(sim.timer);
    cancelAnimationFrame(sim.raf);
    sim.code = null;
  }

  function animateFlight(b, done) {
    const flight = L.getFlight(b.flightId);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reduced ? 1200 : C.simFlightMs;
    const start = performance.now();
    const set = (id, text) => { const n = document.getElementById(id); if (n) n.textContent = text; };
    const frame = (now) => {
      const t = Math.min(1, (now - start) / duration);
      U.moveCraft(t, flight.origin);
      const v = telemetry(t);
      set('tm-alt', `${v.alt}m`);
      set('tm-speed', `${v.speed}km/h`);
      set('tm-left', `${v.left}분`);
      set('tm-battery', `${v.battery}%`);
      if (t < 1) sim.raf = requestAnimationFrame(frame);
      else done();
    };
    sim.raf = requestAnimationFrame(frame);
  }

  function runSim(code, rerender) {
    stopSim();
    sim.code = code;
    const step = () => {
      const b = S.findBooking(sim.code);
      if (!b || b.status !== 'confirmed' || b.stage >= S.STAGE_LAST) {
        sim.code = null;
        rerender();
        return;
      }
      if (b.stage === S.STAGE_FLYING) {
        animateFlight(b, () => {
          S.advanceStage(b.code);
          sim.code = null;
          rerender();
          U.toast('목적지에 도착했습니다. 포인트가 적립되었어요.');
        });
        return;
      }
      S.advanceStage(b.code);
      rerender();
      sim.timer = setTimeout(step, C.simStepMs);
    };
    step();
  }

  function downloadIcs(code) {
    const b = S.findBooking(code);
    const flight = L.getFlight(b.flightId);
    const ics = L.buildIcs({
      code: b.code, flight, departMin: S.flightView(flight).departMin, from: L.place(b.fromId), to: L.place(b.toId)
    });
    U.downloadText(`hanulcall-${b.code}.ics`, ics, 'text/calendar;charset=utf-8');
    U.toast('캘린더 파일을 저장했습니다.');
  }

  async function shareTrip(code) {
    const b = S.findBooking(code);
    const flight = L.getFlight(b.flightId);
    const text = `하늘콜 ${flight.code}편 ${flight.origin}→${flight.dest}, ${L.formatDate(flight.date)} ${L.minToTime(S.flightView(flight).departMin)} 출발`;
    try {
      if (navigator.share) {
        await navigator.share({ title: '하늘콜 여정', text });
      } else {
        await navigator.clipboard.writeText(text);
        U.toast('일정을 클립보드에 복사했습니다.');
      }
    } catch (e) {
      if (e.name !== 'AbortError') U.toast('공유하지 못했습니다.', 'toast-bad');
    }
  }

  function tripCard(b) {
    const f = L.getFlight(b.flightId);
    const view = S.flightView(f);
    return `<li><a class="trip" href="#/booking/${b.code}">
      <div class="trip-codes"><b>${f.origin}</b><span aria-hidden="true">→</span><b>${f.dest}</b></div>
      <div class="trip-info"><span>${L.formatDate(f.date)} ${L.minToTime(view.departMin)}</span>
      <span class="muted small">${f.code} · 좌석 ${b.seats.join(', ')} · ${L.won(b.total)}</span></div>
      ${bookingStatus(b, view)}
    </a></li>`;
  }

  function trips() {
    const list = S.listBookings();
    const upcoming = list.filter((b) => b.status === 'confirmed' && b.stage < S.STAGE_LAST);
    const past = list.filter((b) => !upcoming.includes(b));
    const section = (title, items) => items.length ? `<h2 class="section-title">${title}</h2><ul class="trip-list">${items.map(tripCard).join('')}</ul>` : '';
    app.innerHTML = `
      ${pageBand('내 여정', '예약한 항공편과 지난 이용 내역을 확인하세요.')}
      <div class="page">
        ${list.length ? section('예정된 여정', upcoming) + section('완료·취소', past)
          : `<div class="card empty">${U.aircraft('empty-aircraft')}<p>아직 예약이 없습니다.</p><a class="btn btn-primary" href="#/">항공편 검색하기</a></div>`}
      </div>`;
  }

  function account() {
    const wallet = S.wallet();
    const prof = S.profile();
    const available = wallet.coupons.filter((c) => !c.used);
    const done = S.listBookings().filter((b) => b.stage >= S.STAGE_LAST && b.status === 'confirmed').length;
    const desc = (c) => (c.type === 'percent' ? `항공 운임 ${c.value}% 할인` : `${L.won(c.value)} 할인`);
    app.innerHTML = `
      ${pageBand('마이', '혜택과 탑승자 정보를 관리하세요.')}
      <div class="page">
        <div class="wallet">
          <div class="wallet-card"><span>보유 포인트</span><b>${points(wallet.points)}</b></div>
          <div class="wallet-card"><span>사용 가능 쿠폰</span><b>${available.length}<small>장</small></b></div>
          <div class="wallet-card"><span>완료한 여정</span><b>${done}<small>회</small></b></div>
        </div>
        <div class="two-col even">
          <section class="card">
            <h2>내 쿠폰</h2>
            <form class="inline-form" data-form="promo" novalidate>
              <label class="sr-only" for="account-promo">쿠폰 코드</label>
              <input id="account-promo" name="code" placeholder="쿠폰 코드 (예: SKY5000)" autocomplete="off">
              <button class="btn btn-ghost" type="submit">등록</button>
            </form>
            ${wallet.coupons.length ? `<ul class="coupons">${wallet.coupons.map((c) => `<li class="coupon ${c.used ? 'is-used' : ''}">
              <span class="coupon-ico">${icon('gift')}</span>
              <div><b>${esc(c.title)}</b><span class="muted small">${desc(c)}</span></div>
              ${c.used ? '<span class="tag">사용됨</span>' : '<span class="tag tag-good">사용 가능</span>'}
            </li>`).join('')}</ul>` : ''}
          </section>
          <section class="card">
            <h2>기본 탑승자 정보</h2>
            <form class="stack-sm" data-form="profile" novalidate>
              <label>이름<input name="name" maxlength="20" autocomplete="name" value="${esc(prof.name)}"></label>
              <label>체중 (kg)<input name="weight" type="number" inputmode="numeric" min="20" max="160" value="${esc(prof.weight)}"></label>
              <p class="muted small">예약할 때 첫 번째 탑승객에 자동으로 입력됩니다. 이 브라우저에만 저장됩니다.</p>
              <button class="btn btn-primary" type="submit">저장</button>
            </form>
          </section>
        </div>
      </div>`;
  }

  function saveProfile(form) {
    const name = String(form.name.value || '').trim();
    const raw = String(form.weight.value || '').trim();
    const weight = Number(raw);
    if (raw && (weight < 20 || weight > 160)) return U.toast('체중은 20~160kg 사이로 입력해 주세요.', 'toast-bad');
    S.saveProfile({ name, weight: raw });
    U.toast('저장했습니다.');
  }

  function timeAgo(at) {
    const min = Math.floor((Date.now() - at) / 60000);
    if (min < 1) return '방금 전';
    if (min < 60) return `${min}분 전`;
    if (min < 1440) return `${Math.floor(min / 60)}시간 전`;
    return `${Math.floor(min / 1440)}일 전`;
  }

  function alerts() {
    const list = S.notifications();
    S.markAllRead();
    app.innerHTML = `
      ${pageBand('알림', '예약과 운항 소식을 모아 보여드립니다.')}
      <div class="page">
        ${list.length ? `<ul class="alerts">${list.map((n) => `<li class="${n.read ? '' : 'is-new'}">
          <a href="${n.code ? `#/booking/${n.code}` : '#/alerts'}"><b>${esc(n.title)}</b><span>${esc(n.body)}</span><time class="muted small">${timeAgo(n.at)}</time></a>
        </li>`).join('')}</ul>` : '<div class="card empty"><p>새로운 알림이 없습니다.</p></div>'}
      </div>`;
  }

  function invalid(message) {
    app.innerHTML = `<div class="page"><div class="card empty"><p>${esc(message)}</p><a class="btn btn-primary" href="#/">처음으로</a></div></div>`;
  }

  return {
    filters, readSearch, refreshFlightList, syncDestination, swapPlaces,
    home, flights, book, booking, trips, account, alerts, invalid,
    updateCheckout, changeSeat, promoCheckout, pointsAll, submitBook, saveProfile,
    stopSim, runSim, downloadIcs, shareTrip, bookingStatus
  };
})();
