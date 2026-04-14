/**
 * @description 위젯 설정 팝업 컴포넌트
 *              타입별 설정 폼 UI를 담당합니다.
 *              새 위젯 타입 추가 시 이 파일의 게터와 HTML 섹션을 추가합니다.
 */
import { LightningElement, api } from 'lwc';
import { WIDGET_TYPE } from 'c/dashboardConstants';

export default class CmDashboardWidgetSettings extends LightningElement {

    /** 편집 중인 위젯 데이터 (부모가 관리, read-only) */
    @api draft = {};

    /** COMPONENT 타입 드롭다운 목록 */
    @api availableComponentOptions = [];

    // ── 타입 판별 게터 ──────────────────────────────────────────────
    // 새 위젯 타입 추가 시 아래에 게터를 추가합니다.

    get isText()      { return this.draft?.widgetType === WIDGET_TYPE.TEXT; }
    get isImage()     { return this.draft?.widgetType === WIDGET_TYPE.IMAGE; }
    get isComponent() { return this.draft?.widgetType === WIDGET_TYPE.COMPONENT; }
    get isReport()    { return this.draft?.widgetType === WIDGET_TYPE.REPORT; }
    get isChart()     { return this.draft?.widgetType === WIDGET_TYPE.CHART; }
    get isTable()     { return this.draft?.widgetType === WIDGET_TYPE.TABLE; }

    // CHART 집계 방식 선택 상태
    get isAggCount()    { return (this.draft?.chartAggregation || 'COUNT') === 'COUNT'; }
    get isAggSum()      { return this.draft?.chartAggregation === 'SUM'; }
    get isAggAvg()      { return this.draft?.chartAggregation === 'AVG'; }

    // CHART 타입 선택 상태
    get isChartBar()      { return (this.draft?.chartType || 'bar') === 'bar'; }
    get isChartLine()     { return this.draft?.chartType === 'line'; }
    get isChartPie()      { return this.draft?.chartType === 'pie'; }
    get isChartDoughnut() { return this.draft?.chartType === 'doughnut'; }

    // ── 이벤트 핸들러 ───────────────────────────────────────────────

    /** 필드 값 변경 시 부모로 fieldchange 이벤트 전달 */
    handleFieldChange(event) {
        const field = event.currentTarget.dataset.field;
        const value = event.target.value;
        this.dispatchEvent(new CustomEvent('fieldchange', {
            detail: { field, value },
        }));
    }

    handleSave() {
        this.dispatchEvent(new CustomEvent('settingssave'));
    }

    handleCancel() {
        this.dispatchEvent(new CustomEvent('settingscancel'));
    }
}
