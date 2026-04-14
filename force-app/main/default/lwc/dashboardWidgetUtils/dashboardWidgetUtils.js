/**
 * @description 대시보드 위젯 팩토리 유틸 모듈
 *              순수 함수만 포함 — LWC 인스턴스에 의존하지 않음
 *
 *              새 위젯 타입 추가 시:
 *                1. dashboardConstants.js 의 WIDGET_TYPE 에 타입 추가
 *                2. enrich(), defaultTitle() 에 해당 타입 분기 추가
 */
import { WIDGET_TYPE, DEFAULT_COL_SPAN, DEFAULT_ROW_SPAN, COLS } from 'c/dashboardConstants';

// ── UI 계산 속성 추가 ─────────────────────────────────────────────────

/**
 * 위젯 객체에 템플릿 바인딩용 계산 속성을 추가해 반환
 * @param {Object} w - 원본 위젯 데이터
 * @returns {Object} 계산 속성이 추가된 위젯
 */
export function enrich(w) {
    const isText      = w.widgetType === WIDGET_TYPE.TEXT;
    const isImage     = w.widgetType === WIDGET_TYPE.IMAGE;
    const isComponent = w.widgetType === WIDGET_TYPE.COMPONENT;
    const isReport    = w.widgetType === WIDGET_TYPE.REPORT;
    const isChart     = w.widgetType === WIDGET_TYPE.CHART;
    const isTable     = w.widgetType === WIDGET_TYPE.TABLE;

    const typeBadge = isImage     ? 'IMG'
        : isComponent ? 'COMP'
        : isReport    ? 'RPT'
        : isChart     ? 'CHT'
        : isTable     ? 'TBL'
        : 'TEXT';

    const badgeClass = [
        'slds-badge',
        isText      ? 'widget-badge--text'
            : isImage  ? 'widget-badge--image'
            : isReport ? 'widget-badge--report'
            : isChart  ? 'widget-badge--chart'
            : isTable  ? 'widget-badge--table'
                       : 'widget-badge--component',
    ].join(' ');

    const cardClass = [
        'widget-card',
        'slds-card',
        w._isDragging ? 'widget-card--dragging' : '',
    ].filter(Boolean).join(' ');

    const cardStyle = [
        `grid-column: ${w.colStart || 1} / span ${w.colSpan || DEFAULT_COL_SPAN}`,
        `grid-row: ${w.rowStart || 1} / span ${w.rowSpan || DEFAULT_ROW_SPAN}`,
    ].join('; ');

    const previewTextStyle = [
        `color: ${w.textColor || '#181818'}`,
        `background: ${w.backgroundColor || '#fff'}`,
        `font-size: ${w.fontSize || '0.875rem'}`,
        w.isBold ? 'font-weight:700' : '',
    ].filter(Boolean).join('; ');

    const previewContent = isReport ? `📈 Report · ${w.reportId || '미설정'}`
        : isChart  ? `📊 Chart · ${w.chartSObject || '미설정'} · ${w.chartType || 'bar'}`
        : isTable  ? `📋 Table · ${w.tableSObject || '미설정'}`
        : (w.content || '').replace(/<[^>]+>/g, '').slice(0, 120);

    return {
        ...w,
        isText,
        isImage,
        isComponent,
        isReport,
        isChart,
        isTable,
        noImage         : isImage && !w.imageUrl,
        isDeletable     : !w.isFixed,
        typeBadge,
        badgeClass,
        cardClass,
        cardStyle,
        previewContent,
        previewTextStyle,
    };
}

// ── UI 계산 속성 제거 (저장 전 정제) ────────────────────────────────

/**
 * enrich()로 추가된 계산 속성을 제거해 순수 데이터만 반환
 * @param {Object} w - enrich된 위젯 객체
 * @returns {Object} 저장 가능한 순수 위젯 데이터
 */
export function strip(w) {
    // eslint-disable-next-line no-unused-vars
    const {
        isText, isImage, isComponent, isReport, isChart, isTable,
        noImage, isDeletable,
        typeBadge, badgeClass, cardClass, cardStyle,
        previewContent, previewTextStyle,
        _isDragging,
        ...clean
    } = w;
    return clean;
}

// ── 위젯 생성 ────────────────────────────────────────────────────────

