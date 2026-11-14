import { useState } from "react";

type Screen = "select" | "game" | "result" | "leaderboard" | "kit";
type Modal = "pause" | "settings" | "login" | null;

const maps = [
  {
    title: "Bunny Hop",
    artist: "Mimi feat. Lune",
    level: "Kẹo Ngọt",
    stars: "4.28",
    bpm: 168,
    color: "#ff85a2",
  },
  {
    title: "Sakura Memory",
    artist: "Yume",
    level: "Cánh Hoa",
    stars: "3.75",
    bpm: 142,
    color: "#f4a5bd",
  },
  {
    title: "Strawberry Kiss",
    artist: "MomoPop",
    level: "Rực Rỡ",
    stars: "5.16",
    bpm: 184,
    color: "#ff4d80",
  },
  {
    title: "Moonlit Ribbon",
    artist: "Hana",
    level: "Ánh Trăng",
    stars: "4.63",
    bpm: 176,
    color: "#c887b4",
  },
];

function Bow({ className = "" }: { className?: string }) {
  return (
    <span className={`bow ${className}`}>
      <i />
      <b />
      <i />
    </span>
  );
}

function Icon({
  name,
}: {
  name: "search" | "back" | "shuffle" | "gear" | "trophy" | "user" | "music" | "play";
}) {
  const paths = {
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m15.5 15.5 5 5" />
      </>
    ),
    back: (
      <>
        <path d="m14 6-6 6 6 6" />
        <path d="M8 12h11" />
      </>
    ),
    shuffle: (
      <>
        <path d="M4 7h3c5 0 5 10 10 10h3" />
        <path d="m17 14 3 3-3 3" />
        <path d="M4 17h3c2.3 0 3.6-2.1 5-4.5" />
        <path d="M14.5 7c.8 0 1.6 0 2.5 0h3" />
        <path d="m17 4 3 3-3 3" />
      </>
    ),
    gear: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 9 19.37a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15 1.7 1.7 0 0 0 3.08 14H3v-4h.08A1.7 1.7 0 0 0 4.63 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63 1.7 1.7 0 0 0 10 3.08V3h4v.08A1.7 1.7 0 0 0 15 4.63a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9 1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z" />
      </>
    ),
    trophy: (
      <>
        <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
        <path d="M8 6H5v2a3 3 0 0 0 3 3M16 6h3v2a3 3 0 0 1-3 3M12 13v4M8 21h8M9 17h6" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
      </>
    ),
    music: (
      <>
        <path d="M9 18V5l10-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="16" cy="16" r="3" />
      </>
    ),
    play: <path d="m9 7 9 5-9 5V7Z" />,
  };
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

function Bunny({
  mood = "happy",
  className = "",
}: {
  mood?: "happy" | "sleepy" | "cheer";
  className?: string;
}) {
  return (
    <svg className={`bunny ${className}`} viewBox="0 0 180 190" aria-label="Linh vật thỏ">
      <path className="ear" d="M55 72C38 48 39 10 54 9c16-1 20 37 21 58" />
      <path className="ear" d="M108 66c4-36 15-59 29-54 14 6 5 42-9 65" />
      <path
        className="inner-ear"
        d="M55 58c-7-16-8-32-3-36 7-4 12 18 13 39M120 59c3-18 9-34 14-33 6 2 1 22-7 38"
      />
      <ellipse className="body" cx="90" cy="125" rx="57" ry="55" />
      <path
        className="arm"
        d={
          mood === "cheer"
            ? "M46 117 22 88M134 117l25-30"
            : "M48 125c-17 5-23 17-17 25M133 125c15 4 21 16 15 25"
        }
      />
      {mood === "sleepy" ? (
        <>
          <path className="face" d="M58 118q10 8 20 0M103 118q10 8 20 0M85 132q5 5 10 0" />
          <text x="135" y="73" className="zzz">
            Z
          </text>
          <text x="151" y="51" className="zzz small">
            z
          </text>
        </>
      ) : (
        <>
          <ellipse className="eye" cx="68" cy="117" rx="5" ry="7" />
          <ellipse className="eye" cx="112" cy="117" rx="5" ry="7" />
          <path className="face" d="M82 134q8 9 16 0" />
          <ellipse className="blush" cx="52" cy="133" rx="10" ry="5" />
          <ellipse className="blush" cx="128" cy="133" rx="10" ry="5" />
        </>
      )}
      <g transform="translate(124 68) rotate(14)">
        <path
          className="bow-fill"
          d="M0 2C-18-15-33-10-30 7c3 17 20 13 31 3M0 2c18-17 33-12 30 5-3 17-20 13-31 3"
        />
        <circle className="bow-knot" cx="0" cy="7" r="8" />
      </g>
    </svg>
  );
}

