/**
 * @description [영업포털-대시보드] 편집 모달
 *              드래그&드롭 위젯 배치, 리사이즈, 설정 팝업을 담당합니다.
 *
 *              새 위젯 타입 추가 시:
 *                1. dashboardConstants.js 의 WIDGET_TYPE 에 타입 추가
 *                2. BASIC_PALETTE 또는 컴포넌트 팔레트 항목 추가
 *                3. cmDashboardWidgetSettings 에 타입 전용 설정 섹션 추가
 */
import { LightningElement, api, track } from 'lwc';
import { COLS, DEFAULT_COL_SPAN, DEFAULT_ROW_SPAN, CELL_H_PX, GAP_PX } from 'c/dashboardConstants';
import { enrich, strip, createFromPalette } from 'c/dashboardWidgetUtils';

const BASIC_PALETTE = [
    { id: 'basic_text',   widgetType: 'TEXT',   icon: '📝', name: '텍스트 위젯',  desc: '제목과 텍스트 표시'          },
    { id: 'basic_image',  widgetType: 'IMAGE',  icon: '🖼',  name: '이미지 위젯', desc: 'URL 기반 이미지 표시'        },
    { id: 'basic_report', widgetType: 'REPORT', icon: '📈', name: '리포트 위젯', desc: 'Salesforce 리포트 임베드'    },
    { id: 'basic_chart',  widgetType: 'CHART',  icon: '📊', name: '차트 위젯',   desc: '오브젝트 기반 집계 차트'     },
    { id: 'basic_table',  widgetType: 'TABLE',  icon: '📋', name: '테이블 위젯', desc: '오브젝트 기반 커스텀 테이블' },
];

export default class CmDashboardEditModal extends LightningElement {

    @api initialWidgets      = [];
    @api availableComponents = [];

    @track canvasWidgets    = [];
    @track isDragOverCanvas = false;
    @track searchKeyword    = '';
    @track dropPreview      = null;

    @track settingsWidgetId = null;
    @track settingsDraft    = null;

    // 드래그 상태
    _dragSource      = null;   // 'palette' | 'canvas'
    _dragData        = null;
    _dragWidgetId    = null;
    _dragWidgetOrig  = null;

    // 리사이즈 상태
    _resizing          = false;
    _resizeWidgetId    = null;
    _resizeStartX      = 0;
    _resizeStartY      = 0;
    _resizeOrigColSpan = 0;
    _resizeOrigRowSpan = 0;
    _cellW             = 0;

    // 그리드 캐시
    _gridRect = null;

    connectedCallback() {
        this.canvasWidgets = (this.initialWidgets || []).map(w => enrich({ ...w }));
    }

    // ── Getters ─────────────────────────────────────────────────────

    get isCanvasEmpty() { return !this.canvasWidgets?.length; }
    get widgetCount()   { return this.canvasWidgets.length; }
    get canvasClass()   { return `canvas-grid${this.isDragOverCanvas ? ' canvas-grid--drag-over' : ''}`; }
    get isSettingsOpen(){ return !!this.settingsWidgetId; }

    get basicPaletteItems() { return BASIC_PALETTE; }

    get filteredComponentItems() {
        const items = (this.availableComponents || []).map(c => ({
            id           : `apex_${c.value}`,
            widgetType   : 'COMPONENT',
            componentName: c.value,
            icon         : '⚙️',
            name         : c.label,
            desc         : c.description || '',
            category     : c.category || '컴포넌트',
        }));
        if (!this.searchKeyword) return items;
        const kw = this.searchKeyword.toLowerCase();
        return items.filter(i =>
            i.name.toLowerCase().includes(kw) ||
            i.desc.toLowerCase().includes(kw) ||
            (i.category || '').toLowerCase().includes(kw)
        );
    }

    get noComponentResults() {
        return this.filteredComponentItems.length === 0 && !!this.searchKeyword;
    }

