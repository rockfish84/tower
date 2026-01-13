import React, { useEffect, useMemo, useRef, useState } from "react";

// ==============================
// 수식 타워 연습 (요청 반영)
// 1) 수식 입력 중에도 시간은 절대 멈추지 않음
// 2) 정답 후 다음 라운드는 버튼을 눌러 원하는 때 시작
// 3) 숫자 보드(제거/사용 표시) 크기/여백 축소
// ==============================

const BASE_TIME_SEC = 5 * 60;
const NUM_MAX = 100;

const SCORE_THRESHOLDS = [
  { pt: 10, need: 35 },
  { pt: 9, need: 33 },
  { pt: 8, need: 32 },
  { pt: 7, need: 31 },
  { pt: 6, need: 30 },
  { pt: 5, need: 29 },
  { pt: 4, need: 28 },
  { pt: 3, need: 27 },
  { pt: 2, need: 26 },
  { pt: 1, need: 24 },
];

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function computePoints(correct) {
  for (const t of SCORE_THRESHOLDS) {
    if (correct >= t.need) return t.pt;
  }
  return 0;
}

// ---------- Safe expression evaluation (shunting-yard) ----------
const OPS = {
  "+": { prec: 1, assoc: "L", fn: (a, b) => a + b },
  "-": { prec: 1, assoc: "L", fn: (a, b) => a - b },
  "*": { prec: 2, assoc: "L", fn: (a, b) => a * b },
  "/": { prec: 2, assoc: "L", fn: (a, b) => a / b },
};

function tokenize(expr) {
  const tokens = [];
  const s = expr.replace(/\s+/g, "");
  if (!s) return tokens;

  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch >= "0" && ch <= "9") {
      let j = i + 1;
      while (j < s.length && s[j] >= "0" && s[j] <= "9") j++;
      tokens.push({ type: "num", value: Number(s.slice(i, j)) });
      i = j;
      continue;
    }
    if (ch === "(" || ch === ")") {
      tokens.push({ type: "paren", value: ch });
      i++;
      continue;
    }
    if (OPS[ch]) {
      tokens.push({ type: "op", value: ch });
      i++;
      continue;
    }
    throw new Error("허용되지 않는 문자가 포함되어 있어요.");
  }

  // 단항 연산자 방지(예: -5)
  for (let k = 0; k < tokens.length; k++) {
    if (tokens[k].type === "op") {
      const prev = tokens[k - 1];
      if (!prev || prev.type === "op" || (prev.type === "paren" && prev.value === "(")) {
        throw new Error("단항 연산자(예: -5)는 지원하지 않아요. 괄호/표현식을 바꿔주세요.");
      }
    }
  }

  return tokens;
}

function toRPN(tokens) {
  const out = [];
  const stack = [];

  for (const t of tokens) {
    if (t.type === "num") {
      out.push(t);
      continue;
    }
    if (t.type === "op") {
      const o1 = t.value;
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.type !== "op") break;
        const o2 = top.value;
        const p1 = OPS[o1].prec;
        const p2 = OPS[o2].prec;
        if ((OPS[o1].assoc === "L" && p1 <= p2) || (OPS[o1].assoc === "R" && p1 < p2)) {
          out.push(stack.pop());
        } else break;
      }
      stack.push(t);
      continue;
    }
    if (t.type === "paren" && t.value === "(") {
      stack.push(t);
      continue;
    }
    if (t.type === "paren" && t.value === ")") {
      while (
        stack.length &&
        !(stack[stack.length - 1].type === "paren" && stack[stack.length - 1].value === "(")
      ) {
        out.push(stack.pop());
      }
      if (!stack.length) throw new Error("괄호가 맞지 않아요.");
      stack.pop();
      continue;
    }
  }

  while (stack.length) {
    const top = stack.pop();
    if (top.type === "paren") throw new Error("괄호가 맞지 않아요.");
    out.push(top);
  }

  return out;
}

