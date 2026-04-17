/**
 * @description [CM-대시보드] COMPONENT 위젯 렌더러
 *
 * ── 새 부서 컴포넌트 등록 방법 (3단계) ─────────────────────────────
 * 1. REGISTERED_NAMES에 컴포넌트 이름 추가 (JS import 불필요 — HTML 태그로 자동 해석)
 *
 * 2. registeredNames Set에 컴포넌트 이름 추가
 *    예) 'c-dept-sales-table',
 *
 * 3. cmDbComponent.html에 lwc:if 블록 추가
 *    예) <template lwc:if={isDeptSalesTable}>
 *            <c-dept-sales-table widget={widget}></c-dept-sales-table>
 *        </template>
 *
 * 4. CM_DashboardComponent__mdt 레코드 추가
 *    - ComponentName__c : 'c-dept-sales-table'
 *    - IsActive__c      : true
 * ─────────────────────────────────────────────────────────────────────
 */

import { LightningElement, api } from 'lwc';

/** 등록된 컴포넌트 이름 목록 — 새 컴포넌트 추가 시 여기에도 추가 */
const REGISTERED_NAMES = new Set([
    'c-dept-sales-oppty',
]);

export default class CmDbComponent extends LightningElement {
    @api widget = {};

    get isConfigured()     { return !!this.widget?.componentName; }
    get isRegistered()     { return REGISTERED_NAMES.has(this.widget?.componentName); }
    get isNotRegistered()  { return this.isConfigured && !this.isRegistered; }

    // ↓ 부서 컴포넌트 getter를 여기에 추가하세요
    get isDeptSalesOppty() { return this.widget?.componentName === 'c-dept-sales-oppty'; }
}
