/**
 * @description [영업포털-대시보드] 텍스트 위젯
 * @author      Dashboard Team
 * @date        2026-03-06
 */
import { LightningElement, api } from 'lwc';

export default class CmDashboardWidgetText extends LightningElement {
    @api widget = {};
    @api mode   = 'DEFAULT';

    get rootStyle() {
        const bg   = this.widget?.backgroundColor || '#ffffff';
        const color= this.widget?.textColor       || '#181818';
        return `background:${bg}; color:${color}; height:100%; padding:1rem; box-sizing:border-box; overflow:auto;`;
    }

    get titleStyle() {
        const bold = this.widget?.isBold !== false;
        const size = this.widget?.fontSize ? `font-size:${this.widget.fontSize};` : '';
        return `font-weight:${bold ? '700' : '400'}; margin-bottom:0.5rem; ${size}`;
    }

    get bodyStyle() {
        const size = this.widget?.fontSize ? `font-size:${this.widget.fontSize};` : '';
        return `line-height:1.6; ${size}`;
    }
}
