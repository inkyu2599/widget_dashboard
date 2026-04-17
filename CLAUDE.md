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

Salesforce 위에서 동작하는 행(Row) 기반 대시보드 빌더. 사용자가 행을 추가하고 각 행에 1~3개 위젯을 배치한다. 레이아웃은 `CM_Dashboard__c` 오브젝트에 JSON으로 저장된다.

### 데이터 레이어
- **`CM_Dashboard__c`** — 대시보드 레코드. `LayoutConfig__c` (LongTextArea, 최대 131KB)에 행·위젯 배열 JSON 저장. `IsActive__c` (Checkbox). `AudienceType__c` / `AudienceValue__c` / `Priority__c` 로 노출 대상 제어.
- **`CM_UserDashboardLayout__c`** — 사용자 개인화 레이아웃. `UserDashboardKey__c` (`{userId}_{dashboardId}`, External ID)로 upsert. `LayoutConfig__c` (LongTextArea). 개인 레이아웃이 있으면 기본 레이아웃보다 우선 표시.
- **`CM_DashboardComponent__mdt`** — COMPONENT 타입 위젯용 LWC 카탈로그 (Custom Metadata). `IsActive__c = true`인 레코드만 조회. 주요 필드: `ComponentName__c`, `Category__c`, `SortOrder__c`.
- **`CM_DashboardSObjectConfig__mdt`** — CHART/TABLE 위젯에서 선택 가능한 SObject 화이트리스트 (Custom Metadata). 주요 필드: `SObjectApiName__c`, `Label__c`, `AllowChart__c`, `AllowTable__c`, `AllowedAggregations__c`, `IsActive__c`. UI에서 레코드 추가 시 반드시 페이지 레이아웃에 커스텀 필드를 추가해야 입력 가능.
- **`CM_DashboardPref__c`** — Hierarchy Custom Setting. 사용자별 기본 대시보드 ID 저장 (`DefaultDashboardId__c`). LongTextArea 미지원이므로 레이아웃 JSON 저장 불가.
- **`CM_DashboardController`** — 모든 서버 통신 담당. `getDashboards`, `getDashboard`, `saveDashboard`, `deleteDashboard`, `getAvailableComponents`, `getAvailableSObjects`, `getChartData`, `getTableData`, `savePersonalLayout`, `resetPersonalLayout`. 읽기 쿼리는 `WITH SYSTEM_MODE` 적용 (일반 사용자 프로필에 오브젝트 CRUD 없음). 동적 SOQL은 Schema API + SObject 화이트리스트 이중 검증.

### LayoutConfig JSON 구조
```json
{
  "rows": [
    {
      "rowId": "uuid",
      "columns": 2,
      "widgets": [
        { "widgetId": "uuid", "widgetType": "CHART", "title": "...",
          "chartSObject": "Account", "chartGroupBy": "Industry",
          "chartAggregation": "COUNT", "chartType": "bar" },
        { "widgetId": "uuid", "widgetType": "TABLE", "title": "...",
          "tableSObject": "Contact", "tableFields": "Name,Email",
          "tableLimit": 50 }
      ]
    }
  ]
}
```

위젯 타입: `COMPONENT` | `CHART` | `TABLE`

### LWC 컴포넌트 계층 구조
```
cmDashboardApp              ← 앱 진입점. 대시보드 목록(cmDashboardCard) + 신규 생성 폼
cmDashboardView             ← 단건 뷰/편집. imperative getDashboard, cmDbEditModal 제어
│                             isAdmin에 따라 저장 대상 분기 (admin→CM_Dashboard__c, user→개인레이아웃)
│                             hasPersonalLayout 시 "기본으로 되돌리기" 버튼 표시
├─ cmDbRow                  ← 단일 행 렌더링. CSS Grid repeat(auto-fit)
│  └─ cmDbCell              ← 단일 셀. widgetType에 따라 하위 컴포넌트 분기
│     ├─ cmDbChart          ← Chart.js 기반 차트. @wire(getChartData)
│     ├─ cmDbTable          ← lightning-datatable. @wire(getTableData)
│     └─ cmDbComponent      ← COMPONENT 위젯 렌더러. lwc:if 체인으로 부서 컴포넌트 분기
cmDbEditModal               ← 편집 모달. 행 추가/삭제/이동, 셀 클릭 시 설정 패널
└─ cmDbWidgetSettings       ← 위젯별 설정 폼. apply/cancel 이벤트 emit
                              CHART/TABLE SObject는 드롭다운(CM_DashboardSObjectConfig__mdt 기반)
```

