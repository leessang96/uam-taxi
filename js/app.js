// 라우팅과 이벤트 연결
(function () {
  const S = UAM.store;
  const U = UAM.ui;
  const V = UAM.views;
  const CV = UAM.consoleView;
  const app = document.getElementById('app');

  function parseHash() {
    const [path, qs] = location.hash.replace(/^#\/?/, '').split('?');
    return { parts: path.split('/').filter(Boolean), query: new URLSearchParams(qs || '') };
  }

  function currentSearch() {
    return V.readSearch(parseHash().query);
  }

  function notifyConsole(result, okText) {
    CV.state.notice = result.ok ? { ok: true, text: okText } : { ok: false, text: result.error };
    render();
  }

  const actions = {
    swap: V.swapPlaces,
    'promo-checkout': V.promoCheckout,
    'points-all': V.pointsAll,
    print: () => window.print(),
    ics: (el) => V.downloadIcs(el.dataset.code),
    share: (el) => V.shareTrip(el.dataset.code),
    advance(el) {
      S.advanceStage(el.dataset.code);
      render();
    },
    'sim-run'(el) {
      V.runSim(el.dataset.code, render);
    },
    'filter-period'(el) {
      V.filters.period = el.dataset.value;
      app.querySelectorAll('[data-act=filter-period]').forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
      V.refreshFlightList(currentSearch());
    },
    async 'cancel-booking'(el) {
      const ok = await U.dialog({
        title: '예약을 취소할까요?',
        body: `<p>결제 금액의 ${Number(el.dataset.percent)}%가 환불되고, 사용한 쿠폰과 포인트는 복구됩니다.</p>`,
        confirmLabel: '예약 취소',
        danger: true
      });
      if (!ok) return;
      S.cancelByUser(el.dataset.code);
      render();
    },
    'toggle-delay'(el) {
      const delayed = el.dataset.delayed !== 'true';
      notifyConsole(S.setDelayed(el.dataset.id, delayed), delayed ? '지연 처리했습니다.' : '정상 운항으로 되돌렸습니다.');
    },
    async 'cancel-flight'(el) {
      const data = await U.dialog({
        title: '이 항공편을 결항 처리할까요?',
        body: `<p>예약 승객에게 전액 환불과 보상 쿠폰이 자동 지급됩니다.</p>
          <label>결항 사유<select name="reason">${UAM.cancelReasons.map((r) => `<option>${U.esc(r)}</option>`).join('')}</select></label>`,
        confirmLabel: '결항 처리',
        danger: true
      });
      if (!data) return;
      const result = S.cancelFlight(el.dataset.id, data.get('reason'));
      notifyConsole(result, `결항 처리했습니다. 사용자 예약 ${result.affected || 0}건을 전액 환불했습니다.`);
    },
    async reset() {
      const ok = await U.dialog({ title: '데모 데이터를 초기화할까요?', body: '<p>이 브라우저의 예약, 쿠폰, 포인트, 운항 상태가 모두 지워집니다.</p>', confirmLabel: '초기화', danger: true });
      if (!ok) return;
      S.reset();
      notifyConsole({ ok: true }, '데모 데이터를 초기화했습니다.');
    }
  };

  const forms = {
    search(form) {
      const fd = new FormData(form);
      location.hash = `#/flights?from=${fd.get('from')}&to=${fd.get('to')}&date=${fd.get('date')}&pax=${fd.get('pax')}`;
    },
    book: V.submitBook,
    checkin(form) {
      const result = S.checkIn(new FormData(form).get('code'));
      notifyConsole(result, result.ok ? `${result.booking.code} 체크인을 완료했습니다.` : '');
    },
    profile: V.saveProfile,
    promo(form) {
      const result = S.redeemPromo(form.code.value);
      if (!result.ok) return U.toast(result.error, 'toast-bad');
      U.toast('쿠폰을 등록했습니다.');
      render();
    }
  };

  app.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (el) actions[el.dataset.act](el);
  });

  app.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-form]');
    if (!form) return;
    e.preventDefault();
    forms[form.dataset.form](form);
  });

  function onFormInput(e) {
    const bookForm = e.target.closest('[data-form=book]');
    if (!bookForm) return false;
    if (e.target.name === 'seat') V.changeSeat(bookForm, e.target);
    else if (e.target.name === 'coupon' || e.target.name === 'points') V.updateCheckout(bookForm);
    return true;
  }

  app.addEventListener('input', (e) => {
    if (e.target.name === 'points') onFormInput(e);
  });

  app.addEventListener('change', (e) => {
    if (e.target.id === 'from') return V.syncDestination();
    if (onFormInput(e)) return;
    const kind = e.target.dataset.change;
    if (kind === 'filter-sort') {
      V.filters.sort = e.target.value;
      return V.refreshFlightList(currentSearch());
    }
    if (kind === 'filter-open') {
      V.filters.onlyOpen = e.target.checked;
      return V.refreshFlightList(currentSearch());
    }
    if (kind === 'console-date') CV.state.date = e.target.value;
    else if (kind === 'console-origin') CV.state.origin = e.target.value;
    else return;
    render();
  });

  // 차트 툴팁
  const tip = document.getElementById('chart-tip');
  app.addEventListener('mousemove', (e) => {
    const target = e.target.closest('[data-tip]');
    if (!target) {
      tip.hidden = true;
      return;
    }
    tip.textContent = target.dataset.tip;
    tip.hidden = false;
    tip.style.left = `${Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8)}px`;
    tip.style.top = `${e.clientY - 40}px`;
  });
  app.addEventListener('mouseleave', () => { tip.hidden = true; });

  function updateChrome(nav) {
    document.querySelectorAll('[data-nav]').forEach((a) => {
      if (a.dataset.nav === nav) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    const unread = S.unreadCount();
    const badge = document.getElementById('bell-badge');
    badge.hidden = unread === 0;
    badge.textContent = unread > 9 ? '9+' : String(unread);
    document.querySelector('.bell').setAttribute('aria-label', unread ? `알림 ${unread}건` : '알림');
  }

  function render() {
    const { parts, query } = parseHash();
    const [page, id] = parts;
    let nav = '';
    if (!page) { nav = 'home'; V.home(); }
    else if (page === 'flights') { nav = 'home'; V.flights(query); }
    else if (page === 'book') { nav = 'home'; V.book(id, query); }
    else if (page === 'booking') { nav = 'trips'; V.booking(id); }
    else if (page === 'trips') { nav = 'trips'; V.trips(); }
    else if (page === 'account') { nav = 'account'; V.account(); }
    else if (page === 'alerts') { nav = 'alerts'; V.alerts(); }
    else if (page === 'console') { nav = 'console'; CV.render(); }
    else V.invalid('페이지를 찾을 수 없습니다.');
    updateChrome(nav);
  }

  document.querySelectorAll('[data-ico]').forEach((n) => { n.innerHTML = U.icon(n.dataset.ico); });

  window.addEventListener('hashchange', () => {
    V.stopSim();
    tip.hidden = true;
    render();
    window.scrollTo(0, 0);
    app.focus({ preventScroll: true });
  });

  render();
})();
