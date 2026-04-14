/**
 * @description [영업포털-대시보드] 테이블 위젯
 *              Apex getTableData로 레코드를 조회해 lightning-datatable로 표시합니다.
 */
import { LightningElement, api, wire, track } from 'lwc';
import getTableData from '@salesforce/apex/CM_DashboardWidgetController.getTableData';

export default class CmDashboardWidgetTable extends LightningElement {

    @api mode = 'DEFAULT';

    @track isLoading    = false;
    @track hasError     = false;
    @track errorMessage = '';
    @track tableColumns = [];
    @track tableRows    = [];

    _widget = {};

    @api
    get widget() { return this._widget; }
    set widget(val) {
        this._widget = val || {};
    }

    get isConfigured() {
        return !!(this._widget.tableSObject && this._widget.tableFields);
    }

    // ── Wire 리액티브 프로퍼티 ──────────────────────────────────────

    get _tableSObject()     { return this._widget.tableSObject    || ''; }
    get _tableFields()      { return this._widget.tableFields     || ''; }
    get _tableWhereClause() { return this._widget.tableWhereClause|| ''; }
    get _tableOrderBy()     { return this._widget.tableOrderBy    || ''; }
    get _tableLimit()       { return this._widget.tableLimit      || 50; }

    // ── Wire: Apex 데이터 조회 ──────────────────────────────────────

    @wire(getTableData, {
        sObjectName : '$_tableSObject',
        fields      : '$_tableFields',
        whereClause : '$_tableWhereClause',
        orderBy     : '$_tableOrderBy',
        limitRows   : '$_tableLimit',
    })
    wiredData({ error, data }) {
        if (data) {
            this.tableColumns = (data.columns || []).map(col => ({
                label    : col.label,
                fieldName: col.fieldName,
                type     : 'text',
            }));
            this.tableRows    = data.rows || [];
            this.hasError     = false;
        } else if (error) {
            this.hasError     = true;
            this.errorMessage = (error.body && error.body.message) || '데이터 조회 실패';
            this.tableColumns = [];
            this.tableRows    = [];
        }
        this.isLoading = false;
    }
}