### 유틸리티 모듈
- **`cmDashboardConstants`** — `WIDGET_TYPE`, `CHART_TYPE`, `AGGREGATION`, `DEFAULT_ROW_HEIGHT` 상수.
- **`cmDashboardUtils`** — `generateId()` (UUID v4), `createEmptyWidget(type)`, `createEmptyRow(columns)`, `parseLayout(json)`, `stringifyLayout(layout)`.

### 새 위젯 타입 추가 방법
1. `cmDbCell` HTML에 `lwc:elseif` 분기 추가
2. `cmDashboardConstants`의 `WIDGET_TYPE`에 상수 추가
3. `cmDashboardUtils`의 `createEmptyWidget`, `defaultTitle` 업데이트
4. `cmDbWidgetSettings` HTML/JS에 타입별 설정 섹션 추가
5. `CM_DashboardController`에 필요한 데이터 메서드 추가

### COMPONENT 위젯 — 부서 컴포넌트 추가 체크리스트

LWC 동적 import(`import(variable)`)와 `lwc:is`는 플랫폼 제약으로 사용 불가. 새 컴포넌트를 추가할 때는 아래 4단계를 반드시 모두 수행해야 한다.

1. **`cmDbComponent.js`** — `REGISTERED_NAMES` Set에 컴포넌트 이름 추가  
   ```js
   const REGISTERED_NAMES = new Set([
       'c-dept-sales-oppty',
       'c-my-new-widget',   // ← 추가
   ]);
   // getter 추가
   get isMyNewWidget() { return this.widget?.componentName === 'c-my-new-widget'; }
   ```

2. **`cmDbComponent.html`** — 기존 `lwc:if` 체인에 `lwc:elseif`로 추가 (별도 `lwc:if` 사용 금지 — 동시 렌더링됨)  
   ```html
   <template lwc:if={isDeptSalesOppty}>...</template>
   <template lwc:elseif={isMyNewWidget}>          <!-- ← 추가 -->
       <c-my-new-widget widget={widget}></c-my-new-widget>
   </template>
   <template lwc:elseif={isNotRegistered}>미등록 컴포넌트</template>
   ```

3. **`CM_DashboardComponent__mdt` 레코드 추가** — `ComponentName__c`에 kebab-case API명 (예: `c-my-new-widget`), `IsActive__c = true`  
   파일: `force-app/main/default/customMetadata/CM_DashboardComponent.MyNewWidget.md-meta.xml`

4. **부서 컴포넌트 LWC 생성** — `@api widget = {}` 하나만 수신. `widget.componentConfig`(Object)로 컴포넌트별 설정 접근.

참고 예시: `lwc/deptSalesOppty` (영업기회 목록, `DeptSalesOpptyController` 호출)

### componentConfig 패턴
위젯 설정 폼(cmDbWidgetSettings)의 "컴포넌트 설정 (JSON)" 필드에 입력한 값이 `widget.componentConfig`(Object)로 부서 컴포넌트에 전달된다.

```js
// 부서 컴포넌트 Apex 호출 예시
get _configJson() { return JSON.stringify(this.widget?.componentConfig || {}); }
@wire(getOpportunities, { configJson: '$_configJson' }) wiredData(...) { ... }
```

LayoutConfig JSON의 COMPONENT 위젯 구조:
```json
{ "widgetId": "uuid", "widgetType": "COMPONENT", "title": "...",
  "componentName": "c-dept-sales-oppty",
  "componentConfig": { "stage": "Closed Won", "closeYear": 2025, "limit": 10 } }
```

### CM_DashboardQueryHelper (공통 Apex 유틸리티)
부서 컴포넌트 Apex에서 SOQL을 직접 작성하지 말고 이 헬퍼를 사용한다. `CM_DashboardSObjectConfig__mdt` 화이트리스트 검증 + Schema API 필드 검증을 자동으로 수행한다.

