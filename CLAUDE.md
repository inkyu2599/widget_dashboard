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

### Salesforce CLI (sf / sfdx)
```bash
# 스크래치 조직에 소스 배포
sf project deploy start --source-dir force-app

# 조직에서 변경사항 가져오기
sf project retrieve start

# Apex 테스트 실행
sf apex run test --test-level RunLocalTests --output-dir ./tests/apex --result-format human

# 브라우저에서 조직 열기
sf org open
```

## 아키텍처

### 개요
Salesforce 위에서 동작하는 사용자 정의 대시보드 빌더. 사용자가 위젯을 드래그&드롭으로 구성하면 레이아웃이 사용자별로 커스텀 오브젝트에 JSON으로 저장된다.

### 데이터 레이어
- **`CM_DashboardLayout__c`** — 사용자별 레이아웃 레코드를 저장하는 커스텀 오브젝트. `LayoutConfig__c` (LongTextArea, 최대 131KB)에 위젯 배열을 JSON으로 보관. `Columns__c`는 그리드 컬럼 수 (기본값 12).
- **`CM_DashboardComponent__mdt`** — COMPONENT 타입 위젯으로 사용할 수 있는 LWC 컴포넌트 카탈로그 (Custom Metadata). `IsActive__c = true`인 레코드만 조회. 주요 필드: `ComponentName__c`, `Category__c`, `SortOrder__c`, `Description__c`.
- **`CM_DashboardWidgetController`** — `@AuraEnabled` 메서드 3개를 제공하는 단일 Apex 컨트롤러: `getUserDashboardLayout`, `saveDashboardLayout`, `getAvailableComponents`. `WITH SECURITY_ENFORCED` 적용. 내부 DTO `WidgetDto` / `DashboardLayoutDto`로 `LayoutConfig__c` JSON을 직렬화/역직렬화.

### 위젯 데이터 모델
`LayoutConfig__c` JSON에 저장되는 각 위젯의 구조:
- 레이아웃: `colStart`, `rowStart`, `colSpan`, `rowSpan` (CSS Grid 좌표, 12칸 기준)
- 타입 구분: `widgetType` — `TEXT` | `IMAGE` | `COMPONENT`
- 타입별 필드: `content` (TEXT용 Rich HTML), `imageUrl` (IMAGE용), `componentName` (COMPONENT용 LWC API명)
- 스타일: `backgroundColor`, `textColor`, `fontSize`, `isBold`
- `isFixed: true` 이면 삭제 불가

### LWC 컴포넌트 계층 구조
```
cmDashboardMain           ← Apex로 레이아웃 로드/저장, widgets[] 상태 소유
├─ cmDashboardGrid        ← CSS Grid 컨테이너, 위젯 이벤트 버블링
│  └─ cmDashboardWidget   ← 위젯별 래퍼, mousemove/mouseup으로 드래그·리사이즈 처리
│     ├─ cmDashboardWidgetText
│     ├─ cmDashboardWidgetImage
│     └─ cmDashboardWidgetComponent  ← componentName으로 등록된 LWC를 동적 렌더링
└─ cmDashboardEditModal   ← 전체화면 편집 캔버스 + 팔레트 패널
   └─ cmDashboardWidgetSettings  ← 위젯별 설정 팝업 (타이틀, 색상, 크기 등)
```

`cmDashboardAddWidgetModal`은 존재하지만 현재 미사용 — 편집은 `cmDashboardEditModal` 내부 팝업으로 처리.

### 레이아웃 엔진 (cmDashboardEditModal)
편집 모달에 핵심 복잡도가 집중되어 있다:
- **`_insertWidgetAt(target, others)`** — 큐 기반 충돌 해결: 겹치는 위젯을 우측으로, 열을 벗어나면 아래 행으로 밀어낸다.
- **`_overlaps(a, b)`** — 셀 단위 겹침 판정.
- **`_compact(widgets)`** — 중력 방식 정렬: 위젯을 빈 행 없이 위로 끌어올린다.
- **`_coordToCell(x, y)`** — 마우스 픽셀 좌표를 그리드 셀(col, row)로 변환.
- **`_enrich(widget)`** — 템플릿 바인딩용 계산 속성(badge class, card style 등)을 추가.

드래그 소스: 팔레트 아이템(신규 위젯)과 캔버스의 기존 위젯(이동). 모두 드롭 시 `_insertWidgetAt`으로 처리.

> **참고:** `_enrich()` 는 `dashboardWidgetUtils.enrich()` 를 래핑한 것. 저장 전엔 반드시 `strip()`으로 계산 속성을 제거해야 한다.

### 유틸리티 모듈
- **`dashboardConstants`** — 그리드 상수: `COLS=12`, `DEFAULT_COL_SPAN=4`, `DEFAULT_ROW_SPAN=3`, `CELL_H_PX=82`, `GAP_PX=8`. 위젯 타입(`TEXT`/`IMAGE`/`COMPONENT`) 및 `MODE_EDIT` 상수 정의.
- **`dashboardWidgetUtils`** — 순수 함수 모음:
  - `enrich(w)` — 템플릿 바인딩용 계산 속성 추가 (isText/isImage/isComponent, badgeClass, cardStyle 등)
  - `strip(w)` — 저장 전 enrich 속성 제거
  - `createFromPalette(data, slot)` — 신규 위젯 팩토리 (UUID 기반 widgetId 생성)
  - `findFreeSlot(colSpan, rowSpan, widgets)` — 빈 그리드 셀 탐색

### 새 위젯 컴포넌트 추가 방법
1. `force-app/main/default/lwc/` 아래 LWC 컴포넌트 생성
2. 조직에 `CM_DashboardComponent__mdt` 레코드 추가 — `ComponentName__c`에 LWC의 kebab-case API명 입력 (예: `c-my-widget`), `IsActive__c = true`
3. `getAvailableComponents()` 호출 시 자동으로 편집 모달 팔레트에 노출됨
