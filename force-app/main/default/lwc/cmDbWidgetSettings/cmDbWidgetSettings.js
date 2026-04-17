import { LightningElement, api, track, wire } from 'lwc';
import { WIDGET_TYPE } from 'c/cmDashboardConstants';
import getAvailableComponents from '@salesforce/apex/CM_DashboardController.getAvailableComponents';
import getAvailableSObjects   from '@salesforce/apex/CM_DashboardController.getAvailableSObjects';

export default class CmDbWidgetSettings extends LightningElement {
    @api
    get widget() { return this._widget; }
    set widget(val) {
        this._widget = val || {};
        this.draft   = { ...this._widget };
    }

    _widget = {};
    @track draft = {};

    @wire(getAvailableComponents)
    wiredComponents;

    @track _chartSObjects = [];
    @track _tableSObjects = [];
    _chartLoaded = false;
    _tableLoaded = false;

    connectedCallback() {
        getAvailableSObjects({ widgetType: 'CHART' })
            .then(data => { this._chartSObjects = data || []; this._chartLoaded = true; })
            .catch(() => { this._chartLoaded = true; });
        getAvailableSObjects({ widgetType: 'TABLE' })
            .then(data => { this._tableSObjects = data || []; this._tableLoaded = true; })
            .catch(() => { this._tableLoaded = true; });
    }

    get typeOptions() {
        return [
            { label: '컴포넌트', value: WIDGET_TYPE.COMPONENT },
            { label: '차트',     value: WIDGET_TYPE.CHART },
            { label: '테이블',   value: WIDGET_TYPE.TABLE },
        ];
    }

    get aggregationOptions() {
        const sObjectName = (this.draft?.chartSObject || '').toLowerCase();
        const cfg = this._chartSObjects.find(c => c.apiName && c.apiName.toLowerCase() === sObjectName);
        const allowed = cfg?.allowedAggregations
            ? cfg.allowedAggregations.split(',').map(s => s.trim())
            : ['COUNT', 'SUM', 'AVG'];
        return [
            { label: 'COUNT', value: 'COUNT' },
            { label: 'SUM',   value: 'SUM' },
            { label: 'AVG',   value: 'AVG' },
        ].filter(o => allowed.includes(o.value));
    }

    get chartTypeOptions() {
        return [
            { label: '막대 (Bar)',      value: 'bar' },
            { label: '꺾은선 (Line)',   value: 'line' },
            { label: '원형 (Pie)',      value: 'pie' },
            { label: '도넛 (Doughnut)', value: 'doughnut' },
        ];
    }

    get componentOptions() {
        const list = this.wiredComponents?.data || [];
        return list.map(c => ({ label: c.MasterLabel, value: c.ComponentName__c }));
    }

    get chartSObjectOptions() {
        const opts = this._chartSObjects.map(c => ({ label: c.label, value: c.apiName }));
        // 기존 저장값이 목록에 없으면 임시 옵션 추가 (combobox value 불일치 에러 방지)
        const cur = this.draft?.chartSObject;
        if (cur && opts.length > 0 && !opts.find(o => o.value === cur)) {
            opts.unshift({ label: cur, value: cur });
        }
        return opts;
    }

    get tableSObjectOptions() {
        const opts = this._tableSObjects.map(c => ({ label: c.label, value: c.apiName }));
        const cur = this.draft?.tableSObject;
        if (cur && opts.length > 0 && !opts.find(o => o.value === cur)) {
            opts.unshift({ label: cur, value: cur });
        }
        return opts;
    }

    get chartSObjectDisabled() { return !this._chartLoaded; }
    get tableSObjectDisabled() { return !this._tableLoaded; }

    get configPlaceholder() { return '{"key": "value"}'; }

    get componentConfigStr() {
        const cfg = this.draft?.componentConfig;
        if (!cfg || Object.keys(cfg).length === 0) return '';
        try { return JSON.stringify(cfg, null, 2); } catch(e) { return ''; }
    }

    handleComponentConfigChange(event) {
        const raw = event.detail.value;
        try {
            this.draft = { ...this.draft, componentConfig: raw ? JSON.parse(raw) : {} };
        } catch(e) {
            // JSON 파싱 실패 시 문자열 그대로 보관 (apply 시 검증)
        }
    }

    get isComponent() { return (this.draft?.widgetType || WIDGET_TYPE.COMPONENT) === WIDGET_TYPE.COMPONENT; }
    get isChart()     { return this.draft?.widgetType === WIDGET_TYPE.CHART; }
    get isTable()     { return this.draft?.widgetType === WIDGET_TYPE.TABLE; }
    get showValueField() {
        return this.draft?.chartAggregation === 'SUM' || this.draft?.chartAggregation === 'AVG';
    }

    handleTypeChange(event) {
        this.draft = { ...this.draft, widgetType: event.detail.value };
    }

    handleFieldChange(event) {
        const field = event.target.dataset.field;
        this.draft = { ...this.draft, [field]: event.detail.value };
    }

    handleChartSObjectChange(event) {
        const newSObject = event.detail.value;
        this.draft = { ...this.draft, chartSObject: newSObject, chartAggregation: 'COUNT' };
    }

    handleApply() {
        this.dispatchEvent(new CustomEvent('apply', { detail: { widget: { ...this.draft } } }));
    }

    handleCancel() {
        this.dispatchEvent(new CustomEvent('cancel'));
    }
}
