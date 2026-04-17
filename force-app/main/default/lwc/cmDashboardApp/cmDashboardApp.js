import { LightningElement, wire, track } from 'lwc';
import isAdminApex         from '@salesforce/apex/CM_DashboardController.isAdmin';
import getDashboards       from '@salesforce/apex/CM_DashboardController.getDashboards';
import saveDashboard       from '@salesforce/apex/CM_DashboardController.saveDashboard';
import deleteDashboard     from '@salesforce/apex/CM_DashboardController.deleteDashboard';
import getDefaultDashboard from '@salesforce/apex/CM_DashboardController.getDefaultDashboard';
import setPersonalDefault  from '@salesforce/apex/CM_DashboardController.setPersonalDefault';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class CmDashboardApp extends LightningElement {
    @track isLoading   = false;
    @track isCreating  = false;
    @track selectedId  = null;
    @track newName     = '';
    @track newDesc     = '';
    @track _isAdmin    = false;
    @track _dashboards = [];
    @track _defaultResolved = false;

    get isAdmin()      { return this._isAdmin; }
    get dashboards()   { return this._dashboards; }
    get hasDashboards(){ return this._dashboards.length > 0; }
    get isCreateDisabled() { return !this.newName?.trim(); }

    connectedCallback() {
        isAdminApex().then(result => { this._isAdmin = result === true; }).catch(() => {});
        this._loadDashboards();
        getDefaultDashboard().then(data => {
            if (this._defaultResolved) return;
            this._defaultResolved = true;
            if (data) this.selectedId = data;
        }).catch(() => { this._defaultResolved = true; });
    }

    _loadDashboards() {
        this.isLoading = true;
        getDashboards()
            .then(data => { this._dashboards = data || []; })
            .catch(() => { this._dashboards = []; })
            .finally(() => { this.isLoading = false; });
    }

    // ── 뷰 이동 ─────────────────────────────────────────────────────

    handleSelect(event) { this.selectedId = event.detail.id; }
    handleBack()        { this.selectedId = null; }

    // ── 신규 생성 ────────────────────────────────────────────────────

    handleNew()         { this.isCreating = true; }
    handleCancelNew()   { this.isCreating = false; this.newName = ''; this.newDesc = ''; }
    handleNameChange(e) { this.newName = e.detail.value; }
    handleDescChange(e) { this.newDesc = e.detail.value; }

    async handleCreate() {
        if (!this.newName.trim()) return;
        this.isLoading = true;
        try {
            const newId = await saveDashboard({
                dashboardJson: JSON.stringify({
                    name        : this.newName.trim(),
                    description : this.newDesc.trim(),
                    isActive    : true,
                    layoutConfig: '{"widgets":[]}',
                }),
            });
            this.isCreating = false;
            this.newName    = '';
            this.newDesc    = '';
            this._loadDashboards();
            this.selectedId = newId;
        } catch (e) {
            this.dispatchEvent(new ShowToastEvent({
                title  : '생성 실패',
                message: (e.body && e.body.message) || e.message,
                variant: 'error',
            }));
        } finally {
            this.isLoading = false;
        }
    }

    // ── 삭제 ─────────────────────────────────────────────────────────

    async handleDelete(event) {
        const id = event.detail.id;
        // eslint-disable-next-line no-alert
        if (!confirm('대시보드를 삭제하시겠습니까?')) return;
        this.isLoading = true;
        try {
            await deleteDashboard({ dashboardId: id });
            this._loadDashboards();
            this.dispatchEvent(new ShowToastEvent({ title: '삭제됨', variant: 'success' }));
        } catch (e) {
            this.dispatchEvent(new ShowToastEvent({
                title  : '삭제 실패',
                message: (e.body && e.body.message) || e.message,
                variant: 'error',
            }));
        } finally {
            this.isLoading = false;
        }
    }

    // ── Audience 저장 ────────────────────────────────────────────────

    async handleAudienceSave(event) {
        const { id, audienceType, audienceValue, priority } = event.detail;
        const dash = this._dashboards.find(d => d.Id === id);
        if (!dash) return;
        this.isLoading = true;
        try {
            await saveDashboard({
                dashboardJson: JSON.stringify({
                    id          : dash.Id,
                    name        : dash.Name,
                    description : dash.Description__c || '',
                    isActive    : dash.IsActive__c !== false,
                    layoutConfig: dash.LayoutConfig__c || '{"widgets":[]}',
                    audienceType,
                    audienceValue : audienceValue || null,
                    priority      : priority != null ? priority : 99,
                }),
            });
            this._loadDashboards();
            this.dispatchEvent(new ShowToastEvent({ title: '대상 설정 저장됨', variant: 'success' }));
        } catch (e) {
            this.dispatchEvent(new ShowToastEvent({
                title  : '저장 실패',
                message: (e.body && e.body.message) || e.message,
                variant: 'error',
            }));
        } finally {
            this.isLoading = false;
        }
    }

    // ── 개인 기본 대시보드 설정 ──────────────────────────────────────

    async handlePersonalDefault(event) {
        const { id, clear } = event.detail;
        this.isLoading = true;
        try {
            await setPersonalDefault({ dashboardId: clear ? null : id });
            this.dispatchEvent(new ShowToastEvent({
                title  : clear ? '개인 설정 해제됨' : '내 기본 대시보드로 설정됨',
                variant: 'success',
            }));
        } catch (e) {
            this.dispatchEvent(new ShowToastEvent({
                title  : '설정 실패',
                message: (e.body && e.body.message) || e.message,
                variant: 'error',
            }));
        } finally {
            this.isLoading = false;
        }
    }
}
