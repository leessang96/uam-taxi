// 서비스 설정과 기준 데이터. 운임, 시간, 거리, 기체 정보는 모두 데모용 가정값이다.
window.UAM = window.UAM || {};

UAM.config = {
  serviceName: '하늘콜',
  seatsPerFlight: 4,
  payloadKg: 380, // 승객과 수하물을 합친 편당 최대 중량
  baseFare: 89000, // 좌석당 운임
  peakMultiplier: 1.2,
  peakHours: [[7, 9], [17, 19]], // [시작, 종료) 단위: 시
  flightMin: 14,
  checkinMin: 15, // 출발 전 수속 시간
  egressMin: 5, // 도착 후 터미널로 나오는 시간
  delayMin: 15,
  firstDepartMin: 7 * 60,
  lastDepartMin: 20 * 60 + 30,
  intervalMin: 30,
  bookingCutoffMin: 30, // 출발 N분 전까지 예약 가능
  bookingWindowDays: 7,
  commissionRate: 0.12, // 플랫폼 중개 수수료
  railFare: 5000, // 1인 공항철도 추정 요금
  tollFare: 6600, // 자동차 통행료 추정
  substituteCoupon: 30000, // 결항 시 지급하는 쿠폰
  pointRate: 0.03, // 탑승 완료 시 항공 운임의 적립률
  welcomePoints: 5000,
  paymentDelayMs: 900, // 가상 결제 처리 연출 시간
  simStepMs: 1100, // 자동 시뮬레이션의 단계 간격
  simFlightMs: 9000 // 자동 시뮬레이션의 비행 구간 길이
};

UAM.vertiports = {
  GMP: { code: 'GMP', name: '김포공항 버티포트', short: '김포공항' },
  ICN: { code: 'ICN', name: '인천공항 버티포트', short: '인천공항' }
};

// side: 이용하는 버티포트
// km, carMin, railMin: 해당 버티포트까지의 거리와 소요 시간
// walk: 버티포트와 붙어 있어 연계 택시가 필요 없는 곳
// thru*: 김포 권역 장소에서 인천공항까지 지상으로 곧장 가는 경우의 값
UAM.places = [
  { id: 'gmp-terminal', name: '김포공항 터미널', side: 'GMP', km: 1, carMin: 5, railMin: 5, walk: true, thruKm: 45, thruCarMin: 45, thruRailMin: 35 },
  { id: 'magok', name: '마곡나루역', side: 'GMP', km: 5, carMin: 12, railMin: 10, thruKm: 47, thruCarMin: 48, thruRailMin: 40 },
  { id: 'hongdae', name: '홍대입구역', side: 'GMP', km: 14, carMin: 30, railMin: 20, thruKm: 58, thruCarMin: 60, thruRailMin: 55 },
  { id: 'yeouido', name: '여의도역', side: 'GMP', km: 14, carMin: 30, railMin: 25, thruKm: 60, thruCarMin: 65, thruRailMin: 65 },
  { id: 'seoul-stn', name: '서울역', side: 'GMP', km: 19, carMin: 40, railMin: 30, thruKm: 62, thruCarMin: 70, thruRailMin: 60 },
  { id: 'gangnam', name: '강남역', side: 'GMP', km: 27, carMin: 55, railMin: 60, thruKm: 72, thruCarMin: 80, thruRailMin: 90 },
  { id: 'icn-t1', name: '인천공항 제1터미널', side: 'ICN', km: 1, carMin: 5, railMin: 5, walk: true },
  { id: 'icn-t2', name: '인천공항 제2터미널', side: 'ICN', km: 6, carMin: 10, railMin: 10 },
  { id: 'yeongjong', name: '영종하늘도시', side: 'ICN', km: 15, carMin: 22, railMin: 25 },
  { id: 'songdo', name: '송도국제도시', side: 'ICN', km: 32, carMin: 40, railMin: 80 }
];

UAM.bags = [
  { kg: 0, label: '없음' },
  { kg: 7, label: '기내용 (7kg)' },
  { kg: 15, label: '중형 캐리어 (15kg)' }
];

UAM.seats = ['1A', '1B', '2A', '2B'];

UAM.paymentMethods = [
  { id: 'card', label: '신용·체크카드' },
  { id: 'easy', label: '간편결제' },
  { id: 'corp', label: '법인카드' }
];

UAM.promoCodes = {
  WELCOME10: { title: '첫 탑승 10% 할인', type: 'percent', value: 10 },
  SKY5000: { title: '5,000원 할인', type: 'amount', value: 5000 }
};

UAM.cancelReasons = ['기상 악화', '기체 정비', '교통관제 제한'];

UAM.fleet = [
  { id: 'HL-A01', base: 'GMP' },
  { id: 'HL-A02', base: 'GMP' },
  { id: 'HL-A03', base: 'ICN' },
  { id: 'HL-A04', base: 'ICN' }
];

UAM.faqs = [
  ['UAM은 지금 실제로 탈 수 있나요?', '아니요. 하늘콜은 포트폴리오용 데모로, 실제 운항과 결제는 이루어지지 않습니다.'],
  ['왜 체중을 입력해야 하나요?', 'UAM 기체는 탑재 중량 제한이 엄격해 탑승객과 수하물의 총 중량을 출발 전에 계산합니다. 데모에서는 입력값이 이 브라우저에만 저장됩니다.'],
  ['날씨가 나쁘면 어떻게 되나요?', '운항사 사유로 결항되면 결제 금액을 전액 환불하고, 다음 이용에 쓸 수 있는 쿠폰을 자동 지급합니다.'],
  ['예약을 취소하면 환불받을 수 있나요?', '출발 24시간 전까지 전액, 2시간 전까지 50%가 환불되며 이후에는 환불되지 않습니다. 사용한 쿠폰과 포인트는 돌려드립니다.'],
  ['짐은 얼마나 실을 수 있나요?', '1인당 중형 캐리어 1개까지 실을 수 있습니다. 항공편별 남은 탑재 중량에 따라 제한될 수 있습니다.']
];