    get availableComponentOptions() {
        const current = this.settingsDraft?.componentName;
        return (this.availableComponents || []).map(c => ({
            label     : c.label,
            value     : c.value,
            isSelected: c.value === current,
        }));
    }

    get gridGuideColumns() {
        if (!this._gridRect) return [];
        const cellW = (this._gridRect.width - GAP_PX * (COLS - 1)) / COLS;
        return Array.from({ length: COLS }, (_, i) => ({
            key  : `gc_${i}`,
            style: `left:${i * (cellW + GAP_PX)}px; width:${cellW}px;`,
        }));
    }

    // ── 팔레트 드래그 ───────────────────────────────────────────────

    handlePaletteDragStart(event) {
        this._dragSource = 'palette';
        this._dragData   = {
            paletteId    : event.currentTarget.dataset.paletteId,
            widgetType   : event.currentTarget.dataset.widgetType,
            componentName: event.currentTarget.dataset.componentName || '',
        };
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData('text/plain', 'palette');
    }

    handlePaletteDragEnd() {
        this._dragSource = null;
        this._dragData   = null;
        this.dropPreview = null;
    }

    // ── 캔버스 위젯 드래그 ──────────────────────────────────────────

    handleWidgetDragStart(event) {
        const id     = event.currentTarget.dataset.widgetId;
        const widget = this.canvasWidgets.find(w => w.widgetId === id);
        if (!widget) return;

        this._dragSource     = 'canvas';
        this._dragWidgetId   = id;
        this._dragWidgetOrig = {
            colStart: widget.colStart, rowStart: widget.rowStart,
            colSpan : widget.colSpan,  rowSpan : widget.rowSpan,
        };

        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', 'canvas');
        this._cacheGridRect();
        this._mutateWidget(id, { _isDragging: true });
    }

    handleWidgetDragEnd() {
        if (this._dragSource === 'canvas' && this._dragWidgetId) {
            this._mutateWidget(this._dragWidgetId, { _isDragging: false });
        }
        this._dragSource     = null;
        this._dragData       = null;
        this._dragWidgetId   = null;
        this._dragWidgetOrig = null;
        this.dropPreview     = null;
    }

    // ── 캔버스 드롭 영역 ─────────────────────────────────────────────

    handleCanvasDragOver(event) {
        event.preventDefault();
        this.isDragOverCanvas = true;
        this._cacheGridRect();

        const colSpan = this._dragSource === 'canvas'
            ? (this._dragWidgetOrig?.colSpan || DEFAULT_COL_SPAN)
            : DEFAULT_COL_SPAN;
        const rowSpan = this._dragSource === 'canvas'
            ? (this._dragWidgetOrig?.rowSpan || DEFAULT_ROW_SPAN)
            : DEFAULT_ROW_SPAN;

        const { col, row } = this._coordToCell(event.clientX, event.clientY);
        const clampedCol   = Math.max(1, Math.min(col, COLS - colSpan + 1));
        const clampedRow   = Math.max(1, row);

        this.dropPreview = this._makePreviewStyle(clampedCol, clampedRow, colSpan, rowSpan);
    }

    handleCanvasDragLeave(event) {
        const grid = this.template.querySelector('.canvas-grid');
        if (grid && !grid.contains(event.relatedTarget)) {
            this.isDragOverCanvas = false;
            this.dropPreview      = null;
        }
    }

