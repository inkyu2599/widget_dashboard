import { LightningElement, api, wire, track } from 'lwc';
import getTableData from '@salesforce/apex/CM_DashboardController.getTableData';

export default class CmDbTable extends LightningElement {
    @api widget = {};

    @track isLoading    = false;
    @track hasError     = false;
    @track errorMessage = '';
    @track tableColumns = [];
    @track tableRows    = [];

    get isConfigured() {
        return !!(this.widget?.tableSObject && this.widget?.tableFields);
    }

    get _tableSObject()    { return this.widget?.tableSObject     || ''; }
    get _tableFields()     { return this.widget?.tableFields      || ''; }
    get _tableWhere()      { return this.widget?.tableWhereClause || ''; }
    get _tableOrderBy()    { return this.widget?.tableOrderBy     || ''; }
    get _tableLimit()      { return this.widget?.tableLimit       || 50; }

    @wire(getTableData, {
        sObjectName : '$_tableSObject',
        fields      : '$_tableFields',
        whereClause : '$_tableWhere',
        orderBy     : '$_tableOrderBy',
        limitRows   : '$_tableLimit',
    })
    wiredData({ error, data }) {
        if (data) {
            this.tableColumns = (data.columns || []).map((col, i) => ({
                label    : col.label,
                fieldName: col.fieldName,
                type     : 'text',
            }));
            // lightning-datatable requires key-field; add __rowIndex
            this.tableRows = (data.rows || []).map((row, i) => ({ ...row, __rowIndex: i }));
            this.hasError  = false;
        } else if (error) {
            this.hasError     = true;
            this.errorMessage = (error.body && error.body.message) || '데이터 조회 실패';
            this.tableColumns = [];
            this.tableRows    = [];
        }
        this.isLoading = false;
    }
}
