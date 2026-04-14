/**
 * @description  [영업포털-대시보드] CSS Grid 기반 위젯 레이아웃 컴포넌트
 * @author       Dashboard Team
 * @date         2026-03-06
 */
import { LightningElement, api, track } from 'lwc';

const MODE_EDIT  = 'EDIT';
const GRID_GAP   = 12;  // px

export default class CmDashboardGrid extends LightningElement {

    @api mode    = 'DEFAULT';
    @api columns = 12;

    @track _widgets = [];

    @api
    get widgets() { return this._widgets; }
    set widgets(val) {
        this._widgets = val ? [...val] : [];
    }

    // ── Getters ──────────────────────────────────────────────────

    get isEditMode() { return this.mode === MODE_EDIT; }
    get isEmpty()    { return !this._widgets?.length; }

    /**
     * @description CSS Grid 컨테이너 인라인 스타일
     *   grid-template-columns : columns 등분 (각 1fr)
     *   grid-auto-rows        : 최소 80px, 내용에 따라 자동 확장
     */
    get gridStyle() {
        return [
            'display: grid',
            `grid-template-columns: repeat(${this.columns}, 1fr)`,
            `grid-auto-rows: minmax(80px, auto)`,
            `gap: ${GRID_GAP}px`,
            'width: 100%',
        ].join('; ');
    }

    // ── 이벤트 버블링 ─────────────────────────────────────────────

    handleWidgetResize(event) {
        this.dispatchEvent(new CustomEvent('widgetresize', { detail: event.detail }));
    }

    handleWidgetMove(event) {
        this.dispatchEvent(new CustomEvent('widgetmove', { detail: event.detail }));
    }

    handleWidgetDelete(event) {
        this.dispatchEvent(new CustomEvent('widgetdelete', { detail: event.detail }));
    }

    handleWidgetEdit(event) {
        this.dispatchEvent(new CustomEvent('widgetedit', { detail: event.detail }));
    }
}
