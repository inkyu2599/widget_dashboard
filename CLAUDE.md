# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 명령어

```bash
# LWC/Aura JS 린트
npm run lint

# LWC 단위 테스트 전체 실행 (Jest)
npm run test:unit

# 테스트 watch 모드
npm run test:unit:watch

# 단일 테스트 파일 실행
npx sfdx-lwc-jest force-app/main/default/lwc/<컴포넌트명>/__tests__/<파일>.test.js

# 커버리지 포함 테스트
npm run test:unit:coverage

# 전체 파일 포맷팅 (Apex, HTML, JS, XML, CSS 등)
npm run prettier

# 포맷팅 검사 (파일 수정 없이)
npm run prettier:verify
```

커밋 시 Husky + lint-staged가 자동으로 Prettier 포맷팅, ESLint 검사, 관련 LWC Jest 테스트를 실행한다.

### Salesforce CLI
```bash
sf project deploy start --source-dir force-app
sf project retrieve start
sf apex run test --test-level RunLocalTests --output-dir ./tests/apex --result-format human
sf org open
```

## 아키텍처

Salesforce 위에서 동작하는 사용자 정의 대시보드 빌더. 드래그&드롭으로 위젯을 배치하며, 레이아웃은 사용자별로 커스텀 오브젝트에 JSON으로 저장된다.

### 데이터 레이어
- **`CM_DashboardLayout__c`** — 사용자별 레이아웃 저장. `LayoutConfig__c` (LongTextArea, 최대 131KB)에 위젯 배열 JSON 보관. `Columns__c`는 그리드 컬럼 수 (기본값 12).
- **`CM_DashboardComponent__mdt`** — COMPONENT 타입 위젯용 LWC 카탈로그 (Custom Metadata). `IsActive__c = true`인 레코드만 조회. 주요 필드: `ComponentName__c`, `Category__c`, `SortOrder__c`, `Description__c`.
- **`CM_DashboardWidgetController`** — `getUserDashboardLayout`, `saveDashboardLayout`, `getAvailableComponents` 3개 `@AuraEnabled` 메서드 제공. `WITH SECURITY_ENFORCED` 적용.

### 위젯 데이터 모델
`LayoutConfig__c` JSON에 저장되는 각 위젯 구조:
- 레이아웃: `colStart`, `rowStart`, `colSpan`, `rowSpan` (CSS Grid 좌표, 12칸 기준)
- 타입: `widgetType` — `TEXT` | `IMAGE` | `COMPONENT` | `REPORT` | `CHART` | `TABLE`
- 타입별 필드: `content` (TEXT), `imageUrl` (IMAGE), `componentName` (COMPONENT), `reportId` (REPORT), `chartType`/`chartSObject` (CHART)
- 스타일: `backgroundColor`, `textColor`, `fontSize`, `isBold`
- `isFixed: true` 이면 삭제 불가

### LWC 컴포넌트 계층 구조
```
cmDashboardMain           ← Apex로 레이아웃 로드/저장, widgets[] 상태 소유
├─ cmDashboardGrid        ← CSS Grid 컨테이너, 위젯 이벤트 버블링
│  └─ cmDashboardWidget   ← 위젯별 래퍼, 드래그·리사이즈 처리
│     ├─ cmDashboardWidgetText
│     ├─ cmDashboardWidgetImage
│     ├─ cmDashboardWidgetComponent  ← componentName으로 LWC 동적 렌더링
│     ├─ cmDashboardWidgetChart      ← Chart.js 기반 차트
│     ├─ cmDashboardWidgetReport     ← Salesforce 리포트 iframe 임베드
│     └─ cmDashboardWidgetTable      ← lightning-datatable 기반 데이터 테이블
└─ cmDashboardEditModal   ← 전체화면 편집 캔버스 + 팔레트 패널
   └─ cmDashboardWidgetSettings  ← 위젯별 설정 팝업
```

### 유틸리티 모듈
- **`dashboardConstants`** — `COLS=12`, `DEFAULT_COL_SPAN=4`, `DEFAULT_ROW_SPAN=3`, `CELL_H_PX=82`, `GAP_PX=8`. 위젯 타입 및 `MODE_EDIT` 상수.
- **`dashboardWidgetUtils`** — `enrich(w)` (템플릿 바인딩용 계산 속성 추가), `strip(w)` (저장 전 제거), `createFromPalette(data, slot)` (UUID 기반 위젯 생성), `findFreeSlot(colSpan, rowSpan, widgets)` (빈 셀 탐색).

> 저장 전엔 반드시 `strip()`으로 계산 속성을 제거해야 한다.

### 새 위젯 컴포넌트 추가 방법
1. `force-app/main/default/lwc/` 아래 LWC 컴포넌트 생성
2. 조직에 `CM_DashboardComponent__mdt` 레코드 추가 — `ComponentName__c`에 kebab-case API명 입력 (예: `c-my-widget`), `IsActive__c = true`
3. `getAvailableComponents()` 호출 시 자동으로 편집 모달 팔레트에 노출됨
