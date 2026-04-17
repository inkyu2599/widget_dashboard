import { LightningElement, api, wire, track } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import CHARTJS from '@salesforce/resourceUrl/chartjs';
import getChartData from '@salesforce/apex/CM_DashboardController.getChartData';

const COLORS = [
    '#0176d3','#1b96ff','#22a06b','#ff8f00',
    '#ba0517','#8b5cf6','#06b6d4','#f59e0b',
];

export default class CmDbChart extends LightningElement {
    @api widget = {};

    @track isLoading    = false;
    @track hasError     = false;
    @track errorMessage = '';

    _chartLib      = false;
    _chartInstance = null;
    _wireData      = null;

    get isConfigured() {
        return !!(this.widget?.chartSObject && this.widget?.chartGroupBy);
    }

    get _chartSObject()    { return this.widget?.chartSObject    || ''; }
    get _chartGroupBy()    { return this.widget?.chartGroupBy    || ''; }
    get _chartValueField() { return this.widget?.chartValueField || ''; }
    get _chartAggregation(){ return this.widget?.chartAggregation || 'COUNT'; }

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

    renderedCallback() {
        if (this._chartLib) return;
        loadScript(this, CHARTJS + '/chartjs.js')
            .then(() => { this._chartLib = true; this._renderIfReady(); })
            .catch(err => {
                this.hasError     = true;
                this.errorMessage = 'Chart.js 로드 실패: ' + (err.message || '');
            });
    }

    disconnectedCallback() { this._destroyChart(); }

    _renderIfReady() {
        if (!this._chartLib || !this._wireData || !this.isConfigured) return;
        const canvas = this.refs.canvas;
        if (!canvas) return;
        this._destroyChart();

        const labels = this._wireData.map(r => r.label);
        const values = this._wireData.map(r => Number(r.value));
        const type   = this.widget?.chartType || 'bar';

        // eslint-disable-next-line no-undef
        this._chartInstance = new Chart(canvas, {
            type,
            data: {
                labels,
                datasets: [{
                    label: this.widget?.title || '데이터',
                    data : values,
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
                plugins: { legend: { display: type === 'pie' || type === 'doughnut', position: 'bottom' } },
                scales : (type === 'bar' || type === 'line') ? { y: { beginAtZero: true } } : {},
            },
        });
    }

    _destroyChart() {
        if (this._chartInstance) { this._chartInstance.destroy(); this._chartInstance = null; }
    }
}
