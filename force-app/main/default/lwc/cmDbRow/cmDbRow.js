import { LightningElement, api } from 'lwc';

export default class CmDbRow extends LightningElement {
    @api row = {};
    @api rowHeight = '300px';

    get rowStyle() {
        return `height:${this.rowHeight};`;
    }
}