function evalRPN(rpn) {
  const st = [];
  for (const t of rpn) {
    if (t.type === "num") {
      st.push(t.value);
      continue;
    }
    if (t.type === "op") {
      if (st.length < 2) throw new Error("수식이 올바르지 않아요.");
      const b = st.pop();
      const a = st.pop();
      const v = OPS[t.value].fn(a, b);
      if (!Number.isFinite(v)) throw new Error("0으로 나누기 등 유효하지 않은 계산이 있어요.");
      st.push(v);
      continue;
    }
    throw new Error("수식이 올바르지 않아요.");
  }
  if (st.length !== 1) throw new Error("수식이 올바르지 않아요.");
  return st[0];
}

function evalExpression(expr) {
  const tokens = tokenize(expr);
  if (!tokens.length) throw new Error("수식을 입력해주세요.");
  const rpn = toRPN(tokens);
  return evalRPN(rpn);
}

function extractNumbers(expr) {
  const tokens = tokenize(expr);
  return tokens.filter((t) => t.type === "num").map((t) => t.value);
}

// ---------- Game helpers ----------
function makeInitialNumbers() {
  return Array.from({ length: NUM_MAX }, (_, i) => ({ n: i + 1, state: "available" }));
}

function randomAvailableIndex(numbers) {
  const avail = [];
  for (let i = 0; i < numbers.length; i++) if (numbers[i].state === "available") avail.push(i);
  if (!avail.length) return -1;
  return avail[randInt(0, avail.length - 1)];
}

function generateTargets(totalCount = 60) {
  const arr = [];
  for (let i = 1; i <= totalCount; i++) {
    if (i <= 10) arr.push(randInt(700, 1000));
    else if (i <= 20) arr.push(randInt(1300, 2000));
    else arr.push(randInt(1600, 2000));
  }
  return arr;
}

function validateNumbersUsage(expr, numbersState) {
  const usedNums = extractNumbers(expr);
  if (!usedNums.length) throw new Error("숫자를 포함한 수식을 입력해주세요.");

  // 한 수식에서 같은 숫자 2번 금지
  const set = new Set();
  for (const n of usedNums) {
    if (!Number.isInteger(n)) throw new Error("정수만 사용할 수 있어요.");
    if (n < 1 || n > NUM_MAX) throw new Error("사용 가능한 숫자는 1~100이에요.");
    if (set.has(n)) throw new Error("같은 숫자를 한 수식에서 2번 사용할 수 없어요.");
    set.add(n);
  }

  // 아직 available인 숫자만 사용 가능
  const available = new Set(numbersState.filter((x) => x.state === "available").map((x) => x.n));
  for (const n of set) {
    if (!available.has(n)) throw new Error(`이미 제거/사용된 숫자(${n})가 포함되어 있어요.`);
  }

  return Array.from(set);
}

// ==============================
// UI
// ==============================

function Pill({ children }) {
  return (
    <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 text-xs border border-zinc-200">
      {children}
    </span>
  );
}

function Button({ children, onClick, variant = "primary", disabled = false, title }) {
  const base =
    "px-3 py-2 rounded-xl text-sm font-medium transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "bg-zinc-900 text-white hover:bg-zinc-800"
      : variant === "danger"
        ? "bg-red-600 text-white hover:bg-red-500"
        : variant === "ghost"
          ? "bg-transparent border border-zinc-200 text-zinc-800 hover:bg-zinc-50"
          : "bg-zinc-100 text-zinc-900 hover:bg-zinc-200";

  return (
    <button className={`${base} ${styles}`} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  );
}

function NumberTile({ n, state, onClick }) {
  const isAvail = state === "available";
  const isUsed = state === "used";
  const isRemoved = state === "removed";

  // ✅ 더 작게 (한눈에 보기)
  const cls =
    "w-8 h-8 rounded-md border text-[11px] flex items-center justify-center select-none" +
    (isAvail
      ? " bg-white border-zinc-200 hover:bg-zinc-50 cursor-pointer"
      : isUsed
        ? " bg-zinc-200 border-zinc-300 text-zinc-500"
        : " bg-zinc-100 border-zinc-200 text-zinc-400 line-through");

  return (
    <div className={cls} onClick={isAvail ? onClick : undefined}>
      {n}
    </div>
  );
}

