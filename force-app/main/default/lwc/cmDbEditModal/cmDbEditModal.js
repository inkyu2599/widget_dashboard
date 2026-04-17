import { LightningElement, api, track } from 'lwc';
import { createEmptyWidget, findFreeSlot, parseLayout } from 'c/cmDashboardUtils';
import { WIDGET_TYPE, GRID_COLS, GRID_ROW_H, DEFAULT_W, DEFAULT_H } from 'c/cmDashboardConstants';

const MIN_W = 1;
const MIN_H = 1;

export default class CmDbEditModal extends LightningElement {

    @api
    get layout() { return this._layout; }
    set layout(val) {
        this._layout = val ? parseLayout(JSON.stringify(val)) : { widgets: [] };
        this._buildCanvasWidgets();
    }

    _layout          = { widgets: [] };
    @track canvasWidgets   = [];
    @track selectedWidget  = null;
    @track newWidgetType   = WIDGET_TYPE.CHART;

    _cellW             = 0;
    _cellWInit         = false;
    _selectedWidgetId  = null;

    // 드래그/리사이즈 상태
    _drag              = null;
    _boundMouseMove    = null;
    _boundMouseUp      = null;

    // ── 라이프사이클 ─────────────────────────────────────────────────

    renderedCallback() {
        if (this._cellWInit) return;
        const canvas = this.template.querySelector('.canvas');
        if (canvas && canvas.offsetWidth > 0) {
            this._cellW    = canvas.offsetWidth / GRID_COLS;
            this._cellWInit = true;
            this._buildCanvasWidgets();
        }
    }

    disconnectedCallback() {
        this._removeDocListeners();
    }

    // ── 타입 옵션 ────────────────────────────────────────────────────

    get typeOptions() {
        return [
            { label: '차트',     value: WIDGET_TYPE.CHART },
            { label: '테이블',   value: WIDGET_TYPE.TABLE },
            { label: '컴포넌트', value: WIDGET_TYPE.COMPONENT },
        ];
    }

    get isEmpty() { return this.canvasWidgets.length === 0; }

    get canvasStyle() {
        const maxRow = this._layout.widgets.reduce(
            (m, w) => Math.max(m, (w.y || 0) + (w.h || DEFAULT_H)), DEFAULT_H * 2);
        const height = maxRow * GRID_ROW_H + GRID_ROW_H; // 여유 공간
        return `height:${height}px;`;
    }

    // ── 위젯 추가 ────────────────────────────────────────────────────

    handleNewTypeChange(event) { this.newWidgetType = event.detail.value; }

    handleAddWidget() {
        const type = this.newWidgetType || WIDGET_TYPE.CHART;
        const slot  = findFreeSlot(this._layout.widgets, DEFAULT_W, DEFAULT_H);
        const widget = createEmptyWidget(type, slot.x, slot.y);
        this._layout = { widgets: [...this._layout.widgets, widget] };
        this._buildCanvasWidgets();
    }

    // ── 드래그 (이동) ────────────────────────────────────────────────

    handleDragStart(event) {
        if (event.button !== 0) return;
        event.preventDefault();
        const widgetId = event.currentTarget.dataset.widgetId;
        const widget   = this._layout.widgets.find(w => w.widgetId === widgetId);
        if (!widget) return;

        this._drag = {
            type        : 'move',
            widgetId,
            startMouseX : event.clientX,
            startMouseY : event.clientY,
            origX       : widget.x || 0,
            origY       : widget.y || 0,
        };
        this._addDocListeners();
    }

    // ── 리사이즈 ─────────────────────────────────────────────────────

    handleResizeStart(event) {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        const widgetId = event.currentTarget.dataset.widgetId;
        const widget   = this._layout.widgets.find(w => w.widgetId === widgetId);
        if (!widget) return;

        this._drag = {
            type        : 'resize',
            widgetId,
            startMouseX : event.clientX,
            startMouseY : event.clientY,
            origW       : widget.w || DEFAULT_W,
            origH       : widget.h || DEFAULT_H,
            origX       : widget.x || 0,
        };
        this._addDocListeners();
    }

    // ── 마우스 이벤트 ────────────────────────────────────────────────

    _addDocListeners() {
        this._boundMouseMove = this._onMouseMove.bind(this);
        this._boundMouseUp   = this._onMouseUp.bind(this);
        // eslint-disable-next-line no-restricted-globals
        document.addEventListener('mousemove', this._boundMouseMove);
        // eslint-disable-next-line no-restricted-globals
        document.addEventListener('mouseup', this._boundMouseUp);
    }

    _removeDocListeners() {
        if (this._boundMouseMove) {
            // eslint-disable-next-line no-restricted-globals
            document.removeEventListener('mousemove', this._boundMouseMove);
        }
        if (this._boundMouseUp) {
            // eslint-disable-next-line no-restricted-globals
            document.removeEventListener('mouseup', this._boundMouseUp);
        }
        this._boundMouseMove = null;
        this._boundMouseUp   = null;
    }