    handleCanvasDrop(event) {
        event.preventDefault();
        this.isDragOverCanvas = false;
        this.dropPreview      = null;
        this._cacheGridRect();

        const { col, row } = this._coordToCell(event.clientX, event.clientY);

        if (this._dragSource === 'palette' && this._dragData) {
            const cs       = Math.max(1, Math.min(col, COLS - DEFAULT_COL_SPAN + 1));
            const rs       = Math.max(1, row);
            const newWidget = createFromPalette(
                this._dragData,
                { colStart: cs, rowStart: rs },
                this.availableComponents
            );
            this.canvasWidgets = this._compact(this._insertWidgetAt(newWidget, this.canvasWidgets));

        } else if (this._dragSource === 'canvas' && this._dragWidgetId) {
            const widget = this.canvasWidgets.find(w => w.widgetId === this._dragWidgetId);
            if (widget) {
                const cs    = Math.max(1, Math.min(col, COLS - widget.colSpan + 1));
                const rs    = Math.max(1, row);
                const moved = { ...widget, colStart: cs, rowStart: rs, _isDragging: false };
                const others = this.canvasWidgets.filter(w => w.widgetId !== this._dragWidgetId);
                this.canvasWidgets = this._compact(this._insertWidgetAt(moved, others));
            }
        }

        this._dragSource     = null;
        this._dragData       = null;
        this._dragWidgetId   = null;
        this._dragWidgetOrig = null;
    }

    // ── 위젯 삭제 ────────────────────────────────────────────────────

    handleWidgetDelete(event) {
        event.stopPropagation();
        const id = event.currentTarget.dataset.widgetId;
        this.canvasWidgets = this._compact(
            this.canvasWidgets.filter(w => w.widgetId !== id)
        );
    }

    // ── 설정 팝업 ────────────────────────────────────────────────────

    handleWidgetSettings(event) {
        event.stopPropagation();
        const id = event.currentTarget.dataset.widgetId;
        const w  = this.canvasWidgets.find(x => x.widgetId === id);
        if (!w) return;
        this.settingsWidgetId = id;
        this.settingsDraft    = { ...w };
    }

    /** cmDashboardWidgetSettings 의 fieldchange 이벤트 수신 */
    handleSettingsFieldChange(event) {
        const { field, value } = event.detail;
        const val = (field === 'colSpan' || field === 'rowSpan')
            ? Math.max(1, parseInt(value, 10) || 1)
            : value;
        this.settingsDraft = { ...this.settingsDraft, [field]: val };
    }

    handleSettingsSave() {
        if (!this.settingsDraft) return;
        const draft   = this.settingsDraft;
        const colSpan = Math.min(draft.colSpan || DEFAULT_COL_SPAN, COLS - (draft.colStart || 1) + 1);
        const patched = { ...draft, colSpan };
        const others  = this.canvasWidgets.filter(w => w.widgetId !== patched.widgetId);
        this.canvasWidgets    = this._compact(this._insertWidgetAt(patched, others));
        this.settingsWidgetId = null;
        this.settingsDraft    = null;
    }

    handleSettingsCancel() {
        this.settingsWidgetId = null;
        this.settingsDraft    = null;
    }

    handleSearchChange(event) {
        this.searchKeyword = (event.detail ? event.detail.value : event.target.value) || '';
    }

    // ── 리사이즈 ─────────────────────────────────────────────────────

    handleResizeStart(event) {
        event.stopPropagation();
        event.preventDefault();
        const id     = event.currentTarget.dataset.widgetId;
        const widget = this.canvasWidgets.find(w => w.widgetId === id);
        if (!widget) return;

        this._resizing          = true;
        this._resizeWidgetId    = id;
        this._resizeStartX      = event.clientX;
        this._resizeStartY      = event.clientY;
        this._resizeOrigColSpan = widget.colSpan;
        this._resizeOrigRowSpan = widget.rowSpan;
        this._cacheGridRect();

        if (this._gridRect) {
            this._cellW = (this._gridRect.width - GAP_PX * (COLS - 1)) / COLS;
        }

        this._boundResizeMove = this._onResizeMove.bind(this);
        this._boundResizeEnd  = this._onResizeEnd.bind(this);
        window.addEventListener('mousemove', this._boundResizeMove);
        window.addEventListener('mouseup',   this._boundResizeEnd);
    }

