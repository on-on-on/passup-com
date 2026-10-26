(function () {
  "use strict";
  var CFG = window.PASSUP_CONFIG || {};
  var app = document.getElementById("app");
  var DATA = null, BY_ID = {}, BY_GROUP = {}, TOPIC = {}, ORDER = {};
  var CIRC = ["①", "②", "③", "④"];
  var P = "pcom."; // 저장 키 앞머리(회계 패스업과 섞이지 않게)
  // 종목: 과목별 20문항, 과목당 40점 이상·평균 60점 이상 합격
  var SUBJ = {
    c1: { name: "컴활 1급", lv: 1, areas: ["컴퓨터 일반", "스프레드시트", "데이터베이스"], per: 20, min: 60 },
    c2: { name: "컴활 2급", lv: 2, areas: ["컴퓨터 일반", "스프레드시트"], per: 20, min: 40 }
  };
  var AREA_SHORT = { "컴퓨터 일반": "컴일", "스프레드시트": "스프", "데이터베이스": "DB" };
  var MAX_NOTE_SET = 15, DRILL_N = 15, MIX_N = 20;
  var S = { screen: "home", stack: [], session: null };

  // ---------- 저장소(실패해도 동작) ----------
  function sget(store, k) { try { return JSON.parse(window[store].getItem(P + k)); } catch (e) { return null; } }
  function sset(store, k, v) { try { window[store].setItem(P + k, JSON.stringify(v)); } catch (e) {} }
  function sdel(store, k) { try { window[store].removeItem(P + k); } catch (e) {} }
  S.subj = (function () { var v = sget("localStorage", "subj"); return SUBJ[v] ? v : "c2"; })();
  function SB() { return SUBJ[S.subj]; }
  // 출제기준: 2026(올해 유형) / 2027(신유형). config.oldEnd 다음 날부터 올해 유형은 숨김
  var STD = { "2026": { name: "올해 유형", sub: "~2026년 시험" }, "2027": { name: "신유형", sub: "2027년~ 시험" } };
  function oldOpen() {
    if (!CFG.oldEnd) return true;
    var p = String(CFG.oldEnd).split("-"), end = new Date(+p[0], +p[1] - 1, +p[2], 23, 59, 59);
    return new Date() <= end;
  }
  S.std = (function () { var v = sget("localStorage", "std"); return oldOpen() && v === "2026" ? "2026" : "2027"; })();
  function K() { return S.subj + "." + S.std; }
  function inStd(o) { return !o.std || o.std.indexOf(S.std) >= 0; }
  // 기준별로 다른 값: t.nameBy["2027"] 처럼 두면 그 기준에서만 바뀜
  function fld(o, k) { var b = o[k + "By"]; return b && b[S.std] !== undefined ? b[S.std] : o[k]; }

  // ---------- 유틸 ----------
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function inl(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/==(.+?)==/g, "<mark>$1</mark>").replace(/`(.+?)`/g, "<code>$1</code>"); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function mmss(sec) { sec = Math.max(0, Math.floor(sec)); var m = Math.floor(sec / 60), s = sec % 60; return m + ":" + (s < 10 ? "0" : "") + s; }
  function bind(id, fn) { var el = document.getElementById(id); if (el) el.onclick = fn; }
  function bar(html) { return '<div class="bar"><div class="in">' + html + "</div></div>"; }
  function inLv(o) { return (!o.lv || o.lv.indexOf(SB().lv) >= 0) && inStd(o); }
  function topics() { return DATA.topics.filter(function (t) { return inLv(t) && SB().areas.indexOf(t.area) >= 0; }); }
  function questions() { return DATA.questions.filter(function (q) { return TOPIC[q.t] && inLv(TOPIC[q.t]) && inLv(q) && SB().areas.indexOf(TOPIC[q.t].area) >= 0; }); }
  function qOfTopic(code) { return questions().filter(function (q) { return q.t === code; }); }
  function areaOf(q) { return TOPIC[q.t] ? TOPIC[q.t].area : ""; }
  function topicName(code) { return TOPIC[code] ? fld(TOPIC[code], "name") : code; }
  function topicOrder(q) { return ORDER[q.t] == null ? 999 : ORDER[q.t]; }
  function hasTheory(code) { return !!(TOPIC[code] && fld(TOPIC[code], "theory")); }

  // ---------- 이론 학습 완료 표시(이 기기에만) ----------
  function readMap() { var r = sget("localStorage", "read." + S.std); return r && typeof r === "object" ? r : {}; }
  function setRead(code, on) { var r = readMap(); if (on) r[code] = Date.now(); else delete r[code]; sset("localStorage", "read." + S.std, r); }

  // ---------- 오답노트(이 기기에만, 종목별) ----------
  function notes() { var w = sget("localStorage", "wrong." + K()); return w && typeof w === "object" ? w : {}; }
  function noteIds() { var w = notes(), ok = {}; questions().forEach(function (q) { ok[q.id] = 1; }); return Object.keys(w).filter(function (id) { return ok[id]; }); }
  function addNote(id) { var w = notes(); if (!w[id]) w[id] = { at: Date.now() }; sset("localStorage", "wrong." + K(), w); }
  function delNote(id) { var w = notes(); if (w[id]) { delete w[id]; sset("localStorage", "wrong." + K(), w); } }

  // ---------- 입장 코드 ----------
  function checkAccess() {
    var code = String(CFG.accessCode || "");
    if (!code) return true;
    var params = new URLSearchParams(location.search), given = params.get("code");
    if (given !== null) {
      params.delete("code");
      var rest = params.toString();
      try { history.replaceState(null, "", location.pathname + (rest ? "?" + rest : "") + location.hash); } catch (e) {}
      if (given === code) { sset("localStorage", "code", code); return true; }
    }
    return sget("localStorage", "code") === code;
  }
  function renderGate(errMsg) {
    app.innerHTML =
      '<div class="gate" style="padding-top:12vh">' + logoHtml() +
      '<h1 style="margin-top:24px">입장 코드를 입력하세요</h1>' +
      '<input id="code" class="input" inputmode="numeric" autocomplete="off" maxlength="12" aria-label="입장 코드">' +
      (errMsg ? '<div class="err" role="alert">' + esc(errMsg) + "</div>" : "") +
      '<div style="margin-top:14px"><button class="btn primary" style="width:100%" id="go">입장</button></div>' + noticeHtml() + "</div>";
    var inp = document.getElementById("code");
    function go() {
      var v = inp.value.trim();
      if (!v) { renderGate("코드를 입력하세요."); return; }
      if (v === String(CFG.accessCode)) { sset("localStorage", "code", v); start(); }
      else renderGate("코드가 맞지 않습니다. 다시 확인해 주세요.");
    }
    bind("go", go);
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
    inp.focus();
  }

  // ---------- 공통 조각 ----------
  function logoHtml() {
    return '<div class="logo"><picture><source srcset="logo-w.png" media="(prefers-color-scheme: dark)"><img src="logo.png" alt="PASS UP"></picture>' +
      '<span class="tag">컴활 필기</span>' + (CFG.byline ? '<span class="by">' + esc(CFG.byline) + "</span>" : "") + "</div>";
  }
  function noticeHtml() { return CFG.notice ? '<p class="foot">' + esc(CFG.notice) + "</p>" : ""; }
  function backTop(label) { return '<div class="top"><button class="iconbtn" id="back" style="margin-left:-10px">‹ ' + esc(label || "처음") + "</button><div></div></div>"; }

  // ---------- 오류 신고 ----------
  function reported() { var r = sget("localStorage", "reported"); return r && typeof r === "object" ? r : {}; }
  function reportBtn(q) {
    if (!CFG.reportPost && !CFG.reportFormUrl) return "";
    var done = reported()[q.id];
    return '<button class="rep' + (done ? " done" : "") + '" data-rep="' + esc(q.id) + '">' + (done ? "신고함" : "오류 신고") + "</button>";
  }
  function bindReports() { app.querySelectorAll("[data-rep]").forEach(function (b) { b.onclick = function () { openReport(BY_ID[b.getAttribute("data-rep")]); }; }); }
  function toast(msg) {
    var t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600);
  }
  function openReport(q) {
    var R = CFG.reportPost, subj = SB().name;
    if (!R) { window.open((CFG.reportFormUrl || "").replace("{id}", encodeURIComponent(q.id)).replace("{subject}", encodeURIComponent(subj)), "_blank", "noopener"); return; }
    var old = document.getElementById("rep-bg"); if (old) old.remove();
    var bg = document.createElement("div"); bg.id = "rep-bg"; bg.className = "sheet-bg";
    bg.innerHTML = '<div class="sheet" role="dialog" aria-label="오류 신고"><div class="sheet-h"><b>이 문제 오류 신고</b><span class="sub">' + esc(q.id) + "</span></div>" +
      '<div class="sub" style="margin:2px 0 10px">어떤 오류입니까?</div><div class="chips">' +
      R.types.map(function (t, i) { return '<button data-ty="' + i + '">' + esc(t) + "</button>"; }).join("") + "</div>" +
      '<textarea id="rep-memo" rows="3" maxlength="500" placeholder="자세한 내용 (선택)"></textarea>' +
      '<div class="navrow" style="margin:12px 0 0"><button class="btn" id="rep-x">취소</button><button class="btn primary" id="rep-send" disabled>보내기</button></div></div>';
    document.body.appendChild(bg);
    var picked = -1, send = document.getElementById("rep-send");
    function close() { bg.remove(); }
    bg.onclick = function (e) { if (e.target === bg) close(); };
    bind("rep-x", close);
    bg.querySelectorAll("[data-ty]").forEach(function (b) {
      b.onclick = function () { picked = +b.getAttribute("data-ty"); bg.querySelectorAll("[data-ty]").forEach(function (x) { x.classList.toggle("on", x === b); }); send.disabled = false; };
    });
    send.onclick = function () {
      if (picked < 0) return;
      send.disabled = true; send.textContent = "보내는 중…";
      var body = new URLSearchParams();
      body.append(R.id, q.id); body.append(R.subject, subj); body.append(R.type, R.types[picked]);
      var memo = document.getElementById("rep-memo").value.trim(); if (memo) body.append(R.memo, memo);
      fetch(R.action, { method: "POST", mode: "no-cors", body: body }).then(function () {
        var r = reported(); r[q.id] = Date.now(); sset("localStorage", "reported", r);
        close(); toast("신고가 접수되었습니다. 확인 후 수정하겠습니다.");
        app.querySelectorAll('[data-rep="' + q.id + '"]').forEach(function (b) { b.classList.add("done"); b.textContent = "신고함"; });
      }).catch(function () { send.disabled = false; send.textContent = "다시 보내기"; toast("보내지 못했습니다. 인터넷 연결을 확인해 주세요."); });
    };
  }

  // ---------- 자료(표/텍스트) ----------
  // card: 이론 표(3열 이상)는 휴대폰에서 줄마다 카드처럼 세로로 펼쳐 보여 줌
  function tableHtml(tbl, card) {
    tbl = tbl.filter(function (l) { return !/^[\s|:\-]+$/.test(l); }); // 마크다운 구분선(|---|) 줄은 건너뜀
    var rows = tbl.map(function (l) { return l.replace(/^\s*\||\|\s*$/g, "").split("|").map(function (c) { return c.trim(); }); });
    var hd = rows[0], cc = card && hd.length >= 2, two = cc && hd.length === 2;
    var h = "<tr>" + hd.map(function (c) { return "<th>" + inl(c) + "</th>"; }).join("") + "</tr>";
    var b = rows.slice(1).map(function (r) { return "<tr>" + r.map(function (c, i) { return "<td" + (cc ? ' data-h="' + esc(hd[i] || "") + '"' : "") + ">" + inl(c) + "</td>"; }).join("") + "</tr>"; }).join("");
    return '<div class="tablewrap' + (cc ? " tt" : "") + (two ? " two" : "") + '"><table>' + h + b + "</table></div>";
  }
  function dataHtml(x) {
    if (!x) return "";
    var out = "", buf = [], tbl = [];
    function flushText() { if (buf.length) { out += '<div class="data">' + inl(buf.join("\n")) + "</div>"; buf = []; } }
    function flushTable() { if (tbl.length) { out += tableHtml(tbl); tbl = []; } }
    x.split("\n").forEach(function (l) { if (l.indexOf("|") >= 0) { flushText(); tbl.push(l); } else { flushTable(); if (l.trim()) buf.push(l); } });
    flushTable(); flushText();
    return out;
  }
  // 그림: "img/파일.png" 또는 {src, alt} 또는 그 배열. 누르면 크게 보기
  function imgHtml(v) {
    if (!v) return "";
    return [].concat(v).map(function (o) {
      if (typeof o === "string") o = { src: o };
      var src = /^(https?:|data:)/.test(o.src) ? o.src : "data/" + o.src;
      return '<figure class="qimg"><img src="' + esc(src) + '" alt="' + esc(o.alt || "문제 그림") + '" loading="lazy" data-zoom>' + (o.alt ? "<figcaption>" + esc(o.alt) + "</figcaption>" : "") + "</figure>";
    }).join("");
  }
  document.addEventListener("click", function (e) {
    var im = e.target.closest ? e.target.closest("[data-zoom]") : null; if (!im) return;
    var bg = document.createElement("div"); bg.className = "zoom-bg"; bg.setAttribute("role", "dialog"); bg.setAttribute("aria-label", "그림 크게 보기");
    bg.innerHTML = '<img src="' + esc(im.getAttribute("src")) + '" alt="' + esc(im.alt) + '"><button class="zoom-x" aria-label="닫기">×</button>';
    bg.onclick = function () { bg.remove(); };
    document.body.appendChild(bg);
  });
  // 이론 본문: "## 제목", "- 목록", "> 팁", "| 표 |", **굵게**, `코드`
  function theoryHtml(src) {
    var out = "", ul = [], tbl = [], tip = [], para = [], hn = 0;
    function fl() {
      if (para.length) { out += "<p>" + para.map(inl).join("<br>") + "</p>"; para = []; }
      if (ul.length) { out += "<ul>" + ul.map(function (l) { return "<li>" + inl(l) + "</li>"; }).join("") + "</ul>"; ul = []; }
      if (tbl.length) { out += tableHtml(tbl, true); tbl = []; }
      if (tip.length) {
        // 상자 종류: 첫 줄 제목으로 구분(시험 포인트 → 핵심 / 헷갈리는·함정 → 함정 / 예시 → 예시)
        var k = /함정|헷갈/.test(tip[0]) ? "trap" : /예시|예제/.test(tip[0]) ? "ex" : "key";
        var head = tip[0].match(/^\*\*(.+?)\*\*\s*$/), body = head ? tip.slice(1) : tip;
        out += '<div class="tip ' + k + '"><div class="tip-h">' + (head ? esc(head[1]) : { key: "핵심", trap: "기출 함정", ex: "예시" }[k]) + "</div>" + body.map(function (l) { return /^\s*[-•]\s+/.test(l) ? '<div class="tl">' + inl(l.replace(/^\s*[-•]\s+/, "")) + "</div>" : "<div>" + inl(l) + "</div>"; }).join("") + "</div>"; tip = [];
      }
    }
    String(src).split("\n").forEach(function (l) {
      var t = l.trim();
      if (!t) { fl(); return; }
      if (/^## /.test(t)) { fl(); hn++; out += '<h3 id="sec-' + hn + '"><span class="hno">' + (hn < 10 ? "0" : "") + hn + "</span>" + inl(t.slice(3)) + "</h3>"; return; }
      var im = t.match(/^!\[(.*?)\]\((.+?)\)$/);
      if (im) { fl(); out += imgHtml({ src: im[2], alt: im[1] }); return; }
      if (/^- /.test(t)) { if (tbl.length || tip.length || para.length) fl(); ul.push(t.slice(2)); return; }
      if (/^> ?/.test(t)) { if (tbl.length || ul.length || para.length) fl(); tip.push(t.replace(/^> ?/, "")); return; }
      if (t.charAt(0) === "|") { if (ul.length || tip.length || para.length) fl(); tbl.push(t); return; }
      if (ul.length || tbl.length || tip.length) fl();
      para.push(t);
    });
    fl();
    return out;
  }

  // ---------- 세션 ----------
  // mode: exam(실전 CBT) | practice(단원 학습·섞어 풀기) | note(오답노트)
  function saveSession() { if (S.session) sset("localStorage", "session." + K(), S.session); else sdel("localStorage", "session." + K()); }
  function newSession(mode, title, list, extra) {
    S.session = {
      mode: mode, title: title, idx: 0, elapsed: 0, submitted: false,
      items: list.map(function (x) { return typeof x === "string" ? { id: x, sel: 0 } : { id: x.id, src: x.src, sel: 0 }; })
    };
    if (extra) Object.keys(extra).forEach(function (k) { S.session[k] = extra[k]; });
    saveSession();
    go("quiz");
  }
  // 실전 CBT: 과목당 SB().per문항. 실전 위주 + 심화 15~20%, 기본은 내지 않음(모자랄 때만 채우고 샘플 표시)
  function pickExam() {
    var ids = [], usedG = {}, all = questions(), short = false, per = SB().per, hardN = Math.round(per * 0.175);
    SB().areas.forEach(function (a) {
      var pool = shuffle(all.filter(function (q) { return areaOf(q) === a; })), got = [];
      function take(list, max) { list.forEach(function (q) { var g = q.g || q.id; if (got.length >= max || usedG[g]) return; got.push(q); usedG[g] = 1; }); }
      var hard = pool.filter(function (q) { return q.d === "심화"; }), mid = pool.filter(function (q) { return q.d === "실전"; }), easy = pool.filter(function (q) { return q.d !== "심화" && q.d !== "실전"; });
      take(hard, hardN); take(mid, per); take(hard, per);
      if (got.length < per) { short = true; take(easy, per); }
      got.sort(function (x, y) { return topicOrder(x) - topicOrder(y); });
      got.forEach(function (q) { ids.push(q.id); });
    });
    return { ids: ids, short: short };
  }
  function pickDrill(code) {
    var lv = { "기본": 0, "실전": 1, "심화": 2 };
    return shuffle(qOfTopic(code)).slice(0, DRILL_N).sort(function (a, b) { return (lv[a.d] || 0) - (lv[b.d] || 0); }).map(function (q) { return q.id; });
  }
  function twinOf(id, used) {
    var group = BY_GROUP[BY_ID[id].g] || [];
    var fresh = shuffle(group.filter(function (x) { return x.id !== id && used.indexOf(x.id) < 0 && inLv(x); }));
    return fresh.length ? fresh[0] : null;
  }
  function startNote(similar) {
    var w = notes(), ids = noteIds().sort(function (a, b) { return w[a].at - w[b].at; }).slice(0, MAX_NOTE_SET);
    if (!ids.length) return;
    var used = ids.slice(), out = ids.map(function (id) {
      var nid = id; if (similar) { var t = twinOf(id, used); if (t) { nid = t.id; used.push(nid); } }
      return { id: nid, src: id };
    });
    out.sort(function (a, b) { return topicOrder(BY_ID[a.id]) - topicOrder(BY_ID[b.id]); });
    newSession("note", similar ? "오답노트 · 비슷한 문제" : "오답노트 · 다시 풀기", out);
  }
  function confirmNew() {
    var cur = S.session && !S.session.submitted ? S.session : null;
    return !cur || confirm("풀던 문제가 있습니다. 새로 시작하시겠습니까?");
  }
  function startDrill(code) {
    var ids = pickDrill(code);
    if (!ids.length) { toast("이 단원은 문제를 준비 중입니다."); return; }
    if (confirmNew()) newSession("practice", topicName(code), ids, { topic: code });
  }
  // 과목별 섞어 풀기: 단원 상관없이 과목 전체에서 무작위(같은 개념 묶음은 1문항만)
  function startMix(area) {
    var ids = [], usedG = {};
    shuffle(questions().filter(function (q) { return areaOf(q) === area; })).forEach(function (q) {
      var g = q.g || q.id; if (ids.length >= MIX_N || usedG[g]) return; ids.push(q.id); usedG[g] = 1;
    });
    if (!ids.length) { toast("이 과목은 문제를 준비 중입니다."); return; }
    if (confirmNew()) newSession("practice", area + " 연습", ids, { mix: area });
  }

  // ---------- 화면 전환 ----------
  // push: true(기본, 뒤로 가기 가능) | "replace"(지금 화면을 바꿔치기)
  function go(screen, push) {
    if (push === "replace") { try { history.replaceState({ s: screen }, ""); } catch (e) {} }
    else if (push !== false) { S.stack.push(S.screen); try { history.pushState({ s: screen }, ""); } catch (e) {} }
    S.screen = screen; render(); window.scrollTo(0, 0);
  }
  window.addEventListener("popstate", function () {
    if (S.screen === "quiz" && S.session && !S.session.submitted && S.session.mode === "exam") {
      if (!confirm("시험을 중단하시겠습니까? 처음 화면에서 이어서 풀 수 있습니다.")) { try { history.pushState({ s: "quiz" }, ""); } catch (e) {} return; }
    }
    if (S.screen === "result") { S.session = null; saveSession(); }
    var prev = S.stack.pop() || "home";
    if (prev === "quiz" && (!S.session || S.session.submitted)) prev = S.stack.pop() || "home";
    go(prev, false);
  });

  // ---------- 타이머(실전 CBT: 남은 시간, 화면을 벗어나면 일시정지) ----------
  var tick = null, lastT = 0;
  function limitSec() { return SB().min * 60; }
  function timerOn() {
    timerOff(); lastT = Date.now();
    tick = setInterval(function () {
      if (document.hidden || !S.session || S.session.submitted) { lastT = Date.now(); return; }
      var now = Date.now(); S.session.elapsed += (now - lastT) / 1000; lastT = now;
      var left = limitSec() - S.session.elapsed, el = document.getElementById("timer");
      if (el) { el.textContent = mmss(left); el.parentNode.classList.toggle("low", left <= 300); }
      if (left <= 0) { timerOff(); toast("시험 시간이 끝나 자동으로 제출되었습니다."); finish(); return; }
      if (Math.floor(S.session.elapsed) % 5 === 0) saveSession();
    }, 1000);
  }
  function timerOff() { if (tick) clearInterval(tick); tick = null; }
  document.addEventListener("visibilitychange", function () { lastT = Date.now(); saveSession(); });

  // ---------- 렌더 ----------
  function render() {
    timerOff();
    var f = { home: renderHome, theoryList: renderTheoryList, theory: renderTheory, drill: renderTheoryList, mix: renderMix, note: renderNote, quiz: renderQuiz, result: renderResult, review: renderReview }[S.screen];
    (f || renderHome)();
  }

  function renderHome() {
    var cur = S.session && !S.session.submitted ? S.session : null, nCount = noteIds().length;
    // 학습한 단원 = 이론을 열어 봤거나 문제를 푼 단원(이 기기에 기록이 있을 때만 카드 표시)
    var tp = topics(), rd = readMap(), sc = scoreMap(), done = tp.filter(function (t) { return rd[t.code] || sc[t.code]; }).length, pct = tp.length ? Math.round(done / tp.length * 100) : 0;
    var h = '<div class="top">' + logoHtml() + '<button class="iconbtn" id="fs" aria-label="글자 크기">가' + (document.documentElement.classList.contains("big") ? "-" : "+") + "</button></div>";
    h += '<div class="label" style="margin-top:4px">컴퓨터활용능력</div><div class="seg">' +
      Object.keys(SUBJ).map(function (k) { return '<button data-subj="' + k + '" class="' + (k === S.subj ? "on" : "") + '" aria-pressed="' + (k === S.subj) + '">' + esc(SUBJ[k].name.replace(/^컴활\s*/, "")) + "</button>"; }).join("") + "</div>";
    if (oldOpen()) h += '<div class="label">출제기준</div><div class="seg">' +
      Object.keys(STD).map(function (k) { return '<button data-std="' + k + '" class="' + (k === S.std ? "on" : "") + '" aria-pressed="' + (k === S.std) + '">' + esc(STD[k].name) + "<br><small>" + esc(STD[k].sub) + "</small></button>"; }).join("") + "</div>";
    if (done) h += '<div class="card" style="margin-top:12px"><div class="sub">' + esc(STD[S.std].name) + " · 학습한 단원</div>" +
      '<div class="big-num">' + done + '<span class="sub" style="font-size:.5em"> / ' + tp.length + " 단원</span></div>" +
      '<div class="prog" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + pct + '%"></i></div></div>';
    var lt = lastTheory();
    if (cur) h += '<button class="card menu hero" id="resume"><div class="sub">풀던 문제가 있습니다 · ' + (cur.idx + 1) + " / " + cur.items.length + '번</div><div class="t">' + esc(cur.title) + " 이어서 풀기</div></button>";
    else if (lt) h += '<button class="card menu hero" id="resume-th"><div class="sub">보던 이론이 있습니다</div><div class="t">' + esc(fld(TOPIC[lt.code], "name")) + " 이어서 보기</div></button>";
    h += '<div class="label">학습 순서</div>' +
      step("m-th", 1, "단원 학습", "이론 정리 → 한 문제씩 풀고 바로 정답과 해설") +
      step("m-mix", 2, "과목별 연습", "과목 전체에서 무작위 출제 · 한 문제씩 정답과 해설") +
      step("m-ex", 3, "실전 CBT", SB().areas.length * SB().per + "문항 · " + SB().min + "분 · 실제 시험처럼 한 번에 채점") +
      '<button class="card menu note" id="m-note"><span class="t">오답노트</span><span class="badge' + (nCount ? "" : " zero") + '">' + nCount + "</span></button>";
    if (CFG.resultPost) {
      var mm = me();
      h += '<button class="card menu note" id="m-me" style="margin-top:8px"><span><span class="t" style="display:block">선생님께 결과 보내기</span><span class="sub">' +
        (mm.on && mm.name ? esc(mm.name) + " · 켜짐" : "선택 · 켜면 학습 결과가 선생님께 전달됩니다") + '</span></span><span class="badge' + (mm.on && mm.name ? "" : " zero") + '">' + (mm.on && mm.name ? "ON" : "OFF") + "</span></button>";
    }
    h += noticeHtml();
    app.innerHTML = h;
    bind("fs", function () { var on = document.documentElement.classList.toggle("big"); sset("localStorage", "big", on); renderHome(); });
    bind("resume", function () { go("quiz"); });
    bind("resume-th", function () { S.topic = lt.code; S.theoryY = lt.y; go("theory"); });
    bind("m-th", function () { go("theoryList"); });
    bind("m-ex", function () {
      if (!confirmNew()) return;
      var p = pickExam();
      if (!p.ids.length) { toast("실전 문제를 준비 중입니다."); return; }
      newSession("exam", "실전 CBT", p.ids, { short: p.short });
    });
    bind("m-note", function () { go("note"); });
    bind("m-mix", function () { go("mix"); });
    bind("m-me", openMe);
    app.querySelectorAll("[data-std]").forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute("data-std"); if (k === S.std) return;
        S.std = k; sset("localStorage", "std", k); restoreSession(); renderHome();
      };
    });
    app.querySelectorAll("[data-subj]").forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute("data-subj"); if (k === S.subj) return;
        S.subj = k; sset("localStorage", "subj", k); restoreSession(); renderHome();
      };
    });
  }
  function step(id, no, t, sub) {
    return '<button class="card menu step" id="' + id + '"><span class="no">' + no + '</span><span class="tx"><span class="t" style="display:block">' + esc(t) + '</span><span class="sub">' + esc(sub) + '</span></span><span class="arr" aria-hidden="true">›</span></button>';
  }

  // 단원 학습 목록: 과목 탭 + 단원 줄(학습 체크 · 최근 점수 · [이론] [문제])
  function scoreMap() { var r = sget("localStorage", "score." + K()); return r && typeof r === "object" ? r : {}; }
  function setScore(code, pct) { var r = scoreMap(); r[code] = { p: pct, at: Date.now() }; sset("localStorage", "score." + K(), r); }
  function curArea() { var a = sget("localStorage", "area." + S.subj); return SB().areas.indexOf(a) >= 0 ? a : SB().areas[0]; }
  function topicListHtml() {
    var rd = readMap(), sc = scoreMap(), area = curArea(), cur = S.session && !S.session.submitted ? S.session : null, h = '<div class="atabs" role="tablist">';
    SB().areas.forEach(function (a, i) {
      h += '<button role="tab" data-area="' + esc(a) + '" class="' + (a === area ? "on" : "") + '" aria-selected="' + (a === area) + '"><small>' + (i + 1) + "과목</small>" + esc(a) + "</button>";
    });
    h += "</div>";
    var list = topics().filter(function (t) { return t.area === area; }), nextDone = false;
    h += '<div class="card topics" style="padding:4px 16px">' + list.map(function (t) {
      var th = hasTheory(t.code), n = qOfTopic(t.code).length, live = th || n, nx = "";
      // 진행 상태(이 기기에 기록이 있을 때만): 이론+문제 다 하면 '학습 완료', 하나만 했거나 풀다 말았으면 '학습 중'
      var r = sc[t.code], seen = !!rd[t.code], going = cur && cur.topic === t.code;
      var full = r && (seen || !th), st = "";
      if (full) st = '<span class="stat done"><i aria-hidden="true"></i>학습 완료</span>';
      else if (r || seen || going) st = '<span class="stat ing"><i aria-hidden="true"></i>학습 중</span>';
      if (r) st += '<span class="pts' + (r.p >= 60 ? "" : " ng") + '">' + r.p + "점</span>";
      return '<div class="tp' + (live ? "" : " off") + nx + '"' + (live ? ' data-row="' + t.code + '"' : "") + '><span class="nm">' + esc(fld(t, "name")) + newTag(t) + (st ? '<span class="stline">' + st + "</span>" : "") + "</span>" +
        (live ? '<span class="acts">' + (th ? '<button class="go" data-tp="' + t.code + '">이론</button>' : "") +
          (n ? '<button class="go fill" data-dr="' + t.code + '">문제</button>' : "") + "</span>" : "<small>준비 중</small>") + "</div>";
    }).join("") + "</div>";
    return h;
  }
  function newTag(t) { var g = fld(t, "tag"); return g ? ' <span class="newtag">' + esc(g) + "</span>" : ""; }
  function renderMix() {
    var h = backTop() + "<h1>과목별 연습</h1>" + '<p class="sub" style="margin-top:-6px">과목을 선택하면 단원 구분 없이 무작위로 출제됩니다. 한 문제를 풀 때마다 정답과 해설이 나옵니다.</p>';
    SB().areas.forEach(function (a, i) {
      var n = questions().filter(function (q) { return areaOf(q) === a; }).length;
      h += '<button class="card menu step subj" data-mix="' + esc(a) + '"' + (n ? "" : " disabled") + '><span class="pno">' + (i + 1) + '<small>과목</small></span><span class="tx"><span class="t" style="display:block">' + esc(a) + '</span>' + (n ? "" : '<span class="sub">준비 중</span>') + '</span><span class="arr" aria-hidden="true">›</span></button>';
    });
    app.innerHTML = h;
    bind("back", function () { history.back(); });
    app.querySelectorAll("[data-mix]").forEach(function (x) { x.onclick = function () { startMix(x.getAttribute("data-mix")); }; });
  }
  function renderTheoryList() {
    app.innerHTML = backTop() + "<h1>단원 학습</h1>" + '<p class="sub" style="margin-top:-6px">[이론]으로 정리하고 [문제]로 바로 확인하세요. 한 문제를 풀 때마다 정답과 해설이 나옵니다.</p>' + topicListHtml();
    bind("back", function () { history.back(); });
    app.querySelectorAll("[data-tp]").forEach(function (b) { b.onclick = function () { S.topic = b.getAttribute("data-tp"); go("theory"); }; });
    app.querySelectorAll("[data-dr]").forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); startDrill(b.getAttribute("data-dr")); }; });
    app.querySelectorAll("[data-tp]").forEach(function (b) { var f = b.onclick; b.onclick = function (e) { e.stopPropagation(); f(); }; });
    app.querySelectorAll("[data-area]").forEach(function (b) { b.onclick = function () { sset("localStorage", "area." + S.subj, b.getAttribute("data-area")); renderTheoryList(); }; });
    // 줄 아무 곳이나 누르면: 이론이 있으면 이론, 없으면 문제
    app.querySelectorAll("[data-row]").forEach(function (r) { r.onclick = function () { var c = r.getAttribute("data-row"); if (hasTheory(c)) { S.topic = c; go("theory"); } else startDrill(c); }; });
  }
  function renderTheory() {
    var t = TOPIC[S.topic]; if (!t || !hasTheory(t.code) || !inLv(t)) { go("theoryList", "replace"); return; }
    var n = qOfTopic(t.code).length;
    if (!readMap()[t.code]) setRead(t.code, true); // 이론을 열면 학습한 단원으로 기록
    var no = topics().filter(function (x) { return x.area === t.area; }).indexOf(t) + 1, ai = SB().areas.indexOf(t.area) + 1;
    var fq = +(SB().lv === 1 && t.freq1 != null ? t.freq1 : fld(t, "freq")) || 0, goal = fld(t, "goal"), sum = fld(t, "sum");
    var h = backTop("단원 목록") + '<header class="th-head"><div class="th-sec">' + ai + "과목 · " + esc(t.area) + '</div><div class="th-no">' + no + "단원</div><h1>" + esc(fld(t, "name")) + newTag(t) + "</h1>" +
      (fq ? '<div class="th-freq">출제 빈도 <span aria-label="' + fq + '점 만점 3점">' + "★★★".slice(0, fq) + '<i>' + "★★★".slice(fq) + "</i></span></div>" : "") +
      (goal ? '<p class="th-goal">' + inl(goal) + "</p>" : "") + "</header>" + tocHtml(fld(t, "theory")) +
      '<div class="theory">' + theoryHtml(fld(t, "theory")) + "</div>" +
      (sum ? '<section class="th-sum"><div class="th-sum-h">한 장 요약</div><ol>' + String(sum).split("\n").filter(Boolean).map(function (l) { return "<li>" + inl(l.replace(/^-\s*/, "")) + "</li>"; }).join("") + "</ol></section>" : "");
    app.innerHTML = h + bar(
      (n ? '<button class="btn primary" id="dr">문제 풀기</button>' : '<button class="btn primary" disabled>문제 준비 중</button>'));
    bind("back", function () { history.back(); });
    bind("dr", function () { setLastTheory(null); startDrill(t.code); });
    // 보던 위치 기억(다시 열면 홈에 '이어서 보기')
    setLastTheory(t.code, S.theoryY || 0);
    if (S.theoryY) { var y = S.theoryY; S.theoryY = 0; setTimeout(function () { window.scrollTo(0, y); }, 0); }
  }
  // 목차 칩: 이론의 '## 소제목'으로 만들고, 누르면 그 소제목으로 이동
  function tocHtml(src) {
    var hs = String(src || "").split("\n").filter(function (l) { return /^## /.test(l.trim()); });
    if (hs.length < 3) return "";
    return '<nav class="th-toc" aria-label="목차">' + hs.map(function (l, i) { var n = i + 1; return '<button data-sec="' + n + '"><b>' + (n < 10 ? "0" : "") + n + "</b>" + esc(l.trim().slice(3).replace(/\*\*|==|`/g, "")) + "</button>"; }).join("") + "</nav>";
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-sec]") : null; if (!b) return;
    var h = document.getElementById("sec-" + b.getAttribute("data-sec")); if (h) window.scrollTo({ top: h.getBoundingClientRect().top + window.scrollY - 12, behavior: "smooth" });
  });
  function lastTheory() { var v = sget("localStorage", "lastTh." + K()); return v && TOPIC[v.code] && hasTheory(v.code) && inLv(TOPIC[v.code]) ? v : null; }
  function setLastTheory(code, y) { if (!code) sdel("localStorage", "lastTh." + K()); else sset("localStorage", "lastTh." + K(), { code: code, y: Math.round(y || 0), at: Date.now() }); }
  var thTimer = null;
  window.addEventListener("scroll", function () {
    if (S.screen !== "theory") return;
    clearTimeout(thTimer); thTimer = setTimeout(function () { if (S.screen === "theory") setLastTheory(S.topic, window.scrollY); }, 400);
  }, { passive: true });

  function renderNote() {
    var ids = noteIds(), n = ids.length;
    var h = backTop() + "<h1>오답노트</h1>" + '<p class="sub" style="margin-top:-6px">틀린 문제가 자동으로 모입니다. 오답노트에서 다시 풀어 맞히면 목록에서 빠집니다.</p>';
    if (!n) {
      h += '<div class="card center" style="padding:28px 16px"><div class="t" style="font-weight:700">아직 틀린 문제가 없습니다</div><div class="sub">단원 학습이나 실전 CBT에서 틀린 문제가 여기에 모입니다.</div></div>';
    } else {
      h += '<div class="card"><div class="sub">모인 문제</div><div class="big-num">' + n + '<span class="sub" style="font-size:.5em"> 문항</span></div>' +
        (n > MAX_NOTE_SET ? '<div class="sub">한 번에 오래된 순서대로 ' + MAX_NOTE_SET + "문항씩 풉니다.</div>" : "") + "</div>" +
        '<button class="card menu mode" id="w-same"><div class="t">틀린 문제 다시 풀기</div><div class="sub">같은 문제를 한 번 더</div></button>' +
        '<button class="card menu mode" id="w-sim"><div class="t">비슷한 문제로 풀기</div><div class="sub">같은 개념, 보기가 다른 문제로</div></button>';
      var by = {};
      ids.forEach(function (id) { var q = BY_ID[id], a = areaOf(q); (by[a] = by[a] || {})[q.t] = (by[a][q.t] || 0) + 1; });
      SB().areas.forEach(function (a) {
        if (!by[a]) return;
        h += '<div class="area-title">' + esc(a) + '</div><div class="card wklist">' + Object.keys(by[a]).sort(function (x, y) { return topicOrder({ t: x }) - topicOrder({ t: y }); }).map(function (t) {
          var th = hasTheory(t), nm = topicName(t).replace(/\s*\(.*\)\s*$/, "");
          return (th ? '<button class="wk" data-th="' + t + '">' : '<div class="wk">') + '<span class="wn">' + esc(nm) + '</span><span class="wc">' + by[a][t] + "문항</span>" + (th ? '<span class="chev">›</span></button>' : "</div>");
        }).join("") + "</div>";
      });
      h += '<div class="center"><button class="link" id="w-clear">오답노트 비우기</button></div>';
    }
    h += '<div class="notice">오답노트와 학습 기록은 이 기기에만 저장됩니다. 카카오톡 캐시를 지우거나 휴대폰을 바꾸면 사라질 수 있습니다.</div>';
    app.innerHTML = h;
    bind("back", function () { history.back(); });
    bind("w-same", function () { if (confirmNew()) startNote(false); });
    bind("w-sim", function () { if (confirmNew()) startNote(true); });
    bind("w-clear", function () { if (confirm("오답노트를 모두 지우시겠습니까?")) { sdel("localStorage", "wrong." + K()); renderNote(); } });
    bindTheoryLinks();
  }
  function bindTheoryLinks() { app.querySelectorAll("[data-th]").forEach(function (b) { b.onclick = function () { S.topic = b.getAttribute("data-th"); go("theory"); }; }); }

  function choiceHtml(q, it, reveal) {
    return '<div class="choices">' + q.c.map(function (c, i) {
      var n = i + 1, cls = "choice", mark = "";
      if (reveal) {
        if (n === q.a) { cls += " right"; mark = '<span class="mark" aria-label="정답">✓</span>'; }
        else if (n === it.sel) { cls += " wrong"; mark = '<span class="mark" aria-label="내 답">✗</span>'; }
      } else if (n === it.sel) { cls += " sel"; mark = '<span class="mark">✓</span>'; }
      return '<button class="' + cls + '" data-c="' + n + '"' + (reveal ? " disabled" : "") + '><span class="n">' + CIRC[i] + "</span><span>" + inl(c) + "</span>" + mark + "</button>";
    }).join("") + "</div>";
  }
  function feedbackHtml(q, it) {
    var ok = it.sel === q.a;
    var title = !it.sel ? "풀지 않은 문제입니다 · 정답은 " + CIRC[q.a - 1] + "번" : ok ? "정답입니다" : "정답은 " + CIRC[q.a - 1] + "번입니다";
    return '<div class="fb ' + (ok ? "ok" : "bad") + '"><b class="fb-t">' + title + "</b>" +
      (q.p ? '<div class="trap"><b>이 문제의 함정</b>' + inl(q.p) + "</div>" : "") +
      '<div class="exp">' + inl(q.e) + "</div>" +
      '<div class="meta">' + esc(topicName(q.t)) + " · " + esc(q.id) + (hasTheory(q.t) ? ' · <button class="link" style="padding:0" data-th="' + q.t + '">이론 다시 보기</button>' : "") + "</div></div>";
  }

  // OMR 답안지: 과목별 줄, 한 줄 최대 8문항
  function omrHtml(s) {
    var exam = s.mode === "exam", groups = [], marked = 0, rows = "";
    s.items.forEach(function (x, i) {
      if (x.sel) marked++;
      var a = areaOf(BY_ID[x.id]), g = groups[groups.length - 1];
      if (!g || g.area !== a) { g = { area: a, idxs: [] }; groups.push(g); }
      g.idxs.push(i);
    });
    groups.forEach(function (g) {
      for (var k = 0; k < g.idxs.length; k += 8) {
        rows += '<div class="omr-row"><div class="omr-lab">' + (k === 0 ? esc(AREA_SHORT[g.area] || g.area) : "") + "</div>" +
          g.idxs.slice(k, k + 8).map(function (i) {
            var x = s.items[i], q = BY_ID[x.id], reveal = !exam && x.sel, cls = "omr-cell", b = "";
            if (i === s.idx) cls += " cur";
            if (reveal) cls += x.sel === q.a ? " ok" : " ng";
            for (var c = 1; c <= 4; c++) {
              var bc = "bub";
              if (x.sel === c) bc += " on" + (reveal ? (c === q.a ? " right" : " bad") : "");
              b += '<span class="' + bc + '" data-b="' + i + ":" + c + '" aria-hidden="true"></span>';
            }
            return '<div class="' + cls + '" data-g="' + i + '" role="button" aria-label="' + (i + 1) + "번" + (x.sel ? " 표기함" : "") + '"><span class="omr-n">' + (i + 1) + "</span>" + b + "</div>";
          }).join("") + "</div>";
      }
    });
    return '<div class="omr"><div class="omr-h"><b>답안지</b><span>' + marked + " / " + s.items.length + " 표기</span></div>" + rows + "</div>";
  }

  function renderQuiz() {
    var s = S.session; if (!s) { go("home", "replace"); return; }
    var it = s.items[s.idx], q = BY_ID[it.id], exam = s.mode === "exam", n = s.items.length;
    var reveal = !exam && !!it.sel, last = s.idx === n - 1, left = limitSec() - s.elapsed;
    var h = '<div class="q-top"><button class="iconbtn" id="quit" aria-label="처음으로">처음</button><b>' + esc(s.title) + "</b>" +
      '<span class="cnt' + (exam && left <= 300 ? " low" : "") + '">' + (exam ? '<span id="timer">' + mmss(left) + "</span>" : (s.idx + 1) + " / " + n) + "</span></div>";
    if (exam && s.short && s.idx === 0) h += '<div class="samp">지금은 샘플 문항 ' + n + "개로 체험하는 중입니다. 문항이 채워지면 실제 시험과 같은 " + SB().areas.length * SB().per + "문항으로 출제됩니다.</div>";
    h += '<div class="q-meta"><span class="area">' + esc(areaOf(q)) + (exam ? "" : " · " + esc(topicName(q.t))) + "</span>" + reportBtn(q) + "</div>";
    h += '<div class="question"><span class="qno">' + (s.idx + 1) + ".</span> " + inl(q.q) + "</div>" + dataHtml(q.x) + imgHtml(q.img);
    h += choiceHtml(q, it, reveal);
    if (reveal) h += feedbackHtml(q, it);
    var nextLabel = last ? (exam ? "제출" : "결과 보기") : "다음";
    h += '<div class="navrow"><button class="btn" id="prev"' + (s.idx === 0 ? " disabled" : "") + ">이전</button>" +
      '<button class="btn primary" id="next">' + nextLabel + "</button></div>";
    h += omrHtml(s);
    app.innerHTML = h;
    bindReports(); bindTheoryLinks();

    function goIdx(i) { s.idx = i; saveSession(); renderQuiz(); window.scrollTo(0, 0); }
    function answer(item, c) {
      if (!exam && item.sel) return; // 연습·오답노트: 한 번 고르면 확정
      item.sel = c;
      if (!exam) {
        var key = item.src || item.id;
        if (c !== BY_ID[item.id].a) addNote(key); else if (s.mode === "note") delNote(key);
      }
      saveSession();
    }
    app.querySelectorAll("[data-c]").forEach(function (b) { b.onclick = function () { answer(it, +b.getAttribute("data-c")); renderQuiz(); }; });
    var omr = app.querySelector(".omr");
    if (omr) omr.onclick = function (e) {
      var bub = e.target.closest ? e.target.closest("[data-b]") : null;
      if (bub && exam) { var p = bub.getAttribute("data-b").split(":"), i = +p[0]; answer(s.items[i], +p[1]); s.idx = i; saveSession(); renderQuiz(); return; }
      var cell = e.target.closest ? e.target.closest("[data-g]") : null;
      if (cell) goIdx(+cell.getAttribute("data-g"));
    };
    bind("quit", function () {
      if (exam && !confirm("시험을 중단하시겠습니까? 처음 화면에서 이어서 풀 수 있습니다.")) return;
      S.stack = []; go("home");
    });
    bind("prev", function () { if (s.idx > 0) goIdx(s.idx - 1); });
    bind("next", function () {
      if (!last) { goIdx(s.idx + 1); return; }
      var blank = s.items.filter(function (x) { return !x.sel; }).length;
      if (blank && !confirm(blank + "문항을 아직 풀지 않았습니다. " + (exam ? "제출하시겠습니까?" : "결과를 보시겠습니까?"))) return;
      finish();
    });
    if (exam) timerOn();
  }

  function finish() {
    var s = S.session; s.submitted = true;
    if (s.mode === "exam") s.items.forEach(function (x) { if (x.sel !== BY_ID[x.id].a) addNote(x.src || x.id); });
    if (s.mode === "practice" && s.topic) { var ok = s.items.filter(function (x) { return x.sel === BY_ID[x.id].a; }).length; setScore(s.topic, Math.round(ok / s.items.length * 100)); if (!readMap()[s.topic]) setRead(s.topic, true); }
    saveSession(); sendResult(s); go("result", "replace");
  }

  // ---------- 선생님께 결과 보내기(선택, 구글폼으로 접수) ----------
  function me() { var m = sget("localStorage", "me"); return m && typeof m === "object" ? m : {}; }
  function sendOn() { var m = me(); return !!(CFG.resultPost && m.on && m.name); }
  function summary(s) {
    var by = {}, weak = {}, correct = 0;
    s.items.forEach(function (x) {
      var q = BY_ID[x.id], ok = x.sel === q.a, a = areaOf(q);
      if (!by[a]) by[a] = [0, 0];
      by[a][1]++; if (ok) { by[a][0]++; correct++; } else weak[q.t] = (weak[q.t] || 0) + 1;
    });
    var areas = SB().areas.filter(function (a) { return by[a]; });
    var sc = {}; areas.forEach(function (a) { sc[a] = Math.round(by[a][0] / by[a][1] * 100); });
    var vals = areas.map(function (a) { return sc[a]; });
    var avg = vals.length ? Math.round(vals.reduce(function (t, v) { return t + v; }, 0) / vals.length) : 0;
    var cut = vals.some(function (v) { return v < 40; });
    var pass = !cut && avg >= 60 && areas.length === SB().areas.length;
    return { by: by, weak: weak, correct: correct, areas: areas, sc: sc, avg: avg, cut: cut, pass: pass };
  }
  function sendResult(s) {
    if (!sendOn() || s.sent) return;
    var R = CFG.resultPost, m = me(), r = summary(s), exam = s.mode === "exam";
    var f = { name: m.name, subj: SB().name, std: STD[S.std].name, mode: { exam: "실전 CBT", practice: s.mix ? "과목별 연습" : "단원 학습", note: "오답노트" }[s.mode] || s.mode,
      title: s.title, score: r.correct + "/" + s.items.length,
      s1: r.sc["컴퓨터 일반"], s2: r.sc["스프레드시트"], s3: r.sc["데이터베이스"],
      avg: exam ? r.avg : "", verdict: exam ? (r.pass ? "합격권" : r.cut ? "과락" : "불합격권") : "",
      minutes: exam ? Math.max(1, Math.round(Math.min(s.elapsed, limitSec()) / 60)) : "",
      weak: Object.keys(r.weak).sort(function (x, y) { return r.weak[y] - r.weak[x]; }).map(function (t) { return topicName(t) + " " + r.weak[t]; }).join(", ") };
    var body = new URLSearchParams();
    Object.keys(f).forEach(function (k) { if (R[k] && f[k] !== undefined && f[k] !== "") body.append(R[k], f[k]); });
    s.sent = "wait"; saveSession();
    fetch(R.action, { method: "POST", mode: "no-cors", body: body }).then(function () { s.sent = "ok"; }).catch(function () { s.sent = "fail"; })
      .then(function () { saveSession(); var el = document.getElementById("sent"); if (el) el.outerHTML = sentHtml(s); });
  }
  function sentHtml(s) {
    if (!s.sent) return "";
    var t = s.sent === "ok" ? "선생님께 결과가 전달되었습니다" : s.sent === "fail" ? "결과를 보내지 못했습니다 · 인터넷 연결을 확인해 주세요" : "선생님께 결과를 보내는 중…";
    return '<p class="sub center" id="sent" style="margin:0 0 12px">' + esc(t) + "</p>";
  }
  function openMe() {
    var m = me(), old = document.getElementById("me-bg"); if (old) old.remove();
    var bg = document.createElement("div"); bg.id = "me-bg"; bg.className = "sheet-bg";
    bg.innerHTML = '<div class="sheet" role="dialog" aria-label="선생님께 결과 보내기"><div class="sheet-h"><b>선생님께 결과 보내기</b></div>' +
      '<div class="sub" style="margin:2px 0 10px">켜 두면 실전 CBT·단원 학습을 마칠 때마다 이름·점수·틀린 단원이 학원 선생님께 전달됩니다. 원하지 않으면 끌 수 있습니다.</div>' +
      '<input id="me-name" class="input" style="letter-spacing:0;font-size:1.05em;text-align:left" maxlength="20" placeholder="이름 (선생님이 알아볼 수 있게)" value="' + esc(m.name || "") + '">' +
      '<div class="navrow" style="margin:12px 0 0">' + (m.on ? '<button class="btn" id="me-off">끄기</button>' : '<button class="btn" id="me-x">취소</button>') + '<button class="btn primary" id="me-ok">' + (m.on ? "저장" : "켜기") + "</button></div></div>";
    document.body.appendChild(bg);
    function close() { bg.remove(); renderHome(); }
    bg.onclick = function (e) { if (e.target === bg) bg.remove(); };
    bind("me-x", function () { bg.remove(); });
    bind("me-off", function () { sset("localStorage", "me", { name: m.name, on: false }); toast("결과 보내기가 꺼졌습니다."); close(); });
    bind("me-ok", function () {
      var n = document.getElementById("me-name").value.trim();
      if (!n) { toast("이름을 입력해 주세요."); return; }
      sset("localStorage", "me", { name: n, on: true }); toast("이제 결과가 선생님께 전달됩니다."); close();
    });
    document.getElementById("me-name").focus();
  }

  function renderResult() {
    var s = S.session; if (!s) { go("home", "replace"); return; }
    var items = s.items, correct = 0, by = {}, weak = {}, exam = s.mode === "exam";
    items.forEach(function (x) {
      var q = BY_ID[x.id], ok = x.sel === q.a, a = areaOf(q);
      if (!by[a]) by[a] = [0, 0];
      by[a][1]++; if (ok) { by[a][0]++; correct++; } else weak[q.t] = (weak[q.t] || 0) + 1;
    });
    var areas = SB().areas.filter(function (a) { return by[a]; });
    var h = backTop() + sentHtml(s);
    if (exam) {
      var sc = areas.map(function (a) { return Math.round(by[a][0] / by[a][1] * 100); });
      var avg = sc.length ? Math.round(sc.reduce(function (t, v) { return t + v; }, 0) / sc.length) : 0;
      var cut = sc.some(function (v) { return v < 40; }), pass = !cut && avg >= 60 && areas.length === SB().areas.length;
      h += '<div class="score"><div class="sub">' + esc(SB().name) + " 실전 CBT 결과</div>" +
        '<div class="big">' + avg + '<span class="sub" style="font-size:.35em"> 점 평균</span></div><div class="sub">' + correct + " / " + items.length + " 정답 · " + mmss(Math.min(s.elapsed, limitSec())) + "</div></div>";
      h += '<div class="pass ' + (pass ? "ok" : "bad") + '">' + (pass ? "합격권입니다" : "아직 불합격권입니다") +
        '<span class="sub">' + (cut ? "40점 미만 과목이 있습니다(과락)" : avg >= 60 ? (pass ? "모든 과목 40점 이상 · 평균 60점 이상" : "모든 과목을 풀어야 합격 판정이 나옵니다") : "평균 60점 이상이어야 합격입니다") + "</span></div>";
      if (s.short) h += '<div class="samp">샘플 문항으로 본 결과이므로 참고용입니다.</div>';
      h += '<div class="card">' + areas.map(function (a, i) {
        return '<div class="row"><span>' + esc(a) + "</span><span" + (sc[i] < 40 ? ' style="color:var(--bad);font-weight:700"' : ' style="font-weight:700"') + ">" + sc[i] + "점 <span class=\"sub\">(" + by[a][0] + "/" + by[a][1] + ")</span>" + (sc[i] < 40 ? " · 과락" : "") + "</span></div>";
      }).join("") + "</div>";
    } else {
      h += '<div class="score"><div class="sub">' + esc(s.title) + " 결과</div>" +
        '<div class="big">' + correct + '<span class="sub" style="font-size:.35em"> / ' + items.length + "</span></div></div>";
    }
    var wk = Object.keys(weak).sort(function (x, y) { return weak[y] - weak[x] || (ORDER[x] - ORDER[y]); });
    if (wk.length) {
      // 결과: 많이 틀린 단원 3개만 먼저, 나머지는 접기. 줄 전체를 눌러 이론으로 이동
      var shortName = function (t) { return topicName(t).replace(/\s*\(.*\)\s*$/, ""); };
      var top = weak[wk[0]];
      var wrow = function (t) {
        var hot = top >= 2 && weak[t] === top, th = hasTheory(t);
        return (th ? '<button class="wk" data-th="' + t + '">' : '<div class="wk">') +
          '<span class="wn">' + esc(shortName(t)) + '</span><span class="wc' + (hot ? " hot" : "") + '">' + weak[t] + "문항 틀림</span>" +
          (th ? '<span class="chev">›</span></button>' : "</div>");
      };
      h += '<h2>다시 볼 단원</h2><div class="card wklist">' + wk.slice(0, 3).map(wrow).join("") +
        (wk.length > 3 ? '<div class="wkmore" hidden>' + wk.slice(3).map(wrow).join("") + '</div><button class="wkbtn" id="wkmore">단원 더 보기 (' + (wk.length - 3) + ")</button>" : "") + "</div>";
      h += '<p class="sub" style="margin:8px 2px 0">틀린 문제는 오답노트에 저장되었습니다.</p>';
    }
    h += '<h2>문항별 확인</h2><div class="list">' + items.map(function (x, i) {
      var q = BY_ID[x.id], ok = x.sel === q.a;
      return '<button data-r="' + i + '"><span>' + (i + 1) + ". " + esc(topicName(q.t)) + '</span><span style="color:var(--' + (ok ? "ok" : "bad") + ');font-weight:700">' + (ok ? "✓" : "✗") + "</span></button>";
    }).join("") + "</div>";
    var hasNote = noteIds().length > 0;
    app.innerHTML = h + bar('<button class="btn" id="home2">처음으로</button>' + (hasNote ? '<button class="btn primary" id="tonote">오답노트</button>' : ""));
    function leave(screen) { S.session = null; saveSession(); S.stack = []; go(screen); }
    bind("back", function () { leave("home"); });
    bind("home2", function () { leave("home"); });
    bind("tonote", function () { leave("note"); });
    bind("wkmore", function () { var m = app.querySelector(".wkmore"); if (m) m.hidden = false; this.remove(); });
    bindTheoryLinks();
    app.querySelectorAll("[data-r]").forEach(function (b) { b.onclick = function () { S.reviewIdx = +b.getAttribute("data-r"); go("review"); }; });
  }

  function renderReview() {
    var s = S.session; if (!s) { go("home", "replace"); return; }
    var i = S.reviewIdx || 0, it = s.items[i], q = BY_ID[it.id], n = s.items.length;
    var h = '<div class="q-head"><button class="iconbtn" id="back" style="margin-left:-10px">‹ 결과</button><span>' + (i + 1) + " / " + n + "</span></div>" +
      '<div class="q-meta"><span class="area">' + esc(areaOf(q)) + " · " + esc(topicName(q.t)) + "</span>" + reportBtn(q) + "</div>" +
      '<div class="question"><span class="qno">' + (i + 1) + ".</span> " + inl(q.q) + "</div>" + dataHtml(q.x) + imgHtml(q.img) + choiceHtml(q, it, true) + feedbackHtml(q, it);
    app.innerHTML = h + bar('<button class="btn small" id="p"' + (i === 0 ? " disabled" : "") + ' aria-label="이전">‹</button><button class="btn primary" id="nx">' + (i === n - 1 ? "결과로" : "다음 문항") + "</button>");
    bindReports(); bindTheoryLinks();
    bind("back", function () { history.back(); });
    bind("p", function () { S.reviewIdx = i - 1; renderReview(); window.scrollTo(0, 0); });
    bind("nx", function () { if (i === n - 1) history.back(); else { S.reviewIdx = i + 1; renderReview(); window.scrollTo(0, 0); } });
  }

  // ---------- 시작 ----------
  function restoreSession() {
    // 카톡 창을 닫았다 다시 열어도 이어서 풀 수 있게 기기(localStorage)에 저장. 제출이 끝난 것은 불러오지 않음
    var saved = sget("localStorage", "session." + K()) || sget("sessionStorage", "session." + K());
    S.session = (saved && saved.items && saved.mode && !saved.submitted && saved.items.every(function (x) { return BY_ID[x.id]; })) ? saved : null;
  }
  function start() {
    restoreSession();
    try { history.replaceState({ s: "home" }, ""); } catch (e) {}
    S.screen = "home"; S.stack = []; render();
  }
  if (sget("localStorage", "big")) document.documentElement.classList.add("big");
  fetch("data/com.json", { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (d) {
    DATA = d;
    d.topics.forEach(function (t, i) { TOPIC[t.code] = t; ORDER[t.code] = i; });
    d.questions.forEach(function (q) { BY_ID[q.id] = q; (BY_GROUP[q.g] = BY_GROUP[q.g] || []).push(q); });
    if (checkAccess()) start(); else renderGate();
  }).catch(function () {
    app.innerHTML = '<div class="loading">문제를 불러오지 못했습니다. 인터넷 연결을 확인하고 다시 열어 주세요.</div>';
  });
})();