export default function App() {
  const [phase, setPhase] = useState("setup"); // setup | play | over
  const [numbers, setNumbers] = useState(makeInitialNumbers);
  const [targets, setTargets] = useState(() => generateTargets(60));
  const [idx, setIdx] = useState(0);

  const [timeLeft, setTimeLeft] = useState(BASE_TIME_SEC);
  const [expr, setExpr] = useState("");
  const [toast, setToast] = useState(null);
  const [correct, setCorrect] = useState(0);

  // ✅ 정답 후 다음 라운드 수동 시작
  const [waitingNext, setWaitingNext] = useState(false);

  const inputRef = useRef(null);

  const currentTarget = targets[idx] ?? null;
  const points = useMemo(() => computePoints(correct), [correct]);

  const availableCount = useMemo(
    () => numbers.reduce((acc, x) => acc + (x.state === "available" ? 1 : 0), 0),
    [numbers]
  );

  const removedCount = useMemo(
    () => numbers.reduce((acc, x) => acc + (x.state === "removed" ? 1 : 0), 0),
    [numbers]
  );

  const usedCount = useMemo(
    () => numbers.reduce((acc, x) => acc + (x.state === "used" ? 1 : 0), 0),
    [numbers]
  );

  // ✅ 타이머는 플레이 중 진행 (입력 중에는 계속 흐르고, 정답 제출 후 다음 라운드 전에는 정지)
  useEffect(() => {
    if (phase !== "play") return;
    if (timeLeft <= 0) return;
    if (waitingNext) return;

    const id = setInterval(() => {
      setTimeLeft((t) => (t <= 0 ? 0 : t - 1));
    }, 1000);

    return () => clearInterval(id);
  }, [phase, timeLeft, waitingNext]);

  useEffect(() => {
    if (phase === "play" && timeLeft <= 0) {
      setPhase("over");
      setWaitingNext(false);
    }
  }, [phase, timeLeft]);

  function resetAll() {
    setPhase("setup");
    setNumbers(makeInitialNumbers());
    setTargets(generateTargets(60));
    setIdx(0);
    setTimeLeft(BASE_TIME_SEC);
    setExpr("");
    setToast(null);
    setCorrect(0);
    setWaitingNext(false);
  }

  function preRemoveRandom() {
    const i = randomAvailableIndex(numbers);
    if (i === -1) {
      setToast("제거할 숫자가 없어요.");
      return;
    }
    const removedN = numbers[i].n;
    setNumbers((prev) => prev.map((x) => (x.n === removedN ? { ...x, state: "removed" } : x)));
    setTimeLeft((t) => t + 30);
    setToast(`랜덤 숫자 ${removedN} 제거 (+30초)`);
  }

  function inGameRemoveRandom() {
    if (phase !== "play") return;
    const i = randomAvailableIndex(numbers);
    if (i === -1) {
      setToast("제거할 숫자가 없어요.");
      return;
    }
    const removedN = numbers[i].n;
    setNumbers((prev) => prev.map((x) => (x.n === removedN ? { ...x, state: "removed" } : x)));
    setTimeLeft((t) => t + 20);
    setToast(`랜덤 숫자 ${removedN} 제거 (+20초)`);
  }

  function startGame() {
    setPhase("play");
    setExpr("");
    setToast("게임 시작!");
    setWaitingNext(false);
    setTimeout(() => inputRef.current?.focus?.(), 0);
  }

  function startNextRound() {
    if (idx + 1 >= targets.length) {
      setPhase("over");
      setWaitingNext(false);
      return;
    }
    setIdx((i) => i + 1);
    setExpr("");
    setWaitingNext(false);
    setToast("다음 라운드 시작!");
    setTimeout(() => inputRef.current?.focus?.(), 0);
  }

  function appendToken(token) {
    setExpr((e) => (e + token).replace(/\s+/g, ""));
    inputRef.current?.focus?.();
  }

  function backspace() {
    setExpr((e) => e.slice(0, -1));
    inputRef.current?.focus?.();
  }

  function clearExpr() {
    setExpr("");
    inputRef.current?.focus?.();
  }

  function submit() {
    if (phase !== "play") return;
    if (waitingNext) {
      setToast("다음 라운드를 시작한 뒤 제출할 수 있어요.");
      return;
    }
    if (currentTarget == null) return;

    try {
      const usedNums = validateNumbersUsage(expr, numbers);
      const value = evalExpression(expr);
      const ok = Math.abs(value - currentTarget) < 1e-9;

      if (!ok) {
        setTimeLeft((t) => clamp(t - 20, 0, 10 ** 9));
        setToast(`오답 (-20초). 계산값: ${Number.isInteger(value) ? value : value.toFixed(6)}`);
        setExpr("");
        return;
      }

      setNumbers((prev) => prev.map((x) => (usedNums.includes(x.n) ? { ...x, state: "used" } : x)));
      setCorrect((c) => c + 1);
      setToast(`정답! 사용 숫자 제거: ${usedNums.sort((a, b) => a - b).join(", ")}`);
      setExpr("");
      setWaitingNext(true);
    } catch (e) {
      setToast(e?.message || "수식이 올바르지 않아요.");
    }
  }

  const tileClick = (n) => {
    if (phase !== "play") return;
    if (waitingNext) return;

    const last = expr.slice(-1);
    if (last && /[0-9)]/.test(last)) {
      setToast("숫자 사이에 연산자를 넣어주세요.");
      return;
    }
    appendToken(String(n));
  };

  const keypad = [
    ["(", ")", "÷", "×"],
    ["+", "-", "⌫", "C"],
  ];

  function handleKey(btn) {
    if (waitingNext) return;
    if (btn === "×") return appendToken("*");
    if (btn === "÷") return appendToken("/");
    if (btn === "⌫") return backspace();
    if (btn === "C") return clearExpr();
    return appendToken(btn);
  }

  const headerBadges = (
    <div className="flex flex-wrap items-center gap-2">
      <Pill>남은 시간: {formatTime(timeLeft)}</Pill>
      <Pill>정답: {correct}</Pill>
      <Pill>점수: {points}pt</Pill>
      <Pill>남은 숫자: {availableCount}</Pill>
      <Pill>사용: {usedCount}</Pill>
      <Pill>제거: {removedCount}</Pill>
      {waitingNext && <Pill>다음 라운드 대기</Pill>}
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">수식 타워 연습</h1>
            <p className="text-sm text-zinc-600 mt-1">
              입력/생각 중에도 시간은 계속 흐름. 정답 제출 후에는 시간이 멈추고, "다음 라운드 시작"을 눌러 재개.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={resetAll}>
              새 게임
            </Button>
            {phase === "play" && (
              <Button variant="danger" onClick={() => setPhase("over")}>
                종료
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 p-4 bg-white rounded-2xl border border-zinc-200 shadow-sm">
          {headerBadges}
          {toast && <div className="mt-2 text-sm text-zinc-800">• {toast}</div>}
        </div>

        {phase === "setup" && (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 p-4 bg-white rounded-2xl border border-zinc-200 shadow-sm">
              <h2 className="text-lg font-semibold">시작 전 준비</h2>
              <p className="text-sm text-zinc-600 mt-1">
                시작 전에 랜덤 숫자를 제거할 수 있어요. (무제한, 1개당 +30초)
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={preRemoveRandom} variant="secondary">
                  랜덤 제거 (+30초)
                </Button>
                <Button onClick={startGame}>게임 시작</Button>
              </div>

              <div className="mt-4 text-sm text-zinc-700">
                • 문제는 시작 전에 미리 랜덤으로 생성됨 (총 {targets.length}문제)
                <br />• Q1~5: 100~999 / Q6~20: 100~2000 / Q21~: 1000~2000
              </div>
            </div>

            <div className="p-3 bg-white rounded-2xl border border-zinc-200 shadow-sm">
              <h2 className="text-lg font-semibold">숫자 보드</h2>
              <p className="text-xs text-zinc-600 mt-1">회색=사용, 취소선=제거</p>
              <div className="mt-3 grid grid-cols-10 gap-1">
                {numbers.map((x) => (
                  <NumberTile key={x.n} n={x.n} state={x.state} />
                ))}
              </div>
            </div>
          </div>
        )}

        {phase === "play" && (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 p-4 bg-white rounded-2xl border border-zinc-200 shadow-sm">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm text-zinc-600">문제</div>
                  <div className="text-2xl font-semibold">
                    {idx + 1} / {targets.length}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-zinc-600">목표</div>
                  <div className="text-3xl font-bold">
                    {waitingNext ? "클리어!" : currentTarget}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={inGameRemoveRandom}
                    title="진행 중 랜덤 숫자 1개 제거 (+20초)"
                  >
                    랜덤 제거 (+20초)
                  </Button>
                  <Button onClick={startNextRound} disabled={!waitingNext}>
                    다음 라운드 시작
                  </Button>
                </div>
              </div>

              <div className="mt-5 p-3 rounded-xl border border-zinc-200 bg-zinc-50">
                <div className="text-sm text-zinc-600 mb-2">수식 입력</div>
                <input
                  ref={inputRef}
                  value={expr}
                  onChange={(e) => setExpr(e.target.value.replace(/\s+/g, ""))}
                  placeholder={waitingNext ? "다음 라운드를 시작하세요" : "예: 25*40+4"}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-300 disabled:bg-zinc-100"
                  disabled={waitingNext}
                />

                <div className="mt-3 flex flex-wrap gap-2 items-center">
                  <Button onClick={submit} disabled={waitingNext}>
                    제출
                  </Button>
                  <Button variant="ghost" onClick={clearExpr} disabled={waitingNext}>
                    지우기
                  </Button>
                  <Button variant="ghost" onClick={backspace} disabled={waitingNext}>
                    한 글자 삭제
                  </Button>
                </div>

                <div className="mt-3 grid grid-cols-4 gap-2 max-w-sm">
                  {keypad.flat().map((k) => (
                    <button
                      key={k}
                      onClick={() => handleKey(k)}
                      disabled={waitingNext}
                      className="px-3 py-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-sm disabled:opacity-50"
                    >
                      {k}
                    </button>
                  ))}
                </div>

                <div className="mt-3 text-xs text-zinc-600">
                  • 입력 중에는 타이머가 계속 진행해.

                  • 정답 제출 후(다음 라운드 대기 상태)에는 타이머가 멈춰.
                  <br />• 정답 후엔 "다음 라운드 시작"을 눌러야 다음 목표가 나와.
                </div>
              </div>
            </div>

            <div className="p-3 bg-white rounded-2xl border border-zinc-200 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">숫자 보드</h2>
                <Pill>클릭 입력</Pill>
              </div>
              <p className="text-xs text-zinc-600 mt-1">회색=사용, 취소선=제거</p>
              <div className="mt-3 grid grid-cols-10 gap-1">
                {numbers.map((x) => (
                  <NumberTile key={x.n} n={x.n} state={x.state} onClick={() => tileClick(x.n)} />
                ))}
              </div>
            </div>
          </div>
        )}

        {phase === "over" && (
          <div className="mt-6 p-5 bg-white rounded-2xl border border-zinc-200 shadow-sm">
            <h2 className="text-xl font-semibold">게임 종료</h2>
            <div className="mt-2 text-sm text-zinc-700">
              정답 {correct}개 · 점수 {points}pt · 남은 시간 {formatTime(timeLeft)}
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={resetAll}>다시 시작</Button>
            </div>

            <div className="mt-4 text-sm text-zinc-600">
              점수 기준: 1pt=24, 2pt=26, 3pt=27, 4pt=28, 5pt=29, 6pt=30, 7pt=31, 8pt=32, 9pt=33,
              10pt=35
            </div>
          </div>
        )}

        <div className="mt-8 text-xs text-zinc-500">
          팁: 오답은 -20초이니, 나눗셈은 정확히 나누어떨어질 때만 쓰는 게 안전해.
        </div>
      </div>
    </div>
  );
}