```apex
// 테이블용 (columns + rows 반환)
Map<String, Object> result = CM_DashboardQueryHelper.queryTable(
    'Opportunity',           // sObjectName
    'Name, StageName, Amount', // fields (쉼표 구분)
    'StageName = \'Closed Won\'', // WHERE 절 (null 가능)
    'CloseDate DESC',        // ORDER BY (null 가능)
    50                       // LIMIT (최대 200)
);

// 레코드 목록용
List<SObject> records = CM_DashboardQueryHelper.queryList(
    sObjectName, fields, whereClause, orderBy, limitRows
);
```

주의: `queryTable`/`queryList`가 `AuraHandledException`을 throw하면 화이트리스트에 없는 SObject이므로 `CM_DashboardSObjectConfig__mdt` 레코드를 추가해야 한다.

### COMPONENT 위젯 카탈로그 등록 (설정 폼 셀렉트박스)
1. 조직에 `CM_DashboardComponent__mdt` 레코드 추가 — `ComponentName__c`에 kebab-case API명 (예: `c-my-widget`), `IsActive__c = true`
2. `getAvailableComponents()` 호출 시 `cmDbWidgetSettings` 셀렉트박스에 자동 노출

### CHART/TABLE 위젯 SObject 화이트리스트 관리
- Setup → Custom Metadata Types → **CM Dashboard SObject Config** → Manage Records에서 추가
- UI에서 레코드 추가 시 커스텀 필드가 안 보이면: 해당 CMT → Page Layouts → 편집 → 필드 추가 후 저장
- `SObjectApiName__c`는 정확한 API 이름 필수 (예: `Order`, `Account`). 비어있으면 필터링됨
- `AllowChart__c` / `AllowTable__c` / `IsActive__c` 는 null이면 허용으로 간주 (`!= false` 조건)
- `AllowedAggregations__c`: 쉼표 구분 (예: `COUNT,SUM,AVG`). 비워두면 전체 허용

### 권한 구조
- **관리자**: `Dashboard_Admin` Custom Permission 보유. `FeatureManagement.checkPermission('Dashboard_Admin')`으로 판별. Permission Set에 추가 후 사용자에 할당 필요.
- **일반 사용자**: Audience 매칭된 대시보드만 열람. 위젯 편집 가능하나 저장은 개인 레이아웃(`CM_UserDashboardLayout__c`)에만 저장.
- `isAdmin()` Apex 메서드는 `cacheable=false` — LWC에서 반드시 imperative 호출 사용. `@wire` 사용 시 캐싱으로 권한 판별 오류 발생.

### Apex 주의사항
- 일반 사용자는 `CM_Dashboard__c` CRUD 권한이 없으므로 조회 쿼리에 `WITH USER_MODE` 사용 불가 → `WITH SYSTEM_MODE` 사용
- `CM_UserDashboardLayout__c` DML도 시스템 모드로 처리 (`upsert rec FieldName__c` / `delete rows`)
- Custom Metadata SOQL은 `cacheable=true`여도 메타데이터 배포 후 반영됨. 단 런타임 캐시 이슈가 있으면 `cacheable=false` + imperative 호출로 전환
- Custom Metadata Boolean 필드는 UI 추가 시 null이 될 수 있으므로 `== true` 대신 `!= false` 비교

### Custom Metadata 레코드 파일 형식
`force-app/main/default/customMetadata/` 에 `.md-meta.xml` 파일 생성 시 루트 태그에 반드시 xsi/xsd 네임스페이스 선언 필요:
```xml
<CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:xsd="http://www.w3.org/2001/XMLSchema">
```
누락 시 배포 시 `UNKNOWN_EXCEPTION` 발생.

### FlexiPage 배포 주의사항
`CM_DashboardAppPage.flexipage-meta.xml`은 컴포넌트 바인딩 없이 배포된다.
배포 후 **설정 → Lightning App Builder → CM Dashboard**에서 `cmDashboardApp`을 캔버스에 추가하고 저장·활성화해야 한다.
