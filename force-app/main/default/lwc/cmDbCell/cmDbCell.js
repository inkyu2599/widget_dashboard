import { LightningElement, api } from 'lwc';
import { WIDGET_TYPE } from 'c/cmDashboardConstants';

export default class CmDbCell extends LightningElement {
    @api widget = {};

    get isChart() { return this.widget?.widgetType === WIDGET_TYPE.CHART; }
    get isTable() { return this.widget?.widgetType === WIDGET_TYPE.TABLE; }
}
