/**
 * @description  [영업포털-대시보드] 홈 화면 메인 진입점
 * @author       Dashboard Team
 * @date         2026-03-06
 */
import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent }               from 'lightning/platformShowToastEvent';
import userId                           from '@salesforce/user/Id';
import getUserDashboardLayout           from '@salesforce/apex/CM_DashboardWidgetController.getUserDashboardLayout';
import saveDashboardLayout              from '@salesforce/apex/CM_DashboardWidgetController.saveDashboardLayout';
import getAvailableComponents           from '@salesforce/apex/CM_DashboardWidgetController.getAvailableComponents';

const DEFAULT_COLUMNS = 12;

export default class CmDashboardMain extends LightningElement {

    // ── App Builder 설정 프로퍼티 ────────────────────────────────
    @api title = '내 대시보드';

    // ── 레이블 ────────────────────────────────────────────────────
    get labels() {
        return {
            title      : this.title || '내 대시보드',
            btnEdit    : '추가/편집',
            saveSuccess: '대시보드가 저장되었습니다.',
            saveError  : '저장 중 오류가 발생했습니다.',
        };
    }

    // ── 상태 ────────────────────────────────────────────────────
    @track widgets               = [];
    @track availableComponents   = [];
    @track isLoading             = false;
    @track hasError              = false;
    @track errorMessage          = '';
    @track isEditModalOpen       = false;

    layoutId = null;
    columns  = DEFAULT_COLUMNS;

    // ── Getters ──────────────────────────────────────────────────
    get isReady() { return !this.isLoading && !this.hasError; }

    // ── Lifecycle ─────────────────────────────────────────────────
    connectedCallback() {
        this._loadLayout();
        this._loadAvailableComponents();
    }

    // ── 데이터 로딩 ───────────────────────────────────────────────
    async _loadLayout() {
        this.isLoading = true;
        this.hasError  = false;
        try {
            const dto     = await getUserDashboardLayout({ userId });
            this.layoutId = dto.layoutId || null;
            this.columns  = dto.columns  || DEFAULT_COLUMNS;
            this.widgets  = JSON.parse(JSON.stringify(dto.widgets || []));
        } catch (error) {
            this.hasError     = true;
            this.errorMessage = error?.body?.message || error?.message || '알 수 없는 오류가 발생했습니다.';
        } finally {
            this.isLoading = false;
        }
    }

    async _loadAvailableComponents() {
        try {
            this.availableComponents = await getAvailableComponents() || [];
        } catch (error) {
            console.error('[cmDashboardMain] getAvailableComponents error:', error);
        }
    }

    // ── 편집 모달 ─────────────────────────────────────────────────
    handleOpenEditModal() {
        this.isEditModalOpen = true;
    }

    async handleEditModalSave(event) {
        this.isEditModalOpen = false;
        const { widgets }    = event.detail;
        this.widgets         = widgets;
        this.isLoading       = true;
        try {
            const payload = {
                layoutId  : this.layoutId,
                layoutName: this.labels.title,
                columns   : this.columns,
                widgets   : this.widgets,
            };
            const savedId = await saveDashboardLayout({ layoutJson: JSON.stringify(payload) });
            this.layoutId = savedId;
            this._showToast('성공', this.labels.saveSuccess, 'success');
        } catch (error) {
            this._showToast('오류', this.labels.saveError, 'error');
            console.error('[cmDashboardMain] save error:', error);
        } finally {
            this.isLoading = false;
        }
    }

    handleEditModalCancel() {
        this.isEditModalOpen = false;
    }

    // ── 그리드 이벤트 ─────────────────────────────────────────────
    handleWidgetResize(event) {
        const { widgetId, colSpan, rowSpan } = event.detail;
        this.widgets = this.widgets.map(w =>
            w.widgetId === widgetId ? { ...w, colSpan, rowSpan } : w
        );
    }

    handleWidgetMove(event) {
        const { widgetId, colStart, rowStart } = event.detail;
        this.widgets = this.widgets.map(w =>
            w.widgetId === widgetId ? { ...w, colStart, rowStart } : w
        );
    }

    handleWidgetDelete(event) {
        const { widgetId } = event.detail;
        this.widgets = this.widgets.filter(w => w.widgetId !== widgetId);
    }

    handleWidgetEdit() { /* 뷰 모드 편집은 편집 버튼을 통해 진입 */ }

    _showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}