function TopNav({
  onModal,
  onScreen,
  active,
}: {
  onModal: (m: Modal) => void;
  onScreen: (s: Screen) => void;
  active: Screen;
}) {
  return (
    <nav className="top-nav">
      <button className="brand" onClick={() => onScreen("select")}>
        <Bow />
        <span>
          TRIA<span>RHYTHM</span>
        </span>
      </button>
      <div className="nav-tabs">
        <button className={active === "select" ? "active" : ""} onClick={() => onScreen("select")}>
          <Icon name="play" />
          Chơi
        </button>
        <button
          className={active === "leaderboard" ? "active" : ""}
          onClick={() => onScreen("leaderboard")}
        >
          <Icon name="trophy" />
          Xếp hạng
        </button>
        <button className={active === "kit" ? "active" : ""} onClick={() => onScreen("kit")}>
          <span className="kit-icon">Aa</span>
          UI Kit
        </button>
      </div>
      <div className="nav-actions">
        <button className="round-btn" onClick={() => onModal("settings")} aria-label="Cài đặt">
          <Icon name="gear" />
        </button>
        <button className="profile-btn" onClick={() => onModal("login")}>
          <span className="avatar">
            <Icon name="user" />
          </span>
          <span>
            <small>Xin chào!</small>Đăng nhập
          </span>
        </button>
      </div>
    </nav>
  );
}

function Cover({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`cover-art ${compact ? "compact" : ""}`}>
      <div className="cover-moon" />
      <div className="cover-cloud c1" />
      <div className="cover-cloud c2" />
      <Bunny mood="happy" />
      <div className="cover-notes">♪　♫</div>
      <span>
        BUNNY
        <br />
        <b>HOP!</b>
      </span>
    </div>
  );
}