    _onResizeMove(event) {
        if (!this._resizing) return;
        const dx     = event.clientX - this._resizeStartX;
        const dy     = event.clientY - this._resizeStartY;
        const newCol = Math.max(1, Math.min(
            this._resizeOrigColSpan + Math.round(dx / (this._cellW + GAP_PX)), COLS
        ));
        const newRow = Math.max(1, this._resizeOrigRowSpan + Math.round(dy / CELL_H_PX));

        const target = this.canvasWidgets.find(w => w.widgetId === this._resizeWidgetId);
        if (!target) return;

        const maxColSpan = COLS - (target.colStart || 1) + 1;
        const patched    = { ...target, colSpan: Math.min(newCol, maxColSpan), rowSpan: newRow };
        const others     = this.canvasWidgets.filter(w => w.widgetId !== this._resizeWidgetId);

        this.canvasWidgets = [
            enrich(patched),
            ...this._pushDownConflicts(patched, others).map(w => enrich(w)),
        ];
    }

    _onResizeEnd() {
        this._resizing     = false;
        this.canvasWidgets = this._compact(this.canvasWidgets);
        window.removeEventListener('mousemove', this._boundResizeMove);
        window.removeEventListener('mouseup',   this._boundResizeEnd);
    }

    // ── 저장 / 취소 ──────────────────────────────────────────────────

    handleSave() {
        const payload = this.canvasWidgets.map(w => strip(w));
        this.dispatchEvent(new CustomEvent('dashboardsave', {
            detail: { widgets: payload }, bubbles: true, composed: true,
        }));
    }

    handleCancel() {
        this.dispatchEvent(new CustomEvent('dashboardcancel', { bubbles: true, composed: true }));
    }

    // ── Private: 그리드 좌표 계산 ────────────────────────────────────

    _cacheGridRect() {
        const grid = this.template.querySelector('.canvas-grid');
        if (grid) this._gridRect = grid.getBoundingClientRect();
    }

    _coordToCell(clientX, clientY) {
        if (!this._gridRect) return { col: 1, row: 1 };
        const pad   = 8;
        const localX = clientX - this._gridRect.left - pad;
        const localY = clientY - this._gridRect.top  - pad;
        const cellW  = (this._gridRect.width - pad * 2 - GAP_PX * (COLS - 1)) / COLS;
        const col    = Math.max(1, Math.floor(localX / (cellW + GAP_PX)) + 1);
        const row    = Math.max(1, Math.floor(localY / CELL_H_PX) + 1);
        return { col, row };
    }

    _makePreviewStyle(colStart, rowStart, colSpan, rowSpan) {
        if (!this._gridRect) return null;
        const pad   = 8;
        const cellW = (this._gridRect.width - pad * 2 - GAP_PX * (COLS - 1)) / COLS;
        const cellH = 72;
        const x     = pad + (colStart - 1) * (cellW + GAP_PX);
        const y     = pad + (rowStart - 1) * CELL_H_PX;
        const w     = colSpan * cellW + (colSpan - 1) * GAP_PX;
        const h     = rowSpan * cellH + (rowSpan - 1) * GAP_PX;
        return { style: `left:${x}px; top:${y}px; width:${w}px; height:${h}px;` };
    }

    // ── Private: 레이아웃 연산 ────────────────────────────────────────

