# SupplySync-FE

RFQ 견적 회신을 한 흐름으로 묶는 SupplySync의 프론트엔드입니다. Vue 3 + TypeScript + Vite.

## 실행

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # 타입 검사 + 빌드
```

백엔드는 `http://localhost:8080`에서 실행되어야 합니다. `/api` 요청은 Vite 프록시(`vite.config.ts`)로 넘어가므로 CORS 설정이 필요 없습니다.

데모 계정 (비밀번호 모두 `demo1234`): `hb_buyer01` (고객), `ds_sales01` (담당자)

## 구조

```
src/
  api/        API 클라이언트 (auth, rfq, task SSE, ai 승인·요구 확인, types)
  views/      로그인, RFQ 등록·목록·상세, 진행 화면
  session.ts  로그인 상태 (토큰 만료 포함)
  labels.ts   상태값 → 화면 문구
  router.ts   라우트와 로그인 가드
docs/
  artifact/                    프로토타입 화면 (SupplySync, 검토 콘솔)
  backend-integration-status.html  백엔드 연동 현황과 확인 질문
presentation/
  deck.html   발표 슬라이드
  outline.md  발표 구성안
```

## 현재 상태

- 완료: 로그인, RFQ 접수(.md 업로드), 목록, 상세, SSE 진행 표시와 끊김 복구, 승인·반려 호출
- 임시 가정 (백엔드 확인 필요): 상세 응답의 `task_id`, STEP 이벤트의 `step`/`name` 필드명
- 미완: 분석 결과(`review`)와 고객 견적(`quotes`)의 항목별 화면, 요구 확인 화면