function SongSelect({ onPlay }: { onPlay: () => void }) {
  const [selected, setSelected] = useState(0);
  const song = maps[selected];
  return (
    <main className="select-screen screen">
      <div className="bg-ribbons">
        <span />
        <span />
        <span />
      </div>
      <section className="search-row">
        <label className="search">
          <Icon name="search" />
          <input placeholder="Tìm bài hát, nghệ sĩ hoặc độ khó..." />
          <kbd>Ctrl K</kbd>
        </label>
        <button className="bow-button secondary">
          <Bow />
          Thêm bài <span>(+)</span>
        </button>
      </section>
      <section className="select-content">
        <div className="song-focus">
          <div className="eyebrow">ĐANG CHỌN</div>
          <Cover />
          <div className="song-title">
            <h1>{song.title}</h1>
            <p>{song.artist}</p>
          </div>
          <div className="song-stats">
            <span>
              <small>BPM</small>
              <b>{song.bpm}</b>
            </span>
            <i />
            <span>
              <small>THỜI LƯỢNG</small>
              <b>2:34</b>
            </span>
            <i />
            <span>
              <small>ĐÁNH GIÁ</small>
              <b className="stars">★★★★★</b>
            </span>
          </div>
        </div>
        <div className="beatmaps">
          <div className="list-heading">
            <div>
              <span>BEATMAP</span>
              <h2>Chọn độ khó</h2>
            </div>
            <span>{maps.length} bản đồ</span>
          </div>
          <div className="map-list">
            {maps.map((map, i) => (
              <button
                key={map.title}
                onClick={() => setSelected(i)}
                className={`map-card ${i === selected ? "selected" : ""}`}
              >
                <span className="map-index">0{i + 1}</span>
                <span
                  className="map-art"
                  style={{ "--map-color": map.color } as React.CSSProperties}
                >
                  <Bow />
                </span>
                <span className="map-main">
                  <b>{map.level}</b>
                  <small>
                    {map.title} · {map.artist}
                  </small>
                </span>
                <span className="map-bpm">
                  <small>BPM</small>
                  {map.bpm}
                </span>
                <span className="difficulty">
                  <b>★ {map.stars}</b>
                  <small>{i < 2 ? "Khó" : "Chuyên gia"}</small>
                </span>
              </button>
            ))}
          </div>
          <div className="best-score">
            <span className="mini-avatar">
              <Bunny />
            </span>
            <span>
              <small>KỶ LỤC CÁ NHÂN</small>
              <b>9,842,150</b>
            </span>
            <span>
              <small>ĐỘ CHÍNH XÁC</small>
              <b>98.72%</b>
            </span>
            <strong>S</strong>
          </div>
        </div>
      </section>
      <footer className="action-bar">
        <button className="plain-action">
          <Icon name="back" />
          Quay lại
        </button>
        <button className="plain-action">
          <Icon name="shuffle" />
          Ngẫu nhiên
        </button>
        <div className="now-playing">
          <span className="equalizer">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>
            <small>SẴN SÀNG</small>
            {song.level} · {song.stars}★
          </span>
        </div>
        <button className="play-button" onClick={onPlay}>
          <Bow />
          CHƠI NGAY
          <Icon name="play" />
        </button>
      </footer>
    </main>
  );
}

const targetPoints = [
  [150, 48],
  [225, 92],
  [300, 136],
  [339, 207],
  [300, 280],
  [260, 350],
  [175, 350],
  [95, 350],
  [55, 280],
];
const targetLabels = ["4·5", "6·7", "8·9", "R", "F", "V", "I", "J", "N"];

function GameScreen({ onPause, onFinish }: { onPause: () => void; onFinish: () => void }) {
  return (
    <main className="game-screen screen">
      <div className="game-blur one" />
      <div className="game-blur two" />
      <div className="progress-bar">
        <span />
        <i style={{ left: "64%" }}>
          <Bow />
        </i>
      </div>
      <div className="game-song">
        <Cover compact />
        <div>
          <small>ĐANG CHƠI</small>
          <h2>Bunny Hop</h2>
          <p>Mimi feat. Lune · Kẹo Ngọt</p>
        </div>
      </div>
      <button className="pause-trigger" onClick={onPause}>
        <span />
        <span />
      </button>
      <div className="score">
        <small>ĐIỂM SỐ</small>
        <strong>
          09<span>842</span>150
        </strong>
        <div className="accuracy">
          <svg viewBox="0 0 60 60">
            <circle cx="30" cy="30" r="25" />
            <circle className="progress" cx="30" cy="30" r="25" />
          </svg>
          <span>
            <b>98.72</b>%
          </span>
        </div>
      </div>
      <div className="game-board">
        <svg viewBox="0 0 400 420">
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="7" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path
            className="triangle-guide outer"
            d="M45 74 Q30 45 65 45 H335 Q370 45 353 76 L224 371 Q200 405 176 371Z"
          />
          <path className="triangle-guide inner" d="M71 74 H329 L200 365Z" />
          {targetPoints.map(([x, y], i) => (
            <g key={i} className={`target t${i}`} transform={`translate(${x} ${y})`}>
              <circle r="25" />
              <circle r="15" />
              <text y="5">{targetLabels[i]}</text>
            </g>
          ))}
          {[
            [58, 60],
            [342, 60],
            [200, 376],
          ].map(([x, y], i) => (
            <path
              key={i}
              className="hex"
              transform={`translate(${x} ${y})`}
              d="M0-17 15-8 15 8 0 17-15 8-15-8Z"
            />
          ))}
          <g className="game-note bubble" transform="translate(223 128)">
            <circle r="18" />
            <circle className="shine" cx="-6" cy="-6" r="4" />
          </g>
          <g className="game-note yellow" transform="translate(274 183)">
            <circle r="16" />
            <path d="m-6 0 4 4 9-10" />
          </g>
          <g className="hold-note" transform="translate(119 203) rotate(57)">
            <rect x="-12" y="-48" width="24" height="96" rx="12" />
            <circle cy="38" r="15" />
          </g>
          <g className="game-note break" transform="translate(239 328)">
            <circle r="17" />
            <path d="m-6-8 5 6-4 3 7 8" />
          </g>
          <g className="game-note star" transform="translate(102 305)">
            <path d="M0-19 5-7 18-6 8 3 11 16 0 9-11 16-8 3-18-6-5-7Z" />
          </g>
        </svg>
        <Bow className="center-bow" />
      </div>
      <div className="combo">
        <strong>
          245<span>x</span>
        </strong>
        <small>COMBO</small>
      </div>
      <div className="judgement">PERFECT!</div>
      <button className="finish-test" onClick={onFinish}>
        Kết thúc bài
      </button>
    </main>
  );
}