    _insertWidgetAt(target, others) {
        const queue = [
            { widget: { ...target }, pinned: true },
            ...others.map(w => ({ widget: { ...w }, pinned: false })),
        ];
        const placed  = [];
        const maxIter = COLS * 20;
        let   iter    = 0;

        while (queue.length > 0 && iter++ < maxIter) {
            const { widget: cur, pinned } = queue.shift();
            const conflict = placed.find(p => this._overlaps(cur, p));

            if (!conflict || pinned) {
                placed.push({ ...cur });
                continue;
            }

            const rightCol = (conflict.colStart || 1) + (conflict.colSpan || DEFAULT_COL_SPAN);
            if (rightCol + (cur.colSpan || DEFAULT_COL_SPAN) - 1 <= COLS) {
                queue.unshift({ widget: { ...cur, colStart: rightCol }, pinned: false });
            } else {
                const belowRow = (conflict.rowStart || 1) + (conflict.rowSpan || DEFAULT_ROW_SPAN);
                queue.unshift({ widget: { ...cur, colStart: 1, rowStart: belowRow }, pinned: false });
            }
        }

        if (queue.length > 0) {
            const maxRow = placed.reduce(
                (m, p) => Math.max(m, (p.rowStart || 1) + (p.rowSpan || DEFAULT_ROW_SPAN) - 1), 0
            );
            queue.forEach(({ widget: w }) => placed.push({ ...w, colStart: 1, rowStart: maxRow + 1 }));
        }

        return placed.map(w => enrich(w));
    }

    _overlaps(a, b) {
        const aC1 = a.colStart || 1, aR1 = a.rowStart || 1;
        const aC2 = aC1 + (a.colSpan || DEFAULT_COL_SPAN) - 1;
        const aR2 = aR1 + (a.rowSpan || DEFAULT_ROW_SPAN) - 1;
        const bC1 = b.colStart || 1, bR1 = b.rowStart || 1;
        const bC2 = bC1 + (b.colSpan || DEFAULT_COL_SPAN) - 1;
        const bR2 = bR1 + (b.rowSpan || DEFAULT_ROW_SPAN) - 1;
        return aC1 <= bC2 && aC2 >= bC1 && aR1 <= bR2 && aR2 >= bR1;
    }

    _pushDownConflicts(target, others) {
        const tC1 = target.colStart || 1, tR1 = target.rowStart || 1;
        const tC2 = tC1 + (target.colSpan || DEFAULT_COL_SPAN) - 1;
        const tR2 = tR1 + (target.rowSpan || DEFAULT_ROW_SPAN) - 1;

        return others.map(w => {
            const wC1 = w.colStart || 1, wR1 = w.rowStart || 1;
            const wC2 = wC1 + (w.colSpan || DEFAULT_COL_SPAN) - 1;
            const wR2 = wR1 + (w.rowSpan || DEFAULT_ROW_SPAN) - 1;
            const colOv = wC1 <= tC2 && wC2 >= tC1;
            const rowOv = wR1 <= tR2 && wR2 >= tR1;
            return (colOv && rowOv) ? { ...w, rowStart: tR2 + 1 } : w;
        });
    }

    _compact(widgets) {
        if (!widgets.length) return [];
        const sorted = [...widgets].sort((a, b) => {
            const dr = (a.rowStart || 1) - (b.rowStart || 1);
            return dr !== 0 ? dr : (a.colStart || 1) - (b.colStart || 1);
        });
        const placed = [];
        for (const w of sorted) {
            const cs  = w.colStart || 1;
            const csp = w.colSpan  || DEFAULT_COL_SPAN;
            let targetRow = 1;
            for (const p of placed) {
                const pRowEnd = (p.rowStart || 1) + (p.rowSpan || DEFAULT_ROW_SPAN) - 1;
                const pColEnd = (p.colStart || 1) + (p.colSpan || DEFAULT_COL_SPAN) - 1;
                if (cs <= pColEnd && (cs + csp - 1) >= (p.colStart || 1)) {
                    targetRow = Math.max(targetRow, pRowEnd + 1);
                }
            }
            placed.push(enrich({ ...w, rowStart: targetRow }));
        }
        return placed;
    }

    _mutateWidget(widgetId, patch) {
        this.canvasWidgets = this.canvasWidgets.map(w =>
            w.widgetId === widgetId ? enrich({ ...w, ...patch }) : w
        );
    }

    disconnectedCallback() {
        if (this._boundResizeMove) window.removeEventListener('mousemove', this._boundResizeMove);
        if (this._boundResizeEnd)  window.removeEventListener('mouseup',   this._boundResizeEnd);
    }
}
