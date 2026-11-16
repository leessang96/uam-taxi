// 운영 콘솔 화면
UAM.consoleView = (function () {
  const C = UAM.config;
  const L = UAM.logic;
  const S = UAM.store;
  const U = UAM.ui;
  const { esc, icon } = U;
  const app = document.getElementById('app');
  const state = { date: L.bookingDates()[0], origin: 'GMP', notice: null };

  function loadChart(hourly) {
    const W = 640;
    const H = 220;
    const left = 36;
    const bottom = 26;
    const top = 10;
    const plotH = H - bottom - top;
    const slot = (W - left) / hourly.length;
    const barW = Math.min(26, slot - 8);
    const yOf = (rate) => top + plotH * (1 - rate);
    const grid = [0, 0.5, 1].map((r) => `<line x1="${left}" x2="${W}" y1="${yOf(r)}" y2="${yOf(r)}" class="ch-grid"/><text x="${left - 8}" y="${yOf(r) + 4}" text-anchor="end" class="ch-axis">${r * 100}%</text>`).join('');
    const bars = hourly.map((h, i) => {
      const x = left + slot * i + (slot - barW) / 2;
      const y = yOf(h.rate);
      const barH = top + plotH - y;
      const r = Math.min(4, barH);
      const path = barH > 0
        ? `<path class="ch-bar" d="M${x} ${y + barH}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + barW - r}Q${x + barW} ${y} ${x + barW} ${y + r}V${y + barH}Z"/>`
        : '';
      const label = h.hour % 2 === 1 ? `<text x="${x + barW / 2}" y="${H - 8}" text-anchor="middle" class="ch-axis">${h.hour}시</text>` : '';
      const tip = esc(`${h.hour}시대 · 탑승률 ${Math.round(h.rate * 100)}% (${h.sold}/${h.cap}석)`);
      return `${path}${label}<rect class="ch-hit" x="${left + slot * i}" y="${top}" width="${slot}" height="${plotH}" data-tip="${tip}"/>`;
    }).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="출발 시간대별 탑승률 막대 차트. 편별 수치는 운항 현황 표에서 확인할 수 있습니다.">${grid}${bars}</svg>`;
  }

  function fleetPanel(date) {
    return `<ul class="fleet">${UAM.fleet.map((a) => {
      const h = L.hash(`${date}${a.id}`);
      const battery = 45 + (h % 55);
      const charging = battery < 60;
      return `<li>
        <b>${a.id}</b><span class="muted small">${a.base}</span>
        <span class="meter" aria-hidden="true"><i class="${charging ? 'low' : ''}" style="width:${battery}%"></i></span>
        <span class="fleet-pct">${battery}%</span>
        <span class="tag ${charging ? 'tag-warn' : 'tag-good'}">${charging ? '충전 중' : '운항 가능'}</span>
      </li>`;
    }).join('')}</ul>`;
  }

  function statusBadge(view) {
    if (view.status === 'cancelled') return `<span class="tag tag-bad">결항 · ${esc(view.reason)}</span>`;
    if (view.status === 'delayed') return `<span class="tag tag-warn">${C.delayMin}분 지연</span>`;
    return '<span class="tag tag-good">정상</span>';
  }

  function row(view) {
    const f = view.flight;
    const kgPct = Math.min(100, Math.round((view.kgUsed / C.payloadKg) * 100));
    const cancelled = view.status === 'cancelled';
    const w = L.weather(f);
    return `<tr>
      <th scope="row">${f.code}</th>
      <td>${L.minToTime(view.departMin)}</td>
      <td class="wx">${icon(w.icon)}${w.label}</td>
      <td>${cancelled ? '-' : `${view.seatsSold}/${C.seatsPerFlight}`}</td>
      <td class="kg-cell">${cancelled ? '-' : `<span>${view.kgUsed}kg</span><span class="meter" aria-hidden="true"><i style="width:${kgPct}%"></i></span>`}</td>
      <td>${statusBadge(view)}</td>
      <td class="actions">${cancelled ? '' : `
        <button class="btn btn-small btn-ghost" data-act="toggle-delay" data-id="${f.id}" data-delayed="${view.status === 'delayed'}">${view.status === 'delayed' ? '정상화' : '지연'}</button>
        <button class="btn btn-small btn-danger" data-act="cancel-flight" data-id="${f.id}">결항</button>`}</td>
    </tr>`;
  }

  function render() {
    const { date, origin, notice } = state;
    const stats = S.dayStats(date);
    const views = L.listFlights(date, origin).map(S.flightView);
    const bookings = S.bookingsOn(date);

    app.innerHTML = `
      <div class="page-band"><div class="page-band-inner console-head">
        <div><h1>운영 콘솔</h1><p>운항사, 버티포트, 플랫폼 관리자용 화면 · 지표에는 샘플 예약이 포함됩니다.</p></div>
        <div class="console-filters">
          <label>운항일<select data-change="console-date">${L.bookingDates().map((d) => `<option value="${d}" ${d === date ? 'selected' : ''}>${L.formatDate(d)}</option>`).join('')}</select></label>
          <label>출발 버티포트<select data-change="console-origin">${['GMP', 'ICN'].map((o) => `<option value="${o}" ${o === origin ? 'selected' : ''}>${UAM.vertiports[o].short}</option>`).join('')}</select></label>
        </div>
      </div></div>
      <div class="page page-wide">
        ${notice ? `<div class="notice ${notice.ok ? 'notice-good' : 'notice-bad'}" role="status">${esc(notice.text)}</div>` : ''}
        <div class="kpis">
          <div class="kpi"><span>판매 좌석</span><b>${stats.seats}<small> / ${stats.capacity}석</small></b></div>
          <div class="kpi"><span>탑승률</span><b>${Math.round(stats.loadFactor * 100)}%</b></div>
          <div class="kpi"><span>항공 운임 거래액</span><b>${L.won(stats.gmv)}</b></div>
          <div class="kpi"><span>중개 수수료 (${Math.round(C.commissionRate * 100)}%)</span><b>${L.won(stats.commission)}</b></div>
          <div class="kpi"><span>결항</span><b>${stats.cancelled}<small>편</small></b></div>
        </div>

        <div class="console-grid">
          <div class="stack">
            <section class="card">
              <h2>출발 시간대별 탑승률</h2>
              ${loadChart(stats.hourly)}
            </section>
            <section class="card">
              <h2>운항 현황 · ${UAM.vertiports[origin].short} 출발</h2>
              <div class="table-wrap"><table>
                <thead><tr><th scope="col">편명</th><th scope="col">출발</th><th scope="col">기상</th><th scope="col">좌석</th><th scope="col">중량 (${C.payloadKg}kg)</th><th scope="col">상태</th><th scope="col"><span class="sr-only">조치</span></th></tr></thead>
                <tbody>${views.map(row).join('')}</tbody>
              </table></div>
            </section>
          </div>
          <div class="stack">
            <section class="card">
              <h2>버티포트 체크인</h2>
              <form class="inline-form" data-form="checkin" novalidate>
                <label class="sr-only" for="checkin-code">예약번호</label>
                <input id="checkin-code" name="code" placeholder="HC-XXXXXX" autocomplete="off">
                <button class="btn btn-primary" type="submit">체크인</button>
              </form>
            </section>
            <section class="card">
              <h2>기체 상태</h2>
              ${fleetPanel(date)}
            </section>
            <section class="card">
              <h2>탑승자 명단</h2>
              ${bookings.length ? `<ul class="manifest">${bookings.map((b) => {
                const f = L.getFlight(b.flightId);
                return `<li><a href="#/booking/${b.code}"><b>${b.code}</b></a>
                  <span>${f.code} ${L.minToTime(f.departMin)} · ${b.passengers.map((p) => esc(p.name)).join(', ')} · ${S.bookingKg(b)}kg</span>
                  ${UAM.views.bookingStatus(b, S.flightView(f))}</li>`;
              }).join('')}</ul>` : '<p class="muted">이 날짜의 사용자 예약이 없습니다.</p>'}
            </section>
            <button class="btn btn-ghost btn-block" data-act="reset">데모 데이터 초기화</button>
          </div>
        </div>
      </div>`;
    state.notice = null;
  }

  return { state, render };
})();
