import { LightningElement, api, track } from 'lwc';
import getProfiles          from '@salesforce/apex/CM_DashboardController.getProfiles';
import getPublicGroups      from '@salesforce/apex/CM_DashboardController.getPublicGroups';
import getCustomPermissions from '@salesforce/apex/CM_DashboardController.getCustomPermissions';

const TYPE_OPTIONS = [
    { label: '없음',                  value: 'None' },
    { label: 'Default (모든 사용자)', value: 'Default' },
    { label: 'Profile',               value: 'Profile' },
    { label: 'Custom Permission',     value: 'CustomPermission' },
    { label: 'Public Group',          value: 'Group' },
];

const TYPE_LABELS = {
    None: '없음', Default: 'Default', Profile: 'Profile',
    CustomPermission: 'Custom Permission', Group: 'Public Group',
};

export default class CmDashboardCard extends LightningElement {
    @api dashboard = {};
    @api isAdmin   = false;

    @track isAudienceOpen   = false;
    @track audienceType     = 'None';
    @track audienceValue    = '';
    @track priority         = 99;
    @track isLoadingOptions = false;
    @track _valueOptions    = [];

    // ── computed ────────────────────────────────────────────────────

    get lastModified() {
        if (!this.dashboard.LastModifiedDate) return '';
        return new Date(this.dashboard.LastModifiedDate).toLocaleDateString('ko-KR');
    }

    get hasAudience() {
        return this.dashboard.AudienceType__c && this.dashboard.AudienceType__c !== 'None';
    }

    get audienceLabel() {
        const t = this.dashboard.AudienceType__c;
        const v = this.dashboard.AudienceValue__c;
        const tLabel = TYPE_LABELS[t] || t;
        return v ? `대상: ${tLabel} (${v})` : `대상: ${tLabel}`;
    }

    get audienceTypeOptions() { return TYPE_OPTIONS; }

    get needsValue() {
        return ['Profile', 'CustomPermission', 'Group'].includes(this.audienceType);
    }

    get valueLabel() {
        if (this.audienceType === 'Profile')          return '프로필';
        if (this.audienceType === 'CustomPermission') return 'Custom Permission';
        if (this.audienceType === 'Group')            return 'Public Group';
        return '';
    }

    get valueOptions() { return this._valueOptions; }

    // ── handlers ────────────────────────────────────────────────────

    handleClick() {
        if (!this.isAudienceOpen) {
            this.dispatchEvent(new CustomEvent('select', { detail: { id: this.dashboard.Id } }));
        }
    }

    handleDelete(event) {
        event.stopPropagation();
        this.dispatchEvent(new CustomEvent('delete', { detail: { id: this.dashboard.Id } }));
    }

    handleSetPersonalDefault(event) {
        event.stopPropagation();
        this.dispatchEvent(new CustomEvent('personaldefault', {
            detail: { id: this.dashboard.Id, clear: false },
            bubbles: true,
        }));
    }

    handleToggleAudience(event) {
        event.stopPropagation();
        if (this.isAudienceOpen) {
            this.isAudienceOpen = false;
            return;
        }
        this.audienceType  = this.dashboard.AudienceType__c  || 'None';
        this.audienceValue = this.dashboard.AudienceValue__c || '';
        this.priority      = this.dashboard.Priority__c != null ? this.dashboard.Priority__c : 99;
        this._valueOptions = [];
        this.isAudienceOpen = true;
        if (this.needsValue) this._loadValueOptions();
    }

    handleTypeChange(event) {
        this.audienceType  = event.detail.value;
        this.audienceValue = '';
        this._valueOptions = [];
        if (this.needsValue) this._loadValueOptions();
    }

    handleValueChange(event) {
        this.audienceValue = event.detail.value;
    }

    handlePriorityChange(event) {
        this.priority = Number(event.detail.value) || 99;
    }

    handleCancelAudience(event) {
        event.stopPropagation();
        this.isAudienceOpen = false;
    }

    handleApplyAudience(event) {
        event.stopPropagation();
        this.dispatchEvent(new CustomEvent('audiencesave', {
            detail: {
                id           : this.dashboard.Id,
                audienceType : this.audienceType,
                audienceValue: this.needsValue ? this.audienceValue : null,
                priority     : this.priority,
            },
            bubbles: true,
        }));
        this.isAudienceOpen = false;
    }

    // ── private ─────────────────────────────────────────────────────

    async _loadValueOptions() {
        this.isLoadingOptions = true;
        try {
            let data;
            if (this.audienceType === 'Profile') {
                data = await getProfiles();
            } else if (this.audienceType === 'Group') {
                data = await getPublicGroups();
            } else if (this.audienceType === 'CustomPermission') {
                data = await getCustomPermissions();
            }
            this._valueOptions = (data || []).map(d => ({ label: d.label, value: d.value }));
        } catch (e) {
            this._valueOptions = [];
        } finally {
            this.isLoadingOptions = false;
        }
    }
}
