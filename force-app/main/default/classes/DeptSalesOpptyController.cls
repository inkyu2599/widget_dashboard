/**
 * @description [영업팀] 영업기회 현황 위젯 Apex 컨트롤러
 *              CM_DashboardQueryHelper를 통해 안전한 SOQL 실행
 */
public with sharing class DeptSalesOpptyController {

    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getOpportunities(String configJson) {
        try {
            // widget.componentConfig JSON 파싱
            Map<String, Object> cfg = String.isNotBlank(configJson)
                ? (Map<String, Object>) JSON.deserializeUntyped(configJson)
                : new Map<String, Object>();

            // 설정값 추출 (없으면 기본값)
            String stage      = cfg.containsKey('stage')
                                    ? String.valueOf(cfg.get('stage')) : null;
            String closeYear  = cfg.containsKey('closeYear')
                                    ? String.valueOf(cfg.get('closeYear')) : null;
            Integer rowLimit  = cfg.containsKey('limit')
                                    ? Integer.valueOf(cfg.get('limit')) : 20;

            // WHERE 조건 조립
            List<String> conditions = new List<String>();
            conditions.add('IsDeleted = false');
            if (String.isNotBlank(stage)) {
                conditions.add('StageName = \'' + String.escapeSingleQuotes(stage) + '\'');
            }
            if (String.isNotBlank(closeYear)) {
                conditions.add('CALENDAR_YEAR(CloseDate) = ' + Integer.valueOf(closeYear));
            }
            String whereClause = String.join(conditions, ' AND ');

            // CM_DashboardQueryHelper로 안전한 쿼리 실행
            return CM_DashboardQueryHelper.queryTable(
                'Opportunity',
                'Name, StageName, Amount, CloseDate, AccountId',
                whereClause,
                'CloseDate DESC',
                rowLimit
            );
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}
