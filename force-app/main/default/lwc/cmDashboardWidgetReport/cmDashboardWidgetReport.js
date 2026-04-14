/**
 * @description [영업포털-대시보드] 리포트 위젯
 *              Salesforce 리포트를 iframe으로 임베드합니다.
 *              설정에서 입력한 리포트 ID로 리포트 URL을 구성합니다.
 */
import { LightningElement, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';

export default class CmDashboardWidgetReport extends NavigationMixin(LightningElement) {

    @api widget = {};
    @api mode   = 'DEFAULT';

    get hasReport() {
        return !!this.widget?.reportId;
    }

    get reportUrl() {
        const id = this.widget?.reportId || '';
        return `/lightning/r/Report/${id}/view?queryScope=userFolders`;
    }
}