/**
 * 팔레트 아이템 데이터로 신규 위젯 객체 생성
 * @param {Object} data           - 팔레트 아이템 { widgetType, componentName }
 * @param {Object} slot           - 배치 위치 { colStart, rowStart }
 * @param {Array}  availableComponents - Apex에서 받은 컴포넌트 목록 (기본 제목 결정용)
 * @returns {Object} enrich된 신규 위젯
 */
export function createFromPalette(data, slot, availableComponents = []) {
    const widgetId = `widget_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    return enrich({
        widgetId,
        widgetType     : data.widgetType,
        title          : defaultTitle(data.widgetType, data.componentName, availableComponents),
        content        : '',
        imageUrl       : '',
        componentName  : data.componentName || '',
        // REPORT 기본값
        reportId       : '',
        // CHART 기본값
        chartSObject      : '',
        chartGroupBy      : '',
        chartValueField   : '',
        chartAggregation  : 'COUNT',
        chartType         : 'bar',
        // TABLE 기본값
        tableSObject      : '',
        tableFields       : '',
        tableWhereClause  : '',
        tableOrderBy      : '',
        tableLimit        : 50,
        colStart       : slot.colStart,
        rowStart       : slot.rowStart,
        colSpan        : DEFAULT_COL_SPAN,
        rowSpan        : DEFAULT_ROW_SPAN,
        backgroundColor: '#ffffff',
        textColor      : '#181818',
        fontSize       : '0.875rem',
        isBold         : false,
        isFixed        : false,
    });
}

/**
 * 위젯 타입과 컴포넌트명으로 기본 제목 반환
 * @param {string} type               - WIDGET_TYPE 값
 * @param {string} componentName      - COMPONENT 타입의 LWC API명
 * @param {Array}  availableComponents - Apex 컴포넌트 목록
 * @returns {string} 기본 제목
 */
export function defaultTitle(type, componentName, availableComponents = []) {
    if (type === WIDGET_TYPE.TEXT)   return '텍스트 위젯';
    if (type === WIDGET_TYPE.IMAGE)  return '이미지 위젯';
    if (type === WIDGET_TYPE.REPORT) return '리포트 위젯';
    if (type === WIDGET_TYPE.CHART)  return '차트 위젯';
    if (type === WIDGET_TYPE.TABLE)  return '테이블 위젯';
    // COMPONENT 타입: availableComponents 에서 레이블 탐색
    const found = (availableComponents || []).find(c => (c.value || c.componentName) === componentName);
    return found ? (found.label || found.name) : '컴포넌트 위젯';
}

// ── 그리드 슬롯 탐색 ────────────────────────────────────────────────

/**
 * 위젯 목록에서 지정 크기의 빈 슬롯을 탐색
 * @param {number} colSpan  - 필요한 열 너비
 * @param {number} rowSpan  - 필요한 행 높이
 * @param {Array}  widgets  - 현재 배치된 위젯 목록
 * @returns {{ colStart: number, rowStart: number }}
 */
export function findFreeSlot(colSpan, rowSpan, widgets) {
    if (!widgets.length) return { colStart: 1, rowStart: 1 };

    const occupied = new Set();
    let maxRow = 0;

    for (const w of widgets) {
        const r0 = w.rowStart || 1;
        const c0 = w.colStart || 1;
        const re = r0 + (w.rowSpan || DEFAULT_ROW_SPAN) - 1;
        const ce = c0 + (w.colSpan  || DEFAULT_COL_SPAN) - 1;
        if (re > maxRow) maxRow = re;
        for (let r = r0; r <= re; r++) {
            for (let c = c0; c <= ce; c++) {
                occupied.add(`${c},${r}`);
            }
        }
    }

    for (let r = 1; r <= maxRow + rowSpan + 1; r++) {
        for (let c = 1; c <= COLS - colSpan + 1; c++) {
            let fits = true;
            outer: for (let dr = 0; dr < rowSpan; dr++) {
                for (let dc = 0; dc < colSpan; dc++) {
                    if (occupied.has(`${c + dc},${r + dr}`)) {
                        fits = false;
                        break outer;
                    }
                }
            }
            if (fits) return { colStart: c, rowStart: r };
        }
    }

    return { colStart: 1, rowStart: maxRow + 1 };
}