function ResultScreen({ onSelect, onReplay }: { onSelect: () => void; onReplay: () => void }) {
  return (
    <main className="result-screen screen">
      <div className="result-head">
        <div>
          <span className="eyebrow">KẾT QUẢ</span>
          <h1>Tuyệt vời!</h1>
          <p>Bạn vừa lập một kỷ lục cá nhân mới.</p>
        </div>
        <div className="result-song">
          <Cover compact />
          <span>
            <b>Bunny Hop</b>
            <small>Mimi feat. Lune · Kẹo Ngọt</small>
          </span>
        </div>
      </div>
      <div className="result-grid">
        <section className="rank-panel card">
          <div className="rank-burst">
            <span>S</span>
          </div>
          <Bunny mood="cheer" className="cheer-bunny" />
          <Bow className="rank-bow" />
          <div className="score-big">
            <small>ĐIỂM SỐ</small>
            <strong>9,842,150</strong>
            <span>KỶ LỤC MỚI!</span>
          </div>
          <div className="accuracy-big">
            <span>
              98.72<small>%</small>
            </span>
            <p>Độ chính xác</p>
          </div>
        </section>
        <section className="stats-column">
          <div className="pp-card card">
            <div>
              <small>PERFORMANCE</small>
              <strong>
                +124 <span>PP</span>
              </strong>
              <p>
                Tổng PP: 8,420 → <b>8,544</b>
              </p>
            </div>
            <div className="pp-ring">
              124<small>PP</small>
            </div>
          </div>
          <div className="judgements card">
            <div className="card-title">
              <span>CHI TIẾT</span>
              <h3>Phán định</h3>
            </div>
            <div className="judge-grid">
              <span>
                <i className="perfect" />
                PERFECT<b>1,245</b>
              </span>
              <span>
                <i className="great" />
                GREAT<b>86</b>
              </span>
              <span>
                <i className="good" />
                GOOD<b>12</b>
              </span>
              <span>
                <i className="miss" />
                MISS<b>2</b>
              </span>
              <span>
                <i className="combo-dot" />
                MAX COMBO<b>845x</b>
              </span>
              <span>
                <i className="star-dot" />
                BONUS<b>24,500</b>
              </span>
            </div>
          </div>
          <div className="histogram card">
            <div className="hist-head">
              <span>
                <small>ĐỘ LỆCH TRUNG BÌNH</small>
                <b>-2.4ms</b>
              </span>
              <span>
                <small>ĐỘ ỔN ĐỊNH</small>
                <b>18.6ms</b>
              </span>
            </div>
            <div className="chart">
              {[18, 25, 32, 46, 64, 78, 94, 100, 82, 70, 53, 38, 27, 18, 12].map((h, i) => (
                <i key={i} style={{ height: `${h}%` }} />
              ))}
              <span className="zero" />
            </div>
            <div className="axis">
              <span>-100ms</span>
              <b>0</b>
              <span>+100ms</span>
            </div>
          </div>
        </section>
      </div>
      <footer className="result-actions">
        <button onClick={onSelect}>
          <Icon name="music" />
          Chọn bài hát
        </button>
        <button>
          <Icon name="play" />
          Xem lại
        </button>
        <button className="primary" onClick={onReplay}>
          <Bow />
          Chơi lại
        </button>
      </footer>
    </main>
  );
}

