import { Link, Navigate } from 'react-router';
import { Wordmark } from '../../shared/AppShell.jsx';
import { ProfileCard } from '../../shared/ui.jsx';
import { useAuth } from '../auth/index.js';
import './landing.css';

const REPO = 'https://github.com/taehuni/CrewFit';

// 트랙 레인 — 히어로·AI·CTA 섹션에 같은 곡선을 깔아 페이지를 잇는 선으로 씀
function Lanes({ className = '' }) {
  return (
    <svg className={`lp-lanes ${className}`} viewBox="0 0 1400 700" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <path d="M-200 760 A 900 900 0 0 1 1600 760" />
      <path d="M-200 840 A 980 980 0 0 1 1600 840" />
      <path d="M-200 920 A 1060 1060 0 0 1 1600 920" />
      <path d="M-200 1000 A 1140 1140 0 0 1 1600 1000" />
    </svg>
  );
}

// 배번 형태 미니 아바타 (사진 없이도 임시 데이터 티가 덜 남)
function Bibs({ numbers }) {
  return (
    <span className="lp-bibs" aria-hidden="true">
      {numbers.map((n) => <span key={n} className="num">{n}</span>)}
    </span>
  );
}

const CREWS = [
  { name: '마포 아침 러닝', sport: '러닝', region: '마포구', days: '화·목·토', level: '입문~중급', n: 12, match: 4, next: '목 06:30 · 망원한강공원', week: '이번 주 8명이 42.3 km', who: ['042', '117', '208', '311'] },
  { name: '역삼 헬스 메이트', sport: '헬스', region: '강남구', days: '월·수·금', level: '중급', n: 8, match: 3, next: '수 20:00 · 역삼역 3번 출구', week: '이번 주 6명이 41세트', who: ['073', '150', '266'] },
  { name: '한강 자전거 일요일', sport: '자전거', region: '영등포구', days: '일', level: '전체', n: 23, match: 2, next: '일 08:00 · 여의도 물빛광장', week: '지난 일요일 14명이 38 km', who: ['019', '188', '240', '305'] },
];

