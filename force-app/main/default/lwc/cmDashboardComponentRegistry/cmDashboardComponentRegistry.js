/**
 * @description [CM-대시보드] 커스텀 컴포넌트 레지스트리
 *
 * 새 부서 컴포넌트를 대시보드에 등록하는 방법:
 * 1. 이 파일에 import 추가
 *    예) import MyWidget from 'c/myWidget';
 * 2. REGISTRY 객체에 항목 추가
 *    예) 'c-my-widget': MyWidget,
 * 3. CM_DashboardComponent__mdt 레코드 추가
 *    - ComponentName__c: 'c-my-widget'
 *    - IsActive__c: true
 *
 * ── 부서 컴포넌트 추가 예시 ──────────────────────────────────────
 * import DeptSalesTable from 'c/deptSalesTable';
 * import DeptHRSummary  from 'c/deptHRSummary';
 *
 * const REGISTRY = {
 *     'c-dept-sales-table' : DeptSalesTable,
 *     'c-dept-hr-summary'  : DeptHRSummary,
 * };
 * ─────────────────────────────────────────────────────────────────
 */

// ↓ 부서 컴포넌트 import를 여기에 추가하세요
// import DeptSalesTable from 'c/deptSalesTable';

const REGISTRY = {
    // ↓ 컴포넌트 등록을 여기에 추가하세요
    // 'c-dept-sales-table': DeptSalesTable,
};

/**
 * 컴포넌트 이름으로 LWC 생성자를 반환합니다.
 * @param {string} name - CM_DashboardComponent__mdt의 ComponentName__c 값 (예: 'c-dept-sales-table')
 * @returns {Function|null} LWC 생성자 또는 null
 */
export function getComponent(name) {
    if (!name) return null;
    return REGISTRY[name] || null;
}