const players = [
  ["MochiMochi", "12,840", "98,421,500", "4,281"],
  ["PinkPaws", "11,925", "91,037,240", "3,864"],
  ["LunaRibbon", "10,768", "84,592,110", "3,210"],
  ["neko_beat", "9,842", "78,120,450", "2,958"],
  ["bunnyhop", "8,544", "65,842,150", "2,345"],
  ["SakuraMint", "7,960", "59,491,820", "2,124"],
];

function Leaderboard() {
  const [tab, setTab] = useState("pp");
  return (
    <main className="leader-screen screen">
      <header className="page-heading">
        <span className="eyebrow">CỘNG ĐỒNG</span>
        <h1>Bảng xếp hạng</h1>
        <p>Những nhịp tim rực rỡ nhất tuần này.</p>
      </header>
      <div className="leader-card card">
        <div className="tabs">
          <button className={tab === "pp" ? "active" : ""} onClick={() => setTab("pp")}>
            Performance (PP)
          </button>
          <button className={tab === "score" ? "active" : ""} onClick={() => setTab("score")}>
            Score
          </button>
        </div>
        <div className="season">
          <span>MÙA 08</span>
          <b>Sweet Melody</b>
          <small>Còn 12 ngày</small>
        </div>
        <div className="table-head">
          <span>HẠNG</span>
          <span>NGƯỜI CHƠI</span>
          <span>PP</span>
          <span>SCORE</span>
          <span>LƯỢT CHƠI</span>
        </div>
        {players.map((p, i) => (
          <div
            className={`player-row ${i < 3 ? `podium top-${i + 1}` : ""} ${i === 4 ? "me" : ""}`}
            key={p[0]}
          >
            <span className="rank">
              {i < 3 ? <Bow /> : null}
              <b>{i + 1}</b>
            </span>
            <span className="player">
              <i style={{ background: `hsl(${335 + i * 15} 80% ${86 - i * 2}%)` }}>
                <Bunny />
              </i>
              <span>
                <b>
                  {p[0]}
                  {i === 4 && <em>BẠN</em>}
                </b>
                <small>Việt Nam</small>
              </span>
            </span>
            <strong>{tab === "pp" ? p[1] : p[2]}</strong>
            <span>{p[2]}</span>
            <span>{p[3]}</span>
          </div>
        ))}
      </div>
    </main>
  );
}

function BunnyMedal({ rank }: { rank: "S" | "A" | "B" }) {
  return (
    <div className={`bunny-medal rank-${rank.toLowerCase()}`}>
      <i />
      <i />
      <span>{rank}</span>
      <Bow />
    </div>
  );
}

