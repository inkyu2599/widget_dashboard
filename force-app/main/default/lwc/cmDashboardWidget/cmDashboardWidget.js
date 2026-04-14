/**
 * @description [영업포털-대시보드] 개별 위젯 컨테이너 (뷰 모드 전용)
 *              - TEXT / IMAGE / COMPONENT 타입별 렌더링 분기
 *              - 편집은 cmDashboardEditModal 캔버스에서 처리
 *
 *              새 위젯 타입 추가 시:
 *                1. dashboardConstants.js 의 WIDGET_TYPE 에 타입 추가
 *                2. 아래 타입 판별 게터 추가
 *                3. cmDashboardWidget.html 에 렌더링 분기 추가
 */
import { LightningElement, api } from 'lwc';
import { WIDGET_TYPE } from 'c/dashboardConstants';

export default class CmDashboardWidget extends LightningElement {

    @api widget  = {};
    @api mode    = 'DEFAULT';
    @api columns = 12;

    // ── 타입 판별 게터 ──────────────────────────────────────────────
    // 새 위젯 타입 추가 시 아래에 게터를 추가합니다.

    get isTextWidget()      { return this.widget?.widgetType === WIDGET_TYPE.TEXT; }
    get isImageWidget()     { return this.widget?.widgetType === WIDGET_TYPE.IMAGE; }
    get isComponentWidget() { return this.widget?.widgetType === WIDGET_TYPE.COMPONENT; }
    get isReportWidget()    { return this.widget?.widgetType === WIDGET_TYPE.REPORT; }
    get isChartWidget()     { return this.widget?.widgetType === WIDGET_TYPE.CHART; }
    get isTableWidget()     { return this.widget?.widgetType === WIDGET_TYPE.TABLE; }
    get isDeletable()       { return !this.widget?.isFixed; }

    get widgetStyle() {
        const { colStart = 1, rowStart = 1, colSpan = 4, rowSpan = 3 } = this.widget || {};
        return [
            `grid-column: ${colStart} / span ${colSpan}`,
            `grid-row: ${rowStart} / span ${rowSpan}`,
        ].join('; ');
    }

    get contentStyle() {
        return 'height: 100%; padding: 0;';
    }

    // ── 이벤트 ──────────────────────────────────────────────────────

    handleEdit(event) {
        event.stopPropagation();
        this.dispatchEvent(new CustomEvent('widgetedit', {
            detail: { ...this.widget },
            bubbles: true, composed: true,
        }));
    }

    handleDelete(event) {
        event.stopPropagation();
        this.dispatchEvent(new CustomEvent('widgetdelete', {
            detail: { widgetId: this.widget.widgetId },
            bubbles: true, composed: true,
        }));
    }
}
