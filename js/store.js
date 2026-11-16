// 예약, 지갑, 알림, 운항 상태 저장소. 이 브라우저의 localStorage에만 저장한다.
// 나중에 서버를 붙일 때 이 파일의 함수만 API 호출로 바꾸면 된다.
UAM.store = (function () {
  const L = UAM.logic;
  const C = UAM.config;
  const KEY = 'hanulcall.v2';
  const STAGE_CHECKED_IN = 3;
  const STAGE_FLYING = 5;
  const STAGE_LAST = 6;

  function emptyState() {
    return {
      bookings: [],
      flightStatus: {},
      profile: { name: '', weight: '' },
      points: C.welcomePoints,
      coupons: [makeCoupon('WELCOME10', UAM.promoCodes.WELCOME10, 'welcome')],
      notifications: []
    };
  }

  function makeCoupon(id, spec, source) {
    return { id, title: spec.title, type: spec.type, value: spec.value, source, used: false };
  }

  let memory = emptyState();

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(KEY));
      if (data && Array.isArray(data.bookings) && data.flightStatus) memory = data;
    } catch (e) { /* 저장소를 못 쓰는 환경에서는 메모리 값으로 동작한다 */ }
    return memory;
  }

  function save(data) {
    memory = data;
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) { /* 위와 같음 */ }
  }

  const fail = (error) => ({ ok: false, error });

  function notify(data, title, body, code) {
    data.notifications.unshift({ id: `${Date.now()}-${data.notifications.length}`, at: Date.now(), title, body, code: code || '', read: false });
    data.notifications = data.notifications.slice(0, 50);
  }

  function flightState(data, flight) {
    return data.flightStatus[flight.id] || { state: 'normal' };
  }

  function activeBookings(data, flightId) {
    return data.bookings.filter((b) => b.flightId === flightId && b.status === 'confirmed');
  }

  function bookingKg(b) {
    return b.passengers.reduce((sum, p) => sum + p.weight + p.bag, 0);
  }

  function viewOf(data, flight) {
    const status = flightState(data, flight);
    const cancelled = status.state === 'cancelled';
    const seed = cancelled ? { seats: 0, kg: 0 } : L.seedLoad(flight);
    const booked = activeBookings(data, flight.id);
    const seatsSold = seed.seats + booked.reduce((sum, b) => sum + b.passengers.length, 0);
    const kgUsed = seed.kg + booked.reduce((sum, b) => sum + bookingKg(b), 0);
    return {
      flight,
      status: status.state,
      reason: status.reason || '',
      departMin: flight.departMin + (status.state === 'delayed' ? C.delayMin : 0),
      seatsSold,
      seatsLeft: Math.max(0, C.seatsPerFlight - seatsSold),
      takenSeats: (cancelled ? [] : L.seedSeats(flight)).concat(booked.flatMap((b) => b.seats)),
      kgUsed,
      kgLeft: Math.max(0, C.payloadKg - kgUsed),
      revenue: seatsSold * flight.price
    };
  }

  const flightView = (flight) => viewOf(load(), flight);

  function newCode(data) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code;
    do {
      code = 'HC-';
      for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    } while (data.bookings.some((b) => b.code === code));
    return code;
  }

  function createBooking({ flightId, fromId, toId, passengers, seats, couponId = '', points = 0, method = 'card' }, now = new Date()) {
    const data = load();
    const flight = L.getFlight(flightId);
    const from = L.place(fromId);
    const to = L.place(toId);
    if (!flight || !from || !to || from.side !== flight.origin || to.side !== flight.dest) {
      return fail('예약 정보가 올바르지 않습니다. 다시 검색해 주세요.');
    }
    if (!L.isBookable(flight, now)) return fail('예약이 마감된 항공편입니다.');

    const view = viewOf(data, flight);
    if (view.status === 'cancelled') return fail('결항된 항공편입니다.');
    if (passengers.length > view.seatsLeft) return fail(`남은 좌석이 ${view.seatsLeft}석뿐입니다.`);

    const uniqueSeats = new Set(seats);
    const seatsValid = seats.length === passengers.length && uniqueSeats.size === seats.length &&
      seats.every((s) => UAM.seats.includes(s));
    if (!seatsValid) return fail(`좌석을 ${passengers.length}개 선택해 주세요.`);
    if (seats.some((s) => view.takenSeats.includes(s))) return fail('이미 예약된 좌석이 포함되어 있습니다.');

    const kg = passengers.reduce((sum, p) => sum + p.weight + p.bag, 0);
    if (kg > view.kgLeft) {
      return fail(`이 항공편의 남은 탑재 중량은 ${view.kgLeft}kg인데 입력하신 합계는 ${kg}kg입니다. 수하물을 줄이거나 다른 항공편을 선택해 주세요.`);
    }

    const coupon = couponId ? data.coupons.find((c) => c.id === couponId && !c.used) : null;
    if (couponId && !coupon) return fail('사용할 수 없는 쿠폰입니다.');
    if (points > data.points) return fail(`보유 포인트는 ${data.points.toLocaleString('ko-KR')}P입니다.`);

    const seatTotal = flight.price * passengers.length;
    const ground = L.groundFare(from) + L.groundFare(to);
    const price = L.priceBreakdown({ seatTotal, ground, coupon, points });

    const booking = {
      code: newCode(data),
      flightId,
      fromId,
      toId,
      passengers,
      seats: seats.slice().sort(),
      seatTotal,
      ground,
      discount: price.discount,
      couponId: coupon ? coupon.id : '',
      couponTitle: coupon ? coupon.title : '',
      pointsUsed: price.pointsUsed,
      total: price.paid,
      method,
      status: 'confirmed', // confirmed | cancelled_user | cancelled_flight
      refund: 0,
      reason: '',
      couponGranted: 0,
      earned: 0,
      stage: 0,
      createdAt: now.getTime()
    };
    if (coupon) coupon.used = true;
    data.points -= price.pointsUsed;
    data.bookings.push(booking);
    notify(data, '예약이 확정되었습니다', `${L.formatDate(flight.date)} ${L.minToTime(flight.departMin)} ${flight.code}편`, booking.code);
    save(data);
    return { ok: true, booking };
  }

  const findBooking = (code) => load().bookings.find((b) => b.code === code) || null;

  function listBookings() {
    return load().bookings.slice().sort((a, b) => b.createdAt - a.createdAt);
  }

  function updateBooking(code, change) {
    const data = load();
    const booking = data.bookings.find((b) => b.code === code);
    if (!booking) return fail('예약을 찾을 수 없습니다.');
    const error = change(booking, data);
    if (error) return fail(error);
    save(data);
    return { ok: true, booking };
  }

  function restoreBenefits(data, b) {
    const coupon = data.coupons.find((c) => c.id === b.couponId);
    if (coupon) coupon.used = false;
    data.points += b.pointsUsed;
  }

  function cancelByUser(code, now = new Date()) {
    return updateBooking(code, (b, data) => {
      if (b.status !== 'confirmed') return '이미 취소된 예약입니다.';
      if (b.stage >= STAGE_CHECKED_IN) return '체크인 후에는 취소할 수 없습니다.';
      b.status = 'cancelled_user';
      b.refund = Math.round(b.total * L.refundRate(L.getFlight(b.flightId), now));
      restoreBenefits(data, b);
      notify(data, '예약이 취소되었습니다', `환불 금액 ${L.won(b.refund)}`, b.code);
      return null;
    });
  }

  function advanceStage(code) {
    return updateBooking(code, (b, data) => {
      if (b.status !== 'confirmed') return '진행할 수 없는 예약입니다.';
      if (b.stage >= STAGE_LAST) return '이미 도착한 예약입니다.';
      b.stage += 1;
      if (b.stage === STAGE_LAST) {
        b.earned = Math.round(b.seatTotal * C.pointRate);
        data.points += b.earned;
        notify(data, '목적지에 도착했습니다', `${b.earned.toLocaleString('ko-KR')}P가 적립되었습니다.`, b.code);
      }
      return null;
    });
  }

  function checkIn(rawCode) {
    const code = String(rawCode || '').trim().toUpperCase();
    if (!code) return fail('예약번호를 입력해 주세요.');
    return updateBooking(code, (b, data) => {
      if (b.status !== 'confirmed') return '취소된 예약입니다.';
      if (b.stage >= STAGE_CHECKED_IN) return '이미 체크인된 예약입니다.';
      b.stage = STAGE_CHECKED_IN;
      notify(data, '체크인이 완료되었습니다', '탑승구 앞에서 안내를 기다려 주세요.', b.code);
      return null;
    });
  }

  function setDelayed(flightId, delayed) {
    const data = load();
    const flight = L.getFlight(flightId);
    if (!flight) return fail('항공편을 찾을 수 없습니다.');
    if (flightState(data, flight).state === 'cancelled') return fail('결항된 항공편은 변경할 수 없습니다.');
    if (delayed) data.flightStatus[flightId] = { state: 'delayed' };
    else delete data.flightStatus[flightId];
    activeBookings(data, flightId).forEach((b) => {
      notify(data, delayed ? `${flight.code}편이 ${C.delayMin}분 지연되었습니다` : `${flight.code}편이 정상 운항합니다`, '변경된 일정을 확인해 주세요.', b.code);
    });
    save(data);
    return { ok: true };
  }

  // 결항 처리: 해당 편의 예약을 전액 환불하고, 쿠폰·포인트 복구와 보상 쿠폰 지급을 함께 한다.
  function cancelFlight(flightId, reason) {
    const data = load();
    const flight = L.getFlight(flightId);
    if (!flight) return fail('항공편을 찾을 수 없습니다.');
    const booked = activeBookings(data, flightId);
    if (booked.some((b) => b.stage >= STAGE_FLYING)) {
      return fail('이미 비행 중인 승객이 있어 결항 처리할 수 없습니다.');
    }
    booked.forEach((b) => {
      b.status = 'cancelled_flight';
      b.refund = b.total;
      b.reason = reason;
      b.couponGranted = C.substituteCoupon;
      restoreBenefits(data, b);
      data.coupons.push(makeCoupon(`COMP-${b.code}`, { title: '결항 보상 쿠폰', type: 'amount', value: C.substituteCoupon }, 'compensation'));
      notify(data, `${flight.code}편이 결항되었습니다`, `${reason}. ${L.won(b.refund)} 환불과 보상 쿠폰이 지급되었습니다.`, b.code);
    });
    data.flightStatus[flightId] = { state: 'cancelled', reason };
    save(data);
    return { ok: true, affected: booked.length };
  }

  function wallet() {
    const data = load();
    return { points: data.points, coupons: data.coupons.slice() };
  }

  function redeemPromo(rawCode) {
    const code = String(rawCode || '').trim().toUpperCase();
    if (!code) return fail('쿠폰 코드를 입력해 주세요.');
    const spec = UAM.promoCodes[code];
    if (!spec) return fail('존재하지 않는 쿠폰 코드입니다.');
    const data = load();
    if (data.coupons.some((c) => c.id === code)) return fail('이미 등록한 쿠폰입니다.');
    const coupon = makeCoupon(code, spec, 'promo');
    data.coupons.push(coupon);
    save(data);
    return { ok: true, coupon };
  }

  const profile = () => load().profile;

  function saveProfile({ name, weight }) {
    const data = load();
    data.profile = { name, weight };
    save(data);
    return { ok: true };
  }

  const notifications = () => load().notifications.slice();
  const unreadCount = () => load().notifications.filter((n) => !n.read).length;

  function markAllRead() {
    const data = load();
    data.notifications.forEach((n) => { n.read = true; });
    save(data);
  }

  function dayStats(date) {
    const data = load();
    const views = ['GMP', 'ICN'].flatMap((o) => L.listFlights(date, o)).map((f) => viewOf(data, f));
    const operating = views.filter((v) => v.status !== 'cancelled');
    const seats = operating.reduce((sum, v) => sum + v.seatsSold, 0);
    const capacity = operating.length * C.seatsPerFlight;
    const gmv = operating.reduce((sum, v) => sum + v.revenue, 0);

    const hourly = [];
    for (let h = Math.floor(C.firstDepartMin / 60); h <= Math.floor(C.lastDepartMin / 60); h++) {
      const inHour = operating.filter((v) => Math.floor(v.flight.departMin / 60) === h);
      const sold = inHour.reduce((sum, v) => sum + v.seatsSold, 0);
      const cap = inHour.length * C.seatsPerFlight;
      hourly.push({ hour: h, sold, cap, rate: cap ? sold / cap : 0 });
    }

    return {
      seats,
      capacity,
      loadFactor: capacity ? seats / capacity : 0,
      gmv,
      commission: Math.round(gmv * C.commissionRate),
      cancelled: views.length - operating.length,
      hourly
    };
  }

  function bookingsOn(date) {
    return listBookings().filter((b) => b.flightId.startsWith(`${date}-`));
  }

  function reset() {
    memory = emptyState();
    try {
      localStorage.removeItem(KEY);
    } catch (e) { /* 위와 같음 */ }
  }

  return {
    STAGE_CHECKED_IN, STAGE_FLYING, STAGE_LAST,
    flightView, createBooking, findBooking, listBookings, cancelByUser, advanceStage, checkIn,
    setDelayed, cancelFlight, wallet, redeemPromo, profile, saveProfile,
    notifications, unreadCount, markAllRead, dayStats, bookingsOn, bookingKg, reset
  };
})();
