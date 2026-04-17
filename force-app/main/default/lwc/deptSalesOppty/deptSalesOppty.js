import { LightningElement, api, track, wire } from 'lwc';
import getOpportunities from '@salesforce/apex/DeptSalesOpptyController.getOpportunities';

export default class DeptSalesOppty extends LightningElement {
    @api widget = {};

    @track columns   = [];
    @track rows      = [];
    @track isLoading = true;
    @track errorMsg  = null;

    // widget.componentConfig가 바뀔 때마다 자동 재조회
    get _configJson() {
        const cfg = this.widget?.componentConfig;
        return cfg ? JSON.stringify(cfg) : '{}';
    }

    @wire(getOpportunities, { configJson: '$_configJson' })
    wiredData({ data, error }) {
        this.isLoading = false;
        if (data) {
            this.columns = (data.columns || []).map(col => ({
                label    : col.label,
                fieldName: col.fieldName,
                type     : col.fieldName === 'Amount' ? 'currency' : 'text',
                cellAttributes: col.fieldName === 'Amount'
                    ? { alignment: 'right' } : {},
            }));
            this.rows    = (data.rows || []).map((r, i) => ({ ...r, _idx: i }));
            this.errorMsg = null;
        } else if (error) {
            this.errorMsg = error?.body?.message || '데이터 조회 실패';
        }
    }

    get hasData()    { return this.rows.length > 0; }
    get isEmpty()    { return !this.isLoading && !this.errorMsg && !this.hasData; }
}