    _onMouseMove(event) {
        if (!this._drag || this._cellW === 0) return;
        const dx = event.clientX - this._drag.startMouseX;
        const dy = event.clientY - this._drag.startMouseY;

        const idx = this._layout.widgets.findIndex(w => w.widgetId === this._drag.widgetId);
        if (idx < 0) return;
        const widget  = this._layout.widgets[idx];
        let updated;

        if (this._drag.type === 'move') {
            const newX = Math.max(0, Math.min(
                GRID_COLS - (widget.w || DEFAULT_W),
                Math.round(this._drag.origX + dx / this._cellW)
            ));
            const newY = Math.max(0, Math.round(this._drag.origY + dy / GRID_ROW_H));
            updated = { ...widget, x: newX, y: newY };
        } else {
            const newW = Math.max(MIN_W, Math.min(
                GRID_COLS - (this._drag.origX),
                Math.round(this._drag.origW + dx / this._cellW)
            ));
            const newH = Math.max(MIN_H, Math.round(this._drag.origH + dy / GRID_ROW_H));
            updated = { ...widget, w: newW, h: newH };
        }

        const widgets = [...this._layout.widgets];
        widgets[idx]  = updated;
        this._layout  = { widgets };
        this._buildCanvasWidgets();
    }

    _onMouseUp() {
        this._drag = null;
        this._removeDocListeners();
        this._buildCanvasWidgets();
    }

    // ── 위젯 설정 ────────────────────────────────────────────────────

    handleSettingsClick(event) {
        event.stopPropagation();
        const widgetId = event.currentTarget.dataset.widgetId;
        const widget   = this._layout.widgets.find(w => w.widgetId === widgetId);
        if (!widget) return;
        this._selectedWidgetId = widgetId;
        this.selectedWidget    = { ...widget };
        this._buildCanvasWidgets();
    }

    handleWidgetApply(event) {
        const updated = event.detail.widget;
        const idx = this._layout.widgets.findIndex(w => w.widgetId === this._selectedWidgetId);
        if (idx >= 0) {
            const widgets = [...this._layout.widgets];
            // 위치/크기 유지
            widgets[idx] = {
                ...updated,
                x: this._layout.widgets[idx].x,
                y: this._layout.widgets[idx].y,
                w: this._layout.widgets[idx].w,
                h: this._layout.widgets[idx].h,
            };
            this._layout = { widgets };
        }
        this.selectedWidget    = null;
        this._selectedWidgetId = null;
        this._buildCanvasWidgets();
    }

    handleWidgetCancel() {
        this.selectedWidget    = null;
        this._selectedWidgetId = null;
        this._buildCanvasWidgets();
    }

    // ── 위젯 삭제 ────────────────────────────────────────────────────

    handleDeleteWidget(event) {
        event.stopPropagation();
        const widgetId = event.currentTarget.dataset.widgetId;
        this._layout   = { widgets: this._layout.widgets.filter(w => w.widgetId !== widgetId) };
        if (this._selectedWidgetId === widgetId) {
            this.selectedWidget    = null;
            this._selectedWidgetId = null;
        }
        this._buildCanvasWidgets();
    }

    // ── 캔버스 클릭 (빈 공간 → 선택 해제) ──────────────────────────

    handleCanvasClick(event) {
        if (event.target === event.currentTarget ||
            event.target.classList.contains('canvas') ||
            event.target.classList.contains('canvas-wrapper')) {
            this.selectedWidget    = null;
            this._selectedWidgetId = null;
            this._buildCanvasWidgets();
        }
    }

    // ── 저장/취소 ────────────────────────────────────────────────────

    handleSave() {
        this.dispatchEvent(new CustomEvent('save', {
            detail: { layout: JSON.parse(JSON.stringify(this._layout)) },
        }));
    }

    handleCancel() {
        this.dispatchEvent(new CustomEvent('cancel'));
    }

    stopPropagation(event) { event.stopPropagation(); }

    // ── 내부 헬퍼 ────────────────────────────────────────────────────

    _buildCanvasWidgets() {
        if (this._cellW === 0) {
            // cellW 미계산 시 빈 배열로 초기화만
            this.canvasWidgets = this._layout.widgets.map(w => ({ ...w, pixelStyle: '', cardClass: 'canvas-widget' }));
            return;
        }
        this.canvasWidgets = this._layout.widgets.map(w => {
            const x      = (w.x || 0) * this._cellW;
            const y      = (w.y || 0) * GRID_ROW_H;
            const width  = (w.w || DEFAULT_W) * this._cellW;
            const height = (w.h || DEFAULT_H) * GRID_ROW_H;
            const isSelected = w.widgetId === this._selectedWidgetId;
            return {
                ...w,
                pixelStyle: `left:${x}px;top:${y}px;width:${width}px;height:${height}px;`,
                cardClass : `canvas-widget${isSelected ? ' canvas-widget--selected' : ''}`,
            };
        });
    }
}
