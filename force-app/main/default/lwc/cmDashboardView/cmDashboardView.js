import { LightningElement, api, wire, track } from 'lwc';
import getDashboard        from '@salesforce/apex/CM_DashboardController.getDashboard';
import saveDashboard       from '@salesforce/apex/CM_DashboardController.saveDashboard';
import savePersonalLayout  from '@salesforce/apex/CM_DashboardController.savePersonalLayout';
import resetPersonalLayout from '@salesforce/apex/CM_DashboardController.resetPersonalLayout';
import { parseLayout, stringifyLayout } from 'c/cmDashboardUtils';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class CmDashboardView extends LightningElement {
    @api recordId;
    @api isAdmin = false;

    @track isLoading      = false;
    @track hasError       = false;
    @track errorMessage   = '';
    @track isEditing      = false;
    @track _dashboard     = null;

    connectedCallback() {
        this._fetchDashboard();
    }

    _fetchDashboard() {
        this.isLoading = true;
        this.hasError  = false;
        getDashboard({ dashboardId: this.recordId })
            .then(data => { this._dashboard = data; })
            .catch(e  => {
                this.hasError     = true;
                this.errorMessage = (e.body && e.body.message) || '조회 실패';
            })
            .finally(() => { this.isLoading = false; });
    }

    get dashboard()          { return this._dashboard || {}; }
    get hasPersonalLayout()  { return this._dashboard?.HasPersonalLayout === true; }

    get layout() {
        return parseLayout(this.dashboard.LayoutConfig__c);
    }

    get widgets()  { return this.layout.widgets || []; }
    get isEmpty()  { return this.widgets.length === 0; }

    get widgetsWithStyle() {
        return this.widgets.map(w => ({
            ...w,
            cellStyle: `grid-column:${(w.x || 0) + 1}/span ${w.w || 4};grid-row:${(w.y || 0) + 1}/span ${w.h || 3};`,
        }));
    }

    handleBack()       { this.dispatchEvent(new CustomEvent('back')); }
    handleEdit()       { this.isEditing = true; }
    handleCancelEdit() { this.isEditing = false; }

    async handleSave(event) {
        const updatedLayout = event.detail.layout;
        this.isLoading = true;
        try {
            if (this.isAdmin) {
                // 관리자: 대시보드 레코드에 저장
                await saveDashboard({
                    dashboardJson: JSON.stringify({
                        id          : this.dashboard.Id,
                        name        : this.dashboard.Name,
                        description : this.dashboard.Description__c || '',
                        isActive    : this.dashboard.IsActive__c !== false,
                        layoutConfig: stringifyLayout(updatedLayout),
                    }),
                });
            } else {
                // 일반 사용자: 개인 레이아웃에 저장
                await savePersonalLayout({
                    dashboardId: this.recordId,
                    layoutJson : stringifyLayout(updatedLayout),
                });
            }
            this.isEditing = false;
            this._fetchDashboard();
            this.dispatchEvent(new ShowToastEvent({ title: '저장됨', variant: 'success' }));
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

    async handleReset() {
        // eslint-disable-next-line no-alert
        if (!confirm('개인 레이아웃을 초기화하고 기본 레이아웃으로 되돌리겠습니까?')) return;
        this.isLoading = true;
        try {
            await resetPersonalLayout({ dashboardId: this.recordId });
            this._fetchDashboard();
            this.dispatchEvent(new ShowToastEvent({ title: '기본 레이아웃으로 초기화됨', variant: 'success' }));
        } catch (e) {
            this.dispatchEvent(new ShowToastEvent({
                title  : '초기화 실패',
                message: (e.body && e.body.message) || e.message,
                variant: 'error',
            }));
        } finally {
            this.isLoading = false;
        }
    }
}
