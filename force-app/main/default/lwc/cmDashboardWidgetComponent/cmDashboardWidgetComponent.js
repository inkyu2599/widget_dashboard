/**
 * @description [영업포털-대시보드] LWC 컴포넌트 위젯
 *              componentName 에 따라 등록된 예시 컴포넌트 렌더링
 * @author      Dashboard Team
 * @date        2026-03-06
 */
import { LightningElement, api } from 'lwc';

export default class CmDashboardWidgetComponent extends LightningElement {
    @api widget = {};
    @api mode   = 'DEFAULT';

    get isSalesKpi()  { return this.widget?.componentName === 'c-cm-dashboard-sample-sales-kpi'; }
    get isPipeline()  { return this.widget?.componentName === 'c-cm-dashboard-sample-pipeline'; }
    get isActivity()  { return this.widget?.componentName === 'c-cm-dashboard-sample-activity'; }
    get isUnknown()   { return !this.isSalesKpi && !this.isPipeline && !this.isActivity; }
}
