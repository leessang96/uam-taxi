// 화면과 저장소에 의존하지 않는 계산 함수 모음.
UAM.logic = (function () {
  const C = UAM.config;
  const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
  const pad = (n) => String(n).padStart(2, '0');

  const toDateStr = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

  function parseDate(s) {
    return new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
  }

  function bookingDates(now = new Date()) {
    const out = [];
    for (let i = 0; i < C.bookingWindowDays; i++) {
      out.push(toDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)));
    }
    return out;
  }

  function formatDate(s) {
    const d = parseDate(s);
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAYS[d.getDay()]})`;
  }

  function minToTime(m) {
    const v = ((m % 1440) + 1440) % 1440;
    return `${pad(Math.floor(v / 60))}:${pad(v % 60)}`;
  }

  function duration(m) {
    const h = Math.floor(m / 60);
    const r = m % 60;
    if (!h) return `${r}분`;
    return r ? `${h}시간 ${r}분` : `${h}시간`;
  }

  const won = (n) => `${Math.round(n).toLocaleString('ko-KR')}원`;

  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  const place = (id) => UAM.places.find((p) => p.id === id) || null;
  const otherSide = (side) => (side === 'GMP' ? 'ICN' : 'GMP');

  // 서울 중형택시 기본요금 체계를 단순화한 추정치, 100원 단위 반올림
  function taxiFare(km) {
    const fare = 4800 + Math.max(0, km - 1.6) * 763;
    return Math.round(fare / 100) * 100;
  }

  const groundFare = (p) => (p.walk ? 0 : taxiFare(p.km));

  function isPeak(departMin) {
    const hour = departMin / 60;
    return C.peakHours.some(([a, b]) => hour >= a && hour < b);
  }

  function seatPrice(departMin) {
    return isPeak(departMin) ? Math.round(C.baseFare * C.peakMultiplier / 100) * 100 : C.baseFare;
  }

  function makeFlight(date, origin, departMin) {
    const index = (departMin - C.firstDepartMin) / C.intervalMin;
    return {
      id: `${date}-${origin}-${pad(Math.floor(departMin / 60))}${pad(departMin % 60)}`,
      code: `HC${(origin === 'GMP' ? 101 : 102) + index * 2}`,
      date,
      origin,
      dest: otherSide(origin),
      departMin,
      price: seatPrice(departMin),
      peak: isPeak(departMin)
    };
  }

  function listFlights(date, origin) {
    const out = [];
    for (let m = C.firstDepartMin; m <= C.lastDepartMin; m += C.intervalMin) {
      out.push(makeFlight(date, origin, m));
    }
    return out;
  }

  function getFlight(id) {
    const match = /^(\d{8})-(GMP|ICN)-(\d{2})(\d{2})$/.exec(id || '');
    if (!match) return null;
    const departMin = +match[3] * 60 + +match[4];
    const valid = departMin >= C.firstDepartMin && departMin <= C.lastDepartMin &&
      (departMin - C.firstDepartMin) % C.intervalMin === 0;
    return valid ? makeFlight(match[1], match[2], departMin) : null;
  }

  function departureTime(flight) {
    const d = parseDate(flight.date);
    d.setMinutes(flight.departMin);
    return d;
  }

  function isBookable(flight, now = new Date()) {
    return departureTime(flight).getTime() - C.bookingCutoffMin * 60000 > now.getTime();
  }

  // 데모 화면이 비어 보이지 않도록 편마다 고정된 샘플 예약을 만든다.
  function seedLoad(flight) {
    const h = hash(flight.id);
    const seats = h % 11 === 0 ? C.seatsPerFlight : [0, 0, 1, 1, 2, 3][h % 6];
    return { seats, kg: seats * 92 };
  }

  // 김포 권역 장소 → 인천공항 → 인천 권역 장소를 합산하므로 방향과 무관하게 값이 같다.
  function estimate(from, to) {
    const gmpSide = from.side === 'GMP' ? from : to;
    const icnSide = from.side === 'ICN' ? from : to;
    const carKm = gmpSide.thruKm + (icnSide.walk ? 0 : icnSide.km);

    const options = [
      {
        key: 'uam',
        label: 'UAM + 연계 택시',
        minutes: from.carMin + C.checkinMin + C.flightMin + C.egressMin + to.carMin,
        price: C.baseFare + groundFare(from) + groundFare(to),
        note: '1인, 비첨두 운임 기준'
      },
      {
        key: 'car',
        label: '택시로만 이동',
        minutes: gmpSide.thruCarMin + (icnSide.walk ? 0 : icnSide.carMin),
        price: taxiFare(carKm) + C.tollFare,
        note: '차량 1대, 통행료 포함'
      },
      {
        key: 'rail',
        label: '공항철도·대중교통',
        minutes: gmpSide.thruRailMin + (icnSide.walk ? 0 : icnSide.railMin),
        price: C.railFare,
        note: '1인 기준'
      }
    ];
    const fastest = Math.min(...options.map((o) => o.minutes));
    return options.map((o) => ({ ...o, fastest: o.minutes === fastest }));
  }

  // 출발 24시간 전 100%, 2시간 전 50%, 그 이후 환불 불가
  function refundRate(flight, now = new Date()) {
    const hours = (departureTime(flight).getTime() - now.getTime()) / 3600000;
    if (hours >= 24) return 1;
    if (hours >= 2) return 0.5;
    return 0;
  }

  // 샘플 예약이 차지한 좌석. 편마다 고정된 순서로 고른다.
  function seedSeats(flight) {
    const order = UAM.seats.slice().sort((a, b) => hash(`${flight.id}:${a}`) - hash(`${flight.id}:${b}`));
    return order.slice(0, seedLoad(flight).seats);
  }

  // 시간대별 가상 기상 정보
  function weather(flight) {
    const h = hash(`${flight.date}-${Math.floor(flight.departMin / 60)}`);
    const wind = 8 + (h % 27);
    const kind = h % 10;
    if (kind === 9) return { icon: 'wind', label: '강풍', wind: wind + 18, risk: '높음' };
    if (kind === 8) return { icon: 'rain', label: '비', wind, risk: '보통' };
    if (kind >= 6) return { icon: 'cloud', label: '구름', wind, risk: '낮음' };
    return { icon: 'sun', label: '맑음', wind, risk: '낮음' };
  }

  function priceBreakdown({ seatTotal, ground, coupon = null, points = 0 }) {
    const subtotal = seatTotal + ground;
    let discount = 0;
    if (coupon) {
      discount = coupon.type === 'percent'
        ? Math.round(seatTotal * coupon.value / 100)
        : Math.min(coupon.value, subtotal);
    }
    const afterCoupon = subtotal - discount;
    const requested = Number.isFinite(points) ? Math.floor(points) : 0;
    const pointsUsed = Math.min(Math.max(0, requested), afterCoupon);
    return { subtotal, discount, pointsUsed, paid: afterCoupon - pointsUsed };
  }

  function buildIcs({ code, flight, departMin, from, to }) {
    const stamp = (m) => `${flight.date}T${minToTime(m).replace(':', '')}00`;
    const text = (s) => s.replace(/[\\;,]/g, (c) => `\\${c}`);
    const now = new Date().toISOString().replace(/[-:]|\.\d{3}/g, '');
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Hanulcall Demo//KO',
      'BEGIN:VEVENT',
      `UID:${code}@hanulcall.demo`,
      `DTSTAMP:${now}`,
      `DTSTART;TZID=Asia/Seoul:${stamp(departMin - C.checkinMin)}`,
      `DTEND;TZID=Asia/Seoul:${stamp(departMin + C.flightMin)}`,
      `SUMMARY:${text(`하늘콜 ${flight.code} ${flight.origin}→${flight.dest}`)}`,
      `LOCATION:${text(UAM.vertiports[flight.origin].name)}`,
      `DESCRIPTION:${text(`${from.name} 출발, ${to.name} 도착. 예약번호 ${code}. 데모 예약입니다.`)}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');
  }

  return {
    toDateStr, parseDate, bookingDates, formatDate, minToTime, duration, won, hash, place, otherSide,
    taxiFare, groundFare, isPeak, seatPrice, listFlights, getFlight, departureTime, isBookable,
    seedLoad, seedSeats, weather, estimate, refundRate, priceBreakdown, buildIcs
  };
})();
