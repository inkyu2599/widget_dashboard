/**
 * @description [영업포털-대시보드] 이미지 위젯
 * @author      Dashboard Team
 * @date        2026-03-06
 */
import { LightningElement, api } from 'lwc';

export default class CmDashboardWidgetImage extends LightningElement {
    @api widget = {};
    @api mode   = 'DEFAULT';

    get hasImage() { return !!this.widget?.imageUrl; }
    get noImage()  { return !this.widget?.imageUrl; }

    get rootStyle() {
        const bg = this.widget?.backgroundColor || '#f8f8f8';
        return `background:${bg}; height:100%; box-sizing:border-box; display:flex; flex-direction:column; overflow:hidden;`;
    }
}
