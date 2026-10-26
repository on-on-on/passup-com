// 패스업 컴활 설정 — 여기 값만 바꾸면 됩니다.
window.PASSUP_CONFIG = {
  // 입장 코드(기수가 바뀌면 변경). 공지방 링크 예: https://(사이트주소)/?code=203101
  accessCode: "203101",

  // 오류 신고(구글폼). 비워 두면 "오류 신고" 버튼이 숨겨집니다.
  // 회계 사이트처럼 쓰려면 컴활용 구글폼을 만든 뒤 아래 형식으로 채우세요.
  reportFormUrl: "",
  reportPost: null,
  // reportPost: {
  //   action: "https://docs.google.com/forms/d/e/(폼ID)/formResponse",
  //   id: "entry.000", subject: "entry.000", type: "entry.000", memo: "entry.000",
  //   types: ["정답이 틀린 것 같음", "해설이 이상함", "문제 오타", "화면이 깨짐", "기타"]
  // },

  // 선생님께 결과 보내기(선택). 구글폼을 만든 뒤 formResponse 주소와 질문별 entry 번호를 넣으면 켜집니다.
  // null이면 홈 화면에 이 메뉴가 나오지 않아요.
  resultPost: {
    action: "https://docs.google.com/forms/d/e/1FAIpQLSfKVPF07gSyp-kJmC7o7h-Ih4zNOPoAic82opfkA2rFJwglNg/formResponse",
    name: "entry.1431457289",    // 이름
    subj: "entry.655855616",     // 종목
    std: "entry.2049730304",     // 출제기준
    mode: "entry.509485267",     // 모드
    title: "entry.1212014459",   // 단원
    score: "entry.1515669328",   // 정답수
    s1: "entry.1755744233",      // 컴퓨터일반
    s2: "entry.995268711",       // 스프레드시트
    s3: "entry.664143542",       // 데이터베이스
    avg: "entry.2014248277",     // 평균
    verdict: "entry.361958354",  // 판정
    minutes: "entry.1371741518", // 소요시간(분)
    weak: "entry.1888802253"     // 틀린단원
  },
  // resultPost: {
  //   action: "https://docs.google.com/forms/d/e/(폼ID)/formResponse",
  //   name: "entry.000",   // 이름
  //   subj: "entry.000",   // 종목(컴활 1급/2급)
  //   std: "entry.000",    // 출제기준(올해 유형/신유형)
  //   mode: "entry.000",   // 실전 CBT/단원 연습/오답노트
  //   title: "entry.000",  // 단원 이름 등
  //   score: "entry.000",  // 정답 수/문항 수
  //   s1: "entry.000",     // 컴퓨터 일반 점수
  //   s2: "entry.000",     // 스프레드시트 점수
  //   s3: "entry.000",     // 데이터베이스 점수
  //   avg: "entry.000",    // 평균
  //   verdict: "entry.000",// 합격권/불합격권/과락
  //   minutes: "entry.000",// 걸린 시간(분)
  //   weak: "entry.000"    // 틀린 단원
  // },

  // 올해 유형(2026 출제기준)을 보여 주는 마지막 날. 이 날이 지나면 선택 버튼이 사라지고 신유형만 남습니다.
  // 비워 두면("") 계속 둘 다 보여요.
  oldEnd: "2026-12-31",

  // 로고 옆 작은 회색 글씨
  byline: "by ON",

  // 처음 화면·입장 화면 맨 아래 안내문
  notice: "패스업(PASS UP) 컴활은 수강생의 합격을 위해 학원에서 직접 만든 학습용 CBT입니다. 수록된 이론과 문제는 학원이 자체 제작한 것으로, 수강생 외 공유와 무단 복제·캡처·배포를 금합니다."
};
