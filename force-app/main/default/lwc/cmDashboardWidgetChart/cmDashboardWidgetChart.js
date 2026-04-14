/**
 * @description [영업포털-대시보드] 차트 위젯
 *              Apex getChartData로 집계 데이터를 받아 Chart.js로 렌더링합니다.
 *              Static Resource 'chartjs' 에 Chart.js 4.x minified 파일이 있어야 합니다.
 */
import { LightningElement, api, wire, track } from 'lwc';
import { loadScript }   from 'lightning/platformResourceLoader';
import CHARTJS           from '@salesforce/resourceUrl/chartjs';
import getChartData      from '@salesforce/apex/CM_DashboardWidgetController.getChartData';

// Chart.js 팔레트
const COLORS = [
    '#0176d3', '#1b96ff', '#22a06b', '#ff8f00',
    '#ba0517', '#8b5cf6', '#06b6d4', '#f59e0b',
];

export default class CmDashboardWidgetChart extends LightningElement {

    @api mode = 'DEFAULT';

    @track isLoading    = false;
    @track hasError     = false;
    @track errorMessage = '';

    _widget       = {};
    _chartLib     = false;   // Chart.js 로드 완료 여부
    _chartInstance = null;   // 현재 Chart 인스턴스
    _wireData     = null;

    @api
    get widget() { return this._widget; }
    set widget(val) {
        const prev = this._widget;
        this._widget = val || {};
        // sObject/groupBy/chartType 변경 시 차트 재생성
        if (
            prev.chartSObject   !== this._widget.chartSObject   ||
            prev.chartGroupBy   !== this._widget.chartGroupBy   ||
            prev.chartValueField!== this._widget.chartValueField||
            prev.chartAggregation!==this._widget.chartAggregation||
            prev.chartType      !== this._widget.chartType
        ) {
            this._wireData = null;
            this._renderIfReady();
        }
    }

    get isConfigured() {
        return !!(this._widget.chartSObject && this._widget.chartGroupBy);
    }

    // ── Wire: Apex 데이터 조회 ──────────────────────────────────────

    @wire(getChartData, {
        sObjectName : '$_chartSObject',
        groupByField: '$_chartGroupBy',
        valueField  : '$_chartValueField',
        aggregation : '$_chartAggregation',
        whereClause : '',
    })
    wiredData({ error, data }) {
        if (data) {
            this._wireData = data;
            this.hasError  = false;
            this._renderIfReady();
        } else if (error) {
            this.hasError     = true;
            this.errorMessage = (error.body && error.body.message) || '데이터 조회 실패';
            this._destroyChart();
        }
        this.isLoading = false;
    }

    // Wire 리액티브 프로퍼티 ($ prefix 동작용)
    get _chartSObject()    { return this._widget.chartSObject    || ''; }
    get _chartGroupBy()    { return this._widget.chartGroupBy    || ''; }
    get _chartValueField() { return this._widget.chartValueField || ''; }
    get _chartAggregation(){ return this._widget.chartAggregation|| 'COUNT'; }

    // ── 라이프사이클 ────────────────────────────────────────────────

    renderedCallback() {
        if (this._chartLib) return;
        loadScript(this, CHARTJS + '/chartjs.js')
            .then(() => {
                this._chartLib = true;
                this._renderIfReady();
            })
            .catch(err => {
                this.hasError     = true;
                this.errorMessage = 'Chart.js 로드 실패: ' + (err.message || '');
            });
    }

    disconnectedCallback() {
        this._destroyChart();
    }

    // ── 차트 렌더링 ─────────────────────────────────────────────────

    _renderIfReady() {
        if (!this._chartLib || !this._wireData || !this.isConfigured) return;

        const canvas = this.refs.canvas;
        if (!canvas) return;

        this._destroyChart();

        const labels = this._wireData.map(r => r.label);
        const values = this._wireData.map(r => Number(r.value));
        const type   = this._widget.chartType || 'bar';

        // eslint-disable-next-line no-undef
        this._chartInstance = new Chart(canvas, {
            type,
            data: {
                labels,
                datasets: [{
                    label : this._widget.title || '데이터',
                    data  : values,
                    backgroundColor: type === 'line'
                        ? COLORS[0]
                        : labels.map((_, i) => COLORS[i % COLORS.length]),
                    borderColor: type === 'line' ? COLORS[0] : 'transparent',
                    borderWidth: type === 'line' ? 2 : 0,
                    fill: false,
                }],
            },
            options: {
                responsive        : true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display : type === 'pie' || type === 'doughnut',
                        position: 'bottom',
                    },
                },
                scales: (type === 'bar' || type === 'line') ? {
                    y: { beginAtZero: true },
                } : {},
            },
        });
    }

    _destroyChart() {
        if (this._chartInstance) {
            this._chartInstance.destroy();
            this._chartInstance = null;
        }
    }
}