function UIKit() {
  return (
    <main className="kit-screen screen">
      <header className="page-heading">
        <span className="eyebrow">THƯ VIỆN THIẾT KẾ</span>
        <h1>TRIARHYTHM UI Kit</h1>
        <p>Các thành phần mềm mại, vui tươi và sẵn sàng tái sử dụng.</p>
      </header>
      <div className="kit-grid">
        <section className="kit-card card">
          <div className="kit-title">
            <span>01</span>
            <div>
              <small>THÀNH PHẦN</small>
              <h2>Nút bấm</h2>
            </div>
          </div>
          <div className="button-showcase">
            <button className="kit-primary">
              <Bow />
              Nút chính
            </button>
            <button className="kit-secondary">Nút phụ</button>
            <button className="kit-soft">
              <Icon name="play" />
              Có biểu tượng
            </button>
            <button className="round-btn">
              <Icon name="gear" />
            </button>
          </div>
        </section>
        <section className="kit-card card">
          <div className="kit-title">
            <span>02</span>
            <div>
              <small>ĐIỀU HƯỚNG</small>
              <h2>Tabs</h2>
            </div>
          </div>
          <div className="tabs kit-tabs">
            <button className="active">Gameplay</button>
            <button>Audio</button>
            <button>Graphics</button>
          </div>
          <div className="mini-nav">
            <button className="active">
              <Icon name="music" /> Bài hát
            </button>
            <button>
              <Icon name="trophy" /> Xếp hạng
            </button>
          </div>
        </section>
        <section className="kit-card card">
          <div className="kit-title">
            <span>03</span>
            <div>
              <small>ĐIỀU KHIỂN</small>
              <h2>Toggle & Slider</h2>
            </div>
          </div>
          <Toggle label="Ray Guides" sub="Hiện đường dẫn đến mục tiêu" initial />
          <Toggle label="Key Overlay" sub="Hiện phím bấm" />
          <label className="kit-slider">
            <span>
              <b>Note Speed</b>
              <output>8.5</output>
            </span>
            <input type="range" min="1" max="10" step=".5" defaultValue="8.5" />
          </label>
        </section>
        <section className="kit-card medals-card card">
          <div className="kit-title">
            <span>04</span>
            <div>
              <small>THÀNH TÍCH</small>
              <h2>Huy chương tai thỏ</h2>
            </div>
          </div>
          <div className="medals">
            <BunnyMedal rank="S" />
            <BunnyMedal rank="A" />
            <BunnyMedal rank="B" />
          </div>
        </section>
        <section className="kit-card palette-card card">
          <div className="kit-title">
            <span>05</span>
            <div>
              <small>NỀN TẢNG</small>
              <h2>Màu sắc</h2>
            </div>
          </div>
          <div className="swatches">
            {[
              ["#FFFFFF", "Trắng"],
              ["#FFF5F8", "Kem"],
              ["#FFD6E0", "Blush"],
              ["#FF85A2", "Hồng"],
              ["#FF4D80", "Hồng đậm"],
              ["#E8284F", "Đỏ nơ"],
              ["#5B2A47", "Mận"],
            ].map(([hex, name]) => (
              <div key={hex}>
                <i style={{ background: hex }} />
                <b>{name}</b>
                <small>{hex}</small>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Toggle({
  label,
  sub,
  initial = false,
}: {
  label: string;
  sub: string;
  initial?: boolean;
}) {
  const [on, setOn] = useState(initial);
  return (
    <button className="toggle-row" onClick={() => setOn(!on)}>
      <span>
        <b>{label}</b>
        <small>{sub}</small>
      </span>
      <i className={on ? "on" : ""}>
        <u />
      </i>
    </button>
  );
}

function SettingsModal({ close }: { close: () => void }) {
  const [tab, setTab] = useState("Gameplay");
  return (
    <div className="overlay">
      <div className="settings-modal modal-card">
        <aside>
          <div className="modal-brand">
            <Bow />
            <b>
              TRIA<span>RHYTHM</span>
            </b>
          </div>
          <h2>Cài đặt</h2>
          {["General", "Gameplay", "Audio", "Input", "Graphics", "Account"].map((t) => (
            <button className={tab === t ? "active" : ""} onClick={() => setTab(t)} key={t}>
              {t}
            </button>
          ))}
          <small>PHIÊN BẢN 1.0.8</small>
        </aside>
        <section>
          <button className="close" onClick={close}>
            ×
          </button>
          <span className="eyebrow">TÙY CHỈNH</span>
          <h2>{tab}</h2>
          <p>Điều chỉnh trải nghiệm theo nhịp điệu của bạn.</p>
          <div className="setting-group">
            <h3>NHỊP ĐỘ</h3>
            <label>
              <span>
                <b>Note Speed</b>
                <small>Tốc độ di chuyển của nốt nhạc</small>
              </span>
              <output>8.5</output>
              <input type="range" min="1" max="10" step=".5" defaultValue="8.5" />
            </label>
          </div>
          <div className="setting-group">
            <h3>ÂM THANH</h3>
            <label>
              <span>
                <b>Music Volume</b>
                <small>Âm lượng nhạc nền</small>
              </span>
              <output>85%</output>
              <input type="range" defaultValue="85" />
            </label>
            <label>
              <span>
                <b>Audio Offset</b>
                <small>Đồng bộ âm thanh và hình ảnh</small>
              </span>
              <output>-12ms</output>
              <input type="range" defaultValue="44" />
            </label>
          </div>
          <div className="setting-group toggles">
            <h3>HIỂN THỊ TRONG GAME</h3>
            <Toggle label="Ray Guides" sub="Hiện đường dẫn đến mục tiêu" initial />
            <Toggle label="UR Bar" sub="Hiện thanh độ lệch thời gian" initial />
            <Toggle label="Key Overlay" sub="Hiện phím bấm trên màn hình" />
          </div>
          <div className="setting-footer">
            <button onClick={close}>Khôi phục mặc định</button>
            <button className="save" onClick={close}>
              Lưu thay đổi
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function LoginModal({ close }: { close: () => void }) {
  return (
    <div className="overlay">
      <div className="login-modal modal-card">
        <button className="close" onClick={close}>
          ×
        </button>
        <Bunny />
        <Bow className="login-bow" />
        <span className="eyebrow">CHÀO MỪNG TRỞ LẠI</span>
        <h2>Đăng nhập</h2>
        <p>Sẵn sàng bắt nhịp cùng chúng mình chưa?</p>
        <label>
          <span>Tên người dùng hoặc email</span>
          <input placeholder="bunny@example.com" />
        </label>
        <label>
          <span>
            Mật khẩu <a href="#">Quên mật khẩu?</a>
          </span>
          <input type="password" placeholder="••••••••" />
        </label>
        <button className="login-primary">
          <Bow />
          Đăng nhập
        </button>
        <div className="or">
          <span />
          hoặc
          <span />
        </div>
        <button className="google">
          <b>G</b>Tiếp tục với Google
        </button>
        <p className="signup">
          Chưa có tài khoản? <a href="#">Tạo tài khoản</a>
        </p>
      </div>
    </div>
  );
}

function PauseModal({
  close,
  retry,
  leave,
}: {
  close: () => void;
  retry: () => void;
  leave: () => void;
}) {
  return (
    <div className="overlay pause-overlay">
      <div className="pause-modal">
        <Bunny mood="sleepy" />
        <span className="eyebrow">BÀI HÁT ĐANG TẠM DỪNG</span>
        <h2>TẠM DỪNG</h2>
        <p>Bunny Hop · Mimi feat. Lune</p>
        <button className="pause-primary" onClick={close}>
          <Icon name="play" />
          Tiếp tục
        </button>
        <button onClick={retry}>
          <Icon name="shuffle" />
          Chơi lại
        </button>
        <button>
          <Icon name="gear" />
          Cài đặt
        </button>
        <button onClick={leave}>
          <Icon name="back" />
          Chọn bài khác
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("select");
  const [modal, setModal] = useState<Modal>(null);
  return (
    <div className="app-shell">
      {screen !== "game" && <TopNav onModal={setModal} onScreen={setScreen} active={screen} />}
      {screen === "select" && <SongSelect onPlay={() => setScreen("game")} />}
      {screen === "game" && (
        <GameScreen onPause={() => setModal("pause")} onFinish={() => setScreen("result")} />
      )}
      {screen === "result" && (
        <ResultScreen onSelect={() => setScreen("select")} onReplay={() => setScreen("game")} />
      )}
      {screen === "leaderboard" && <Leaderboard />}
      {screen === "kit" && <UIKit />}
      {modal === "settings" && <SettingsModal close={() => setModal(null)} />}
      {modal === "login" && <LoginModal close={() => setModal(null)} />}
      {modal === "pause" && (
        <PauseModal
          close={() => setModal(null)}
          retry={() => setModal(null)}
          leave={() => {
            setModal(null);
            setScreen("select");
          }}
        />
      )}
    </div>
  );
}
