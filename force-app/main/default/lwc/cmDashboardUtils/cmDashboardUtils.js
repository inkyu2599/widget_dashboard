/**
 * @description [CM-대시보드] 공통 유틸리티
 */
import { WIDGET_TYPE, GRID_COLS, DEFAULT_W, DEFAULT_H } from 'c/cmDashboardConstants';

/** UUID 생성 */
export function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        // eslint-disable-next-line no-bitwise
        const r = (Math.random() * 16) | 0;
        // eslint-disable-next-line no-bitwise
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/** 빈 위젯 생성 (x/y는 호출자가 findFreeSlot으로 설정) */
export function createEmptyWidget(type = WIDGET_TYPE.COMPONENT, x = 0, y = 0) {
    const base = {
        widgetId  : generateId(),
        widgetType: type,
        title     : defaultTitle(type),
        x, y,
        w         : DEFAULT_W,
        h         : DEFAULT_H,
    };
    if (type === WIDGET_TYPE.CHART) {
        return { ...base, chartSObject:'', chartGroupBy:'', chartValueField:'',
                 chartAggregation:'COUNT', chartType:'bar' };
    }
    if (type === WIDGET_TYPE.TABLE) {
        return { ...base, tableSObject:'', tableFields:'', tableWhereClause:'',
                 tableOrderBy:'', tableLimit:50 };
    }
    return { ...base, componentName:'', componentConfig:{} };
}

function defaultTitle(type) {
    const map = {
        [WIDGET_TYPE.COMPONENT]: '컴포넌트 위젯',
        [WIDGET_TYPE.CHART]    : '차트 위젯',
        [WIDGET_TYPE.TABLE]    : '테이블 위젯',
    };
    return map[type] || '위젯';
}

/**
 * 현재 위젯 배열에서 w×h 크기의 빈 슬롯 첫 위치 반환
 */
export function findFreeSlot(widgets, w = DEFAULT_W, h = DEFAULT_H) {
    const occupied = new Set();
    widgets.forEach(widget => {
        const wx = widget.x || 0;
        const wy = widget.y || 0;
        const ww = widget.w || DEFAULT_W;
        const wh = widget.h || DEFAULT_H;
        for (let col = wx; col < wx + ww; col++) {
            for (let row = wy; row < wy + wh; row++) {
                occupied.add(`${col},${row}`);
            }
        }
    });

    for (let row = 0; row < 100; row++) {
        for (let col = 0; col <= GRID_COLS - w; col++) {
            let fits = true;
            outer: for (let dc = 0; dc < w; dc++) {
                for (let dr = 0; dr < h; dr++) {
                    if (occupied.has(`${col + dc},${row + dr}`)) {
                        fits = false;
                        break outer;
                    }
                }
            }
            if (fits) return { x: col, y: row };
        }
    }
    return { x: 0, y: 0 };
}

/**
 * 레이아웃 JSON 파싱 + 구 포맷 마이그레이션
 * 결과는 항상 { widgets: [...] } 형태
 */
export function parseLayout(json) {
    let src;
    if (!json) return { widgets: [] };
    try { src = JSON.parse(json); } catch (e) { return { widgets: [] }; }

    // 신규 포맷
    if (src.widgets) {
        return { widgets: _ensureGridProps(src.widgets) };
    }

    // 구 rows 포맷 마이그레이션
    const widgets = [];
    let y = 0;
    (src.rows || []).forEach(row => {
        const cols = row.columns || (row.widgets || []).length || 1;
        const w = Math.floor(GRID_COLS / cols);
        (row.widgets || []).forEach((widget, i) => {
            widgets.push({ ...widget, x: i * w, y, w, h: DEFAULT_H });
        });
        y += DEFAULT_H;
    });
    return { widgets };
}

/** colSpan만 있고 x/y/w/h 없는 위젯에 그리드 좌표 부여 */
function _ensureGridProps(widgets) {
    let curX = 0, curY = 0;
    return widgets.map(w => {
        if (w.x !== undefined && w.w !== undefined) return w;
        const ww = w.colSpan ? Math.min(w.colSpan * 4, GRID_COLS) : DEFAULT_W;
        if (curX + ww > GRID_COLS) { curY += DEFAULT_H; curX = 0; }
        const placed = { ...w, x: curX, y: curY, w: ww, h: DEFAULT_H };
        delete placed.colSpan;
        curX += ww;
        return placed;
    });
}

/** 레이아웃 → JSON 직렬화 */
export function stringifyLayout(layout) {
    return JSON.stringify(layout);
}