// 비회원 첫 화면. 어두운 히어로(폰 + 통계 패널) → 사실 띠 → 01 기록(웜그레이) → 02 AI(차콜) → 03 크루(베이지) → 이용 방법 → CTA(주황).
// 미리보기는 전부 정적 예시 데이터. 실제 기능 화면이 생기면 그 컴포넌트로 교체.
export default function LandingPage() {
  const { loading, session } = useAuth();
  if (loading) return <div className="center">불러오는 중…</div>;
  if (session) return <Navigate to="/home" replace />;

  return (
    <div className="lp">
      <a href="#main" className="skip-link">본문으로 건너뛰기</a>

      <header className="lp-nav">
        <div className="lp-wrap row">
          <Link to="/" aria-label="CrewFit 홈"><Wordmark /></Link>
          <nav className="lp-nav-links" aria-label="페이지 안내">
            <a href="#record">주요 기능</a>
            <a href="#how">이용 방법</a>
          </nav>
          <div className="lp-nav-cta">
            <Link to="/login" className="btn btn-ghost btn-sm">로그인</Link>
            <Link to="/signup" className="btn btn-primary btn-sm">무료로 시작하기</Link>
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1}>
        {/* 히어로 */}
        <section className="lp-hero">
          <Lanes />
          <div className="lp-wrap lp-hero-grid">
            <div className="lp-hero-copy">
              <h1>운동은 기록하고,<br />성장은 확인하고,<br />내 페이스에 맞는<br />크루와 계속하세요.</h1>
              <p className="lp-lead">러닝과 헬스 기록부터 AI 주간 피드백, 지역 기반 크루 매칭까지. 워치 없이도 브라우저에서 바로 시작할 수 있어요.</p>
              <div className="lp-cta-row">
                <Link to="/signup" className="btn btn-primary">무료로 시작하기</Link>
                <a href="#record" className="btn btn-ghost-dark">어떻게 되는지 보기</a>
              </div>
            </div>

            {/* 폰 화면(앞) + 넓은 통계 패널(뒤) */}
            <div className="lp-devices" role="img" aria-label="CrewFit 미리보기: 모바일 홈 화면(배번표·GPS 경로)과 주간 통계 패널">
              <div className="lp-wide">
                <p className="small dim">이번 주 · 9월 1주</p>
                <div className="lp-stats">
                  <div><span className="num">4</span><span className="small">회 운동</span></div>
                  <div><span className="num">18.6</span><span className="small">km</span></div>
                  <div><span className="num">2:35</span><span className="small">시간</span></div>
                  <div><span className="num lp-fire">5</span><span className="small">일 연속</span></div>
                </div>
                <div className="lp-bars" aria-hidden="true">
                  {[
                    ['월', 30, false], ['화', 0, false], ['수', 65, false], ['목', 45, true], ['금', 0, false], ['토', 100, false], ['일', 0, false],
                  ].map(([d, h, gym]) => (
                    <div key={d}><span style={{ height: `${h}%` }} data-gym={gym || undefined} /><b>{d}</b></div>
                  ))}
                </div>
                <ul className="lp-recent" aria-label="최근 기록">
                  <li className="row"><span className="lp-sport">헬스</span><span className="grow">하체 · 스쿼트 외 3종</span><span className="num">12세트</span><span className="num dim">48:00</span></li>
                  <li className="row"><span className="lp-sport">걷기</span><span className="grow">출근길</span><span className="num">2.1 km</span><span className="num dim">24:30</span></li>
                </ul>
              </div>

              <div className="lp-phone">
                <div className="lp-phone-bar"><span className="num">21:14</span><span /></div>
                <div className="lp-phone-body">
                  <ProfileCard nickname="달리는 민수" sport="running" level="beginner" region="서울 마포구" number="042" as="div" />
                  <div className="lp-map">
                    <svg viewBox="0 0 320 150" aria-hidden="true">
                      <g className="lp-map-grid">
                        <path d="M0 38H320M0 75H320M0 112H320M40 0V150M100 0V150M160 0V150M220 0V150M280 0V150" />
                      </g>
                      <path className="lp-map-route" d="M14 120 C 50 50, 80 135, 120 88 S 180 25, 210 62 S 260 140, 306 50" />
                      <circle cx="14" cy="120" r="5" /><circle cx="306" cy="50" r="5" />
                    </svg>
                    <div className="lp-map-cap">
                      <span className="small dim">한강 야간 러닝 · 어제</span>
                      <span className="row"><span className="num">5.2 km</span><span className="num">31:10</span><span className="num">5'59"</span></span>
                    </div>
                  </div>
                  <span className="btn btn-primary btn-block" aria-hidden="true">트래킹 시작</span>
                </div>
              </div>
            </div>
          </div>

          <ul className="lp-facts lp-wrap" aria-label="CrewFit 특징">
            <li>앱 설치 없이 브라우저에서</li>
            <li>러닝·헬스 포함 <span className="num">6</span>종목</li>
            <li>워치 없이 GPS 기록</li>
            <li>지역·요일·레벨로 크루 매칭</li>
            <li>무료</li>
          </ul>
        </section>

        {/* 01 기록 — 웜그레이 + 배경까지 침범하는 GPS 경로 */}
        <section id="record" className="lp-sec lp-warmgrey" aria-labelledby="d1">
          <span className="lp-bignum" aria-hidden="true">01</span>
          <svg className="lp-bgroute" viewBox="0 0 1400 600" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
            <path d="M-50 520 C 200 380, 350 640, 560 470 S 900 120, 1100 330 S 1300 560, 1500 300" />
          </svg>
          <div className="lp-wrap lp-detail">
            <div className="lp-detail-copy">
              <p className="lp-kicker">01 · 기록</p>
              <h2 id="d1">헬스는 세트로,<br />러닝은 경로로 남아요.</h2>
              <p className="lp-lead">운동명은 자동완성으로 빠르게. 야외 운동은 트래킹 시작만 누르면 거리·시간·경로가 저장되고, 종료 후 지도에 코스가 그려집니다.</p>
            </div>
            <div className="lp-detail-ui">
              <div className="lp-panel lp-sets">
                <p className="small muted">9월 4일 · 헬스 · 48분</p>
                <table>
                  <thead><tr><th scope="col">운동</th><th scope="col">세트</th><th scope="col">횟수</th><th scope="col">kg</th></tr></thead>
                  <tbody>
                    <tr><td>스쿼트</td><td className="num">1</td><td className="num">10</td><td className="num">60</td></tr>
                    <tr><td>스쿼트</td><td className="num">2</td><td className="num">8</td><td className="num">70</td></tr>
                    <tr><td>레그 프레스</td><td className="num">1</td><td className="num">12</td><td className="num">120</td></tr>
                    <tr><td>런지</td><td className="num">1</td><td className="num">12</td><td className="num">—</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="lp-panel lp-run">
                <div className="row">
                  <div className="grow">
                    <p className="small muted">9월 6일 · 러닝</p>
                    <p className="num num-lg">5.2 <span className="lp-unit">km</span></p>
                  </div>
                  <div><p className="small muted">시간</p><p className="num">31:10</p></div>
                  <div><p className="small muted">페이스</p><p className="num">5'59"</p></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 02 AI — 차콜 */}
        <section className="lp-sec lp-dark" aria-labelledby="d2">
          <Lanes className="lp-lanes-low" />
          <span className="lp-bignum" aria-hidden="true">02</span>
          <div className="lp-wrap lp-detail lp-detail-rev">
            <div className="lp-detail-copy">
              <p className="lp-kicker">02 · AI 코칭</p>
              <h2 id="d2">이번 주를 숫자와<br />한 문단으로.</h2>
              <p className="lp-lead">기록만이 아니라 식단과 목표까지 같이 봐요. 기록이 같으면 기존 피드백을 바로 보여 주고, 새 기록이 쌓이면 다시 생성할 수 있어요.</p>
            </div>
            <div className="lp-detail-ui">
              <div className="lp-feedback">
                <p className="small dim">주간 피드백 · 9월 1주</p>
                <div className="lp-stats">
                  <div><span className="num">4</span><span className="small">회</span></div>
                  <div><span className="num">18.6</span><span className="small">km</span></div>
                  <div><span className="num lp-fire">+4.1</span><span className="small">지난주 대비</span></div>
                </div>
                <p className="lp-feedback-text">
                  러닝 3회로 목표를 채웠고 거리도 지난주보다 4 km 늘었어요. 다만 세 번 모두 페이스가 6'00" 안팎으로 같았으니,
                  다음 주엔 한 번은 짧게 빠르게 달려 보세요. 목요일 헬스는 하체 위주였는데 단백질 섭취가 적었어요. 운동 후 식사에 신경 써 보세요.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 03 크루 — 베이지 */}
        <section className="lp-sec lp-warm" aria-labelledby="d3">
          <span className="lp-bignum" aria-hidden="true">03</span>
          <div className="lp-wrap">
            <div className="lp-detail-copy lp-crew-copy">
              <p className="lp-kicker">03 · 크루</p>
              <h2 id="d3">같이 뛸 사람은<br />동네에서 찾아요.</h2>
              <p className="lp-lead">내 종목·지역·요일·레벨을 설정하면 조건이 맞는 크루부터 보여 줘요. 즉시 가입하거나 가입을 신청하고, 크루 피드에서 서로 인증해요.</p>
            </div>
            <ul className="lp-crews" aria-label="크루 추천 예시">
              {CREWS.map((c) => (
                <li key={c.name} className="lp-crew">
                  <div className="row">
                    <span className="lp-match">조건 {c.match}개 일치</span>
                    <span className="grow" />
                    <span className="small muted"><span className="num">{c.n}</span>명</span>
                  </div>
                  <h3>{c.name}</h3>
                  <p className="lp-crew-meta">{c.sport} · {c.region} · {c.days} · {c.level}</p>
                  <Bibs numbers={c.who} />
                  <p className="lp-crew-next"><span className="muted">다음 모임</span> {c.next}</p>
                  <p className="lp-crew-week">{c.week}</p>
                </li>
              ))}
            </ul>
            <div className="lp-post" aria-label="크루 피드 게시물 예시">
              <div className="row">
                <Bibs numbers={['117']} />
                <div className="grow"><strong>수진</strong> <span className="small muted">마포 아침 러닝 · 2시간 전</span></div>
              </div>
              <p>오늘 목요 모임 7명 완주. 처음 오신 두 분도 5 km 끝까지! 다음 주는 6:20 출발로 당깁니다.</p>
              <div className="row lp-post-run">
                <span className="lp-sport">러닝</span><span className="grow">망원 → 양화대교 왕복</span><span className="num">5.1 km</span><span className="num muted">33:04</span>
              </div>
              <p className="small muted">좋아요 9 · 댓글 4</p>
            </div>
          </div>
        </section>

        {/* 이용 흐름 */}
        <section id="how" className="lp-sec lp-how" aria-labelledby="how-h">
          <div className="lp-wrap">
            <h2 id="how-h">이용 방법</h2>
            <ol>
              <li><span className="num">1</span><h3>기록하기</h3><p>운동 직후 세트나 거리를 남겨요. 야외면 트래킹으로 자동.</p></li>
              <li><span className="num">2</span><h3>피드백 받기</h3><p>주말에 "이번 주 피드백"을 눌러 한 문단으로 정리해요.</p></li>
              <li><span className="num">3</span><h3>크루와 공유하기</h3><p>기록을 크루 피드에 올리고, 다음 모임에서 같이 뛰어요.</p></li>
            </ol>
          </div>
        </section>

        {/* 최종 CTA — 결승선 + START */}
        <section className="lp-final">
          <div className="lp-finish" aria-hidden="true" />
          <span className="lp-start" aria-hidden="true">START</span>
          <div className="lp-wrap lp-final-grid">
            <div>
              <h2>오늘 운동부터<br />남겨 보세요.</h2>
              <p className="lp-lead">가입은 이메일 하나면 돼요. 앱 설치도, 워치도 필요 없어요.</p>
              <Link to="/signup" className="btn btn-paper">무료로 시작하기</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <div className="lp-wrap">
          <Wordmark />
          <nav aria-label="바닥 링크">
            <a href="#record">서비스 소개</a>
            <Link to="/login">로그인</Link>
            <a href={REPO} rel="noreferrer" target="_blank">GitHub</a>
          </nav>
          <p className="small muted">2인 캡스톤 프로젝트 · 웹 브라우저만으로 쓰는 운동 크루 플랫폼 · 화면의 기록·크루는 예시 데이터</p>
        </div>
      </footer>
    </div>
  );
}
