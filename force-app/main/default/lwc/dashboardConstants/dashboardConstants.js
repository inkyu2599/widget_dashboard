/**
 * @description 대시보드 공유 상수 모듈
 *              모든 컴포넌트에서 이 파일을 import하여 사용
 */

// ── 그리드 설정 ──────────────────────────────────────────────────────
export const COLS             = 12;
export const DEFAULT_COL_SPAN = 4;
export const DEFAULT_ROW_SPAN = 3;
export const CELL_H_PX        = 82;   // row 높이(72) + gap(10)
export const GAP_PX           = 8;    // CSS gap

// ── 위젯 타입 ────────────────────────────────────────────────────────
// 새 타입 추가 시 이 객체에만 추가하면 됩니다
export const WIDGET_TYPE = {
    TEXT      : 'TEXT',
    IMAGE     : 'IMAGE',
    COMPONENT : 'COMPONENT',
    REPORT    : 'REPORT',
    CHART     : 'CHART',
    TABLE     : 'TABLE',
};

// ── 모드 ─────────────────────────────────────────────────────────────
export const MODE_EDIT = 'EDIT';
